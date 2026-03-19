import { ref, set, get, onValue, update, remove, off } from 'firebase/database';
import { db } from '../firebase';
import type {
  BattleRoom, BattleState, FighterState, Team,
  TurnQueueEntry, Viewer, BattlePlaybackStep, TurnState,
} from '../types/battle';
import { BATTLE_PLAYBACK_KIND } from '../types/battle';
import type { Character } from '../types/character';
import type { PowerDefinition, ActiveEffect } from '../types/power';
import { getQuotaCost } from '../types/power';
import {
  getStatModifier, getReflectPercent,
  isStunned, applyPowerEffect, tickEffects, buildPassiveEffects,
  makeEffectId,
  applyLightningReflexPassive, applyJoltArc, applyKeraunosVoltageShock,
  applySecretOfDryadPassive, onEfflorescenceMuseTurnStart, applyFloralFragranced, applyApolloHymn, applySeasonEffects, applyImprecatedPoem,
  applyPomegranateOath, applyBeyondTheNimbusTeamShock,
  addSunbornSovereignRecoveryStack,
  getEffectiveHealForReceiver,
  isHealingNullified,
} from './powerEngine';
import { getPowers } from '../data/powers';
import { EFFECT_TAGS, IMPRECATED_POEM_VERSE_TAGS } from '../constants/effectTags';
import { POWER_NAMES, POWERS_DEFENDER_CANNOT_DEFEND } from '../constants/powers';
import { ARENA_PATH, BATTLE_TEAM, PHASE, ROOM_STATUS, TURN_ACTION, TurnAction, teamPath, type BattleTeamKey } from '../constants/battle';
import { EFFECT_TYPES, TARGET_TYPES, MOD_STAT } from '../constants/effectTypes';
import { SKILL_UNLOCK } from '../constants/character';
import { SEASON_KEYS, SeasonKey } from '../data/seasons';

/* ── helpers ─────────────────────────────────────────── */

/**
 * Roll a D4 to check for critical hit.
 * - 0%   → no crit, no roll
 * - 25%  → 1 winning face (always 4)
 * - 50%  → 2 randomly chosen winning faces
 * - 75%  → 3 randomly chosen winning faces
 * - 100% → auto crit, no roll
 */
export function checkCritical(critRate: number, winFaces?: number[]): { isCrit: boolean; critRoll: number } {
  if (critRate <= 0) return { isCrit: false, critRoll: 0 };
  if (critRate >= 100) return { isCrit: true, critRoll: 0 };

  const roll = Math.ceil(Math.random() * 4); // 1-4
  const winners = winFaces ?? getWinningFaces(critRate);

  return { isCrit: winners.includes(roll), critRoll: roll };
}

/** Pre-generate which D4 faces will count as a crit for a given rate. */
export function getWinningFaces(critRate: number): number[] {
  if (critRate <= 0) return [];
  if (critRate >= 100) return [1, 2, 3, 4];
  const winCount = Math.round(critRate / 25);
  const pool = [1, 2, 3, 4];
  const winners: number[] = [];
  for (let i = 0; i < winCount; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(idx, 1)[0]);
  }
  return winners;
}

/** Ensure no log entry has powerUsed === undefined (Firebase rejects undefined). Preserve hitTargetId so client gets it. */
function sanitizeBattleLog(log: unknown[]): unknown[] {
  return log.map((e: any) => {
    const out: Record<string, unknown> = { ...e, powerUsed: e.powerUsed ?? '' };
    if (e.hitTargetId != null && e.hitTargetId !== '') out.hitTargetId = e.hitTargetId;
    return out;
  });
}

/** Generate a 6-char uppercase room code */
function generateArenaId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Normalize a fighter object loaded from Firebase, ensuring all required numeric fields are valid */
function normalizeFighterImpl(fighter: any): FighterState {
  if (!fighter) return fighter;

  // Ensure quota is a valid number; if missing/invalid, set to maxQuota
  if (typeof fighter.quota !== 'number' || isNaN(fighter.quota)) {
    fighter.quota = fighter.maxQuota || 0;
  }

  // Ensure maxQuota is a valid number
  if (typeof fighter.maxQuota !== 'number' || isNaN(fighter.maxQuota)) {
    fighter.maxQuota = 0;
  }

  // Ensure skeletonCount is initialized (Hades' Undead Army)
  if (typeof fighter.skeletonCount !== 'number' || isNaN(fighter.skeletonCount)) {
    fighter.skeletonCount = 0;
  }

  // Ensure other numeric fields are valid (use literal keys; MOD_STAT omits currentHp, rerollsLeft, technique)
  (['currentHp', 'maxHp', 'damage', 'attackDiceUp', 'defendDiceUp', 'speed', 'rerollsLeft', 'technique', 'criticalRate'] as const).forEach(field => {
    if (typeof fighter[field] !== 'number' || isNaN(fighter[field])) {
      fighter[field] = 0;
    }
  });

  return fighter;
}

export const normalizeFighter = normalizeFighterImpl;

/** Build a FighterState snapshot from a Character + their Powers */
export function toFighterState(character: Character, powers: PowerDefinition[]): FighterState {
  // Calculate critical rate based on strength
  let criticalRate = 25; // default 25%
  if (character.strength > 3 && character.strength < 5) {
    criticalRate = 50; // 50% if 3 < strength < 5
  } else if (character.strength === 5) {
    criticalRate = 75; // 75% if strength === 5
  }

  return {
    characterId: character.characterId,
    nicknameEng: character.nicknameEng,
    nicknameThai: character.nicknameThai,
    sex: character.sex,
    deityBlood: character.deityBlood,
    image: character.image,
    theme: character.theme,

    maxHp: character.hp,
    currentHp: character.hp,
    damage: character.damage,
    attackDiceUp: character.attackDiceUp,
    defendDiceUp: character.defendDiceUp,
    speed: character.speed,
    rerollsLeft: character.reroll,

    passiveSkillPoint: character.passiveSkillPoint,
    skillPoint: character.skillPoint,
    ultimateSkillPoint: character.ultimateSkillPoint,

    technique: character.technique,
    maxQuota: character.technique < 3 ? 2 : 3,
    quota: character.technique < 3 ? 2 : 3,
    criticalRate,

    powers,
    skeletonCount: 0,
  };
}

/** Get all character IDs in a room (both teams) */
function getAllFighterIds(room: BattleRoom): string[] {
  const teamAIds = (room.teamA?.members || []).map(m => m.characterId);
  const teamBIds = (room.teamB?.members || []).map(m => m.characterId);
  return [...teamAIds, ...teamBIds];
}

/** Build team name from member nicknames */
function teamName(team: Team): string {
  const members = team.members || [];
  if (members.length === 0) return '???';
  return members.map(m => m.nicknameEng).join(' & ');
}

/** True if the character has an active Soul Devourer effect (Hades). */
function hasSoulDevourerEffect(activeEffects: ActiveEffect[] | undefined, characterId: string): boolean {
  return (activeEffects || []).some(
    e => e.targetId === characterId && e.tag === EFFECT_TAGS.SOUL_DEVOURER,
  );
}

/** True if the power can be used to "attack" (enemy target, damage/lifesteal) for Soul Devourer drain. */
function powerCanAttack(power: PowerDefinition): boolean {
  return (
    power.target === TARGET_TYPES.ENEMY &&
    (power.effect === EFFECT_TYPES.DAMAGE || power.effect === EFFECT_TYPES.LIFESTEAL)
  );
}

/** True if the fighter has Shadow Camouflage (immune to single-target actions; only area attacks can target them). */
function hasShadowCamouflage(activeEffects: ActiveEffect[], characterId: string): boolean {
  return (activeEffects || []).some(
    e => e.targetId === characterId && e.modStat === MOD_STAT.SHADOW_CAMOUFLAGED,
  );
}

/**
 * Returns valid target characterIds for the current turn (SELECT_TARGET).
 * Used for Disoriented auto-target and for validating no valid targets (skip turn).
 */
function getValidTargetIds(
  room: BattleRoom,
  turn: BattleState['turn'],
  activeEffects: ActiveEffect[],
): string[] {
  if (!turn?.attackerId) return [];
  const attacker = findFighter(room, turn.attackerId);
  const attackerTeam = turn.attackerTeam ?? findFighterTeam(room, turn.attackerId);
  if (!attackerTeam) return [];
  const opposingTeam = attackerTeam === BATTLE_TEAM.A ? (room.teamB?.members || []) : (room.teamA?.members || []);
  const sameTeam = attackerTeam === BATTLE_TEAM.A ? (room.teamA?.members || []) : (room.teamB?.members || []);

  if (turn.action === TURN_ACTION.ATTACK) {
    const alive = opposingTeam.filter(m => m.currentHp > 0);
    const isAreaAttack = false;
    return alive.filter(m => !hasShadowCamouflage(activeEffects, m.characterId) || isAreaAttack).map(m => m.characterId);
  }

  if (turn.action === TURN_ACTION.POWER && turn.usedPowerIndex != null && attacker) {
    const power = attacker.powers?.[turn.usedPowerIndex];
    if (!power) return [];
    if (power.target === TARGET_TYPES.SELF) return [];
    if (power.target === TARGET_TYPES.AREA) {
      // Area powers that still use SELECT_TARGET (e.g. Keraunos) need one enemy as primary target
      const alive = opposingTeam.filter(m => m.currentHp > 0);
      const isAreaAttack = power.target === TARGET_TYPES.AREA;
      let ids = alive.filter(m => !hasShadowCamouflage(activeEffects, m.characterId) || isAreaAttack).map(m => m.characterId);
      if (power.requiresTargetHasEffect) {
        ids = ids.filter(id => activeEffects.some(e => e.targetId === id && e.tag === power.requiresTargetHasEffect));
      }
      return ids;
    }
    if (power.target === TARGET_TYPES.ALLY) {
      if (power.name === POWER_NAMES.DEATH_KEEPER) {
        return sameTeam.filter(m => m.currentHp <= 0).map(m => m.characterId);
      }
      return sameTeam.filter(m => m.currentHp > 0).map(m => m.characterId);
    }
    // Enemy-target (single)
    const alive = opposingTeam.filter(m => m.currentHp > 0);
    const isAreaAttack = false;
    let ids = alive.filter(m => !hasShadowCamouflage(activeEffects, m.characterId) || isAreaAttack).map(m => m.characterId);
    if (power.requiresTargetHasEffect) {
      ids = ids.filter(id => activeEffects.some(e => e.targetId === id && e.tag === power.requiresTargetHasEffect));
    }
    return ids;
  }
  return [];
}

/* ── room ref ────────────────────────────────────────── */

function roomRef(arenaId: string) {
  return ref(db, `arenas/${arenaId}`);
}

/* ── create ───────────────────────────────────────────── */

export async function createRoom(
  fighter: FighterState | FighterState[],
  customName?: string,
  teamSize: number = 1,
): Promise<string> {
  let arenaId = generateArenaId();

  // make sure code is unique
  let exists = true;
  while (exists) {
    const snap = await get(roomRef(arenaId));
    if (snap.exists()) {
      arenaId = generateArenaId();
    } else {
      exists = false;
    }
  }

  const size = Math.max(1, Math.floor(teamSize));
  const teamAMembers = Array.isArray(fighter) ? fighter : [fighter];
  const firstName = Array.isArray(fighter)
    ? fighter.map(f => f.nicknameEng).join(' & ')
    : fighter.nicknameEng;
  const roomName = customName?.trim() || `${firstName} vs ???`;

  const room: BattleRoom = {
    arenaId,
    roomName,
    status: ROOM_STATUS.CONFIGURING,
    teamSize: size,
    teamA: { members: teamAMembers, maxSize: size, minions: [] },
    teamB: { members: [], maxSize: size, minions: [] },
    viewers: {},
    createdAt: Date.now(),
  };

  await set(roomRef(arenaId), room);
  return arenaId;
}

/* ── join as fighter (opponent team) ──────────────────── */

export async function joinRoom(arenaId: string, fighter: FighterState | FighterState[]): Promise<BattleRoom | null> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return null;

  const room = snap.val() as BattleRoom;
  const fighters = Array.isArray(fighter) ? fighter : [fighter];
  const teamBMembers = room.teamB?.members || [];
  const maxSize = room.teamB?.maxSize ?? room.teamSize;

  // team B already has members or would exceed max size
  if (teamBMembers.length > 0) return null;
  if (fighters.length > maxSize) return null;

  // check if any fighter already in any team
  const allIds = getAllFighterIds(room);
  if (fighters.some((f) => allIds.includes(f.characterId))) return null;

  const newMembers = [...teamBMembers, ...fighters];
  const bothFull = (room.teamA?.members || []).length >= maxSize && newMembers.length >= maxSize;

  // update room name when both teams are full
  const roomName = bothFull
    ? `${teamName(room.teamA)} vs ${teamName({ members: newMembers, maxSize })}`
    : room.roomName;

  await update(roomRef(arenaId), {
    [teamPath(BATTLE_TEAM.B, 'members')]: newMembers,
    roomName,
    [ARENA_PATH.STATUS]: bothFull ? ROOM_STATUS.READY : ROOM_STATUS.WAITING,
  });

  const updated = await get(roomRef(arenaId));
  return updated.val() as BattleRoom;
}

/* ── join as viewer ───────────────────────────────────── */

export async function joinAsViewer(arenaId: string, viewer: Viewer): Promise<boolean> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return false;

  await update(ref(db, `arenas/${arenaId}/viewers/${viewer.characterId}`), viewer);
  return true;
}

/* ── leave viewer ─────────────────────────────────────── */

export async function leaveViewer(arenaId: string, characterId: string): Promise<void> {
  await remove(ref(db, `arenas/${arenaId}/viewers/${characterId}`));
}

/* ── check if room exists ─────────────────────────────── */

export async function getRoom(arenaId: string): Promise<BattleRoom | null> {
  const snap = await get(roomRef(arenaId));
  return snap.exists() ? (snap.val() as BattleRoom) : null;
}

/* ── list all active rooms (for viewer lobby) ─────────── */

export function onRoomsList(callback: (rooms: BattleRoom[]) => void): () => void {
  const arenasRef = ref(db, 'arenas');
  const handler = onValue(arenasRef, (snap) => {
    const rooms = !snap.exists()
      ? []
      : (Object.values(snap.val() as Record<string, BattleRoom>)
        .filter((r) => r.status !== ROOM_STATUS.CONFIGURING)
        .sort((a, b) => b.createdAt - a.createdAt));
    setTimeout(() => callback(rooms), 0);
  });

  return () => off(arenasRef, 'value', handler);
}

/* ── listen to room changes (realtime) ────────────────── */

export function onRoomChange(arenaId: string, callback: (room: BattleRoom | null) => void): () => void {
  const r = roomRef(arenaId);
  const handler = onValue(r, (snap) => {
    const value = snap.exists() ? (snap.val() as BattleRoom) : null;
    // Defer to next macrotask so Firebase + scheduler message handlers return quickly (avoids long-task violations)
    setTimeout(() => callback(value), 0);
  });

  // return unsubscribe function
  return () => off(r, 'value', handler);
}

/* ── delete room ──────────────────────────────────────── */

export async function deleteRoom(arenaId: string): Promise<void> {
  await remove(roomRef(arenaId));
}

/** Delete every arena room on the server (entire `arenas` node). Use with caution. */
export async function deleteAllArenaRooms(): Promise<void> {
  await remove(ref(db, 'arenas'));
}

/* ══════════════════════════════════════════════════════════
   BATTLE — turn-based combat
   ══════════════════════════════════════════════════════════ */

/** Build a SPD-sorted turn queue. TeamA wins ties (room creator advantage). */
export function buildTurnQueue(room: BattleRoom, effects?: ActiveEffect[]): TurnQueueEntry[] {
  const entries: TurnQueueEntry[] = [];

  for (const m of room.teamA?.members || []) {
    const spdMod = effects ? getStatModifier(effects, m.characterId, 'speed') : 0;
    entries.push({ characterId: m.characterId, team: BATTLE_TEAM.A, speed: m.speed + spdMod });
  }
  for (const m of room.teamB?.members || []) {
    const spdMod = effects ? getStatModifier(effects, m.characterId, 'speed') : 0;
    entries.push({ characterId: m.characterId, team: BATTLE_TEAM.B, speed: m.speed + spdMod });
  }

  entries.sort((a, b) => {
    if (b.speed !== a.speed) return b.speed - a.speed;
    // tiebreaker: teamA before teamB
    if (a.team !== b.team) return a.team === BATTLE_TEAM.A ? -1 : 1;
    return 0;
  });

  return entries;
}

/** Find a fighter across both teams by characterId */
function findFighter(room: BattleRoom, characterId: string): FighterState | undefined {
  const all = [...(room.teamA?.members || []), ...(room.teamB?.members || [])];
  const fighter = all.find((m) => m.characterId === characterId);
  return fighter ? normalizeFighterImpl(fighter) : undefined;
}

/** Find the index of a fighter in teamA or teamB members array */
function findFighterPath(room: BattleRoom, characterId: string): string | null {
  const teamAIdx = (room.teamA?.members || []).findIndex((m) => m.characterId === characterId);
  if (teamAIdx !== -1) return `${teamPath(BATTLE_TEAM.A, 'members')}/${teamAIdx}`;
  const teamBIdx = (room.teamB?.members || []).findIndex((m) => m.characterId === characterId);
  if (teamBIdx !== -1) return `${teamPath(BATTLE_TEAM.B, 'members')}/${teamBIdx}`;
  return null;
}

function findFighterTeam(room: BattleRoom, characterId: string): BattleTeamKey | null {
  if ((room.teamA?.members || []).some(m => m.characterId === characterId)) return BATTLE_TEAM.A;
  if ((room.teamB?.members || []).some(m => m.characterId === characterId)) return BATTLE_TEAM.B;
  return null;
}

/**
 * Resolve one hit at defender: if defender has a skeleton, skeleton takes the hit and is destroyed (0 damage to master);
 * otherwise the given damage goes to master. 1 attack = 1 skeleton.
 * When skeleton blocks: sets lastHitTargetId = blocker, writes blocker to updates for next call in same turn, but
 * actual minion removal is delayed (setTimeout) so client can show hit VFX on skeleton first.
 * Caller MUST delete result.skippedMinionsPath from updates before writing to Firebase so client keeps minion for 1100ms.
 */
async function resolveHitAtDefender(
  arenaId: string,
  room: BattleRoom,
  defenderId: string,
  incomingDamage: number,
  updates: Record<string, unknown>,
  defender: FighterState,
): Promise<{ damageToMaster: number; hitTargetId: string; skippedMinionsPath?: string }> {
  const defenderTeam = findFighterTeam(room, defenderId);
  if (!defenderTeam) return { damageToMaster: incomingDamage, hitTargetId: defenderId };
  const currentMinions = (updates[teamPath(defenderTeam, 'minions')] as any[]) ?? (room[defenderTeam]?.minions || []);
  const defenderSkeletons = currentMinions.filter((m: any) => m.masterId === defenderId);
  if (defenderSkeletons.length === 0) return { damageToMaster: incomingDamage, hitTargetId: defenderId };

  const blocker = defenderSkeletons[0];
  const remainingMinions = currentMinions.filter((m: any) => m.characterId !== blocker.characterId);
  const defPath = findFighterPath(room, defenderId);
  if (defPath) {
    const currentCount = (updates[`${defPath}/skeletonCount`] as number | undefined) ?? defender.skeletonCount ?? 0;
    updates[`${defPath}/skeletonCount`] = Math.max(0, currentCount - 1);
  }
  // So next call in same turn (e.g. co-attack) sees updated list; actual removal is in setTimeout so client can show hit VFX
  const minionsPath = teamPath(defenderTeam, 'minions');
  updates[minionsPath] = remainingMinions;

  updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = blocker.characterId;

  const hitMarkerKey = ARENA_PATH.BATTLE_LAST_HIT_MINION_ID;
  const immediateMinions = currentMinions.map((m: any) => (
    m.characterId === blocker.characterId ? { ...m, __isHit: true } : m
  ));
  try {
    await update(ref(db, `arenas/${arenaId}`), {
      [hitMarkerKey]: blocker.characterId,
      [minionsPath]: immediateMinions,
    });
  } catch (err) {
  }
  setTimeout(async () => {
    try {
      await update(ref(db, `arenas/${arenaId}`), {
        [hitMarkerKey]: null,
        [minionsPath]: remainingMinions,
      });
    } catch (err) {
    }
  }, 1100);

  return { damageToMaster: 0, hitTargetId: blocker.characterId, skippedMinionsPath: minionsPath };
}

/** Delay before applying Jolt Arc damage/skeleton so client can play the arc effect first. */
const JOLT_ARC_EFFECT_MS = 800;

/**
 * Apply Jolt Arc damage phase after effect has played: resolveHitAtDefender per target, HP, effects, log.
 * Call after JOLT_ARC_EFFECT_MS so skeleton destroy and damage happen after the arc VFX.
 */
async function applyJoltArcDamagePhase(
  arenaId: string,
  attackerId: string,
  aoeDamageMap: Record<string, number>,
  joltUpdates: Record<string, unknown>,
  attackerTeam: BattleTeamKey | undefined,
  primaryDefenderId: string,
  turnUsedPowerIndex: number | undefined,
): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle?.turn || battle.turn.usedPowerName !== POWER_NAMES.JOLT_ARC) return;

  const updates: Record<string, unknown> = { ...joltUpdates };
  const joltDecelerationExclude: string[] = [];

  for (const [targetId, dmg] of Object.entries(aoeDamageMap)) {
    const targetFighter = findFighter(room, targetId);
    if (!targetFighter) continue;
    const resolve = await resolveHitAtDefender(arenaId, room, targetId, dmg, updates, targetFighter);
    if (resolve.skippedMinionsPath) delete updates[resolve.skippedMinionsPath];
    if (resolve.hitTargetId !== targetId) joltDecelerationExclude.push(targetId);
    // Master must not take damage if they have at least one skeleton (skeleton blocks Jolt Arc)
    const defenderTeam = findFighterTeam(room, targetId);
    const currentMinionsForTarget = defenderTeam
      ? ((updates[teamPath(defenderTeam, 'minions')] as any[]) ?? (room[defenderTeam]?.minions || []))
      : [];
    const hasSkeleton = currentMinionsForTarget.filter((m: any) => m.masterId === targetId).length > 0;
    const damageToMaster = hasSkeleton ? 0 : resolve.damageToMaster;
    const defPath = findFighterPath(room, targetId);
    if (defPath && damageToMaster > 0) {
      const currentHp = (updates[`${defPath}/currentHp`] as number | undefined) ?? targetFighter.currentHp;
      updates[`${defPath}/currentHp`] = Math.max(0, currentHp - damageToMaster);
    }
  }

  if (joltDecelerationExclude.length > 0) {
    const activeEff = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? battle.activeEffects ?? [];
    const excludeSet = new Set(joltDecelerationExclude);
    const filtered = activeEff.filter(
      (e) => !(e.tag === EFFECT_TAGS.JOLT_ARC_DECELERATION && excludeSet.has(e.targetId)),
    );
    updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = filtered;
  }

  const totalDmg = Object.values(aoeDamageMap).reduce((s, d) => s + d, 0);
  const primaryDefender = findFighter(room, primaryDefenderId);
  const primaryDefPath = primaryDefender ? findFighterPath(room, primaryDefenderId) : null;
  const defenderHpAfter = primaryDefPath ? (updates[`${primaryDefPath}/currentHp`] as number | undefined) ?? primaryDefender?.currentHp ?? 0 : 0;
  const logEntry = {
    round: battle.roundNumber,
    attackerId,
    defenderId: primaryDefenderId,
    attackRoll: 0,
    defendRoll: 0,
    damage: totalDmg,
    defenderHpAfter,
    eliminated: defenderHpAfter <= 0,
    missed: totalDmg === 0,
    powerUsed: POWER_NAMES.JOLT_ARC,
    ...(Object.keys(aoeDamageMap).length > 0 ? { aoeDamageMap } : {}),
  };
  updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), logEntry]);
  updates[ARENA_PATH.BATTLE_TURN] = {
    attackerId,
    attackerTeam,
    defenderId: primaryDefenderId,
    phase: PHASE.RESOLVING,
    action: TURN_ACTION.POWER,
    usedPowerIndex: turnUsedPowerIndex,
    usedPowerName: POWER_NAMES.JOLT_ARC,
  };
  updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
  updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;

  await update(roomRef(arenaId), updates);
}

/** Run tickEffects and apply any DOT damage via resolveHitAtDefender so Hades child's skeleton can block. */
async function tickEffectsWithSkeletonBlock(
  arenaId: string,
  room: BattleRoom,
  battle: BattleState,
  priorUpdates: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const effectUpdates = tickEffects(room, battle, priorUpdates) as Record<string, unknown> & { __dotDamages?: Array<{ targetId: string; value: number }> };
  const dotDamages = effectUpdates.__dotDamages;
  delete effectUpdates.__dotDamages;
  if (dotDamages?.length) {
    for (const d of dotDamages) {
      const defender = findFighter(room, d.targetId);
      if (!defender) continue;
      const resolve = await resolveHitAtDefender(arenaId, room, d.targetId, d.value, priorUpdates, defender);
      if (resolve.skippedMinionsPath) delete priorUpdates[resolve.skippedMinionsPath];
      const defPath = findFighterPath(room, d.targetId);
      if (defPath && resolve.damageToMaster > 0) {
        const cur = (priorUpdates[`${defPath}/currentHp`] as number | undefined) ?? defender.currentHp;
        priorUpdates[`${defPath}/currentHp`] = Math.max(0, cur - resolve.damageToMaster);
      }
    }
  }
  return effectUpdates;
}

function buildMasterPlaybackStep(
  room: BattleRoom,
  battle: BattleState,
  attacker: FighterState,
  defender: FighterState,
): BattlePlaybackStep {
  const turn = battle.turn!;
  const activeEffects = battle.activeEffects || [];
  const isSkipDicePower = turn.action === TURN_ACTION.POWER && !turn.attackRoll;
  const soulDevourerDrainTurn = !!(turn as any)?.soulDevourerDrain;

  if (isSkipDicePower) {
    const isKeraunos = turn.usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE;
    const isCritK = isKeraunos && !!(turn as any).isCrit;
    const mult = isCritK ? 2 : 1;
    const boltDmg = isKeraunos ? (3 * mult) : 0;
    let damage = boltDmg;
    let shockBonus = 0;
    if (isKeraunos) {
      const casterDamageK = Math.max(0, attacker.damage + getStatModifier(activeEffects, turn.attackerId, MOD_STAT.DAMAGE));
      const mainId = defender.characterId;
      const hadShock = activeEffects.some(e => e.targetId === mainId && e.tag === EFFECT_TAGS.SHOCK);
      shockBonus = hadShock ? casterDamageK : 0;
      damage = boltDmg + shockBonus;
    }
    return {
      kind: BATTLE_PLAYBACK_KIND.MASTER,
      hitIndex: 0,
      attackerId: attacker.characterId,
      defenderId: defender.characterId,
      isHit: true,
      isPower: true,
      powerName: turn.usedPowerName ?? TURN_ACTION.POWER,
      isCrit: isCritK,
      baseDmg: boltDmg,
      damage,
      shockBonus,
      atkRoll: 0,
      defRoll: 0,
      isDodged: false,
      coAttackHit: false,
      coAttackDamage: 0,
      attackerName: attacker.nicknameEng,
      attackerTheme: attacker.theme[0],
      defenderName: defender.nicknameEng,
      defenderTheme: defender.theme[0],
    };
  }

  if (soulDevourerDrainTurn) {
    const dmgBuff = getStatModifier(activeEffects, turn.attackerId, MOD_STAT.DAMAGE);
    const drainDmg = Math.max(0, attacker.damage + dmgBuff);
    return {
      kind: BATTLE_PLAYBACK_KIND.MASTER,
      hitIndex: 0,
      attackerId: attacker.characterId,
      defenderId: defender.characterId,
      isHit: true,
      isPower: turn.action === TURN_ACTION.POWER,
      powerName: turn.usedPowerName ?? (turn.action === TURN_ACTION.POWER ? POWER_NAMES.SOUL_DEVOURER : TURN_ACTION.ATTACK),
      isCrit: false,
      baseDmg: drainDmg,
      damage: drainDmg,
      shockBonus: 0,
      atkRoll: 0,
      defRoll: 0,
      isDodged: false,
      coAttackHit: false,
      coAttackDamage: 0,
      attackerName: attacker.nicknameEng,
      attackerTheme: attacker.theme[0],
      defenderName: defender.nicknameEng,
      defenderTheme: defender.theme[0],
      soulDevourerDrain: true,
    };
  }

  const atkBuff = getStatModifier(activeEffects, turn.attackerId, MOD_STAT.ATTACK_DICE_UP);
  const defBuff = getStatModifier(activeEffects, turn.defenderId!, MOD_STAT.DEFEND_DICE_UP);
  const atkRecovery = getStatModifier(activeEffects, turn.attackerId, MOD_STAT.RECOVERY_DICE_UP);
  const defRecovery = getStatModifier(activeEffects, turn.defenderId!, MOD_STAT.RECOVERY_DICE_UP);
  const at = (turn.attackRoll ?? 0) + attacker.attackDiceUp + atkBuff + atkRecovery;
  const dt = (turn.defendRoll ?? 0) + defender.defendDiceUp + defBuff + defRecovery;
  const dmgBuff = getStatModifier(activeEffects, turn.attackerId, MOD_STAT.DAMAGE);
  const baseDmg = Math.max(0, attacker.damage + dmgBuff);
  let damage = baseDmg;
  const isCrit = !!turn.isCrit;
  if (isCrit) damage *= 2;
  let shockBonus = 0;
  if (at > dt && turn.action !== TURN_ACTION.POWER) {
    const hasLR = attacker.passiveSkillPoint === SKILL_UNLOCK &&
      attacker.powers?.some(p => p.name === POWER_NAMES.LIGHTNING_SPARK);
    const defShocks = hasLR && activeEffects.some(
      e => e.targetId === turn.defenderId && e.tag === EFFECT_TAGS.SHOCK,
    );
    if (defShocks) shockBonus = baseDmg;
  }
  damage += shockBonus;
  const isDodged = !!turn.isDodged;
  return {
    kind: BATTLE_PLAYBACK_KIND.MASTER,
    hitIndex: 0,
    attackerId: attacker.characterId,
    defenderId: defender.characterId,
    isHit: at > dt && !isDodged,
    isPower: turn.action === TURN_ACTION.POWER,
    powerName: turn.usedPowerName ?? '',
    isCrit,
    baseDmg,
    damage: isDodged ? 0 : damage,
    shockBonus,
    atkRoll: turn.attackRoll ?? 0,
    defRoll: turn.defendRoll ?? 0,
    isDodged,
    coAttackHit: !!turn.coAttackDamage,
    coAttackDamage: turn.coAttackDamage ?? 0,
    attackerName: attacker.nicknameEng,
    attackerTheme: attacker.theme[0],
    defenderName: defender.nicknameEng,
    defenderTheme: defender.theme[0],
  };
}

