import { get, update } from 'firebase/database';
import type { BattleRoom, FighterState, BattleState, TurnQueueEntry } from '../../../types/battle';
import type { ActiveEffect } from '../../../types/power';
import { getQuotaCost } from '../../../types/power';
import { PHASE, ARENA_PATH, BATTLE_TEAM, ROOM_STATUS } from '../../../constants/battle';
import { SEASON_KEYS, type SeasonKey } from '../../../data/seasons';
import { MOD_STAT } from '../../../constants/effectTypes';
import { getStatModifier, applySeasonEffects, isStunned } from '../../powerEngine/powerEngine';

/** Store selected season (triggers visual FX on client before calling confirmSeason). */
export async function selectSeason(
  arenaId: string,
  season: SeasonKey,
  {
    roomRef,
  }: {
    roomRef: (arenaId: string) => any;
  },
): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle?.turn) return;

  const updates: Record<string, unknown> = {
    [ARENA_PATH.BATTLE_TURN_SELECTED_SEASON]: season,
  };

  await update(roomRef(arenaId), updates);
}

/** Cancel season selection: refund quota and return to select-action. */
export async function cancelSeasonSelection(
  arenaId: string,
  {
    roomRef,
    findFighter,
    findFighterPath,
  }: {
    roomRef: (arenaId: string) => any;
    findFighter: (room: BattleRoom, characterId: string) => FighterState | undefined;
    findFighterPath: (room: BattleRoom, characterId: string) => string | null;
  },
): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle?.turn || battle.turn.phase !== PHASE.SELECT_SEASON) return;

  const { attackerId, attackerTeam, usedPowerIndex } = battle.turn;
  const attacker = findFighter(room, attackerId);
  if (!attacker) return;

  const power = attacker.powers?.[usedPowerIndex as number];
  const cost = power ? getQuotaCost(power.type) : 1;
  const atkPath = findFighterPath(room, attackerId);

  const updates: Record<string, unknown> = {};
  if (battle.turn.powerQuotaApplied && atkPath) updates[`${atkPath}/quota`] = attacker.quota + cost;

  updates[ARENA_PATH.BATTLE_TURN] = {
    attackerId,
    attackerTeam,
    phase: PHASE.SELECT_ACTION,
    action: null,
  };

  await update(roomRef(arenaId), updates);
}

