import { get, update } from 'firebase/database';
import type { BattleRoom, FighterState } from '../../../types/battle';
import type { ActiveEffect } from '../../../types/power';
import { EFFECT_TYPES } from '../../../constants/effectTypes';
import { POWER_NAMES } from '../../../constants/powers';
import { PHASE, ARENA_PATH } from '../../../constants/battle';

export async function submitRapidFireD4Roll(
  arenaId: string,
  roll: number,
  {
    roomRef,
    findFighter,
    findFighterPath,
    resolveHitAtDefender,
    sanitizeBattleLog,
    resolveTurn,
  }: {
    roomRef: (arenaId: string) => any;
    findFighter: (room: BattleRoom, characterId: string) => FighterState | undefined;
    findFighterPath: (room: BattleRoom, characterId: string) => string | null;
    resolveHitAtDefender: (
      arenaId: string,
      room: BattleRoom,
      defenderId: string,
      incomingDamage: number,
      updates: Record<string, unknown>,
      defender: FighterState,
    ) => Promise<{ damageToMaster: number; hitTargetId: string; skippedMinionsPath?: string }>;
    sanitizeBattleLog: (log: unknown[]) => unknown[];
    resolveTurn: (arenaId: string, options?: any) => Promise<void>;
  },
): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  const turn = battle?.turn;
  if (!turn || turn.phase !== PHASE.ROLLING_RAPID_FIRE_EXTRA_SHOT) return;
  const winFaces = ((turn as any).rapidFireWinFaces as number[]) ?? [];
  const baseDmg = Number((turn as any).rapidFireBaseDmg) ?? 0;
  const isCrit = !!(turn as any).rapidFireIsCrit;
  const defenderId = turn.defenderId;
  const attackerId = turn.attackerId;
  if (!attackerId || !defenderId || baseDmg <= 0) return;

  const defender = findFighter(room, defenderId);
  const attacker = findFighter(room, attackerId);
  if (!defender || !attacker) return;
  if (defender.currentHp <= 0) {
    const turnUpdates: Record<string, unknown> = {
      ...turn,
      phase: PHASE.RESOLVING_AFTER_RAPID_FIRE,
      rapidFireDefTotal: (turn as any).rapidFireDefTotal,
      rapidFireStep: null,
      rapidFireWinFaces: null,
      rapidFireBaseDmg: null,
      rapidFireIsCrit: null,
      rapidFireD4Roll: null,
    };
    await update(roomRef(arenaId), { [ARENA_PATH.BATTLE_TURN]: turnUpdates });
    await resolveTurn(arenaId);
    return;
  }

  const hit = winFaces.length > 0 && winFaces.includes(roll);
  const updates: Record<string, unknown> = {};

  if (!hit) {
    const turnUpdates: Record<string, unknown> = {
      ...turn,
      phase: PHASE.RESOLVING_AFTER_RAPID_FIRE,
      rapidFireDefTotal: (turn as any).rapidFireDefTotal,
      rapidFireStep: null,
      rapidFireWinFaces: null,
      rapidFireBaseDmg: null,
      rapidFireIsCrit: null,
      rapidFireD4Roll: roll,
    };
    updates[ARENA_PATH.BATTLE_TURN] = turnUpdates;
    await update(roomRef(arenaId), updates);
    await resolveTurn(arenaId);
    return;
  }

  let rawDmgRF = Math.ceil(baseDmg * 0.5);
  if (isCrit) rawDmgRF *= 2;
  const defPathRF = findFighterPath(room, defenderId);
  const defenderHpBeforeRF = defender.currentHp;
  const defenderForRF: FighterState = { ...defender, currentHp: defenderHpBeforeRF };
  const resolveRF = await resolveHitAtDefender(arenaId, room, defenderId, rawDmgRF, updates, defenderForRF);
  if (resolveRF.skippedMinionsPath) delete updates[resolveRF.skippedMinionsPath];
  rawDmgRF = resolveRF.damageToMaster;
  let shieldRemainingRF = rawDmgRF;
  const activeEffects = battle.activeEffects || [];
  const effectsForShieldRF = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? [...activeEffects];
  for (const se of effectsForShieldRF) {
    if (se.targetId !== defenderId || se.effectType !== EFFECT_TYPES.SHIELD) continue;
    if (shieldRemainingRF <= 0) break;
    const absorbedRF = Math.min(se.value, shieldRemainingRF);
    se.value -= absorbedRF;
    shieldRemainingRF -= absorbedRF;
  }
  const dmgRF = shieldRemainingRF;
  const newDefHpRF = Math.max(0, defenderHpBeforeRF - dmgRF);
  if (defPathRF) updates[`${defPathRF}/currentHp`] = newDefHpRF;
  const cleanedRF = effectsForShieldRF.filter(
    (e: ActiveEffect) => !(e.effectType === EFFECT_TYPES.SHIELD && e.value <= 0 && !e.tag),
  );
  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = cleanedRF;

  const rapidFireLog = [
    ...(battle.log || []),
    {
      round: battle.roundNumber,
      attackerId,
      defenderId,
      attackRoll: 0,
      defendRoll: 0,
      damage: dmgRF,
      defenderHpAfter: newDefHpRF,
      eliminated: newDefHpRF <= 0,
      missed: false,
      rapidFire: true,
      rapidFireNoDefend: true,
      rapidFireD4Roll: roll,
      powerUsed: POWER_NAMES.VOLLEY_ARROW,
      ...(isCrit ? { isCrit: true } : {}),
    },
  ];
  updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog(rapidFireLog);

  if (newDefHpRF <= 0) {
    updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
    updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = defenderId;
  }
  const turnUpdates: Record<string, unknown> = {
    ...turn,
    phase: PHASE.RESOLVING_RAPID_FIRE_EXTRA_SHOT,
    rapidFireD4Roll: roll,
    rapidFireExtraShotDamage: dmgRF,
    rapidFireExtraShotBaseDmg: rawDmgRF,
    rapidFireExtraShotIsCrit: isCrit,
    ...(newDefHpRF <= 0 ? { rapidFireExtraShotEliminated: true } : {}),
  };
  updates[ARENA_PATH.BATTLE_TURN] = turnUpdates;
  await update(roomRef(arenaId), updates);
}

