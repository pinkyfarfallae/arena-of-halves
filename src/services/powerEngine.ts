import type { BattleRoom, BattleState, FighterState } from '../types/battle';
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

  // Floral-scent expiration: revert maxHp and currentHp before effect is removed
  for (const e of effects) {
    if (e.tag === 'floral-scent' && e.turnsRemaining === 1) {
      const fighter = findFighter(room, e.targetId);
      const path = findFighterPath(room, e.targetId);
      if (fighter && path) {
        const hpKey = `${path}/currentHp`;
        const maxKey = `${path}/maxHp`;
        const currentHp = (hpKey in updates)
          ? updates[hpKey] as number
          : (priorUpdates && hpKey in priorUpdates)
            ? priorUpdates[hpKey] as number
            : fighter.currentHp;
        const newMaxHp = fighter.maxHp - e.value;
        const newCurrentHp = Math.max(1, Math.min(currentHp - e.value, newMaxHp));
        updates[maxKey] = newMaxHp;
        updates[hpKey] = newCurrentHp;
      }
    }
  }

  // Decrement durations, remove expired (skip turnsRemaining 999 = permanent passives)
  const remaining = effects
    .map(e => e.turnsRemaining >= 999 ? e : { ...e, turnsRemaining: e.turnsRemaining - 1 })
    .filter(e => e.turnsRemaining > 0);

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
 * Anoint an ally with flower scent: +value maxHp, +value currentHp.
 * Creates a 'floral-scent' tagged buff that reverts on expiration.
 */
export function applyFloralScented(
  room: BattleRoom,
  attackerId: string,
  allyTargetId: string,
  battle: BattleState,
  power: PowerDefinition,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  const ally = findFighter(room, allyTargetId);
  const allyPath = findFighterPath(room, allyTargetId);
  if (!ally || !allyPath) return {};

  const newMaxHp = ally.maxHp + power.value;
  const newCurrentHp = Math.min(ally.currentHp + power.value, newMaxHp);
  updates[`${allyPath}/maxHp`] = newMaxHp;
  updates[`${allyPath}/currentHp`] = newCurrentHp;

  const effects = [...(battle.activeEffects || [])];
  effects.push({
    id: makeEffectId(allyTargetId, 'Floral Scented'),
    powerName: 'Floral Scented',
    effectType: 'buff',
    sourceId: attackerId,
    targetId: allyTargetId,
    value: power.value,
    turnsRemaining: power.duration + 1,
    tag: 'floral-scent',
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
