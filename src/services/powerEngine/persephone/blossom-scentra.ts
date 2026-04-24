/**
 * Blossom Scentra (1st Skill)
 * Heal ally by 20% of caster's max HP, then perform normal attack
 */

import type { BattleRoom, BattleState } from '../../../types/battle';
import type { PowerDefinition } from '../../../types/power';
import { findFighter, findFighterPath, getEffectiveHealForReceiver } from '../powerEngine';

/**
 * Heal the target by ceil(0.2 * caster's Max HP), capped at target's maxHp. Then normal attack follows.
 */
export function applyBlossomScentra(
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

  // Note: VFX is triggered via log entry (log-based system), not activeEffect
  return updates;
}