function buildMinionPlaybackStep(
  room: BattleRoom,
  battle: BattleState,
  attackerId: string,
  defenderId: string,
  hitIndex: number,
): BattlePlaybackStep | null {
  const attackerTeam = findFighterTeam(room, attackerId);
  const minions = attackerTeam ? (room[attackerTeam]?.minions || []) : [];
  const skeletons = minions.filter((m: any) => m.masterId === attackerId);
  const sk = skeletons[hitIndex - 1];
  if (!sk) return null;
  const defender = findFighter(room, defenderId);
  const attacker = findFighter(room, attackerId);
  const soulDevourerDrain = !!(battle.turn as any)?.soulDevourerDrain;
  const isCrit = soulDevourerDrain ? false : !!(battle.turn as any)?.isCrit;
  const stored = Number((sk && sk.damage) ?? NaN);
  const fallback = attacker ? Math.ceil(attacker.damage * 0.5) : 0;
  let raw = (!isNaN(stored) && stored > 0) ? stored : fallback;
  const baseDmg = raw;
  if (isCrit) raw *= 2;
  let shieldRemaining = raw;
  const mutableEffects = [...(battle.activeEffects || [])];
  for (const se of mutableEffects) {
    if (se.targetId !== defenderId || se.effectType !== EFFECT_TYPES.SHIELD) continue;
    if (shieldRemaining <= 0) break;
    const absorbed = Math.min(se.value, shieldRemaining);
    shieldRemaining -= absorbed;
  }
  return {
    kind: BATTLE_PLAYBACK_KIND.MINION,
    hitIndex,
    attackerId: sk.characterId,
    defenderId,
    isHit: true,
    isPower: false,
    powerName: '',
    isCrit,
    baseDmg,
    damage: Math.max(0, shieldRemaining),
    shockBonus: 0,
    atkRoll: 0,
    defRoll: 0,
    isDodged: false,
    coAttackHit: false,
    coAttackDamage: 0,
    attackerName: sk.nicknameEng?.toLowerCase?.() || 'skeleton',
    attackerTheme: sk.theme?.[0] || '#666',
    defenderName: defender?.nicknameEng || defenderId,
    defenderTheme: defender?.theme?.[0] || '#666',
    isMinionHit: true,
  };
}

/** Find the next alive fighter index in the queue (skips eliminated) */
function nextAliveIndex(queue: TurnQueueEntry[], fromIndex: number, room: BattleRoom, effects?: ActiveEffect[]): { index: number; wrapped: boolean } {
  const len = queue.length;
  for (let i = 1; i <= len; i++) {
    const idx = (fromIndex + i) % len;
    const entry = queue[idx];
    const fighter = findFighter(room, entry.characterId);
    if (fighter && fighter.currentHp > 0) {
      return { index: idx, wrapped: idx < fromIndex };
    }
    // Dead fighter with death-keeper: allow their turn (self-resurrect)
    if (fighter && fighter.currentHp <= 0 && effects?.some(e => e.targetId === fighter.characterId && e.tag === EFFECT_TAGS.DEATH_KEEPER)) {
      return { index: idx, wrapped: idx < fromIndex };
    }
  }

  // all dead (shouldn't happen — game should end before this)
  return { index: fromIndex, wrapped: false };
}

/** Check if all members of a team are eliminated */
function isTeamEliminated(members: FighterState[], effects?: ActiveEffect[]): boolean {
  return members.every((m) => {
    if (m.currentHp > 0) return false;
    // Dead but has death-keeper → not truly eliminated
    if (effects?.some(e => e.targetId === m.characterId && e.tag === EFFECT_TAGS.DEATH_KEEPER)) return false;
    return true;
  });
}

/** Apply self-resurrect if next fighter is dead with death-keeper.
 *  Mutates `updates` and `effects` in place. Returns true if resurrection happened. */
function applySelfResurrect(
  nextCharId: string,
  room: BattleRoom,
  effects: ActiveEffect[],
  updates: Record<string, unknown>,
  battle: { roundNumber: number; log: unknown[] },
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
    effectType: 'buff',
    sourceId: nextCharId,
    targetId: nextCharId,
    value: 0,
    turnsRemaining: 999,
    tag: 'resurrected',
  });
  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effects;

  // Clear stun on the resurrected fighter (death resets debuffs)
  const stunIdx = effects.findIndex(e => e.targetId === nextCharId && e.tag === EFFECT_TAGS.STUN);
  if (stunIdx !== -1) effects.splice(stunIdx, 1);

  // Log
  const logEntry = {
    round: battle.roundNumber,
    attackerId: nextCharId,
    defenderId: nextCharId,
    attackRoll: 0,
    defendRoll: 0,
    damage: 0,
    defenderHpAfter: resHp,
    eliminated: false,
    missed: false,
    powerUsed: POWER_NAMES.DEATH_KEEPER,
    resurrectTargetId: nextCharId,
    resurrectHpRestored: resHp,
  };
  updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log as unknown[] || []), logEntry]);

  return true;
}

/* ── start battle ────────────────────────────────────── */

export async function startBattle(arenaId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  if (room.status !== ROOM_STATUS.READY) return;

  const turnQueue = buildTurnQueue(room);
  if (turnQueue.length === 0) return;

  const first = turnQueue[0];
  const passiveEffects = buildPassiveEffects(room);
  const battle: BattleState = {
    turnQueue,
    currentTurnIndex: 0,
    roundNumber: 1,
    turn: {
      attackerId: first.characterId,
      attackerTeam: first.team,
      phase: PHASE.SELECT_ACTION,
    },
    log: [],
    activeEffects: passiveEffects,
  };
  // Secret of Dryad: apply Efflorescence Muse for the first attacker before select action
  const dryadFirst = applySecretOfDryadPassive(room, first.characterId, battle, 0);
  const initialEffects = dryadFirst[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined;
  if (initialEffects) {
    battle.activeEffects = initialEffects;
  }

  await update(roomRef(arenaId), {
    status: ROOM_STATUS.BATTLING,
    battle,
  });
}

/* ── select target ───────────────────────────────────── */

export async function selectTarget(
  arenaId: string,
  defenderId: string,
  options?: { disorientedRoll?: number },
): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle?.turn) return;

  const turn = battle.turn;
  const { attackerId } = turn;
  const activeEffects = battle.activeEffects || [];

  // Keraunos Voltage: must complete D4 crit roll before target selection
  if (turn.usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE && turn.keraunosAwaitingCrit) return;

  // Shadow Camouflage: defender is immune to single-target actions (attack or enemy-target power). Area attacks bypass this in selectAction (no target selection).
  const defenderHasShadowCamouflage = hasShadowCamouflage(activeEffects, defenderId);
  const isAreaAttack = turn.action === TURN_ACTION.POWER && turn.usedPowerIndex != null && (() => {
    const attacker = findFighter(room, attackerId);
    const power = attacker?.powers?.[turn.usedPowerIndex];
    return power?.target === TARGET_TYPES.AREA;
  })();
  if (defenderHasShadowCamouflage && !isAreaAttack) {
    return; // Reject: cannot target Shadow Camouflaged with attack or single-target power
  }

  // Disoriented (Imprecated Poem): go to D4 roll phase — 25% chance action has no effect; client rolls on all screens then advanceAfterDisorientedD4
  const hasDisoriented = activeEffects.some(e => e.targetId === attackerId && e.tag === EFFECT_TAGS.DISORIENTED);
  if (hasDisoriented) {
    const winFaces = getWinningFaces(25); // 25% = 1 winning face
    const updates: Record<string, unknown> = {
      [ARENA_PATH.BATTLE_TURN]: {
        ...turn,
        defenderId,
        phase: PHASE.ROLLING_DISORIENTED_NO_EFFECT,
        disorientedWinFaces: winFaces,
        playbackStep: null,
        resolvingHitIndex: null,
      },
    };
    await update(roomRef(arenaId), updates);
    return;
  }

  // Normal attack (including follow-up after ally/self-buff power)
  if (!turn.action || turn.action === TURN_ACTION.ATTACK) {
    // Don't log yet - will log in resolveTurn after both dice are rolled
    const updates: Record<string, unknown> = {};

    // Soul Devourer: skip dice, go straight to RESOLVING as HP drain (client will call resolveTurn)
    const attacker = findFighter(room, attackerId);
    const activeEffects = battle.activeEffects || [];
    if (attacker && hasSoulDevourerEffect(activeEffects, attackerId)) {
      const turnUpdate: Record<string, unknown> = {
        ...turn,
        defenderId,
        phase: PHASE.RESOLVING,
        attackRoll: 0,
        defendRoll: 0,
        soulDevourerDrain: true,
      };
      try {
        const defenderTeam = findFighterTeam(room, defenderId);
        if (defenderTeam) {
          const defenderMinions = (room as any)[defenderTeam]?.minions || [];
          const defenderSkeletons = defenderMinions.filter((m: any) => m.masterId === defenderId);
          if (defenderSkeletons.length > 0) {
            turnUpdate.visualDefenderId = defenderSkeletons[0].characterId;
          }
        }
      } catch (_) { }
      updates[ARENA_PATH.BATTLE_TURN] = turnUpdate;
      updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
      updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
      await update(ref(db, `arenas/${arenaId}`), updates);
      return;
    }

    // If the chosen defender has skeleton minions, visually target the lowest-index skeleton
    // so the UI selection highlights the minion (but keep defenderId as the master for resolution).
    try {
      const defenderTeam = findFighterTeam(room, defenderId);
      if (defenderTeam) {
        const defenderMinions = (room as any)[defenderTeam]?.minions || [];
        const defenderSkeletons = defenderMinions.filter((m: any) => m.masterId === defenderId);
        if (defenderSkeletons.length > 0) {
          const visualDefenderId = defenderSkeletons[0].characterId;
          updates[ARENA_PATH.BATTLE_TURN] = { ...turn, defenderId, visualDefenderId, phase: PHASE.ROLLING_ATTACK };
          // Clear transient hit markers to avoid showing a hit flash when merely selecting a target
          updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
          updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
        } else {
          updates[ARENA_PATH.BATTLE_TURN] = { ...turn, defenderId, phase: PHASE.ROLLING_ATTACK };
          updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
          updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
        }
      } else {
        updates[ARENA_PATH.BATTLE_TURN] = { ...turn, defenderId, phase: PHASE.ROLLING_ATTACK };
        updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
        updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
      }
    } catch (e) {
      updates[ARENA_PATH.BATTLE_TURN] = { ...turn, defenderId, phase: PHASE.ROLLING_ATTACK };
      updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
      updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
    }
    await update(ref(db, `arenas/${arenaId}`), updates);
    return;
  }

  // Power: defender is now known — apply the power
  if (turn.action === TURN_ACTION.POWER && turn.usedPowerIndex != null) {
    const attacker = findFighter(room, attackerId);
    if (!attacker) return;
    const power = attacker.powers?.[turn.usedPowerIndex];
    if (!power) return;

    const updates: Record<string, unknown> = {};

    // ── Imprecated Poem: apply chosen verse to defender, then end turn ──
    const selectedPoem = (turn as { selectedPoem?: string }).selectedPoem;
    if (power.name === POWER_NAMES.IMPRECATED_POEM && selectedPoem) {
      const poemUpdates = applyImprecatedPoem(room, attackerId, defenderId, selectedPoem, battle);
      Object.assign(updates, poemUpdates);

      const battleForTick = updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]
        ? { ...battle, activeEffects: updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] }
        : battle;
      const effectUpdates = await tickEffectsWithSkeletonBlock(arenaId, room, battleForTick, updates);
      Object.assign(updates, effectUpdates);

      // Eternal Agony: add display-only effect after tick (so tick doesn't remove it). ลบหลัง 3 วินาที
      if (selectedPoem === EFFECT_TAGS.ETERNAL_AGONY) {
        const effectsAfterTick = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? [];
        const eternalAgonyEffect: ActiveEffect = {
          id: makeEffectId(attackerId, POWER_NAMES.IMPRECATED_POEM),
          powerName: POWER_NAMES.IMPRECATED_POEM,
          effectType: EFFECT_TYPES.DEBUFF,
          sourceId: String(attackerId),
          targetId: String(defenderId),
          value: 0,
          turnsRemaining: 0,
          tag: EFFECT_TAGS.ETERNAL_AGONY,
          tag2: EFFECT_TAGS.IMPRECATED_POEM,
        };
        updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = [...effectsAfterTick, eternalAgonyEffect];
      }

      const defenderAfter = findFighter(room, defenderId);
      const getHp = (m: FighterState) => {
        const path = findFighterPath(room, m.characterId);
        if (path && `${path}/currentHp` in updates) return updates[`${path}/currentHp`] as number;
        return m.currentHp;
      };
      const logEntry = {
        round: battle.roundNumber,
        attackerId,
        defenderId,
        attackRoll: 0,
        defendRoll: 0,
        damage: 0,
        defenderHpAfter: defenderAfter ? getHp(defenderAfter) : 0,
        eliminated: false,
        missed: false,
        powerUsed: power.name,
        imprecatedPoemVerse: selectedPoem,
      };
      updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), logEntry]);

      const latestEffects = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || battle.activeEffects || [];
      const teamAMembers = (room.teamA?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
      const teamBMembers = (room.teamB?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));

      const END_ARENA_DELAY_MS = 3500;
      if (isTeamEliminated(teamBMembers, latestEffects)) {
        updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: turn.attackerTeam!, phase: PHASE.DONE };
        updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
        await update(roomRef(arenaId), updates);
        setTimeout(() => {
          update(roomRef(arenaId), {
            [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.A,
            [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
            [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
          }).catch(() => { });
        }, END_ARENA_DELAY_MS);
        return;
      }
      if (isTeamEliminated(teamAMembers, latestEffects)) {
        updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: turn.attackerTeam!, phase: PHASE.DONE };
        updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
        await update(roomRef(arenaId), updates);
        setTimeout(() => {
          update(roomRef(arenaId), {
            [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.B,
            [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
            [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
          }).catch(() => { });
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
      const selfRes = applySelfResurrect(nextEntry.characterId, updatedRoom, latestEffects, updates, battle);
      const nextFighter = findFighter(updatedRoom, nextEntry.characterId);
      if (nextFighter && !selfRes && isStunned(latestEffects, nextEntry.characterId)) {
        const { index: skipIdx, wrapped: skipWrapped } = nextAliveIndex(updatedQueue, nextIdx, updatedRoom, latestEffects);
        const skipEntry = updatedQueue[skipIdx];
        updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdx;
        updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = skipWrapped ? battle.roundNumber + 1 : battle.roundNumber;
        const battleForSkip = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
        const dryadSkip = applySecretOfDryadPassive(room, skipEntry.characterId, battleForSkip, 0);
        if (dryadSkip[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, dryadSkip);
        const battleForEfflorescenceMuseSkip = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
        const efflorescenceMuseSkipUpdates = onEfflorescenceMuseTurnStart(room, battleForEfflorescenceMuseSkip, skipEntry.characterId);
        if (efflorescenceMuseSkipUpdates) Object.assign(updates, efflorescenceMuseSkipUpdates);
        updates[ARENA_PATH.BATTLE_TURN] = { attackerId: skipEntry.characterId, attackerTeam: skipEntry.team, phase: PHASE.SELECT_ACTION };
      } else {
        updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
        updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
        const turnData: Record<string, unknown> = { attackerId: nextEntry.characterId, attackerTeam: nextEntry.team, phase: PHASE.SELECT_ACTION };
        if (selfRes) (turnData as Record<string, unknown>).resurrectTargetId = nextEntry.characterId;
        const battleForDryad = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
        const dryadNext = applySecretOfDryadPassive(room, nextEntry.characterId, battleForDryad, 0);
        if (dryadNext[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, dryadNext);
        const battleForEfflorescenceMuse = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
        const efflorescenceMuseUpdates = onEfflorescenceMuseTurnStart(room, battleForEfflorescenceMuse, nextEntry.characterId);
        if (efflorescenceMuseUpdates) Object.assign(updates, efflorescenceMuseUpdates);
        updates[ARENA_PATH.BATTLE_TURN] = turnData;
      }
      await update(roomRef(arenaId), updates);
      // Eternal Agony: เอาเข้าไป 3 วินาทีเสร็จแล้วลบออก — ลบ effect tag ETERNAL_AGONY หลัง 3 วินาที
      if (selectedPoem === EFFECT_TAGS.ETERNAL_AGONY) {
        setTimeout(async () => {
          const snap = await get(roomRef(arenaId));
          const data = snap.val();
          const effects = (data?.battle?.activeEffects ?? []) as ActiveEffect[];
          const filtered = effects.filter(e => e.tag !== EFFECT_TAGS.ETERNAL_AGONY);
          if (filtered.length < effects.length) {
            await update(roomRef(arenaId), { [ARENA_PATH.BATTLE_ACTIVE_EFFECTS]: filtered });
          }
        }, 3000);
      }
      return;
    }

    // Self-buff already applied in selectAction → log after target chosen (self), then dice
    // Beyond the Nimbus: "Caster Beyond the Nimbus" already logged in selectAction; only advance phase here
    if (power.target === TARGET_TYPES.SELF) {
      if (power.name === POWER_NAMES.BEYOND_THE_NIMBUS) {
        updates[ARENA_PATH.BATTLE_TURN] = { ...turn, defenderId, phase: PHASE.ROLLING_ATTACK };
        await update(roomRef(arenaId), updates);
        return;
      }
      const selfLogEntry: Record<string, unknown> = {
        round: battle.roundNumber,
        attackerId,
        defenderId: attackerId,
        attackRoll: 0,
        defendRoll: 0,
        damage: 0,
        defenderHpAfter: attacker.currentHp,
        eliminated: false,
        missed: false,
        powerUsed: power.name,
      };
      updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), selfLogEntry]);
      updates[ARENA_PATH.BATTLE_TURN] = { ...turn, defenderId, phase: PHASE.ROLLING_ATTACK };
      await update(roomRef(arenaId), updates);
      return;
    }

    // For enemy-targeting powers: don't log target selection - will log in resolveTurn after dice
    // Only skipDice powers log immediately (below in skipDice branches)

    if (power.skipDice) {
      // ── Jolt Arc: detonate all shocks on all enemies. Effect plays first, then damage/skeleton after delay. ──
      if (power.name === POWER_NAMES.JOLT_ARC) {
        const { updates: joltUpdates, aoeDamageMap } = applyJoltArc(room, attackerId, battle);
        // Write only turn to RESOLVING so client can play the arc effect; do not apply damage/effects yet.
        updates[ARENA_PATH.BATTLE_TURN] = {
          attackerId,
          attackerTeam: turn.attackerTeam,
          defenderId,
          phase: PHASE.RESOLVING,
          action: TURN_ACTION.POWER,
          usedPowerIndex: turn.usedPowerIndex,
          usedPowerName: power.name,
        };
        await update(roomRef(arenaId), updates);
        // After effect duration, apply damage and skeleton destruction so effect plays before skeleton destroy / damage to master.
        setTimeout(() => {
          applyJoltArcDamagePhase(
            arenaId,
            attackerId,
            aoeDamageMap,
            joltUpdates,
            turn.attackerTeam,
            defenderId,
            turn.usedPowerIndex,
          ).catch(() => { });
        }, JOLT_ARC_EFFECT_MS);
        return;
      } else if (power.name === POWER_NAMES.KERAUNOS_VOLTAGE) {
        // Keraunos Voltage: multi-step targets (1×3 dmg, up to 2×2 dmg) then D4 crit (rate = current caster crit + 25%)
        const isTeamA = (room.teamA?.members || []).some(m => m.characterId === attackerId);
      const enemies = (isTeamA ? (room.teamB?.members || []) : (room.teamA?.members || [])).filter(e => e.currentHp > 0);
      const n = enemies.length;
      const step = turn.keraunosTargetStep ?? 0;
      const mainId = turn.keraunosMainTargetId ?? turn.defenderId;
      const secondaries = turn.keraunosSecondaryTargetIds ?? [];
      const activeEffectsK = battle.activeEffects || [];
      const critBuffK = getStatModifier(activeEffectsK, attackerId, MOD_STAT.CRITICAL_RATE);
      const effectiveCritK = Math.max(attacker.criticalRate ?? 0, (attacker.criticalRate ?? 0) + critBuffK);
      const critRate = Math.min(100, Math.max(0, effectiveCritK + 25));

      if (step === 0) {
        // First click: main target (3 dmg). If only 1 enemy, done; if 2+ need secondaries.
        const nextSecondaries: string[] = [];
        const needMore = n >= 2;
        const turnUpdate: Record<string, unknown> = {
          ...turn,
          defenderId,
          keraunosMainTargetId: defenderId,
          keraunosSecondaryTargetIds: nextSecondaries,
          keraunosTargetStep: needMore ? 2 : null, // null = remove key (Firebase rejects undefined)
        };
        if (!needMore) {
          turnUpdate.phase = PHASE.RESOLVING;
          turnUpdate.critWinFaces = getWinningFaces(critRate);
          turnUpdate.attackRoll = 0;
          turnUpdate.defendRoll = 0; // Keraunos: defender cannot defend
        } else {
          turnUpdate.phase = PHASE.SELECT_TARGET;
        }
        updates[ARENA_PATH.BATTLE_TURN] = turnUpdate;
      } else if (step === 2) {
        // Second click: first 2-dmg target. If 2 enemies done; if 3+ need one more.
        const nextSecondaries = [...secondaries, defenderId];
        const needMore = n >= 3;
        const turnUpdate: Record<string, unknown> = {
          ...turn,
          defenderId: mainId,
          keraunosMainTargetId: mainId,
          keraunosSecondaryTargetIds: nextSecondaries,
          keraunosTargetStep: needMore ? 3 : null,
        };
        if (!needMore) {
          turnUpdate.phase = PHASE.RESOLVING;
          turnUpdate.critWinFaces = getWinningFaces(critRate);
          turnUpdate.attackRoll = 0;
          turnUpdate.defendRoll = 0; // Keraunos: defender cannot defend
        } else {
          turnUpdate.phase = PHASE.SELECT_TARGET;
        }
        updates[ARENA_PATH.BATTLE_TURN] = turnUpdate;
      } else if (step === 3) {
        // Third click: second 2-dmg target → done (3+ enemies)
        const nextSecondaries = [...secondaries, defenderId];
        updates[ARENA_PATH.BATTLE_TURN] = {
          ...turn,
          defenderId: mainId,
          keraunosMainTargetId: mainId,
          keraunosSecondaryTargetIds: nextSecondaries,
          keraunosTargetStep: null, // remove key when done
          phase: PHASE.RESOLVING,
          critWinFaces: getWinningFaces(critRate),
          attackRoll: 0,
          defendRoll: 0, // Keraunos: defender cannot defend
        };
      }

      // ── Generic skipDice power ──
    } else {
      let damageDealt = 0;
      let defenderHpAfterLog = findFighter(room, defenderId)?.currentHp ?? 0;

      if (power.effect === EFFECT_TYPES.DAMAGE || power.effect === EFFECT_TYPES.LIFESTEAL) {
        const defender = findFighter(room, defenderId);
        if (defender) {
          const powerResolve = await resolveHitAtDefender(arenaId, room, defenderId, power.value, updates, defender);
          if (powerResolve.skippedMinionsPath) delete updates[powerResolve.skippedMinionsPath];
          const defPath = findFighterPath(room, defenderId);
          if (defPath && powerResolve.damageToMaster > 0) {
            const cur = (updates[`${defPath}/currentHp`] as number | undefined) ?? defender.currentHp;
            updates[`${defPath}/currentHp`] = Math.max(0, cur - powerResolve.damageToMaster);
          }
          if (power.effect === EFFECT_TYPES.LIFESTEAL && powerResolve.damageToMaster > 0) {
            const atkPath = findFighterPath(room, attackerId);
            if (atkPath) {
              const att = findFighter(room, attackerId);
              const curAtt = (updates[`${atkPath}/currentHp`] as number | undefined) ?? att?.currentHp ?? 0;
              updates[`${atkPath}/currentHp`] = Math.min(att?.maxHp ?? 999, curAtt + Math.ceil(powerResolve.damageToMaster * 0.5));
            }
          }
          damageDealt = powerResolve.damageToMaster;
          defenderHpAfterLog = defPath ? (updates[`${defPath}/currentHp`] as number) : defender.currentHp;
        }
      } else {
        const effectUpdates = applyPowerEffect(room, attackerId, defenderId, power, battle);
        Object.assign(updates, effectUpdates);
        defenderHpAfterLog = findFighter(room, defenderId)?.currentHp ?? 0;
        const defPath = findFighterPath(room, defenderId);
        if (defPath && `${defPath}/currentHp` in updates) defenderHpAfterLog = updates[`${defPath}/currentHp`] as number;
      }

      const logEntry = {
        round: battle.roundNumber,
        attackerId,
        defenderId,
        attackRoll: 0,
        defendRoll: 0,
        damage: damageDealt,
        defenderHpAfter: defenderHpAfterLog,
        eliminated: defenderHpAfterLog <= 0,
        missed: false,
        powerUsed: power.name,
      };
      updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), logEntry]);

      updates[ARENA_PATH.BATTLE_TURN] = {
        attackerId,
        attackerTeam: turn.attackerTeam,
        defenderId,
        phase: PHASE.RESOLVING,
        action: TURN_ACTION.POWER,
        usedPowerIndex: turn.usedPowerIndex,
        usedPowerName: power.name,
      };
    }

    await update(roomRef(arenaId), updates);
    return;
  }

  // Non-skipDice enemy power — go through dice rolling, unless Soul Devourer drain
  if (hasSoulDevourerEffect(battle.activeEffects || [], attackerId) && powerCanAttack(power)) {
    const defender = findFighter(room, defenderId);
    const targetLogEntry = {
      round: battle.roundNumber,
      attackerId,
      defenderId,
      attackRoll: 0,
      defendRoll: 0,
      damage: 0,
      defenderHpAfter: defender?.currentHp ?? 0,
      eliminated: false,
      missed: false,
      powerUsed: power.name,
    };
    updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), targetLogEntry]);
    const turnUpdate: Record<string, unknown> = {
      ...turn,
      defenderId,
      phase: PHASE.RESOLVING,
      action: TURN_ACTION.POWER,
      usedPowerIndex: turn.usedPowerIndex,
      usedPowerName: power.name,
      attackRoll: 0,
      defendRoll: 0,
      soulDevourerDrain: true,
    };
    updates[ARENA_PATH.BATTLE_TURN] = turnUpdate;
    updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
    updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
    await update(roomRef(arenaId), updates);
    return;
  }

  // Non-skipDice enemy power — log after target chosen, then go through dice rolling
  const defenderForLog = findFighter(room, defenderId);
  const targetLogEntry = {
    round: battle.roundNumber,
    attackerId,
    defenderId,
    attackRoll: 0,
    defendRoll: 0,
    damage: 0,
    defenderHpAfter: defenderForLog?.currentHp ?? 0,
    eliminated: false,
    missed: false,
    powerUsed: power.name,
  };
  updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), targetLogEntry]);
  updates[ARENA_PATH.BATTLE_TURN] = { ...turn, defenderId, phase: PHASE.ROLLING_ATTACK };
  await update(roomRef(arenaId), updates);
  return;
}

