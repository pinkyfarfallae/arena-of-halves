/**
 * Zeus - Lightning Spark (Lightning Reflex passive)
 */

import type { BattleRoom, BattleState } from '../../../../types/battle';
import { POWER_NAMES, POWER_TYPES } from '../../../../constants/powers';
import { ARENA_PATH } from '../../../../constants/battle';
import { SKILL_UNLOCK } from '../../../../constants/character';
import { findFighter } from '../../powerEngine';
import { applyShockedEffectToTarget } from './shock';

/**
 * Apply Lightning Reflex shock on successful attack.
 * Uses central applyShockedEffectToTarget: already shocked → 100% bonus damage + remove all shocks; else apply shock.
 */
export function applyLightningSparkPassive(
  room: BattleRoom,
  attackerId: string,
  defenderId: string,
  battle: BattleState,
  baseDamage: number,
): { updates: Record<string, unknown>; bonusDamage: number } {
  const updates: Record<string, unknown> = {};
  const attacker = findFighter(room, attackerId);
  if (!attacker || attacker.passiveSkillPoint !== SKILL_UNLOCK) return { updates, bonusDamage: 0 };

  const passive = (attacker.powers ?? []).find(p => p.type === POWER_TYPES.PASSIVE && p.name === POWER_NAMES.LIGHTNING_SPARK);
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
