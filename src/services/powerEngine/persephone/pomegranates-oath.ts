/**
 * Pomegranate's Oath (Ultimate)
 * Grant spirit form buff to ally for 3 rounds (only one active at a time)
 */

import type { BattleRoom, BattleState } from '../../../types/battle';
import type { ActiveEffect } from '../../../types/power';
import { EFFECT_TAGS } from '../../../constants/effectTags';
import { POWER_NAMES } from '../../../constants/powers';
import { ARENA_PATH } from '../../../constants/battle';
import { EFFECT_TYPES } from '../../../constants/effectTypes';
import { makeEffectId } from '../powerEngine';

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
  effects = effects.filter(e => e.tag !== EFFECT_TAGS.POMEGRANATE_OATH_SPIRIT);

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
    tag: EFFECT_TAGS.POMEGRANATE_OATH_SPIRIT,
  });

  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effects;
  return updates;
}
