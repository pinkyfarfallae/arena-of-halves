import { ref, set, get, onValue, update, remove, off } from 'firebase/database';
import { db } from '../firebase';
import type {
  BattleRoom, BattleState, FighterState, Team,
  TurnQueueEntry, Viewer, BattlePlaybackStep,
} from '../types/battle';
import { BATTLE_PLAYBACK_KIND } from '../types/battle';
import type { Character } from '../types/character';
import type { PowerDefinition, ActiveEffect } from '../types/power';
import { getQuotaCost } from '../types/power';
import {
  getStatModifier, getReflectPercent,
  isStunned, applyPowerEffect, tickEffects, buildPassiveEffects,
  makeEffectId,
  applyLightningReflexPassive, applyJoltArc, applyKeraunosVoltageChain, applyKeraunosVoltageShock,
  applySecretOfDryadPassive, applyFloralFragranced, applySeasonEffects,
  applyPomegranateOath, applyBeyondTheNimbusTeamShock,
} from './powerEngine';
import { getPowers } from '../data/powers';
import { EFFECT_TAGS } from '../constants/effectTags';
import { POWER_NAMES } from '../constants/powers';
import { ARENA_PATH, BATTLE_TEAM, PHASE, ROOM_STATUS, TURN_ACTION, TurnAction, teamPath, type BattleTeamKey } from '../constants/battle';
import { EFFECT_TYPES, TARGET_TYPES, MOD_STAT } from '../constants/effectTypes';
import { SKILL_UNLOCK } from '../constants/character';

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

