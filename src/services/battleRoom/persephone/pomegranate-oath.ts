import { get, update } from 'firebase/database';
import type { BattleRoom, FighterState } from '../../../types/battle';
import { PHASE, ARENA_PATH, effectivePomCoAttackerId, effectivePomCoDefenderId } from '../../../constants/battle';
import { POWER_NAMES } from '../../../constants/powers';
import { MOD_STAT } from '../../../constants/effectTypes';
import { getStatModifier } from '../../powerEngine/powerEngine';

/** Append a dedicated battle-log row for Pomegranate co-attack (main hit stays its own row). */
export function appendPomegranateCoAttackLog(
  logArr: any[],
  opts: {
    round: number;
    coAttackerId: string;
    defenderId: string;
    coRoll: number;
    defendRoll: number;
    coAtkTotal: number;
    coDefTotal: number;
    hit: boolean;
    damage: number;
    defenderHpAfter: number;
    hitTargetId?: string;
  },
): any[] {
  const e: Record<string, unknown> = {
    round: opts.round,
    attackerId: opts.coAttackerId,
    defenderId: opts.defenderId,
    attackRoll: opts.coRoll,
    defendRoll: opts.defendRoll,
    missed: !opts.hit,
    damage: opts.hit ? opts.damage : 0,
    defenderHpAfter: opts.defenderHpAfter,
    eliminated: opts.defenderHpAfter <= 0,
    powerUsed: `${POWER_NAMES.POMEGRANATES_OATH} (Co-Attack)`,
    isPomegranateCoAttack: true,
    coAtkTotal: opts.coAtkTotal,
    coDefTotal: opts.coDefTotal,
  };
  if (opts.hitTargetId) e.hitTargetId = opts.hitTargetId;
  return [...logArr, e];
}

/** After client acknowledges Pomegranate co-attack was skipped (main hit eliminated the target). */
export async function advanceAfterPomegranateCoSkippedAck(
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
  if (!turn || turn.phase !== PHASE.RESOLVING || !(turn as any).pomegranateCoSkippedAwaitsAck) return;

  // Clear the acknowledgment flag and set pomegranateCoTailReady to advance turn
  const tBase = { ...turn } as Record<string, unknown>;
  delete tBase.pomegranateCoSkippedAwaitsAck;
 delete tBase.pomegranateDeferredCtx;
  delete tBase.awaitingPomegranateCoAttack;
  delete tBase.coAttackRoll;
  delete tBase.coDefendRoll;
  delete tBase.pomCoAttackerId;
  delete tBase.pomCoDefenderId;
  delete tBase.coAttackerId;
  delete tBase.playbackStep;
  delete tBase.resolvingHitIndex;

  // Set pomegranateCoTailReady so resolveTurn advances the turn
  tBase.pomegranateCoTailReady = true;

  await update(roomRef(arenaId), { [ARENA_PATH.BATTLE_TURN]: tBase });
  await resolveTurn(arenaId);
}

/** After main Pomegranate hit card, enter co-attack phase (D12 for oath caster). */
export async function advanceToPomegranateCoAttackPhase(
  arenaId: string,
  {
    roomRef,
    findFighter,
    applyDeferredPomegranateCoContinue,
  }: {
    roomRef: (arenaId: string) => any;
    findFighter: (room: BattleRoom, characterId: string) => FighterState | undefined;
    applyDeferredPomegranateCoContinue: (
      arenaId: string,
      room: BattleRoom,
      battle: any,
      attacker: FighterState,
      defender: FighterState,
      turn: any,
    ) => Promise<void>;
  },
): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  const turn = battle?.turn;
  if (!turn) return;
  if (!turn.awaitingPomegranateCoAttack || !turn.pomegranateDeferredCtx) return;
  if (turn.phase !== PHASE.RESOLVING) return;
  if (turn.coAttackRoll != null && turn.coAttackRoll > 0) return;

  const defIdEarly = turn.defenderId;
  if (defIdEarly) {
    const defEarly = findFighter(room, defIdEarly);
    if (defEarly && defEarly.currentHp <= 0 && turn.attackerId) {
      const attEarly = findFighter(room, turn.attackerId);
      if (attEarly && battle) {
        await applyDeferredPomegranateCoContinue(arenaId, room, battle, attEarly, defEarly, turn);
      }
      return;
    }
  }

  const pomAtk = effectivePomCoAttackerId(turn) ?? turn.coAttackerId ?? null;
  const pomDef = effectivePomCoDefenderId(turn) ?? null;

  await update(roomRef(arenaId), {
    [ARENA_PATH.BATTLE_TURN]: {
      ...turn,
      phase: PHASE.ROLLING_POMEGRANATE_CO_ATTACK,
      coAttackerId: pomAtk,
      pomCoAttackerId: pomAtk,
      pomCoDefenderId: pomDef,
      critRoll: null,
      isCrit: null,
      critWinFaces: null,
      dodgeRoll: null,
      isDodged: null,
      dodgeWinFaces: null,
      chainRoll: null,
      chainSuccess: null,
      chainWinFaces: null,
    },
  });
}

