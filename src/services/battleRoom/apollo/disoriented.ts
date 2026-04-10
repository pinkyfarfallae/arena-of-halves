import { get, update } from 'firebase/database';
import type { BattleRoom, BattleState, FighterState, TurnQueueEntry } from '../../../types/battle';
import type { ActiveEffect } from '../../../types/power';
import { PHASE, ARENA_PATH, TURN_ACTION, BATTLE_TEAM, ROOM_STATUS } from '../../../constants/battle';
import { POWER_NAMES } from '../../../constants/powers';
import { DEFAULT_NAMES } from '../../../constants/character';
import { isStunned, applySecretOfDryadPassive, onEfflorescenceMuseTurnStart } from '../../powerEngine/powerEngine';
import { nikeAwardedAfterWinTheFight } from '../../irisWish/applyWishesEffect';

/**
 * Call when phase is ROLLING_DISORIENTED_NO_EFFECT and client has written disorientedRoll.
 */
export async function advanceAfterDisorientedD4(
  arenaId: string,
  {
    roomRef,
    findFighter,
    findFighterPath,
    findFighterTeam,
    sanitizeBattleLog,
    tickEffectsWithSkeletonBlock,
    isTeamEliminated,
    buildTurnQueue,
    nextAliveIndex,
    applySelfResurrect,
  }: {
    roomRef: (arenaId: string) => any;
    findFighter: (room: BattleRoom, characterId: string) => FighterState | undefined;
    findFighterPath: (room: BattleRoom, characterId: string) => string | null;
    findFighterTeam: (room: BattleRoom, characterId: string) => any;
    sanitizeBattleLog: (log: unknown[]) => unknown[];
    tickEffectsWithSkeletonBlock: (arenaId: string, room: BattleRoom, battle: BattleState, priorUpdates: Record<string, unknown>) => Promise<Record<string, unknown>>;
    isTeamEliminated: (members: FighterState[], activeEffects: ActiveEffect[]) => boolean;
    buildTurnQueue: (room: BattleRoom, activeEffects: ActiveEffect[]) => TurnQueueEntry[];
    nextAliveIndex: (queue: TurnQueueEntry[], current: number, room: BattleRoom, effects: ActiveEffect[]) => { index: number; wrapped: boolean };
    applySelfResurrect: (characterId: string, room: BattleRoom, effects: ActiveEffect[], updates: Record<string, unknown>, battle: BattleState) => boolean;
  },
): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  const turn = battle?.turn;
  if (turn?.phase !== PHASE.ROLLING_DISORIENTED_NO_EFFECT) return;
  const roll = Number((turn as { disorientedRoll?: number }).disorientedRoll);
  const winFaces = ((turn as { disorientedWinFaces?: number[] }).disorientedWinFaces ?? []).map((f: unknown) => Number(f));
  const defenderId = turn.defenderId;
  const attackerId = turn.attackerId;
  if (!attackerId || !defenderId || !battle || !Number.isFinite(roll)) return;

  const noEffect = winFaces.length > 0 && winFaces.includes(roll);
  const updates: Record<string, unknown> = {};

  if (noEffect) {
    const attacker = findFighter(room, attackerId);
    const power = turn.action === TURN_ACTION.POWER && turn.usedPowerIndex != null ? attacker?.powers?.[turn.usedPowerIndex] : null;
    const logEntry = {
      round: battle.roundNumber,
      attackerId,
      defenderId,
      attackRoll: 0,
      defendRoll: 0,
      damage: 0,
      defenderHpAfter: findFighter(room, defenderId)?.currentHp ?? 0,
      eliminated: false,
      missed: false,
      powerUsed: power?.name ?? DEFAULT_NAMES.ATTACK,
      skipReason: 'Disoriented (action had no effect)',
    };
    updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), logEntry]);
    const effectUpdates = await tickEffectsWithSkeletonBlock(arenaId, room, battle, updates);
    Object.assign(updates, effectUpdates);
    const latestEffects = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || battle.activeEffects || [];
    const getHp = (m: FighterState) => {
      const path = findFighterPath(room, m.characterId);
      if (path && `${path}/currentHp` in updates) return updates[`${path}/currentHp`] as number;
      return m.currentHp;
    };
    const teamAMembers = (room.teamA?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
    const teamBMembers = (room.teamB?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
    const END_ARENA_DELAY_MS = 3500;
    if (isTeamEliminated(teamBMembers, latestEffects)) {
      updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: turn.attackerTeam!, phase: PHASE.DONE };
      updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
      nikeAwardedAfterWinTheFight(teamAMembers);
      await update(roomRef(arenaId), updates);
      setTimeout(() => {
        update(roomRef(arenaId), { [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.A, [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED, [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null }).catch(() => { });
      }, END_ARENA_DELAY_MS);
      return;
    }
    if (isTeamEliminated(teamAMembers, latestEffects)) {
      updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: turn.attackerTeam!, phase: PHASE.DONE };
      updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
      nikeAwardedAfterWinTheFight(teamBMembers);
      await update(roomRef(arenaId), updates);
      setTimeout(() => {
        update(roomRef(arenaId), { [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.B, [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED, [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null }).catch(() => { });
      }, END_ARENA_DELAY_MS);
      return;
    }
    const updatedRoom = { ...room, teamA: { ...room.teamA, members: teamAMembers }, teamB: { ...room.teamB, members: teamBMembers } } as BattleRoom;
    const updatedQueue = buildTurnQueue(updatedRoom, latestEffects);
    updates[ARENA_PATH.BATTLE_TURN_QUEUE] = updatedQueue;
    const fromIdx = updatedQueue.findIndex((e: TurnQueueEntry) => e.characterId === attackerId);
    const { index: nextIdx, wrapped } = nextAliveIndex(updatedQueue, fromIdx !== -1 ? fromIdx : battle.currentTurnIndex, updatedRoom, latestEffects);
    const nextEntry = updatedQueue[nextIdx];
    const selfRes = applySelfResurrect(nextEntry.characterId, updatedRoom, latestEffects, updates, battle);
    const nextFighter = findFighter(updatedRoom, nextEntry.characterId);
    if (nextFighter && !selfRes && isStunned(latestEffects, nextEntry.characterId)) {
      const { index: skipIdx, wrapped: skipWrapped } = nextAliveIndex(updatedQueue, nextIdx, updatedRoom, latestEffects);
      const skipEntry = updatedQueue[skipIdx];
      updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdx;
      updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = skipWrapped ? battle.roundNumber + 1 : battle.roundNumber;
      const battleForSkip = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
      const dryadSkip = applySecretOfDryadPassive(room, skipEntry.characterId, battleForSkip, 0);
      if (dryadSkip[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, dryadSkip);
      const efflorescenceMuseSkip = onEfflorescenceMuseTurnStart(room, { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects }, skipEntry.characterId);
      if (efflorescenceMuseSkip) Object.assign(updates, efflorescenceMuseSkip);
      updates[ARENA_PATH.BATTLE_TURN] = { attackerId: skipEntry.characterId, attackerTeam: skipEntry.team, phase: PHASE.SELECT_ACTION };
    } else {
      updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
      updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
      const turnData: Record<string, unknown> = { attackerId: nextEntry.characterId, attackerTeam: nextEntry.team, phase: PHASE.SELECT_ACTION };
      if (selfRes) (turnData as Record<string, unknown>).resurrectTargetId = nextEntry.characterId;
      const battleForDryad = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
      const dryadNext = applySecretOfDryadPassive(room, nextEntry.characterId, battleForDryad, 0);
      if (dryadNext[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, dryadNext);
      const efflorescenceMuseNext = onEfflorescenceMuseTurnStart(room, battleForDryad, nextEntry.characterId);
      if (efflorescenceMuseNext) Object.assign(updates, efflorescenceMuseNext);
      updates[ARENA_PATH.BATTLE_TURN] = turnData;
    }
    await update(roomRef(arenaId), updates);
    return;
  }

  // Proceed: Keraunos Voltage goes to RESOLVING (skip dice); others go to ROLLING_ATTACK. Clear Disoriented D4 fields.
  const isKeraunos = turn.usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE;
  const phaseNext = isKeraunos ? PHASE.RESOLVING : PHASE.ROLLING_ATTACK;
  try {
    const defenderTeam = findFighterTeam(room, defenderId);
    const defenderMinions = defenderTeam ? (room as any)[defenderTeam]?.minions?.filter((m: any) => m.masterId === defenderId) ?? [] : [];
    const turnUpdate: Record<string, unknown> = {
      ...turn,
      defenderId,
      phase: phaseNext,
      disorientedWinFaces: null,
      disorientedRoll: null,
      playbackStep: null,
      resolvingHitIndex: null,
    };
    if (isKeraunos) {
      (turnUpdate as Record<string, unknown>).attackRoll = 0;
      (turnUpdate as Record<string, unknown>).defendRoll = 0;
    }
    if (defenderMinions.length > 0 && !isKeraunos) {
      (turnUpdate as Record<string, unknown>).visualDefenderId = defenderMinions[0].characterId;
    }
    updates[ARENA_PATH.BATTLE_TURN] = turnUpdate;
    updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
    updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
  } catch (e) {
    updates[ARENA_PATH.BATTLE_TURN] = {
      ...turn,
      defenderId,
      phase: phaseNext,
      disorientedWinFaces: null,
      disorientedRoll: null,
      playbackStep: null,
      resolvingHitIndex: null,
    };
  }

  await update(roomRef(arenaId), updates);
}
