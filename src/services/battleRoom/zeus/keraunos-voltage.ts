import { get, update } from 'firebase/database';
import type { BattleRoom, BattleState, FighterState, TurnState } from '../../../types/battle';
import type { ActiveEffect } from '../../../types/power';
import { MOD_STAT } from '../../../constants/effectTypes';
import { POWER_NAMES } from '../../../constants/powers';
import { PHASE, ARENA_PATH } from '../../../constants/battle';
import { getStatModifier, applyKeraunosVoltageShockSingleTarget } from '../../powerEngine/powerEngine';

/**
 * Keraunos Voltage UI steps: 0 = main (3 dmg), 1 = 2-dmg target(s); with ≥3 alive enemies pick two distinct 2-dmg targets, then tier-3 (1 dmg) fills the rest.
 * Legacy: step 2 was a manual third pick — still mapped for old room state.
 */
export function effectiveKeraunosStep(turn: {
  keraunosTargetStep?: number | null;
  keraunosSecondaryTargetIds?: string[] | null;
}): 0 | 1 | 2 {
  const raw = turn.keraunosTargetStep ?? 0;
  const secCount = (turn.keraunosSecondaryTargetIds ?? []).length;
  if (raw === 0) return 0;
  if (raw === 1) return 1;
  if (raw === 2) return secCount === 0 ? 1 : 2;
  if (raw >= 3) return 2;
  return 0;
}

/** Damage-card tier for a Keraunos bolt target (3 / 2 / 1 base before crit). */
export function keraunosTierForTargetId(
  mainId: string | undefined,
  secondaryIds: string[],
  tid: string,
): 0 | 1 | 2 {
  if (mainId && tid === mainId) return 0;
  const si = secondaryIds.indexOf(tid);
  if (si < 0) return 2;
  return (si < 2 ? 1 : 2) as 0 | 1 | 2;
}

/** Living bolt targets in order: main (3), then secondaries (2/2/1…), at chain start. */
export function computeKeraunosOrderedTargetIds(
  room: BattleRoom,
  turn: TurnState,
  { findFighter }: { findFighter: (room: BattleRoom, characterId: string) => FighterState | undefined },
): string[] {
  const mainId = (turn as TurnState & { keraunosMainTargetId?: string }).keraunosMainTargetId ?? turn.defenderId ?? '';
  const secondaryIds = (turn as TurnState & { keraunosSecondaryTargetIds?: string[] }).keraunosSecondaryTargetIds ?? [];
  const ordered: string[] = [];
  if (mainId) {
    const m = findFighter(room, mainId);
    if (m && m.currentHp > 0) ordered.push(mainId);
  }
  for (const sid of secondaryIds) {
    if (!sid || ordered.includes(sid)) continue;
    const s = findFighter(room, sid);
    if (s && s.currentHp > 0) ordered.push(sid);
  }
  return ordered;
}

export function mergeKeraunosBattleLog(
  battle: BattleState,
  updates: Record<string, unknown>,
  row: Record<string, unknown>,
  { sanitizeBattleLog }: { sanitizeBattleLog: (log: unknown[]) => unknown[] },
): void {
  const base = [...(battle.log || [])];
  updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...base, row]);
}

export type KeraunosBoltResult = { totalDamage: number; tier: 0 | 1 | 2; shockBonus: number };

/** One Keraunos bolt + shock for a single target. Mutates `updates`; mutates `excludeTargetIds` when skeleton absorbs. */
export async function applyKeraunosVoltageBoltForTarget(
  arenaId: string,
  room: BattleRoom,
  battle: BattleState,
  turn: TurnState,
  attackerId: string,
  attacker: FighterState,
  targetId: string,
  updates: Record<string, unknown>,
  excludeTargetIds: string[],
  {
    findFighter,
    findFighterPath,
    readFighterHpFromUpdates,
    resolveHitAtDefender,
  }: {
    findFighter: (room: BattleRoom, characterId: string) => FighterState | undefined;
    findFighterPath: (room: BattleRoom, characterId: string) => string | null;
    readFighterHpFromUpdates: (room: BattleRoom, characterId: string, updates: Record<string, unknown>) => number;
    resolveHitAtDefender: (
      arenaId: string,
      room: BattleRoom,
      defenderId: string,
      incomingDamage: number,
      updates: Record<string, unknown>,
      defender: FighterState,
    ) => Promise<{ damageToMaster: number; hitTargetId: string; skippedMinionsPath?: string }>;
  },
): Promise<KeraunosBoltResult> {
  const mainId = (turn as TurnState & { keraunosMainTargetId?: string }).keraunosMainTargetId ?? turn.defenderId ?? '';
  const secondaryIds = (turn as TurnState & { keraunosSecondaryTargetIds?: string[] }).keraunosSecondaryTargetIds ?? [];
  const isCritK = !!(turn as TurnState & { isCrit?: boolean }).isCrit;
  const mult = isCritK ? 2 : 1;
  const tier = keraunosTierForTargetId(mainId || undefined, secondaryIds, targetId);
  const bases = [3, 2, 1] as const;
  const baseBolt = bases[tier] * mult;

  const fighter = findFighter(room, targetId);
  if (!fighter || readFighterHpFromUpdates(room, targetId, updates) <= 0) {
    return { totalDamage: 0, tier, shockBonus: 0 };
  }

  const hpStart = readFighterHpFromUpdates(room, targetId, updates);
  const resolve = await resolveHitAtDefender(arenaId, room, targetId, baseBolt, updates, fighter);
  if (resolve.skippedMinionsPath) delete updates[resolve.skippedMinionsPath];
  const skeletonBlocked = resolve.hitTargetId !== targetId;
  if (skeletonBlocked && !excludeTargetIds.includes(targetId)) excludeTargetIds.push(targetId);

  const defPath = findFighterPath(room, targetId);
  if (defPath && resolve.damageToMaster > 0) {
    const cur = (updates[`${defPath}/currentHp`] as number | undefined) ?? fighter.currentHp;
    updates[`${defPath}/currentHp`] = Math.max(0, cur - resolve.damageToMaster);
  }

  const hpAfterBolt = readFighterHpFromUpdates(room, targetId, updates);
  const activeEff = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? battle.activeEffects ?? [];
  const battleForShock: BattleState = { ...battle, activeEffects: activeEff };
  const casterDamageK = Math.max(0, attacker.damage + getStatModifier(activeEff, attackerId, MOD_STAT.DAMAGE));

  let shockBonus = 0;
  if (!excludeTargetIds.includes(targetId)) {
    const { updates: shockUpd, bonusDamage } = applyKeraunosVoltageShockSingleTarget(
      room,
      attackerId,
      battleForShock,
      casterDamageK,
      targetId,
      hpAfterBolt,
      excludeTargetIds,
    );
    shockBonus = bonusDamage;
    Object.assign(updates, shockUpd);
  }

  const hpEnd = readFighterHpFromUpdates(room, targetId, updates);
  const totalDamage = Math.max(0, hpStart - hpEnd);
  return { totalDamage, tier, shockBonus };
}

