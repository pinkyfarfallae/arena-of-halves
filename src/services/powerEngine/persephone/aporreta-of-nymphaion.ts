/**
 * The Aporrēta of Nymphaion (Passive) - Efflorescence Muse
 * Grants status immunity + 25% crit chance for one round when turn starts
 */

import type { BattleRoom, BattleState } from '../../../types/battle';
import { EFFECT_TAGS } from '../../../constants/effectTags';
import { POWER_NAMES, POWER_TYPES } from '../../../constants/powers';
import { ARENA_PATH } from '../../../constants/battle';
import { EFFECT_TYPES, MOD_STAT } from '../../../constants/effectTypes';
import { findFighter, makeEffectId } from '../powerEngine';
import { SKILL_UNLOCKED } from '../../../constants/character';

/**
 * When advancing to a fighter's turn (before select action): grant Efflorescence Muse (status immunity + 25% crit)
 * only if The Aporrēta of Nymphaion is unlocked and the fighter has The Aporrēta of Nymphaion in their powers list.
 * Lasts one full round. Does not stack; re-applied on turn start when still active (see onEfflorescenceMuseTurnStart).
 */
export function applyAporretaOfNymphaionPassive(
  room: BattleRoom,
  attackerId: string,
  battle: BattleState,
  _atkTotal: number,
): Record<string, unknown> {
  if (room.practiceMode) return {};
  const attacker = findFighter(room, attackerId);
  if (!attacker) return {};

  // Do not apply unless passive skill is unlocked
  if (attacker.passiveSkillPoint !== SKILL_UNLOCKED) return {};

  // Only if fighter has The Aporrēta of Nymphaion in their powers list (members from Firebase may omit `powers`)
  const passive = (attacker.powers ?? []).find(
    p => p.type === POWER_TYPES.PASSIVE && p.name === POWER_NAMES.THE_APORRETA_OF_NYMPHAION,
  );
  if (!passive) return {};

  // Remove old Efflorescence Muse (if any) and apply fresh one every turn (no stack; always full duration)
  const effects = [...(battle.activeEffects || [])].filter(
    e => !(e.targetId === attackerId && e.tag === EFFECT_TAGS.EFFLORESCENCE_MUSE),
  );

  // 1 round: duration = one full turn cycle (tickEffects decrements once per resolve)
  const queueLen = battle.turnQueue?.length || 1;
  const duration = queueLen;
  effects.push({
    id: makeEffectId(attackerId, POWER_NAMES.THE_APORRETA_OF_NYMPHAION),
    powerName: POWER_NAMES.THE_APORRETA_OF_NYMPHAION,
    effectType: EFFECT_TYPES.SHIELD,
    sourceId: attackerId,
    targetId: attackerId,
    value: 0,
    turnsRemaining: duration,
    tag: EFFECT_TAGS.EFFLORESCENCE_MUSE,
  });
  // +25% critical hit chance while in Efflorescence Muse (same duration; removed when Efflorescence Muse is consumed)
  effects.push({
    id: makeEffectId(attackerId, `${POWER_NAMES.THE_APORRETA_OF_NYMPHAION}_crit`),
    powerName: POWER_NAMES.THE_APORRETA_OF_NYMPHAION,
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
  if (room.practiceMode) return null;
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
