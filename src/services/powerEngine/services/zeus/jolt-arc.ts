/**
 * Zeus - Jolt Arc (AoE shock detonation power)
 */

import type { BattleRoom, BattleState } from '../../../../types/battle';
import { EFFECT_TAGS } from '../../../../constants/effectTags';
import { EFFECT_TYPES, MOD_STAT } from '../../../../constants/effectTypes';
import { POWER_NAMES } from '../../../../constants/powers';
import { ARENA_PATH } from '../../../../constants/battle';
import { findFighter, targetHasEfflorescenceMuse, makeEffectId } from '../../powerEngine';

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
