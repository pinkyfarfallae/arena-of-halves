import { get, update } from 'firebase/database';
import type { ActiveEffect } from '../../../types/power';
import type { BattleRoom, FighterState } from '../../../types/battle';
import { MOD_STAT } from '../../../constants/effectTypes';
import { PHASE, BATTLE_TEAM, ARENA_PATH, ROOM_STATUS } from '../../../constants/battle';

/**
 * True if the fighter has Shadow Camouflage (immune to single-target actions; only area attacks can target them).
 */
export function hasShadowCamouflage(activeEffects: ActiveEffect[], characterId: string): boolean {
  return (activeEffects || []).some(
    e => e.targetId === characterId && e.modStat === MOD_STAT.SHADOW_CAMOUFLAGED,
  );
}

/**
 * Advance after Shadow Camouflage quota refill D4 roll (25% chance to refill 1 quota).
 * Called after client shows the D4 result modal.
 */
export async function advanceAfterShadowCamouflageD4(
  arenaId: string,
  { roomRef, findFighter, findFighterPath, buildTurnQueue, nextAliveIndex, isTeamEliminated, applySelfResurrect }: {
    roomRef: (arenaId: string) => any;
    findFighter: (room: BattleRoom, characterId: string) => FighterState | undefined;
    findFighterPath: (room: BattleRoom, characterId: string) => string | null;
    buildTurnQueue: (room: BattleRoom, effects?: ActiveEffect[]) => any[];
    nextAliveIndex: (queue: any[], fromIndex: number, room: BattleRoom, effects?: ActiveEffect[]) => { index: number; wrapped: boolean };
    isTeamEliminated: (members: FighterState[], effects?: ActiveEffect[]) => boolean;
    applySelfResurrect: (nextCharId: string, room: BattleRoom, effects: ActiveEffect[], updates: Record<string, unknown>, battle: { roundNumber: number; log: unknown[] }) => boolean;
  },
): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  const turn = battle?.turn;
  if (!turn?.shadowCamouflageRefillWinFaces?.length || turn.shadowCamouflageRefillRoll == null) return;
  if (turn.phase !== PHASE.RESOLVING) return;

  const { attackerId } = turn;
  const attacker = findFighter(room, attackerId);
  if (!attacker) return;

  const updates: Record<string, unknown> = {};
  const atkPath = findFighterPath(room, attackerId);
  const winFaces = (turn.shadowCamouflageRefillWinFaces ?? []).map((f: unknown) => Number(f));
  const roll = Number(turn.shadowCamouflageRefillRoll);
  const won = Number.isFinite(roll) && roll >= 1 && roll <= 4 && winFaces.includes(roll);
  const maxQuota = typeof attacker.maxQuota === 'number' && !isNaN(attacker.maxQuota) ? attacker.maxQuota : 3;
  if (atkPath && won && attacker.quota < maxQuota) {
    updates[`${atkPath}/quota`] = Math.min(attacker.quota + 1, maxQuota);
  }

  const getHp = (m: FighterState) => {
    const path = findFighterPath(room, m.characterId);
    if (path && `${path}/currentHp` in updates) return updates[`${path}/currentHp`] as number;
    return m.currentHp;
  };
  const teamAMembers = (room.teamA?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
  const teamBMembers = (room.teamB?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
  const latestEffects = battle?.activeEffects || [];

  const END_ARENA_DELAY_MS = 3500;
  if (isTeamEliminated(teamBMembers, latestEffects)) {
    updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: turn.attackerTeam, phase: PHASE.DONE };
    updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
    await update(roomRef(arenaId), updates);
    setTimeout(() => {
      update(roomRef(arenaId), {
        [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.A,
        [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
        [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
      }).catch(() => { });
    }, END_ARENA_DELAY_MS);
    return;
  }
  if (isTeamEliminated(teamAMembers, latestEffects)) {
    updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: turn.attackerTeam, phase: PHASE.DONE };
    updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
    await update(roomRef(arenaId), updates);
    setTimeout(() => {
      update(roomRef(arenaId), {
        [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.B,
        [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
        [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
      }).catch(() => { });
    }, END_ARENA_DELAY_MS);
    return;
  }

  const updatedRoom = {
    ...room,
    teamA: { ...room.teamA, members: teamAMembers },
    teamB: { ...room.teamB, members: teamBMembers },
  } as BattleRoom;
  const updatedQueue = buildTurnQueue(updatedRoom, latestEffects);
  const currentAttackerIdx = updatedQueue.findIndex(e => e.characterId === attackerId);
  const fromIdx = currentAttackerIdx !== -1 ? currentAttackerIdx : battle?.currentTurnIndex ?? 0;
  const { index: nextIdx, wrapped } = nextAliveIndex(updatedQueue, fromIdx, updatedRoom, latestEffects);
  const nextEntry = updatedQueue[nextIdx];

  // Import isStunned from powerEngine
  const { isStunned } = await import('../../powerEngine/powerEngine');
  
  const selfRes1 = applySelfResurrect(nextEntry.characterId, updatedRoom, latestEffects, updates, battle as any);
  const nextFighter = findFighter(updatedRoom, nextEntry.characterId);
  if (nextFighter && !selfRes1 && isStunned(latestEffects, nextEntry.characterId)) {
    updates[ARENA_PATH.BATTLE_TURN_QUEUE] = updatedQueue;
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? (battle?.roundNumber ?? 0) + 1 : (battle?.roundNumber ?? 0);
    const { index: skipIdx, wrapped: skipWrapped } = nextAliveIndex(updatedQueue, nextIdx, updatedRoom, latestEffects);
    const skipEntry = updatedQueue[skipIdx];
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdx;
    if (skipWrapped) updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = (updates[ARENA_PATH.BATTLE_ROUND_NUMBER] as number || (battle?.roundNumber ?? 0)) + 1;
    updates[ARENA_PATH.BATTLE_TURN] = { attackerId: skipEntry.characterId, attackerTeam: skipEntry.team, phase: PHASE.SELECT_ACTION };
  } else {
    updates[ARENA_PATH.BATTLE_TURN_QUEUE] = updatedQueue;
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? (battle?.roundNumber ?? 0) + 1 : (battle?.roundNumber ?? 0);
    const turnData: Record<string, unknown> = { attackerId: nextEntry.characterId, attackerTeam: nextEntry.team, phase: PHASE.SELECT_ACTION };
    if (selfRes1) turnData.resurrectTargetId = nextEntry.characterId;
    updates[ARENA_PATH.BATTLE_TURN] = turnData;
  }

  updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
  updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
  await update(roomRef(arenaId), updates);
}
