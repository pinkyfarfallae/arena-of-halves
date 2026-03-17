import type { BattleRoom, BattleState, FighterState } from '../types/battle';
import { createSkeletonMinion } from '../data/minions';
import type { ActiveEffect, PowerDefinition, ModStat } from '../types/power';
import { getQuotaCost } from '../types/power';
import { EFFECT_TAGS, isSeasonTag } from '../constants/effectTags';
import { POWER_NAMES, POWER_TYPES } from '../constants/powers';
import { SKILL_UNLOCK } from '../constants/character';
import { ARENA_PATH, BATTLE_TEAM, type BattleTeamKey } from '../constants/battle';
import { EFFECT_TYPES, TARGET_TYPES, MOD_STAT } from '../constants/effectTypes';
import { SEASON_KEYS } from '../data/seasons';
import { isAffliction } from '../data/statusCategory';

/* ── helpers ─────────────────────────────────────────── */

function targetHasEfflorescenceMuse(effects: ActiveEffect[], targetId: string): boolean {
  return effects.some(e => e.targetId === targetId && e.tag === EFFECT_TAGS.EFFLORESCENCE_MUSE);
}

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

const SUNBORN_SOVEREIGN_RECOVERY_MAX = 2;

/** True if the receiver has Healing Nullified (Imprecated Poem) — heals do nothing. */
export function isHealingNullified(activeEffects: ActiveEffect[], receiverId: string): boolean {
  return activeEffects.some(e => e.targetId === receiverId && e.tag === EFFECT_TAGS.HEALING_NULLIFIED);
}

/** Effective heal amount for a receiver (e.g. +1 when receiver has a passive that boosts received healing). HEALING_NULLIFIED → 0. */
export function getEffectiveHealForReceiver(
  baseHeal: number,
  receiver: { powers?: { name: string }[] } | null | undefined,
  receiverId?: string,
  activeEffects?: ActiveEffect[],
): number {
  if (receiverId && activeEffects && isHealingNullified(activeEffects, receiverId)) return 0;
  var amount = baseHeal;
  if (receiver?.powers?.some(p => p.name === POWER_NAMES.SUNBORN_SOVEREIGN)) amount += 1;
  return amount;
}

