import type { BattleRoom, BattleState, FighterState } from '../types/battle';
import { Minion } from '../types/minions';
import { createSkeletonMinion } from '../data/minions';
import type { ActiveEffect, PowerDefinition, ModStat } from '../types/power';
import { getQuotaCost } from '../types/power';

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

function findFighterTeam(room: BattleRoom, id: string): 'teamA' | 'teamB' | null {
  if ((room.teamA?.members || []).some(m => m.characterId === id)) return 'teamA';
  if ((room.teamB?.members || []).some(m => m.characterId === id)) return 'teamB';
  return null;
}

function makeEffectId(sourceId: string, powerName: string): string {
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
    .reduce((sum, e) => sum + (e.effectType === 'buff' ? e.value : -e.value), 0);
}

/** Get total shield value on a fighter */
export function getShieldValue(effects: ActiveEffect[], fighterId: string): number {
  return (effects || [])
    .filter(e => e.targetId === fighterId && e.effectType === 'shield')
    .reduce((sum, e) => sum + e.value, 0);
}

/** Get total reflect % on a fighter */
export function getReflectPercent(effects: ActiveEffect[], fighterId: string): number {
  return (effects || [])
    .filter(e => e.targetId === fighterId && e.effectType === 'reflect')
    .reduce((sum, e) => sum + e.value, 0);
}

/** Check if a fighter is stunned */
export function isStunned(effects: ActiveEffect[], fighterId: string): boolean {
  return (effects || []).some(e => e.targetId === fighterId && e.effectType === 'stun' && e.turnsRemaining > 0);
}

