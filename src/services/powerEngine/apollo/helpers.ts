/**
 * Apollo - Shared helper utilities (Imprecated Poem + Sunborn Sovereign)
 */

import type { BattleRoom } from '../../../types/battle';
import type { ActiveEffect } from '../../../types/power';
import { EFFECT_TAGS } from '../../../constants/effectTags';
import { POWER_NAMES } from '../../../constants/powers';
import { EFFECT_TYPES, MOD_STAT } from '../../../constants/effectTypes';
import { findFighter, makeEffectId } from '../powerEngine';

const SUNBORN_SOVEREIGN_RECOVERY_MAX = 2;

/** True if the receiver has Healing Nullified (Imprecated Poem) — heals do nothing. */
export function isHealingNullified(activeEffects: ActiveEffect[], receiverId: string): boolean {
  return activeEffects.some((e) => {
    if (String(e.targetId) !== String(receiverId)) return false;
    if (e.tag !== EFFECT_TAGS.HEALING_NULLIFIED) return false;
    // Expired effects may still exist briefly in activeEffects; treat only active durations as blocking.
    return e.turnsRemaining == null || e.turnsRemaining > 0;
  });
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