/** Ensure no log entry has powerUsed === undefined (Firebase rejects undefined). */
function sanitizeBattleLog(log: unknown[]): unknown[] {
  return log.map((e: any) => ({ ...e, powerUsed: e.powerUsed ?? '' }));
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
    const lastLog = (battle.log || []).at(-1);
    const logDmg = (lastLog?.attackerId === turn.attackerId) ? (lastLog.damage ?? 0) : 0;
    return {
      kind: BATTLE_PLAYBACK_KIND.MASTER,
      hitIndex: 0,
      attackerId: attacker.characterId,
      defenderId: defender.characterId,
      isHit: true,
      isPower: true,
      powerName: turn.usedPowerName ?? TURN_ACTION.POWER,
      isCrit: false,
      baseDmg: 0,
      damage: logDmg,
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
  const at = (turn.attackRoll ?? 0) + attacker.attackDiceUp + atkBuff;
  const dt = (turn.defendRoll ?? 0) + defender.defendDiceUp + defBuff;
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

  await update(roomRef(arenaId), {
    status: ROOM_STATUS.BATTLING,
    battle,
  });
}

/* ── select target ───────────────────────────────────── */

export async function selectTarget(arenaId: string, defenderId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle?.turn) return;

  const turn = battle.turn;
  const { attackerId } = turn;
  const activeEffects = battle.activeEffects || [];

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
      } catch (_) {}
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
      // ── Jolt Arc: detonate all shocks on all enemies ──
      if (power.name === POWER_NAMES.JOLT_ARC) {
        const { updates: joltUpdates, aoeDamageMap } = applyJoltArc(room, attackerId, battle);
        Object.assign(updates, joltUpdates);

        const totalDmg = Object.values(aoeDamageMap).reduce((s, d) => s + d, 0);
        const logEntry = {
          round: battle.roundNumber,
          attackerId,
          defenderId,
          attackRoll: 0,
          defendRoll: 0,
          damage: totalDmg,
          defenderHpAfter: (() => {
            const defender = findFighter(room, defenderId);
            if (!defender) return 0;
            const defDmg = aoeDamageMap[defenderId] || 0;
            return Math.max(0, defender.currentHp - defDmg);
          })(),
          eliminated: (() => {
            const defender = findFighter(room, defenderId);
            if (!defender) return false;
            const defDmg = aoeDamageMap[defenderId] || 0;
            return defender.currentHp - defDmg <= 0;
          })(),
          missed: totalDmg === 0,
          powerUsed: power.name,
          ...(Object.keys(aoeDamageMap).length > 0 ? { aoeDamageMap } : {}),
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

      // ── Keraunos Voltage: multi-step targets (1×3 dmg, up to 2×2 dmg) then D4 crit (rate = crit + 25%) ──
      } else if (power.name === POWER_NAMES.KERAUNOS_VOLTAGE) {
        const isTeamA = (room.teamA?.members || []).some(m => m.characterId === attackerId);
        const enemies = (isTeamA ? (room.teamB?.members || []) : (room.teamA?.members || [])).filter(e => e.currentHp > 0);
        const n = enemies.length;
        const step = turn.keraunosTargetStep ?? 0;
        const mainId = turn.keraunosMainTargetId ?? turn.defenderId;
        const secondaries = turn.keraunosSecondaryTargetIds ?? [];

        if (step === 0) {
          // First click: main target (3 dmg). If only 1 enemy, done; if 2+ need secondaries.
          const nextSecondaries: string[] = [];
          const needMore = n >= 2;
          const critRate = Math.min(100, Math.max(0, (attacker.criticalRate ?? 0) + 25));
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
          const critRate = Math.min(100, Math.max(0, (attacker.criticalRate ?? 0) + 25));
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
          const critRate = Math.min(100, Math.max(0, (attacker.criticalRate ?? 0) + 25));
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
        const effectUpdates = applyPowerEffect(room, attackerId, defenderId, power, battle);
        Object.assign(updates, effectUpdates);

        const logEntry = {
          round: battle.roundNumber,
          attackerId,
          defenderId,
          attackRoll: 0,
          defendRoll: 0,
          damage: power.effect === EFFECT_TYPES.DAMAGE || power.effect === EFFECT_TYPES.LIFESTEAL ? power.value : 0,
          defenderHpAfter: (() => {
            const defender = findFighter(room, defenderId);
            if (!defender) return 0;
            if (power.effect === EFFECT_TYPES.DAMAGE || power.effect === EFFECT_TYPES.LIFESTEAL) {
              return Math.max(0, defender.currentHp - power.value);
            }
            return defender.currentHp;
          })(),
          eliminated: (() => {
            const defender = findFighter(room, defenderId);
            if (!defender) return false;
            if (power.effect === EFFECT_TYPES.DAMAGE || power.effect === EFFECT_TYPES.LIFESTEAL) {
              return defender.currentHp - power.value <= 0;
            }
            return false;
          })(),
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
    await update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), {
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

    // ── Pomegranate's Oath: apply buff + end turn immediately (like confirmSeason) ──
    if (power.name === POWER_NAMES.POMEGRANATES_OATH) {
      const oathUpdates = applyPomegranateOath(room, attackerId, allyTargetId, battle);
      Object.assign(updates, oathUpdates);

      // Sync activeEffects into battle for tickEffects
      const battleForTick = updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]
        ? { ...battle, activeEffects: updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] }
        : battle;

      // Tick active effects (DOT, spring heal, decrement durations)
      const effectUpdates = tickEffects(room, battleForTick, updates);
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
          }).catch(() => {});
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
          }).catch(() => {});
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

    // ── Floral Fragrance (and other ally powers): apply buff, then follow-up normal attack ──
    const floralUpdates = applyFloralFragranced(room, attackerId, allyTargetId, battle, power);
    Object.assign(updates, floralUpdates);

    const ally = findFighter(room, allyTargetId);
    const logEntry = {
      round: battle.roundNumber,
      attackerId,
      defenderId: allyTargetId,
      attackRoll: 0,
      defendRoll: 0,
      damage: 0,
      defenderHpAfter: ally ? Math.min(ally.currentHp + power.value, ally.maxHp) : 0,
      eliminated: false,
      missed: false,
      powerUsed: power.name,
    };
    updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), logEntry]);
    

    updates[ARENA_PATH.BATTLE_TURN] = {
      attackerId,
      attackerTeam: battle.turn.attackerTeam,
      phase: PHASE.SELECT_TARGET,
      action: TURN_ACTION.ATTACK,       // follow-up as normal attack
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

    // Tick active effects (DOT, spring heal, decrement durations)
    const effectUpdates2 = tickEffects(room, battleForTick, updates);
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
        }).catch(() => {});
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
        }).catch(() => {});
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
    Object.assign(updates, joltUpdates);

    const totalDmg = Object.values(aoeDamageMap).reduce((s, d) => s + d, 0);
    const isTeamA = (room.teamA?.members || []).some(m => m.characterId === attackerId);
    const enemies = isTeamA ? (room.teamB?.members || []) : (room.teamA?.members || []);
    const firstEnemy = enemies.find(e => e.currentHp > 0);

    const logEntry = {
      round: battle.roundNumber,
      attackerId,
      defenderId: firstEnemy?.characterId ?? '',
      attackRoll: 0,
      defendRoll: 0,
      damage: totalDmg,
      defenderHpAfter: firstEnemy
        ? Math.max(0, firstEnemy.currentHp - (aoeDamageMap[firstEnemy.characterId] || 0))
        : 0,
      eliminated: firstEnemy
        ? (firstEnemy.currentHp - (aoeDamageMap[firstEnemy.characterId] || 0) <= 0)
        : false,
      missed: totalDmg === 0,
      powerUsed: power.name,
      ...(Object.keys(aoeDamageMap).length > 0 ? { aoeDamageMap } : {}),
    };
    updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), logEntry]);

    updates[ARENA_PATH.BATTLE_TURN] = {
      attackerId,
      attackerTeam: battle.turn.attackerTeam,
      defenderId: firstEnemy?.characterId,
      phase: PHASE.RESOLVING,
      action: TURN_ACTION.POWER,
      usedPowerIndex: powerIndex,
      usedPowerName: power.name,
    };
    updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
    updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
    await update(roomRef(arenaId), updates);
    return;
  }

  // ── Enemy-targeting power (skipDice or dice): store choice, go to target selection ──
  // Power effects will be applied in selectTarget(); log only after target is chosen
  // (Self-buff e.g. Beyond the Nimbus is handled above and returns earlier.)
  updates[ARENA_PATH.BATTLE_TURN] = {
    attackerId,
    attackerTeam: battle.turn.attackerTeam,
    phase: PHASE.SELECT_TARGET,
    action: TURN_ACTION.POWER,
    usedPowerIndex: powerIndex,
    usedPowerName: power.name,
  };
  await update(roomRef(arenaId), updates);
}

