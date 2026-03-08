import type { BattleRoom, BattleState, FighterState } from '../types/battle';
import { createSkeletonMinion } from '../data/minions';
import type { ActiveEffect, PowerDefinition, ModStat } from '../types/power';
import { getQuotaCost } from '../types/power';
import { EFFECT_TAGS } from '../constants/effectTags';
import { POWER_NAMES, POWER_TYPES } from '../constants/powers';
import { SKILL_UNLOCK } from '../constants/character';
import { ARENA_PATH, BATTLE_TEAM, type BattleTeamKey } from '../constants/battle';
import { EFFECT_TYPES, TARGET_TYPES, MOD_STAT } from '../constants/effectTypes';

/* ── helpers ─────────────────────────────────────────── */

function findFighter(room: BattleRoom, id: string): FighterState | undefined {
  const all = [...(room.teamA?.members || []), ...(room.teamB?.members || [])];
  return all.find(m => m.characterId === id);
}

function findFighterPath(room: BattleRoom, id: string): string | null {
  const aIdx = (room.teamA?.members || []).findIndex(m => m.characterId === id);
  if (aIdx !== -1) return `teamA/members/${aIdx}`;
  const bIdx = (room.teamB?.members || []).findIndex(m => m.characterId === id);
  if (bIdx !== -1) return `teamB/members/${bIdx}`;
  return null;
}

function findFighterTeam(room: BattleRoom, id: string): BattleTeamKey | null {
  if ((room.teamA?.members || []).some(m => m.characterId === id)) return BATTLE_TEAM.A;
  if ((room.teamB?.members || []).some(m => m.characterId === id)) return BATTLE_TEAM.B;
  return null;
}

export function makeEffectId(sourceId: string, powerName: string): string {
  return `${sourceId}_${powerName}_${Date.now()}`;
}

/* ── stat modifiers from active effects ──────────────── */

/** Sum all active buff/debuff values for a given fighter + stat */
export function getStatModifier(
  effects: ActiveEffect[],
  fighterId: string,
  stat: ModStat,
): number {
  return (effects || [])
    .filter(e => e.targetId === fighterId && e.modStat === stat)
    .reduce((sum, e) => sum + (e.effectType === EFFECT_TYPES.BUFF ? e.value : -e.value), 0);
}

/** Get total shield value on a fighter */
export function getShieldValue(effects: ActiveEffect[], fighterId: string): number {
  return (effects || [])
    .filter(e => e.targetId === fighterId && e.effectType === EFFECT_TYPES.SHIELD)
    .reduce((sum, e) => sum + e.value, 0);
}

/** Get total reflect % on a fighter */
export function getReflectPercent(effects: ActiveEffect[], fighterId: string): number {
  return (effects || [])
    .filter(e => e.targetId === fighterId && e.effectType === EFFECT_TYPES.REFLECT)
    .reduce((sum, e) => sum + e.value, 0);
}

/** Check if a fighter is stunned */
export function isStunned(effects: ActiveEffect[], fighterId: string): boolean {
  return (effects || []).some(e => e.targetId === fighterId && e.effectType === EFFECT_TYPES.STUN && e.turnsRemaining > 0);
}

/** Check if a fighter has any unlocked active (non-passive) powers they can afford */
export function getAffordablePowers(fighter: FighterState): { power: PowerDefinition; index: number }[] {
  const result: { power: PowerDefinition; index: number }[] = [];
  for (let i = 0; i < fighter.powers.length; i++) {
    const p = fighter.powers[i];
    if (p.type === POWER_TYPES.PASSIVE) continue;

    // Check unlock
    if (p.type === POWER_TYPES.ULTIMATE && fighter.ultimateSkillPoint !== SKILL_UNLOCK) continue;
    if ((p.type === POWER_TYPES.FIRST_SKILL || p.type === POWER_TYPES.SECOND_SKILL) && fighter.skillPoint !== SKILL_UNLOCK) continue;

    // Check quota
    const cost = getQuotaCost(p.type);
    if (fighter.quota < cost) continue;

    result.push({ power: p, index: i });
  }
  return result;
}

/* ── apply a single power effect ─────────────────────── */

/**
 * Apply a power's effect. Returns a partial Firebase update object
 * keyed by paths relative to `arenas/{arenaId}`.
 */
