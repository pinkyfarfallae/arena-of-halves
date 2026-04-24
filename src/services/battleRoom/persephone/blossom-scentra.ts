import { get, update } from 'firebase/database';
import type { BattleRoom, FighterState } from '../../../types/battle';
import { PHASE, ARENA_PATH, TURN_ACTION } from '../../../constants/battle';
import { POWER_NAMES } from '../../../constants/powers';
import { getEffectiveHealForReceiver, addSunbornSovereignRecoveryStack } from '../../powerEngine/powerEngine';
import { EFFECT_TAGS } from '../../../constants/effectTags';

/** Handle Blossom Scentra heal skip acknowledgment. */
export async function advanceAfterBlossomScentraHealSkippedAck(
  arenaId: string,
  {
    roomRef,
    findFighter,
    sanitizeBattleLog,
  }: {
    roomRef: (arenaId: string) => any;
    findFighter: (room: BattleRoom, characterId: string) => FighterState | undefined;
    sanitizeBattleLog: (log: unknown[]) => unknown[];
  },
): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  const turn = battle?.turn;
  if (turn?.phase !== PHASE.ROLLING_BLOSSOM_SCENTRA_HEAL || !(turn as any).blossomHealSkipped) return;

  const attackerId = turn.attackerId;
  const allyTargetId = turn.allyTargetId;
  if (!attackerId || !allyTargetId || !battle) return;
  const ally = findFighter(room, allyTargetId);
  if (!ally) return;

  const healSkipReason = (turn as any).healSkipReason as string | undefined;
  const logEntry = {
    round: battle.roundNumber,
    attackerId,
    defenderId: allyTargetId,
    attackRoll: 0,
    defendRoll: 0,
    damage: 0,
    heal: 0,
    defenderHpAfter: ally.currentHp,
    eliminated: false,
    missed: false,
    powerUsed: POWER_NAMES.BLOSSOM_SCENTRA,
    healSkipReason: healSkipReason ?? EFFECT_TAGS.HEALING_NULLIFIED,
  };
  const updates: Record<string, unknown> = {
    [ARENA_PATH.BATTLE_LOG]: sanitizeBattleLog([...(battle.log || []), logEntry]),
    [ARENA_PATH.BATTLE_TURN]: {
      attackerId,
      attackerTeam: turn.attackerTeam,
      phase: PHASE.SELECT_TARGET,
      action: TURN_ACTION.ATTACK,
      usedPowerIndex: turn.usedPowerIndex,
      usedPowerName: turn.usedPowerName,
      allyTargetId,
    },
  };
  await update(roomRef(arenaId), updates);
}

/** Process Blossom Scentra D4 heal crit roll and apply healing. */
export async function advanceAfterBlossomScentraHealD4(
  arenaId: string,
  {
    roomRef,
    findFighter,
    findFighterPath,
    sanitizeBattleLog,
  }: {
    roomRef: (arenaId: string) => any;
    findFighter: (room: BattleRoom, characterId: string) => FighterState | undefined;
    findFighterPath: (room: BattleRoom, characterId: string) => string | null;
    sanitizeBattleLog: (log: unknown[]) => unknown[];
  },
): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  const turn = battle?.turn;
  if (
    turn?.phase !== PHASE.ROLLING_BLOSSOM_SCENTRA_HEAL ||
    !turn?.blossomHealWinFaces?.length ||
    turn.blossomHealRoll == null
  )
    return;

  const attackerId = turn.attackerId;
  const allyTargetId = turn.allyTargetId;
  if (!attackerId || !allyTargetId || !battle) return;
  const attacker = findFighter(room, attackerId);
  const ally = findFighter(room, allyTargetId);
  if (!attacker || !ally) return;

  const winFaces = (turn.blossomHealWinFaces ?? []).map((f: unknown) => Number(f));
  const roll = Number(turn.blossomHealRoll);
  const isHealCrit = Number.isFinite(roll) && roll >= 1 && roll <= 4 && winFaces.includes(roll);
  const baseHeal = Math.ceil(0.2 * attacker.maxHp);
  const actualHeal = getEffectiveHealForReceiver(
    isHealCrit ? baseHeal * 2 : baseHeal,
    ally,
    allyTargetId,
    battle.activeEffects || [],
  );
  const allyPath = findFighterPath(room, allyTargetId);
  const newHp = Math.min(ally.currentHp + actualHeal, ally.maxHp);
  const updates: Record<string, unknown> = {};
  if (allyPath) updates[`${allyPath}/currentHp`] = newHp;

  // Sunborn Sovereign: on create or receive healing, gain recovery stack (max 2)
  const effectsBlossomScentra = [...(battle.activeEffects || [])];
  addSunbornSovereignRecoveryStack(room, effectsBlossomScentra, attackerId);
  addSunbornSovereignRecoveryStack(room, effectsBlossomScentra, allyTargetId);
  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effectsBlossomScentra;

  const logEntry = {
    round: battle.roundNumber,
    attackerId,
    defenderId: allyTargetId,
    attackRoll: 0,
    defendRoll: 0,
    damage: 0,
    heal: actualHeal,
    defenderHpAfter: newHp,
    eliminated: false,
    missed: false,
    powerUsed: POWER_NAMES.BLOSSOM_SCENTRA,
    blossomScentraHealCrit: isHealCrit,
  };
  updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle!.log || []), logEntry]);
  updates[ARENA_PATH.BATTLE_TURN] = {
    attackerId,
    attackerTeam: turn.attackerTeam,
    phase: PHASE.SELECT_TARGET,
    action: TURN_ACTION.ATTACK,
    usedPowerIndex: turn.usedPowerIndex,
    usedPowerName: turn.usedPowerName,
    allyTargetId,
  };
  await update(roomRef(arenaId), updates);
}