/* ── select season for Persephone's Ephemeral Season power ────── */

export async function selectSeason(
  arenaId: string,
  season: string, // 'summer' | 'autumn' | 'winter' | 'spring'
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

/* ── cancel target selection: refund quota (if power) and go back to select-action ─── */

export async function cancelTargetSelection(arenaId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle?.turn || battle.turn.phase !== PHASE.SELECT_TARGET) return;

  const { attackerId, attackerTeam, action, usedPowerIndex } = battle.turn;
  const attacker = findFighter(room, attackerId);
  if (!attacker) return;

  const updates: Record<string, unknown> = {};

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

  // Tick effects, win check, then advance to next attacker (same as soulDevourerEndTurnOnly)
  const effectUpdates = tickEffects(room, battle, updates);
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
      }).catch(() => {});
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
      }).catch(() => {});
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
      }).catch(() => {});
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
      }).catch(() => {});
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

  // Apply season effects to all alive teammates
  const seasonUpdates = applySeasonEffects(room, attackerId, selectedSeason, battle);
  Object.assign(updates, seasonUpdates);

  // Sync activeEffects into battle for tickEffects
  if (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) {
    battle = { ...battle, activeEffects: updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] };
  }

  // Tick active effects (DOT damage, spring heal, decrement durations)
  const effectUpdates = tickEffects(room, battle, updates);
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
      }).catch(() => {});
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
      }).catch(() => {});
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
  } catch (_) {}
}

export async function requestDefendRollStart(arenaId: string): Promise<void> {
  try {
    await update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { [ARENA_PATH.BATTLE_TURN_DEFEND_ROLL_STARTED_AT]: Date.now() });
  } catch (_) {}
}

/* ── submit attack dice roll ─────────────────────────── */

