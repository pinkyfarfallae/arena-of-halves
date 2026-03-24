import { get, update } from 'firebase/database';
import type { BattleRoom, FighterState } from '../../../../types/battle';
import type { ActiveEffect } from '../../../../types/power';
import { EFFECT_TAGS } from '../../../../constants/effectTags';
import { POWER_NAMES } from '../../../../constants/powers';
import { PHASE, ARENA_PATH, TURN_ACTION, teamPath, TEAM_SUB_PATH, type BattleTeamKey } from '../../../../constants/battle';

/** Delay before applying Jolt Arc damage/skeleton so client can play the arc effect first. */
export const JOLT_ARC_EFFECT_MS = 800;

/** Stable order for Jolt Arc resolve cards (enemy roster order, then any remaining map keys). */
export function getJoltArcOrderedTargetIds(room: BattleRoom, attackerId: string, aoeDamageMap: Record<string, number>): string[] {
  const keys = Object.keys(aoeDamageMap).filter((id) => (aoeDamageMap[id] ?? 0) > 0);
  if (keys.length === 0) return [];
  const isTeamA = (room.teamA?.members || []).some((m) => m.characterId === attackerId);
  const enemies = isTeamA ? (room.teamB?.members || []) : (room.teamA?.members || []);
  const ordered: string[] = [];
  for (const e of enemies) {
    if (keys.includes(e.characterId)) ordered.push(e.characterId);
  }
  for (const k of keys) {
    if (!ordered.includes(k)) ordered.push(k);
  }
  return ordered;
}

/**
 * Apply Jolt Arc damage phase after effect has played: resolveHitAtDefender per target, HP, effects, log.
 * Call after JOLT_ARC_EFFECT_MS so skeleton destroy and damage happen after the arc VFX.
 */