/** Confirm season: apply effects, tick effects, check win conditions, advance turn. */
export async function confirmSeason(
  arenaId: string,
  {
    roomRef,
    findFighter,
    findFighterPath,
    getWinningFaces,
    deductPowerQuotaIfPending,
    tickEffectsWithSkeletonBlock,
    sanitizeBattleLog,
    isTeamEliminated,
    buildTurnQueue,
    nextAliveIndex,
    applySelfResurrect,
  }: {
    roomRef: (arenaId: string) => any;
    findFighter: (room: BattleRoom, characterId: string) => FighterState | undefined;
    findFighterPath: (room: BattleRoom, characterId: string) => string | null;
    getWinningFaces: (critRate: number) => number[];
    deductPowerQuotaIfPending: (
      room: BattleRoom,
      turn: any,
      attackerId: string,
      updates: Record<string, unknown>,
      turnUpdate: Record<string, unknown>,
    ) => void;
    tickEffectsWithSkeletonBlock: (
      arenaId: string,
      room: BattleRoom,
      battle: BattleState,
      priorUpdates: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>;
    sanitizeBattleLog: (log: unknown[]) => unknown[];
    isTeamEliminated: (members: FighterState[], activeEffects: ActiveEffect[]) => boolean;
    buildTurnQueue: (room: BattleRoom, activeEffects: ActiveEffect[]) => TurnQueueEntry[];
    nextAliveIndex: (
      queue: TurnQueueEntry[],
      current: number,
      room: BattleRoom,
      effects: ActiveEffect[],
    ) => { index: number; wrapped: boolean };
    applySelfResurrect: (
      characterId: string,
      room: BattleRoom,
      effects: ActiveEffect[],
      updates: Record<string, unknown>,
      battle: BattleState,
    ) => boolean;
  },
): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  let battle = room.battle;
  if (!battle?.turn || battle.turn.phase !== PHASE.SELECT_SEASON) return;

  const { attackerId, attackerTeam, selectedSeason } = battle.turn;
  if (!selectedSeason) return;

  const attacker = findFighter(room, attackerId);
  if (!attacker) return;

  const updates: Record<string, unknown> = {};

  // Spring: special case - roll D4 for heal before advancing turn
  if (selectedSeason === SEASON_KEYS.SPRING) {
    updates[ARENA_PATH.BATTLE_SPRING_CASTER_ID] = attackerId;
    const seasonUpdates = applySeasonEffects(room, attackerId, SEASON_KEYS.SPRING, battle);
    Object.assign(updates, seasonUpdates);
    updates[ARENA_PATH.BATTLE_SPRING_HEAL_ROLL_ACTIVE] = true;
    const baseCritRate = typeof attacker.criticalRate === 'number' ? attacker.criticalRate : 25;
    const critMod = getStatModifier(battle.activeEffects || [], attackerId, MOD_STAT.CRITICAL_RATE);
    const healCritRate = Math.min(100, Math.max(0, baseCritRate + critMod));
    const winFaces = getWinningFaces(healCritRate);
    const turnSpring: Record<string, unknown> = {
      attackerId,
      attackerTeam,
      phase: PHASE.ROLLING_SPRING_HEAL,
      selectedSeason,
      springHealWinFaces: winFaces,
      springRound: 1,
    };
    deductPowerQuotaIfPending(room, battle.turn, attackerId, updates, turnSpring);
    updates[ARENA_PATH.BATTLE_TURN] = turnSpring;
    await update(roomRef(arenaId), updates);
    return;
  }

  deductPowerQuotaIfPending(room, battle.turn, attackerId, updates, {});

  // Apply season effects to all alive teammates (summer, autumn, winter)
  const seasonUpdates = applySeasonEffects(room, attackerId, selectedSeason, battle);
  Object.assign(updates, seasonUpdates);

  // Sync activeEffects into battle for tickEffects
  if (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) {
    battle = { ...battle, activeEffects: updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] };
  }

  // Tick active effects (DOT damage, spring heal, decrement durations)
  const effectUpdates = await tickEffectsWithSkeletonBlock(arenaId, room, battle, updates);
  Object.assign(updates, effectUpdates);

  // Battle log entry
  const seasonLabel = selectedSeason.charAt(0).toUpperCase() + selectedSeason.slice(1);
  const logEntry = {
    round: battle.roundNumber,
    attackerId,
    defenderId: attackerId,
    attackRoll: 0,
    defendRoll: 0,
    damage: 0,
    defenderHpAfter: attacker.currentHp,
    eliminated: false,
    missed: false,
    powerUsed: `Ephemeral Season: ${seasonLabel}`,
  };
  updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), logEntry]);

  // Build updated HP map for win condition check
  const getHp = (m: FighterState) => {
    const path = findFighterPath(room, m.characterId);
    if (path && `${path}/currentHp` in updates) return updates[`${path}/currentHp`] as number;
    return m.currentHp;
  };
  const teamAMembers = (room.teamA?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
  const teamBMembers = (room.teamB?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));

  const latestEffects = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || battle.activeEffects || [];

  const END_ARENA_DELAY_MS = 3500;
  if (isTeamEliminated(teamBMembers, latestEffects)) {
    updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam, phase: PHASE.DONE };
    updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
    await update(roomRef(arenaId), updates);
    setTimeout(() => {
      update(roomRef(arenaId), {
        [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.A,
        [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
        [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
      }).catch(() => {});
    }, END_ARENA_DELAY_MS);
    return;
  }

  if (isTeamEliminated(teamAMembers, latestEffects)) {
    updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam, phase: PHASE.DONE };
    updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
    await update(roomRef(arenaId), updates);
    setTimeout(() => {
      update(roomRef(arenaId), {
        [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.B,
        [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
        [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
      }).catch(() => {});
    }, END_ARENA_DELAY_MS);
    return;
  }

  const updatedRoom = {
    ...room,
    teamA: { ...room.teamA, members: teamAMembers },
    teamB: { ...room.teamB, members: teamBMembers },
  } as BattleRoom;
  const updatedQueue = buildTurnQueue(updatedRoom, latestEffects);
  updates[ARENA_PATH.BATTLE_TURN_QUEUE] = updatedQueue;

  const currentAttackerIdx = updatedQueue.findIndex(e => e.characterId === attackerId);
  const fromIdx = currentAttackerIdx !== -1 ? currentAttackerIdx : battle.currentTurnIndex;

  const { index: nextIdx, wrapped } = nextAliveIndex(updatedQueue, fromIdx, updatedRoom, latestEffects);
  const nextEntry = updatedQueue[nextIdx];

  const selfRes2 = applySelfResurrect(nextEntry.characterId, updatedRoom, latestEffects, updates, battle);

  const nextFighter = findFighter(updatedRoom, nextEntry.characterId);
  if (nextFighter && !selfRes2 && isStunned(latestEffects, nextEntry.characterId)) {
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;

    const { index: skipIdx, wrapped: skipWrapped } = nextAliveIndex(updatedQueue, nextIdx, updatedRoom, latestEffects);
    const skipEntry = updatedQueue[skipIdx];
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdx;
    if (skipWrapped)
      updates[ARENA_PATH.BATTLE_ROUND_NUMBER] =
        ((updates[ARENA_PATH.BATTLE_ROUND_NUMBER] as number) || battle.roundNumber) + 1;
    updates[ARENA_PATH.BATTLE_TURN] = {
      attackerId: skipEntry.characterId,
      attackerTeam: skipEntry.team,
      phase: PHASE.SELECT_ACTION,
    };
  } else {
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
    const turnData: Record<string, unknown> = {
      attackerId: nextEntry.characterId,
      attackerTeam: nextEntry.team,
      phase: PHASE.SELECT_ACTION,
    };
    if (selfRes2) turnData.resurrectTargetId = nextEntry.characterId;
    updates[ARENA_PATH.BATTLE_TURN] = turnData;
  }

  await update(roomRef(arenaId), updates);
}
