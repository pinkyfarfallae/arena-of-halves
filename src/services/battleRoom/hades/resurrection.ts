import { get } from 'firebase/database';
import type { ActiveEffect } from '../../../types/power';
import type { BattleRoom, BattleState, FighterState, TurnState } from '../../../types/battle';
import { EFFECT_TAGS } from '../../../constants/effectTags';
import { POWER_NAMES } from '../../../constants/powers';
import { EFFECT_TYPES } from '../../../constants/effectTypes';
import { PHASE, ARENA_PATH } from '../../../constants/battle';

/**
 * Apply self-resurrect if next fighter is dead with death-keeper.
 * Mutates `updates` and `effects` in place. Returns true if resurrection happened.
 */
export function applySelfResurrect(
  nextCharId: string,
  room: BattleRoom,
  effects: ActiveEffect[],
  updates: Record<string, unknown>,
  battle: { roundNumber: number; log: unknown[] },
  { findFighter, findFighterPath }: {
    findFighter: (room: BattleRoom, characterId: string) => FighterState | undefined;
    findFighterPath: (room: BattleRoom, characterId: string) => string | null;
  },
): boolean {
  const fighter = findFighter(room, nextCharId);
  if (!fighter || fighter.currentHp > 0) return false;

  const dkIdx = effects.findIndex(e => e.targetId === nextCharId && e.tag === EFFECT_TAGS.DEATH_KEEPER);
  if (dkIdx === -1) return false;

  // Resurrect at 50% max HP
  const resHp = Math.ceil(fighter.maxHp * 0.5);
  const fPath = findFighterPath(room, nextCharId);
  if (fPath) updates[`${fPath}/currentHp`] = resHp;

  // Consume death-keeper, add resurrected tag
  effects.splice(dkIdx, 1);
  effects.push({
    id: `${nextCharId}::Death Keeper Risen`,
    powerName: POWER_NAMES.DEATH_KEEPER,
    effectType: EFFECT_TYPES.BUFF,
    sourceId: nextCharId,
    targetId: nextCharId,
    value: 0,
    turnsRemaining: 999,
    tag: EFFECT_TAGS.RESURRECTED,
  });
  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effects;

  // Clear stun on the resurrected fighter (death resets debuffs)
  const stunIdx = effects.findIndex(e => e.targetId === nextCharId && e.tag === EFFECT_TAGS.STUN);
  if (stunIdx !== -1) effects.splice(stunIdx, 1);

  return true;
}

/**
 * Check and apply immediate auto-resurrection for Hades son (Death Keeper holder) when they die.
 * Called immediately after damage is applied. Mutates `updates` and `effects` in place.
 * Returns true if resurrection happened.
 */
export function applyImmediateResurrection(
  characterId: string,
  room: BattleRoom,
  effects: ActiveEffect[],
  updates: Record<string, unknown>,
  battle: { roundNumber: number; log: unknown[] },
  { findFighter, findFighterPath, sanitizeBattleLog }: {
    findFighter: (room: BattleRoom, characterId: string) => FighterState | undefined;
    findFighterPath: (room: BattleRoom, characterId: string) => string | null;
    sanitizeBattleLog: (log: unknown[]) => unknown[];
  },
): boolean {
  const fPath = findFighterPath(room, characterId);
  if (!fPath) return false;
  
  // Check current HP from updates or room state
  const currentHp = (`${fPath}/currentHp` in updates)
    ? (updates[`${fPath}/currentHp`] as number)
    : (findFighter(room, characterId)?.currentHp ?? 0);
    
  if (currentHp > 0) return false;

  const dkIdx = effects.findIndex(e => e.targetId === characterId && e.tag === EFFECT_TAGS.DEATH_KEEPER);
  if (dkIdx === -1) return false;

  // Resurrect at 50% max HP immediately
  const fighter = findFighter(room, characterId);
  if (!fighter) return false;
  
  const resHp = Math.ceil(fighter.maxHp * 0.5);
  updates[`${fPath}/currentHp`] = resHp;

  // Consume death-keeper, add resurrected tag
  effects.splice(dkIdx, 1);
  effects.push({
    id: `${characterId}::Death Keeper Risen`,
    powerName: POWER_NAMES.DEATH_KEEPER,
    effectType: EFFECT_TYPES.BUFF,
    sourceId: characterId,
    targetId: characterId,
    value: 0,
    turnsRemaining: 999,
    tag: EFFECT_TAGS.RESURRECTED,
  });
  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effects;

  // Clear stun on the resurrected fighter (death resets debuffs)
  const stunIdx = effects.findIndex(e => e.targetId === characterId && e.tag === EFFECT_TAGS.STUN);
  if (stunIdx !== -1) effects.splice(stunIdx, 1);

  // Log the resurrection
  const logEntry = {
    round: battle.roundNumber,
    attackerId: characterId,
    defenderId: characterId,
    attackRoll: 0,
    defendRoll: 0,
    damage: 0,
    defenderHpAfter: resHp,
    eliminated: false,
    missed: false,
    powerUsed: POWER_NAMES.DEATH_KEEPER,
  };
  const updatedLog = [...(battle.log || []), logEntry];
  updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog(updatedLog);

  return true;
}

/**
 * Advance from RESURRECTING phase to next fighter's turn.
 * Called after resurrection modal has been shown for 1 second (or acknowledged).
 */
export async function advanceAfterResurrection(
  arenaId: string,
  { roomRef, runBattleResolveTailFromEffectSync }: {
    roomRef: (arenaId: string) => any;
    runBattleResolveTailFromEffectSync: (arenaId: string, room: BattleRoom, battle: BattleState, updates: Record<string, unknown>, context: any) => Promise<void>;
  },
): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  const turn = battle?.turn;
  if (!turn || turn.phase !== PHASE.RESURRECTING) return;

  const resurrectContext = (turn as any).resurrectContext;
  if (!resurrectContext) {
    // Fallback: just advance to next turn
    const updates: Record<string, unknown> = {};
    await runBattleResolveTailFromEffectSync(arenaId, room, battle, updates, {
      attackerId: turn.attackerId,
      defenderId: turn.attackerId, // fallback
      attackRoll: 0,
      defendRoll: 0,
      turn: turn as TurnState,
      activeEffectsBaseline: battle.activeEffects || [],
    });
    return;
  }

  // Continue with turn advance using preserved context
  const { attackerId, defenderId, attackRoll, defendRoll, action } = resurrectContext;
  const updates: Record<string, unknown> = {};
  
  // Continue from where we left off (Spring heals, win check, turn advance)
  await runBattleResolveTailFromEffectSync(arenaId, room, battle, updates, {
    attackerId,
    defenderId,
    attackRoll,
    defendRoll,
    action,
    turn: turn as TurnState,
    activeEffectsBaseline: battle.activeEffects || [],
  });
}