export function applyPowerEffect(
  room: BattleRoom,
  attackerId: string,
  defenderId: string,
  power: PowerDefinition,
  battle: BattleState,
): Record<string, unknown> {
  // Multi-effect powers: iterate sub-effects, merge updates
  if (power.effects && power.effects.length > 0) {
    let combined: Record<string, unknown> = {};
    let effectsCopy = [...(battle.activeEffects || [])];

    for (const sub of power.effects) {
      const subPower = {
        ...power,
        effect: sub.effect,
        target: sub.target,
        value: sub.value,
        duration: sub.duration,
        modStat: sub.modStat,
        effects: undefined, // prevent recursion
      } as PowerDefinition;
      const subUpdates = applyPowerEffect(room, attackerId, defenderId, subPower, {
        ...battle,
        activeEffects: effectsCopy,
      });
      if (subUpdates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) {
        effectsCopy = subUpdates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[];
      }
      Object.assign(combined, subUpdates);
    }
    combined[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effectsCopy;
    return combined;
  }

  const updates: Record<string, unknown> = {};
  const effects: ActiveEffect[] = [...(battle.activeEffects || [])];

  const targetId = power.target === TARGET_TYPES.SELF ? attackerId : defenderId;
  const target = findFighter(room, targetId);
  const attacker = findFighter(room, attackerId);
  if (!target || !attacker) return updates;

  const targetPath = findFighterPath(room, targetId);
  const attackerPath = findFighterPath(room, attackerId);

  // Petal-shield immunity: block debuff/stun/dot on shielded target
  if (
    (power.effect === EFFECT_TYPES.DEBUFF || power.effect === EFFECT_TYPES.STUN || power.effect === EFFECT_TYPES.DOT) &&
    power.target !== 'self' &&
    effects.some(e => e.targetId === targetId && e.tag === EFFECT_TAGS.PETAL_SHIELD)
  ) {
    return updates; // blocked by status immunity
  }

  switch (power.effect) {
    case EFFECT_TYPES.DAMAGE: {
      const newHp = Math.max(0, target.currentHp - power.value);
      if (targetPath) updates[`${targetPath}/currentHp`] = newHp;
      break;
    }

    case EFFECT_TYPES.HEAL: {
      const newHp = Math.min(target.maxHp, target.currentHp + power.value);
      if (targetPath) updates[`${targetPath}/currentHp`] = newHp;
      break;
    }

    case EFFECT_TYPES.LIFESTEAL: {
      const newTargetHp = Math.max(0, target.currentHp - power.value);
      if (targetPath) updates[`${targetPath}/currentHp`] = newTargetHp;
      const healAmount = Math.ceil(power.value * 0.5);
      const newAttackerHp = Math.min(attacker.maxHp, attacker.currentHp + healAmount);
      if (attackerPath) updates[`${attackerPath}/currentHp`] = newAttackerHp;
      break;
    }

    case EFFECT_TYPES.BUFF:
    case EFFECT_TYPES.DEBUFF: {
      // Shadow Camouflaging: no stack; new select = reset to 2 rounds (design duration).
      // UI shows Math.ceil(turnsRemaining / queueLen) as "rounds", so store 2 * queueLen to display 2.
      const isShadowCamouflaging = power.name === POWER_NAMES.SHADOW_CAMOUFLAGING || power.modStat === MOD_STAT.SHADOW_CAMOUFLAGED;
      const queueLen = battle.turnQueue?.length || 1;
      const shadowCamouflageDuration = 2 * queueLen;
      const existingShadow = isShadowCamouflaging
        ? effects.find(e => e.targetId === targetId && (e.powerName === POWER_NAMES.SHADOW_CAMOUFLAGING || e.modStat === MOD_STAT.SHADOW_CAMOUFLAGED))
        : null;
      if (existingShadow) {
        existingShadow.turnsRemaining = shadowCamouflageDuration;
      } else {
        const turnsRemaining = isShadowCamouflaging ? shadowCamouflageDuration : power.duration;
        const eff: ActiveEffect = {
          id: makeEffectId(attackerId, power.name),
          powerName: power.name,
          effectType: power.effect,
          sourceId: attackerId,
          targetId,
          value: power.value,
          turnsRemaining,
        };
        if (power.modStat) eff.modStat = power.modStat;
        effects.push(eff);
      }

      // Undead Army: create skeleton minion (max 2 total); use actual minion count so 2nd skeleton is allowed
      if (power.modStat === MOD_STAT.SKELETON_COUNT && targetPath) {
        const team = findFighterTeam(room, targetId);
        const existingMinions = team ? (room[team]?.minions || []) : [];
        const skeletonCountForMaster = existingMinions.filter((m: any) => m.masterId === targetId).length;
        // Prefer actual minion count so we allow 2nd skeleton even if stored skeletonCount was wrong
        const currentCount = skeletonCountForMaster;
        if (currentCount < 2) {
          const newCount = Math.min(2, currentCount + (power.value || 1));
          updates[`${targetPath}/skeletonCount`] = newCount;

          if (team) {
            const skeleton = createSkeletonMinion(target as any);
            updates[`${team}/minions`] = [...existingMinions, skeleton];
          }
        }
      }
      break;
    }

    case EFFECT_TYPES.SHIELD: {
      effects.push({
        id: makeEffectId(attackerId, power.name),
        powerName: power.name,
        effectType: EFFECT_TYPES.SHIELD,
        sourceId: attackerId,
        targetId,
        value: power.value,
        turnsRemaining: power.duration || 3,
      });
      break;
    }

    case EFFECT_TYPES.DOT: {
      effects.push({
        id: makeEffectId(attackerId, power.name),
        powerName: power.name,
        effectType: EFFECT_TYPES.DOT,
        sourceId: attackerId,
        targetId,
        value: power.value,
        turnsRemaining: power.duration,
      });
      break;
    }

    case EFFECT_TYPES.STUN: {
      effects.push({
        id: makeEffectId(attackerId, power.name),
        powerName: power.name,
        effectType: EFFECT_TYPES.STUN,
        sourceId: attackerId,
        targetId,
        value: 0,
        turnsRemaining: power.duration || 1,
      });
      break;
    }

    case EFFECT_TYPES.REFLECT: {
      effects.push({
        id: makeEffectId(attackerId, power.name),
        powerName: power.name,
        effectType: EFFECT_TYPES.REFLECT,
        sourceId: attackerId,
        targetId: attackerId, // reflect is always on self
        value: power.value,
        turnsRemaining: power.duration || 2,
      });
      break;
    }

    case EFFECT_TYPES.CLEANSE: {
      // Remove all debuff + dot + stun effects from self
      const cleaned = effects.filter(e =>
        !(e.targetId === attackerId && (e.effectType === EFFECT_TYPES.DEBUFF || e.effectType === EFFECT_TYPES.DOT || e.effectType === EFFECT_TYPES.STUN)),
      );
      effects.length = 0;
      effects.push(...cleaned);
      break;
    }

    case EFFECT_TYPES.REROLL_GRANT: {
      if (attackerPath) {
        updates[`${attackerPath}/rerollsLeft`] = attacker.rerollsLeft + power.value;
      }
      break;
    }
  }

  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effects;
  return updates;
}

/* ── tick effects at end of resolving phase ───────────── */

/**
 * Process DOT damage, decrement durations, remove expired.
 * Returns Firebase update paths.
 */
export function tickEffects(
  room: BattleRoom,
  battle: BattleState,
  priorUpdates?: Record<string, unknown>,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  const effects: ActiveEffect[] = [...(battle.activeEffects || [])];

  // Process DOT damage
  // Read HP from: own updates (multiple DOTs) > priorUpdates (normal attack damage) > snapshot
  for (const e of effects) {
    if (e.effectType === EFFECT_TYPES.DOT && e.turnsRemaining > 0 && e.value > 0) {
      const target = findFighter(room, e.targetId);
      if (target) {
        const path = findFighterPath(room, e.targetId);
        if (path) {
          const hpKey = `${path}/currentHp`;
          const currentHp = (hpKey in updates)
            ? updates[hpKey] as number
            : (priorUpdates && hpKey in priorUpdates)
              ? priorUpdates[hpKey] as number
              : target.currentHp;
          updates[hpKey] = Math.max(0, currentHp - e.value);
        }
      }
    }
  }


  // Spring heal: heal fighters with season-spring tag
  for (const e of effects) {
    if (e.tag === EFFECT_TAGS.SEASON_SPRING && e.turnsRemaining > 0 && e.value > 0) {
      const target = findFighter(room, e.targetId);
      if (target && target.currentHp > 0) {
        const path = findFighterPath(room, e.targetId);
        if (path) {
          const hpKey = `${path}/currentHp`;
          const currentHp = (hpKey in updates)
            ? updates[hpKey] as number
            : (priorUpdates && hpKey in priorUpdates)
              ? priorUpdates[hpKey] as number
              : target.currentHp;
          updates[hpKey] = Math.min(target.maxHp, currentHp + e.value);
        }
      }
    }
  }

  // Decrement durations, remove expired (skip turnsRemaining 999 = permanent passives)
  const remaining = effects
    .map(e => e.turnsRemaining >= 999 ? e : { ...e, turnsRemaining: e.turnsRemaining - 1 })
    .filter(e => e.turnsRemaining > 0);

  // Autumn maxHP reversal: when season-autumn effect expires, reverse maxHp and currentHp
  const expiredAutumn = effects.filter(
    e => e.tag === EFFECT_TAGS.SEASON_AUTUMN && e.turnsRemaining < 999 && e.turnsRemaining - 1 <= 0,
  );
  for (const e of expiredAutumn) {
    const target = findFighter(room, e.targetId);
    if (target) {
      const path = findFighterPath(room, e.targetId);
      if (path) {
        const maxHpKey = `${path}/maxHp`;
        const hpKey = `${path}/currentHp`;
        const currentMaxHp = (maxHpKey in updates)
          ? updates[maxHpKey] as number
          : target.maxHp;
        const currentHp = (hpKey in updates)
          ? updates[hpKey] as number
          : (priorUpdates && hpKey in priorUpdates)
            ? priorUpdates[hpKey] as number
            : target.currentHp;
        const newMaxHp = Math.max(1, currentMaxHp - e.value);
        const newHp = Math.max(1, Math.min(currentHp - e.value, newMaxHp));
        updates[maxHpKey] = newMaxHp;
        updates[hpKey] = newHp;
      }
    }
  }

  // Consume 1 stun turn (stun prevents action, then wears off)
  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = remaining;
  return updates;
}

/* ── Zeus: Lightning Reflex passive ─────────────────── */

/**
 * Apply Lightning Reflex shock on successful attack.
 * If target already has shock → bonus damage (100% of baseDamage) + remove all shocks.
 * Otherwise → apply new shock DOT (value 0, permanent).
 */
export function applyLightningReflexPassive(
  room: BattleRoom,
  attackerId: string,
  defenderId: string,
  battle: BattleState,
  baseDamage: number,
): { updates: Record<string, unknown>; bonusDamage: number } {
  const updates: Record<string, unknown> = {};
  const effects = [...(battle.activeEffects || [])];

  const attacker = findFighter(room, attackerId);
  if (!attacker || attacker.passiveSkillPoint !== SKILL_UNLOCK) return { updates, bonusDamage: 0 };

  const passive = attacker.powers.find(p => p.type === POWER_TYPES.PASSIVE && p.name === POWER_NAMES.LIGHTNING_REFLEX);
  if (!passive) return { updates, bonusDamage: 0 };

  const existingShocks = effects.filter(
    e => e.targetId === defenderId && e.tag === EFFECT_TAGS.SHOCK,
  );

  if (existingShocks.length > 0) {
    // Double-shock: bonus damage = baseDamage, remove all shocks on defender
    const cleaned = effects.filter(
      e => !(e.targetId === defenderId && e.tag === EFFECT_TAGS.SHOCK),
    );
    updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = cleaned;
    return { updates, bonusDamage: baseDamage };
  }

  // First shock: apply permanent DOT with tag
  effects.push({
    id: makeEffectId(attackerId, POWER_NAMES.LIGHTNING_REFLEX),
    powerName: POWER_NAMES.LIGHTNING_REFLEX,
    effectType: EFFECT_TYPES.DOT,
    sourceId: attackerId,
    targetId: defenderId,
    value: 0,
    turnsRemaining: 999,
    tag: EFFECT_TAGS.SHOCK,
  });
  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effects;
  return { updates, bonusDamage: 0 };
}

/* ── Zeus: Jolt Arc — AoE shock detonation ─────────── */

/**
 * Detonate all shock DOTs on all enemies. Each shock stack deals
 * attacker.damage to the target. All shocks are removed.
 */
export function applyJoltArc(
  room: BattleRoom,
  attackerId: string,
  battle: BattleState,
): { updates: Record<string, unknown>; aoeDamageMap: Record<string, number> } {
  const updates: Record<string, unknown> = {};
  const effects = [...(battle.activeEffects || [])];
  const aoeDamageMap: Record<string, number> = {};

  const attacker = findFighter(room, attackerId);
  if (!attacker) return { updates, aoeDamageMap };

  const isTeamA = (room.teamA?.members || []).some(m => m.characterId === attackerId);
  const enemies = isTeamA ? (room.teamB?.members || []) : (room.teamA?.members || []);

  for (const enemy of enemies) {
    if (enemy.currentHp <= 0) continue;

    const shockCount = effects.filter(
      e => e.targetId === enemy.characterId && e.tag === EFFECT_TAGS.SHOCK,
    ).length;

    if (shockCount > 0) {
      const dmg = shockCount * attacker.damage;
      const newHp = Math.max(0, enemy.currentHp - dmg);
      const path = findFighterPath(room, enemy.characterId);
      if (path) updates[`${path}/currentHp`] = newHp;
      aoeDamageMap[enemy.characterId] = dmg;
    }
  }

  // Remove ALL shock DOTs
  const cleaned = effects.filter(e => e.tag !== EFFECT_TAGS.SHOCK);
  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = cleaned;
  return { updates, aoeDamageMap };
}

/* ── Zeus: Thunderbolt — chain AoE ─────────────────── */

/**
 * Apply Thunderbolt chain: -1 damage to all enemies EXCEPT primary target.
 */
export function applyThunderboltChain(
  room: BattleRoom,
  attackerId: string,
  defenderId: string,
  battle: BattleState,
): { updates: Record<string, unknown>; aoeDamageMap: Record<string, number> } {
  const updates: Record<string, unknown> = {};
  const aoeDamageMap: Record<string, number> = {};

  const isTeamA = (room.teamA?.members || []).some(m => m.characterId === attackerId);
  const enemies = isTeamA ? (room.teamB?.members || []) : (room.teamA?.members || []);

  for (const enemy of enemies) {
    if (enemy.characterId === defenderId) continue;
    if (enemy.currentHp <= 0) continue;

    const newHp = Math.max(0, enemy.currentHp - 1);
    const path = findFighterPath(room, enemy.characterId);
    if (path) updates[`${path}/currentHp`] = newHp;
    aoeDamageMap[enemy.characterId] = 1;
  }

  return { updates, aoeDamageMap };
}

/* ── Persephone: Secret of Dryad passive ─────────────── */

/**
 * When Persephone is attacker and atkTotal > 10, grant petal-shield
 * (status immunity: blocks debuff/stun/dot) lasting one full round.
 */
export function applySecretOfDryadPassive(
  room: BattleRoom,
  attackerId: string,
  battle: BattleState,
  atkTotal: number,
): Record<string, unknown> {
  if (atkTotal <= 10) return {};

  const attacker = findFighter(room, attackerId);
  if (!attacker || attacker.passiveSkillPoint !== SKILL_UNLOCK) return {};

  const passive = attacker.powers.find(
    p => p.type === POWER_TYPES.PASSIVE && p.name === POWER_NAMES.SECRET_OF_DRYAD,
  );
  if (!passive) return {};

  // Already has petal-shield? Skip (don't stack)
  const effects = [...(battle.activeEffects || [])];
  if (effects.some(e => e.targetId === attackerId && e.tag === EFFECT_TAGS.PETAL_SHIELD)) return {};

  // Duration = turnQueue.length + 1 (offset: tickEffects decrements 1 in same resolve)
  const queueLen = battle.turnQueue?.length || 1;
  effects.push({
    id: makeEffectId(attackerId, POWER_NAMES.SECRET_OF_DRYAD),
    powerName: POWER_NAMES.SECRET_OF_DRYAD,
    effectType: EFFECT_TYPES.SHIELD,
    sourceId: attackerId,
    targetId: attackerId,
    value: 0,
    turnsRemaining: queueLen + 1,
    tag: EFFECT_TAGS.PETAL_SHIELD,
  });

  return { [ARENA_PATH.BATTLE_ACTIVE_EFFECTS]: effects };
}

/* ── Persephone: Floral Scented (1st Skill) ──────────── */

/**
 * Anoint an ally with flower scent: heal +value HP (capped at maxHp), then normal attack follows.
 */
export function applyFloralScented(
  room: BattleRoom,
  _attackerId: string,
  allyTargetId: string,
  _battle: BattleState,
  power: PowerDefinition,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  const ally = findFighter(room, allyTargetId);
  const allyPath = findFighterPath(room, allyTargetId);
  if (!ally || !allyPath) return {};

  const newCurrentHp = Math.min(ally.currentHp + power.value, ally.maxHp);
  updates[`${allyPath}/currentHp`] = newCurrentHp;
  return updates;
}

/* ── Persephone: Ephemeral Season — apply season effects to team ── */

/**
 * Apply season-based effects to all alive teammates of the attacker.
 * Returns Firebase update paths relative to `arenas/{arenaId}`.
 *
 * Summer  → +2 attack dice (buff)
 * Autumn  → +2 maxHp AND +2 currentHp (immediate + tracking effect)
 * Winter  → +2 defense dice (buff)
 * Spring  → heal-over-time tag (1 HP per tick in tickEffects)
 */
export function applySeasonEffects(
  room: BattleRoom,
  attackerId: string,
  season: string,
  battle: BattleState,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  let effects: ActiveEffect[] = [...(battle.activeEffects || [])];

  // Identify attacker's team
  const isTeamA = (room.teamA?.members || []).some(m => m.characterId === attackerId);
  const teammates = isTeamA ? (room.teamA?.members || []) : (room.teamB?.members || []);

  // ── Remove existing season effects before applying new ones ──
  // Reverse autumn maxHp/currentHp changes first
  const oldAutumn = effects.filter(e => e.tag === EFFECT_TAGS.SEASON_AUTUMN);
  for (const e of oldAutumn) {
    const target = findFighter(room, e.targetId);
    if (target) {
      const path = findFighterPath(room, e.targetId);
      if (path) {
        const curMax = (updates[`${path}/maxHp`] as number | undefined) ?? target.maxHp;
        const curHp = (updates[`${path}/currentHp`] as number | undefined) ?? target.currentHp;
        updates[`${path}/maxHp`] = Math.max(1, curMax - e.value);
        updates[`${path}/currentHp`] = Math.max(1, Math.min(curHp - e.value, curMax - e.value));
      }
    }
  }
  // Strip all season effects
  effects = effects.filter(e => !e.tag?.startsWith('season-'));

  // Duration: 2 full rounds (every fighter gets 2 action cycles)
  const queueLen = battle.turnQueue?.length || 1;
  const duration = queueLen * 2 + 1; // *2 for 2 rounds, +1 compensates for tick in confirmSeason

  for (const fighter of teammates) {
    if (fighter.currentHp <= 0) continue;

    const fighterId = fighter.characterId;

    switch (season) {
      case 'summer': {
        effects.push({
          id: makeEffectId(attackerId, 'Ephemeral Season'),
          powerName: POWER_NAMES.EPHEMERAL_SEASON,
          effectType: EFFECT_TYPES.BUFF,
          sourceId: attackerId,
          targetId: fighterId,
          value: 2,
          modStat: 'attackDiceUp',
          turnsRemaining: duration,
          tag: 'season-summer',
        });
        break;
      }

      case 'autumn': {
        // Increase maxHp and currentHp immediately (read from updates in case old autumn was just reversed)
        const path = findFighterPath(room, fighterId);
        if (path) {
          const baseMax = (updates[`${path}/maxHp`] as number | undefined) ?? fighter.maxHp;
          const baseHp = (updates[`${path}/currentHp`] as number | undefined) ?? fighter.currentHp;
          updates[`${path}/maxHp`] = baseMax + 2;
          updates[`${path}/currentHp`] = baseHp + 2;
        }
        // Tracking effect for reversal on expiry
        effects.push({
          id: makeEffectId(attackerId, 'Ephemeral Season'),
          powerName: POWER_NAMES.EPHEMERAL_SEASON,
          effectType: EFFECT_TYPES.BUFF,
          sourceId: attackerId,
          targetId: fighterId,
          value: 2,
          modStat: 'maxHp',
          turnsRemaining: duration,
          tag: 'season-autumn',
        });
        break;
      }

      case 'winter': {
        effects.push({
          id: makeEffectId(attackerId, 'Ephemeral Season'),
          powerName: POWER_NAMES.EPHEMERAL_SEASON,
          effectType: EFFECT_TYPES.BUFF,
          sourceId: attackerId,
          targetId: fighterId,
          value: 2,
          modStat: 'defendDiceUp',
          turnsRemaining: duration,
          tag: 'season-winter',
        });
        break;
      }

      case 'spring': {
        effects.push({
          id: makeEffectId(attackerId, 'Ephemeral Season'),
          powerName: POWER_NAMES.EPHEMERAL_SEASON,
          effectType: EFFECT_TYPES.BUFF,
          sourceId: attackerId,
          targetId: fighterId,
          value: 1,
          turnsRemaining: duration,
          tag: 'season-spring',
        });
        break;
      }
    }
  }

  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effects;
  return updates;
}

/* ── Persephone: Pomegranate's Oath (Ultimate) ────────── */

/**
 * Grant "pomegranate-spirit" effect to an ally (or self if no allies alive).
 * Removes any existing pomegranate-spirit effects first (only one active).
 * Returns Firebase update paths relative to `arenas/{arenaId}`.
 */
export function applyPomegranateOath(
  room: BattleRoom,
  attackerId: string,
  allyTargetId: string,
  battle: BattleState,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  let effects: ActiveEffect[] = [...(battle.activeEffects || [])];

  // Remove any existing pomegranate-spirit effects (only one oath active at a time)
  effects = effects.filter(e => e.tag !== 'pomegranate-spirit');

  // Duration: 3 full rounds (each fighter acts once per round)
  // tickEffects decrements once per turn, so 3 rounds = 3 * queueLen ticks
  const queueLen = battle.turnQueue?.length || 1;
  const duration = queueLen * 3;

  effects.push({
    id: makeEffectId(attackerId, POWER_NAMES.POMEGRANATES_OATH),
    powerName: POWER_NAMES.POMEGRANATES_OATH,
    effectType: EFFECT_TYPES.BUFF,
    sourceId: attackerId,
    targetId: allyTargetId,
    value: 0,
    turnsRemaining: duration,
    tag: 'pomegranate-spirit',
  });

  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effects;
  return updates;
}

/* ── apply passives at battle start ──────────────────── */

/**
 * Collect passive effects for all fighters who have passive unlocked.
 * Returns the initial activeEffects array.
 */
export function buildPassiveEffects(room: BattleRoom): ActiveEffect[] {
  const effects: ActiveEffect[] = [];
  const allMembers = [...(room.teamA?.members || []), ...(room.teamB?.members || [])];

  for (const fighter of allMembers) {
    if (fighter.passiveSkillPoint !== SKILL_UNLOCK) continue;
    if (!fighter.powers || fighter.powers.length === 0) continue;
    const passive = fighter.powers.find(p => p.type === POWER_TYPES.PASSIVE);
    if (!passive) continue;

    // Death Keeper: one-time resurrection passive
    if (passive.name === POWER_NAMES.DEATH_KEEPER) {
      effects.push({
        id: makeEffectId(fighter.characterId, POWER_NAMES.DEATH_KEEPER),
        powerName: POWER_NAMES.DEATH_KEEPER,
        effectType: EFFECT_TYPES.BUFF,
        sourceId: fighter.characterId,
        targetId: fighter.characterId,
        value: 0,
        turnsRemaining: 999,
        tag: EFFECT_TAGS.DEATH_KEEPER,
      });
      continue;
    }

    // Only buff/debuff passives make sense as permanent effects
    if (passive.effect === EFFECT_TYPES.BUFF || passive.effect === EFFECT_TYPES.DEBUFF) {
      const eff: ActiveEffect = {
        id: makeEffectId(fighter.characterId, passive.name),
        powerName: passive.name,
        effectType: passive.effect,
        sourceId: fighter.characterId,
        targetId: fighter.characterId, // passive always targets self
        value: passive.value,
        turnsRemaining: 999,
      };
      if (passive.modStat) eff.modStat = passive.modStat;
      effects.push(eff);
    }
  }

  return effects;
}
