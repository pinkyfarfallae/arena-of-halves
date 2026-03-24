/**
 * Zeus - Keraunos Voltage (multi-target lightning bolt power)
 * Includes shock application logic and legacy chain implementation.
 */

import type { BattleRoom, BattleState } from '../../../types/battle';
import { POWER_NAMES } from '../../../constants/powers';
import { ARENA_PATH } from '../../../constants/battle';
import { findFighterPath } from '../powerEngine';
import { applyShockedEffectToTarget } from './shock';

/**
 * Apply shock to everyone alive on the opponent team for Keraunos Voltage.
 * Uses central applyShockedEffectToTarget: already shocked → bonus damage = casterDamage (100% of caster's normal attack), then remove all shocks; else apply shock.
 * casterDamage: attacker.damage + damage buff — used as bonus when target already has shock.
 * baseDamageByTarget: main = 3, secondaries = 2, everyone else = 0 (determines who gets shock applied; bonus amount is always casterDamage).
 * currentHpByTarget: optional map of targetId -> current HP after damage (for bonus damage HP).
 * excludeTargetIds: targets that had skeleton block (hit landed on skeleton, not master) — do not apply shock or bonus damage to them.
 */
export function applyKeraunosVoltageShock(
  room: BattleRoom,
  attackerId: string,
  defenderId: string,
  battle: BattleState,
  casterDamage: number,
  currentHpByTarget?: Record<string, number>,
  baseDamageByTarget?: Record<string, number>,
  excludeTargetIds?: string[],
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  const excludeSet = new Set(excludeTargetIds ?? []);
  const isTeamA = (room.teamA?.members || []).some(m => m.characterId === attackerId);
  const enemies = isTeamA ? (room.teamB?.members || []) : (room.teamA?.members || []);
  const targets = baseDamageByTarget && Object.keys(baseDamageByTarget).length > 0
    ? Object.keys(baseDamageByTarget)
    : enemies.filter(e => e.currentHp > 0).map(e => e.characterId);
  if (targets.length === 0) return updates;

  let effects = [...(battle.activeEffects || [])];
  for (const targetId of targets) {
    if (excludeSet.has(targetId)) continue; // skeleton took the hit — no affliction on master
    const currentHp = currentHpByTarget?.[targetId];
    if (currentHp !== undefined && currentHp <= 0) continue; // KO'd by bolt — do not apply shock or overwrite HP
    // Bonus when already shocked = caster's damage (same as Lightning Reflex), not bolt 3/2/1
    const result = applyShockedEffectToTarget(
      room,
      attackerId,
      targetId,
      effects,
      casterDamage,
      POWER_NAMES.KERAUNOS_VOLTAGE,
      { skipIfEfflorescenceMuse: true, ...(currentHp !== undefined && { currentHp }) },
    );
    effects = result.effects;
    if (result.hpUpdate) updates[result.hpUpdate.path] = result.hpUpdate.value;
  }
  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effects;
  return updates;
}

/**
 * Keraunos Voltage: shock/bonus for a single bolt target (sequential resolve).
 * Same rules as applyKeraunosVoltageShock but one target — use between bolts so effects stay in sync.
 */
export function applyKeraunosVoltageShockSingleTarget(
  room: BattleRoom,
  attackerId: string,
  battle: BattleState,
  casterDamage: number,
  targetId: string,
  currentHpOverride: number | undefined,
  excludeTargetIds?: string[],
): { updates: Record<string, unknown>; bonusDamage: number } {
  const out: Record<string, unknown> = {};
  if (excludeTargetIds?.includes(targetId)) return { updates: out, bonusDamage: 0 };
  if (currentHpOverride !== undefined && currentHpOverride <= 0) return { updates: out, bonusDamage: 0 };

  let effects = [...(battle.activeEffects || [])];
  const result = applyShockedEffectToTarget(
    room,
    attackerId,
    targetId,
    effects,
    casterDamage,
    POWER_NAMES.KERAUNOS_VOLTAGE,
    { skipIfEfflorescenceMuse: true, ...(currentHpOverride !== undefined && { currentHp: currentHpOverride }) },
  );
  out[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = result.effects;
  out.bonusDamage = result.bonusDamage;
  if (result.hpUpdate) out[result.hpUpdate.path] = result.hpUpdate.value;
  return { updates: out, bonusDamage: result.bonusDamage };
}

/**
 * Apply Keraunos Voltage chain: -1 damage to all enemies EXCEPT primary target.
 * 
 * **LEGACY**: Keraunos now uses chosen targets + crit D4 system.
 * Kept for reference or potential future use.
 */
export function applyKeraunosVoltageChain(
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