export async function submitAttackRoll(arenaId: string, roll: number): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle?.turn) return;

  const updates: Record<string, unknown> = {
    [ARENA_PATH.BATTLE_TURN_ATTACK_ROLL]: roll,
    [ARENA_PATH.BATTLE_TURN_PHASE]: PHASE.ROLLING_DEFEND,
  };

  // Quota gain: roll + attackDiceUp + buff modifiers >= 11
  const attacker = findFighter(room, battle.turn.attackerId);
  if (attacker) {
    const buffMod = getStatModifier(battle.activeEffects || [], attacker.characterId, 'attackDiceUp');
    const total = roll + attacker.attackDiceUp + buffMod;
    if (total >= 11 && attacker.quota < attacker.maxQuota) {
      const atkPath = findFighterPath(room, attacker.characterId);
      if (atkPath) updates[`${atkPath}/quota`] = attacker.quota + 1;
    }
  }

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

  // Quota gain: roll + defendDiceUp + buff modifiers >= 11
  const defender = battle.turn.defenderId ? findFighter(room, battle.turn.defenderId) : undefined;
  if (defender) {
    const buffMod = getStatModifier(battle.activeEffects || [], defender.characterId, MOD_STAT.DEFEND_DICE_UP);
    const total = roll + defender.defendDiceUp + buffMod;
    if (total >= 11 && defender.quota < defender.maxQuota) {
      const defPath = findFighterPath(room, defender.characterId);
      if (defPath) updates[`${defPath}/quota`] = defender.quota + 1;
    }
  }

  await update(roomRef(arenaId), updates);
}

/* ── resolve turn (compare dice, apply damage, advance) ── */