/** After client has shown the extra-shot damage card (RESOLVING_RAPID_FIRE_EXTRA_SHOT), advance to next D4 roll or end chain (or resolveTurn if that shot eliminated defender). */
export async function advanceToNextRapidFireStep(
  arenaId: string,
  {
    roomRef,
    findFighter,
    applyImmediateResurrection,
  }: {
    roomRef: (arenaId: string) => any;
    findFighter: (room: BattleRoom, characterId: string) => FighterState | undefined;
    applyImmediateResurrection: (characterId: string, room: BattleRoom, effects: ActiveEffect[], updates: Record<string, unknown>, battle: any) => boolean;
  },
): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  const turn = battle?.turn;
  if (!turn || turn.phase !== PHASE.RESOLVING_RAPID_FIRE_EXTRA_SHOT) return;

  const defenderId = turn.defenderId;
  const eliminated = !!(turn as any).rapidFireExtraShotEliminated;
  const defender = defenderId ? findFighter(room, defenderId) : null;
  const defenderDead = eliminated || (defender != null && defender.currentHp <= 0);

  if (defenderDead && defender && defenderId) {
    const updates: Record<string, unknown> = {};
    let activeEffects = battle.activeEffects || [];
    const wasResurrected = applyImmediateResurrection(defenderId, room, activeEffects, updates, battle);

    if (wasResurrected) {
      updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = activeEffects;

      const step = Number((turn as any).rapidFireStep) ?? 0;
      const rapidFireChances = [0.75, 0.5, 0.25];
      const nextStep = step + 1;
      const nextChance = nextStep < rapidFireChances.length ? rapidFireChances[nextStep] : 0.25;
      const nextWinFaces = nextChance >= 0.75 ? [2, 3, 4] : nextChance >= 0.5 ? [3, 4] : [4];

      const turnUpdates: Record<string, unknown> = {
        ...turn,
        phase: PHASE.ROLLING_RAPID_FIRE_EXTRA_SHOT,
        rapidFireStep: nextStep,
        rapidFireWinFaces: nextWinFaces,
        rapidFireD4Roll: null,
        rapidFireExtraShotDamage: null,
        rapidFireExtraShotBaseDmg: null,
        rapidFireExtraShotIsCrit: null,
        immediateResurrections: [defenderId],
      };
      updates[ARENA_PATH.BATTLE_TURN] = turnUpdates;
      await update(roomRef(arenaId), updates);
      return;
    }

    const turnUpdates: Record<string, unknown> = {
      ...turn,
      phase: PHASE.RESOLVING_RAPID_FIRE_EXTRA_SHOT,
      rapidFireSkippedAwaitsAck: true,
      rapidFireDefTotal: (turn as any).rapidFireDefTotal,
      rapidFireStep: null,
      rapidFireWinFaces: null,
      rapidFireBaseDmg: null,
      rapidFireIsCrit: null,
      rapidFireD4Roll: null,
      rapidFireExtraShotDamage: null,
      rapidFireExtraShotBaseDmg: null,
      rapidFireExtraShotIsCrit: null,
      rapidFireExtraShotEliminated: true,
    };
    await update(roomRef(arenaId), { [ARENA_PATH.BATTLE_TURN]: turnUpdates });
    return;
  }

  const step = Number((turn as any).rapidFireStep) ?? 0;
  const rapidFireChances = [0.75, 0.5, 0.25];
  const nextStep = step + 1;
  const nextChance = nextStep < rapidFireChances.length ? rapidFireChances[nextStep] : 0.25;
  const nextWinFaces = nextChance >= 0.75 ? [2, 3, 4] : nextChance >= 0.5 ? [3, 4] : [4];

  const turnUpdates: Record<string, unknown> = {
    ...turn,
    phase: PHASE.ROLLING_RAPID_FIRE_EXTRA_SHOT,
    rapidFireStep: nextStep,
    rapidFireWinFaces: nextWinFaces,
    rapidFireD4Roll: null,
    rapidFireExtraShotDamage: null,
    rapidFireExtraShotBaseDmg: null,
    rapidFireExtraShotIsCrit: null,
  };
  await update(roomRef(arenaId), { [ARENA_PATH.BATTLE_TURN]: turnUpdates });
}

/**
 * After client acknowledges Rapid Fire was skipped (extra shots skipped because defender was eliminated).
 * Clears ack and runs turn advance.
 */
export async function advanceAfterRapidFireSkippedAck(
  arenaId: string,
  {
    roomRef,
    resolveTurn,
  }: {
    roomRef: (arenaId: string) => any;
    resolveTurn: (arenaId: string, options?: any) => Promise<void>;
  },
): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  const turn = battle?.turn;
  if (!turn || turn.phase !== PHASE.RESOLVING_RAPID_FIRE_EXTRA_SHOT) return;
  if (!(turn as any).rapidFireSkippedAwaitsAck) return;

  const tObj = { ...turn } as Record<string, unknown>;
  delete tObj.rapidFireSkippedAwaitsAck;
  const turnUpdates: Record<string, unknown> = {
    ...tObj,
    phase: PHASE.RESOLVING_AFTER_RAPID_FIRE,
  };
  await update(roomRef(arenaId), { [ARENA_PATH.BATTLE_TURN]: turnUpdates });
  await resolveTurn(arenaId);
}