/** Add or increment Sunborn Sovereign recovery stack. Only affects Apollo (fighter must have the passive). */
export function addSunbornSovereignRecoveryStack(
  room: BattleRoom,
  effects: ActiveEffect[],
  fighterId: string,
): void {
  const fighter = findFighter(room, fighterId);
  if (!fighter || !fighter.powers?.some(p => p.name === POWER_NAMES.SUNBORN_SOVEREIGN)) return;
  const existing = effects.find(
    e => e.targetId === fighterId && e.powerName === POWER_NAMES.SUNBORN_SOVEREIGN && e.modStat === MOD_STAT.RECOVERY_DICE_UP,
  );
  if (existing) {
    existing.value = Math.min(SUNBORN_SOVEREIGN_RECOVERY_MAX, existing.value + 1);
  } else {
    effects.push({
      id: makeEffectId(fighterId, POWER_NAMES.SUNBORN_SOVEREIGN),
      powerName: POWER_NAMES.SUNBORN_SOVEREIGN,
      effectType: EFFECT_TYPES.BUFF,
      sourceId: fighterId,
      targetId: fighterId,
      value: 1,
      turnsRemaining: 999,
      modStat: MOD_STAT.RECOVERY_DICE_UP,
    });
  }
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

  // Efflorescence Muse immunity: block debuff/stun/dot on shielded target; when negated, consume Efflorescence Muse
  if (
    (power.effect === EFFECT_TYPES.DEBUFF || power.effect === EFFECT_TYPES.STUN || power.effect === EFFECT_TYPES.DOT) &&
    power.target !== 'self' &&
    effects.some(e => e.targetId === targetId && e.tag === EFFECT_TAGS.EFFLORESCENCE_MUSE)
  ) {
    const withoutEfflorescenceMuse = effects.filter(
      e => !(e.targetId === targetId && e.tag === EFFECT_TAGS.EFFLORESCENCE_MUSE),
    );
    updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = withoutEfflorescenceMuse;
    return updates; // blocked; Efflorescence Muse consumed
  }

  switch (power.effect) {
    case EFFECT_TYPES.DAMAGE: {
      const newHp = Math.max(0, target.currentHp - power.value);
      if (targetPath) updates[`${targetPath}/currentHp`] = newHp;
      break;
    }

    case EFFECT_TYPES.HEAL: {
      let healValue = power.value;
      const casterHasEfflorescenceMuse = effects.some(
        e => e.targetId === attackerId && e.tag === EFFECT_TAGS.EFFLORESCENCE_MUSE,
      );
      if (casterHasEfflorescenceMuse) {
        const healCritRoll = Math.ceil(Math.random() * 4); // d4
        if (healCritRoll === 4) healValue *= 2; // critical heal: HP doubled
      }
      healValue = getEffectiveHealForReceiver(healValue, target, targetId, effects);
      const newHp = Math.min(target.maxHp, target.currentHp + healValue);
      if (targetPath) updates[`${targetPath}/currentHp`] = newHp;
      // Recovery stack only for fighters who have the passive (Apollo only)
      addSunbornSovereignRecoveryStack(room, effects, attackerId);
      if (targetId !== attackerId) addSunbornSovereignRecoveryStack(room, effects, targetId);
      updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effects;
      break;
    }

    case EFFECT_TYPES.LIFESTEAL: {
      const newTargetHp = Math.max(0, target.currentHp - power.value);
      if (targetPath) updates[`${targetPath}/currentHp`] = newTargetHp;
      const healAmount = getEffectiveHealForReceiver(Math.ceil(power.value * 0.5), attacker, attackerId, effects);
      const newAttackerHp = Math.min(attacker.maxHp, attacker.currentHp + healAmount);
      if (attackerPath) updates[`${attackerPath}/currentHp`] = newAttackerHp;
      addSunbornSovereignRecoveryStack(room, effects, attackerId);
      updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effects;
      break;
    }

    case EFFECT_TYPES.BUFF:
    case EFFECT_TYPES.DEBUFF: {
      // Shadow Camouflaging / Beyond the Nimbus: no stack; new select = reset to 2 rounds.
      // UI shows Math.ceil(turnsRemaining / queueLen) as "rounds", so store 2 * queueLen to display 2.
      const isShadowCamouflaging = power.name === POWER_NAMES.SHADOW_CAMOUFLAGING || power.modStat === MOD_STAT.SHADOW_CAMOUFLAGED;
      const isBeyondTheNimbus = power.name === POWER_NAMES.BEYOND_THE_NIMBUS;
      const queueLen = battle.turnQueue?.length || 1;
      const shadowCamouflageDuration = 2 * queueLen;
      const beyondTheNimbusDuration = 2 * queueLen;
      const existingShadow = isShadowCamouflaging
        ? effects.find(e => e.targetId === targetId && (e.powerName === POWER_NAMES.SHADOW_CAMOUFLAGING || e.modStat === MOD_STAT.SHADOW_CAMOUFLAGED))
        : null;
      const existingNimbus = isBeyondTheNimbus
        ? effects.find(e => e.targetId === targetId && e.powerName === POWER_NAMES.BEYOND_THE_NIMBUS && e.modStat === power.modStat)
        : null;
      if (existingShadow) {
        existingShadow.turnsRemaining = shadowCamouflageDuration;
      } else if (existingNimbus) {
        existingNimbus.turnsRemaining = beyondTheNimbusDuration;
        existingNimbus.value = power.value;
      } else {
        const turnsRemaining = isShadowCamouflaging
          ? shadowCamouflageDuration
          : isBeyondTheNimbus
            ? beyondTheNimbusDuration
            : power.duration;
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
        if (isBeyondTheNimbus) eff.tag = EFFECT_TAGS.BEYOND_THE_NIMBUS;
        // Apollo's Hymn: +crit buff counts as blessing (สถานะเกื้อกูล)
        if (power.name === POWER_NAMES.APOLLO_S_HYMN && power.modStat === MOD_STAT.CRITICAL_RATE) eff.tag = EFFECT_TAGS.APOLLO_S_HYMN;
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
      if (!targetHasEfflorescenceMuse(effects, targetId)) {
        effects.push({
          id: makeEffectId(attackerId, power.name),
          powerName: power.name,
          effectType: EFFECT_TYPES.STUN,
          sourceId: attackerId,
          targetId,
          value: 0,
          turnsRemaining: power.duration || 1,
          tag: EFFECT_TAGS.STUN,
        });
      }
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

  // Process DOT damage: do NOT apply HP here — caller must apply via resolveHitAtDefender
  // so Hades child's skeleton can block. Return list for caller to resolve per target.
  const dotDamages: Array<{ targetId: string; value: number }> = [];
  for (const e of effects) {
    if (e.effectType === EFFECT_TYPES.DOT && e.turnsRemaining > 0 && e.value > 0) {
      const target = findFighter(room, e.targetId);
      if (target) {
        dotDamages.push({ targetId: e.targetId, value: e.value });
      }
    }
  }
  if (dotDamages.length > 0) {
    (updates as Record<string, unknown> & { __dotDamages?: Array<{ targetId: string; value: number }> }).__dotDamages = dotDamages;
  }


  // (Spring heal is applied in resolveTurn after each ally's attack via springHeal1/springHeal2)

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

/* ── Zeus: central shock application (shared by Lightning Spark, Nimbus, Keraunos) ── */

export type ApplyShockedEffectOptions = {
  /** If true, do not apply shock to targets with Efflorescence Muse (default true). */
  skipIfEfflorescenceMuse?: boolean;
  /** If set, use this as target's current HP for bonus-damage calculation (e.g. after other damage this turn). */
  currentHp?: number;
};

/**
 * Central logic for applying shock to a single target. Used by Lightning Spark, Beyond the Nimbus, and Keraunos Voltage.
 * - If target already has shock: deal bonus damage = baseDamage (100% of attacker's normal attack), then remove all shocks on that target.
 * - If target does not have shock: apply shock effect.
 * Returns updated effects array, bonus damage for this target, and optional HP update path/value.
 */
export function applyShockedEffectToTarget(
  room: BattleRoom,
  attackerId: string,
  targetId: string,
  effects: ActiveEffect[],
  baseDamage: number,
  powerName: string,
  options: ApplyShockedEffectOptions = {},
): {
  effects: ActiveEffect[];
  bonusDamage: number;
  hpUpdate: { path: string; value: number } | null;
} {
  const { skipIfEfflorescenceMuse = true, currentHp: currentHpOverride } = options;
  const nextEffects = [...effects];

  if (skipIfEfflorescenceMuse && targetHasEfflorescenceMuse(nextEffects, targetId)) {
    // Prevent new affliction (shock); do not consume Efflorescence Muse
    return { effects: nextEffects, bonusDamage: 0, hpUpdate: null };
  }

  const hasShock = nextEffects.some(
    (e) => e.targetId === targetId && e.tag === EFFECT_TAGS.SHOCK,
  );

  if (hasShock) {
    // Already shocked: deal 100% bonus damage, then remove all shocks on this target.
    const cleaned = nextEffects.filter(
      (e) => !(e.targetId === targetId && e.tag === EFFECT_TAGS.SHOCK),
    );
    const currentHp = currentHpOverride ?? findFighter(room, targetId)?.currentHp ?? 0;
    const newHp = Math.max(0, currentHp - baseDamage);
    const memberPath = findFighterPath(room, targetId);
    const hpPath = memberPath ? `${memberPath}/currentHp` : null;
    return {
      effects: cleaned,
      bonusDamage: baseDamage,
      hpUpdate: hpPath ? { path: hpPath, value: newHp } : null,
    };
  }

  nextEffects.push({
    id: makeEffectId(attackerId, powerName),
    powerName,
    effectType: EFFECT_TYPES.DOT,
    sourceId: attackerId,
    targetId,
    value: 0,
    turnsRemaining: 999,
    tag: EFFECT_TAGS.SHOCK,
  });
  return { effects: nextEffects, bonusDamage: 0, hpUpdate: null };
}

/* ── Zeus: Lightning Reflex passive ─────────────────── */

/**
 * Apply Lightning Reflex shock on successful attack.
 * Uses central applyShockedEffectToTarget: already shocked → 100% bonus damage + remove all shocks; else apply shock.
 */
export function applyLightningReflexPassive(
  room: BattleRoom,
  attackerId: string,
  defenderId: string,
  battle: BattleState,
  baseDamage: number,
): { updates: Record<string, unknown>; bonusDamage: number } {
  const updates: Record<string, unknown> = {};
  const attacker = findFighter(room, attackerId);
  if (!attacker || attacker.passiveSkillPoint !== SKILL_UNLOCK) return { updates, bonusDamage: 0 };

  const passive = attacker.powers.find(p => p.type === POWER_TYPES.PASSIVE && p.name === POWER_NAMES.LIGHTNING_SPARK);
  if (!passive) return { updates, bonusDamage: 0 };

  const effects = [...(battle.activeEffects || [])];
  const result = applyShockedEffectToTarget(
    room,
    attackerId,
    defenderId,
    effects,
    baseDamage,
    POWER_NAMES.LIGHTNING_SPARK,
    { skipIfEfflorescenceMuse: true },
  );
  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = result.effects;
  if (result.hpUpdate) updates[result.hpUpdate.path] = result.hpUpdate.value;
  return { updates, bonusDamage: result.bonusDamage };
}

/**
 * Apply shock to all enemy team members (Beyond the Nimbus). Uses central applyShockedEffectToTarget:
 * already shocked → 100% base damage + remove all shocks; else apply shock.
 */
export function applyBeyondTheNimbusTeamShock(
  room: BattleRoom,
  attackerId: string,
  battle: BattleState,
  baseDamage: number,
  /** If set, do not apply shock to this character (e.g. attack target just cleansed by Lightning Reflex). */
  excludeTargetId?: string,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  const attackerTeam = findFighterTeam(room, attackerId);
  if (!attackerTeam) return updates;

  const enemies = attackerTeam === BATTLE_TEAM.A
    ? (room.teamB?.members || [])
    : (room.teamA?.members || []);

  let effects = [...(battle.activeEffects || [])];
  for (const enemy of enemies) {
    if (enemy.currentHp <= 0) continue;
    if (excludeTargetId && enemy.characterId === excludeTargetId) continue;

    const result = applyShockedEffectToTarget(
      room,
      attackerId,
      enemy.characterId,
      effects,
      baseDamage,
      POWER_NAMES.BEYOND_THE_NIMBUS,
      { skipIfEfflorescenceMuse: true },
    );
    effects = result.effects;
    if (result.hpUpdate) updates[result.hpUpdate.path] = result.hpUpdate.value;
  }
  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effects;
  return updates;
}

/* ── Zeus: Jolt Arc — AoE shock detonation ─────────── */

/**
 * All shocked enemies explode, dealing instant damage (attacker.damage per shock stack).
 * All shocks on hit targets are removed. All enemies hit receive -7 speed for 2 rounds.
 * Does NOT apply HP damage here — caller must apply damage per target via resolveHitAtDefender
 * so that a Hades child's skeleton can block the damage (skeleton takes it, master does not).
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
      aoeDamageMap[enemy.characterId] = dmg;
    }
  }

  // Remove ALL shock DOTs
  let cleaned = effects.filter(e => e.tag !== EFFECT_TAGS.SHOCK);

  // Apply -7 speed for 2 rounds to all enemies hit (skip if target has Efflorescence Muse)
  const queueLen = battle.turnQueue?.length || 1;
  const speedDebuffDuration = queueLen * 2;
  for (const targetId of Object.keys(aoeDamageMap)) {
    if (targetHasEfflorescenceMuse(cleaned, targetId)) continue;
    cleaned.push({
      id: makeEffectId(attackerId, POWER_NAMES.JOLT_ARC),
      powerName: POWER_NAMES.JOLT_ARC,
      effectType: EFFECT_TYPES.DEBUFF,
      sourceId: attackerId,
      targetId,
      value: 7,
      modStat: MOD_STAT.SPEED,
      turnsRemaining: speedDebuffDuration,
      tag: EFFECT_TAGS.JOLT_ARC_DECELERATION,
    });
  }

  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = cleaned;
  return { updates, aoeDamageMap };
}

/* ── Zeus: Keraunos Voltage — chain AoE (legacy) ─────────────────── */

/**
 * Apply Keraunos Voltage chain: -1 damage to all enemies EXCEPT primary target.
 * (Legacy: Keraunos now uses chosen targets + crit D4; kept for reference.)
 */
export function applyKeraunosVoltageChain(
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

/**
 * Apply shock to everyone alive on the opponent team for Keraunos Voltage.
 * Uses central applyShockedEffectToTarget: already shocked → 100% base damage + remove all shocks; else apply shock.
 * baseDamageByTarget: main = 3, secondaries = 2, everyone else = 0 (so only bolt targets get bonus damage when already shocked).
 * currentHpByTarget: optional map of targetId -> current HP after damage (for bonus damage HP).
 * excludeTargetIds: targets that had skeleton block (hit landed on skeleton, not master) — do not apply shock or bonus damage to them.
 */
export function applyKeraunosVoltageShock(
  room: BattleRoom,
  attackerId: string,
  defenderId: string,
  battle: BattleState,
  baseDamage: number,
  currentHpByTarget?: Record<string, number>,
  baseDamageByTarget?: Record<string, number>,
  excludeTargetIds?: string[],
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  const excludeSet = new Set(excludeTargetIds ?? []);
  const isTeamA = (room.teamA?.members || []).some(m => m.characterId === attackerId);
  const enemies = isTeamA ? (room.teamB?.members || []) : (room.teamA?.members || []);
  const targets = baseDamageByTarget && Object.keys(baseDamageByTarget).length > 0
    ? Object.keys(baseDamageByTarget)
    : enemies.filter(e => e.currentHp > 0).map(e => e.characterId);
  if (targets.length === 0) return updates;

  let effects = [...(battle.activeEffects || [])];
  for (const targetId of targets) {
    if (excludeSet.has(targetId)) continue; // skeleton took the hit — no affliction on master
    const currentHp = currentHpByTarget?.[targetId];
    if (currentHp !== undefined && currentHp <= 0) continue; // KO'd by bolt — do not apply shock or overwrite HP
    const baseDmg = baseDamageByTarget?.[targetId] ?? baseDamage;
    const result = applyShockedEffectToTarget(
      room,
      attackerId,
      targetId,
      effects,
      baseDmg,
      POWER_NAMES.KERAUNOS_VOLTAGE,
      { skipIfEfflorescenceMuse: true, ...(currentHp !== undefined && { currentHp }) },
    );
    effects = result.effects;
    if (result.hpUpdate) updates[result.hpUpdate.path] = result.hpUpdate.value;
  }
  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effects;
  return updates;
}

/* ── Persephone: Efflorescence Muse passive ────────────────── */

/**
 * When advancing to a fighter's turn (before select action): grant Efflorescence Muse (status immunity + 25% crit)
 * only if Secret of Dryad is unlocked and the fighter has Secret of Dryad in their powers list.
 * Lasts one full round. Does not stack; re-applied on turn start when still active (see onEfflorescenceMuseTurnStart).
 */
export function applySecretOfDryadPassive(
  room: BattleRoom,
  attackerId: string,
  battle: BattleState,
  _atkTotal: number,
): Record<string, unknown> {
  const attacker = findFighter(room, attackerId);
  if (!attacker) return {};

  // Do not apply unless passive skill is unlocked
  if (attacker.passiveSkillPoint !== SKILL_UNLOCK) return {};

  // Only if fighter has Secret of Dryad in their powers list
  const passive = attacker.powers.find(
    p => p.type === POWER_TYPES.PASSIVE && p.name === POWER_NAMES.SECRET_OF_DRYAD,
  );
  if (!passive) return {};

  // Already has Efflorescence Muse? Skip (don't stack)
  const effects = [...(battle.activeEffects || [])];
  if (effects.some(e => e.targetId === attackerId && e.tag === EFFECT_TAGS.EFFLORESCENCE_MUSE)) return {};

  // 1 round: duration = one full turn cycle (tickEffects decrements once per resolve)
  const queueLen = battle.turnQueue?.length || 1;
  const duration = queueLen;
  effects.push({
    id: makeEffectId(attackerId, POWER_NAMES.SECRET_OF_DRYAD),
    powerName: POWER_NAMES.SECRET_OF_DRYAD,
    effectType: EFFECT_TYPES.SHIELD,
    sourceId: attackerId,
    targetId: attackerId,
    value: 0,
    turnsRemaining: duration,
    tag: EFFECT_TAGS.EFFLORESCENCE_MUSE,
  });
  // +25% critical hit chance while in Efflorescence Muse (same duration; removed when Efflorescence Muse is consumed)
  effects.push({
    id: makeEffectId(attackerId, `${POWER_NAMES.SECRET_OF_DRYAD}_crit`),
    powerName: POWER_NAMES.SECRET_OF_DRYAD,
    effectType: EFFECT_TYPES.BUFF,
    sourceId: attackerId,
    targetId: attackerId,
    value: 25,
    turnsRemaining: duration,
    tag: EFFECT_TAGS.EFFLORESCENCE_MUSE,
    modStat: MOD_STAT.CRITICAL_RATE,
  });

  return { [ARENA_PATH.BATTLE_ACTIVE_EFFECTS]: effects };
}

/**
 * When it's the fighter's turn again while still in Efflorescence Muse: refresh duration only.
 * Does not remove afflictions; Efflorescence Muse prevents new afflictions from being applied instead.
 */
export function onEfflorescenceMuseTurnStart(
  room: BattleRoom,
  battle: BattleState,
  nextAttackerId: string,
): Record<string, unknown> | null {
  const effects = [...(battle.activeEffects || [])];
  const hasEfflorescenceMuse = effects.some(
    e => e.targetId === nextAttackerId && e.tag === EFFECT_TAGS.EFFLORESCENCE_MUSE,
  );
  if (!hasEfflorescenceMuse) return null;

  const queueLen = battle.turnQueue?.length || 1;
  const duration = queueLen;

  const next = effects.map(e => {
    if (e.targetId === nextAttackerId && e.tag === EFFECT_TAGS.EFFLORESCENCE_MUSE) {
      return { ...e, turnsRemaining: duration };
    }
    return e;
  });

  return { [ARENA_PATH.BATTLE_ACTIVE_EFFECTS]: next };
}

/* ── Persephone: Floral Fragrance (1st Skill) ──────────── */

/**
 * Heal the target by ceil(0.2 * caster's Max HP), capped at target's maxHp. Then normal attack follows.
 */
/**
 * Apollo's Hymn: heal self and selected ally 2 HP each, grant +25% crit to both for 2 rounds (no stack), then end turn.
 */
export function applyApolloHymn(
  room: BattleRoom,
  attackerId: string,
  allyTargetId: string,
  battle: BattleState,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  const attacker = findFighter(room, attackerId);
  const ally = findFighter(room, allyTargetId);
  if (!attacker || !ally) return updates;

  const effects: ActiveEffect[] = [...(battle.activeEffects || [])];
  const queueLen = battle.turnQueue?.length || 1;
  const hymnDuration = 2 * queueLen; // 2 rounds
  const HEAL_AMOUNT = 2;
  const CRIT_VALUE = 25;

  // Heal self
  const selfPath = findFighterPath(room, attackerId);
  const selfHeal = getEffectiveHealForReceiver(HEAL_AMOUNT, attacker, attackerId, effects);
  if (selfPath) {
    const selfHp = (updates[`${selfPath}/currentHp`] as number | undefined) ?? attacker.currentHp;
    updates[`${selfPath}/currentHp`] = Math.min(attacker.maxHp, selfHp + selfHeal);
  }
  addSunbornSovereignRecoveryStack(room, effects, attackerId);

  // Heal ally (if different from self)
  if (allyTargetId !== attackerId) {
    const allyPath = findFighterPath(room, allyTargetId);
    const allyHeal = getEffectiveHealForReceiver(HEAL_AMOUNT, ally, allyTargetId, effects);
    if (allyPath) {
      const allyHp = (updates[`${allyPath}/currentHp`] as number | undefined) ?? ally.currentHp;
      updates[`${allyPath}/currentHp`] = Math.min(ally.maxHp, allyHp + allyHeal);
    }
    addSunbornSovereignRecoveryStack(room, effects, allyTargetId);
  }

  // Add or refresh +25% crit buff (no stack) on self and ally
  const critTargets = Array.from(new Set([attackerId, allyTargetId]));
  for (const targetId of critTargets) {
    const existing = effects.find(
      e => e.targetId === targetId && e.tag === EFFECT_TAGS.APOLLO_S_HYMN && e.modStat === MOD_STAT.CRITICAL_RATE,
    );
    if (existing) {
      existing.turnsRemaining = hymnDuration;
    } else {
      effects.push({
        id: makeEffectId(attackerId, POWER_NAMES.APOLLO_S_HYMN),
        powerName: POWER_NAMES.APOLLO_S_HYMN,
        effectType: EFFECT_TYPES.BUFF,
        sourceId: attackerId,
        targetId,
        value: CRIT_VALUE,
        turnsRemaining: hymnDuration,
        modStat: MOD_STAT.CRITICAL_RATE,
        tag: EFFECT_TAGS.APOLLO_S_HYMN,
      });
    }
  }

  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effects;
  return updates;
}

/** Imprecated Poem verse tags. */
const POEM_VERSE = {
  HEALING_NULLIFIED: EFFECT_TAGS.HEALING_NULLIFIED,
  DISORIENTED: EFFECT_TAGS.DISORIENTED,
  ETERNAL_AGONY: EFFECT_TAGS.ETERNAL_AGONY,
} as const;

/**
 * Imprecated Poem: apply chosen verse to enemy for 2 rounds, or ETERNAL_AGONY extends all afflictions by 2 then ends.
 * Efflorescence Muse: all Imprecated Poem verses are afflictions (see data/afflictions.ts), so Muse can deny and is consumed.
 * Returns Firebase update paths relative to arenas/{arenaId}.
 */
export function applyImprecatedPoem(
  room: BattleRoom,
  attackerId: string,
  defenderId: string,
  poemTag: string,
  battle: BattleState,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  const effects: ActiveEffect[] = [...(battle.activeEffects || [])];
  const queueLen = battle.turnQueue?.length || 1;
  const duration = 2 * queueLen; // 2 rounds

  // Efflorescence Muse: block afflictions (all Imprecated Poem verses are in AFFLICTIONS_TAGS); consume Muse
  if (isAffliction({ tag: poemTag }) && targetHasEfflorescenceMuse(effects, defenderId)) {
    const withoutEfflorescenceMuse = effects.filter(
      e => !(e.targetId === defenderId && e.tag === EFFECT_TAGS.EFFLORESCENCE_MUSE),
    );
    updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = withoutEfflorescenceMuse;
    return updates; // blocked; Efflorescence Muse consumed; no poem effect applied
  }

  if (poemTag === POEM_VERSE.ETERNAL_AGONY) {
    // Extend all afflictions on defender by 2 rounds (2 * queueLen), then poem ends (no effect added)
    const extendBy = 2 * queueLen;
    for (const e of effects) {
      if (e.targetId === defenderId && isAffliction(e)) {
        e.turnsRemaining = (e.turnsRemaining ?? 0) + extendBy;
      }
    }
  } else {
    // HEALING_NULLIFIED or DISORIENTED: add effect for 2 rounds
    const existing = effects.find(e => e.targetId === defenderId && e.tag === poemTag);
    if (existing) {
      existing.turnsRemaining = duration;
    } else {
      effects.push({
        id: makeEffectId(attackerId, POWER_NAMES.IMPRECATED_POEM),
        powerName: POWER_NAMES.IMPRECATED_POEM,
        effectType: EFFECT_TYPES.DEBUFF,
        sourceId: attackerId,
        targetId: defenderId,
        value: 0,
        turnsRemaining: duration,
        tag: poemTag,
        tag2: EFFECT_TAGS.IMPRECATED_POEM,
      });
    }
  }

  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effects;
  return updates;
}

export function applyFloralFragranced(
  room: BattleRoom,
  attackerId: string,
  allyTargetId: string,
  battle: BattleState,
  _power: PowerDefinition,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  const caster = findFighter(room, attackerId);
  const ally = findFighter(room, allyTargetId);
  const allyPath = findFighterPath(room, allyTargetId);
  if (!caster || !ally || !allyPath) return {};

  const baseHeal = Math.ceil(0.2 * caster.maxHp);
  const healValue = getEffectiveHealForReceiver(baseHeal, ally, allyTargetId, battle.activeEffects || []);
  const newCurrentHp = Math.min(ally.currentHp + healValue, ally.maxHp);
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
  effects = effects.filter(e => !isSeasonTag(e.tag ?? ''));

  // Duration: 2 full rounds (every fighter gets 2 action cycles)
  const queueLen = battle.turnQueue?.length || 1;
  const duration = queueLen * 2 + 1; // *2 for 2 rounds, +1 compensates for tick in confirmSeason

  for (const fighter of teammates) {
    if (fighter.currentHp <= 0) continue;

    const fighterId = fighter.characterId;

    switch (season) {
      case SEASON_KEYS.SUMMER: {
        effects.push({
          id: makeEffectId(attackerId, POWER_NAMES.EPHEMERAL_SEASON),
          powerName: POWER_NAMES.EPHEMERAL_SEASON,
          effectType: EFFECT_TYPES.BUFF,
          sourceId: attackerId,
          targetId: fighterId,
          value: 2,
          modStat: MOD_STAT.ATTACK_DICE_UP,
          turnsRemaining: duration,
          tag: EFFECT_TAGS.SEASON_SUMMER,
        });
        break;
      }

      case SEASON_KEYS.AUTUMN: {
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
          id: makeEffectId(attackerId, POWER_NAMES.EPHEMERAL_SEASON),
          powerName: POWER_NAMES.EPHEMERAL_SEASON,
          effectType: EFFECT_TYPES.BUFF,
          sourceId: attackerId,
          targetId: fighterId,
          value: 2,
          modStat: MOD_STAT.MAX_HP,
          turnsRemaining: duration,
          tag: EFFECT_TAGS.SEASON_AUTUMN,
        });
        break;
      }

      case SEASON_KEYS.WINTER: {
        effects.push({
          id: makeEffectId(attackerId, POWER_NAMES.EPHEMERAL_SEASON),
          powerName: POWER_NAMES.EPHEMERAL_SEASON,
          effectType: EFFECT_TYPES.BUFF,
          sourceId: attackerId,
          targetId: fighterId,
          value: 2,
          modStat: MOD_STAT.DEFEND_DICE_UP,
          turnsRemaining: duration,
          tag: EFFECT_TAGS.SEASON_WINTER,
        });
        break;
      }

      case SEASON_KEYS.SPRING: {
        // Spring heal is applied in resolveTurn; add effect so pip/SeasonalEffects show Spring
        effects.push({
          id: makeEffectId(attackerId, POWER_NAMES.EPHEMERAL_SEASON),
          powerName: POWER_NAMES.EPHEMERAL_SEASON,
          effectType: EFFECT_TYPES.BUFF,
          sourceId: attackerId,
          targetId: fighterId,
          value: 0,
          turnsRemaining: duration,
          tag: EFFECT_TAGS.SEASON_SPRING,
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
  effects = effects.filter(e => e.tag !== EFFECT_TAGS.POMEGRANATE_SPIRIT);

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
    tag: EFFECT_TAGS.POMEGRANATE_SPIRIT,
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
