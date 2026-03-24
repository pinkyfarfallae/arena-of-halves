import { get, update } from 'firebase/database';
import type { ActiveEffect, PowerDefinition } from '../../../../types/power';
import type { BattleRoom } from '../../../../types/battle';
import { EFFECT_TAGS } from '../../../../constants/effectTags';
import { EFFECT_TYPES, TARGET_TYPES } from '../../../../constants/effectTypes';
import { PHASE, ARENA_PATH } from '../../../../constants/battle';

/**
 * True if the character has an active Soul Devourer effect (Hades).
 */
export function hasSoulDevourerEffect(activeEffects: ActiveEffect[] | undefined, characterId: string): boolean {
  return (activeEffects || []).some(
    e => e.targetId === characterId && e.tag === EFFECT_TAGS.SOUL_DEVOURER,
  );
}

/**
 * True if the power can be used to "attack" (enemy target, damage/lifesteal) for Soul Devourer drain.
 */
export function powerCanAttack(power: PowerDefinition): boolean {
  return (
    power.target === TARGET_TYPES.ENEMY &&
    (power.effect === EFFECT_TYPES.DAMAGE || power.effect === EFFECT_TYPES.LIFESTEAL)
  );
}

/**
 * Advance after caster acknowledges Soul Devourer "heal skipped" (e.g. caster has Healing Nullified).
 * Clears soulDevourerHealSkipAwaitsAck so skeleton hits can start on next resolveTurn.
 */
export async function advanceAfterSoulDevourerHealSkippedAck(
  arenaId: string,
  { roomRef }: { roomRef: (arenaId: string) => any },
): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  const turn = battle?.turn;
  if (turn?.phase !== PHASE.RESOLVING || !(turn as any).soulDevourerHealSkipAwaitsAck) return;

  const turnObj = turn as unknown as Record<string, unknown>;
  const { soulDevourerHealSkipAwaitsAck: _, ...turnWithoutAck } = turnObj;
  await update(roomRef(arenaId), { [ARENA_PATH.BATTLE_TURN]: turnWithoutAck });
}