/** Quota refill after Pomegranate co-attack dice shown (co-attacker rolls ≥11 → refill). */
export async function ackPomegranateCoAttackDiceShown(
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
  const turn = battle?.turn;
  if (!turn || turn.coAttackRoll == null) return;
  if ((turn as unknown as Record<string, unknown>).coAttackQuotaRefilled) {
    return;
  }

  const coAttackerId = effectivePomCoAttackerId(turn);
  if (!coAttackerId) {
    return;
  }
  const coAttacker = findFighter(room, coAttackerId);
  if (!coAttacker) {
    return;
  }

  const activeEffects = battle?.activeEffects || [];
  const coAtkBuff = getStatModifier(activeEffects, coAttackerId, MOD_STAT.ATTACK_DICE_UP);
  const coAtkRecovery = getStatModifier(activeEffects, coAttackerId, MOD_STAT.RECOVERY_DICE_UP);
  const total = (turn.coAttackRoll ?? 0) + coAttacker.attackDiceUp + coAtkBuff + coAtkRecovery;
  const turnWithFlag = { ...turn, coAttackQuotaRefilled: true } as Record<string, unknown>;
  if (total < 11 || coAttacker.quota >= (coAttacker.maxQuota ?? 0)) {
    await update(roomRef(arenaId), { [ARENA_PATH.BATTLE_TURN]: turnWithFlag });
    return;
  }

  const coAtkPath = findFighterPath(room, coAttackerId);
  const updates: Record<string, unknown> = {
    [ARENA_PATH.BATTLE_TURN]: turnWithFlag,
  };
  if (coAtkPath) updates[`${coAtkPath}/quota`] = Math.min(coAttacker.quota + 1, coAttacker.maxQuota ?? 0);
  await update(roomRef(arenaId), updates);
}

/** Quota refill after Pomegranate co-defend dice shown (defender rolls ≥11 → refill). */
export async function ackPomegranateCoDefendDiceShown(
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
  const turn = battle?.turn;
  if (!turn || turn.phase !== PHASE.RESOLVING || turn.coDefendRoll == null) return;
  if ((turn as unknown as Record<string, unknown>).coDefendQuotaRefilled) {
    return;
  }

  const defenderId = turn.defenderId;
  if (!defenderId) {
    return;
  }
  const defender = findFighter(room, defenderId);
  if (!defender) {
    return;
  }

  const activeEffects = battle?.activeEffects || [];
  const defBuff = getStatModifier(activeEffects, defenderId, MOD_STAT.DEFEND_DICE_UP);
  const defRecovery = getStatModifier(activeEffects, defenderId, MOD_STAT.RECOVERY_DICE_UP);
  const total = (turn.coDefendRoll ?? 0) + defender.defendDiceUp + defBuff + defRecovery;
  const turnWithFlag = { ...turn, coDefendQuotaRefilled: true } as Record<string, unknown>;
  if (total < 11 || defender.quota >= (defender.maxQuota ?? 0)) {
    await update(roomRef(arenaId), { [ARENA_PATH.BATTLE_TURN]: turnWithFlag });
    return;
  }

  const defPath = findFighterPath(room, defenderId);
  const updates: Record<string, unknown> = {
    [ARENA_PATH.BATTLE_TURN]: turnWithFlag,
  };
  if (defPath) updates[`${defPath}/quota`] = Math.min(defender.quota + 1, defender.maxQuota ?? 0);
  await update(roomRef(arenaId), updates);
}