export async function applyJoltArcDamagePhase(
  arenaId: string,
  attackerId: string,
  aoeDamageMap: Record<string, number>,
  joltUpdates: Record<string, unknown>,
  attackerTeam: BattleTeamKey | undefined,
  primaryDefenderId: string,
  turnUsedPowerIndex: number | undefined,
  {
    roomRef,
    findFighter,
    findFighterPath,
    findFighterTeam,
    resolveHitAtDefender,
    sanitizeBattleLog,
  }: {
    roomRef: (arenaId: string) => any;
    findFighter: (room: BattleRoom, characterId: string) => FighterState | undefined;
    findFighterPath: (room: BattleRoom, characterId: string) => string | null;
    findFighterTeam: (room: BattleRoom, characterId: string) => BattleTeamKey | null;
    resolveHitAtDefender: (
      arenaId: string,
      room: BattleRoom,
      defenderId: string,
      incomingDamage: number,
      updates: Record<string, unknown>,
      defender: FighterState,
    ) => Promise<{ damageToMaster: number; hitTargetId: string; skippedMinionsPath?: string }>;
    sanitizeBattleLog: (log: unknown[]) => unknown[];
  },
): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle?.turn || battle.turn.usedPowerName !== POWER_NAMES.JOLT_ARC) return;

  const updates: Record<string, unknown> = { ...joltUpdates };
  const joltDecelerationExclude: string[] = [];
  const joltOrderedIds = getJoltArcOrderedTargetIds(room, attackerId, aoeDamageMap);
  const aoeMapSnapshot =
    Object.keys(aoeDamageMap).length > 0 ? ({ ...aoeDamageMap } as Record<string, number>) : undefined;
  const logEntries: Record<string, unknown>[] = [];

  for (const targetId of joltOrderedIds) {
    const dmg = aoeDamageMap[targetId] ?? 0;
    const targetFighter = findFighter(room, targetId);
    if (!targetFighter) continue;
    const resolve = await resolveHitAtDefender(arenaId, room, targetId, dmg, updates, targetFighter);
    if (resolve.skippedMinionsPath) delete updates[resolve.skippedMinionsPath];
    if (resolve.hitTargetId !== targetId) joltDecelerationExclude.push(targetId);
    // Master must not take damage if they have at least one skeleton (skeleton blocks Jolt Arc)
    const defenderTeam = findFighterTeam(room, targetId);
    const currentMinionsForTarget = defenderTeam
      ? ((updates[teamPath(defenderTeam, TEAM_SUB_PATH.MINIONS)] as any[]) ?? (room[defenderTeam]?.minions || []))
      : [];
    const hasSkeleton = currentMinionsForTarget.filter((m: any) => m.masterId === targetId).length > 0;
    const damageToMaster = hasSkeleton ? 0 : resolve.damageToMaster;
    const defPath = findFighterPath(room, targetId);
    if (defPath && damageToMaster > 0) {
      const currentHp = (updates[`${defPath}/currentHp`] as number | undefined) ?? targetFighter.currentHp;
      updates[`${defPath}/currentHp`] = Math.max(0, currentHp - damageToMaster);
    }
    const hpAfter = defPath
      ? ((updates[`${defPath}/currentHp`] as number | undefined) ?? targetFighter.currentHp)
      : targetFighter.currentHp;
    const row: Record<string, unknown> = {
      round: battle.roundNumber,
      attackerId,
      defenderId: targetId,
      attackRoll: 0,
      defendRoll: 0,
      damage: damageToMaster,
      defenderHpAfter: hpAfter,
      eliminated: hpAfter <= 0,
      missed: dmg <= 0,
      powerUsed: POWER_NAMES.JOLT_ARC,
    };
    if (aoeMapSnapshot) row.aoeDamageMap = { ...aoeMapSnapshot };
    if (resolve.hitTargetId && resolve.hitTargetId !== targetId) {
      row.hitTargetId = resolve.hitTargetId;
    }
    logEntries.push(row);
  }

  if (joltDecelerationExclude.length > 0) {
    const activeEff = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? battle.activeEffects ?? [];
    const excludeSet = new Set(joltDecelerationExclude);
    const filtered = activeEff.filter(
      (e) => !(e.tag === EFFECT_TAGS.JOLT_ARC_DECELERATION && excludeSet.has(e.targetId)),
    );
    updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = filtered;
  }

  if (logEntries.length === 0) {
    const logPrimaryDefId = joltOrderedIds[0] ?? primaryDefenderId;
    const primaryDefender = logPrimaryDefId ? findFighter(room, logPrimaryDefId) : null;
    const primaryDefPath = primaryDefender ? findFighterPath(room, logPrimaryDefId) : null;
    const defenderHpAfter = primaryDefPath
      ? ((updates[`${primaryDefPath}/currentHp`] as number | undefined) ?? primaryDefender?.currentHp ?? 0)
      : 0;
    logEntries.push({
      round: battle.roundNumber,
      attackerId,
      defenderId: logPrimaryDefId || attackerId,
      attackRoll: 0,
      defendRoll: 0,
      damage: 0,
      defenderHpAfter,
      eliminated: defenderHpAfter <= 0,
      missed: true,
      powerUsed: POWER_NAMES.JOLT_ARC,
      ...(aoeMapSnapshot ? { aoeDamageMap: { ...aoeMapSnapshot } } : {}),
    });
  }

  updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), ...logEntries]);
  const joltTurnBase: Record<string, unknown> = {
    attackerId,
    attackerTeam,
    defenderId: joltOrderedIds[0] ?? primaryDefenderId,
    phase: PHASE.RESOLVING,
    action: TURN_ACTION.POWER,
    usedPowerIndex: turnUsedPowerIndex,
    usedPowerName: POWER_NAMES.JOLT_ARC,
    joltArcTargetIds: joltOrderedIds,
    joltArcAoeDamageMap: { ...aoeDamageMap },
    joltArcResolveIndex: 0,
  };
  if (joltOrderedIds.length === 0) {
    joltTurnBase.joltArcAwaitingAdvance = true;
  }
  updates[ARENA_PATH.BATTLE_TURN] = joltTurnBase;
  updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
  updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;

  await update(roomRef(arenaId), updates);
}
