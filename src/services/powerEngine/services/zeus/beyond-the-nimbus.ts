/**
 * Zeus - Beyond the Nimbus (team-wide shock buff)
 */

import type { BattleRoom, BattleState } from '../../../../types/battle';
import { POWER_NAMES } from '../../../../constants/powers';
import { BATTLE_TEAM, ARENA_PATH } from '../../../../constants/battle';
import { findFighterTeam } from '../../powerEngine';
import { applyShockedEffectToTarget } from './shock';

/**
 * Apply shock to all enemy team members (Beyond the Nimbus). Uses central applyShockedEffectToTarget:
 * already shocked → 100% base damage + remove all shocks; else apply shock.
 */
export function applyBeyondTheNimbusTeamShock(
  room: BattleRoom,
  attackerId: string,
  battle: BattleState,
  baseDamage: number,
  /** If set, do not apply shock to this character (e.g. attack target just cleansed by Lightning Reflex). */
  excludeTargetId?: string,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  const attackerTeam = findFighterTeam(room, attackerId);
  if (!attackerTeam) return updates;

  const enemies = attackerTeam === BATTLE_TEAM.A
    ? (room.teamB?.members || [])
    : (room.teamA?.members || []);

  let effects = [...(battle.activeEffects || [])];
  for (const enemy of enemies) {
    if (enemy.currentHp <= 0) continue;
    if (excludeTargetId && enemy.characterId === excludeTargetId) continue;

    const result = applyShockedEffectToTarget(
      room,
      attackerId,
      enemy.characterId,
      effects,
      baseDamage,
      POWER_NAMES.BEYOND_THE_NIMBUS,
      { skipIfEfflorescenceMuse: true },
    );
    effects = result.effects;
    if (result.hpUpdate) updates[result.hpUpdate.path] = result.hpUpdate.value;
  }
  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effects;
  return updates;
}