// Fallback: no action set
await update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), {
  defenderId,
  phase: PHASE.ROLLING_ATTACK,
});
}

/* ── select action (attack or use power) ─────────────── */

export async function selectAction(
  arenaId: string,
  action: TurnAction,
  powerIndex?: number,
  allyTargetId?: string,
): Promise<void> {
  if (action === TURN_ACTION.ATTACK) {
    const snap = await get(roomRef(arenaId));
    if (!snap.exists()) return;
    const room = snap.val() as BattleRoom;
    const battle = room.battle;
    if (!battle?.turn) return;
    const turn = battle.turn;
    const { attackerId } = turn;
    const activeEffects = battle.activeEffects || [];
    // Disoriented: do not pick target here — client shows modal (Random → Confirm), then calls selectTarget
    const hasDisoriented = activeEffects.some(e => e.targetId === attackerId && e.tag === EFFECT_TAGS.DISORIENTED);
    if (hasDisoriented) {
      const validIds = getValidTargetIds(room, { ...turn, action: TURN_ACTION.ATTACK }, activeEffects);
      if (validIds.length === 0) {
        await update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), {
          ...turn,
          action: TURN_ACTION.ATTACK,
          phase: PHASE.SELECT_TARGET,
        });
        await skipTurnNoValidTarget(arenaId);
        return;
      }
      await update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), {
        ...turn,
        action: TURN_ACTION.ATTACK,
        phase: PHASE.SELECT_TARGET,
      });
      return;
    }
    await update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), {
      ...turn,
      action: TURN_ACTION.ATTACK,
      phase: PHASE.SELECT_TARGET,
    });
    return;
  }

  // --- Use a power ---
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle?.turn || powerIndex == null) return;

  const { attackerId } = battle.turn;

  const attacker = findFighter(room, attackerId);
  if (!attacker) return;

  const power = attacker.powers?.[powerIndex];
  if (!power) return;

  const cost = getQuotaCost(power.type);
  if (attacker.quota < cost) return; // insufficient quota

  const atkPath = findFighterPath(room, attackerId);
  const updates: Record<string, unknown> = {};

  // Soul Devourer: Use Power that cannot attack → end turn (no quota spent; resolveTurn will advance)
  // Exceptions: Shadow Camouflaging (D4 refill flow); Undead Army (must apply to add 2nd skeleton)
  if (hasSoulDevourerEffect(battle.activeEffects || [], attackerId) && !powerCanAttack(power) && power.name !== POWER_NAMES.SHADOW_CAMOUFLAGING && power.name !== POWER_NAMES.UNDEAD_ARMY) {
    updates[ARENA_PATH.BATTLE_TURN] = {
      attackerId,
      attackerTeam: battle.turn.attackerTeam,
      phase: PHASE.RESOLVING,
      action: TURN_ACTION.POWER,
      usedPowerIndex: powerIndex,
      usedPowerName: power.name,
      soulDevourerEndTurnOnly: true,
    };
    await update(roomRef(arenaId), updates);
    return;
  }

  // Deduct quota
  if (atkPath) updates[`${atkPath}/quota`] = attacker.quota - cost;

  // ── Season selection power (e.g. Persephone's Ephemeral Season): go to season selection ──
  // Also check canonical definition so rooms created before the flag was added still work
  const canonicalPower = getPowers(attacker.deityBlood)?.find(p => p.name === power.name);
  if (power.requiresSeasonSelection || canonicalPower?.requiresSeasonSelection) {
    updates[ARENA_PATH.BATTLE_TURN] = {
      attackerId,
      attackerTeam: battle.turn.attackerTeam,
      phase: PHASE.SELECT_SEASON,
      action: TURN_ACTION.POWER,
      usedPowerIndex: powerIndex,
      usedPowerName: power.name,
    };
    await update(roomRef(arenaId), updates);
    return;
  }

  // ── Poem selection power (e.g. Apollo's Imprecated Poem): go to poem verse selection ──
  if (power.requiresPoemSelection || canonicalPower?.requiresPoemSelection) {
    updates[ARENA_PATH.BATTLE_TURN] = {
      attackerId,
      attackerTeam: battle.turn.attackerTeam,
      phase: PHASE.SELECT_POEM,
      action: TURN_ACTION.POWER,
      usedPowerIndex: powerIndex,
      usedPowerName: power.name,
    };
    await update(roomRef(arenaId), updates);
    return;
  }

  // ── Ally-targeting power ──
  if (power.target === TARGET_TYPES.ALLY && allyTargetId) {
    // ── Death Keeper: resurrect dead ally, free action (return to select-action) ──
    if (power.name === POWER_NAMES.DEATH_KEEPER) {
      const target = findFighter(room, allyTargetId);
      if (!target || target.currentHp > 0) return; // target must be dead

      const effects = [...(battle.activeEffects || [])];
      const dkEffect = effects.find(e => e.targetId === attackerId && e.tag === EFFECT_TAGS.DEATH_KEEPER);
      if (!dkEffect) return; // no death-keeper available

      // Resurrect at 50% max HP
      const resHp = Math.ceil(target.maxHp * 0.5);
      const targetPath = findFighterPath(room, allyTargetId);
      if (targetPath) updates[`${targetPath}/currentHp`] = resHp;

      // Consume death-keeper, add resurrected tag on target
      const cleaned = effects.filter(e => e.id !== dkEffect.id);
      cleaned.push({
        id: `${attackerId}::Death Keeper Risen`,
        powerName: POWER_NAMES.DEATH_KEEPER,
        effectType: 'buff' as const,
        sourceId: attackerId,
        targetId: allyTargetId,
        value: 0,
        turnsRemaining: 999,
        tag: 'resurrected',
      });
      updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = cleaned;

      // Log entry
      const logEntry = {
        round: battle.roundNumber,
        attackerId,
        defenderId: allyTargetId,
        attackRoll: 0,
        defendRoll: 0,
        damage: 0,
        defenderHpAfter: resHp,
        eliminated: false,
        missed: false,
        powerUsed: POWER_NAMES.DEATH_KEEPER,
        resurrectTargetId: allyTargetId,
        resurrectHpRestored: resHp,
      };
      updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), logEntry]);

      // Free action: return to select-action (don't advance turn)
      updates[ARENA_PATH.BATTLE_TURN] = {
        attackerId,
        attackerTeam: battle.turn!.attackerTeam,
        phase: PHASE.SELECT_ACTION,
        resurrectTargetId: allyTargetId,
      };

      await update(roomRef(arenaId), updates);
      return;
    }

    // ── Apollo's Hymn: heal self + 1 ally 2 HP each, +25% crit 2 rounds (no stack), then end turn ──
    if (power.name === POWER_NAMES.APOLLO_S_HYMN) {
      const hymnUpdates = applyApolloHymn(room, attackerId, allyTargetId, battle);
      Object.assign(updates, hymnUpdates);

      const battleForTick = updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]
        ? { ...battle, activeEffects: updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] }
        : battle;
      const effectUpdates = await tickEffectsWithSkeletonBlock(arenaId, room, battleForTick, updates);
      Object.assign(updates, effectUpdates);

      const allyAfter = findFighter(room, allyTargetId);
      const getHp = (m: FighterState) => {
        const path = findFighterPath(room, m.characterId);
        if (path && `${path}/currentHp` in updates) return updates[`${path}/currentHp`] as number;
        return m.currentHp;
      };
      const logEntry = {
        round: battle.roundNumber,
        attackerId,
        defenderId: allyTargetId,
        attackRoll: 0,
        defendRoll: 0,
        damage: 0,
        heal: 2,
        defenderHpAfter: allyAfter ? getHp(allyAfter) : 0,
        eliminated: false,
        missed: false,
        powerUsed: power.name,
      };
      updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), logEntry]);

      const latestEffects = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || battle.activeEffects || [];
      const teamAMembers = (room.teamA?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
      const teamBMembers = (room.teamB?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));

      const END_ARENA_DELAY_MS = 3500;
      if (isTeamEliminated(teamBMembers, latestEffects)) {
        updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: battle.turn!.attackerTeam, phase: PHASE.DONE };
        updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
        await update(roomRef(arenaId), updates);
        setTimeout(() => {
          update(roomRef(arenaId), {
            [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.A,
            [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
            [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
          }).catch(() => { });
        }, END_ARENA_DELAY_MS);
        return;
      }
      if (isTeamEliminated(teamAMembers, latestEffects)) {
        updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: battle.turn!.attackerTeam, phase: PHASE.DONE };
        updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
        await update(roomRef(arenaId), updates);
        setTimeout(() => {
          update(roomRef(arenaId), {
            [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.B,
            [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
            [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
          }).catch(() => { });
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
      const selfResHymn = applySelfResurrect(nextEntry.characterId, updatedRoom, latestEffects, updates, battle);
      const nextFighterHymn = findFighter(updatedRoom, nextEntry.characterId);
      if (nextFighterHymn && !selfResHymn && isStunned(latestEffects, nextEntry.characterId)) {
        const { index: skipIdx, wrapped: skipWrapped } = nextAliveIndex(updatedQueue, nextIdx, updatedRoom, latestEffects);
        const skipEntry = updatedQueue[skipIdx];
        updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdx;
        updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = skipWrapped ? battle.roundNumber + 1 : battle.roundNumber;
        const battleForSkip = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
        const dryadSkip = applySecretOfDryadPassive(room, skipEntry.characterId, battleForSkip, 0);
        if (dryadSkip[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, dryadSkip);
        const battleForEfflorescenceMuseSkip = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
        const efflorescenceMuseSkipUpdates = onEfflorescenceMuseTurnStart(room, battleForEfflorescenceMuseSkip, skipEntry.characterId);
        if (efflorescenceMuseSkipUpdates) Object.assign(updates, efflorescenceMuseSkipUpdates);
        updates[ARENA_PATH.BATTLE_TURN] = { attackerId: skipEntry.characterId, attackerTeam: skipEntry.team, phase: PHASE.SELECT_ACTION };
      } else {
        updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
        updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
        const turnData: Record<string, unknown> = { attackerId: nextEntry.characterId, attackerTeam: nextEntry.team, phase: PHASE.SELECT_ACTION };
        if (selfResHymn) (turnData as Record<string, unknown>).resurrectTargetId = nextEntry.characterId;
        const battleForDryad = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
        const dryadNext = applySecretOfDryadPassive(room, nextEntry.characterId, battleForDryad, 0);
        if (dryadNext[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, dryadNext);
        const battleForEfflorescenceMuse = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
        const efflorescenceMuseUpdates = onEfflorescenceMuseTurnStart(room, battleForEfflorescenceMuse, nextEntry.characterId);
        if (efflorescenceMuseUpdates) Object.assign(updates, efflorescenceMuseUpdates);
        updates[ARENA_PATH.BATTLE_TURN] = turnData;
      }
      await update(roomRef(arenaId), updates);
      return;
    }

    // ── Pomegranate's Oath: apply buff + end turn immediately (like confirmSeason) ──
    if (power.name === POWER_NAMES.POMEGRANATES_OATH) {
      const oathUpdates = applyPomegranateOath(room, attackerId, allyTargetId, battle);
      Object.assign(updates, oathUpdates);

      // Sync activeEffects into battle for tickEffects
      const battleForTick = updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]
        ? { ...battle, activeEffects: updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] }
        : battle;

      // Tick active effects (DOT, spring heal, decrement durations); DOT damage via resolveHitAtDefender
      const effectUpdates = await tickEffectsWithSkeletonBlock(arenaId, room, battleForTick, updates);
      Object.assign(updates, effectUpdates);

      const ally = findFighter(room, allyTargetId);
      const logEntry = {
        round: battle.roundNumber,
        attackerId,
        defenderId: allyTargetId,
        attackRoll: 0,
        defendRoll: 0,
        damage: 0,
        defenderHpAfter: ally ? ally.currentHp : 0,
        eliminated: false,
        missed: false,
        powerUsed: power.name,
      };
      updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), logEntry]);

      // Win condition check (DOT from tick may have eliminated someone)
      const getHp = (m: FighterState) => {
        const path = findFighterPath(room, m.characterId);
        if (path && `${path}/currentHp` in updates) return updates[`${path}/currentHp`] as number;
        return m.currentHp;
      };
      const teamAMembers = (room.teamA?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
      const teamBMembers = (room.teamB?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));

      // Advance turn (same pattern as confirmSeason)
      const latestEffects = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || battle.activeEffects || [];

      const END_ARENA_DELAY_MS = 3500;
      if (isTeamEliminated(teamBMembers, latestEffects)) {
        updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: battle.turn!.attackerTeam, phase: PHASE.DONE };
        updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
        await update(roomRef(arenaId), updates);
        setTimeout(() => {
          update(roomRef(arenaId), {
            [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.A,
            [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
            [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
          }).catch(() => { });
        }, END_ARENA_DELAY_MS);
        return;
      }
      if (isTeamEliminated(teamAMembers, latestEffects)) {
        updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: battle.turn!.attackerTeam, phase: PHASE.DONE };
        updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
        await update(roomRef(arenaId), updates);
        setTimeout(() => {
          update(roomRef(arenaId), {
            [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.B,
            [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
            [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
          }).catch(() => { });
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

      // Death Keeper: self-resurrect if next fighter is dead with death-keeper
      const selfRes1 = applySelfResurrect(nextEntry.characterId, updatedRoom, latestEffects, updates, battle);

      const nextFighter = findFighter(updatedRoom, nextEntry.characterId);
      if (nextFighter && !selfRes1 && isStunned(latestEffects, nextEntry.characterId)) {
        updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
        updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
        const { index: skipIdx, wrapped: skipWrapped } = nextAliveIndex(updatedQueue, nextIdx, updatedRoom, latestEffects);
        const skipEntry = updatedQueue[skipIdx];
        updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdx;
        if (skipWrapped) updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = (updates[ARENA_PATH.BATTLE_ROUND_NUMBER] as number || battle.roundNumber) + 1;
        updates[ARENA_PATH.BATTLE_TURN] = { attackerId: skipEntry.characterId, attackerTeam: skipEntry.team, phase: PHASE.SELECT_ACTION };
        const battleForDryadS1 = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
        const d1 = applySecretOfDryadPassive(room, skipEntry.characterId, battleForDryadS1, 0);
        if (d1[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, d1);
      } else {
        updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
        updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
        const turnData: Record<string, unknown> = { attackerId: nextEntry.characterId, attackerTeam: nextEntry.team, phase: PHASE.SELECT_ACTION };
        if (selfRes1) turnData.resurrectTargetId = nextEntry.characterId;
        updates[ARENA_PATH.BATTLE_TURN] = turnData;
        const battleForDryadN1 = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
        const d2 = applySecretOfDryadPassive(room, nextEntry.characterId, battleForDryadN1, 0);
        if (d2[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, d2);
      }

      await update(roomRef(arenaId), updates);
      return;
    }

    // ── Floral Fragrance: if target has Efflorescence Muse (and not Healing Nullified), roll D4 for heal crit first ──
    const ally = findFighter(room, allyTargetId);
    const attacker = findFighter(room, attackerId);
    const allyHasEfflorescenceMuse = (battle.activeEffects || []).some(
      (e) => e.targetId === allyTargetId && e.tag === EFFECT_TAGS.EFFLORESCENCE_MUSE,
    );
    const allyHasHealingNullified = isHealingNullified(battle.activeEffects || [], allyTargetId);

    // Heal skipped (e.g. สูญสิ้นเยียวยา): show modal, wait for caster to ack, then log heal 0 and advance — no D4 roll.
    if (power.name === POWER_NAMES.FLORAL_FRAGRANCE && allyHasHealingNullified && ally && attacker) {
      updates[ARENA_PATH.BATTLE_TURN] = {
        attackerId,
        attackerTeam: battle.turn.attackerTeam,
        phase: PHASE.ROLLING_FLORAL_HEAL,
        action: TURN_ACTION.POWER,
        usedPowerIndex: powerIndex,
        usedPowerName: power.name,
        allyTargetId,
        floralHealSkipped: true,
        healSkipReason: EFFECT_TAGS.HEALING_NULLIFIED,
      };
      await update(roomRef(arenaId), updates);
      return;
    }

    if (power.name === POWER_NAMES.FLORAL_FRAGRANCE && allyHasEfflorescenceMuse && ally && attacker) {
      // Heal crit rate = target's critical rate (same as attack crit)
      const baseCritRate = typeof ally.criticalRate === 'number' ? ally.criticalRate : 25;
      const critMod = getStatModifier(battle.activeEffects || [], allyTargetId, MOD_STAT.CRITICAL_RATE);
      const healCritRate = Math.min(100, Math.max(0, baseCritRate + critMod));
      const winFaces = getWinningFaces(healCritRate);
      updates[ARENA_PATH.BATTLE_TURN] = {
        attackerId,
        attackerTeam: battle.turn.attackerTeam,
        phase: PHASE.ROLLING_FLORAL_HEAL,
        action: TURN_ACTION.POWER,
        usedPowerIndex: powerIndex,
        usedPowerName: power.name,
        allyTargetId,
        floralHealWinFaces: winFaces,
      };
      await update(roomRef(arenaId), updates);
      return;
    }

    // ── Floral Fragrance (no Muse) or other ally powers: apply heal/buff, then follow-up normal attack ──
    const floralFragranceUpdates = applyFloralFragranced(room, attackerId, allyTargetId, battle, power);
    Object.assign(updates, floralFragranceUpdates);

    const floralHeal = attacker ? Math.ceil(0.2 * attacker.maxHp) : 0;
    const defenderHpAfterFloral = ally ? Math.min(ally.currentHp + floralHeal, ally.maxHp) : 0;
    const logEntry = {
      round: battle.roundNumber,
      attackerId,
      defenderId: allyTargetId,
      attackRoll: 0,
      defendRoll: 0,
      damage: 0,
      heal: floralHeal,
      defenderHpAfter: defenderHpAfterFloral,
      eliminated: false,
      missed: false,
      powerUsed: power.name,
    };
    updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), logEntry]);

    updates[ARENA_PATH.BATTLE_TURN] = {
      attackerId,
      attackerTeam: battle.turn.attackerTeam,
      phase: PHASE.SELECT_TARGET,
      action: TURN_ACTION.ATTACK,
      usedPowerIndex: powerIndex,
      usedPowerName: power.name,
      allyTargetId,
    };
    await update(roomRef(arenaId), updates);
    return;
  }

  // ── Self-buff power (non-skipDice): apply buff now, then select target for dice ──
  if (!power.skipDice && power.target === TARGET_TYPES.SELF && (power.effect === EFFECT_TYPES.BUFF || power.effects)) {
    const adjusted = power.effects
      ? { ...power, effects: power.effects.map(e => ({ ...e, duration: e.duration + 1 })) }
      : { ...power, duration: power.duration + 1 };
    const effectUpdates = applyPowerEffect(room, attackerId, attackerId, adjusted as PowerDefinition, battle);
    Object.assign(updates, effectUpdates);

    // Beyond the Nimbus: log "Caster Beyond the Nimbus" at confirm (here); other self-buffs log in selectTarget
    if (power.name === POWER_NAMES.BEYOND_THE_NIMBUS) {
      const nimbusEntry: Record<string, unknown> = {
        round: battle.roundNumber,
        attackerId,
        defenderId: attackerId,
        attackRoll: 0,
        defendRoll: 0,
        damage: 0,
        defenderHpAfter: attacker.currentHp,
        eliminated: false,
        missed: false,
        beyondTheNimbus: true,
        attackerName: attacker.nicknameEng,
        attackerTheme: attacker.theme?.[0],
        defenderName: attacker.nicknameEng,
        defenderTheme: attacker.theme?.[0],
      };
      updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), nimbusEntry]);
    }

    updates[ARENA_PATH.BATTLE_TURN] = {
      attackerId,
      attackerTeam: battle.turn.attackerTeam,
      phase: PHASE.SELECT_TARGET,
      action: TURN_ACTION.POWER,
      usedPowerIndex: powerIndex,
      usedPowerName: power.name,
    };
    await update(roomRef(arenaId), updates);
    return;
  }

  // ── Soul Devourer (Hades Ultimate): no stack; new select = reset to full 3 rounds (no add, no stack) ──
  const SOUL_DEVOURER_DURATION_ROUNDS = 3;
  if (power.name === POWER_NAMES.SOUL_DEVOURER) {
    const queueLen = battle.turnQueue?.length || 1;
    const soulDevourerTurns = queueLen * SOUL_DEVOURER_DURATION_ROUNDS;
    const existing = battle.activeEffects || [];
    const existingSoulDevourer = existing.find(e => e.targetId === attackerId && e.tag === EFFECT_TAGS.SOUL_DEVOURER);
    const newEffects: ActiveEffect[] = existingSoulDevourer
      ? existing.map(e => e === existingSoulDevourer ? { ...e, turnsRemaining: soulDevourerTurns } : e)
      : [...existing, {
        id: makeEffectId(attackerId, power.name),
        powerName: power.name,
        effectType: EFFECT_TYPES.BUFF,
        sourceId: attackerId,
        targetId: attackerId,
        value: 0,
        turnsRemaining: soulDevourerTurns,
        tag: EFFECT_TAGS.SOUL_DEVOURER,
      }];
    updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = newEffects;

    // Cast Undead Army immediately (summon skeleton; max 2)
    const undeadArmyPower = attacker.powers?.find(p => p.name === POWER_NAMES.UNDEAD_ARMY);
    if (undeadArmyPower) {
      const battleWithSoul = { ...battle, activeEffects: newEffects };
      const uaUpdates = applyPowerEffect(room, attackerId, attackerId, undeadArmyPower, battleWithSoul);
      Object.assign(updates, uaUpdates);
    }

    // Log using Soul Devourer after confirm, before going to select target
    const soulDevourerConfirmLog = {
      round: battle.roundNumber,
      attackerId,
      defenderId: attackerId,
      attackRoll: 0,
      defendRoll: 0,
      damage: 0,
      defenderHpAfter: attacker.currentHp ?? 0,
      eliminated: false,
      missed: false,
      powerUsed: power.name,
      pendingTarget: true,
    };
    updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), soulDevourerConfirmLog]);

    // Then go to select target
    updates[ARENA_PATH.BATTLE_TURN] = {
      attackerId,
      attackerTeam: battle.turn.attackerTeam,
      phase: PHASE.SELECT_TARGET,
      action: TURN_ACTION.ATTACK, // immediate attack (skeleton can assist)
    };
    await update(roomRef(arenaId), updates);
    return;
  }

  // ── Self-buff power (skipDice): apply buff, end turn immediately (no follow-up attack) ──
  // (e.g., Shadow Camouflaging, or any self-buff that ends turn without attacking)
  // Check both stored and canonical definitions to support battles created before power updates
  const canonicalPower2 = getPowers(attacker.deityBlood)?.find(p => p.name === power.name);
  const isSkipDiceSelfBuff = (
    (power.skipDice || canonicalPower2?.skipDice) &&
    (power.target === TARGET_TYPES.SELF || canonicalPower2?.target === TARGET_TYPES.SELF) &&
    (power.effect === EFFECT_TYPES.BUFF || power.effects || canonicalPower2?.effect === EFFECT_TYPES.BUFF || canonicalPower2?.effects)
  );

  if (isSkipDiceSelfBuff) {
    // Use canonical power if available for latest definition
    const activePower = canonicalPower2 || power;
    const effectUpdates = applyPowerEffect(room, attackerId, attackerId, activePower, battle);
    Object.assign(updates, effectUpdates);

    // Shadow Camouflaging: show D4 roll for 25% refill SP (quota); server sets winning faces, player taps to roll (like crit D4)
    if (power.name === POWER_NAMES.SHADOW_CAMOUFLAGING) {
      const winFaces = getWinningFaces(25); // 25% = 1 winning face
      updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), {
        round: battle.roundNumber,
        attackerId,
        defenderId: attackerId,
        attackRoll: 0,
        defendRoll: 0,
        damage: 0,
        defenderHpAfter: attacker.currentHp,
        eliminated: false,
        missed: false,
        powerUsed: power.name,
      }]);
      updates[ARENA_PATH.BATTLE_TURN] = {
        attackerId,
        attackerTeam: battle.turn!.attackerTeam,
        defenderId: attackerId,
        phase: PHASE.RESOLVING,
        action: TURN_ACTION.POWER,
        usedPowerIndex: powerIndex,
        usedPowerName: power.name,
        shadowCamouflageRefillWinFaces: winFaces,
      };
      updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
      updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
      await update(roomRef(arenaId), updates);
      return;
    }

    // Sync activeEffects into battle for tickEffects
    const battleForTick = updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]
      ? { ...battle, activeEffects: updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] }
      : battle;

    // Tick active effects (DOT, spring heal, decrement durations); DOT damage via resolveHitAtDefender
    const effectUpdates2 = await tickEffectsWithSkeletonBlock(arenaId, room, battleForTick, updates);
    Object.assign(updates, effectUpdates2);

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
      powerUsed: power.name,
    };
    updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), logEntry]);

    // Win condition check (DOT from tick may have eliminated someone)
    const getHp = (m: FighterState) => {
      const path = findFighterPath(room, m.characterId);
      if (path && `${path}/currentHp` in updates) return updates[`${path}/currentHp`] as number;
      return m.currentHp;
    };
    const teamAMembers = (room.teamA?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
    const teamBMembers = (room.teamB?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));

    // Advance turn (same pattern as confirmSeason)
    const latestEffects = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || battle.activeEffects || [];

    const END_ARENA_DELAY_MS = 3500;
    if (isTeamEliminated(teamBMembers, latestEffects)) {
      updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: battle.turn!.attackerTeam, phase: PHASE.DONE };
      updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
      await update(roomRef(arenaId), updates);
      setTimeout(() => {
        update(roomRef(arenaId), {
          [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.A,
          [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
          [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
        }).catch(() => { });
      }, END_ARENA_DELAY_MS);
      return;
    }
    if (isTeamEliminated(teamAMembers, latestEffects)) {
      updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: battle.turn!.attackerTeam, phase: PHASE.DONE };
      updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
      await update(roomRef(arenaId), updates);
      setTimeout(() => {
        update(roomRef(arenaId), {
          [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.B,
          [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
          [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
        }).catch(() => { });
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

    // Death Keeper: self-resurrect if next fighter is dead with death-keeper
    const selfRes1 = applySelfResurrect(nextEntry.characterId, updatedRoom, latestEffects, updates, battle);

    const nextFighter = findFighter(updatedRoom, nextEntry.characterId);
    if (nextFighter && !selfRes1 && isStunned(latestEffects, nextEntry.characterId)) {
      updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
      updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
      const { index: skipIdx, wrapped: skipWrapped } = nextAliveIndex(updatedQueue, nextIdx, updatedRoom, latestEffects);
      const skipEntry = updatedQueue[skipIdx];
      updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdx;
      if (skipWrapped) updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = (updates[ARENA_PATH.BATTLE_ROUND_NUMBER] as number || battle.roundNumber) + 1;
      updates[ARENA_PATH.BATTLE_TURN] = { attackerId: skipEntry.characterId, attackerTeam: skipEntry.team, phase: PHASE.SELECT_ACTION };
    } else {
      updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
      updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
      const turnData: Record<string, unknown> = { attackerId: nextEntry.characterId, attackerTeam: nextEntry.team, phase: PHASE.SELECT_ACTION };
      if (selfRes1) turnData.resurrectTargetId = nextEntry.characterId;
      updates[ARENA_PATH.BATTLE_TURN] = turnData;
    }

    await update(roomRef(arenaId), updates);
    return;
  }

  // ── Area power (no target selection; targets entire enemy team, e.g. Jolt Arc) ──
  if (power.target === TARGET_TYPES.AREA && power.name === POWER_NAMES.JOLT_ARC) {
    const { updates: joltUpdates, aoeDamageMap } = applyJoltArc(room, attackerId, battle);
    const isTeamA = (room.teamA?.members || []).some(m => m.characterId === attackerId);
    const enemies = isTeamA ? (room.teamB?.members || []) : (room.teamA?.members || []);
    const firstEnemy = enemies.find(e => e.currentHp > 0);
    const primaryDefenderId = firstEnemy?.characterId ?? '';
    // Write only turn to RESOLVING so client can play the arc effect; do not apply damage/effects yet.
    updates[ARENA_PATH.BATTLE_TURN] = {
      attackerId,
      attackerTeam: battle.turn.attackerTeam,
      defenderId: primaryDefenderId,
      phase: PHASE.RESOLVING,
      action: TURN_ACTION.POWER,
      usedPowerIndex: powerIndex,
      usedPowerName: power.name,
    };
    await update(roomRef(arenaId), updates);
    // After effect duration, apply damage and skeleton destruction so effect plays before skeleton destroy / damage to master.
    setTimeout(() => {
      applyJoltArcDamagePhase(
        arenaId,
        attackerId,
        aoeDamageMap,
        joltUpdates,
        battle.turn?.attackerTeam,
        primaryDefenderId,
        powerIndex,
      ).catch(() => { });
    }, JOLT_ARC_EFFECT_MS);
    return;
  }

  // ── Keraunos Voltage: D4 crit roll before target selection (rate = current caster crit + 25%) ──
  if (power.name === POWER_NAMES.KERAUNOS_VOLTAGE) {
    const activeEffects = battle.activeEffects || [];
    const critBuff = getStatModifier(activeEffects, attackerId, MOD_STAT.CRITICAL_RATE);
    const effectiveCrit = Math.max(attacker.criticalRate ?? 0, (attacker.criticalRate ?? 0) + critBuff);
    const critRate = Math.min(100, Math.max(0, effectiveCrit + 25));
    const winFaces = getWinningFaces(critRate);
    const autoCrit = critRate >= 100;
    updates[ARENA_PATH.BATTLE_TURN] = {
      attackerId,
      attackerTeam: battle.turn.attackerTeam,
      phase: PHASE.SELECT_TARGET,
      action: TURN_ACTION.POWER,
      usedPowerIndex: powerIndex,
      usedPowerName: power.name,
      keraunosAwaitingCrit: !autoCrit,
      critWinFaces: winFaces,
      ...(autoCrit ? { isCrit: true, critRoll: 0 } : {}),
    };
    await update(roomRef(arenaId), updates);
    return;
  }

  // ── Enemy-targeting power (skipDice or dice): store choice, go to target selection ──
  // Power effects will be applied in selectTarget(); log only after target is chosen
  // (Self-buff e.g. Beyond the Nimbus is handled above and returns earlier.)
  const turnForTargets = {
    attackerId,
    attackerTeam: battle.turn.attackerTeam,
    phase: PHASE.SELECT_TARGET,
    action: TURN_ACTION.POWER,
    usedPowerIndex: powerIndex,
    usedPowerName: power.name,
  };
  // Disoriented: do not pick target here — client shows modal (Random → Confirm), then calls selectTarget
  const activeEffectsForDisoriented = battle.activeEffects || [];
  const hasDisorientedPower = activeEffectsForDisoriented.some(e => e.targetId === attackerId && e.tag === EFFECT_TAGS.DISORIENTED);
  if (hasDisorientedPower) {
    const validIds = getValidTargetIds(room, turnForTargets, activeEffectsForDisoriented);
    if (validIds.length === 0) {
      updates[ARENA_PATH.BATTLE_TURN] = { ...turnForTargets };
      await update(roomRef(arenaId), updates);
      await skipTurnNoValidTarget(arenaId);
      return;
    }
    updates[ARENA_PATH.BATTLE_TURN] = turnForTargets;
    await update(roomRef(arenaId), updates);
    return;
  }
  updates[ARENA_PATH.BATTLE_TURN] = turnForTargets;
  await update(roomRef(arenaId), updates);
}

/* ── select season for Persephone's Ephemeral Season power ────── */

export async function selectSeason(
  arenaId: string,
  season: SeasonKey,
): Promise<void> {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle?.turn) return;

  // Update turn with selected season
  const updates: Record<string, unknown> = {
    [ARENA_PATH.BATTLE_TURN_SELECTED_SEASON]: season,
    // Will transition to select-target on client after 3-second delay for visual effects
  };

  await update(roomRef(arenaId), updates);
  /* eslint-enable @typescript-eslint/no-unused-vars */
}

/* ── confirm poem verse (Imprecated Poem): store selection and go to select target ─── */

export async function confirmPoem(arenaId: string, poemTag: string): Promise<void> {
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

/* ── cancel season selection: refund quota and go back to select-action ─── */

export async function cancelSeasonSelection(arenaId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle?.turn || battle.turn.phase !== PHASE.SELECT_SEASON) return;

  const { attackerId, attackerTeam, usedPowerIndex } = battle.turn;
  const attacker = findFighter(room, attackerId);
  if (!attacker) return;

  // Refund quota
  const power = attacker.powers?.[usedPowerIndex as number];
  const cost = power ? getQuotaCost(power.type) : 1;
  const atkPath = findFighterPath(room, attackerId);

  const updates: Record<string, unknown> = {};
  if (atkPath) updates[`${atkPath}/quota`] = attacker.quota + cost;

  // Reset turn back to select-action
  updates[ARENA_PATH.BATTLE_TURN] = {
    attackerId,
    attackerTeam,
    phase: PHASE.SELECT_ACTION,
    action: null,
  };

  await update(roomRef(arenaId), updates);
}

/* ── cancel poem selection: refund quota and go back to select-action ─── */

export async function cancelPoemSelection(arenaId: string): Promise<void> {
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
  if (atkPath) updates[`${atkPath}/quota`] = attacker.quota + cost;
  updates[ARENA_PATH.BATTLE_TURN] = {
    attackerId,
    attackerTeam,
    phase: PHASE.SELECT_ACTION,
    action: null,
  };

  await update(roomRef(arenaId), updates);
}

/* ── cancel target selection: go back to previous phase (poem if Imprecated Poem, else select-action) ─── */

export async function cancelTargetSelection(arenaId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle?.turn || battle.turn.phase !== PHASE.SELECT_TARGET) return;

  const { attackerId, attackerTeam, action, usedPowerIndex, usedPowerName } = battle.turn;
  const selectedPoem = (battle.turn as { selectedPoem?: string }).selectedPoem;
  const attacker = findFighter(room, attackerId);
  if (!attacker) return;

  const updates: Record<string, unknown> = {};

  // Imprecated Poem: back = previous phase = verse selection (no quota refund)
  if (usedPowerName === POWER_NAMES.IMPRECATED_POEM && selectedPoem) {
    updates[ARENA_PATH.BATTLE_TURN] = {
      ...battle.turn,
      phase: PHASE.SELECT_POEM,
      selectedPoem: null,
    };
    await update(roomRef(arenaId), updates);
    return;
  }

  // Refund quota if a power was selected
  if (action === TURN_ACTION.POWER && usedPowerIndex != null) {
    const power = attacker.powers?.[usedPowerIndex as number];
    const cost = power ? getQuotaCost(power.type) : 1;
    const atkPath = findFighterPath(room, attackerId);
    if (atkPath) updates[`${atkPath}/quota`] = attacker.quota + cost;
  }

  // Reset turn back to select-action
  updates[ARENA_PATH.BATTLE_TURN] = {
    attackerId,
    attackerTeam,
    phase: PHASE.SELECT_ACTION,
    action: null,
  };

  await update(roomRef(arenaId), updates);
}

/** Skip reason when turn is skipped for no valid target (for client modal). */
export const SKIP_REASON_SHADOW_CAMOUFLAGE = POWER_NAMES.SHADOW_CAMOUFLAGING;

/**
 * For Keraunos Voltage + Disoriented: pick one random main target and up to two random secondaries (per tier, without replacement).
 */
function pickKeraunosRandomTargets(validIds: string[]): { mainId: string; secondaryIds: string[] } {
  const mainId = validIds[Math.floor(Math.random() * validIds.length)];
  const rest1 = validIds.filter(id => id !== mainId);
  const secondaryIds: string[] = [];
  if (rest1.length >= 1) {
    const s1 = rest1[Math.floor(Math.random() * rest1.length)];
    secondaryIds.push(s1);
    if (rest1.length >= 2) {
      const rest2 = rest1.filter(id => id !== s1);
      secondaryIds.push(rest2[Math.floor(Math.random() * rest2.length)]);
    }
  }
  return { mainId, secondaryIds };
}

/**
 * Disoriented: server picks a random valid target and runs the 25% fail check.
 * For Keraunos Voltage: picks random main + up to 2 random secondaries (per tier).
 * Call when phase is SELECT_TARGET, attacker has Disoriented, and target is not yet chosen (e.g. after Keraunos D4).
 */
export async function selectTargetDisoriented(arenaId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle?.turn || battle.turn.phase !== PHASE.SELECT_TARGET) return;
  const turn = battle.turn;
  const { attackerId } = turn;
  const activeEffects = battle.activeEffects || [];
  if (!activeEffects.some(e => e.targetId === attackerId && e.tag === EFFECT_TAGS.DISORIENTED)) return;
  if (turn.defenderId) return; // already chosen (e.g. by selectAction)

  const validIds = getValidTargetIds(room, turn, activeEffects);
  if (validIds.length === 0) {
    await skipTurnNoValidTarget(arenaId);
    return;
  }

  const isKeraunos = turn.usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE;
  if (isKeraunos) {
    const { mainId, secondaryIds } = pickKeraunosRandomTargets(validIds);
    await update(roomRef(arenaId), {
      [ARENA_PATH.BATTLE_TURN]: {
        ...turn,
        defenderId: mainId,
        keraunosMainTargetId: mainId,
        keraunosSecondaryTargetIds: secondaryIds,
        keraunosTargetStep: null,
      },
    });
    await selectTarget(arenaId, mainId);
    return;
  }

  const randomId = validIds[Math.floor(Math.random() * validIds.length)];
  await update(roomRef(arenaId), { [ARENA_PATH.BATTLE_TURN]: { ...turn, defenderId: randomId } });
  await selectTarget(arenaId, randomId);
}

/**
 * Advance after Disoriented D4 roll: if roll is in winFaces (25%), action has no effect and turn ends; else proceed to ROLLING_ATTACK.
 * Call when phase is ROLLING_DISORIENTED_NO_EFFECT and client has written disorientedRoll.
 */
export async function advanceAfterDisorientedD4(arenaId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  const turn = battle?.turn;
  if (turn?.phase !== PHASE.ROLLING_DISORIENTED_NO_EFFECT) return;
  const roll = Number((turn as { disorientedRoll?: number }).disorientedRoll);
  const winFaces = ((turn as { disorientedWinFaces?: number[] }).disorientedWinFaces ?? []).map((f: unknown) => Number(f));
  const defenderId = turn.defenderId;
  const attackerId = turn.attackerId;
  if (!attackerId || !defenderId || !battle || !Number.isFinite(roll)) return;

  const noEffect = winFaces.length > 0 && winFaces.includes(roll);
  const updates: Record<string, unknown> = {};

  if (noEffect) {
    const attacker = findFighter(room, attackerId);
    const power = turn.action === TURN_ACTION.POWER && turn.usedPowerIndex != null ? attacker?.powers?.[turn.usedPowerIndex] : null;
    const logEntry = {
      round: battle.roundNumber,
      attackerId,
      defenderId,
      attackRoll: 0,
      defendRoll: 0,
      damage: 0,
      defenderHpAfter: findFighter(room, defenderId)?.currentHp ?? 0,
      eliminated: false,
      missed: false,
      powerUsed: power?.name ?? 'Attack',
      skipReason: 'Disoriented (action had no effect)',
    };
    updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), logEntry]);
    const effectUpdates = await tickEffectsWithSkeletonBlock(arenaId, room, battle, updates);
    Object.assign(updates, effectUpdates);
    const latestEffects = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || battle.activeEffects || [];
    const getHp = (m: FighterState) => {
      const path = findFighterPath(room, m.characterId);
      if (path && `${path}/currentHp` in updates) return updates[`${path}/currentHp`] as number;
      return m.currentHp;
    };
    const teamAMembers = (room.teamA?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
    const teamBMembers = (room.teamB?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
    const END_ARENA_DELAY_MS = 3500;
    if (isTeamEliminated(teamBMembers, latestEffects)) {
      updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: turn.attackerTeam!, phase: PHASE.DONE };
      updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
      await update(roomRef(arenaId), updates);
      setTimeout(() => {
        update(roomRef(arenaId), { [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.A, [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED, [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null }).catch(() => {});
      }, END_ARENA_DELAY_MS);
      return;
    }
    if (isTeamEliminated(teamAMembers, latestEffects)) {
      updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: turn.attackerTeam!, phase: PHASE.DONE };
      updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
      await update(roomRef(arenaId), updates);
      setTimeout(() => {
        update(roomRef(arenaId), { [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.B, [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED, [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null }).catch(() => {});
      }, END_ARENA_DELAY_MS);
      return;
    }
    const updatedRoom = { ...room, teamA: { ...room.teamA, members: teamAMembers }, teamB: { ...room.teamB, members: teamBMembers } } as BattleRoom;
    const updatedQueue = buildTurnQueue(updatedRoom, latestEffects);
    updates[ARENA_PATH.BATTLE_TURN_QUEUE] = updatedQueue;
    const fromIdx = updatedQueue.findIndex((e: TurnQueueEntry) => e.characterId === attackerId);
    const { index: nextIdx, wrapped } = nextAliveIndex(updatedQueue, fromIdx !== -1 ? fromIdx : battle.currentTurnIndex, updatedRoom, latestEffects);
    const nextEntry = updatedQueue[nextIdx];
    const selfRes = applySelfResurrect(nextEntry.characterId, updatedRoom, latestEffects, updates, battle);
    const nextFighter = findFighter(updatedRoom, nextEntry.characterId);
    if (nextFighter && !selfRes && isStunned(latestEffects, nextEntry.characterId)) {
      const { index: skipIdx, wrapped: skipWrapped } = nextAliveIndex(updatedQueue, nextIdx, updatedRoom, latestEffects);
      const skipEntry = updatedQueue[skipIdx];
      updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdx;
      updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = skipWrapped ? battle.roundNumber + 1 : battle.roundNumber;
      const battleForSkip = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
      const dryadSkip = applySecretOfDryadPassive(room, skipEntry.characterId, battleForSkip, 0);
      if (dryadSkip[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, dryadSkip);
      const efflorescenceMuseSkip = onEfflorescenceMuseTurnStart(room, { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects }, skipEntry.characterId);
      if (efflorescenceMuseSkip) Object.assign(updates, efflorescenceMuseSkip);
      updates[ARENA_PATH.BATTLE_TURN] = { attackerId: skipEntry.characterId, attackerTeam: skipEntry.team, phase: PHASE.SELECT_ACTION };
    } else {
      updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
      updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
      const turnData: Record<string, unknown> = { attackerId: nextEntry.characterId, attackerTeam: nextEntry.team, phase: PHASE.SELECT_ACTION };
      if (selfRes) (turnData as Record<string, unknown>).resurrectTargetId = nextEntry.characterId;
      const battleForDryad = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
      const dryadNext = applySecretOfDryadPassive(room, nextEntry.characterId, battleForDryad, 0);
      if (dryadNext[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, dryadNext);
      const efflorescenceMuseNext = onEfflorescenceMuseTurnStart(room, battleForDryad, nextEntry.characterId);
      if (efflorescenceMuseNext) Object.assign(updates, efflorescenceMuseNext);
      updates[ARENA_PATH.BATTLE_TURN] = turnData;
    }
    await update(roomRef(arenaId), updates);
    return;
  }

  // Proceed: Keraunos Voltage goes to RESOLVING (skip dice); others go to ROLLING_ATTACK. Clear Disoriented D4 fields.
  const isKeraunos = turn.usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE;
  const phaseNext = isKeraunos ? PHASE.RESOLVING : PHASE.ROLLING_ATTACK;
  try {
    const defenderTeam = findFighterTeam(room, defenderId);
    const defenderMinions = defenderTeam ? (room as any)[defenderTeam]?.minions?.filter((m: any) => m.masterId === defenderId) ?? [] : [];
    const turnUpdate: Record<string, unknown> = {
      ...turn,
      defenderId,
      phase: phaseNext,
      disorientedWinFaces: null,
      disorientedRoll: null,
      playbackStep: null,
      resolvingHitIndex: null,
    };
    if (isKeraunos) {
      (turnUpdate as Record<string, unknown>).attackRoll = 0;
      (turnUpdate as Record<string, unknown>).defendRoll = 0;
    }
    if (defenderMinions.length > 0 && !isKeraunos) {
      (turnUpdate as Record<string, unknown>).visualDefenderId = defenderMinions[0].characterId;
    }
    updates[ARENA_PATH.BATTLE_TURN] = turnUpdate;
    updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
    updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
  } catch (e) {
    updates[ARENA_PATH.BATTLE_TURN] = {
      ...turn,
      defenderId,
      phase: phaseNext,
      disorientedWinFaces: null,
      disorientedRoll: null,
      playbackStep: null,
      resolvingHitIndex: null,
      ...(isKeraunos ? { attackRoll: 0, defendRoll: 0 } : {}),
    };
    updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
    updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
  }
  await update(roomRef(arenaId), updates);
}

/**
 * Skip current turn because attacker has no valid target (e.g. all enemies under Shadow Camouflage).
 * Call when phase is SELECT_TARGET and no enemy can be targeted. Logs the skip reason, refunds quota if power was selected, then advances to next attacker.
 */
export async function skipTurnNoValidTarget(arenaId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle?.turn || battle.turn.phase !== PHASE.SELECT_TARGET) return;

  const turn = battle.turn;
  const { attackerId, attackerTeam, action, usedPowerIndex } = turn;
  const attacker = findFighter(room, attackerId);
  if (!attacker) return;

  const updates: Record<string, unknown> = {};
  const activeEffects = battle.activeEffects || [];

  // Refund quota if a power was selected (same as cancel)
  if (action === TURN_ACTION.POWER && usedPowerIndex != null) {
    const power = attacker.powers?.[usedPowerIndex as number];
    const cost = power ? getQuotaCost(power.type) : 1;
    const atkPath = findFighterPath(room, attackerId);
    if (atkPath) updates[`${atkPath}/quota`] = attacker.quota + cost;
  }

  // Don't set powerUsed (Firebase rejects undefined); client uses skippedNoValidTarget/skipReason
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
    skippedNoValidTarget: true,
    skipReason: SKIP_REASON_SHADOW_CAMOUFLAGE,
  };
  updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), logEntry]);

  // Tick effects, win check, then advance to next attacker (same as soulDevourerEndTurnOnly); DOT via resolveHitAtDefender
  const effectUpdates = await tickEffectsWithSkeletonBlock(arenaId, room, battle, updates);
  Object.assign(updates, effectUpdates);
  let battleAfterTick = battle;
  if (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) {
    battleAfterTick = { ...battle, activeEffects: updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] };
  }
  const latestEffects = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || battleAfterTick.activeEffects || [];

  const getHp = (m: FighterState) => {
    const path = findFighterPath(room, m.characterId);
    if (path && `${path}/currentHp` in updates) return updates[`${path}/currentHp`] as number;
    return m.currentHp;
  };
  const teamAMembers = (room.teamA?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
  const teamBMembers = (room.teamB?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));

  const END_ARENA_DELAY_MS = 3500;
  if (isTeamEliminated(teamBMembers, latestEffects)) {
    updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: turn.attackerTeam, phase: PHASE.DONE };
    updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
    await update(roomRef(arenaId), updates);
    setTimeout(() => {
      update(roomRef(arenaId), {
        [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.A,
        [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
        [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
      }).catch(() => { });
    }, END_ARENA_DELAY_MS);
    return;
  }
  if (isTeamEliminated(teamAMembers, latestEffects)) {
    updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: turn.attackerTeam, phase: PHASE.DONE };
    updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
    await update(roomRef(arenaId), updates);
    setTimeout(() => {
      update(roomRef(arenaId), {
        [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.B,
        [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
        [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
      }).catch(() => { });
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
  const selfRes = applySelfResurrect(nextEntry.characterId, updatedRoom, latestEffects, updates, battle);
  const nextFighter = findFighter(updatedRoom, nextEntry.characterId);
  const activeEff = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || latestEffects;

  if (nextFighter && !selfRes && isStunned(activeEff, nextEntry.characterId)) {
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
    const afterStunRoom = { ...updatedRoom };
    const { index: skipIdx, wrapped: skipWrapped } = nextAliveIndex(updatedQueue, nextIdx, afterStunRoom, latestEffects);
    const skipEntry = updatedQueue[skipIdx];
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdx;
    if (skipWrapped) updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = (updates[ARENA_PATH.BATTLE_ROUND_NUMBER] as number || battle.roundNumber) + 1;
    updates[ARENA_PATH.BATTLE_TURN] = { attackerId: skipEntry.characterId, attackerTeam: skipEntry.team, phase: PHASE.SELECT_ACTION };
  } else {
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
    const turnData: Record<string, unknown> = { attackerId: nextEntry.characterId, attackerTeam: nextEntry.team, phase: PHASE.SELECT_ACTION };
    if (selfRes) turnData.resurrectTargetId = nextEntry.characterId;
    updates[ARENA_PATH.BATTLE_TURN] = turnData;
  }
  updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
  updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
  updates[ARENA_PATH.BATTLE_LAST_SKELETON_HITS] = null;

  await update(roomRef(arenaId), updates);
}

/* ── advance after Shadow Camouflage D4 roll (client writes roll, then calls this) ─── */

export async function advanceAfterShadowCamouflageD4(arenaId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  const turn = battle?.turn;
  if (!turn?.shadowCamouflageRefillWinFaces?.length || turn.shadowCamouflageRefillRoll == null) return;
  if (turn.phase !== PHASE.RESOLVING) return;

  const { attackerId } = turn;
  const attacker = findFighter(room, attackerId);
  if (!attacker) return;

  const updates: Record<string, unknown> = {};
  const atkPath = findFighterPath(room, attackerId);
  const winFaces = (turn.shadowCamouflageRefillWinFaces ?? []).map((f: unknown) => Number(f));
  const roll = Number(turn.shadowCamouflageRefillRoll);
  const won = Number.isFinite(roll) && roll >= 1 && roll <= 4 && winFaces.includes(roll);
  const maxQuota = typeof attacker.maxQuota === 'number' && !isNaN(attacker.maxQuota) ? attacker.maxQuota : 3;
  if (atkPath && won && attacker.quota < maxQuota) {
    updates[`${atkPath}/quota`] = Math.min(attacker.quota + 1, maxQuota);
  }

  const getHp = (m: FighterState) => {
    const path = findFighterPath(room, m.characterId);
    if (path && `${path}/currentHp` in updates) return updates[`${path}/currentHp`] as number;
    return m.currentHp;
  };
  const teamAMembers = (room.teamA?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
  const teamBMembers = (room.teamB?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
  const latestEffects = battle?.activeEffects || [];

  const END_ARENA_DELAY_MS = 3500;
  if (isTeamEliminated(teamBMembers, latestEffects)) {
    updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: turn.attackerTeam, phase: PHASE.DONE };
    updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
    await update(roomRef(arenaId), updates);
    setTimeout(() => {
      update(roomRef(arenaId), {
        [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.A,
        [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
        [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
      }).catch(() => { });
    }, END_ARENA_DELAY_MS);
    return;
  }
  if (isTeamEliminated(teamAMembers, latestEffects)) {
    updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: turn.attackerTeam, phase: PHASE.DONE };
    updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
    await update(roomRef(arenaId), updates);
    setTimeout(() => {
      update(roomRef(arenaId), {
        [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.B,
        [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
        [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
      }).catch(() => { });
    }, END_ARENA_DELAY_MS);
    return;
  }

  const updatedRoom = {
    ...room,
    teamA: { ...room.teamA, members: teamAMembers },
    teamB: { ...room.teamB, members: teamBMembers },
  } as BattleRoom;
  const updatedQueue = buildTurnQueue(updatedRoom, latestEffects);
  const currentAttackerIdx = updatedQueue.findIndex(e => e.characterId === attackerId);
  const fromIdx = currentAttackerIdx !== -1 ? currentAttackerIdx : battle?.currentTurnIndex ?? 0;
  const { index: nextIdx, wrapped } = nextAliveIndex(updatedQueue, fromIdx, updatedRoom, latestEffects);
  const nextEntry = updatedQueue[nextIdx];

  const selfRes1 = applySelfResurrect(nextEntry.characterId, updatedRoom, latestEffects, updates, battle as any);
  const nextFighter = findFighter(updatedRoom, nextEntry.characterId);
  if (nextFighter && !selfRes1 && isStunned(latestEffects, nextEntry.characterId)) {
    updates[ARENA_PATH.BATTLE_TURN_QUEUE] = updatedQueue;
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? (battle?.roundNumber ?? 0) + 1 : (battle?.roundNumber ?? 0);
    const { index: skipIdx, wrapped: skipWrapped } = nextAliveIndex(updatedQueue, nextIdx, updatedRoom, latestEffects);
    const skipEntry = updatedQueue[skipIdx];
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdx;
    if (skipWrapped) updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = (updates[ARENA_PATH.BATTLE_ROUND_NUMBER] as number || (battle?.roundNumber ?? 0)) + 1;
    updates[ARENA_PATH.BATTLE_TURN] = { attackerId: skipEntry.characterId, attackerTeam: skipEntry.team, phase: PHASE.SELECT_ACTION };
  } else {
    updates[ARENA_PATH.BATTLE_TURN_QUEUE] = updatedQueue;
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? (battle?.roundNumber ?? 0) + 1 : (battle?.roundNumber ?? 0);
    const turnData: Record<string, unknown> = { attackerId: nextEntry.characterId, attackerTeam: nextEntry.team, phase: PHASE.SELECT_ACTION };
    if (selfRes1) turnData.resurrectTargetId = nextEntry.characterId;
    updates[ARENA_PATH.BATTLE_TURN] = turnData;
  }

  updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
  updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
  await update(roomRef(arenaId), updates);
}

/** Skip reason tag when heal is skipped (e.g. Healing Nullified). Client shows modal "ข้ามเพราะ สูญสิ้นเยียวยา". */
export const HEAL_SKIP_REASON_HEALING_NULLIFIED = EFFECT_TAGS.HEALING_NULLIFIED;

/**
 * Advance after caster acknowledges "heal skipped" (e.g. Floral Fragrance on target with Healing Nullified).
 * Writes log entry with heal: 0, healSkipReason, then advances to SELECT_TARGET.
 */
export async function advanceAfterFloralHealSkippedAck(arenaId: string): Promise<void> {
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
    healSkipReason: healSkipReason ?? HEAL_SKIP_REASON_HEALING_NULLIFIED,
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

/**
 * Advance after caster acknowledges Soul Devourer "heal skipped" (e.g. caster has Healing Nullified).
 * Clears soulDevourerHealSkipAwaitsAck so skeleton hits can start on next resolveTurn.
 */
export async function advanceAfterSoulDevourerHealSkippedAck(arenaId: string): Promise<void> {
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

/* ── advance after Floral Fragrance D4 heal-crit roll (Efflorescence Muse) ─── */

export async function advanceAfterFloralHealD4(arenaId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  const turn = battle?.turn;
  if (turn?.phase !== PHASE.ROLLING_FLORAL_HEAL || !turn?.floralHealWinFaces?.length || turn.floralHealRoll == null) return;

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
  const actualHeal = getEffectiveHealForReceiver(isHealCrit ? baseHeal * 2 : baseHeal, ally, allyTargetId, battle.activeEffects || []);
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

/* ── advance after Spring heal skipped ack (heal1 skip → show D4 roll for heal2; heal2 skip → clear Spring and advance) ─── */

export async function advanceAfterSpringHealSkippedAck(arenaId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  const turn = battle?.turn;
  if (turn?.phase !== PHASE.ROLLING_SPRING_HEAL || !(turn as any).springHealSkipAwaitsAck) return;

  const attackerId = turn.attackerId;
  if (!attackerId || !battle) return;

  const springHeal2Ack = (battle as { springHeal2?: number | null }).springHeal2;
  if (springHeal2Ack != null) {
    // R{n+2} heal2 was skipped: clear Spring and advance to next turn (no D4).
    const latestEffects = battle.activeEffects || [];
    const currentEffects = latestEffects.filter((e: ActiveEffect) => e.tag !== EFFECT_TAGS.SEASON_SPRING);
    const updatedQueue = buildTurnQueue(room, currentEffects);
    const currentIdx = updatedQueue.findIndex((e: TurnQueueEntry) => e.characterId === attackerId);
    const fromIdx = currentIdx !== -1 ? currentIdx : battle.currentTurnIndex;
    const updatedRoom = { ...room, battle: { ...battle, activeEffects: currentEffects } } as BattleRoom;
    const { index: nextIdx, wrapped } = nextAliveIndex(updatedQueue, fromIdx, updatedRoom, currentEffects);
    const nextEntry = updatedQueue[nextIdx];
    const selfRes = applySelfResurrect(nextEntry.characterId, updatedRoom, currentEffects, {}, battle);
    const nextFighter = findFighter(updatedRoom, nextEntry.characterId);
    const activeEff = currentEffects;
    const updates: Record<string, unknown> = {
      [ARENA_PATH.BATTLE_SPRING_CASTER_ID]: null,
      [ARENA_PATH.BATTLE_SPRING_HEAL1]: null,
      [ARENA_PATH.BATTLE_SPRING_HEAL1_RECEIVED]: null,
      [ARENA_PATH.BATTLE_SPRING_HEAL2]: null,
      [ARENA_PATH.BATTLE_ACTIVE_EFFECTS]: currentEffects,
      [ARENA_PATH.BATTLE_TURN_QUEUE]: updatedQueue,
      [ARENA_PATH.BATTLE_SPRING_HEAL_ROLL_ACTIVE]: null,
    };
    if (nextFighter && !selfRes && isStunned(activeEff, nextEntry.characterId)) {
      const { index: skipIdx } = nextAliveIndex(updatedQueue, nextIdx, updatedRoom, currentEffects);
      const skipEntry = updatedQueue[skipIdx];
      updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdx;
      updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = battle.roundNumber + (wrapped ? 1 : 0);
      updates[ARENA_PATH.BATTLE_TURN] = { attackerId: skipEntry.characterId, attackerTeam: skipEntry.team, phase: PHASE.SELECT_ACTION };
    } else {
      updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
      updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
      updates[ARENA_PATH.BATTLE_TURN] = { attackerId: nextEntry.characterId, attackerTeam: nextEntry.team, phase: PHASE.SELECT_ACTION, ...(selfRes ? { resurrectTargetId: nextEntry.characterId } : {}) };
    }
    await update(roomRef(arenaId), updates);
    return;
  }

  // Heal1 skipped: set up D4 roll for heal2.
  const caster = findFighter(room, attackerId);
  const baseCritRate = caster ? (typeof caster.criticalRate === 'number' ? caster.criticalRate : 25) : 25;
  const latestEffects = battle.activeEffects || [];
  const healCritRate = Math.min(100, Math.max(0, baseCritRate + getStatModifier(latestEffects, attackerId, MOD_STAT.CRITICAL_RATE)));
  const winFaces = getWinningFaces(healCritRate);

  const turnObj = turn as unknown as Record<string, unknown>;
  const { springHealSkipAwaitsAck: _, healSkipReason: __, ...rest } = turnObj;
  const updates: Record<string, unknown> = {
    [ARENA_PATH.BATTLE_TURN]: {
      ...rest,
      phase: PHASE.ROLLING_SPRING_HEAL,
      springHealWinFaces: winFaces,
      springRound: 2,
      playbackStep: null,
      resolvingHitIndex: null,
    },
    [ARENA_PATH.BATTLE_SPRING_HEAL_ROLL_ACTIVE]: true,
  };
  await update(roomRef(arenaId), updates);
}

/* ── advance after Spring (Ephemeral Season) D4 heal roll ─── */

export async function advanceAfterSpringHealD4(arenaId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  const turn = battle?.turn;
  if (turn?.phase !== PHASE.ROLLING_SPRING_HEAL || !(turn as any).springHealWinFaces?.length || (turn as any).springHealRoll == null) return;

  const attackerId = turn.attackerId;
  if (!attackerId || !battle) return;

  const winFaces = ((turn as any).springHealWinFaces ?? []).map((f: unknown) => Number(f));
  const roll = Number((turn as any).springHealRoll);
  const isHealCrit = Number.isFinite(roll) && roll >= 1 && roll <= 4 && winFaces.includes(roll);
  const amount = isHealCrit ? 2 : 1;
  const springRound = (turn as any).springRound as 1 | 2 | undefined;

  const updates: Record<string, unknown> = {};
  updates[ARENA_PATH.BATTLE_SPRING_HEAL_ROLL_ACTIVE] = null;

  const updatedQueue = battle.turnQueue || [];
  const currentAttackerIdx = updatedQueue.findIndex((e: TurnQueueEntry) => e.characterId === attackerId);
  const fromIdx = currentAttackerIdx !== -1 ? currentAttackerIdx : battle.currentTurnIndex;
  const latestEffects = battle.activeEffects || [];
  const updatedRoom = room;

  if (springRound === 1) {
    // R{n}: confirm Spring → roll heal crit 1 → store amount, advance to next fighter (no heal for caster this turn; heal1 applied when caster does action in R{n+1})
    updates[ARENA_PATH.BATTLE_SPRING_HEAL1] = amount;
    updates[ARENA_PATH.BATTLE_SPRING_HEAL1_RECEIVED] = [];
    const logEntry = {
      round: battle.roundNumber,
      attackerId,
      defenderId: attackerId,
      attackRoll: 0,
      defendRoll: 0,
      damage: 0,
      defenderHpAfter: (room.teamA?.members || []).concat(room.teamB?.members || []).find(m => m.characterId === attackerId)?.currentHp ?? 0,
      eliminated: false,
      missed: false,
      powerUsed: 'Ephemeral Season: Spring',
    };
    updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), logEntry]);
  } else {
    // R{n+1} after roll heal crit 2: store heal2, advance to next fighter (no heal for caster this turn; heal2 applied when caster does action in R{n+2})
    updates[ARENA_PATH.BATTLE_SPRING_HEAL2] = amount;
  }

  const { index: nextIdx, wrapped } = nextAliveIndex(updatedQueue, fromIdx, updatedRoom, latestEffects);
  const nextEntry = updatedQueue[nextIdx];
  const selfRes2 = applySelfResurrect(nextEntry.characterId, updatedRoom, latestEffects, updates, battle);
  const nextFighter = findFighter(updatedRoom, nextEntry.characterId);
  let finalEntry = nextEntry;
  if (nextFighter && !selfRes2 && isStunned(latestEffects, nextEntry.characterId)) {
    const { index: skipIdx, wrapped: skipWrapped } = nextAliveIndex(updatedQueue, nextIdx, updatedRoom, latestEffects);
    finalEntry = updatedQueue[skipIdx];
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
    if (skipWrapped) updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = (updates[ARENA_PATH.BATTLE_ROUND_NUMBER] as number || battle.roundNumber) + 1;
  } else {
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
  }
  const nextTurnOnly: Record<string, unknown> = {
    attackerId: finalEntry.characterId,
    attackerTeam: finalEntry.team,
    phase: PHASE.SELECT_ACTION,
  };
  if (selfRes2 && finalEntry.characterId === nextEntry.characterId) nextTurnOnly.resurrectTargetId = nextEntry.characterId;
  await set(ref(db, `arenas/${arenaId}/battle/turn`), nextTurnOnly);
  await update(roomRef(arenaId), updates);
}

/* ── confirm season: apply effects + end turn (no dice) ─── */

export async function confirmSeason(arenaId: string): Promise<void> {
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

  // Spring: ตอน confirm ต้องทอย D4 ได้ heal1 ก่อน → หลังทอย advance ไปคนถัดไป (คนนั้นตีก่อนค่อยฮีล). ใส่ effect SEASON_SPRING เพื่อให้ pip/SeasonalEffects แสดง Spring.
  if (selectedSeason === SEASON_KEYS.SPRING) {
    updates[ARENA_PATH.BATTLE_SPRING_CASTER_ID] = attackerId;
    const seasonUpdates = applySeasonEffects(room, attackerId, SEASON_KEYS.SPRING, battle);
    Object.assign(updates, seasonUpdates);
    updates[ARENA_PATH.BATTLE_SPRING_HEAL_ROLL_ACTIVE] = true;
    const baseCritRate = typeof attacker.criticalRate === 'number' ? attacker.criticalRate : 25;
    const critMod = getStatModifier(battle.activeEffects || [], attackerId, MOD_STAT.CRITICAL_RATE);
    const healCritRate = Math.min(100, Math.max(0, baseCritRate + critMod));
    const winFaces = getWinningFaces(healCritRate);
    updates[ARENA_PATH.BATTLE_TURN] = {
      attackerId,
      attackerTeam,
      phase: PHASE.ROLLING_SPRING_HEAL,
      selectedSeason,
      springHealWinFaces: winFaces,
      springRound: 1,
    };
    await update(roomRef(arenaId), updates);
    return;
  }

  // Apply season effects to all alive teammates (summer, autumn, winter)
  const seasonUpdates = applySeasonEffects(room, attackerId, selectedSeason, battle);
  Object.assign(updates, seasonUpdates);

  // Sync activeEffects into battle for tickEffects
  if (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) {
    battle = { ...battle, activeEffects: updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] };
  }

  // Tick active effects (DOT damage, spring heal, decrement durations); DOT via resolveHitAtDefender
  const effectUpdates = await tickEffectsWithSkeletonBlock(arenaId, room, battle, updates);
  Object.assign(updates, effectUpdates);

  // Battle log entry: "Ephemeral Season: {chosen season}" (logged only after season is chosen)
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

  // Advance turn — same logic as end of resolveTurn()
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
      }).catch(() => { });
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
      }).catch(() => { });
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

  // Death Keeper: self-resurrect if next fighter is dead with death-keeper
  const selfRes2 = applySelfResurrect(nextEntry.characterId, updatedRoom, latestEffects, updates, battle);

  // Skip stunned fighters
  const nextFighter = findFighter(updatedRoom, nextEntry.characterId);
  if (nextFighter && !selfRes2 && isStunned(latestEffects, nextEntry.characterId)) {
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;

    const { index: skipIdx, wrapped: skipWrapped } = nextAliveIndex(updatedQueue, nextIdx, updatedRoom, latestEffects);
    const skipEntry = updatedQueue[skipIdx];
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdx;
    if (skipWrapped) updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = (updates[ARENA_PATH.BATTLE_ROUND_NUMBER] as number || battle.roundNumber) + 1;
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

/* ── signal "roll started" so viewers can show dice rolling in sync ── */

export async function requestAttackRollStart(arenaId: string): Promise<void> {
  try {
    await update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { [ARENA_PATH.BATTLE_TURN_ATTACK_ROLL_STARTED_AT]: Date.now() });
  } catch (_) { }
}

export async function requestDefendRollStart(arenaId: string): Promise<void> {
  try {
    await update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { [ARENA_PATH.BATTLE_TURN_DEFEND_ROLL_STARTED_AT]: Date.now() });
  } catch (_) { }
}

/* ── submit attack dice roll ─────────────────────────── */

export async function submitAttackRoll(arenaId: string, roll: number): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle?.turn) return;

  const turn = battle.turn;
  const powerNoDefend = turn.action === TURN_ACTION.POWER && turn.usedPowerName && (POWERS_DEFENDER_CANNOT_DEFEND as readonly string[]).includes(turn.usedPowerName);

  const updates: Record<string, unknown> = {
    [ARENA_PATH.BATTLE_TURN_ATTACK_ROLL]: roll,
    [ARENA_PATH.BATTLE_TURN_PHASE]: powerNoDefend ? PHASE.RESOLVING : PHASE.ROLLING_DEFEND,
    ...(powerNoDefend ? { [ARENA_PATH.BATTLE_TURN_DEFEND_ROLL]: 0 } : {}),
  };

  await update(roomRef(arenaId), updates);
}

/* ── submit defend dice roll ─────────────────────────── */

export async function submitDefendRoll(arenaId: string, roll: number): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle?.turn) return;

  const updates: Record<string, unknown> = {
    [ARENA_PATH.BATTLE_TURN_DEFEND_ROLL]: roll,
    [ARENA_PATH.BATTLE_TURN_PHASE]: PHASE.RESOLVING,
  };

  await update(roomRef(arenaId), updates);
}

/* ── submit Rapid Fire D4 (Volley Arrow ช็อตเสริม) ─────────────────────────── */

export async function submitRapidFireD4Roll(arenaId: string, roll: number): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  const turn = battle?.turn;
  if (!turn || turn.phase !== PHASE.ROLLING_RAPID_FIRE_EXTRA_SHOT) return;
  const winFaces = ((turn as any).rapidFireWinFaces as number[]) ?? [];
  const step = Number((turn as any).rapidFireStep) ?? 0;
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

  // Always show damage card + hit VFX first (including when this shot eliminates defender); then client calls advanceToNextRapidFireStep.
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
export async function advanceToNextRapidFireStep(arenaId: string): Promise<void> {
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

  if (defenderDead) {
    const turnUpdates: Record<string, unknown> = {
      ...turn,
      phase: PHASE.RESOLVING_AFTER_RAPID_FIRE,
      rapidFireDefTotal: (turn as any).rapidFireDefTotal,
      rapidFireStep: null,
      rapidFireWinFaces: null,
      rapidFireBaseDmg: null,
      rapidFireIsCrit: null,
      rapidFireD4Roll: null,
      rapidFireExtraShotDamage: null,
      rapidFireExtraShotBaseDmg: null,
      rapidFireExtraShotIsCrit: null,
      rapidFireExtraShotEliminated: null,
    };
    await update(roomRef(arenaId), { [ARENA_PATH.BATTLE_TURN]: turnUpdates });
    await resolveTurn(arenaId);
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

/** เรียกเมื่อ animation เต๋าโจมตีจบแล้ว — refill quota ถ้าโรลรวม >= 11 (ไม่รอ resolve) */
export async function ackAttackDiceShown(arenaId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  const turn = battle?.turn;
  if (!turn || turn.attackRoll == null) return;
  if ((turn as unknown as Record<string, unknown>).attackQuotaRefilled) return;

  const attackerId = turn.attackerId;
  const attacker = findFighter(room, attackerId);
  if (!attacker) return;

  const activeEffects = battle?.activeEffects || [];
  const atkBuff = getStatModifier(activeEffects, attackerId, MOD_STAT.ATTACK_DICE_UP);
  const atkRecovery = getStatModifier(activeEffects, attackerId, MOD_STAT.RECOVERY_DICE_UP);
  const total = (turn.attackRoll ?? 0) + attacker.attackDiceUp + atkBuff + atkRecovery;
  const turnWithFlag = { ...turn, attackQuotaRefilled: true } as Record<string, unknown>;
  if (total < 11 || attacker.quota >= (attacker.maxQuota ?? 0)) {
    await update(roomRef(arenaId), { [ARENA_PATH.BATTLE_TURN]: turnWithFlag });
    return;
  }

  const atkPath = findFighterPath(room, attackerId);
  const updates: Record<string, unknown> = {
    [ARENA_PATH.BATTLE_TURN]: turnWithFlag,
  };
  if (atkPath) updates[`${atkPath}/quota`] = Math.min(attacker.quota + 1, attacker.maxQuota ?? 0);
  await update(roomRef(arenaId), updates);
}

/** เรียกเมื่อ animation เต๋าป้องกันจบแล้ว — refill quota ถ้าโรลรวม >= 11 (ไม่รอ resolve) */
export async function ackDefendDiceShown(arenaId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  const turn = battle?.turn;
  if (!turn || turn.phase !== PHASE.RESOLVING || turn.defendRoll == null) return;
  if ((turn as unknown as Record<string, unknown>).defendQuotaRefilled) return;

  const defenderId = turn.defenderId;
  if (!defenderId) return;
  const defender = findFighter(room, defenderId);
  if (!defender) return;

  const activeEffects = battle?.activeEffects || [];
  const defBuff = getStatModifier(activeEffects, defenderId, MOD_STAT.DEFEND_DICE_UP);
  const defRecovery = getStatModifier(activeEffects, defenderId, MOD_STAT.RECOVERY_DICE_UP);
  const total = (turn.defendRoll ?? 0) + defender.defendDiceUp + defBuff + defRecovery;
  const turnWithFlag = { ...turn, defendQuotaRefilled: true } as Record<string, unknown>;
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

/** Post–Rapid Fire advance: co-attack (if any), skeleton step (if any), tick effects, then advance to next turn. */
async function runPostRapidFireAdvance(
  arenaId: string,
  room: BattleRoom,
  battle: BattleState,
  updates: Record<string, unknown>,
  ctx: {
    attackerId: string;
    defenderId: string;
    attacker: FighterState;
    defender: FighterState;
    defTotal: number;
    hit: boolean;
    isDodged: boolean;
    activeEffects: ActiveEffect[];
    turn: TurnState;
    skeletonsForAttack: any[];
  },
): Promise<void> {
  const { attackerId, defenderId, attacker, defender, defTotal, hit, isDodged, activeEffects, turn, skeletonsForAttack } = ctx;
  let battleRef = battle;
  if (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) {
    battleRef = { ...battle, activeEffects: updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] };
  }
  const effectUpdates = await tickEffectsWithSkeletonBlock(arenaId, room, battleRef, updates);
  Object.assign(updates, effectUpdates);
  const getHp = (m: FighterState) => {
    const path = findFighterPath(room, m.characterId);
    if (path && `${path}/currentHp` in updates) return updates[`${path}/currentHp`] as number;
    return m.currentHp;
  };
  let teamAMembers = (room.teamA?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
  let teamBMembers = (room.teamB?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
  let latestEffects = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || battleRef.activeEffects || [];
  const END_ARENA_HIT_EFFECTS_DELAY_MS = 3500;
  if (isTeamEliminated(teamBMembers, latestEffects)) {
    updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: turn.attackerTeam, defenderId, phase: PHASE.DONE, attackRoll: turn.attackRoll, defendRoll: turn.defendRoll, action: turn.action, playbackStep: null, resolvingHitIndex: null };
    updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
    await update(roomRef(arenaId), updates);
    setTimeout(() => {
      update(roomRef(arenaId), {
        [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.A,
        [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
        [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
        [ARENA_PATH.BATTLE_LAST_HIT_MINION_ID]: null,
        [ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID]: null,
        [ARENA_PATH.BATTLE_LAST_SKELETON_HITS]: null,
      }).catch(() => {});
    }, END_ARENA_HIT_EFFECTS_DELAY_MS);
    return;
  }
  if (isTeamEliminated(teamAMembers, latestEffects)) {
    updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: turn.attackerTeam, defenderId, phase: PHASE.DONE, attackRoll: turn.attackRoll, defendRoll: turn.defendRoll, action: turn.action, playbackStep: null, resolvingHitIndex: null };
    updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
    await update(roomRef(arenaId), updates);
    setTimeout(() => {
      update(roomRef(arenaId), {
        [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.B,
        [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
        [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
        [ARENA_PATH.BATTLE_LAST_HIT_MINION_ID]: null,
        [ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID]: null,
        [ARENA_PATH.BATTLE_LAST_SKELETON_HITS]: null,
      }).catch(() => {});
    }, END_ARENA_HIT_EFFECTS_DELAY_MS);
    return;
  }
  const updatedRoom = { ...room, teamA: { ...room.teamA, members: teamAMembers }, teamB: { ...room.teamB, members: teamBMembers } };
  const updatedQueue = buildTurnQueue(updatedRoom as BattleRoom, latestEffects);
  updates[ARENA_PATH.BATTLE_TURN_QUEUE] = updatedQueue;
  const currentAttackerIdx = updatedQueue.findIndex((e: TurnQueueEntry) => e.characterId === attackerId);
  const fromIdx = currentAttackerIdx !== -1 ? currentAttackerIdx : battle.currentTurnIndex;
  const { index: nextIdx, wrapped } = nextAliveIndex(updatedQueue, fromIdx, updatedRoom as BattleRoom, latestEffects);
  const nextEntry = updatedQueue[nextIdx];
  const selfRes3 = applySelfResurrect(nextEntry.characterId, updatedRoom as BattleRoom, latestEffects, updates, battle);
  const nextFighter = findFighter(updatedRoom, nextEntry.characterId);
  const activeEff = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || latestEffects;
  let nextTurnOnly: Record<string, unknown>;
  if (nextFighter && !selfRes3 && isStunned(activeEff, nextEntry.characterId)) {
    const { index: skipIdx, wrapped: skipWrapped } = nextAliveIndex(updatedQueue, nextIdx, updatedRoom as BattleRoom, latestEffects);
    const skipEntry = updatedQueue[skipIdx];
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
    if (skipWrapped) updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = (updates[ARENA_PATH.BATTLE_ROUND_NUMBER] as number || battle.roundNumber) + 1;
    nextTurnOnly = { attackerId: skipEntry.characterId, attackerTeam: skipEntry.team, phase: PHASE.SELECT_ACTION };
    const battleForDryadSkip = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? latestEffects };
    const dryadSkip = applySecretOfDryadPassive(room, skipEntry.characterId, battleForDryadSkip, 0);
    if (dryadSkip[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, dryadSkip);
    const efflorescenceMuseSkip = onEfflorescenceMuseTurnStart(room, { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? latestEffects }, skipEntry.characterId);
    if (efflorescenceMuseSkip) Object.assign(updates, efflorescenceMuseSkip);
  } else {
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
    nextTurnOnly = { attackerId: nextEntry.characterId, attackerTeam: nextEntry.team, phase: PHASE.SELECT_ACTION };
    if (selfRes3) nextTurnOnly.resurrectTargetId = nextEntry.characterId;
    const battleForDryad = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? latestEffects };
    const dryadNext = applySecretOfDryadPassive(room, nextEntry.characterId, battleForDryad, 0);
    if (dryadNext[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, dryadNext);
    const efflorescenceMuseNext = onEfflorescenceMuseTurnStart(room, { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? latestEffects }, nextEntry.characterId);
    if (efflorescenceMuseNext) Object.assign(updates, efflorescenceMuseNext);
  }
  updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
  updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
  const turnRef = ref(db, `arenas/${arenaId}/battle/turn`);
  await set(turnRef, nextTurnOnly);
  delete updates[ARENA_PATH.BATTLE_TURN];
  await update(roomRef(arenaId), updates);
}

/* ── resolve turn (compare dice, apply damage, advance) ── */

export async function resolveTurn(arenaId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  let battle = room.battle;
  if (!battle || !battle.turn) return;
  const turnPhase = battle.turn.phase;
  if (turnPhase !== PHASE.RESOLVING && turnPhase !== PHASE.RESOLVING_AFTER_RAPID_FIRE) return;
  // Winner is being delayed so hit effects can play; wait for delayed write
  if (battle.winnerDelayedAt != null) return;

  // Soul Devourer heal skipped: skeleton hits and master hit can run; only block advancing to next attacker until Roger that (checked in skeleton "past last" block below)

  // Shadow Camouflaging: wait for player to roll D4 for refill; only advanceAfterShadowCamouflageD4 may advance
  const scWinFaces = (battle.turn as any)?.shadowCamouflageRefillWinFaces;
  const scRoll = (battle.turn as any)?.shadowCamouflageRefillRoll;
  if (Array.isArray(scWinFaces) && scWinFaces.length > 0 && scRoll == null) return;

  const { attackerId, defenderId, attackRoll = 0, defendRoll = 0, action } = battle.turn;

  /** Keraunos Voltage: targets whose hit was blocked by skeleton get no shock (filled in Keraunos damage block, used in shock block). */
  let keraunosShockExcludeTargetIds: string[] = [];

  // Soul Devourer: chose Use Power that cannot attack — only advance turn (no target, no damage)
  if (battle.turn.soulDevourerEndTurnOnly) {
    const turn = battle.turn;
    const updates: Record<string, unknown> = {};
    const effectUpdates = await tickEffectsWithSkeletonBlock(arenaId, room, battle, updates);
    Object.assign(updates, effectUpdates);
    if (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) {
      battle = { ...battle, activeEffects: updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] };
    }
    const latestEffects = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || battle.activeEffects || [];
    const getHp = (m: FighterState) => {
      const path = findFighterPath(room, m.characterId);
      if (path && `${path}/currentHp` in updates) return updates[`${path}/currentHp`] as number;
      return m.currentHp;
    };
    const teamAMembers = (room.teamA?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
    const teamBMembers = (room.teamB?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
    const END_ARENA_DELAY_MS = 3500;
    if (isTeamEliminated(teamBMembers, latestEffects)) {
      updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: turn.attackerTeam, phase: PHASE.DONE };
      updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
      await update(roomRef(arenaId), updates);
      setTimeout(() => {
        update(roomRef(arenaId), {
          [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.A,
          [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
          [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
        }).catch(() => { });
      }, END_ARENA_DELAY_MS);
      return;
    }
    if (isTeamEliminated(teamAMembers, latestEffects)) {
      updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: turn.attackerTeam, phase: PHASE.DONE };
      updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
      await update(roomRef(arenaId), updates);
      setTimeout(() => {
        update(roomRef(arenaId), {
          [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.B,
          [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
          [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
        }).catch(() => { });
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
    const selfRes = applySelfResurrect(nextEntry.characterId, updatedRoom, latestEffects, updates, battle);
    const nextFighter = findFighter(updatedRoom, nextEntry.characterId);
    const activeEff = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || latestEffects;
    if (nextFighter && !selfRes && isStunned(activeEff, nextEntry.characterId)) {
      updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
      updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
      const afterStunRoom = { ...updatedRoom };
      const { index: skipIdx, wrapped: skipWrapped } = nextAliveIndex(updatedQueue, nextIdx, afterStunRoom, latestEffects);
      const skipEntry = updatedQueue[skipIdx];
      updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdx;
      if (skipWrapped) updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = (updates[ARENA_PATH.BATTLE_ROUND_NUMBER] as number || battle.roundNumber) + 1;
      updates[ARENA_PATH.BATTLE_TURN] = { attackerId: skipEntry.characterId, attackerTeam: skipEntry.team, phase: PHASE.SELECT_ACTION };
    } else {
      updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
      updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
      const turnData: Record<string, unknown> = { attackerId: nextEntry.characterId, attackerTeam: nextEntry.team, phase: PHASE.SELECT_ACTION };
      if (selfRes) turnData.resurrectTargetId = nextEntry.characterId;
      updates[ARENA_PATH.BATTLE_TURN] = turnData;
    }
    updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
    updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
    updates[ARENA_PATH.BATTLE_LAST_SKELETON_HITS] = null;
    await update(roomRef(arenaId), updates);
    return;
  }

  if (!defenderId) return;

  const attacker = findFighter(room, attackerId);
  const defender = findFighter(room, defenderId);
  if (!attacker || !defender) return;

  const turn = battle.turn;
  // Advance only after Rapid Fire D4 chain done (skip main resolution)
  if (turnPhase === PHASE.RESOLVING_AFTER_RAPID_FIRE) {
    const updatesResume: Record<string, unknown> = {
      [ARENA_PATH.BATTLE_TURN]: { ...turn, phase: PHASE.RESOLVING, rapidFireDefTotal: null },
    };
    await runPostRapidFireAdvance(arenaId, room, battle, updatesResume, {
      attackerId,
      defenderId: defenderId!,
      attacker: attacker!,
      defender: defender!,
      defTotal: (turn as any).rapidFireDefTotal ?? 0,
      hit: true,
      isDodged: false,
      activeEffects: battle.activeEffects || [],
      turn,
      skeletonsForAttack: findFighterTeam(room, attackerId)
        ? ((room[findFighterTeam(room, attackerId)!]?.minions || []) as any[]).filter((m: any) => m.masterId === attackerId)
        : [],
    });
    return;
  }
  const resolvingHitIndex = (turn as any).resolvingHitIndex as number | undefined;
  const playbackStep = (turn as any).playbackStep as BattlePlaybackStep | undefined;

  if (!playbackStep) {
    if (resolvingHitIndex != null && resolvingHitIndex >= 1) {
      const nextMinionStep = buildMinionPlaybackStep(room, battle, attackerId, defenderId, resolvingHitIndex);
      if (nextMinionStep) {
        await update(roomRef(arenaId), {
          [ARENA_PATH.BATTLE_TURN]: { ...turn, playbackStep: nextMinionStep },
        });
        return;
      }

      const updatesAdvance: Record<string, unknown> = {};
      const effectUpdatesAdv = await tickEffectsWithSkeletonBlock(arenaId, room, battle, updatesAdvance);
      Object.assign(updatesAdvance, effectUpdatesAdv);
      const battleAdv = updatesAdvance[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] ? { ...battle, activeEffects: updatesAdvance[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] } : battle;
      const getHpAdv = (m: FighterState) => {
        const path = findFighterPath(room, m.characterId);
        if (path && `${path}/currentHp` in updatesAdvance) return updatesAdvance[`${path}/currentHp`] as number;
        return m.currentHp;
      };
      const teamAMembersAdv = (room.teamA?.members || []).map((m: FighterState) => ({ ...m, currentHp: getHpAdv(m) }));
      const teamBMembersAdv = (room.teamB?.members || []).map((m: FighterState) => ({ ...m, currentHp: getHpAdv(m) }));
      const latestEffectsAdv = (updatesAdvance[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || battleAdv.activeEffects || [];
      const updatedRoomAdv = { ...room, teamA: { ...room.teamA, members: teamAMembersAdv }, teamB: { ...room.teamB, members: teamBMembersAdv } } as BattleRoom;
      const updatedQueueAdv = buildTurnQueue(updatedRoomAdv, latestEffectsAdv);
      updatesAdvance[ARENA_PATH.BATTLE_TURN_QUEUE] = updatedQueueAdv;
      const currentAttackerIdxAdv = updatedQueueAdv.findIndex((e: TurnQueueEntry) => e.characterId === attackerId);
      const fromIdxAdv = currentAttackerIdxAdv !== -1 ? currentAttackerIdxAdv : battle.currentTurnIndex;
      const { index: nextIdxAdv, wrapped: wrappedAdv } = nextAliveIndex(updatedQueueAdv, fromIdxAdv, updatedRoomAdv, latestEffectsAdv);
      const nextEntryAdv = updatedQueueAdv[nextIdxAdv];
      const selfResAdv = applySelfResurrect(nextEntryAdv.characterId, updatedRoomAdv, latestEffectsAdv, updatesAdvance, battle);
      const nextFighterAdv = findFighter(updatedRoomAdv, nextEntryAdv.characterId);
      const activeEffAdv = (updatesAdvance[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || latestEffectsAdv;
      if (nextFighterAdv && !selfResAdv && isStunned(activeEffAdv, nextEntryAdv.characterId)) {
        const { index: skipIdxAdv } = nextAliveIndex(updatedQueueAdv, nextIdxAdv, { ...updatedRoomAdv }, latestEffectsAdv);
        const skipEntryAdv = updatedQueueAdv[skipIdxAdv];
        updatesAdvance[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdxAdv;
        updatesAdvance[ARENA_PATH.BATTLE_ROUND_NUMBER] = battle.roundNumber + (wrappedAdv ? 1 : 0);
        updatesAdvance[ARENA_PATH.BATTLE_TURN] = { attackerId: skipEntryAdv.characterId, attackerTeam: skipEntryAdv.team, phase: PHASE.SELECT_ACTION };
      } else {
        updatesAdvance[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdxAdv;
        updatesAdvance[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrappedAdv ? battle.roundNumber + 1 : battle.roundNumber;
        updatesAdvance[ARENA_PATH.BATTLE_TURN] = { attackerId: nextEntryAdv.characterId, attackerTeam: nextEntryAdv.team, phase: PHASE.SELECT_ACTION, ...(selfResAdv ? { resurrectTargetId: nextEntryAdv.characterId } : {}) };
      }
      updatesAdvance[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
      updatesAdvance[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
      updatesAdvance[ARENA_PATH.BATTLE_LAST_SKELETON_HITS] = null;
      await update(roomRef(arenaId), updatesAdvance);
      return;
    }

    // Keraunos: log uses main target as defenderId; use main target for step so step matches log when it arrives
    const mainIdForStep = (turn as any).usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE ? ((turn as any).keraunosMainTargetId ?? defenderId) : defenderId;
    const defenderForStep = findFighter(room, mainIdForStep) ?? defender;
    const initialStep = buildMasterPlaybackStep(room, battle, attacker, defenderForStep);
    await update(roomRef(arenaId), {
      [ARENA_PATH.BATTLE_TURN]: { ...turn, playbackStep: initialStep },
    });
    return;
  }

  // Per-hit resolve: apply one skeleton and write so client sees defender HP update in real time
  if (playbackStep.kind === BATTLE_PLAYBACK_KIND.MINION && resolvingHitIndex != null && resolvingHitIndex >= 1) {
    const attackerTeam = findFighterTeam(room, attackerId);
    const minions = attackerTeam ? (room[attackerTeam]?.minions || []) : [];
    const skeletonsForAttackSk = minions.filter((m: any) => m.masterId === attackerId);
    const skIndex = resolvingHitIndex - 1;

    // Past last skeleton: client already saw last hit card and called resolve again → check Spring (heal2 or heal1) then advance
    if (skIndex >= skeletonsForAttackSk.length) {
      const springCasterIdSk = (battle as { springCasterId?: string }).springCasterId;
      const springHeal1Sk = (battle as { springHeal1?: number }).springHeal1;
      const springHeal1ReceivedSk = (battle as { springHeal1Received?: string[] }).springHeal1Received ?? [];
      const springHeal2Sk = (battle as { springHeal2?: number | null }).springHeal2;
      const isCasterTeamSk = springCasterIdSk && ((room.teamA?.members || []).some((m: FighterState) => m.characterId === springCasterIdSk) ? (room.teamA?.members || []).some((m: FighterState) => m.characterId === attackerId) : (room.teamB?.members || []).some((m: FighterState) => m.characterId === attackerId));
      // R{n+2}: caster has heal2 pending — apply it or show skipped-heal modal
      if (springCasterIdSk && isCasterTeamSk && springHeal2Sk != null && attackerId === springCasterIdSk) {
        const rawEffH2 = battle.activeEffects;
        const effectsH2: ActiveEffect[] = Array.isArray(rawEffH2) ? rawEffH2 : (rawEffH2 && typeof rawEffH2 === 'object' ? Object.values(rawEffH2) : []) as ActiveEffect[];
        const springHeal2SkippedSk = isHealingNullified(effectsH2, attackerId);
        const pathH2 = findFighterPath(room, attackerId);
        if (pathH2) {
          const fighterH2 = (room.teamA?.members || []).concat(room.teamB?.members || []).find(m => m.characterId === attackerId);
          const effectiveHealH2 = getEffectiveHealForReceiver(springHeal2Sk, fighterH2 ?? null, attackerId, effectsH2);
          const springHeal2SkippedSk2 = springHeal2SkippedSk || effectiveHealH2 === 0;
          const healAmountH2 = springHeal2SkippedSk2 ? 0 : effectiveHealH2;
          const hpKeyH2 = `${pathH2}/currentHp`;
          const currentHpH2 = (fighterH2?.currentHp ?? 0) as number;
          const newHpH2 = Math.min(fighterH2?.maxHp ?? 999, currentHpH2 + healAmountH2);
          const springUpdH2: Record<string, unknown> = { [hpKeyH2]: newHpH2 };
          const logArrH2 = [...(battle.log || [])];
          logArrH2.push({
            round: battle.roundNumber,
            attackerId,
            defenderId: attackerId,
            attackRoll: 0,
            defendRoll: 0,
            damage: 0,
            heal: healAmountH2,
            defenderHpAfter: newHpH2,
            eliminated: false,
            missed: false,
            powerUsed: 'Ephemeral Season: Spring',
            springHeal: springHeal2Sk,
            springHealCrit: springHeal2Sk === 2,
            ...(springHeal2SkippedSk2 ? { healSkipReason: EFFECT_TAGS.HEALING_NULLIFIED } : {}),
          });
          springUpdH2[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog(logArrH2);
          if (springHeal2SkippedSk2) {
            springUpdH2[ARENA_PATH.BATTLE_SPRING_HEAL_ROLL_ACTIVE] = false;
            springUpdH2[ARENA_PATH.BATTLE_TURN] = {
              attackerId,
              attackerTeam: turn.attackerTeam,
              phase: PHASE.ROLLING_SPRING_HEAL,
              springHealSkipAwaitsAck: true,
              healSkipReason: EFFECT_TAGS.HEALING_NULLIFIED,
              playbackStep: null,
              resolvingHitIndex: null,
            };
            springUpdH2[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
            springUpdH2[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
            springUpdH2[ARENA_PATH.BATTLE_LAST_SKELETON_HITS] = null;
            await update(roomRef(arenaId), springUpdH2);
            return;
          }
          // Heal2 applied: clear Spring and fall through to advance
          springUpdH2[ARENA_PATH.BATTLE_SPRING_CASTER_ID] = null;
          springUpdH2[ARENA_PATH.BATTLE_SPRING_HEAL1] = null;
          springUpdH2[ARENA_PATH.BATTLE_SPRING_HEAL1_RECEIVED] = null;
          springUpdH2[ARENA_PATH.BATTLE_SPRING_HEAL2] = null;
          const currentEffH2 = battle.activeEffects || [];
          const withoutSpringH2 = currentEffH2.filter((e: ActiveEffect) => e.tag !== EFFECT_TAGS.SEASON_SPRING);
          springUpdH2[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = withoutSpringH2;
          const effectUpdatesH2 = await tickEffectsWithSkeletonBlock(arenaId, room, battle, springUpdH2);
          Object.assign(springUpdH2, effectUpdatesH2);
          const battleAfterH2 = springUpdH2[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] ? { ...battle, activeEffects: springUpdH2[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] } : battle;
          const getHpAfterH2 = (m: FighterState) => {
            const p = findFighterPath(room, m.characterId);
            if (p && `${p}/currentHp` in springUpdH2) return springUpdH2[`${p}/currentHp`] as number;
            return m.currentHp;
          };
          const teamAMembersH2 = (room.teamA?.members || []).map((m: FighterState) => ({ ...m, currentHp: getHpAfterH2(m) }));
          const teamBMembersH2 = (room.teamB?.members || []).map((m: FighterState) => ({ ...m, currentHp: getHpAfterH2(m) }));
          const latestEffH2 = (springUpdH2[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || battleAfterH2.activeEffects || [];
          const updatedRoomH2 = { ...room, teamA: { ...room.teamA, members: teamAMembersH2 }, teamB: { ...room.teamB, members: teamBMembersH2 } } as BattleRoom;
          const updatedQueueH2 = buildTurnQueue(updatedRoomH2, latestEffH2);
          springUpdH2[ARENA_PATH.BATTLE_TURN_QUEUE] = updatedQueueH2;
          const currentAttackerIdxH2 = updatedQueueH2.findIndex((e: TurnQueueEntry) => e.characterId === attackerId);
          const fromIdxH2 = currentAttackerIdxH2 !== -1 ? currentAttackerIdxH2 : battle.currentTurnIndex;
          const { index: nextIdxH2, wrapped: wrappedH2 } = nextAliveIndex(updatedQueueH2, fromIdxH2, updatedRoomH2, latestEffH2);
          const nextEntryH2 = updatedQueueH2[nextIdxH2];
          const selfResH2 = applySelfResurrect(nextEntryH2.characterId, updatedRoomH2, latestEffH2, springUpdH2, battle);
          const nextFighterH2 = findFighter(updatedRoomH2, nextEntryH2.characterId);
          const activeEffH2 = (springUpdH2[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || latestEffH2;
          if (nextFighterH2 && !selfResH2 && isStunned(activeEffH2, nextEntryH2.characterId)) {
            const { index: skipIdxH2 } = nextAliveIndex(updatedQueueH2, nextIdxH2, { ...updatedRoomH2 }, latestEffH2);
            const skipEntryH2 = updatedQueueH2[skipIdxH2];
            springUpdH2[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdxH2;
            springUpdH2[ARENA_PATH.BATTLE_ROUND_NUMBER] = battle.roundNumber + (wrappedH2 ? 1 : 0);
            springUpdH2[ARENA_PATH.BATTLE_TURN] = { attackerId: skipEntryH2.characterId, attackerTeam: skipEntryH2.team, phase: PHASE.SELECT_ACTION };
          } else {
            springUpdH2[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdxH2;
            springUpdH2[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrappedH2 ? battle.roundNumber + 1 : battle.roundNumber;
            springUpdH2[ARENA_PATH.BATTLE_TURN] = { attackerId: nextEntryH2.characterId, attackerTeam: nextEntryH2.team, phase: PHASE.SELECT_ACTION, ...(selfResH2 ? { resurrectTargetId: nextEntryH2.characterId } : {}) };
          }
          springUpdH2[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
          springUpdH2[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
          springUpdH2[ARENA_PATH.BATTLE_LAST_SKELETON_HITS] = null;
          await update(roomRef(arenaId), springUpdH2);
          return;
        }
      }
      if (springCasterIdSk && isCasterTeamSk && springHeal2Sk == null && springHeal1Sk != null && !springHeal1ReceivedSk.includes(attackerId)) {
        const pathSk = findFighterPath(room, attackerId);
        if (pathSk) {
          const hpKeySk = `${pathSk}/currentHp`;
          const fighterSk = (room.teamA?.members || []).concat(room.teamB?.members || []).find(m => m.characterId === attackerId);
          const currentHpSk = (fighterSk?.currentHp ?? 0) as number;
          const rawSk = battle.activeEffects;
          const effectsSk: ActiveEffect[] = Array.isArray(rawSk) ? rawSk : (rawSk && typeof rawSk === 'object' ? Object.values(rawSk) : []) as ActiveEffect[];
          const springHealSkippedSk = isHealingNullified(effectsSk, attackerId);
          const healAmountSk = springHealSkippedSk ? 0 : getEffectiveHealForReceiver(springHeal1Sk, fighterSk ?? null, attackerId, effectsSk);
          const newHpSk = Math.min(fighterSk?.maxHp ?? 999, currentHpSk + healAmountSk);
          const springUpd: Record<string, unknown> = { [hpKeySk]: newHpSk };
          const logArrSk = [...(battle.log || [])];
          logArrSk.push({
            round: battle.roundNumber,
            attackerId: springCasterIdSk,
            defenderId: attackerId,
            attackRoll: 0,
            defendRoll: 0,
            damage: 0,
            heal: healAmountSk,
            defenderHpAfter: newHpSk,
            eliminated: false,
            missed: false,
            powerUsed: 'Ephemeral Season: Spring',
            springHeal: springHeal1Sk,
            springHealCrit: springHeal1Sk === 2,
            ...(springHealSkippedSk ? { healSkipReason: EFFECT_TAGS.HEALING_NULLIFIED } : {}),
          });
          springUpd[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog(logArrSk);
          springUpd[ARENA_PATH.BATTLE_SPRING_HEAL1_RECEIVED] = [...springHeal1ReceivedSk, attackerId];
          if (attackerId === springCasterIdSk && springHealSkippedSk) {
            springUpd[ARENA_PATH.BATTLE_SPRING_HEAL_ROLL_ACTIVE] = false;
            springUpd[ARENA_PATH.BATTLE_TURN] = {
              attackerId,
              attackerTeam: turn.attackerTeam,
              phase: PHASE.ROLLING_SPRING_HEAL,
              springHealSkipAwaitsAck: true,
              healSkipReason: EFFECT_TAGS.HEALING_NULLIFIED,
              playbackStep: null,
              resolvingHitIndex: null,
            };
            springUpd[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
            springUpd[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
            springUpd[ARENA_PATH.BATTLE_LAST_SKELETON_HITS] = null;
            await update(roomRef(arenaId), springUpd);
            return;
          }
          if (attackerId === springCasterIdSk && !springHealSkippedSk) {
            const casterSk = findFighter(room, attackerId);
            const baseCritSk = casterSk ? (typeof casterSk.criticalRate === 'number' ? casterSk.criticalRate : 25) : 25;
            const latestEffSk = battle.activeEffects || [];
            const healCritRateSk = Math.min(100, Math.max(0, baseCritSk + getStatModifier(latestEffSk, attackerId, MOD_STAT.CRITICAL_RATE)));
            const winFacesSk = getWinningFaces(healCritRateSk);
            springUpd[ARENA_PATH.BATTLE_SPRING_HEAL_ROLL_ACTIVE] = true;
            springUpd[ARENA_PATH.BATTLE_TURN] = {
              attackerId,
              attackerTeam: turn.attackerTeam,
              phase: PHASE.ROLLING_SPRING_HEAL,
              springHealWinFaces: winFacesSk,
              springRound: 2,
              playbackStep: null,
              resolvingHitIndex: null,
            };
            springUpd[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
            springUpd[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
            springUpd[ARENA_PATH.BATTLE_LAST_SKELETON_HITS] = null;
            await update(roomRef(arenaId), springUpd);
            return;
          }
        }
      }
      // Soul Devourer heal skipped: do not advance to next attacker until Roger that
      if ((turn as any).soulDevourerHealSkipAwaitsAck) return;
      const updatesAdvance: Record<string, unknown> = {};
      const effectUpdatesAdv = await tickEffectsWithSkeletonBlock(arenaId, room, battle, updatesAdvance);
      Object.assign(updatesAdvance, effectUpdatesAdv);
      const battleAdv = updatesAdvance[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] ? { ...battle, activeEffects: updatesAdvance[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] } : battle;
      const getHpAdv = (m: FighterState) => {
        const path = findFighterPath(room, m.characterId);
        if (path && `${path}/currentHp` in updatesAdvance) return updatesAdvance[`${path}/currentHp`] as number;
        return m.currentHp;
      };
      const teamAMembersAdv = (room.teamA?.members || []).map((m: FighterState) => ({ ...m, currentHp: getHpAdv(m) }));
      const teamBMembersAdv = (room.teamB?.members || []).map((m: FighterState) => ({ ...m, currentHp: getHpAdv(m) }));
      const latestEffectsAdv = (updatesAdvance[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || battleAdv.activeEffects || [];
      const updatedRoomAdv = { ...room, teamA: { ...room.teamA, members: teamAMembersAdv }, teamB: { ...room.teamB, members: teamBMembersAdv } } as BattleRoom;
      const updatedQueueAdv = buildTurnQueue(updatedRoomAdv, latestEffectsAdv);
      updatesAdvance[ARENA_PATH.BATTLE_TURN_QUEUE] = updatedQueueAdv;
      const currentAttackerIdxAdv = updatedQueueAdv.findIndex((e: TurnQueueEntry) => e.characterId === attackerId);
      const fromIdxAdv = currentAttackerIdxAdv !== -1 ? currentAttackerIdxAdv : battle.currentTurnIndex;
      const { index: nextIdxAdv, wrapped: wrappedAdv } = nextAliveIndex(updatedQueueAdv, fromIdxAdv, updatedRoomAdv, latestEffectsAdv);
      const nextEntryAdv = updatedQueueAdv[nextIdxAdv];
      const selfResAdv = applySelfResurrect(nextEntryAdv.characterId, updatedRoomAdv, latestEffectsAdv, updatesAdvance, battle);
      const nextFighterAdv = findFighter(updatedRoomAdv, nextEntryAdv.characterId);
      const activeEffAdv = (updatesAdvance[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || latestEffectsAdv;
      if (nextFighterAdv && !selfResAdv && isStunned(activeEffAdv, nextEntryAdv.characterId)) {
        const { index: skipIdxAdv } = nextAliveIndex(updatedQueueAdv, nextIdxAdv, { ...updatedRoomAdv }, latestEffectsAdv);
        const skipEntryAdv = updatedQueueAdv[skipIdxAdv];
        updatesAdvance[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdxAdv;
        updatesAdvance[ARENA_PATH.BATTLE_ROUND_NUMBER] = battle.roundNumber + (wrappedAdv ? 1 : 0);
        updatesAdvance[ARENA_PATH.BATTLE_TURN] = { attackerId: skipEntryAdv.characterId, attackerTeam: skipEntryAdv.team, phase: PHASE.SELECT_ACTION };
      } else {
        updatesAdvance[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdxAdv;
        updatesAdvance[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrappedAdv ? battle.roundNumber + 1 : battle.roundNumber;
        updatesAdvance[ARENA_PATH.BATTLE_TURN] = { attackerId: nextEntryAdv.characterId, attackerTeam: nextEntryAdv.team, phase: PHASE.SELECT_ACTION, ...(selfResAdv ? { resurrectTargetId: nextEntryAdv.characterId } : {}) };
      }
      updatesAdvance[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
      updatesAdvance[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
      updatesAdvance[ARENA_PATH.BATTLE_LAST_SKELETON_HITS] = null;
      await update(roomRef(arenaId), updatesAdvance);
      return;
    }

    if (skIndex < skeletonsForAttackSk.length) {
      const sk = skeletonsForAttackSk[skIndex];
      const defPath = findFighterPath(room, defenderId);
      const currentDefHp = defender.currentHp;
      if (currentDefHp <= 0) {
        // Defender already dead (e.g. race); check Spring (D4 heal2) then advance turn and clear resolvingHitIndex
        const springCasterIdAdv = (battle as { springCasterId?: string }).springCasterId;
        const springHeal1Adv = (battle as { springHeal1?: number }).springHeal1;
        const springHeal1ReceivedAdv = (battle as { springHeal1Received?: string[] }).springHeal1Received ?? [];
        const isCasterTeamAdv = springCasterIdAdv && ((room.teamA?.members || []).some((m: FighterState) => m.characterId === springCasterIdAdv) ? (room.teamA?.members || []).some((m: FighterState) => m.characterId === attackerId) : (room.teamB?.members || []).some((m: FighterState) => m.characterId === attackerId));
        if (springCasterIdAdv && isCasterTeamAdv && (battle as { springHeal2?: number | null }).springHeal2 == null && springHeal1Adv != null && !springHeal1ReceivedAdv.includes(attackerId) && attackerId === springCasterIdAdv) {
          const pathAdv = findFighterPath(room, attackerId);
          if (pathAdv) {
            const hpKeyAdv = `${pathAdv}/currentHp`;
            const fighterAdv = (room.teamA?.members || []).concat(room.teamB?.members || []).find(m => m.characterId === attackerId);
            const currentHpAdv = (fighterAdv?.currentHp ?? 0) as number;
            const rawAdv = battle.activeEffects;
            const effectsAdv: ActiveEffect[] = Array.isArray(rawAdv) ? rawAdv : (rawAdv && typeof rawAdv === 'object' ? Object.values(rawAdv) : []) as ActiveEffect[];
            const springHealSkippedAdv = isHealingNullified(effectsAdv, attackerId);
            const healAmountAdv = springHealSkippedAdv ? 0 : getEffectiveHealForReceiver(springHeal1Adv, fighterAdv ?? null, attackerId, effectsAdv);
            const newHpAdv = Math.min(fighterAdv?.maxHp ?? 999, currentHpAdv + healAmountAdv);
            const springUpdAdv: Record<string, unknown> = { [hpKeyAdv]: newHpAdv };
            const logArrAdv = [...(battle.log || [])];
            logArrAdv.push({
              round: battle.roundNumber,
              attackerId: springCasterIdAdv,
              defenderId: attackerId,
              attackRoll: 0,
              defendRoll: 0,
              damage: 0,
              heal: healAmountAdv,
              defenderHpAfter: newHpAdv,
              eliminated: false,
              missed: false,
              powerUsed: 'Ephemeral Season: Spring',
              springHeal: springHeal1Adv,
              springHealCrit: springHeal1Adv === 2,
              ...(springHealSkippedAdv ? { healSkipReason: EFFECT_TAGS.HEALING_NULLIFIED } : {}),
            });
            springUpdAdv[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog(logArrAdv);
            springUpdAdv[ARENA_PATH.BATTLE_SPRING_HEAL1_RECEIVED] = [...springHeal1ReceivedAdv, attackerId];
            if (springHealSkippedAdv) {
              springUpdAdv[ARENA_PATH.BATTLE_SPRING_HEAL_ROLL_ACTIVE] = false;
              springUpdAdv[ARENA_PATH.BATTLE_TURN] = {
                attackerId,
                attackerTeam: turn.attackerTeam,
                phase: PHASE.ROLLING_SPRING_HEAL,
                springHealSkipAwaitsAck: true,
                healSkipReason: EFFECT_TAGS.HEALING_NULLIFIED,
                playbackStep: null,
                resolvingHitIndex: null,
              };
              await update(roomRef(arenaId), springUpdAdv);
              return;
            }
            const casterAdv = findFighter(room, attackerId);
            const baseCritAdv = casterAdv ? (typeof casterAdv.criticalRate === 'number' ? casterAdv.criticalRate : 25) : 25;
            const healCritRateAdv = Math.min(100, Math.max(0, baseCritAdv + getStatModifier(battle.activeEffects || [], attackerId, MOD_STAT.CRITICAL_RATE)));
            const winFacesAdv = getWinningFaces(healCritRateAdv);
            springUpdAdv[ARENA_PATH.BATTLE_SPRING_HEAL_ROLL_ACTIVE] = true;
            springUpdAdv[ARENA_PATH.BATTLE_TURN] = {
              attackerId,
              attackerTeam: turn.attackerTeam,
              phase: PHASE.ROLLING_SPRING_HEAL,
              springHealWinFaces: winFacesAdv,
              springRound: 2,
              playbackStep: null,
              resolvingHitIndex: null,
            };
            await update(roomRef(arenaId), springUpdAdv);
            return;
          }
        }
        const updatesAdv: Record<string, unknown> = {};
        const effectUpdatesAdv = await tickEffectsWithSkeletonBlock(arenaId, room, battle, updatesAdv);
        Object.assign(updatesAdv, effectUpdatesAdv);
        const battleAdv = updatesAdv[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] ? { ...battle, activeEffects: updatesAdv[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] } : battle;
        const getHpAdv = (m: FighterState) => {
          const path = findFighterPath(room, m.characterId);
          if (path && `${path}/currentHp` in updatesAdv) return updatesAdv[`${path}/currentHp`] as number;
          return m.currentHp;
        };
        const teamAMembersAdv = (room.teamA?.members || []).map((m: FighterState) => ({ ...m, currentHp: getHpAdv(m) }));
        const teamBMembersAdv = (room.teamB?.members || []).map((m: FighterState) => ({ ...m, currentHp: getHpAdv(m) }));
        const latestEffectsAdv = (updatesAdv[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || battleAdv.activeEffects || [];
        const END_ARENA_DELAY_MS = 3500;
        if (isTeamEliminated(teamBMembersAdv, latestEffectsAdv)) {
          updatesAdv[ARENA_PATH.BATTLE_TURN] = { ...turn, phase: PHASE.DONE };
          (updatesAdv[ARENA_PATH.BATTLE_TURN] as any).resolvingHitIndex = null;
          (updatesAdv[ARENA_PATH.BATTLE_TURN] as any).playbackStep = null;
          updatesAdv[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
          await update(roomRef(arenaId), updatesAdv);
          setTimeout(() => { update(roomRef(arenaId), { [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.A, [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED, [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null }).catch(() => { }); }, END_ARENA_DELAY_MS);
          return;
        }
        if (isTeamEliminated(teamAMembersAdv, latestEffectsAdv)) {
          updatesAdv[ARENA_PATH.BATTLE_TURN] = { ...turn, phase: PHASE.DONE };
          (updatesAdv[ARENA_PATH.BATTLE_TURN] as any).resolvingHitIndex = null;
          (updatesAdv[ARENA_PATH.BATTLE_TURN] as any).playbackStep = null;
          updatesAdv[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
          await update(roomRef(arenaId), updatesAdv);
          setTimeout(() => { update(roomRef(arenaId), { [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.B, [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED, [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null }).catch(() => { }); }, END_ARENA_DELAY_MS);
          return;
        }
        // Soul Devourer heal skipped: do not advance to next attacker until Roger that
        if ((turn as any).soulDevourerHealSkipAwaitsAck) return;
        const updatedRoomAdv = { ...room, teamA: { ...room.teamA, members: teamAMembersAdv }, teamB: { ...room.teamB, members: teamBMembersAdv } } as BattleRoom;
        const updatedQueueAdv = buildTurnQueue(updatedRoomAdv, latestEffectsAdv);
        updatesAdv[ARENA_PATH.BATTLE_TURN_QUEUE] = updatedQueueAdv;
        const currentAttackerIdxAdv = updatedQueueAdv.findIndex((e: TurnQueueEntry) => e.characterId === attackerId);
        const fromIdxAdv = currentAttackerIdxAdv !== -1 ? currentAttackerIdxAdv : battle.currentTurnIndex;
        const { index: nextIdxAdv, wrapped: wrappedAdv } = nextAliveIndex(updatedQueueAdv, fromIdxAdv, updatedRoomAdv, latestEffectsAdv);
        const nextEntryAdv = updatedQueueAdv[nextIdxAdv];
        const selfResAdv = applySelfResurrect(nextEntryAdv.characterId, updatedRoomAdv, latestEffectsAdv, updatesAdv, battle);
        const nextFighterAdv = findFighter(updatedRoomAdv, nextEntryAdv.characterId);
        const activeEffAdv = (updatesAdv[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || latestEffectsAdv;
        if (nextFighterAdv && !selfResAdv && isStunned(activeEffAdv, nextEntryAdv.characterId)) {
          const { index: skipIdxAdv } = nextAliveIndex(updatedQueueAdv, nextIdxAdv, { ...updatedRoomAdv }, latestEffectsAdv);
          const skipEntryAdv = updatedQueueAdv[skipIdxAdv];
          updatesAdv[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdxAdv;
          updatesAdv[ARENA_PATH.BATTLE_ROUND_NUMBER] = battle.roundNumber + (wrappedAdv ? 1 : 0);
          updatesAdv[ARENA_PATH.BATTLE_TURN] = { attackerId: skipEntryAdv.characterId, attackerTeam: skipEntryAdv.team, phase: PHASE.SELECT_ACTION };
        } else {
          updatesAdv[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdxAdv;
          updatesAdv[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrappedAdv ? battle.roundNumber + 1 : battle.roundNumber;
          updatesAdv[ARENA_PATH.BATTLE_TURN] = { attackerId: nextEntryAdv.characterId, attackerTeam: nextEntryAdv.team, phase: PHASE.SELECT_ACTION, ...(selfResAdv ? { resurrectTargetId: nextEntryAdv.characterId } : {}) };
        }
        (updatesAdv[ARENA_PATH.BATTLE_TURN] as any).resolvingHitIndex = null;
        (updatesAdv[ARENA_PATH.BATTLE_TURN] as any).playbackStep = null;
        await update(roomRef(arenaId), updatesAdv);
        return;
      } else {
        const soulDevourerDrainSk = !!(turn as any).soulDevourerDrain;
        const isCritSk = soulDevourerDrainSk ? false : !!(turn as any).isCrit;
        const stored = Number((sk && sk.damage) ?? NaN);
        const fallback = Math.ceil(attacker.damage * 0.5);
        let skRaw = (!isNaN(stored) && stored > 0) ? stored : fallback;
        const skBaseDmg = skRaw;
        if (isCritSk) skRaw = skRaw * 2;
        let mutableEffects = [...(battle.activeEffects || [])];
        let shieldRemaining = skRaw;
        let shieldsModified = false;
        for (const se of mutableEffects) {
          if (se.targetId !== defenderId || se.effectType !== 'shield') continue;
          if (shieldRemaining <= 0) break;
          const absorbed = Math.min(se.value, shieldRemaining);
          se.value -= absorbed;
          shieldRemaining -= absorbed;
          shieldsModified = true;
        }
        const updatesSk: Record<string, unknown> = {};
        if (shieldsModified) {
          const cleaned = mutableEffects.filter(e => !(e.effectType === EFFECT_TYPES.SHIELD && e.value <= 0 && !e.tag));
          updatesSk[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = cleaned;
        }
        let dmgToApply = Math.max(0, shieldRemaining);
        const skResolve = await resolveHitAtDefender(arenaId, room, defenderId, dmgToApply, updatesSk, defender);
        dmgToApply = skResolve.damageToMaster;
        if (skResolve.skippedMinionsPath) delete updatesSk[skResolve.skippedMinionsPath];

        const reflectPct = getReflectPercent((updatesSk[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || mutableEffects, defenderId);
        if (reflectPct > 0 && dmgToApply > 0) {
          const reflectDmg = Math.floor(dmgToApply * reflectPct / 100);
          const masterPath = findFighterPath(room, sk.masterId);
          if (masterPath) {
            const master = findFighter(room, sk.masterId);
            const currentMasterHp = master?.currentHp ?? 0;
            updatesSk[`${masterPath}/currentHp`] = Math.max(0, currentMasterHp - reflectDmg);
          }
        }
        const newHp = Math.max(0, currentDefHp - dmgToApply);
        if (defPath) updatesSk[`${defPath}/currentHp`] = newHp;
        const skHit: Record<string, unknown> = {
          round: battle.roundNumber,
          attackerId: sk.characterId,
          defenderId,
          attackerName: sk.nicknameEng?.toLowerCase?.() || 'skeleton',
          attackerTheme: sk.theme?.[0] || '#666',
          defenderName: defender.nicknameEng,
          defenderTheme: defender.theme[0],
          attackRoll: 0,
          defendRoll: 0,
          damage: dmgToApply,
          baseDmg: skBaseDmg,
          defenderHpAfter: newHp,
          eliminated: newHp <= 0,
          missed: false,
        };
        if (isCritSk) skHit.isCrit = true;
        skHit.hitTargetId = skResolve.hitTargetId;
        updatesSk[ARENA_PATH.BATTLE_LAST_SKELETON_HITS] = [skHit];
        updatesSk[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = sk.characterId;
        updatesSk[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = skResolve.hitTargetId;
        const existingLog = [...(battle.log || [])];
        existingLog.push(Object.assign({}, skHit, { isMinionHit: true }) as any);
        updatesSk[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog(existingLog);

        let battleAfterSk = battle;
        if (updatesSk[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) {
          battleAfterSk = { ...battle, activeEffects: updatesSk[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] };
        }
        const effectUpdatesSk = await tickEffectsWithSkeletonBlock(arenaId, room, battleAfterSk, updatesSk);
        Object.assign(updatesSk, effectUpdatesSk);

        const getHpSk = (m: FighterState) => {
          const path = findFighterPath(room, m.characterId);
          if (path && `${path}/currentHp` in updatesSk) return updatesSk[`${path}/currentHp`] as number;
          return m.currentHp;
        };
        const teamAMembersSk = (room.teamA?.members || []).map((m: FighterState) => ({ ...m, currentHp: getHpSk(m) }));
        const teamBMembersSk = (room.teamB?.members || []).map((m: FighterState) => ({ ...m, currentHp: getHpSk(m) }));
        const latestEffectsSk = (updatesSk[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || battleAfterSk.activeEffects || [];
        const END_ARENA_DELAY_MS = 3500;

        if (newHp <= 0) {
          if (isTeamEliminated(teamBMembersSk, latestEffectsSk)) {
            updatesSk[ARENA_PATH.BATTLE_TURN] = { ...turn, attackerId, attackerTeam: turn.attackerTeam, defenderId, phase: PHASE.DONE };
            (updatesSk[ARENA_PATH.BATTLE_TURN] as any).resolvingHitIndex = null;
            (updatesSk[ARENA_PATH.BATTLE_TURN] as any).playbackStep = null;
            updatesSk[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
            await update(roomRef(arenaId), updatesSk);
            setTimeout(() => {
              update(roomRef(arenaId), {
                [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.A,
                [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
                [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
                [ARENA_PATH.BATTLE_LAST_HIT_MINION_ID]: null,
                [ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID]: null,
                [ARENA_PATH.BATTLE_LAST_SKELETON_HITS]: null,
              }).catch(() => { });
            }, END_ARENA_DELAY_MS);
            return;
          }
          if (isTeamEliminated(teamAMembersSk, latestEffectsSk)) {
            updatesSk[ARENA_PATH.BATTLE_TURN] = { ...turn, attackerId, attackerTeam: turn.attackerTeam, defenderId, phase: PHASE.DONE };
            (updatesSk[ARENA_PATH.BATTLE_TURN] as any).resolvingHitIndex = null;
            (updatesSk[ARENA_PATH.BATTLE_TURN] as any).playbackStep = null;
            updatesSk[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
            await update(roomRef(arenaId), updatesSk);
            setTimeout(() => {
              update(roomRef(arenaId), {
                [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.B,
                [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
                [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
                [ARENA_PATH.BATTLE_LAST_HIT_MINION_ID]: null,
                [ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID]: null,
                [ARENA_PATH.BATTLE_LAST_SKELETON_HITS]: null,
              }).catch(() => { });
            }, END_ARENA_DELAY_MS);
            return;
          }
        }

        // Last skeleton: write only this hit so client can show the card; advance on next resolve call
        if (resolvingHitIndex === skeletonsForAttackSk.length) {
          updatesSk[ARENA_PATH.BATTLE_TURN] = { ...turn, resolvingHitIndex: skeletonsForAttackSk.length + 1, playbackStep: null };
          await update(roomRef(arenaId), updatesSk);
          return;
        }

        const nextMinionStep = buildMinionPlaybackStep(room, battleAfterSk, attackerId, defenderId, resolvingHitIndex + 1);
        updatesSk[ARENA_PATH.BATTLE_TURN] = { ...turn, resolvingHitIndex: resolvingHitIndex + 1, playbackStep: nextMinionStep };
        await update(roomRef(arenaId), updatesSk);
        return;
      }
    }
  }

  const updates: Record<string, unknown> = {};
  const activeEffects = battle.activeEffects || [];

  // Ensure rolls are valid numbers
  const safeAttackRoll = typeof attackRoll === 'number' && !isNaN(attackRoll) ? attackRoll : 0;
  const safeDefendRoll = typeof defendRoll === 'number' && !isNaN(defendRoll) ? defendRoll : 0;

  let dmg = 0;
  let hit = false;
  let isDodged = false;
  let atkTotal = 0;
  let defTotal = 0;
  let defenderHpAfter = defender.currentHp;
  // Collected skeletons to resolve after the main attack (separate logs)
  let skeletonsForAttack: any[] = [];
  /** When skeleton blocks main attack, used so log entry has hitTargetId and client does not show hit VFX on master */
  let mainResolve: { damageToMaster: number; hitTargetId: string; skippedMinionsPath?: string } | null = null;
  // Capture the main attack log entry so we can guarantee it appears before minion entries
  let mainAttackLogEntry: Record<string, unknown> | null = null;
  // Crit / shock bookkeeping (may be set during attack resolution)
  let isCrit = false;
  let critRoll = 0;
  let shockBonusDamage = 0;
  let baseDmg = 0;
  let soulDevourerDrain = false;

  // Resolve power that went through dice rolling
  const { usedPowerIndex } = battle.turn;
  const usedPower = action === TURN_ACTION.POWER && usedPowerIndex != null
    ? attacker.powers?.[usedPowerIndex]
    : undefined;

  // Self-buff power (e.g. Beyond the Nimbus): buffs already applied in selectAction().
  // Treat as normal attack for damage calculation.
  const isSelfBuffPower = action === TURN_ACTION.POWER && usedPower && !usedPower.skipDice && usedPower.target === TARGET_TYPES.SELF;

  if (action === TURN_ACTION.POWER && usedPower && !usedPower.skipDice && !isSelfBuffPower) {
    // Power with dice (damage/enemy-target) — compare rolls, apply effect on hit
    const atkBuff = getStatModifier(activeEffects, attackerId, MOD_STAT.ATTACK_DICE_UP);
    const defBuff = getStatModifier(activeEffects, defenderId, MOD_STAT.DEFEND_DICE_UP);
    const atkRecovery = getStatModifier(activeEffects, attackerId, MOD_STAT.RECOVERY_DICE_UP);
    const defRecovery = getStatModifier(activeEffects, defenderId, MOD_STAT.RECOVERY_DICE_UP);
    atkTotal = attackRoll + attacker.attackDiceUp + atkBuff + atkRecovery;
    defTotal = defendRoll + defender.defendDiceUp + defBuff + defRecovery;
    hit = atkTotal > defTotal;

    // Pomegranate's Oath dodge: defender with spirit may dodge
    if (hit && battle.turn.isDodged) {
      isDodged = true;
      hit = false;
    }

    if (hit) {
      if (usedPower.effect === EFFECT_TYPES.DAMAGE || usedPower.effect === EFFECT_TYPES.LIFESTEAL) {
        // Route damage through resolveHitAtDefender so Hades child's skeleton can block
        const defPath = findFighterPath(room, defenderId);
        const powerResolve = await resolveHitAtDefender(arenaId, room, defenderId, usedPower.value, updates, defender);
        if (powerResolve.skippedMinionsPath) delete updates[powerResolve.skippedMinionsPath];
        if (defPath && powerResolve.damageToMaster > 0) {
          const cur = (updates[`${defPath}/currentHp`] as number | undefined) ?? defender.currentHp;
          updates[`${defPath}/currentHp`] = Math.max(0, cur - powerResolve.damageToMaster);
        }
        if (usedPower.effect === EFFECT_TYPES.LIFESTEAL && powerResolve.damageToMaster > 0) {
          const atkPath = findFighterPath(room, attackerId);
          if (atkPath) {
            const att = findFighter(room, attackerId);
            const curAtt = (updates[`${atkPath}/currentHp`] as number | undefined) ?? att?.currentHp ?? 0;
            updates[`${atkPath}/currentHp`] = Math.min(att?.maxHp ?? 999, curAtt + Math.ceil(powerResolve.damageToMaster * 0.5));
          }
        }
        dmg = powerResolve.damageToMaster;
        defenderHpAfter = defPath ? (updates[`${defPath}/currentHp`] as number) : defender.currentHp;
      } else {
        const effectUpdates = applyPowerEffect(room, attackerId, defenderId, usedPower, battle);
        Object.assign(updates, effectUpdates);
      }
    }

    const logEntry = {
      round: battle.roundNumber,
      attackerId,
      defenderId,
      attackRoll: safeAttackRoll,
      defendRoll: safeDefendRoll,
      damage: dmg,
      defenderHpAfter: hit ? defenderHpAfter : defender.currentHp,
      eliminated: hit && defenderHpAfter <= 0,
      missed: !hit,
      powerUsed: usedPower.name,
      ...(isDodged && { isDodged: true, dodgeRoll: battle.turn.dodgeRoll }),
    };
    // Update the "after choose target" entry from selectTarget if present (same power+target, damage was 0)
    const prevLog = battle.log || [];
    const lastPrev = prevLog.length > 0 ? prevLog[prevLog.length - 1] : null;
    const canUpdate =
      lastPrev &&
      lastPrev.attackerId === attackerId &&
      lastPrev.defenderId === defenderId &&
      lastPrev.powerUsed === usedPower.name &&
      lastPrev.damage === 0;
    if (canUpdate) {
      updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...prevLog.slice(0, -1), { ...lastPrev, ...logEntry }]);
    } else {
      updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...prevLog, logEntry]);
    }

  } else if (action === TURN_ACTION.POWER && usedPower?.name === POWER_NAMES.KERAUNOS_VOLTAGE) {
    // Keraunos Voltage: normal 3 / 2 / 1 (main, 1st secondary, 2nd secondary); isCrit = ×2 → 6 / 4 / 2
    // Damage goes through resolveHitAtDefender so Hades child's skeleton can block (skeleton takes hit, master does not).
    // Targets whose hit was blocked by skeleton get no shock (see keraunosShockExcludeTargetIds below).
    const mainId = (turn as any).keraunosMainTargetId ?? defenderId;
    const secondaryIds: string[] = (turn as any).keraunosSecondaryTargetIds ?? [];
    const isCritK = !!(turn as any).isCrit;
    const mult = isCritK ? 2 : 1;
    const dmgMain = 3 * mult;
    const aoeDamageMapK: Record<string, number> = {};
    keraunosShockExcludeTargetIds = []; // reset and fill: master had skeleton block → no affliction
    if (mainId) {
      const mainFighter = findFighter(room, mainId);
      if (mainFighter && mainFighter.currentHp > 0) {
        const mainResolve = await resolveHitAtDefender(arenaId, room, mainId, dmgMain, updates, mainFighter);
        if (mainResolve.skippedMinionsPath) delete updates[mainResolve.skippedMinionsPath];
        if (mainResolve.hitTargetId !== mainId) keraunosShockExcludeTargetIds.push(mainId);
        aoeDamageMapK[mainId] = dmgMain;
        const mainPath = findFighterPath(room, mainId);
        if (mainPath && mainResolve.damageToMaster > 0) {
          const currentHp = (updates[`${mainPath}/currentHp`] as number | undefined) ?? mainFighter.currentHp;
          updates[`${mainPath}/currentHp`] = Math.max(0, currentHp - mainResolve.damageToMaster);
        }
      }
    }
    for (let idx = 0; idx < secondaryIds.length; idx++) {
      const sid = secondaryIds[idx];
      const baseSec = idx === 0 ? 2 : 1; // 1st secondary = 2, 2nd secondary = 1
      const dmgSec = baseSec * mult;
      const sec = findFighter(room, sid);
      if (sec && sec.currentHp > 0) {
        const secResolve = await resolveHitAtDefender(arenaId, room, sid, dmgSec, updates, sec);
        if (secResolve.skippedMinionsPath) delete updates[secResolve.skippedMinionsPath];
        if (secResolve.hitTargetId !== sid) keraunosShockExcludeTargetIds.push(sid);
        aoeDamageMapK[sid] = dmgSec;
        const secPath = findFighterPath(room, sid);
        if (secPath && secResolve.damageToMaster > 0) {
          const currentHp = (updates[`${secPath}/currentHp`] as number | undefined) ?? sec.currentHp;
          updates[`${secPath}/currentHp`] = Math.max(0, currentHp - secResolve.damageToMaster);
        }
      }
    }
    // Apply shock (already shocked → bonus damage = caster's damage, same as Lightning Reflex). Do this before writing log so log and aoeDamageMap include shock.
    const casterDamageK = Math.max(0, attacker.damage + getStatModifier(activeEffects, attackerId, MOD_STAT.DAMAGE));
    const baseDamageByTargetK: Record<string, number> = {};
    if (mainId) baseDamageByTargetK[mainId] = 3;
    secondaryIds.forEach((sid, idx) => { baseDamageByTargetK[sid] = idx === 0 ? 2 : 1; });
    const excludeSetK = new Set(keraunosShockExcludeTargetIds);
    const shockBonusByTarget: Record<string, number> = {};
    for (const id of [mainId, ...secondaryIds].filter(Boolean)) {
      if (excludeSetK.has(id)) continue;
      const hadShock = activeEffects.some(e => e.targetId === id && e.tag === EFFECT_TAGS.SHOCK);
      if (hadShock) shockBonusByTarget[id] = casterDamageK;
    }
    const getHpForShockK = (characterId: string) => {
      const path = findFighterPath(room, characterId);
      if (path && `${path}/currentHp` in updates) return updates[`${path}/currentHp`] as number;
      const f = (room.teamA?.members || []).concat(room.teamB?.members || []).find(m => m.characterId === characterId);
      return f?.currentHp ?? 0;
    };
    const isTeamAK = (room.teamA?.members || []).some(m => m.characterId === attackerId);
    const enemyTeamK = isTeamAK ? (room.teamB?.members || []) : (room.teamA?.members || []);
    const allBoltTargetIdsK = [mainId, ...secondaryIds].filter(Boolean);
    const currentHpByTargetK: Record<string, number> = {};
    for (const id of allBoltTargetIdsK) currentHpByTargetK[id] = getHpForShockK(id);
    for (const id of enemyTeamK.filter(e => getHpForShockK(e.characterId) > 0).map(e => e.characterId)) {
      if (currentHpByTargetK[id] === undefined) currentHpByTargetK[id] = getHpForShockK(id);
    }
    const allAliveEnemyIdsK = enemyTeamK.filter(e => getHpForShockK(e.characterId) > 0).map(e => e.characterId);
    for (const id of allAliveEnemyIdsK) {
      if (baseDamageByTargetK[id] === undefined) baseDamageByTargetK[id] = 0;
    }
    const battleForKeraunos = updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]
      ? { ...battle, activeEffects: updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] }
      : battle;
    const keraunosShockUpdates = applyKeraunosVoltageShock(
      room, attackerId, mainId, battleForKeraunos, casterDamageK, currentHpByTargetK, baseDamageByTargetK, keraunosShockExcludeTargetIds,
    );
    Object.assign(updates, keraunosShockUpdates);
    // Merge shock bonus into aoeDamageMap for log and display
    for (const id of Object.keys(aoeDamageMapK)) {
      aoeDamageMapK[id] = (aoeDamageMapK[id] ?? 0) + (shockBonusByTarget[id] ?? 0);
    }
    const mainPath = mainId ? findFighterPath(room, mainId) : null;
    const mainHpAfter = mainPath && `${mainPath}/currentHp` in updates ? (updates[`${mainPath}/currentHp`] as number) : (mainId ? findFighter(room, mainId)?.currentHp ?? 0 : 0);
    const mainTotalDmg = aoeDamageMapK[mainId] ?? dmgMain;
    const mainShockBonus = shockBonusByTarget[mainId] ?? 0;
    const logEntryK = {
      round: battle.roundNumber,
      attackerId,
      defenderId: mainId,
      attackRoll: 0,
      defendRoll: 0,
      damage: mainTotalDmg,
      defenderHpAfter: mainHpAfter,
      eliminated: mainHpAfter <= 0,
      missed: false,
      powerUsed: POWER_NAMES.KERAUNOS_VOLTAGE,
      aoeDamageMap: aoeDamageMapK,
      ...(mainShockBonus > 0 ? { shockDamage: mainShockBonus } : {}),
      ...(isCritK && (turn as any).critRoll != null && { isCrit: true, critRoll: (turn as any).critRoll }),
    };
    updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), logEntryK]);

  } else if (action !== TURN_ACTION.POWER || isSelfBuffPower) {
    const attackerHasBeyondTheNimbus = activeEffects.some(
      e => e.targetId === attackerId && e.tag === EFFECT_TAGS.BEYOND_THE_NIMBUS,
    );
    // Soul Devourer drain: no dice, no block, no crit; damage = caster main hit only; heal = ceil(main damage * 0.5) — skeleton damage does not heal
    soulDevourerDrain = !!battle.turn.soulDevourerDrain;
    if (soulDevourerDrain) {
      hit = true;
      isCrit = false;
      const dmgBuff = getStatModifier(activeEffects, attackerId, MOD_STAT.DAMAGE);
      dmg = Math.max(0, attacker.damage + dmgBuff);
      defenderHpAfter = Math.max(0, defender.currentHp - dmg);
      const defPath = findFighterPath(room, defenderId);
      if (defPath) updates[`${defPath}/currentHp`] = defenderHpAfter;
      const lifestealHeal = getEffectiveHealForReceiver(Math.ceil(dmg * 0.5), attacker, attackerId, activeEffects); // main drain only; skeleton hits do not add to heal
      const atkPath = findFighterPath(room, attackerId);
      if (atkPath) {
        const currentAttackerHp = (updates[`${atkPath}/currentHp`] as number | undefined) ?? attacker.currentHp;
        updates[`${atkPath}/currentHp`] = Math.min(attacker.maxHp, currentAttackerHp + lifestealHeal);
      }
      const effectsSd = [...((updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || activeEffects || [])];
      addSunbornSovereignRecoveryStack(room, effectsSd, attackerId);
      updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effectsSd;
      const attackerTeam = findFighterTeam(room, attackerId);
      if (attackerTeam) {
        const minions = room[attackerTeam]?.minions || [];
        skeletonsForAttack = minions.filter((m: any) => m.masterId === attackerId);
      }
      const soulDevourerHealSkipped = lifestealHeal === 0 && isHealingNullified(activeEffects, attackerId);
      mainAttackLogEntry = {
        round: battle.roundNumber,
        attackerId,
        defenderId,
        attackRoll: 0,
        defendRoll: 0,
        damage: dmg,
        defenderHpAfter,
        eliminated: defenderHpAfter <= 0,
        missed: false,
        soulDevourerDrain: true,
        soulDevourerHealAmount: lifestealHeal,
        ...(soulDevourerHealSkipped ? { soulDevourerHealSkipped: true, healSkipReason: EFFECT_TAGS.HEALING_NULLIFIED } : {}),
        powerUsed: battle.turn.usedPowerName,
      };
      const prevLogSd = battle.log || [];
      const lastSd = prevLogSd.length > 0 ? prevLogSd[prevLogSd.length - 1] : null;
      const canUpdateSd =
        lastSd &&
        lastSd.attackerId === attackerId &&
        lastSd.defenderId === defenderId &&
        lastSd.damage === 0 &&
        lastSd.powerUsed === battle.turn.usedPowerName;
      if (canUpdateSd) {
        updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...prevLogSd.slice(0, -1), { ...lastSd, ...mainAttackLogEntry }]);
      } else {
        updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...prevLogSd, mainAttackLogEntry]);
      }
      if (soulDevourerHealSkipped) {
        const turnUpdate: Record<string, unknown> = { ...battle.turn, soulDevourerHealSkipAwaitsAck: true };
        // Still transition to MINION so skeleton hits run and show; advance is blocked until Roger that
        if (skeletonsForAttack && skeletonsForAttack.length > 0 && defenderHpAfter > 0) {
          turnUpdate.resolvingHitIndex = 1;
          turnUpdate.playbackStep = buildMinionPlaybackStep(room, battle, attackerId, defenderId, 1);
        }
        updates[ARENA_PATH.BATTLE_TURN] = turnUpdate;
        await update(roomRef(arenaId), updates);
        return;
      }
    } else {
      // Normal attack: compare dice with active effect modifiers
      const atkBuff = getStatModifier(activeEffects, attackerId, MOD_STAT.ATTACK_DICE_UP);
      const defBuff = getStatModifier(activeEffects, defenderId, MOD_STAT.DEFEND_DICE_UP);
      const atkRecovery = getStatModifier(activeEffects, attackerId, MOD_STAT.RECOVERY_DICE_UP);
      const defRecovery = getStatModifier(activeEffects, defenderId, MOD_STAT.RECOVERY_DICE_UP);
      atkTotal = attackRoll + attacker.attackDiceUp + atkBuff + atkRecovery;
      defTotal = defendRoll + defender.defendDiceUp + defBuff + defRecovery;
      hit = atkTotal > defTotal;

      // Soul Devourer (Hades): attack is unavoidable
      const attackerHasSoulDevourer = activeEffects.some(
        e => e.targetId === attackerId && e.tag === EFFECT_TAGS.SOUL_DEVOURER,
      );
      if (attackerHasSoulDevourer) hit = true;

      // Pomegranate's Oath dodge: defender with spirit may dodge
      if (hit && battle.turn.isDodged) {
        isDodged = true;
        hit = false;
      }



      if (hit) {
        const dmgBuff = getStatModifier(activeEffects, attackerId, MOD_STAT.DAMAGE);
        baseDmg = Math.max(0, attacker.damage + dmgBuff);
        let rawDmg = baseDmg;

        // Critical hit: read from turn state (written by BattleHUD) or compute fallback
        if (atkTotal >= 10) {
          if (battle.turn.critRoll != null && battle.turn.critRoll > 0) {
            isCrit = !!battle.turn.isCrit;
            critRoll = battle.turn.critRoll;
          } else if (battle.turn.isCrit) {
            // 100% crit rate — auto crit with no roll
            isCrit = true;
            critRoll = 0;
          } else {
            // Fallback: compute crit if BattleHUD didn't write (e.g. stale client)
            const critBuff = getStatModifier(activeEffects, attackerId, 'criticalRate');
            const effectiveCrit = Math.max(attacker.criticalRate, attacker.criticalRate + critBuff);
            const crit = checkCritical(effectiveCrit);
            isCrit = crit.isCrit;
            critRoll = crit.critRoll;
          }
          if (isCrit) rawDmg *= 2;
        }

        // Rule: hit on skeleton → no shock (or other affliction) on master. Applied for normal attack (Lightning Reflex), Nimbus, and Keraunos.
        const defenderTeamForBlock = findFighterTeam(room, defenderId);
        const currentMinionsForBlock = defenderTeamForBlock
          ? ((updates[teamPath(defenderTeamForBlock, 'minions')] as any[]) ?? (room[defenderTeamForBlock]?.minions || []))
          : [];
        const defenderSkeletonsForBlock = currentMinionsForBlock.filter((m: any) => m.masterId === defenderId);
        const skeletonBlocksHit = defenderSkeletonsForBlock.length > 0;

        // Attack success → apply shock only when hit lands on master (not skeleton). Lightning Reflex + Nimbus below.
        if (!isSelfBuffPower || attackerHasBeyondTheNimbus) {
          if (attackerHasBeyondTheNimbus) {
            const battleWithNimbusEffects = {
              ...battle,
              activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? activeEffects,
            };
            const prevEffects = (battleWithNimbusEffects.activeEffects || []) as ActiveEffect[];
            const defenderHadShock = !skeletonBlocksHit && prevEffects.some(e => e.targetId === defenderId && e.tag === EFFECT_TAGS.SHOCK);
            const nimbusShockUpdates = applyBeyondTheNimbusTeamShock(
              room,
              attackerId,
              battleWithNimbusEffects,
              baseDmg,
              skeletonBlocksHit ? defenderId : undefined,
            );
            Object.assign(updates, nimbusShockUpdates);
            if (defenderHadShock) {
              rawDmg += baseDmg;
              shockBonusDamage = baseDmg;
            }
          } else {
            if (!skeletonBlocksHit) {
              const shockResult = applyLightningReflexPassive(room, attackerId, defenderId, battle, baseDmg);
              rawDmg += shockResult.bonusDamage;
              shockBonusDamage = shockResult.bonusDamage;
              Object.assign(updates, shockResult.updates);
            }
          }
        }

        // Collect skeletons belonging to the attacker — we will resolve them
        // separately (so their hits appear as distinct log entries).
        const attackerTeam = findFighterTeam(room, attackerId);
        if (attackerTeam) {
          const minions = room[attackerTeam]?.minions || [];
          skeletonsForAttack = minions.filter(m => m.masterId === attackerId);
        }

        // Resolve hit at defender: skeleton receives and dies, or damage goes to master (1 attack = 1 skeleton)
        mainResolve = await resolveHitAtDefender(arenaId, room, defenderId, rawDmg, updates, defender);
        rawDmg = mainResolve.damageToMaster;
        if (mainResolve.skippedMinionsPath) delete updates[mainResolve.skippedMinionsPath];

        // Shield absorption — persist reduced/depleted shields to Firebase
        let shieldRemaining = rawDmg;
        let shieldsModified = false;
        for (const se of activeEffects) {
          if (se.targetId !== defenderId || se.effectType !== 'shield') continue;
          if (shieldRemaining <= 0) break;
          const absorbed = Math.min(se.value, shieldRemaining);
          se.value -= absorbed;
          shieldRemaining -= absorbed;
          shieldsModified = true;
        }
        if (shieldsModified) {
          // Remove depleted shields, persist remaining values (keep tagged shields like Efflorescence Muse)
          const cleaned = activeEffects.filter(e => !(e.effectType === EFFECT_TYPES.SHIELD && e.value <= 0 && !e.tag));
          updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = cleaned;
        }
        dmg = shieldRemaining;

        // Reflect
        const reflectPct = getReflectPercent(activeEffects, defenderId);
        if (reflectPct > 0 && dmg > 0) {
          const reflectDmg = Math.floor(dmg * reflectPct / 100);
          const atkPath = findFighterPath(room, attackerId);
          if (atkPath) {
            updates[`${atkPath}/currentHp`] = Math.max(0, attacker.currentHp - reflectDmg);
          }
        }

        defenderHpAfter = Math.max(0, defender.currentHp - dmg);
        const defPath = findFighterPath(room, defenderId);
        if (defPath) updates[`${defPath}/currentHp`] = defenderHpAfter;

        // Soul Devourer: heal attacker by 50% of damage dealt
        if (attackerHasSoulDevourer && dmg > 0) {
          const lifestealHeal = getEffectiveHealForReceiver(Math.floor(dmg * 0.5), attacker, attackerId, activeEffects);
          const atkPath = findFighterPath(room, attackerId);
          if (atkPath) {
            const currentAttackerHp = (updates[`${atkPath}/currentHp`] as number | undefined) ?? attacker.currentHp;
            updates[`${atkPath}/currentHp`] = Math.min(attacker.maxHp, currentAttackerHp + lifestealHeal);
          }
          const effectsSd2 = [...((updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || activeEffects || [])];
          addSunbornSovereignRecoveryStack(room, effectsSd2, attackerId);
          updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effectsSd2;
        }
      }

      // Log entry for normal attack (or self-buff power + attack)
      const logEntry: Record<string, unknown> = {
        round: battle.roundNumber,
        attackerId,
        defenderId,
        attackRoll: safeAttackRoll,
        defendRoll: safeDefendRoll,
        damage: dmg,
        defenderHpAfter: hit ? defenderHpAfter : defender.currentHp,
        eliminated: hit && defenderHpAfter <= 0,
        missed: !hit,
      };
      if (hit) {
        logEntry.baseDmg = baseDmg;
      }
      if (critRoll > 0) {
        logEntry.isCrit = isCrit;
        logEntry.critRoll = critRoll;
      }
      if (shockBonusDamage > 0) {
        logEntry.shockDamage = shockBonusDamage;
      }
      if (isDodged) {
        logEntry.isDodged = true;
        logEntry.dodgeRoll = battle.turn.dodgeRoll;
      }
      // Do not set powerUsed for self-buff + attack so log shows "Caster vs Defender — hit for X dmg" not "Caster Beyond the Nimbus X dmg"
      if (isSelfBuffPower && battle.turn.usedPowerName && battle.turn.usedPowerName !== POWER_NAMES.BEYOND_THE_NIMBUS) {
        logEntry.powerUsed = battle.turn.usedPowerName;
      }
      // When skeleton blocked: so client sets lastHitTargetId = blocker and does not show hit VFX on master
      if (hit && dmg === 0 && mainResolve?.hitTargetId && mainResolve.hitTargetId !== defenderId) {
        logEntry.hitTargetId = mainResolve.hitTargetId;
      }

      // Capture and write the main attack log entry; update the "after choose target" entry from selectTarget if present
      mainAttackLogEntry = logEntry;
      const prevLogNorm = battle.log || [];
      const lastPrevNorm = prevLogNorm.length > 0 ? prevLogNorm[prevLogNorm.length - 1] : null;
      const canUpdateNorm =
        lastPrevNorm &&
        lastPrevNorm.attackerId === attackerId &&
        lastPrevNorm.defenderId === defenderId &&
        lastPrevNorm.damage === 0 &&
        (lastPrevNorm.powerUsed === battle.turn.usedPowerName || (isSelfBuffPower && lastPrevNorm.powerUsed));

      // Beyond the Nimbus: "Caster Beyond the Nimbus" already logged at confirm (selectTarget); only append attack result with dice
      if (attackerHasBeyondTheNimbus) {
        updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...prevLogNorm, logEntry]);
      } else if (canUpdateNorm) {
        const merged: Record<string, unknown> = { ...lastPrevNorm, ...logEntry };
        if (logEntry.hitTargetId != null) merged.hitTargetId = logEntry.hitTargetId;
        updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...prevLogNorm.slice(0, -1), merged]);
      } else {
        updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...prevLogNorm, logEntry]);
      }
    }
  }

  // Rapid Fire (Volley Arrow)
  const attackerHasRapidFire =
    !soulDevourerDrain &&
    hit &&
    (action !== TURN_ACTION.POWER || isSelfBuffPower) &&
    (activeEffects as ActiveEffect[]).some(
      (e: ActiveEffect) => e.targetId === attackerId && e.tag === EFFECT_TAGS.RAPID_FIRE,
    );
  if (attackerHasRapidFire && defenderId && baseDmg > 0) {
    // ให้ caster ทอย D4 เองทุกช็อตเสริม — เปลี่ยนเป็น phase ROLLING_RAPID_FIRE_D4 รอ client ส่ง roll
    const rapidFireWinFacesFirst = [2, 3, 4]; // 75%
    updates[ARENA_PATH.BATTLE_TURN] = {
      ...turn,
      phase: PHASE.ROLLING_RAPID_FIRE_EXTRA_SHOT,
      rapidFireStep: 0,
      rapidFireWinFaces: rapidFireWinFacesFirst,
      rapidFireBaseDmg: baseDmg,
      rapidFireIsCrit: !!isCrit,
      rapidFireDefTotal: defTotal,
    };
    await update(roomRef(arenaId), updates);
    return;
  }

  // skipDice powers: effect + log already written in selectAction()
  // Keraunos Voltage: shock is applied inside the Keraunos block above (before writing log) so log and aoeDamageMap include shock damage.

  // Pomegranate's Oath co-attack: resolve at defender (skeleton blocks or master takes damage)
  if (!isDodged && hit && turn.coAttackRoll != null && turn.coAttackRoll > 0) {
    const spiritEffect = activeEffects.find(
      e => e.targetId === attackerId && e.tag === EFFECT_TAGS.POMEGRANATE_SPIRIT,
    );
    if (spiritEffect && spiritEffect.sourceId !== attackerId) {
      const casterId = turn.coAttackerId || spiritEffect.sourceId;
      const caster = findFighter(room, casterId);
      if (caster && caster.currentHp > 0) {
        const coBuff = getStatModifier(activeEffects, casterId, MOD_STAT.ATTACK_DICE_UP);
        const coRecovery = getStatModifier(activeEffects, casterId, MOD_STAT.RECOVERY_DICE_UP);
        const coTotal = turn.coAttackRoll + caster.attackDiceUp + coBuff + coRecovery;
        const coHit = coTotal > defTotal;
        if (coHit) {
          const coDmgBuff = getStatModifier(activeEffects, casterId, MOD_STAT.DAMAGE);
          const coDmg = Math.max(0, caster.damage + coDmgBuff);
          const coResolve = await resolveHitAtDefender(arenaId, room, defenderId, coDmg, updates, defender);
          const coDmgToMaster = coResolve.damageToMaster;
          if (coResolve.skippedMinionsPath) delete updates[coResolve.skippedMinionsPath];
          const defPath = findFighterPath(room, defenderId);
          if (defPath && coDmgToMaster > 0) {
            const currentDefHp = (updates[`${defPath}/currentHp`] as number | undefined) ?? defender.currentHp;
            updates[`${defPath}/currentHp`] = Math.max(0, currentDefHp - coDmgToMaster);
          }
          const logArr = (updates[ARENA_PATH.BATTLE_LOG] as typeof battle.log) || [...(battle.log || [])];
          if (logArr.length > 0) {
            logArr[logArr.length - 1].coAttackDamage = coDmgToMaster;
            logArr[logArr.length - 1].coAttackerId = casterId;
            if (coDmgToMaster === 0 && coResolve.hitTargetId && coResolve.hitTargetId !== defenderId) {
              (logArr[logArr.length - 1] as unknown as Record<string, unknown>).hitTargetId = coResolve.hitTargetId;
            }
            updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog(logArr);
          }
        }
      }
    }
  }

  // Sync accumulated activeEffects changes so tickEffects sees them
  // Per-hit resolve: after master (+ co-attack), write once so client sees HP; then client calls resolve again for each skeleton.
  if (!isDodged && hit && skeletonsForAttack && skeletonsForAttack.length > 0) {
    const defPath = findFighterPath(room, defenderId);
    const defenderHpAfterMain = defPath ? (updates[`${defPath}/currentHp`] as number | undefined) ?? defender.currentHp : defender.currentHp;
    if (defenderHpAfterMain > 0) {
      updates[ARENA_PATH.BATTLE_TURN] = {
        ...turn,
        resolvingHitIndex: 1,
        playbackStep: buildMinionPlaybackStep(room, battle, attackerId, defenderId, 1),
      };
      await update(roomRef(arenaId), updates);
      return;
    }
  }
  // (applyPowerEffect, applyLightningReflexPassive, applyKeraunosVoltageChain, applySecretOfDryadPassive
  //  all write to updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] but tickEffects reads from battle)
  if (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) {
    battle = { ...battle, activeEffects: updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] };
  }

  // Tick active effects (DOT damage, decrement durations)
  // Pass current updates so DOT processing reads latest HP; DOT damage via resolveHitAtDefender
  const effectUpdates = await tickEffectsWithSkeletonBlock(arenaId, room, battle, updates);
  Object.assign(updates, effectUpdates);

  // Build updated HP map for win condition check
  const getHp = (m: FighterState) => {
    const path = findFighterPath(room, m.characterId);
    if (path && `${path}/currentHp` in updates) return updates[`${path}/currentHp`] as number;
    return m.currentHp;
  };
  let teamAMembers = (room.teamA?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
  let teamBMembers = (room.teamB?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));

  // Rebuild turn queue with effective speeds (base + active buff/debuff modifiers)
  let latestEffects = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || battle.activeEffects || [];

  // ── Spring (Ephemeral Season): ตีก่อนค่อยฮีล — after each attack, heal that attacker with heal1 (or heal2 for caster); caster gets heal1 then we roll heal2 ──
  const springCasterId = (battle as { springCasterId?: string }).springCasterId;
  const springHeal1 = (battle as { springHeal1?: number }).springHeal1;
  const springHeal1Received = (battle as { springHeal1Received?: string[] }).springHeal1Received ?? [];
  const springHeal2 = (battle as { springHeal2?: number | null }).springHeal2;

  const isCasterTeam = springCasterId && ((room.teamA?.members || []).some((m: FighterState) => m.characterId === springCasterId) ? (room.teamA?.members || []).some((m: FighterState) => m.characterId === attackerId) : (room.teamB?.members || []).some((m: FighterState) => m.characterId === attackerId));
  if (springCasterId && isCasterTeam) {
    // Caster already has heal2: apply it after this attack, then clear Spring.
    if (springHeal2 != null && attackerId === springCasterId) {
      const rawEff = room.battle?.activeEffects ?? battle.activeEffects;
      const effectsForHeal: ActiveEffect[] = Array.isArray(rawEff) ? rawEff : (rawEff && typeof rawEff === 'object' ? Object.values(rawEff) : []) as ActiveEffect[];
      let springHeal2Skipped = isHealingNullified(effectsForHeal, attackerId);
      const path = findFighterPath(room, attackerId);
      if (path) {
        const fighter = (room.teamA?.members || []).concat(room.teamB?.members || []).find(m => m.characterId === attackerId);
        const effectiveHeal = getEffectiveHealForReceiver(springHeal2, fighter ?? null, attackerId, effectsForHeal);
        springHeal2Skipped = springHeal2Skipped || effectiveHeal === 0;
        const healAmount = springHeal2Skipped ? 0 : effectiveHeal;
        const hpKey = `${path}/currentHp`;
        const currentHp = (hpKey in updates ? updates[hpKey] : fighter?.currentHp) as number ?? 0;
        const newHp = Math.min(fighter?.maxHp ?? 999, currentHp + healAmount);
        updates[hpKey] = newHp;
        const logArr = [...(battle.log || [])];
        logArr.push({
          round: battle.roundNumber,
          attackerId,
          defenderId: attackerId,
          attackRoll: 0,
          defendRoll: 0,
          damage: 0,
          heal: healAmount,
          defenderHpAfter: newHp,
          eliminated: false,
          missed: false,
          powerUsed: 'Ephemeral Season: Spring',
          springHeal: springHeal2,
          springHealCrit: springHeal2 === 2,
          ...(springHeal2Skipped ? { healSkipReason: EFFECT_TAGS.HEALING_NULLIFIED } : {}),
        });
        updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog(logArr);
      }
      if (springHeal2Skipped) {
        // R{n+2} heal2 skipped: show skipped-heal modal; on ack we clear Spring and advance (no D4).
        updates[ARENA_PATH.BATTLE_SPRING_HEAL_ROLL_ACTIVE] = false;
        updates[ARENA_PATH.BATTLE_TURN] = {
          attackerId,
          attackerTeam: turn.attackerTeam,
          phase: PHASE.ROLLING_SPRING_HEAL,
          springHealSkipAwaitsAck: true,
          healSkipReason: EFFECT_TAGS.HEALING_NULLIFIED,
          playbackStep: null,
          resolvingHitIndex: null,
        };
        await update(roomRef(arenaId), updates);
        return;
      }
      updates[ARENA_PATH.BATTLE_SPRING_CASTER_ID] = null;
      updates[ARENA_PATH.BATTLE_SPRING_HEAL1] = null;
      updates[ARENA_PATH.BATTLE_SPRING_HEAL1_RECEIVED] = null;
      updates[ARENA_PATH.BATTLE_SPRING_HEAL2] = null;
      const currentEffects = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || battle.activeEffects || [];
      const withoutSpring = currentEffects.filter(e => e.tag !== EFFECT_TAGS.SEASON_SPRING);
      addSunbornSovereignRecoveryStack(room, withoutSpring, springCasterId!);
      addSunbornSovereignRecoveryStack(room, withoutSpring, attackerId);
      updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = withoutSpring;
      latestEffects = withoutSpring;
    } else if (springHeal1 != null && !springHeal1Received.includes(attackerId)) {
      // This attacker hasn't received heal1 yet: heal them (ตีก่อนค่อยฮีล = attack already done).
      const rawEff1 = room.battle?.activeEffects ?? battle.activeEffects;
      const effectsForHeal: ActiveEffect[] = Array.isArray(rawEff1) ? rawEff1 : (rawEff1 && typeof rawEff1 === 'object' ? Object.values(rawEff1) : []) as ActiveEffect[];
      let springHeal1Skipped = isHealingNullified(effectsForHeal, attackerId);
      const path = findFighterPath(room, attackerId);
      if (path) {
        const hpKey = `${path}/currentHp`;
        const fighter = (room.teamA?.members || []).concat(room.teamB?.members || []).find(m => m.characterId === attackerId);
        const effectiveHeal = getEffectiveHealForReceiver(springHeal1, fighter ?? null, attackerId, effectsForHeal);
        springHeal1Skipped = springHeal1Skipped || effectiveHeal === 0;
        const healAmount = springHeal1Skipped ? 0 : effectiveHeal;
        const currentHp = (hpKey in updates ? updates[hpKey] : fighter?.currentHp) as number ?? 0;
        const newHp = Math.min(fighter?.maxHp ?? 999, currentHp + healAmount);
        updates[hpKey] = newHp;
        const logArr = [...(battle.log || [])];
        logArr.push({
          round: battle.roundNumber,
          attackerId: springCasterId,
          defenderId: attackerId,
          attackRoll: 0,
          defendRoll: 0,
          damage: 0,
          heal: healAmount,
          defenderHpAfter: newHp,
          eliminated: false,
          missed: false,
          powerUsed: 'Ephemeral Season: Spring',
          springHeal: springHeal1,
          springHealCrit: springHeal1 === 2,
          ...(springHeal1Skipped ? { healSkipReason: EFFECT_TAGS.HEALING_NULLIFIED } : {}),
        });
        updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog(logArr);
      }
      const nextReceived = [...springHeal1Received, attackerId];
      updates[ARENA_PATH.BATTLE_SPRING_HEAL1_RECEIVED] = nextReceived;
      const currentEffects1 = [...((updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || battle.activeEffects || [])];
      if (!springHeal1Skipped) {
        addSunbornSovereignRecoveryStack(room, currentEffects1, springCasterId!);
        addSunbornSovereignRecoveryStack(room, currentEffects1, attackerId);
      }
      updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = currentEffects1;

      if (attackerId === springCasterId) {
        if (springHeal1Skipped) {
          // Heal skipped (e.g. Healing Nullified): show modal, then on ack advance to D4 roll for heal2.
          updates[ARENA_PATH.BATTLE_SPRING_HEAL_ROLL_ACTIVE] = false;
          updates[ARENA_PATH.BATTLE_TURN] = {
            attackerId,
            attackerTeam: turn.attackerTeam,
            phase: PHASE.ROLLING_SPRING_HEAL,
            springHealSkipAwaitsAck: true,
            healSkipReason: EFFECT_TAGS.HEALING_NULLIFIED,
            playbackStep: null,
            resolvingHitIndex: null,
          };
          await update(roomRef(arenaId), updates);
          return;
        }
        // Caster got heal1; now roll for heal2.
        const caster = findFighter(room, attackerId);
        const baseCritRate = caster ? (typeof caster.criticalRate === 'number' ? caster.criticalRate : 25) : 25;
        const healCritRate = Math.min(100, Math.max(0, baseCritRate + getStatModifier(latestEffects, attackerId, MOD_STAT.CRITICAL_RATE)));
        const winFaces = getWinningFaces(healCritRate);
        updates[ARENA_PATH.BATTLE_SPRING_HEAL_ROLL_ACTIVE] = true;
        updates[ARENA_PATH.BATTLE_TURN] = {
          attackerId,
          attackerTeam: turn.attackerTeam,
          phase: PHASE.ROLLING_SPRING_HEAL,
          springHealWinFaces: winFaces,
          springRound: 2,
          playbackStep: null,
          resolvingHitIndex: null,
        };
        await update(roomRef(arenaId), updates);
        return;
      }
      latestEffects = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || latestEffects;
    }
  }

  // Recompute HP for win check when we applied Spring heal
  if (springCasterId && (updates[ARENA_PATH.BATTLE_LOG] || updates[ARENA_PATH.BATTLE_SPRING_HEAL1_RECEIVED])) {
    teamAMembers = (room.teamA?.members || []).map((m: FighterState) => {
      const p = findFighterPath(room, m.characterId);
      const hp = p && `${p}/currentHp` in updates ? updates[`${p}/currentHp`] as number : m.currentHp;
      return { ...m, currentHp: hp };
    });
    teamBMembers = (room.teamB?.members || []).map((m: FighterState) => {
      const p = findFighterPath(room, m.characterId);
      const hp = p && `${p}/currentHp` in updates ? updates[`${p}/currentHp`] as number : m.currentHp;
      return { ...m, currentHp: hp };
    });
  }

  // Delay setting winner so all hit effects can play before end arena
  const END_ARENA_HIT_EFFECTS_DELAY_MS = 3500;

  if (isTeamEliminated(teamBMembers, latestEffects)) {
    updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: turn.attackerTeam, defenderId, phase: PHASE.DONE, attackRoll, defendRoll, action, playbackStep: null, resolvingHitIndex: null };
    updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
    await update(roomRef(arenaId), updates);
    setTimeout(() => {
      update(roomRef(arenaId), {
        [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.A,
        [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
        [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
        [ARENA_PATH.BATTLE_LAST_HIT_MINION_ID]: null,
        [ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID]: null,
        [ARENA_PATH.BATTLE_LAST_SKELETON_HITS]: null,
      }).catch(() => { });
    }, END_ARENA_HIT_EFFECTS_DELAY_MS);
    return;
  }

  if (isTeamEliminated(teamAMembers, latestEffects)) {
    updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: turn.attackerTeam, defenderId, phase: PHASE.DONE, attackRoll, defendRoll, action, playbackStep: null, resolvingHitIndex: null };
    updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
    await update(roomRef(arenaId), updates);
    setTimeout(() => {
      update(roomRef(arenaId), {
        [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.B,
        [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED,
        [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null,
        [ARENA_PATH.BATTLE_LAST_HIT_MINION_ID]: null,
        [ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID]: null,
        [ARENA_PATH.BATTLE_LAST_SKELETON_HITS]: null,
      }).catch(() => { });
    }, END_ARENA_HIT_EFFECTS_DELAY_MS);
    return;
  }
  const updatedRoom = {
    ...room,
    teamA: { ...room.teamA, members: teamAMembers },
    teamB: { ...room.teamB, members: teamBMembers },
  };
  const updatedQueue = buildTurnQueue(updatedRoom as BattleRoom, latestEffects);
  updates[ARENA_PATH.BATTLE_TURN_QUEUE] = updatedQueue;

  // Find where the current attacker is in the new queue to advance from there
  const currentAttackerIdx = updatedQueue.findIndex(e => e.characterId === attackerId);
  const fromIdx = currentAttackerIdx !== -1 ? currentAttackerIdx : battle.currentTurnIndex;

  const { index: nextIdx, wrapped } = nextAliveIndex(updatedQueue, fromIdx, updatedRoom, latestEffects);
  const nextEntry = updatedQueue[nextIdx];

  // Death Keeper: self-resurrect if next fighter is dead with death-keeper
  const selfRes3 = applySelfResurrect(nextEntry.characterId, updatedRoom as BattleRoom, latestEffects, updates, battle);

  // Skip stunned fighters — build next turn (SELECT_ACTION only, so caster always attacks before heal-crit roll)
  const nextFighter = findFighter(updatedRoom, nextEntry.characterId);
  let nextTurnOnly: Record<string, unknown>;
  if (nextFighter && !selfRes3 && isStunned(updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as typeof activeEffects || activeEffects, nextEntry.characterId)) {
    const afterStunRoom = { ...updatedRoom };
    const { index: skipIdx, wrapped: skipWrapped } = nextAliveIndex(updatedQueue, nextIdx, afterStunRoom, latestEffects);
    const skipEntry = updatedQueue[skipIdx];
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
    if (skipWrapped) updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = (updates[ARENA_PATH.BATTLE_ROUND_NUMBER] as number || battle.roundNumber) + 1;
    nextTurnOnly = { attackerId: skipEntry.characterId, attackerTeam: skipEntry.team, phase: PHASE.SELECT_ACTION };
    const battleForDryadSkip = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? latestEffects };
    const dryadSkip = applySecretOfDryadPassive(room, skipEntry.characterId, battleForDryadSkip, 0);
    if (dryadSkip[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, dryadSkip);
    const battleForEfflorescenceMuseSkip = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? latestEffects };
    const efflorescenceMuseSkipUpdates = onEfflorescenceMuseTurnStart(room, battleForEfflorescenceMuseSkip, skipEntry.characterId);
    if (efflorescenceMuseSkipUpdates) Object.assign(updates, efflorescenceMuseSkipUpdates);
  } else {
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
    nextTurnOnly = { attackerId: nextEntry.characterId, attackerTeam: nextEntry.team, phase: PHASE.SELECT_ACTION };
    if (selfRes3) nextTurnOnly.resurrectTargetId = nextEntry.characterId;
    const battleForDryad = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? latestEffects };
    const dryadNext = applySecretOfDryadPassive(room, nextEntry.characterId, battleForDryad, 0);
    if (dryadNext[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, dryadNext);
    const battleForEfflorescenceMuse = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? latestEffects };
    const efflorescenceMuseUpdates = onEfflorescenceMuseTurnStart(room, battleForEfflorescenceMuse, nextEntry.characterId);
    if (efflorescenceMuseUpdates) Object.assign(updates, efflorescenceMuseUpdates);
  }

  // Clear transient minion-hit markers so next turn doesn't show stale hit state.
  updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
  updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;

  const skeletonHitsArr = updates[ARENA_PATH.BATTLE_LAST_SKELETON_HITS] as unknown[] | undefined;
  const hasSkeletonHits = Array.isArray(skeletonHitsArr) && skeletonHitsArr.length > 0;
  const skeletonCount = hasSkeletonHits ? skeletonHitsArr.length : 0;
  const SKELETON_MS_PER_HIT = 150;
  const SOUL_DEVOURER_CHAIN_START_MS = 800;
  const isSoulDevourerDrain = !!(battle.turn as { soulDevourerDrain?: boolean })?.soulDevourerDrain;
  const SKELETON_PLAYBACK_DELAY_MS = (isSoulDevourerDrain ? SOUL_DEVOURER_CHAIN_START_MS : 0) + skeletonCount * SKELETON_MS_PER_HIT;
  const turnRef = ref(db, `arenas/${arenaId}/battle/turn`);

  if (hasSkeletonHits && SKELETON_PLAYBACK_DELAY_MS > 0) {
    const advancePayload = {
      [ARENA_PATH.BATTLE_CURRENT_TURN_INDEX]: updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX],
      [ARENA_PATH.BATTLE_ROUND_NUMBER]: updates[ARENA_PATH.BATTLE_ROUND_NUMBER],
      [ARENA_PATH.BATTLE_LAST_SKELETON_HITS]: null,
    };
    delete updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX];
    delete updates[ARENA_PATH.BATTLE_ROUND_NUMBER];
    await update(roomRef(arenaId), updates);
    setTimeout(() => {
      set(turnRef, nextTurnOnly).catch(() => { });
      update(roomRef(arenaId), advancePayload).catch(() => { });
    }, SKELETON_PLAYBACK_DELAY_MS);
  } else {
    await set(turnRef, nextTurnOnly);
    await update(roomRef(arenaId), updates);
  }
}