/** Check if a fighter has any unlocked active (non-passive) powers they can afford */
export function getAffordablePowers(fighter: FighterState): { power: PowerDefinition; index: number }[] {
  const result: { power: PowerDefinition; index: number }[] = [];
  for (let i = 0; i < fighter.powers.length; i++) {
    const p = fighter.powers[i];
    if (p.type === 'Passive') continue;

    // Check unlock
    if (p.type === 'Ultimate' && fighter.ultimateSkillPoint !== 'unlock') continue;
    if ((p.type === '1st Skill' || p.type === '2nd Skill') && fighter.skillPoint !== 'unlock') continue;

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
      if (subUpdates['battle/activeEffects']) {
        effectsCopy = subUpdates['battle/activeEffects'] as ActiveEffect[];
      }
      Object.assign(combined, subUpdates);
    }
    combined['battle/activeEffects'] = effectsCopy;
    return combined;
  }

  const updates: Record<string, unknown> = {};
  const effects: ActiveEffect[] = [...(battle.activeEffects || [])];

  const targetId = power.target === 'self' ? attackerId : defenderId;
  const target = findFighter(room, targetId);
  const attacker = findFighter(room, attackerId);
  if (!target || !attacker) return updates;

  const targetPath = findFighterPath(room, targetId);
  const attackerPath = findFighterPath(room, attackerId);

  // Petal-shield immunity: block debuff/stun/dot on shielded target
  if (
    (power.effect === 'debuff' || power.effect === 'stun' || power.effect === 'dot') &&
    power.target !== 'self' &&
    effects.some(e => e.targetId === targetId && e.tag === 'petal-shield')
  ) {
    return updates; // blocked by status immunity
  }

  switch (power.effect) {
    case 'damage': {
      const newHp = Math.max(0, target.currentHp - power.value);
      if (targetPath) updates[`${targetPath}/currentHp`] = newHp;
      break;
    }

    case 'heal': {
      const newHp = Math.min(target.maxHp, target.currentHp + power.value);
      if (targetPath) updates[`${targetPath}/currentHp`] = newHp;
      break;
    }

    case 'lifesteal': {
      const newTargetHp = Math.max(0, target.currentHp - power.value);
      if (targetPath) updates[`${targetPath}/currentHp`] = newTargetHp;
      const healAmount = Math.floor(power.value * 0.5);
      const newAttackerHp = Math.min(attacker.maxHp, attacker.currentHp + healAmount);
      if (attackerPath) updates[`${attackerPath}/currentHp`] = newAttackerHp;
      break;
    }

    case 'buff':
    case 'debuff': {
      const eff: ActiveEffect = {
        id: makeEffectId(attackerId, power.name),
        powerName: power.name,
        effectType: power.effect,
        sourceId: attackerId,
        targetId,
        value: power.value,
        turnsRemaining: power.duration,
      };
      if (power.modStat) eff.modStat = power.modStat;
      effects.push(eff);

      // Undead Army: create skeleton minion (max 2)
      if (power.modStat === 'skeletonCount' && targetPath) {
        const currentCount = target.skeletonCount || 0;
        if (currentCount < 2) {
          updates[`${targetPath}/skeletonCount`] = currentCount + power.value;
          
          // Create minion
          const team = findFighterTeam(room, targetId);
          if (team) {
            const existingMinions = room[team]?.minions || [];
            // Use the centralized helper so skeletons have the canonical skeleton image/theme
            const skeleton = createSkeletonMinion(target as any);
            // Ensure deityBlood is set to the attacker's deity when available (Hades expected)
            // Note: `createSkeletonMinion` already sets `damage = Math.ceil(master.damage * 0.5)`
            // so we avoid overriding it here to keep a single source of truth.
            updates[`${team}/minions`] = [...existingMinions, skeleton];
          }
        }
      }
      break;
    }

    case 'shield': {
      effects.push({
        id: makeEffectId(attackerId, power.name),
        powerName: power.name,
        effectType: 'shield',
        sourceId: attackerId,
        targetId,
        value: power.value,
        turnsRemaining: power.duration || 3,
      });
      break;
    }

    case 'dot': {
      effects.push({
        id: makeEffectId(attackerId, power.name),
        powerName: power.name,
        effectType: 'dot',
        sourceId: attackerId,
        targetId,
        value: power.value,
        turnsRemaining: power.duration,
      });
      break;
    }

    case 'stun': {
      effects.push({
        id: makeEffectId(attackerId, power.name),
        powerName: power.name,
        effectType: 'stun',
        sourceId: attackerId,
        targetId,
        value: 0,
        turnsRemaining: power.duration || 1,
      });
      break;
    }

    case 'reflect': {
      effects.push({
        id: makeEffectId(attackerId, power.name),
        powerName: power.name,
        effectType: 'reflect',
        sourceId: attackerId,
        targetId: attackerId, // reflect is always on self
        value: power.value,
        turnsRemaining: power.duration || 2,
      });
      break;
    }

    case 'cleanse': {
      // Remove all debuff + dot + stun effects from self
      const cleaned = effects.filter(e =>
        !(e.targetId === attackerId && (e.effectType === 'debuff' || e.effectType === 'dot' || e.effectType === 'stun')),
      );
      effects.length = 0;
      effects.push(...cleaned);
      break;
    }

    case 'reroll_grant': {
      if (attackerPath) {
        updates[`${attackerPath}/rerollsLeft`] = attacker.rerollsLeft + power.value;
      }
      break;
    }
  }

  updates['battle/activeEffects'] = effects;
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
    if (e.effectType === 'dot' && e.turnsRemaining > 0 && e.value > 0) {
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
    if (e.tag === 'season-spring' && e.turnsRemaining > 0 && e.value > 0) {
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
    e => e.tag === 'season-autumn' && e.turnsRemaining < 999 && e.turnsRemaining - 1 <= 0,
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
  updates['battle/activeEffects'] = remaining;
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
  if (!attacker || attacker.passiveSkillPoint !== 'unlock') return { updates, bonusDamage: 0 };

  const passive = attacker.powers.find(p => p.type === 'Passive' && p.name === 'Lightning Reflex');
  if (!passive) return { updates, bonusDamage: 0 };

  const existingShocks = effects.filter(
    e => e.targetId === defenderId && e.tag === 'shock',
  );

  if (existingShocks.length > 0) {
    // Double-shock: bonus damage = baseDamage, remove all shocks on defender
    const cleaned = effects.filter(
      e => !(e.targetId === defenderId && e.tag === 'shock'),
    );
    updates['battle/activeEffects'] = cleaned;
    return { updates, bonusDamage: baseDamage };
  }

  // First shock: apply permanent DOT with tag
  effects.push({
    id: makeEffectId(attackerId, 'Lightning Reflex'),
    powerName: 'Lightning Reflex',
    effectType: 'dot',
    sourceId: attackerId,
    targetId: defenderId,
    value: 0,
    turnsRemaining: 999,
    tag: 'shock',
  });
  updates['battle/activeEffects'] = effects;
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
      e => e.targetId === enemy.characterId && e.tag === 'shock',
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
  const cleaned = effects.filter(e => e.tag !== 'shock');
  updates['battle/activeEffects'] = cleaned;
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
  if (!attacker || attacker.passiveSkillPoint !== 'unlock') return {};

  const passive = attacker.powers.find(
    p => p.type === 'Passive' && p.name === 'Secret of Dryad',
  );
  if (!passive) return {};

  // Already has petal-shield? Skip (don't stack)
  const effects = [...(battle.activeEffects || [])];
  if (effects.some(e => e.targetId === attackerId && e.tag === 'petal-shield')) return {};

  // Duration = turnQueue.length + 1 (offset: tickEffects decrements 1 in same resolve)
  const queueLen = battle.turnQueue?.length || 1;
  effects.push({
    id: makeEffectId(attackerId, 'Secret of Dryad'),
    powerName: 'Secret of Dryad',
    effectType: 'shield',
    sourceId: attackerId,
    targetId: attackerId,
    value: 0,
    turnsRemaining: queueLen + 1,
    tag: 'petal-shield',
  });

  return { 'battle/activeEffects': effects };
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
  const oldAutumn = effects.filter(e => e.tag === 'season-autumn');
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
          powerName: 'Ephemeral Season',
          effectType: 'buff',
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
          powerName: 'Ephemeral Season',
          effectType: 'buff',
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
          powerName: 'Ephemeral Season',
          effectType: 'buff',
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
          powerName: 'Ephemeral Season',
          effectType: 'buff',
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

  updates['battle/activeEffects'] = effects;
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
    id: makeEffectId(attackerId, "Pomegranate's Oath"),
    powerName: "Pomegranate's Oath",
    effectType: 'buff',
    sourceId: attackerId,
    targetId: allyTargetId,
    value: 0,
    turnsRemaining: duration,
    tag: 'pomegranate-spirit',
  });

  updates['battle/activeEffects'] = effects;
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
    if (fighter.passiveSkillPoint !== 'unlock') continue;
    if (!fighter.powers || fighter.powers.length === 0) continue;
    const passive = fighter.powers.find(p => p.type === 'Passive');
    if (!passive) continue;

    // Death Keeper: one-time resurrection passive
    if (passive.name === 'Death Keeper') {
      effects.push({
        id: makeEffectId(fighter.characterId, 'Death Keeper'),
        powerName: 'Death Keeper',
        effectType: 'buff',
        sourceId: fighter.characterId,
        targetId: fighter.characterId,
        value: 0,
        turnsRemaining: 999,
        tag: 'death-keeper',
      });
      continue;
    }

    // Only buff/debuff passives make sense as permanent effects
    if (passive.effect === 'buff' || passive.effect === 'debuff') {
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
