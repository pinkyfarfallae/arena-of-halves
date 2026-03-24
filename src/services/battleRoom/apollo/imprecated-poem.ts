import { get, update } from 'firebase/database';
import type { BattleRoom, FighterState } from '../../../types/battle';
import { getQuotaCost } from '../../../types/power';
import { IMPRECATED_POEM_VERSE_TAGS } from '../../../constants/effectTags';
import { PHASE, ARENA_PATH, TURN_ACTION } from '../../../constants/battle';

/** Confirm poem verse (Imprecated Poem): store selection and go to select target. */
export async function confirmPoem(
  arenaId: string,
  poemTag: string,
  {
    roomRef,
  }: {
    roomRef: (arenaId: string) => any;
  },
): Promise<void> {
  if (!IMPRECATED_POEM_VERSE_TAGS.includes(poemTag as typeof IMPRECATED_POEM_VERSE_TAGS[number])) return;

  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle?.turn || battle.turn.phase !== PHASE.SELECT_POEM) return;

  const { attackerId, attackerTeam, usedPowerIndex, usedPowerName } = battle.turn;

  const updates: Record<string, unknown> = {
    [ARENA_PATH.BATTLE_TURN]: {
      attackerId,
      attackerTeam,
      phase: PHASE.SELECT_TARGET,
      action: TURN_ACTION.POWER,
      usedPowerIndex,
      usedPowerName,
      selectedPoem: poemTag,
    },
  };

  await update(roomRef(arenaId), updates);
}

/** Cancel poem selection: refund quota and go back to select-action. */
export async function cancelPoemSelection(
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
  if (!battle?.turn || battle.turn.phase !== PHASE.SELECT_POEM) return;

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
