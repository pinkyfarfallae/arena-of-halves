import { get, update } from 'firebase/database';
import type { BattleRoom, FighterState } from '../../../types/battle';
import { PHASE, ARENA_PATH, TURN_ACTION } from '../../../constants/battle';
import { POWER_NAMES } from '../../../constants/powers';
import { getEffectiveHealForReceiver, addSunbornSovereignRecoveryStack } from '../../powerEngine/powerEngine';
import { EFFECT_TAGS } from '../../../constants/effectTags';

/** Handle Floral Fragrance heal skip acknowledgment. */
export async function advanceAfterFloralHealSkippedAck(
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
  if (turn?.phase !== PHASE.ROLLING_FLORAL_HEAL || !(turn as any).floralHealSkipped) return;

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
    powerUsed: POWER_NAMES.FLORAL_FRAGRANCE,
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

/** Process Floral Fragrance D4 heal crit roll and apply healing. */
export async function advanceAfterFloralHealD4(
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
    turn?.phase !== PHASE.ROLLING_FLORAL_HEAL ||
    !turn?.floralHealWinFaces?.length ||
    turn.floralHealRoll == null
  )
    return;

  const attackerId = turn.attackerId;
  const allyTargetId = turn.allyTargetId;
  if (!attackerId || !allyTargetId || !battle) return;
  const attacker = findFighter(room, attackerId);
  const ally = findFighter(room, allyTargetId);
  if (!attacker || !ally) return;

  const winFaces = (turn.floralHealWinFaces ?? []).map((f: unknown) => Number(f));
  const roll = Number(turn.floralHealRoll);
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
  const effectsFloral = [...(battle.activeEffects || [])];
  addSunbornSovereignRecoveryStack(room, effectsFloral, attackerId);
  addSunbornSovereignRecoveryStack(room, effectsFloral, allyTargetId);
  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effectsFloral;

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
    powerUsed: POWER_NAMES.FLORAL_FRAGRANCE,
    floralHealCrit: isHealCrit,
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
