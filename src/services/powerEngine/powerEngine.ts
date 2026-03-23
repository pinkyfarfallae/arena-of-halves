import type { BattleRoom, BattleState, FighterState } from '../../types/battle';
import { createSkeletonMinion } from '../../data/minions';
import type { ActiveEffect, PowerDefinition, ModStat } from '../../types/power';
import { getQuotaCost } from '../../types/power';
import { EFFECT_TAGS } from '../../constants/effectTags';
import { POWER_NAMES, POWER_TYPES } from '../../constants/powers';
import { SKILL_UNLOCK } from '../../constants/character';
import { ARENA_PATH, BATTLE_TEAM, type BattleTeamKey } from '../../constants/battle';
import { EFFECT_TYPES, TARGET_TYPES, MOD_STAT } from '../../constants/effectTypes';
import { isHealingNullified, addSunbornSovereignRecoveryStack } from './services/apollo/helpers';

// Zeus deity services
export {
  applyShockedEffectToTarget,
  applyLightningSparkPassive,
  applyBeyondTheNimbusTeamShock,
  applyJoltArc,
  applyKeraunosVoltageChain,
  applyKeraunosVoltageShock,
  applyKeraunosVoltageShockSingleTarget,
  type ApplyShockedEffectOptions,
} from './services/zeus/zeus';

// Apollo deity services
export {
  applyApolloHymn,
  applyImprecatedPoem,
  isHealingNullified,
  addSunbornSovereignRecoveryStack,
} from './services/apollo/apollo';

// Hades deity services
export { } from './services/hades/hades';

// Persephone deity services
export {
  applySecretOfDryadPassive,
  onEfflorescenceMuseTurnStart,
  applyFloralFragranced,
  applySeasonEffects,
  applyPomegranateOath,
} from './services/persephone/persephone';

/* ── helpers ─────────────────────────────────────────── */

export function targetHasEfflorescenceMuse(effects: ActiveEffect[], targetId: string): boolean {
  return effects.some(e => e.targetId === targetId && e.tag === EFFECT_TAGS.EFFLORESCENCE_MUSE);
}

export function findFighter(room: BattleRoom, id: string): FighterState | undefined {
  const all = [...(room.teamA?.members || []), ...(room.teamB?.members || [])];
  return all.find(m => m.characterId === id);
}

export function findFighterPath(room: BattleRoom, id: string): string | null {
  const aIdx = (room.teamA?.members || []).findIndex(m => m.characterId === id);
  if (aIdx !== -1) return `teamA/members/${aIdx}`;
  const bIdx = (room.teamB?.members || []).findIndex(m => m.characterId === id);
  if (bIdx !== -1) return `teamB/members/${bIdx}`;
  return null;
}

export function findFighterTeam(room: BattleRoom, id: string): BattleTeamKey | null {
  if ((room.teamA?.members || []).some(m => m.characterId === id)) return BATTLE_TEAM.A;
  if ((room.teamB?.members || []).some(m => m.characterId === id)) return BATTLE_TEAM.B;
  return null;
}

export function makeEffectId(sourceId: string, powerName: string): string {
  return `${sourceId}_${powerName}_${Date.now()}`;
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
    power.target !== TARGET_TYPES.SELF &&
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
      // Volley Arrow (Rapid Fire): 3 rounds. UI shows Math.ceil(turnsRemaining / queueLen) as "rounds", so store N * queueLen to display N.
      const isShadowCamouflaging = power.name === POWER_NAMES.SHADOW_CAMOUFLAGING || power.modStat === MOD_STAT.SHADOW_CAMOUFLAGED;
      const isBeyondTheNimbus = power.name === POWER_NAMES.BEYOND_THE_NIMBUS;
      const isVolleyArrow = power.name === POWER_NAMES.VOLLEY_ARROW;
      const queueLen = battle.turnQueue?.length || 1;
      const shadowCamouflageDuration = 2 * queueLen;
      const beyondTheNimbusDuration = 2 * queueLen;
      const volleyArrowDuration = 3 * queueLen
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
            : isVolleyArrow
              ? volleyArrowDuration
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
        // Volley Arrow: Rapid Fire state for extra-shot chain
        if (power.name === POWER_NAMES.VOLLEY_ARROW) eff.tag = EFFECT_TAGS.RAPID_FIRE;
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