/**
 * Keraunos Voltage: confirm both 2-damage targets in one step when ≥3 alive enemies (after main is chosen).
 */
export async function selectKeraunosTier2Batch(
  arenaId: string,
  defenderIds: string[],
  {
    roomRef,
    findFighter,
    deductPowerQuotaIfPending,
    getWinningFaces,
  }: {
    roomRef: (arenaId: string) => any;
    findFighter: (room: BattleRoom, characterId: string) => FighterState | undefined;
    deductPowerQuotaIfPending: (
      room: BattleRoom,
      turn: TurnState,
      attackerId: string,
      updates: Record<string, unknown>,
      turnUpdate: Record<string, unknown>,
      usedPowerIndexOverride?: number | null,
    ) => void;
    getWinningFaces: (critRate: number) => number[];
  },
): Promise<void> {
  const uniq = Array.from(new Set(defenderIds));
  if (uniq.length !== defenderIds.length) return;

  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle?.turn) return;
  const turn = battle.turn;
  if (turn.phase !== PHASE.SELECT_TARGET) return;
  if (turn.usedPowerName !== POWER_NAMES.KERAUNOS_VOLTAGE || turn.keraunosAwaitingCrit) return;
  if (effectiveKeraunosStep(turn) !== 1) return;
  const existingSecs = turn.keraunosSecondaryTargetIds ?? [];
  if (existingSecs.length > 0) return;

  const attackerId = turn.attackerId;
  const attacker = findFighter(room, attackerId);
  if (!attacker) return;
  const power = turn.usedPowerIndex != null ? attacker.powers?.[turn.usedPowerIndex] : undefined;
  if (!power || power.name !== POWER_NAMES.KERAUNOS_VOLTAGE) return;

  const isTeamA = (room.teamA?.members || []).some(m => m.characterId === attackerId);
  const enemies = (isTeamA ? (room.teamB?.members || []) : (room.teamA?.members || [])).filter(e => e.currentHp > 0);
  const n = enemies.length;
  const enemyIdSet = new Set(enemies.map(e => e.characterId));
  const mainId = turn.keraunosMainTargetId ?? turn.defenderId;
  if (!mainId) return;

  if (n < 3 || defenderIds.length !== 2) return;
  if (defenderIds.some(id => id === mainId || !enemyIdSet.has(id))) return;

  let nextSecondaries = [...defenderIds];
  const remaining = enemies
    .map(e => e.characterId)
    .filter(id => id !== mainId && !nextSecondaries.includes(id));
  nextSecondaries = [...nextSecondaries, ...remaining];

  const activeEffectsK = battle.activeEffects || [];
  const critBuffK = getStatModifier(activeEffectsK, attackerId, MOD_STAT.CRITICAL_RATE);
  const effectiveCritK = Math.max(attacker.criticalRate ?? 0, (attacker.criticalRate ?? 0) + critBuffK);
  const critRate = Math.min(100, Math.max(0, effectiveCritK + 25));

  const updates: Record<string, unknown> = {};
  const turnUpdate: Record<string, unknown> = {
    ...turn,
    defenderId: mainId,
    keraunosMainTargetId: mainId,
    keraunosSecondaryTargetIds: nextSecondaries,
    keraunosTargetStep: null,
    phase: PHASE.RESOLVING,
    critWinFaces: getWinningFaces(critRate),
    attackRoll: 0,
    defendRoll: 0,
  };
  deductPowerQuotaIfPending(room, turn, attackerId, updates, turnUpdate);
  updates[ARENA_PATH.BATTLE_TURN] = turnUpdate;
  await update(roomRef(arenaId), updates);
}
