/**
 * Zeus - Core Shock Logic (shared utility)
 * Central shock application logic used by all Zeus shock powers:
 * - Lightning Spark (passive)
 * - Beyond the Nimbus (team-wide)
 * - Keraunos Voltage (multi-target)
 * - Jolt Arc (detonation)
 */

import type { BattleRoom } from '../../../../types/battle';
import type { ActiveEffect } from '../../../../types/power';
import { EFFECT_TAGS } from '../../../../constants/effectTags';
import { EFFECT_TYPES } from '../../../../constants/effectTypes';
import { findFighter, findFighterPath, targetHasEfflorescenceMuse, makeEffectId } from '../../powerEngine';

/* ── Core: central shock application (shared by all Zeus shock powers) ── */

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
    // Prevent new affliction (shock); consume Efflorescence Muse
    const withoutEfflorescenceMuse = nextEffects.filter(
      e => !(e.targetId === targetId && e.tag === EFFECT_TAGS.EFFLORESCENCE_MUSE),
    );
    return { effects: withoutEfflorescenceMuse, bonusDamage: 0, hpUpdate: null };
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