export async function resolveTurn(arenaId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  let battle = room.battle;
  if (!battle || !battle.turn || battle.turn.phase !== PHASE.RESOLVING) return;
  // Winner is being delayed so hit effects can play; wait for delayed write
  if (battle.winnerDelayedAt != null) return;

  // Shadow Camouflaging: wait for player to roll D4 for refill; only advanceAfterShadowCamouflageD4 may advance
  const scWinFaces = (battle.turn as any)?.shadowCamouflageRefillWinFaces;
  const scRoll = (battle.turn as any)?.shadowCamouflageRefillRoll;
  if (Array.isArray(scWinFaces) && scWinFaces.length > 0 && scRoll == null) return;

  const { attackerId, defenderId, attackRoll = 0, defendRoll = 0, action } = battle.turn;

  // Soul Devourer: chose Use Power that cannot attack — only advance turn (no target, no damage)
  if (battle.turn.soulDevourerEndTurnOnly) {
    const turn = battle.turn;
    const updates: Record<string, unknown> = {};
    const effectUpdates = tickEffects(room, battle, updates);
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
        }).catch(() => {});
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
        }).catch(() => {});
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
      const effectUpdatesAdv = tickEffects(room, battle, updatesAdvance);
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

    const initialStep = buildMasterPlaybackStep(room, battle, attacker, defender);
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

    // Past last skeleton: client already saw last hit card and called resolve again → advance to next attacker
    if (skIndex >= skeletonsForAttackSk.length) {
      const updatesAdvance: Record<string, unknown> = {};
      const effectUpdatesAdv = tickEffects(room, battle, updatesAdvance);
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
        // Defender already dead (e.g. race); advance turn and clear resolvingHitIndex
        const updatesAdv: Record<string, unknown> = {};
        const effectUpdatesAdv = tickEffects(room, battle, updatesAdv);
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
          setTimeout(() => { update(roomRef(arenaId), { [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.A, [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED, [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null }).catch(() => {}); }, END_ARENA_DELAY_MS);
          return;
        }
        if (isTeamEliminated(teamAMembersAdv, latestEffectsAdv)) {
          updatesAdv[ARENA_PATH.BATTLE_TURN] = { ...turn, phase: PHASE.DONE };
          (updatesAdv[ARENA_PATH.BATTLE_TURN] as any).resolvingHitIndex = null;
          (updatesAdv[ARENA_PATH.BATTLE_TURN] as any).playbackStep = null;
          updatesAdv[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
          await update(roomRef(arenaId), updatesAdv);
          setTimeout(() => { update(roomRef(arenaId), { [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.B, [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED, [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null }).catch(() => {}); }, END_ARENA_DELAY_MS);
          return;
        }
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
        const dmgToApply = Math.max(0, shieldRemaining);
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
        updatesSk[ARENA_PATH.BATTLE_LAST_SKELETON_HITS] = [skHit];
        updatesSk[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = sk.characterId;
        updatesSk[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = defenderId;
        const existingLog = [...(battle.log || [])];
        existingLog.push(Object.assign({}, skHit, { isMinionHit: true }) as any);
        updatesSk[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog(existingLog);

        let battleAfterSk = battle;
        if (updatesSk[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) {
          battleAfterSk = { ...battle, activeEffects: updatesSk[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] };
        }
        const effectUpdatesSk = tickEffects(room, battleAfterSk, updatesSk);
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
              }).catch(() => {});
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
              }).catch(() => {});
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
    atkTotal = attackRoll + attacker.attackDiceUp + atkBuff;
    defTotal = defendRoll + defender.defendDiceUp + defBuff;
    hit = atkTotal > defTotal;

    // Pomegranate's Oath dodge: defender with spirit may dodge
    if (hit && battle.turn.isDodged) {
      isDodged = true;
      hit = false;
    }

    if (hit) {
      const effectUpdates = applyPowerEffect(room, attackerId, defenderId, usedPower, battle);
      Object.assign(updates, effectUpdates);

      if (usedPower.effect === EFFECT_TYPES.DAMAGE || usedPower.effect === EFFECT_TYPES.LIFESTEAL) {
        dmg = usedPower.value;
        defenderHpAfter = Math.max(0, defender.currentHp - usedPower.value);
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
    // Keraunos Voltage: base main 3 / secondary 2 each; on crit ×2 (main 6 / secondary 4)
    const mainId = (turn as any).keraunosMainTargetId ?? defenderId;
    const secondaryIds: string[] = (turn as any).keraunosSecondaryTargetIds ?? [];
    const isCritK = !!(turn as any).isCrit;
    const mult = isCritK ? 2 : 1;
    const dmgMain = 3 * mult;
    const dmgSecondary = 2 * mult;
    const aoeDamageMapK: Record<string, number> = {};
    if (mainId) {
      const mainFighter = findFighter(room, mainId);
      if (mainFighter && mainFighter.currentHp > 0) {
        const newHp = Math.max(0, mainFighter.currentHp - dmgMain);
        const path = findFighterPath(room, mainId);
        if (path) updates[`${path}/currentHp`] = newHp;
        aoeDamageMapK[mainId] = dmgMain;
      }
    }
    for (const sid of secondaryIds) {
      const sec = findFighter(room, sid);
      if (sec && sec.currentHp > 0) {
        const newHp = Math.max(0, sec.currentHp - dmgSecondary);
        const path = findFighterPath(room, sid);
        if (path) updates[`${path}/currentHp`] = newHp;
        aoeDamageMapK[sid] = dmgSecondary;
      }
    }
    const mainPath = mainId ? findFighterPath(room, mainId) : null;
    const mainHpAfter = mainPath && `${mainPath}/currentHp` in updates ? (updates[`${mainPath}/currentHp`] as number) : (mainId ? findFighter(room, mainId)?.currentHp ?? 0 : 0);
    const logEntryK = {
      round: battle.roundNumber,
      attackerId,
      defenderId: mainId,
      attackRoll: 0,
      defendRoll: 0,
      damage: dmgMain,
      defenderHpAfter: mainHpAfter,
      eliminated: mainHpAfter <= 0,
      missed: false,
      powerUsed: POWER_NAMES.KERAUNOS_VOLTAGE,
      aoeDamageMap: aoeDamageMapK,
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
      const lifestealHeal = Math.ceil(dmg * 0.5); // main drain only; skeleton hits do not add to heal
      const atkPath = findFighterPath(room, attackerId);
      if (atkPath) {
        const currentAttackerHp = (updates[`${atkPath}/currentHp`] as number | undefined) ?? attacker.currentHp;
        updates[`${atkPath}/currentHp`] = Math.min(attacker.maxHp, currentAttackerHp + lifestealHeal);
      }
      const attackerTeam = findFighterTeam(room, attackerId);
      if (attackerTeam) {
        const minions = room[attackerTeam]?.minions || [];
        skeletonsForAttack = minions.filter((m: any) => m.masterId === attackerId);
      }
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
    } else {
    // Normal attack: compare dice with active effect modifiers
    const atkBuff = getStatModifier(activeEffects, attackerId, MOD_STAT.ATTACK_DICE_UP);
    const defBuff = getStatModifier(activeEffects, defenderId, MOD_STAT.DEFEND_DICE_UP);
    atkTotal = attackRoll + attacker.attackDiceUp + atkBuff;
    defTotal = defendRoll + defender.defendDiceUp + defBuff;
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

      // Attack success → apply shock rule. If target has shock: bonus damage + remove shock. If not: add shock.
      // Run when: normal attack (Lightning Reflex) OR Nimbus attack (shock all enemies). Nimbus is self-buff so we must check attackerHasBeyondTheNimbus.
      if (!isSelfBuffPower || attackerHasBeyondTheNimbus) {
        if (attackerHasBeyondTheNimbus) {
          const battleWithNimbusEffects = {
            ...battle,
            activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? activeEffects,
          };
          const prevEffects = (battleWithNimbusEffects.activeEffects || []) as ActiveEffect[];
          const defenderHadShock = prevEffects.some(e => e.targetId === defenderId && e.tag === EFFECT_TAGS.SHOCK);
          const nimbusShockUpdates = applyBeyondTheNimbusTeamShock(room, attackerId, battleWithNimbusEffects, baseDmg);
          Object.assign(updates, nimbusShockUpdates);
          if (defenderHadShock) {
            rawDmg += baseDmg;
            shockBonusDamage = baseDmg;
          }
        } else {
          const shockResult = applyLightningReflexPassive(room, attackerId, defenderId, battle, baseDmg);
          rawDmg += shockResult.bonusDamage;
          shockBonusDamage = shockResult.bonusDamage;
          Object.assign(updates, shockResult.updates);
        }
      }

      // Collect skeletons belonging to the attacker — we will resolve them
      // separately (so their hits appear as distinct log entries).
      const attackerTeam = findFighterTeam(room, attackerId);
      if (attackerTeam) {
        const minions = room[attackerTeam]?.minions || [];
        skeletonsForAttack = minions.filter(m => m.masterId === attackerId);
      }

      // Skeleton protection: when master is attacked, lowest-index skeleton blocks damage and dies
      const defenderTeam = findFighterTeam(room, defenderId);
      if (defenderTeam) {
        const defenderMinions = room[defenderTeam]?.minions || [];
        const defenderSkeletons = defenderMinions.filter(m => m.masterId === defenderId);
        if (defenderSkeletons.length > 0) {
          // Choose the lowest-index skeleton (first in array) as blocker
          const blocker = defenderSkeletons[0];
          const remainingMinions = defenderMinions.filter(m => m.characterId !== blocker.characterId);

          // Prepare an immediate visual update: mark the minion as hit (transient) and publish
          // a `battle/lastHitMinionId` so UIs can retarget visuals to the skeleton and play hit effects.
          const hitMarkerKey = ARENA_PATH.BATTLE_LAST_HIT_MINION_ID;
          const immediateMinions = defenderMinions.map(m => (
            m.characterId === blocker.characterId ? { ...m, __isHit: true } : m
          ));

          // Decrement skeleton count immediately (so counts stay consistent)
          const defPath = findFighterPath(room, defenderId);
          if (defPath) {
            const currentCount = defender.skeletonCount || 0;
            updates[`${defPath}/skeletonCount`] = Math.max(0, currentCount - 1);
          }

          // Apply the immediate visual update right away so clients can animate the hit
          // while we schedule the actual removal a short time later.
          // NOTE: we call update() directly here to flush the visual marker early.
          try {
            await update(ref(db, `arenas/${arenaId}`), {
              [hitMarkerKey]: blocker.characterId,
              [teamPath(defenderTeam, 'minions')]: immediateMinions,
            });
          } catch (err) {
          }

          // Schedule removal after a short display interval so clients can show the hit animation
          // Keep the minion visible long enough for the full dust/despawn animation to play
          // Dust animation is 1000ms in CSS, add small buffer so it completes before removal.
          const HIT_DISPLAY_MS = 1100;
          setTimeout(async () => {
            try {
              await update(ref(db, `arenas/${arenaId}`), {
                // remove the blocker minion
                [teamPath(defenderTeam, 'minions')]: remainingMinions,
                // clear transient hit marker
                [hitMarkerKey]: null,
              });
            } catch (err) {
            }
          }, HIT_DISPLAY_MS);

          // Damage is completely blocked
          rawDmg = 0;
        }
      }

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
        // Remove depleted shields, persist remaining values (keep tagged shields like Floral Maiden)
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
        const lifestealHeal = Math.floor(dmg * 0.5);
        const atkPath = findFighterPath(room, attackerId);
        if (atkPath) {
          const currentAttackerHp = (updates[`${atkPath}/currentHp`] as number | undefined) ?? attacker.currentHp;
          updates[`${atkPath}/currentHp`] = Math.min(attacker.maxHp, currentAttackerHp + lifestealHeal);
        }
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
      updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...prevLogNorm.slice(0, -1), { ...lastPrevNorm, ...logEntry }]);
    } else {
      updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...prevLogNorm, logEntry]);
    }
    }
  }
  // skipDice powers: effect + log already written in selectAction()

  // Keraunos Voltage: apply shock to everyone alive on the opponent team (D4 was already rolled before resolve)
  if (turn.usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE && defenderId) {
    const mainIdK = (turn as any).keraunosMainTargetId ?? defenderId;
    const secondaryIdsK: string[] = (turn as any).keraunosSecondaryTargetIds ?? [];
    const isTeamAK = (room.teamA?.members || []).some(m => m.characterId === attackerId);
    const enemyTeam = isTeamAK ? (room.teamB?.members || []) : (room.teamA?.members || []);
    const getHpForShock = (characterId: string) => {
      const path = findFighterPath(room, characterId);
      if (path && `${path}/currentHp` in updates) return updates[`${path}/currentHp`] as number;
      const f = (room.teamA?.members || []).concat(room.teamB?.members || []).find(m => m.characterId === characterId);
      return f?.currentHp ?? 0;
    };
    const allAliveEnemyIds = enemyTeam.filter(e => getHpForShock(e.characterId) > 0).map(e => e.characterId);
    const baseDamageByTarget: Record<string, number> = {};
    if (mainIdK) baseDamageByTarget[mainIdK] = 3;
    for (const sid of secondaryIdsK) baseDamageByTarget[sid] = 2;
    for (const id of allAliveEnemyIds) {
      if (baseDamageByTarget[id] === undefined) baseDamageByTarget[id] = 0; // shock only, no bolt damage
    }
    const currentHpByTarget: Record<string, number> = {};
    for (const id of allAliveEnemyIds) currentHpByTarget[id] = getHpForShock(id);
    const battleForKeraunos = updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]
      ? { ...battle, activeEffects: updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] }
      : battle;
    const keraunosShockUpdates = applyKeraunosVoltageShock(
      room, attackerId, mainIdK, battleForKeraunos, 0, currentHpByTarget, baseDamageByTarget,
    );
    Object.assign(updates, keraunosShockUpdates);
  }

  // Floral Maiden passive: grant shield if atkTotal > 10
  const dryadUpdates = applySecretOfDryadPassive(room, attackerId, battle, atkTotal);
  if (dryadUpdates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) {
    Object.assign(updates, dryadUpdates);
  }

  // Pomegranate's Oath co-attack: when oath-bearer attacks + hits, caster co-attacks
  // Self-target (caster === oath-bearer): no co-attack
  if (!isDodged && hit && turn.coAttackRoll != null && turn.coAttackRoll > 0) {
    const spiritEffect = activeEffects.find(
      e => e.targetId === attackerId && e.tag === EFFECT_TAGS.POMEGRANATE_SPIRIT,
    );
    if (spiritEffect && spiritEffect.sourceId !== attackerId) {
      const casterId = turn.coAttackerId || spiritEffect.sourceId;
      const caster = findFighter(room, casterId);
      if (caster && caster.currentHp > 0) {
        const coBuff = getStatModifier(activeEffects, casterId, MOD_STAT.ATTACK_DICE_UP);
        const coTotal = turn.coAttackRoll + caster.attackDiceUp + coBuff;
        const coHit = coTotal > defTotal;
        if (coHit) {
          const coDmgBuff = getStatModifier(activeEffects, casterId, MOD_STAT.DAMAGE);
          const coDmg = Math.max(0, caster.damage + coDmgBuff);
          const defPath = findFighterPath(room, defenderId);
          if (defPath) {
            const currentDefHp = (updates[`${defPath}/currentHp`] as number | undefined) ?? defender.currentHp;
            updates[`${defPath}/currentHp`] = Math.max(0, currentDefHp - coDmg);
          }
          // Append co-attack info to the last log entry
          const logArr = (updates[ARENA_PATH.BATTLE_LOG] as typeof battle.log) || [...(battle.log || [])];
          if (logArr.length > 0) {
            logArr[logArr.length - 1].coAttackDamage = coDmg;
            logArr[logArr.length - 1].coAttackerId = casterId;
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
  // Pass current updates so DOT processing reads latest HP (not stale snapshot)
  const effectUpdates = tickEffects(room, battle, updates);
  Object.assign(updates, effectUpdates);

  // Build updated HP map for win condition check
  const getHp = (m: FighterState) => {
    const path = findFighterPath(room, m.characterId);
    if (path && `${path}/currentHp` in updates) return updates[`${path}/currentHp`] as number;
    return m.currentHp;
  };
  const teamAMembers = (room.teamA?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
  const teamBMembers = (room.teamB?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));

  // Rebuild turn queue with effective speeds (base + active buff/debuff modifiers)
  const latestEffects = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || battle.activeEffects || [];

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
      }).catch(() => {});
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
      }).catch(() => {});
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

  // Skip stunned fighters
  const nextFighter = findFighter(updatedRoom, nextEntry.characterId);
  if (nextFighter && !selfRes3 && isStunned(updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as typeof activeEffects || activeEffects, nextEntry.characterId)) {
    // Stunned: consume the stun turn and advance again
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;

    const afterStunRoom = { ...updatedRoom };
    const { index: skipIdx, wrapped: skipWrapped } = nextAliveIndex(updatedQueue, nextIdx, afterStunRoom, latestEffects);
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
    if (selfRes3) turnData.resurrectTargetId = nextEntry.characterId;
    updates[ARENA_PATH.BATTLE_TURN] = turnData;
  }

  // Clear transient minion-hit markers so next turn doesn't show stale hit state.
  // Leave lastSkeletonHits for the client to play back; client clears it after playback.
  updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
  updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;

  // When there are skeleton hits, delay advancing to next attacker so the client can show
  // all skeleton damage cards + shakes (2500+50 ms per hit in BattleHUD). Soul Devourer
  // waits 4500ms (master + soul float + heal) before first skeleton card.
  const skeletonHitsArr = updates[ARENA_PATH.BATTLE_LAST_SKELETON_HITS] as unknown[] | undefined;
  const hasSkeletonHits = Array.isArray(skeletonHitsArr) && skeletonHitsArr.length > 0;
  const skeletonCount = hasSkeletonHits ? skeletonHitsArr.length : 0;
  const SKELETON_MS_PER_HIT = 150; // 150ms per skeleton so damage card stays visible
  const SOUL_DEVOURER_CHAIN_START_MS = 800; // match BattleHUD SOUL_DEVOURER_MASTER_AND_HEAL_MS
  const isSoulDevourerDrain = !!(battle.turn as { soulDevourerDrain?: boolean })?.soulDevourerDrain;
  const SKELETON_PLAYBACK_DELAY_MS = (isSoulDevourerDrain ? SOUL_DEVOURER_CHAIN_START_MS : 0) + skeletonCount * SKELETON_MS_PER_HIT;
  let advancePayload: Record<string, unknown> | null = null;
  if (hasSkeletonHits && SKELETON_PLAYBACK_DELAY_MS > 0) {
    advancePayload = {
      [ARENA_PATH.BATTLE_TURN]: updates[ARENA_PATH.BATTLE_TURN],
      [ARENA_PATH.BATTLE_CURRENT_TURN_INDEX]: updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX],
      [ARENA_PATH.BATTLE_ROUND_NUMBER]: updates[ARENA_PATH.BATTLE_ROUND_NUMBER],
      [ARENA_PATH.BATTLE_LAST_SKELETON_HITS]: null,
    };
    delete updates[ARENA_PATH.BATTLE_TURN];
    delete updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX];
    delete updates[ARENA_PATH.BATTLE_ROUND_NUMBER];
  }

  await update(roomRef(arenaId), updates);

  if (advancePayload) {
    setTimeout(() => {
      update(roomRef(arenaId), advancePayload as Record<string, unknown>).catch(() => {});
    }, SKELETON_PLAYBACK_DELAY_MS);
  }
}
