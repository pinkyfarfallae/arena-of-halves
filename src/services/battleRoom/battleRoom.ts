/* eslint-disable */
import { ref, set, get, onValue, update, remove, off } from 'firebase/database';
import { db } from '../../firebase';
import type {
  BattleRoom, BattleState, FighterState,
  TurnQueueEntry, Viewer, BattlePlaybackStep, TurnState, InviteReservation,
} from '../../types/battle';
import { BATTLE_PLAYBACK_KIND } from '../../types/battle';
import type { Character } from '../../types/character';
import type { PowerDefinition, ActiveEffect } from '../../types/power';
import { getQuotaCost } from '../../types/power';
import {
  getStatModifier, getReflectPercent,
  isStunned, applyPowerEffect, tickEffects, buildPassiveEffects,
  makeEffectId,
  applyLightningSparkPassive, applyJoltArc, applyKeraunosVoltageShockSingleTarget,
  applyAporretaOfNymphaionPassive, onEfflorescenceMuseTurnStart, applyBlossomScentra, applyApolloHymn, applySeasonEffects, applyImprecatedPoem,
  applyPomegranateOath, applyBeyondTheNimbusTeamShock,
  addSunbornSovereignRecoveryStack,
  getEffectiveHealForReceiver,
  isHealingNullified,
  targetHasEfflorescenceMuse,
} from '../powerEngine/powerEngine';
import { getPowers } from '../../data/powers';
import { EFFECT_TAGS } from '../../constants/effectTags';
import { POWER_NAMES, POWERS_DEFENDER_CANNOT_DEFEND } from '../../constants/powers';
import {
  ARENA_PATH,
  ARENA_ROLE,
  BATTLE_TEAM,
  PHASE,
  ROOM_STATUS,
  TURN_ACTION,
  EXPERIENCE_HEAL_ACTION_LABEL,
  TurnAction,
  effectivePomCoAttackerId,
  effectivePomCoDefenderId,
  teamPath,
  TEAM_SUB_PATH,
  type BattleTeamKey,
} from '../../constants/battle';
import { EFFECT_TYPES, TARGET_TYPES, MOD_STAT } from '../../constants/effectTypes';
import { DEFAULT_NAMES, SKILL_UNLOCKED } from '../../constants/character';
import { FIREBASE_PATHS, FIREBASE_EVENTS } from '../../constants/firebase';
import { SEASON_KEYS, SeasonKey } from '../../data/seasons';
import * as HadesService from './hades/hades';
import * as ZeusService from './zeus/zeus';
import * as ApolloService from './apollo/apollo';
import * as PersephoneService from './persephone';
import { DEITY, Deity } from '../../constants/deities';
import { fetchActiveTodayIrisWish } from '../../data/wishes';
import { getDiceSize } from '../../utils/getDiceSize';
import { SECRET_CHARACTERS } from '../../constants/characters';
import { NEMESIS_RETALIATION } from '../../constants/iris';
import { nikeAwardedAfterWinTheFight } from '../irisWish/applyWishesEffect';

/* ── helpers ─────────────────────────────────────────── */

function isSecretCharacter(characterId?: string): boolean {
  if (!characterId) return false;
  return SECRET_CHARACTERS.includes(characterId.toLowerCase());
}

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

/**
 * Keraunos Voltage UI steps: 0 = main (3 dmg), 1 = 2-dmg target(s); with ≥3 alive enemies pick two distinct 2-dmg targets, then tier-3 (1 dmg) fills the rest.
 * Legacy: step 2 was a manual third pick — still mapped for old room state.
 */
export function effectiveKeraunosStep(turn: {
  keraunosTargetStep?: number | null;
  keraunosSecondaryTargetIds?: string[] | null;
}): 0 | 1 | 2 {
  return ZeusService.effectiveKeraunosStep(turn);
}

/** Damage-card tier for a Keraunos bolt target (3 / 2 / 1 base before crit). */
export function keraunosTierForTargetId(
  mainId: string | undefined,
  secondaryIds: string[],
  tid: string,
): 0 | 1 | 2 {
  return ZeusService.keraunosTierForTargetId(mainId, secondaryIds, tid);
}

/** Ensure no log entry has powerUsed === undefined (Firebase rejects undefined). Preserve hitTargetId so client gets it. */
export function sanitizeBattleLog(log: unknown[]): unknown[] {
  return log.map((e: any) => {
    const out: Record<string, unknown> = { ...e, powerUsed: e.powerUsed ?? '' };
    if (e.hitTargetId != null && e.hitTargetId !== '') out.hitTargetId = e.hitTargetId;
    return out;
  });
}

/**
 * RTDB update() merges keys — stale battle/turn fields (e.g. usedPowerName from the previous fighter)
 * persist unless explicitly removed. Use null so the next fighter's SELECT_ACTION is clean (ActionSelectModal needs !confirmedPowerName).
 */
/** Clear turn keys that must not leak into ROLLING_BLOSSOM_SCENTRA_HEAL (RTDB merge). */
function nullStaleFieldsForBlossomScentraHealTurn(): Record<string, unknown> {
  return {
    defenderId: null,
    visualDefenderId: null,
    disorientedWinFaces: null,
    disorientedRoll: null,
    playbackStep: null,
    resolvingHitIndex: null,
    attackRoll: null,
    defendRoll: null,
    isCrit: null,
    critRoll: null,
    critWinFaces: null,
    experienceHealWinFaces: null,
    experienceHealRoll: null,
    powerQuotaApplied: null,
  };
}

function clearStaleTurnFieldsForNewSelectAction(): Record<string, unknown> {
  return {
    action: null,
    usedPowerIndex: null,
    usedPowerName: null,
    defenderId: null,
    allyTargetId: null,
    attackRoll: null,
    defendRoll: null,
    isCrit: null,
    critRoll: null,
    critWinFaces: null,
    chainRoll: null,
    chainSuccess: null,
    chainWinFaces: null,
    keraunosAwaitingCrit: null,
    keraunosMainTargetId: null,
    keraunosSecondaryTargetIds: null,
    keraunosTargetStep: null,
    keraunosResolveTargetIds: null,
    keraunosAoeDamageMap: null,
    keraunosResolveIndex: null,
    keraunosShockExcludeTargetIds: null,
    isDodged: null,
    dodgeRoll: null,
    dodgeWinFaces: null,
    coAttackRoll: null,
    coDefendRoll: null,
    coAttackerId: null,
    pomCoAttackerId: null,
    pomCoDefenderId: null,
    coAttackHit: null,
    coAttackDamage: null,
    nemesisReattackSourceId: null,
    nemesisReattackTargetId: null,
    nemesisReattackDamage: null,
    nemesisReattackFromCoAttack: null,
    blossomHealWinFaces: null,
    blossomHealRoll: null,
    experienceHealWinFaces: null,
    experienceHealRoll: null,
    blossomHealSkipped: null,
    healSkipReason: null,
    selectedSeason: null,
    selectedPoem: null,
    springHealWinFaces: null,
    springHealRoll: null,
    springRound: null,
    soulDevourerDrain: null,
    soulDevourerEndTurnOnly: null,
    shadowCamouflageRefillWinFaces: null,
    shadowCamouflageRefillRoll: null,
    disorientedWinFaces: null,
    disorientedRoll: null,
    resolvingHitIndex: null,
    playbackStep: null,
    joltArcTargetIds: null,
    joltArcAoeDamageMap: null,
    joltArcResolveIndex: null,
    joltArcAwaitingAdvance: null,
    attackRollStartedAt: null,
    defendRollStartedAt: null,
    awaitingPomegranateCoAttack: null,
    pomegranateCoSkippedAwaitsAck: null,
    pomegranateDeferredCtx: null,
    visualDefenderId: null,
    rapidFireStep: null,
    rapidFireWinFaces: null,
    rapidFireBaseDmg: null,
    rapidFireIsCrit: null,
    rapidFireDefTotal: null,
    rapidFireD4Roll: null,
    powerQuotaApplied: null,
  };
}

/**
 * Deduct power SP/quota once when the turn commits (dice or resolve), after confirmations.
 * Uses turn.usedPowerIndex, or usedPowerIndexOverride when the DB turn is still SELECT_ACTION
 * (power just chosen in this request — e.g. Hades skipDice self buffs: Shadow, Undead Army).
 */
export function deductPowerQuotaIfPending(
  room: BattleRoom,
  turn: TurnState,
  attackerId: string,
  updates: Record<string, unknown>,
  turnUpdate: Record<string, unknown>,
  usedPowerIndexOverride?: number | null,
): void {
  if (turn.powerQuotaApplied) return;
  const idx = usedPowerIndexOverride ?? turn.usedPowerIndex;
  if (idx == null) return;
  const attacker = findFighter(room, attackerId);
  if (!attacker) return;
  const power = attacker.powers?.[idx];
  if (!power) return;
  const cost = getQuotaCost(power.type);
  if (cost <= 0) return;
  const atkPath = findFighterPath(room, attackerId);
  if (!atkPath) return;
  const pendingQ = updates[`${atkPath}/quota`];
  const currentQuota = typeof pendingQ === 'number' ? pendingQ : attacker.quota;
  if (currentQuota < cost) return;
  updates[`${atkPath}/quota`] = currentQuota - cost;
  turnUpdate.powerQuotaApplied = true;
}

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
  return PersephoneService.appendPomegranateCoAttackLog(logArr, opts);
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

/**
 * Firebase may return `team.members` as an object keyed by index; normalize to an array in roster order
 * so slot 0 stays the configurating host.
 */
export function teamMembersFromFirebase<T>(raw: T[] | Record<string, T> | undefined | null): T[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  return Object.entries(raw as Record<string, T>)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([, v]) => v);
}

/** Firebase may store `inviteReservations` as an object keyed by index (same as team members). */
export function inviteReservationsFromFirebase(
  raw: InviteReservation[] | Record<string, InviteReservation> | undefined | null,
): InviteReservation[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  return Object.entries(raw as Record<string, InviteReservation>)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([, v]) => v)
    .filter((v): v is InviteReservation => v != null && typeof (v as InviteReservation).characterId === 'string');
}

/** Build a FighterState snapshot from a Character + their Powers */
export function toFighterState(character: Character, powers: PowerDefinition[], wishOfIris: Deity | null): FighterState {
  // Calculate critical rate based on strength
  let criticalRate = 25; // default 25%
  if (character.strength > 3 && character.strength < 5) {
    criticalRate = 50; // 50% if 3 < strength < 5
  } else if (character.strength === 5) {
    criticalRate = 75; // 75% if strength === 5
  }

  const hasAresWish = wishOfIris === DEITY.ARES;
  const hasArtemisWish = wishOfIris === DEITY.ARTEMIS;

  return {
    characterId: character.characterId,
    nicknameEng: character.nicknameEng,
    nicknameThai: character.nicknameThai,
    sex: character.sex,
    deityBlood: character.deityBlood,
    image: character.image || '',
    theme: character.theme,

    maxHp: character.hp,
    currentHp: character.hp,
    damage: character.damage + (hasAresWish ? 1 : 0),
    attackDiceUp: character.attackDiceUp,
    defendDiceUp: character.defendDiceUp,
    speed: character.speed + (hasArtemisWish ? 3 : 0),
    rerollsLeft: character.reroll,

    passiveSkillPoint: character.passiveSkillPoint,
    skillPoint: character.skillPoint,
    ultimateSkillPoint: character.ultimateSkillPoint,

    maxQuota: character.technique < 3 ? 2 : 3,
    quota: character.technique < 3 ? 2 : 3,
    criticalRate,

    powers,
    skeletonCount: 0,

    wishOfIris: wishOfIris || null,

    strength: character.strength,
    mobility: character.mobility,
    intelligence: character.intelligence,
    technique: character.technique,
    experience: character.experience,
    fortune: character.fortune,
  };
}

/** Get all character IDs in a room (both teams) */
function getAllFighterIds(room: BattleRoom): string[] {
  const teamAIds = teamMembersFromFirebase(room.teamA?.members).map((m) => m.characterId);
  const teamBIds = teamMembersFromFirebase(room.teamB?.members).map((m) => m.characterId);
  return [...teamAIds, ...teamBIds];
}

/** True if the character has an active Soul Devourer effect (Hades). */
function hasSoulDevourerEffect(activeEffects: ActiveEffect[] | undefined, characterId: string): boolean {
  return HadesService.hasSoulDevourerEffect(activeEffects, characterId);
}

/** True if the power can be used to "attack" (enemy target, damage/lifesteal) for Soul Devourer drain. */
function powerCanAttack(power: PowerDefinition): boolean {
  return HadesService.powerCanAttack(power);
}

/** True if the fighter has Shadow Camouflage (immune to single-target actions; only area attacks can target them). */
function hasShadowCamouflage(activeEffects: ActiveEffect[], characterId: string): boolean {
  return HadesService.hasShadowCamouflage(activeEffects, characterId);
}

/**
 * Returns valid target characterIds for the current turn (SELECT_TARGET).
 * Used for Disoriented auto-target and for validating no valid targets (skip turn).
 */
function getValidTargetIds(
  room: BattleRoom,
  turn: BattleState["turn"],
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

  if (turn.action === TURN_ACTION.HEAL) {
    return sameTeam.filter(m => m.currentHp > 0).map(m => m.characterId);
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

export function roomRef(arenaId: string) {
  return ref(db, `arenas/${arenaId}`);
}

/* ── sanitize for Firebase (remove undefined values) ── */

function sanitizeForFirebase<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirebase(item)) as T;
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = (obj as any)[key];
        if (value !== undefined) {
          sanitized[key] = sanitizeForFirebase(value);
        }
      }
    }
    return sanitized as T;
  }
  
  return obj;
}

/* ── update today wishes to existing arena room ────────────────────────────────────────── */

export async function updateTodayWishesForRoom(arenaId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  const updates: Record<string, unknown> = {};

  // Update wishes for team A members
  const teamAMembers = teamMembersFromFirebase(room.teamA?.members);
  for (let i = 0; i < teamAMembers.length; i++) {
    const member = teamAMembers[i];
    const todayWish = await fetchActiveTodayIrisWish(member.characterId);
    const newDeity = (todayWish?.deity as Deity) || null;
    const oldDeity = member.wishOfIris || null;

    // Only update if wish actually changed
    if (oldDeity !== newDeity) {
      // Ares
      const hadAresWish = oldDeity === DEITY.ARES;
      const hasAresWish = newDeity === DEITY.ARES;

      if (hadAresWish && !hasAresWish) {
        // Lost Ares bonus: -1 damage
        updates[`teamA/members/${i}/damage`] = member.damage - 1;
      } else if (!hadAresWish && hasAresWish) {
        // Gained Ares bonus: +1 damage
        updates[`teamA/members/${i}/damage`] = member.damage + 1;
      }

      // Artemis
      const hadArtemisWish = oldDeity === DEITY.ARTEMIS;
      const hasArtemisWish = newDeity === DEITY.ARTEMIS;

      if (hadArtemisWish && !hasArtemisWish) {
        // Lost Artemis bonus: -3 speed
        updates[`teamA/members/${i}/speed`] = member.speed - 3;
      } else if (!hadArtemisWish && hasArtemisWish) {
        // Gained Artemis bonus: +3 speed
        updates[`teamA/members/${i}/speed`] = member.speed + 3;
      }

      updates[`teamA/members/${i}/wishOfIris`] = newDeity;
    }
  }

  // Update wishes for team B members
  const teamBMembers = teamMembersFromFirebase(room.teamB?.members);
  for (let i = 0; i < teamBMembers.length; i++) {
    const member = teamBMembers[i];
    const todayWish = await fetchActiveTodayIrisWish(member.characterId);
    const newDeity = (todayWish?.deity as Deity) || null;
    const oldDeity = member.wishOfIris || null;

    // Only update if wish actually changed
    if (oldDeity !== newDeity) {
      // Ares
      const hadAresWish = oldDeity === DEITY.ARES;
      const hasAresWish = newDeity === DEITY.ARES;

      if (hadAresWish && !hasAresWish) {
        // Lost Ares bonus: -1 damage
        updates[`teamB/members/${i}/damage`] = member.damage - 1;
      } else if (!hadAresWish && hasAresWish) {
        // Gained Ares bonus: +1 damage
        updates[`teamB/members/${i}/damage`] = member.damage + 1;
      }

      // Artemis
      const hadArtemisWish = oldDeity === DEITY.ARTEMIS;
      const hasArtemisWish = newDeity === DEITY.ARTEMIS;

      if (hadArtemisWish && !hasArtemisWish) {
        // Lost Artemis bonus: -3 speed
        updates[`teamB/members/${i}/speed`] = member.speed - 3;
      } else if (!hadArtemisWish && hasArtemisWish) {
        // Gained Artemis bonus: +3 speed
        updates[`teamB/members/${i}/speed`] = member.speed + 3;
      }

      updates[`teamB/members/${i}/wishOfIris`] = newDeity;
    }
  }

  if (Object.keys(updates).length > 0) {
    await update(roomRef(arenaId), updates);
  }
}

/* ── create ───────────────────────────────────────────── */

export async function createRoom(
  fighter: FighterState | FighterState[],
  customName?: string,
  teamAMax: number = 1,
  teamBMax?: number,
  extraFields?: Partial<BattleRoom>,
  creatorCharacterId?: string,
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

  const maxA = Math.max(1, Math.floor(teamAMax));
  const maxB = teamBMax != null ? Math.max(1, Math.floor(teamBMax)) : maxA;
  const displaySize = Math.max(maxA, maxB);
  const teamAMembers = Array.isArray(fighter) ? fighter : [fighter];
  const firstName = Array.isArray(fighter)
    ? fighter.map(f => f.nicknameEng).join(' & ')
    : fighter.nicknameEng;
  const roomName = customName?.trim() || `${firstName} vs ???`;

  const room: BattleRoom = {
    arenaId,
    roomName,
    status: ROOM_STATUS.CONFIGURING,
    teamSize: displaySize,
    teamA: { members: teamAMembers, maxSize: maxA, minions: [] },
    teamB: { members: [], maxSize: maxB, minions: [] },
    viewers: {},
    secretMode: isSecretCharacter(creatorCharacterId),
    createdAt: Date.now(),
    ...extraFields,
  };

  // Sanitize to remove undefined values (Firebase doesn't accept them)
  const sanitizedRoom = sanitizeForFirebase(room);
  await set(roomRef(arenaId), sanitizedRoom);
  
  return arenaId;
}

/* ── join as fighter (opponent team) ──────────────────── */

export async function joinRoom(arenaId: string, fighter: FighterState | FighterState[]): Promise<BattleRoom | null> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return null;

  const room = snap.val() as BattleRoom;
  const fighters = Array.isArray(fighter) ? fighter : [fighter];
  if (fighters.length === 0) return null;

  const teamAMembers = teamMembersFromFirebase(room.teamA?.members);
  const teamBMembers = teamMembersFromFirebase(room.teamB?.members);
  const maxA = room.teamA?.maxSize ?? room.teamSize;
  const maxB = room.teamB?.maxSize ?? room.teamSize;

  const allIds = getAllFighterIds(room);
  const idKey = (id: string) => id.toLowerCase();
  const incomingIds = fighters.map(f => f.characterId);
  if (incomingIds.some((id, i) => incomingIds.indexOf(id) !== i)) {
    return null;
  }
  if (fighters.some((f) => allIds.some((existing) => idKey(existing) === idKey(f.characterId)))) {
    return null;
  }

  const reservations = inviteReservationsFromFirebase(room.inviteReservations);
  const single = fighters.length === 1 ? fighters[0] : null;
  const matchReservation =
    single &&
    reservations.find((r) => r.characterId.toLowerCase() === single.characterId.toLowerCase());

  if (matchReservation && single) {
    const toA = matchReservation.team === ARENA_ROLE.TEAM_A;
    const members = toA ? teamAMembers : teamBMembers;
    const max = toA ? maxA : maxB;
    if (members.length + 1 > max) {
      return null;
    }
    const newTeamA = toA ? [...teamAMembers, single] : teamAMembers;
    const newTeamB = toA ? teamBMembers : [...teamBMembers, single];
    const bothFull = newTeamA.length >= maxA && newTeamB.length >= maxB;
    const remainingReservations = reservations.filter(
      (r) => r.characterId.toLowerCase() !== single.characterId.toLowerCase(),
    );
    await update(roomRef(arenaId), {
      [teamPath(BATTLE_TEAM.A, TEAM_SUB_PATH.MEMBERS)]: newTeamA,
      [teamPath(BATTLE_TEAM.B, TEAM_SUB_PATH.MEMBERS)]: newTeamB,
      [ARENA_PATH.STATUS]: bothFull ? ROOM_STATUS.READY : ROOM_STATUS.WAITING,
      inviteReservations: remainingReservations.length > 0 ? remainingReservations : null,
    });

    // Update today's wishes for all fighters in the room
    await updateTodayWishesForRoom(arenaId);

    const updated = await get(roomRef(arenaId));
    return updated.val() as BattleRoom;
  }

  const fitB = teamBMembers.length + fighters.length <= maxB;
  const fitA = teamAMembers.length + fighters.length <= maxA;

  let newTeamA = teamAMembers;
  let newTeamB = teamBMembers;

  if (fitB) {
    newTeamB = [...teamBMembers, ...fighters];
  } else if (fitA) {
    newTeamA = [...teamAMembers, ...fighters];
  } else {
    return null;
  }

  const bothFull = newTeamA.length >= maxA && newTeamB.length >= maxB;

  await update(roomRef(arenaId), {
    [teamPath(BATTLE_TEAM.A, TEAM_SUB_PATH.MEMBERS)]: newTeamA,
    [teamPath(BATTLE_TEAM.B, TEAM_SUB_PATH.MEMBERS)]: newTeamB,
    [ARENA_PATH.STATUS]: bothFull ? ROOM_STATUS.READY : ROOM_STATUS.WAITING,
  });

  // Update today's wishes for all fighters in the room
  await updateTodayWishesForRoom(arenaId);

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

export function onRoomsList(callback: (rooms: BattleRoom[]) => void, viewerCharacterId?: string): () => void {
  const arenasRef = ref(db, FIREBASE_PATHS.ARENAS);
  const handler = onValue(arenasRef, (snap) => {
    const rooms = !snap.exists()
      ? []
      : (Object.values(snap.val() as Record<string, BattleRoom>)
        .filter((r) => {
          // Filter out configuring and practice arenas
          if (r.status === ROOM_STATUS.CONFIGURING || r.practiceMode) return false;
          // Filter out secret arenas if viewer is not a secret character
          if (r.secretMode && !isSecretCharacter(viewerCharacterId)) return false;
          return true;
        })
        .sort((a, b) => b.createdAt - a.createdAt));
    setTimeout(() => callback(rooms), 0);
  });

  return () => off(arenasRef, FIREBASE_EVENTS.VALUE, handler);
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
  return () => off(r, FIREBASE_EVENTS.VALUE, handler);
}

/* ── delete room ──────────────────────────────────────── */

export async function deleteRoom(arenaId: string): Promise<void> {
  await remove(roomRef(arenaId));
}

/** Delete every arena room on the server (entire `arenas` node). Use with caution. */
export async function deleteAllArenaRooms(): Promise<void> {
  await remove(ref(db, FIREBASE_PATHS.ARENAS));
}

/* ══════════════════════════════════════════════════════════
   BATTLE — turn-based combat
   ══════════════════════════════════════════════════════════ */

/** Build a SPD-sorted turn queue from each fighter's **base** SPD only.
 * Temporary speed buffs/debuffs (activeEffects) do **not** reorder initiative — the queue only
 * reshuffles when this runs at turn boundaries with updated `room` (e.g. base stat changes on members).
 * Next fighter still follows this fixed order via {@link nextAliveIndex}. */
export function buildTurnQueue(room: BattleRoom, _effects?: ActiveEffect[]): TurnQueueEntry[] {
  const entries: TurnQueueEntry[] = [];

  for (const m of room.teamA?.members || []) {
    entries.push({ characterId: m.characterId, team: BATTLE_TEAM.A, speed: m.speed });
  }
  for (const m of room.teamB?.members || []) {
    entries.push({ characterId: m.characterId, team: BATTLE_TEAM.B, speed: m.speed });
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
export function findFighter(room: BattleRoom, characterId: string): FighterState | undefined {
  const all = [...(room.teamA?.members || []), ...(room.teamB?.members || [])];
  const fighter = all.find((m) => m.characterId === characterId);
  return fighter ? normalizeFighterImpl(fighter) : undefined;
}

/** Find the index of a fighter in teamA or teamB members array */
export function findFighterPath(room: BattleRoom, characterId: string): string | null {
  const teamAIdx = (room.teamA?.members || []).findIndex((m) => m.characterId === characterId);
  if (teamAIdx !== -1) return `${teamPath(BATTLE_TEAM.A, TEAM_SUB_PATH.MEMBERS)}/${teamAIdx}`;
  const teamBIdx = (room.teamB?.members || []).findIndex((m) => m.characterId === characterId);
  if (teamBIdx !== -1) return `${teamPath(BATTLE_TEAM.B, TEAM_SUB_PATH.MEMBERS)}/${teamBIdx}`;
  return null;
}

function findFighterTeam(room: BattleRoom, characterId: string): BattleTeamKey | null {
  if ((room.teamA?.members || []).some(m => m.characterId === characterId)) return BATTLE_TEAM.A;
  if ((room.teamB?.members || []).some(m => m.characterId === characterId)) return BATTLE_TEAM.B;
  return null;
}
export { findFighterTeam };

/**
 * Test mode: write NPC crit D4 to Firebase when RESOLVING has no crit result yet.
 * BattleHUD only rolls from the playback driver; this lets any open client (or delayed timer) unstuck PvE crit.
 */
export async function applyNpcResolvingCritIfPending(
  arenaId: string,
  npcCharacterIdsLower: Set<string>,
): Promise<void> {
  if (npcCharacterIdsLower.size === 0) return;
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  if (!room.testMode) return;
  const battle = room.battle;
  if (!battle?.turn || battle.turn.phase !== PHASE.RESOLVING) return;

  const turn = battle.turn;
  const effects = battle.activeEffects || [];
  const tr = turn as unknown as Record<string, unknown>;

  if (tr.soulDevourerDrain) return;
  const scFaces = tr.shadowCamouflageRefillWinFaces;
  if (Array.isArray(scFaces) && scFaces.length > 0 && tr.shadowCamouflageRefillRoll == null) return;

  if ((turn.critRoll ?? 0) > 0) return;
  if (turn.isCrit === true) return;

  const dodgeFaces = tr.dodgeWinFaces;
  if (Array.isArray(dodgeFaces) && dodgeFaces.length > 0 && tr.dodgeRoll == null) return;
  if (turn.isDodged === true) return;

  const awaitingPom = !!turn.awaitingPomegranateCoAttack;
  const pomCoAtkId = effectivePomCoAttackerId(turn);
  const pomCoCritPhase =
    awaitingPom &&
    !!pomCoAtkId &&
    turn.coAttackRoll != null &&
    turn.coAttackRoll > 0 &&
    turn.coDefendRoll != null &&
    turn.coDefendRoll >= 1 &&
    npcCharacterIdsLower.has(String(pomCoAtkId).toLowerCase());

  const writeCrit = async (isCrit: boolean, critRoll: number, winFaces: number[]) => {
    await update(roomRef(arenaId), {
      [`${ARENA_PATH.BATTLE_TURN}/isCrit`]: isCrit,
      [`${ARENA_PATH.BATTLE_TURN}/critRoll`]: critRoll,
      [`${ARENA_PATH.BATTLE_TURN}/critWinFaces`]: winFaces,
    });
  };

  if (pomCoCritPhase) {
    const coCaster = findFighter(room, pomCoAtkId!);
    const defender = turn.defenderId ? findFighter(room, turn.defenderId) : undefined;
    if (!coCaster || !defender || !turn.defenderId) return;
    const coBuff = getStatModifier(effects, pomCoAtkId!, MOD_STAT.ATTACK_DICE_UP);
    const coRecovery = getStatModifier(effects, pomCoAtkId!, MOD_STAT.RECOVERY_DICE_UP);
    const defBuff = getStatModifier(effects, turn.defenderId, MOD_STAT.DEFEND_DICE_UP);
    const defRecovery = getStatModifier(effects, turn.defenderId, MOD_STAT.RECOVERY_DICE_UP);
    const coTotal = (turn.coAttackRoll ?? 0) + coCaster.attackDiceUp + coBuff + coRecovery;
    const coDefTotal = (turn.coDefendRoll ?? 0) + defender.defendDiceUp + defBuff + defRecovery;
    if (coTotal <= coDefTotal || coTotal < 10) return;
    const critBuffCo = getStatModifier(effects, pomCoAtkId!, MOD_STAT.CRITICAL_RATE);
    const effectiveCrit = Math.max(coCaster.criticalRate, coCaster.criticalRate + critBuffCo);
    if (effectiveCrit <= 0) return;
    if (effectiveCrit >= 100) {
      await writeCrit(true, 0, [1, 2, 3, 4]);
      return;
    }
    const winFaces = (turn.critWinFaces?.length ? turn.critWinFaces : getWinningFaces(effectiveCrit)) as number[];
    const crit = checkCritical(effectiveCrit, winFaces);
    await writeCrit(crit.isCrit, crit.critRoll, winFaces);
    return;
  }

  const attackerId = turn.attackerId;
  if (!attackerId || !npcCharacterIdsLower.has(attackerId.toLowerCase())) return;
  if (!turn.defenderId) return;
  const attacker = findFighter(room, attackerId);
  const defender = findFighter(room, turn.defenderId);
  if (!attacker || !defender) return;

  const isSkipDicePower =
    turn.action === TURN_ACTION.POWER &&
    (turn.attackRoll == null || turn.attackRoll === 0);
  if (isSkipDicePower && turn.usedPowerName !== POWER_NAMES.KERAUNOS_VOLTAGE) return;

  if (turn.usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE) {
    const critBuffK = getStatModifier(effects, attackerId, MOD_STAT.CRITICAL_RATE);
    const effectiveCritBase = Math.max(attacker.criticalRate ?? 0, (attacker.criticalRate ?? 0) + critBuffK);
    const effectiveCritK = Math.min(100, Math.max(0, effectiveCritBase + 25));
    if (effectiveCritK <= 0) return;
    if (effectiveCritK >= 100) {
      await writeCrit(true, 0, [1, 2, 3, 4]);
      return;
    }
    const winFaces = (turn.critWinFaces?.length ? turn.critWinFaces : getWinningFaces(effectiveCritK)) as number[];
    const crit = checkCritical(effectiveCritK, winFaces);
    await writeCrit(crit.isCrit, crit.critRoll, winFaces);
    return;
  }

  const atkBuff = getStatModifier(effects, attackerId, MOD_STAT.ATTACK_DICE_UP);
  const defBuff = getStatModifier(effects, turn.defenderId, MOD_STAT.DEFEND_DICE_UP);
  const atkRecovery = getStatModifier(effects, attackerId, MOD_STAT.RECOVERY_DICE_UP);
  const defRecovery = getStatModifier(effects, turn.defenderId, MOD_STAT.RECOVERY_DICE_UP);
  const atkTotal = (turn.attackRoll ?? 0) + attacker.attackDiceUp + atkBuff + atkRecovery;
  const defTotal = (turn.defendRoll ?? 0) + defender.defendDiceUp + defBuff + defRecovery;
  if (atkTotal <= defTotal || atkTotal < 10) return;

  const critBuff = getStatModifier(effects, attackerId, MOD_STAT.CRITICAL_RATE);
  const effectiveCrit = Math.max(attacker.criticalRate, attacker.criticalRate + critBuff);
  if (effectiveCrit <= 0) return;
  if (effectiveCrit >= 100) {
    await writeCrit(true, 0, [1, 2, 3, 4]);
    return;
  }
  const winFaces = (turn.critWinFaces?.length ? turn.critWinFaces : getWinningFaces(effectiveCrit)) as number[];
  const crit = checkCritical(effectiveCrit, winFaces);
  await writeCrit(crit.isCrit, crit.critRoll, winFaces);
}

/**
 * Resolve one hit at defender: if defender has a skeleton, skeleton takes the hit and is destroyed (0 damage to master);
 * otherwise the given damage goes to master. 1 attack = 1 skeleton.
 * When skeleton blocks: sets lastHitTargetId = blocker, writes blocker to updates for next call in same turn, but
 * actual minion removal is delayed (setTimeout) so client can show hit VFX on skeleton first.
 * Caller MUST delete result.skippedMinionsPath from updates before writing to Firebase so client keeps minion for 1100ms.
 */
export async function resolveHitAtDefender(
  arenaId: string,
  room: BattleRoom,
  defenderId: string,
  incomingDamage: number,
  updates: Record<string, unknown>,
  defender: FighterState,
): Promise<{ damageToMaster: number; hitTargetId: string; skippedMinionsPath?: string }> {
  const defenderTeam = findFighterTeam(room, defenderId);
  if (!defenderTeam) return { damageToMaster: incomingDamage, hitTargetId: defenderId };
  const currentMinions = (updates[teamPath(defenderTeam, TEAM_SUB_PATH.MINIONS)] as any[]) ?? (room[defenderTeam]?.minions || []);
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
  const minionsPath = teamPath(defenderTeam, TEAM_SUB_PATH.MINIONS);
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

/** Stable order for Jolt Arc resolve cards (enemy roster order, then any remaining map keys). */
function getJoltArcOrderedTargetIds(room: BattleRoom, attackerId: string, aoeDamageMap: Record<string, number>): string[] {
  return ZeusService.getJoltArcOrderedTargetIds(room, attackerId, aoeDamageMap);
}

export function readFighterHpFromUpdates(room: BattleRoom, characterId: string, updates: Record<string, unknown>): number {
  const path = findFighterPath(room, characterId);
  if (path && `${path}/currentHp` in updates) return updates[`${path}/currentHp`] as number;
  return findFighter(room, characterId)?.currentHp ?? 0;
}

/** Living bolt targets in order: main (3), then secondaries (2/2/1…), at chain start. */
function computeKeraunosOrderedTargetIds(room: BattleRoom, turn: TurnState): string[] {
  return ZeusService.computeKeraunosOrderedTargetIds(room, turn, { findFighter });
}

function mergeKeraunosBattleLog(battle: BattleState, updates: Record<string, unknown>, row: Record<string, unknown>): void {
  ZeusService.mergeKeraunosBattleLog(battle, updates, row, { sanitizeBattleLog });
}

type KeraunosBoltResult = { totalDamage: number; tier: 0 | 1 | 2; shockBonus: number };

/** One Keraunos bolt + shock for a single target. Mutates `updates`; mutates `excludeTargetIds` when skeleton absorbs. */
async function applyKeraunosVoltageBoltForTarget(
  arenaId: string,
  room: BattleRoom,
  battle: BattleState,
  turn: TurnState,
  attackerId: string,
  attacker: FighterState,
  targetId: string,
  updates: Record<string, unknown>,
  excludeTargetIds: string[],
): Promise<KeraunosBoltResult> {
  return ZeusService.applyKeraunosVoltageBoltForTarget(
    arenaId,
    room,
    battle,
    turn,
    attackerId,
    attacker,
    targetId,
    updates,
    excludeTargetIds,
    {
      findFighter,
      findFighterPath,
      readFighterHpFromUpdates,
      resolveHitAtDefender,
    },
  );
}

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
  return ZeusService.applyJoltArcDamagePhase(
    arenaId,
    attackerId,
    aoeDamageMap,
    joltUpdates,
    attackerTeam,
    primaryDefenderId,
    turnUsedPowerIndex,
    {
      roomRef,
      findFighter,
      findFighterPath,
      findFighterTeam,
      resolveHitAtDefender,
      sanitizeBattleLog,
    },
  );
}

/** Run tickEffects and apply any DOT damage via resolveHitAtDefender so Hades child's skeleton can block. */
export async function tickEffectsWithSkeletonBlock(
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
    const isJoltArc = turn.usedPowerName === POWER_NAMES.JOLT_ARC;
    const isCritK = isKeraunos && !!(turn as any).isCrit;
    const mult = isCritK ? 2 : 1;
    const boltDmg = isKeraunos ? (3 * mult) : 0;
    let damage = boltDmg;
    let shockBonus = 0;
    if (isKeraunos) {
      const idsK = (turn as TurnState & { keraunosResolveTargetIds?: string[] }).keraunosResolveTargetIds;
      const mapK = (turn as TurnState & { keraunosAoeDamageMap?: Record<string, number> }).keraunosAoeDamageMap;
      const idxK = (turn as TurnState & { keraunosResolveIndex?: number }).keraunosResolveIndex ?? 0;
      const tidK = idsK?.length && mapK && idsK[idxK] ? idsK[idxK] : null;
      if (tidK) {
        const defK = findFighter(room, tidK) ?? defender;
        const mainIdK = (turn as TurnState & { keraunosMainTargetId?: string }).keraunosMainTargetId ?? turn.defenderId;
        const secK = (turn as TurnState & { keraunosSecondaryTargetIds?: string[] }).keraunosSecondaryTargetIds ?? [];
        const tier = keraunosTierForTargetId(mainIdK, secK, tidK);
        const casterDamageK = Math.max(0, attacker.damage + getStatModifier(activeEffects, turn.attackerId, MOD_STAT.DAMAGE));
        const hadShockK = activeEffects.some(e => e.targetId === tidK && e.tag === EFFECT_TAGS.SHOCK);
        const bases = [3, 2, 1] as const;
        const boltDmgK = bases[tier] * mult;
        const shockBonusK = hadShockK ? casterDamageK : 0;
        const dmgFromMap = mapK![tidK] ?? boltDmgK + shockBonusK;
        return {
          kind: BATTLE_PLAYBACK_KIND.MASTER,
          hitIndex: 0,
          attackerId: attacker.characterId,
          defenderId: defK.characterId,
          isHit: true,
          isPower: true,
          powerName: POWER_NAMES.KERAUNOS_VOLTAGE,
          isCrit: isCritK,
          baseDmg: boltDmgK,
          damage: dmgFromMap,
          shockBonus: Math.max(0, dmgFromMap - boltDmgK),
          atkRoll: 0,
          defRoll: 0,
          isDodged: false,
          coAttackHit: false,
          coAttackDamage: 0,
          attackerName: attacker.nicknameEng,
          attackerTheme: attacker.theme[0],
          defenderName: defK.nicknameEng,
          defenderTheme: defK.theme[0],
        };
      }
      const casterDamageK = Math.max(0, attacker.damage + getStatModifier(activeEffects, turn.attackerId, MOD_STAT.DAMAGE));
      const mainId = defender.characterId;
      const hadShock = activeEffects.some(e => e.targetId === mainId && e.tag === EFFECT_TAGS.SHOCK);
      shockBonus = hadShock ? casterDamageK : 0;
      damage = boltDmg + shockBonus;
    }
    if (isJoltArc) {
      const ids = (turn as any).joltArcTargetIds as string[] | undefined;
      const map = (turn as any).joltArcAoeDamageMap as Record<string, number> | undefined;
      const idx = (turn as any).joltArcResolveIndex ?? 0;
      const tid = ids?.[idx];
      const defJ = tid ? findFighter(room, tid) : null;
      const defenderJ = defJ ?? defender;
      const dmgJ = tid && map ? (map[tid] ?? 0) : 0;
      const casterBase = Math.max(0, attacker.damage + getStatModifier(activeEffects, turn.attackerId, MOD_STAT.DAMAGE));
      return {
        kind: BATTLE_PLAYBACK_KIND.MASTER,
        hitIndex: 0,
        attackerId: attacker.characterId,
        defenderId: defenderJ.characterId,
        isHit: true,
        isPower: true,
        powerName: POWER_NAMES.JOLT_ARC,
        isCrit: false,
        baseDmg: casterBase,
        damage: dmgJ,
        shockBonus: 0,
        atkRoll: 0,
        defRoll: 0,
        isDodged: false,
        coAttackHit: false,
        coAttackDamage: 0,
        attackerName: attacker.nicknameEng,
        attackerTheme: attacker.theme[0],
        defenderName: defenderJ.nicknameEng,
        defenderTheme: defenderJ.theme[0],
      };
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
    const hasLR = attacker.passiveSkillPoint === SKILL_UNLOCKED &&
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
    coAttackHit: false,
    coAttackDamage: 0,
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
    attackerName: sk.nicknameEng?.toLowerCase?.() || DEFAULT_NAMES.SKELETON,
    attackerTheme: sk.theme?.[0] || '#666',
    defenderName: defender?.nicknameEng || defenderId,
    defenderTheme: defender?.theme?.[0] || '#666',
    isMinionHit: true,
  };
}

/** Find the next alive fighter index in the queue (skips eliminated) */
export function nextAliveIndex(queue: TurnQueueEntry[], fromIndex: number, room: BattleRoom, effects?: ActiveEffect[]): { index: number; wrapped: boolean } {
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
export function isTeamEliminated(members: FighterState[], effects?: ActiveEffect[]): boolean {
  return members.every((m) => {
    if (m.currentHp > 0) return false;
    // Dead but has death-keeper → not truly eliminated
    if (effects?.some(e => e.targetId === m.characterId && e.tag === EFFECT_TAGS.DEATH_KEEPER)) return false;
    return true;
  });
}

/** Apply self-resurrect if next fighter is dead with death-keeper.
 *  Mutates `updates` and `effects` in place. Returns true if resurrection happened. */
export function applySelfResurrect(
  nextCharId: string,
  room: BattleRoom,
  effects: ActiveEffect[],
  updates: Record<string, unknown>,
  battle: { roundNumber: number; log: unknown[] },
): boolean {
  return HadesService.applySelfResurrect(
    nextCharId,
    room,
    effects,
    updates,
    battle,
    { findFighter, findFighterPath },
  );
}

/** Check and apply immediate auto-resurrection for Hades son (Death Keeper holder) when they die.
 *  Called immediately after damage is applied. Mutates `updates` and `effects` in place.
 *  Returns true if resurrection happened. */
function applyImmediateResurrection(
  characterId: string,
  room: BattleRoom,
  effects: ActiveEffect[],
  updates: Record<string, unknown>,
  battle: { roundNumber: number; log: unknown[] },
): boolean {
  return HadesService.applyImmediateResurrection(
    characterId,
    room,
    effects,
    updates,
    battle,
    { findFighter, findFighterPath, sanitizeBattleLog },
  );
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
  // The Aporrēta of Nymphaion: apply Efflorescence Muse for the first attacker before select action
  const nymphFirst = applyAporretaOfNymphaionPassive(room, first.characterId, battle, 0);
  const initialEffects = nymphFirst[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined;
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

  if (turn.action === TURN_ACTION.HEAL) {
    const attacker = findFighter(room, attackerId);
    const ally = findFighter(room, defenderId);
    if (!attacker || !ally) return;

    const allyHasHealingNullified = isHealingNullified(activeEffects, defenderId);
    if (allyHasHealingNullified) {
      await applyExperienceHealAndAdvance(room, battle, turn, attackerId, defenderId, false, true);
      return;
    }

    if (targetHasEfflorescenceMuse(activeEffects, attackerId)) {
      const baseCritRate = typeof attacker.criticalRate === 'number' ? attacker.criticalRate : 25;
      const critMod = getStatModifier(activeEffects, attackerId, MOD_STAT.CRITICAL_RATE);
      const healCritRate = Math.min(100, Math.max(0, baseCritRate + critMod));
      const winFaces = getWinningFaces(healCritRate);

      await update(roomRef(arenaId), {
        [ARENA_PATH.BATTLE_TURN]: {
          ...nullStaleFieldsForBlossomScentraHealTurn(),
          attackerId,
          attackerTeam: turn.attackerTeam,
          defenderId,
          allyTargetId: defenderId,
          phase: PHASE.ROLLING_EXPERIENCE_HEAL,
          action: TURN_ACTION.HEAL,
          usedPowerName: EXPERIENCE_HEAL_ACTION_LABEL,
          experienceHealWinFaces: winFaces,
        },
      });
      return;
    }

    await applyExperienceHealAndAdvance(room, battle, turn, attackerId, defenderId, false, false);
    return;
  }

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
      deductPowerQuotaIfPending(room, turn, attackerId, updates, turnUpdate);
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
    const atkTurnPending = updates[ARENA_PATH.BATTLE_TURN] as Record<string, unknown> | undefined;
    if (atkTurnPending?.phase === PHASE.ROLLING_ATTACK) {
      deductPowerQuotaIfPending(room, turn, attackerId, updates, atkTurnPending);
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
      deductPowerQuotaIfPending(room, turn, attackerId, updates, {});
      const poemUpdates = applyImprecatedPoem(room, attackerId, defenderId, selectedPoem, battle);
      Object.assign(updates, poemUpdates);

      const battleForTick = updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]
        ? { ...battle, activeEffects: updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] }
        : battle;
      const effectUpdates = await tickEffectsWithSkeletonBlock(arenaId, room, battleForTick, updates);
      Object.assign(updates, effectUpdates);

      // Eternal Agony: add display-only effect after tick (so tick doesn't remove it). Delete after 3 seconds
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
        nikeAwardedAfterWinTheFight(teamAMembers);
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
        nikeAwardedAfterWinTheFight(teamBMembers);
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
        const nymphSkip = applyAporretaOfNymphaionPassive(room, skipEntry.characterId, battleForSkip, 0);
        if (nymphSkip[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, nymphSkip);
        const battleForEfflorescenceMuseSkip = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
        const efflorescenceMuseSkipUpdates = onEfflorescenceMuseTurnStart(room, battleForEfflorescenceMuseSkip, skipEntry.characterId);
        if (efflorescenceMuseSkipUpdates) Object.assign(updates, efflorescenceMuseSkipUpdates);
        updates[ARENA_PATH.BATTLE_TURN] = { attackerId: skipEntry.characterId, attackerTeam: skipEntry.team, phase: PHASE.SELECT_ACTION };
      } else {
        updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
        updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
        const turnData: Record<string, unknown> = { attackerId: nextEntry.characterId, attackerTeam: nextEntry.team, phase: PHASE.SELECT_ACTION };
        if (selfRes) (turnData as Record<string, unknown>).resurrectTargetId = nextEntry.characterId;
        const battleForNymph = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
        const nymphNext = applyAporretaOfNymphaionPassive(room, nextEntry.characterId, battleForNymph, 0);
        if (nymphNext[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, nymphNext);
        const battleForEfflorescenceMuse = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
        const efflorescenceMuseUpdates = onEfflorescenceMuseTurnStart(room, battleForEfflorescenceMuse, nextEntry.characterId);
        if (efflorescenceMuseUpdates) Object.assign(updates, efflorescenceMuseUpdates);
        updates[ARENA_PATH.BATTLE_TURN] = turnData;
      }
      await update(roomRef(arenaId), updates);
      // Eternal Agony: put it in for 3 seconds then remove — delete effect tag ETERNAL_AGONY after 3 seconds
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
        const turnNimbus: Record<string, unknown> = { ...turn, defenderId, phase: PHASE.ROLLING_ATTACK };
        deductPowerQuotaIfPending(room, turn, attackerId, updates, turnNimbus);
        updates[ARENA_PATH.BATTLE_TURN] = turnNimbus;
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
      const turnSelfPow: Record<string, unknown> = { ...turn, defenderId, phase: PHASE.ROLLING_ATTACK };
      deductPowerQuotaIfPending(room, turn, attackerId, updates, turnSelfPow);
      updates[ARENA_PATH.BATTLE_TURN] = turnSelfPow;
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
        const turnJoltSel: Record<string, unknown> = {
          attackerId,
          attackerTeam: turn.attackerTeam,
          defenderId,
          phase: PHASE.RESOLVING,
          action: TURN_ACTION.POWER,
          usedPowerIndex: turn.usedPowerIndex,
          usedPowerName: power.name,
        };
        deductPowerQuotaIfPending(room, turn, attackerId, updates, turnJoltSel);
        updates[ARENA_PATH.BATTLE_TURN] = turnJoltSel;
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
        // Keraunos Voltage: 3 dmg ×1 (main); 2 dmg ×2 or ×1 if only one enemy left after main; 1 dmg to all other alive enemies (auto).
        const isTeamA = (room.teamA?.members || []).some(m => m.characterId === attackerId);
        const enemies = (isTeamA ? (room.teamB?.members || []) : (room.teamA?.members || [])).filter(e => e.currentHp > 0);
        const n = enemies.length;
        const step = effectiveKeraunosStep(turn);
        const mainId = turn.keraunosMainTargetId ?? turn.defenderId;
        const secondaries = turn.keraunosSecondaryTargetIds ?? [];
        const activeEffectsK = battle.activeEffects || [];
        const critBuffK = getStatModifier(activeEffectsK, attackerId, MOD_STAT.CRITICAL_RATE);
        const effectiveCritK = Math.max(attacker.criticalRate ?? 0, (attacker.criticalRate ?? 0) + critBuffK);
        const critRate = Math.min(100, Math.max(0, effectiveCritK + 25));

        const finishKeraunos = (): Record<string, unknown> => ({
          phase: PHASE.RESOLVING,
          critWinFaces: getWinningFaces(critRate),
          attackRoll: 0,
          defendRoll: 0,
          keraunosTargetStep: null,
        });

        if (step === 0) {
          if (n <= 0) return;
          const nextSecondaries: string[] = [];
          const needMore = n >= 2;
          const turnUpdate: Record<string, unknown> = {
            ...turn,
            defenderId,
            keraunosMainTargetId: defenderId,
            keraunosSecondaryTargetIds: nextSecondaries,
            keraunosTargetStep: needMore ? 1 : null,
          };
          if (!needMore) {
            Object.assign(turnUpdate, finishKeraunos());
          } else {
            turnUpdate.phase = PHASE.SELECT_TARGET;
          }
          updates[ARENA_PATH.BATTLE_TURN] = turnUpdate;
        } else if (step === 1) {
          if (n < 2) return;
          if (defenderId === mainId || secondaries.includes(defenderId)) return;
          let nextSecondaries = [...secondaries, defenderId];
          // ≥3 enemies: two manual 2-dmg targets, then auto 1-dmg to everyone else. Exactly 2 enemies: one 2-dmg pick only.
          const needSecondTwoDmgPick = n >= 3 && nextSecondaries.length < 2;
          if (needSecondTwoDmgPick) {
            updates[ARENA_PATH.BATTLE_TURN] = {
              ...turn,
              defenderId: mainId,
              keraunosMainTargetId: mainId,
              keraunosSecondaryTargetIds: nextSecondaries,
              keraunosTargetStep: 1,
              phase: PHASE.SELECT_TARGET,
            };
          } else {
            if (n >= 3) {
              const remaining = enemies
                .map(e => e.characterId)
                .filter(id => id !== mainId && !nextSecondaries.includes(id));
              nextSecondaries = [...nextSecondaries, ...remaining];
            }
            updates[ARENA_PATH.BATTLE_TURN] = {
              ...turn,
              defenderId: mainId,
              keraunosMainTargetId: mainId,
              keraunosSecondaryTargetIds: nextSecondaries,
              keraunosTargetStep: null,
              ...finishKeraunos(),
            };
          }
        } else {
          // Legacy step 2 (manual third pick): auto-append any enemies not yet in secondaries, then resolve
          if (n < 2) return;
          const mainLegacy = turn.keraunosMainTargetId ?? turn.defenderId;
          if (!mainLegacy) return;
          let secsLegacy = [...(turn.keraunosSecondaryTargetIds ?? [])];
          if (secsLegacy.length === 0 && defenderId && defenderId !== mainLegacy) secsLegacy = [defenderId];
          const remainingLegacy = enemies
            .map(e => e.characterId)
            .filter(id => id !== mainLegacy && !secsLegacy.includes(id));
          const merged = remainingLegacy.length > 0 ? [...secsLegacy, ...remainingLegacy] : secsLegacy;
          updates[ARENA_PATH.BATTLE_TURN] = {
            ...turn,
            defenderId: mainLegacy,
            keraunosMainTargetId: mainLegacy,
            keraunosSecondaryTargetIds: merged,
            keraunosTargetStep: null,
            ...finishKeraunos(),
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

      const pendingPowTurn = updates[ARENA_PATH.BATTLE_TURN] as Record<string, unknown> | undefined;
      if (pendingPowTurn?.phase === PHASE.RESOLVING || pendingPowTurn?.phase === PHASE.ROLLING_ATTACK) {
        deductPowerQuotaIfPending(room, turn, attackerId, updates, pendingPowTurn);
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
      deductPowerQuotaIfPending(room, turn, attackerId, updates, turnUpdate);
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
    const turnRollAtk: Record<string, unknown> = { ...turn, defenderId, phase: PHASE.ROLLING_ATTACK };
    deductPowerQuotaIfPending(room, turn, attackerId, updates, turnRollAtk);
    updates[ARENA_PATH.BATTLE_TURN] = turnRollAtk;
    await update(roomRef(arenaId), updates);
    return;
  }

  // Fallback: no action set
  await update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), {
    defenderId,
    phase: PHASE.ROLLING_ATTACK,
  });
}

/**
 * Keraunos Voltage: confirm both 2-damage targets in one step when ≥3 alive enemies (after main is chosen).
 */
export async function selectKeraunosTier2Batch(arenaId: string, defenderIds: string[]): Promise<void> {
  return ZeusService.selectKeraunosTier2Batch(arenaId, defenderIds, {
    roomRef,
    findFighter,
    deductPowerQuotaIfPending,
    getWinningFaces,
  });
}

/* ── select action (attack or use power) ─────────────── */

export async function selectAction(
  arenaId: string,
  action: TurnAction,
  powerIndex?: number,
  allyTargetId?: string,
): Promise<void> {
  if (action === TURN_ACTION.HEAL) {
    const snap = await get(roomRef(arenaId));
    if (!snap.exists()) return;
    const room = snap.val() as BattleRoom;
    const battle = room.battle;
    if (!battle?.turn) return;

    await update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), {
      ...battle.turn,
      action: TURN_ACTION.HEAL,
      usedPowerIndex: null,
      usedPowerName: EXPERIENCE_HEAL_ACTION_LABEL,
      allyTargetId: null,
      defenderId: null,
      phase: PHASE.SELECT_TARGET,
    });
    return;
  }

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
  if (!battle?.turn) return;

  let effectivePowerIndex = powerIndex ?? (battle.turn.usedPowerIndex as number | undefined);
  if (effectivePowerIndex == null) return;

  const { attackerId } = battle.turn;

  const attacker = findFighter(room, attackerId);
  if (!attacker) return;

  let power = attacker.powers?.[effectivePowerIndex];
  const turnPowerName = battle.turn.usedPowerName;
  if (turnPowerName && power?.name !== turnPowerName) {
    const byName = attacker.powers?.findIndex(p => p.name === turnPowerName) ?? -1;
    if (byName >= 0) {
      effectivePowerIndex = byName;
      power = attacker.powers[effectivePowerIndex];
    }
  }
  if (!power) return;

  const cost = getQuotaCost(power.type);
  if (attacker.quota < cost) return; // insufficient quota

  const updates: Record<string, unknown> = {};

  // Soul Devourer: Use Power that cannot attack → end turn (no quota spent; resolveTurn will advance)
  // Exceptions: Shadow Camouflaging (D4 refill flow); Undead Army (must apply to add 2nd skeleton)
  if (hasSoulDevourerEffect(battle.activeEffects || [], attackerId) && !powerCanAttack(power) && power.name !== POWER_NAMES.SHADOW_CAMOUFLAGING && power.name !== POWER_NAMES.UNDEAD_ARMY) {
    updates[ARENA_PATH.BATTLE_TURN] = {
      attackerId,
      attackerTeam: battle.turn.attackerTeam,
      phase: PHASE.RESOLVING,
      action: TURN_ACTION.POWER,
      usedPowerIndex: effectivePowerIndex,
      usedPowerName: power.name,
      soulDevourerEndTurnOnly: true,
    };
    await update(roomRef(arenaId), updates);
    return;
  }

  // ── Season selection power (e.g. Persephone's Ephemeral Season): go to season selection ──
  // Also check canonical definition so rooms created before the flag was added still work
  const canonicalPower = getPowers(attacker.deityBlood)?.find(p => p.name === power.name);
  if (power.requiresSeasonSelection || canonicalPower?.requiresSeasonSelection) {
    updates[ARENA_PATH.BATTLE_TURN] = {
      attackerId,
      attackerTeam: battle.turn.attackerTeam,
      phase: PHASE.SELECT_SEASON,
      action: TURN_ACTION.POWER,
      usedPowerIndex: effectivePowerIndex,
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
      usedPowerIndex: effectivePowerIndex,
      usedPowerName: power.name,
    };
    await update(roomRef(arenaId), updates);
    return;
  }

  // ── Ally-targeting power: step 1 — choose ally (quota deferred until confirm) ──
  if (power.target === TARGET_TYPES.ALLY && !allyTargetId) {
    const turnPayload: Record<string, unknown> = {
      attackerId,
      attackerTeam: battle.turn.attackerTeam,
      phase: PHASE.SELECT_TARGET,
      action: TURN_ACTION.POWER,
      usedPowerIndex: effectivePowerIndex,
      usedPowerName: power.name,
      allyTargetId: null,
    };
    const activeEffectsForDisoriented = battle.activeEffects || [];
    const hasDisorientedPower = activeEffectsForDisoriented.some(e => e.targetId === attackerId && e.tag === EFFECT_TAGS.DISORIENTED);
    if (hasDisorientedPower) {
      const validIds = getValidTargetIds(room, { ...battle.turn, ...turnPayload } as BattleState["turn"], activeEffectsForDisoriented);
      if (validIds.length === 0) {
        updates[ARENA_PATH.BATTLE_TURN] = turnPayload;
        await update(roomRef(arenaId), updates);
        await skipTurnNoValidTarget(arenaId, { skipQuotaRefund: true });
        return;
      }
    }
    updates[ARENA_PATH.BATTLE_TURN] = turnPayload;
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
        effectType: EFFECT_TYPES.BUFF,
        sourceId: attackerId,
        targetId: allyTargetId,
        value: 0,
        turnsRemaining: 999,
        tag: EFFECT_TAGS.RESURRECTED,
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

    // ── Apollo's Hymn: heal chosen ally 2 HP once; +25% crit on caster + target 2 rounds (no stack), then end turn ──
    if (power.name === POWER_NAMES.APOLLO_S_HYMN) {
      const hymnQuotaPatch: Record<string, unknown> = {};
      deductPowerQuotaIfPending(room, battle.turn, attackerId, updates, hymnQuotaPatch);
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
        nikeAwardedAfterWinTheFight(teamAMembers);
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
        nikeAwardedAfterWinTheFight(teamBMembers);
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
        const nymphSkip = applyAporretaOfNymphaionPassive(room, skipEntry.characterId, battleForSkip, 0);
        if (nymphSkip[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, nymphSkip);
        const battleForEfflorescenceMuseSkip = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
        const efflorescenceMuseSkipUpdates = onEfflorescenceMuseTurnStart(room, battleForEfflorescenceMuseSkip, skipEntry.characterId);
        if (efflorescenceMuseSkipUpdates) Object.assign(updates, efflorescenceMuseSkipUpdates);
        updates[ARENA_PATH.BATTLE_TURN] = { attackerId: skipEntry.characterId, attackerTeam: skipEntry.team, phase: PHASE.SELECT_ACTION };
      } else {
        updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
        updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
        const turnData: Record<string, unknown> = { attackerId: nextEntry.characterId, attackerTeam: nextEntry.team, phase: PHASE.SELECT_ACTION };
        if (selfResHymn) (turnData as Record<string, unknown>).resurrectTargetId = nextEntry.characterId;
        const battleForNymph = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
        const nymphNext = applyAporretaOfNymphaionPassive(room, nextEntry.characterId, battleForNymph, 0);
        if (nymphNext[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, nymphNext);
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
      const pendingTurnPom: Record<string, unknown> = {};
      deductPowerQuotaIfPending(room, battle.turn, attackerId, updates, pendingTurnPom, effectivePowerIndex);
      const oathUpdates = applyPomegranateOath(room, attackerId, allyTargetId, battle);
      Object.assign(updates, oathUpdates);

      // Sync activeEffects into battle fo
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
        nikeAwardedAfterWinTheFight(teamAMembers);
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
        nikeAwardedAfterWinTheFight(teamBMembers);
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
        updates[ARENA_PATH.BATTLE_TURN] = {
          attackerId: skipEntry.characterId,
          attackerTeam: skipEntry.team,
          phase: PHASE.SELECT_ACTION,
          ...clearStaleTurnFieldsForNewSelectAction(),
        };
        const battleForNymphS1 = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
        const d1 = applyAporretaOfNymphaionPassive(room, skipEntry.characterId, battleForNymphS1, 0);
        if (d1[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, d1);
      } else {
        updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
        updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
        const turnData: Record<string, unknown> = {
          attackerId: nextEntry.characterId,
          attackerTeam: nextEntry.team,
          phase: PHASE.SELECT_ACTION,
          ...clearStaleTurnFieldsForNewSelectAction(),
          ...(selfRes1 ? { resurrectTargetId: nextEntry.characterId } : {}),
        };
        updates[ARENA_PATH.BATTLE_TURN] = turnData;
        const battleForNymphN1 = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
        const d2 = applyAporretaOfNymphaionPassive(room, nextEntry.characterId, battleForNymphN1, 0);
        if (d2[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, d2);
      }

      await update(roomRef(arenaId), updates);
      return;
    }

    // ── Blossom Scentra: always roll D4 for heal crit (player & NPC), unless Healing Nullified ──
    const ally = findFighter(room, allyTargetId);
    const attacker = findFighter(room, attackerId);
    const allyHasHealingNullified = isHealingNullified(battle.activeEffects || [], allyTargetId);

    // Heal skipped (e.g. Healing Nullified): show modal, wait for caster to ack, then log heal 0 and advance — no D4 roll.
    if (power.name === POWER_NAMES.BLOSSOM_SCENTRA && allyHasHealingNullified && ally && attacker) {
      const turnBlossomScentraSkip: Record<string, unknown> = {
        attackerId,
        attackerTeam: battle.turn.attackerTeam,
        phase: PHASE.ROLLING_BLOSSOM_SCENTRA_HEAL,
        action: TURN_ACTION.POWER,
        usedPowerIndex: effectivePowerIndex,
        usedPowerName: power.name,
        allyTargetId,
        blossomHealSkipped: true,
        healSkipReason: EFFECT_TAGS.HEALING_NULLIFIED,
      };
      deductPowerQuotaIfPending(room, battle.turn, attackerId, updates, turnBlossomScentraSkip);
      updates[ARENA_PATH.BATTLE_TURN] = turnBlossomScentraSkip;
      await update(roomRef(arenaId), updates);
      return;
    }

    // Blossom Scentra: always show D4 roll for heal crit (use target's crit rate)
    if (power.name === POWER_NAMES.BLOSSOM_SCENTRA && ally && attacker) {
      // Heal crit rate = caster's current critical rate (base + buffs/debuffs)
      const baseCritRate = typeof attacker.criticalRate === 'number' ? attacker.criticalRate : 25;
      const critMod = getStatModifier(battle.activeEffects || [], attackerId, MOD_STAT.CRITICAL_RATE);
      const healCritRate = Math.min(100, Math.max(0, baseCritRate + critMod));
      const winFaces = getWinningFaces(healCritRate);
      const turnBlossomScentraD4: Record<string, unknown> = {
        ...nullStaleFieldsForBlossomScentraHealTurn(),
        attackerId,
        attackerTeam: battle.turn.attackerTeam,
        phase: PHASE.ROLLING_BLOSSOM_SCENTRA_HEAL,
        action: TURN_ACTION.POWER,
        usedPowerIndex: effectivePowerIndex,
        usedPowerName: power.name,
        allyTargetId,
        blossomHealWinFaces: winFaces,
      };
      deductPowerQuotaIfPending(room, battle.turn, attackerId, updates, turnBlossomScentraD4);
      updates[ARENA_PATH.BATTLE_TURN] = turnBlossomScentraD4;
      await update(roomRef(arenaId), updates);
      return;
    }
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
      if (!attacker) return;
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
      usedPowerIndex: effectivePowerIndex,
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
    if (attacker) {
      const undeadArmyPower = attacker.powers?.find(p => p.name === POWER_NAMES.UNDEAD_ARMY);
      if (undeadArmyPower) {
        const battleWithSoul = { ...battle, activeEffects: newEffects };
        const uaUpdates = applyPowerEffect(room, attackerId, attackerId, undeadArmyPower, battleWithSoul);
        Object.assign(updates, uaUpdates);
      }
    }

    // Log using Soul Devourer after confirm, before going to select target
    const soulDevourerConfirmLog = {
      round: battle.roundNumber,
      attackerId,
      defenderId: attackerId,
      attackRoll: 0,
      defendRoll: 0,
      damage: 0,
      defenderHpAfter: attacker?.currentHp ?? 0,
      eliminated: false,
      missed: false,
      powerUsed: power.name,
      pendingTarget: true,
    };
    updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([...(battle.log || []), soulDevourerConfirmLog]);

    // Deduct quota now (Ultimate costs 3)
    const soulDevourerQuotaPatch: Record<string, unknown> = {};
    deductPowerQuotaIfPending(room, battle.turn, attackerId, updates, soulDevourerQuotaPatch, effectivePowerIndex);

    // Then go to select target
    updates[ARENA_PATH.BATTLE_TURN] = {
      attackerId,
      attackerTeam: battle.turn.attackerTeam,
      phase: PHASE.SELECT_TARGET,
      action: TURN_ACTION.ATTACK, // immediate attack (skeleton can assist)
      usedPowerIndex: effectivePowerIndex,
      usedPowerName: power.name,
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
      const turnShadow: Record<string, unknown> = {
        attackerId,
        attackerTeam: battle.turn!.attackerTeam,
        defenderId: attackerId,
        phase: PHASE.RESOLVING,
        action: TURN_ACTION.POWER,
        usedPowerIndex: effectivePowerIndex,
        usedPowerName: power.name,
        shadowCamouflageRefillWinFaces: winFaces,
      };
      deductPowerQuotaIfPending(room, battle.turn, attackerId, updates, turnShadow, effectivePowerIndex);
      updates[ARENA_PATH.BATTLE_TURN] = turnShadow;
      updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
      updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
      await update(roomRef(arenaId), updates);
      return;
    }

    const pendingSkipSelf: Record<string, unknown> = {};
    deductPowerQuotaIfPending(room, battle.turn, attackerId, updates, pendingSkipSelf, effectivePowerIndex);

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
      nikeAwardedAfterWinTheFight(teamAMembers);
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
      nikeAwardedAfterWinTheFight(teamBMembers);
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
    const turnJolt: Record<string, unknown> = {
      attackerId,
      attackerTeam: battle.turn.attackerTeam,
      defenderId: primaryDefenderId,
      phase: PHASE.RESOLVING,
      action: TURN_ACTION.POWER,
      usedPowerIndex: effectivePowerIndex,
      usedPowerName: power.name,
    };
    deductPowerQuotaIfPending(room, battle.turn, attackerId, updates, turnJolt, effectivePowerIndex);
    updates[ARENA_PATH.BATTLE_TURN] = turnJolt;
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
        effectivePowerIndex,
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
      usedPowerIndex: effectivePowerIndex,
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
    usedPowerIndex: effectivePowerIndex,
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
  return PersephoneService.selectSeason(arenaId, season, {
    roomRef,
  });
}

/* ── confirm poem verse (Imprecated Poem): store selection and go to select target ─── */

export async function confirmPoem(arenaId: string, poemTag: string): Promise<void> {
  return ApolloService.confirmPoem(arenaId, poemTag, {
    roomRef,
  });
}

/* ── cancel season selection: refund quota and go back to select-action ─── */

export async function cancelSeasonSelection(arenaId: string): Promise<void> {
  return PersephoneService.cancelSeasonSelection(arenaId, {
    roomRef,
    findFighter,
    findFighterPath,
  });
}

/* ── cancel poem selection: refund quota and go back to select-action ─── */

export async function cancelPoemSelection(arenaId: string): Promise<void> {
  return ApolloService.cancelPoemSelection(arenaId, {
    roomRef,
    findFighter,
    findFighterPath,
  });
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

  // Keraunos Voltage: back from 2nd 2-dmg pick → 1st 2-dmg; from 1st 2-dmg → main; from main → power selector
  if (usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE && !battle.turn.keraunosAwaitingCrit) {
    const mainK = battle.turn.keraunosMainTargetId;
    const secsK = battle.turn.keraunosSecondaryTargetIds ?? [];
    if (mainK && secsK.length === 1) {
      updates[ARENA_PATH.BATTLE_TURN] = {
        ...battle.turn,
        defenderId: mainK,
        visualDefenderId: null,
        keraunosSecondaryTargetIds: null,
      };
      await update(roomRef(arenaId), updates);
      return;
    }
    if (mainK && secsK.length === 0) {
      updates[ARENA_PATH.BATTLE_TURN] = {
        ...battle.turn,
        defenderId: null,
        visualDefenderId: null,
        keraunosMainTargetId: null,
        keraunosSecondaryTargetIds: null,
        keraunosTargetStep: 0,
      };
      await update(roomRef(arenaId), updates);
      return;
    }
  }

  // Refund quota if a power was selected (ally-target step 1 defers quota until ally confirm — do not refund)
  const cancelPower = usedPowerIndex != null ? attacker.powers?.[usedPowerIndex as number] : undefined;
  const allyPickOnly =
    action === TURN_ACTION.POWER &&
    usedPowerIndex != null &&
    cancelPower?.target === TARGET_TYPES.ALLY &&
    !(battle.turn as { allyTargetId?: string | null }).allyTargetId;
  if (battle.turn.powerQuotaApplied && action === TURN_ACTION.POWER && usedPowerIndex != null && !allyPickOnly) {
    const power = attacker.powers?.[usedPowerIndex as number];
    const cost = power ? getQuotaCost(power.type) : 1;
    const atkPath = findFighterPath(room, attackerId);
    if (atkPath) updates[`${atkPath}/quota`] = attacker.quota + cost;
  }

  // Rapid Fire (Volley Arrow) is only appended when target is confirmed (in resolveTurn).
  // On Back from choose target, remove any RAPID_FIRE effect on this attacker so the pip disappears.
  const activeEffects = battle.activeEffects || [];
  const withoutRapidFire = activeEffects.filter(
    (e: ActiveEffect) => !(e.targetId === attackerId && e.tag === EFFECT_TAGS.RAPID_FIRE)
  );
  if (withoutRapidFire.length !== activeEffects.length) {
    updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = withoutRapidFire;
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

/**
 * For Keraunos Voltage + Disoriented: random main; two random 2-dmg targets if ≥3 enemies alive else one; rest get 1 dmg each.
 */
function pickKeraunosRandomTargets(validIds: string[]): { mainId: string; secondaryIds: string[] } {
  const mainId = validIds[Math.floor(Math.random() * validIds.length)];
  const rest = validIds.filter(id => id !== mainId);
  if (rest.length === 0) return { mainId, secondaryIds: [] };
  if (rest.length === 1) return { mainId, secondaryIds: [rest[0]] };
  const i1 = Math.floor(Math.random() * rest.length);
  const s1 = rest[i1];
  const rest2 = rest.filter(id => id !== s1);
  const s2 = rest2[Math.floor(Math.random() * rest2.length)];
  const afterTwo = rest2.filter(id => id !== s2);
  return { mainId, secondaryIds: [s1, s2, ...afterTwo] };
}

/**
 * Disoriented: server picks a random valid target and runs the 25% fail check.
 * For Keraunos Voltage: picks random main + two random 2-dmg targets when possible + auto 1-dmg to any others.
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
  return ApolloService.advanceAfterDisorientedD4(arenaId, {
    roomRef,
    findFighter,
    findFighterPath,
    findFighterTeam,
    sanitizeBattleLog,
    tickEffectsWithSkeletonBlock,
    isTeamEliminated,
    buildTurnQueue,
    nextAliveIndex,
    applySelfResurrect,
  });
}

/**
 * Skip current turn because attacker has no valid target (e.g. all enemies under Shadow Camouflage).
 * Call when phase is SELECT_TARGET and no enemy can be targeted. Logs the skip reason, refunds quota if power was selected, then advances to next attacker.
 */
export async function skipTurnNoValidTarget(
  arenaId: string,
  opts?: { skipQuotaRefund?: boolean },
): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle?.turn || battle.turn.phase !== PHASE.SELECT_TARGET) return;

  const turn = battle.turn;
  const { attackerId, action, usedPowerIndex } = turn;
  const attacker = findFighter(room, attackerId);
  if (!attacker) return;

  const updates: Record<string, unknown> = {};

  // Refund quota if a power was selected and quota was already deducted (ally pick step 1 never deducts).
  if (!opts?.skipQuotaRefund && turn.powerQuotaApplied && action === TURN_ACTION.POWER && usedPowerIndex != null) {
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
    skipReason: POWER_NAMES.SHADOW_CAMOUFLAGING,
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
    nikeAwardedAfterWinTheFight(teamAMembers);
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
    nikeAwardedAfterWinTheFight(teamBMembers);
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
  return HadesService.advanceAfterShadowCamouflageD4(arenaId, {
    roomRef,
    findFighter,
    findFighterPath,
    buildTurnQueue,
    nextAliveIndex,
    isTeamEliminated,
    applySelfResurrect,
  });
}

/**
 * Advance after caster acknowledges "heal skipped" (e.g. Blossom Scentra on target with Healing Nullified).
 * Writes log entry with heal: 0, healSkipReason, then advances to SELECT_TARGET.
 */
export async function advanceAfterBlossomScentraHealSkippedAck(arenaId: string): Promise<void> {
  return PersephoneService.advanceAfterBlossomScentraHealSkippedAck(arenaId, {
    roomRef,
    findFighter,
    sanitizeBattleLog,
  });
}

/**
 * Advance after caster acknowledges Soul Devourer "heal skipped" (e.g. caster has Healing Nullified).
 * Clears soulDevourerHealSkipAwaitsAck so skeleton hits can start on next resolveTurn.
 */
export async function advanceAfterSoulDevourerHealSkippedAck(arenaId: string): Promise<void> {
  return HadesService.advanceAfterSoulDevourerHealSkippedAck(arenaId, { roomRef });
}

/**
 * After Nemesis retaliation card plays, apply the 1-damage reattack and resume the existing resolve flow.
 * Main-hit Nemesis resumes through resolveTurn() directly; co-attack Nemesis sets pomegranateCoTailReady so the
 * existing co-tail branch can finish the turn after the retaliation lands.
 */
export async function advanceAfterNemesisReattack(arenaId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  const turn = battle?.turn;
  if (!turn || turn.phase !== PHASE.NEMESIS_WISH_BLESSING_REATTACK) return;

  const sourceId = (turn as { nemesisReattackSourceId?: string | null }).nemesisReattackSourceId;
  const targetId = (turn as { nemesisReattackTargetId?: string | null }).nemesisReattackTargetId;
  if (!sourceId || !targetId) return;

  const source = findFighter(room, sourceId);
  const target = findFighter(room, targetId);
  if (!source || !target) return;

  const updates: Record<string, unknown> = {};
  const rawDmg = Math.max(1, Number((turn as { nemesisReattackDamage?: number | null }).nemesisReattackDamage) || 1);
  const targetPath = findFighterPath(room, targetId);
  const defendableTarget = { ...target, currentHp: target.currentHp };
  const resolveNemesis = await resolveHitAtDefender(arenaId, room, targetId, rawDmg, updates, defendableTarget);
  if (resolveNemesis.skippedMinionsPath) delete updates[resolveNemesis.skippedMinionsPath];
  const damageToMaster = resolveNemesis.damageToMaster;
  const targetHpBefore = target.currentHp;

  let shieldRemaining = damageToMaster;
  const activeEffects = battle.activeEffects || [];
  const effectsForShield = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? [...activeEffects];
  for (const se of effectsForShield) {
    if (se.targetId !== targetId || se.effectType !== EFFECT_TYPES.SHIELD) continue;
    if (shieldRemaining <= 0) break;
    const absorbed = Math.min(se.value, shieldRemaining);
    se.value -= absorbed;
    shieldRemaining -= absorbed;
  }

  const dmgToApply = Math.max(0, shieldRemaining);
  const cleanedEffects = effectsForShield.filter(
    (e: ActiveEffect) => !(e.effectType === EFFECT_TYPES.SHIELD && e.value <= 0 && !e.tag),
  );
  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = cleanedEffects;
  if (targetPath) {
    updates[`${targetPath}/currentHp`] = Math.max(0, targetHpBefore - dmgToApply);
  }

  const targetHpAfter = targetPath ? (updates[`${targetPath}/currentHp`] as number | undefined) ?? targetHpBefore : targetHpBefore;
  const battleLog = [...(battle.log || [])];
  battleLog.push({
    round: battle.roundNumber,
    attackerId: sourceId,
    defenderId: targetId,
    attackerName: source.nicknameEng,
    attackerTheme: source.theme?.[0],
    defenderName: target.nicknameEng,
    defenderTheme: target.theme?.[0],
    attackRoll: 0,
    defendRoll: 0,
    damage: dmgToApply,
    defenderHpAfter: targetHpAfter,
    eliminated: targetHpAfter <= 0,
    missed: false,
    powerUsed: NEMESIS_RETALIATION,
    isNemesisReattack: true,
    nemesisReattackSourceId: sourceId,
    nemesisReattackTargetId: targetId,
    hitTargetId: resolveNemesis.hitTargetId,
    ...(dmgToApply === 0 ? { blockedByShield: true } : {}),
  } as any);
  updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog(battleLog);
  if (targetHpAfter <= 0) {
    updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
    updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = targetId;
  }

  // Check for team elimination before advancing turn
  const getHp = (m: FighterState) => {
    const path = findFighterPath(room, m.characterId);
    if (path && `${path}/currentHp` in updates) return updates[`${path}/currentHp`] as number;
    return m.currentHp;
  };
  const teamAMembers = (room.teamA?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
  const teamBMembers = (room.teamB?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));

  const sourceTeam = findFighterTeam(room, sourceId);
  const END_ARENA_DELAY_MS = 3500;
  if (isTeamEliminated(teamBMembers, cleanedEffects)) {
    updates[ARENA_PATH.BATTLE_TURN] = { attackerId: sourceId, attackerTeam: sourceTeam, phase: PHASE.DONE };
    updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
    nikeAwardedAfterWinTheFight(teamAMembers);
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
  if (isTeamEliminated(teamAMembers, cleanedEffects)) {
    updates[ARENA_PATH.BATTLE_TURN] = { attackerId: sourceId, attackerTeam: sourceTeam, phase: PHASE.DONE };
    updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
    nikeAwardedAfterWinTheFight(teamBMembers);
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

  // Advance to next attacker instead of returning to resolve.
  // Build updated room + queue, then pick the next alive attacker.
  const latestEffects = cleanedEffects;
  const updatedRoom = {
    ...room,
    teamA: { ...room.teamA, members: teamAMembers },
    teamB: { ...room.teamB, members: teamBMembers },
  } as BattleRoom;
  const updatedQueue = buildTurnQueue(updatedRoom, latestEffects);
  updates[ARENA_PATH.BATTLE_TURN_QUEUE] = updatedQueue;

  // If there's an active Rapid Fire effect, return to that attacker instead of the natural next
  const rapidEff = latestEffects.find((e: ActiveEffect) => e.tag === EFFECT_TAGS.RAPID_FIRE && e.targetId);
  const currentAttackerIdx = updatedQueue.findIndex(e => e.characterId === turn.attackerId);
  const fromIdx = currentAttackerIdx !== -1 ? currentAttackerIdx : (battle.currentTurnIndex as number);

  if (rapidEff && rapidEff.targetId) {
    const rapidIdx = updatedQueue.findIndex(e => e.characterId === rapidEff.targetId);
    if (rapidIdx !== -1) {
      updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = rapidIdx;
      updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = battle.roundNumber;
      // Apply The Aporrēta of Nymphaion / Efflorescence Muse for the rapid fire attacker
      const battleForNymphRapid = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
      const nymphRapid = applyAporretaOfNymphaionPassive(room, rapidEff.targetId, battleForNymphRapid, 0);
      if (nymphRapid[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, nymphRapid);
      const efflorescenceRapid = onEfflorescenceMuseTurnStart(room, battleForNymphRapid, rapidEff.targetId);
      if (efflorescenceRapid) Object.assign(updates, efflorescenceRapid);

      updates[ARENA_PATH.BATTLE_TURN] = {
        attackerId: rapidEff.targetId,
        attackerTeam: updatedQueue[rapidIdx].team,
        phase: PHASE.SELECT_ACTION,
        nemesisReattackSourceId: null,
        nemesisReattackTargetId: null,
        nemesisReattackDamage: null,
        nemesisReattackFromCoAttack: null,
      };
      updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
      updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
      updates[ARENA_PATH.BATTLE_LAST_SKELETON_HITS] = null;
      await update(roomRef(arenaId), updates);
      return;
    }
  }

  const { index: nextIdx, wrapped } = nextAliveIndex(updatedQueue, fromIdx, updatedRoom, latestEffects);
  const nextEntry = updatedQueue[nextIdx];
  const selfRes = applySelfResurrect(nextEntry.characterId, updatedRoom, latestEffects, updates, battle);
  const nextFighter = findFighter(updatedRoom, nextEntry.characterId);

  if (nextFighter && !selfRes && isStunned(latestEffects, nextEntry.characterId)) {
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
    const afterStunRoom = { ...updatedRoom };
    const { index: skipIdx, wrapped: skipWrapped } = nextAliveIndex(updatedQueue, nextIdx, afterStunRoom, latestEffects);
    const skipEntry = updatedQueue[skipIdx];
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdx;
    if (skipWrapped) updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = (updates[ARENA_PATH.BATTLE_ROUND_NUMBER] as number || battle.roundNumber) + 1;
    // Apply The Aporrēta of Nymphaion / Efflorescence Muse for the skip-entry attacker
    const battleForNymphSkip = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
    const nymphSkip = applyAporretaOfNymphaionPassive(room, skipEntry.characterId, battleForNymphSkip, 0);
    if (nymphSkip[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, nymphSkip);
    const efflorescenceSkip = onEfflorescenceMuseTurnStart(room, battleForNymphSkip, skipEntry.characterId);
    if (efflorescenceSkip) Object.assign(updates, efflorescenceSkip);

    updates[ARENA_PATH.BATTLE_TURN] = {
      attackerId: skipEntry.characterId,
      attackerTeam: skipEntry.team,
      phase: PHASE.SELECT_ACTION,
      nemesisReattackSourceId: null,
      nemesisReattackTargetId: null,
      nemesisReattackDamage: null,
      nemesisReattackFromCoAttack: null,
    };
  } else {
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
    const turnData: Record<string, unknown> = {
      attackerId: nextEntry.characterId,
      attackerTeam: nextEntry.team,
      phase: PHASE.SELECT_ACTION,
      nemesisReattackSourceId: null,
      nemesisReattackTargetId: null,
      nemesisReattackDamage: null,
      nemesisReattackFromCoAttack: null,
    };
    if (selfRes) turnData.resurrectTargetId = nextEntry.characterId;
    // Apply The Aporrēta of Nymphaion / Efflorescence Muse for the next-entry attacker
    const battleForNymphNext = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
    const nymphNext = applyAporretaOfNymphaionPassive(room, nextEntry.characterId, battleForNymphNext, 0);
    if (nymphNext[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, nymphNext);
    const efflorescenceNext = onEfflorescenceMuseTurnStart(room, battleForNymphNext, nextEntry.characterId);
    if (efflorescenceNext) Object.assign(updates, efflorescenceNext);

    updates[ARENA_PATH.BATTLE_TURN] = turnData;
  }

  updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
  updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = null;
  updates[ARENA_PATH.BATTLE_LAST_SKELETON_HITS] = null;

  await update(roomRef(arenaId), updates);
}

/** Shared tail after Pomegranate co resolves or co is skipped (Rapid Fire chain, skeleton playback, or runBattleResolveTailFromEffectSync). */
async function runDeferredPomegranateTail(
  arenaId: string,
  room: BattleRoom,
  battle: BattleState,
  attacker: FighterState,
  defender: FighterState,
  clearedTurn: TurnState,
  ctx: NonNullable<TurnState['pomegranateDeferredCtx']>,
  updates: Record<string, unknown>,
  activeEffectsBaseline: ActiveEffect[],
): Promise<void> {
  const { attackerId, defenderId, attackRoll = 0, defendRoll = 0, action } = clearedTurn;
  if (!attackerId || !defenderId) return;

  // Clean up any undefined properties to prevent Firebase errors
  if ((clearedTurn as any).immediateResurrections === undefined) {
    delete (clearedTurn as any).immediateResurrections;
  }

  updates[ARENA_PATH.BATTLE_TURN] = clearedTurn;

  if (ctx.attackerHasRapidFire && ctx.baseDmg > 0) {
    if (ctx.defenderHpAfter > 0) {
      const rapidFireWinFacesFirst = [2, 3, 4];
      const turnForRapidFire: Record<string, unknown> = {
        ...clearedTurn,
        phase: PHASE.ROLLING_RAPID_FIRE_EXTRA_SHOT,
        rapidFireStep: 0,
        rapidFireWinFaces: rapidFireWinFacesFirst,
        rapidFireBaseDmg: ctx.baseDmg,
        rapidFireIsCrit: !!ctx.isCrit,
        rapidFireDefTotal: ctx.defTotal,
      };
      // Preserve immediateResurrections if set
      if ((clearedTurn as any).immediateResurrections) {
        turnForRapidFire.immediateResurrections = (clearedTurn as any).immediateResurrections;
      } else {
        // Explicitly ensure no undefined value
        delete turnForRapidFire.immediateResurrections;
      }
      updates[ARENA_PATH.BATTLE_TURN] = turnForRapidFire;
      await update(roomRef(arenaId), updates);
      return;
    } else {
      // Defender eliminated by main hit: show "Rapid Fire skipped" modal
      const turnForRapidFireSkip: Record<string, unknown> = {
        ...clearedTurn,
        phase: PHASE.RESOLVING,
        rapidFireSkippedAwaitsAck: true,
        rapidFireBaseDmg: ctx.baseDmg,
        rapidFireIsCrit: !!ctx.isCrit,
        rapidFireDefTotal: ctx.defTotal,
      };
      // Preserve immediateResurrections if set
      if ((clearedTurn as any).immediateResurrections) {
        turnForRapidFireSkip.immediateResurrections = (clearedTurn as any).immediateResurrections;
      } else {
        // Explicitly ensure no undefined value
        delete turnForRapidFireSkip.immediateResurrections;
      }
      updates[ARENA_PATH.BATTLE_TURN] = turnForRapidFireSkip;
      await update(roomRef(arenaId), updates);
      return;
    }
  }

  let skeletonsForAttack: any[] = [];
  const attackerTeam = findFighterTeam(room, attackerId);
  if (attackerTeam) {
    const minions = room[attackerTeam]?.minions || [];
    skeletonsForAttack = minions.filter((m: any) => m.masterId === attackerId);
  }
  if (!ctx.isDodged && ctx.hit && skeletonsForAttack.length > 0) {
    const defPath = findFighterPath(room, defenderId);
    const defenderHpAfterMain = defPath ? (updates[`${defPath}/currentHp`] as number | undefined) ?? defender.currentHp : defender.currentHp;
    if (defenderHpAfterMain > 0) {
      const battleForStep = { ...battle, turn: clearedTurn };
      const turnForSkeleton: Record<string, unknown> = {
        ...clearedTurn,
        resolvingHitIndex: 1,
        playbackStep: buildMinionPlaybackStep(room, battleForStep, attackerId, defenderId, 1),
      };
      // Preserve immediateResurrections if set
      if ((clearedTurn as any).immediateResurrections) {
        turnForSkeleton.immediateResurrections = (clearedTurn as any).immediateResurrections;
      } else {
        // Explicitly ensure no undefined value
        delete turnForSkeleton.immediateResurrections;
      }
      updates[ARENA_PATH.BATTLE_TURN] = turnForSkeleton;
      await update(roomRef(arenaId), updates);
      return;
    }
  }

  // No Rapid Fire or skeletons - check if defender is actually dead in the room
  // (ctx.defenderHpAfter might be stale if defender was resurrected and updates were already written)
  const defPath = findFighterPath(room, defenderId);
  const currentDefenderHp = defPath ? (updates[`${defPath}/currentHp`] as number | undefined) ?? defender.currentHp : defender.currentHp;

  if (currentDefenderHp <= 0) {
    // Defender is truly dead: advance turn directly without showing damage card
    await runBattleResolveTailFromEffectSync(arenaId, room, battle, updates, {
      attackerId,
      defenderId,
      attackRoll,
      defendRoll,
      action,
      turn: clearedTurn,
      activeEffectsBaseline,
    });
    return;
  }

  // Defender alive after co-attack - write co-attack updates and stay in RESOLVING.
  // Client will show DamageCard, then call resolve to advance turn.
  const turnForTail: Record<string, unknown> = {
    ...clearedTurn,
    phase: PHASE.RESOLVING,
    pomegranateCoTailReady: true,
  };
  // Preserve immediateResurrections if set
  if ((clearedTurn as any).immediateResurrections) {
    turnForTail.immediateResurrections = (clearedTurn as any).immediateResurrections;
  } else {
    // Explicitly ensure no undefined value
    delete turnForTail.immediateResurrections;
  }
  updates[ARENA_PATH.BATTLE_TURN] = turnForTail;

  let battleMutable: BattleState = { ...battle, turn: clearedTurn };
  if (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) {
    battleMutable = { ...battleMutable, activeEffects: updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] };
  }
  if (updates[ARENA_PATH.BATTLE_LOG]) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    battleMutable = { ...battleMutable, log: updates[ARENA_PATH.BATTLE_LOG] as BattleState["log"] };
  }

  await update(roomRef(arenaId), updates);
}

/**
 * After attacker acknowledges Rapid Fire extra shots were skipped (defender was eliminated).
 * Clears ack and runs turn advance.
 */
export async function advanceAfterRapidFireSkippedAck(arenaId: string): Promise<void> {
  return ApolloService.advanceAfterRapidFireSkippedAck(arenaId, {
    roomRef,
    resolveTurn,
  });
}

/**
 * After co-attacker acknowledges Pomegranate co-attack was skipped (main hit eliminated the target).
 * Clears ack and advances turn directly (no need to run tail logic since main attack already did).
 */
export async function advanceAfterPomegranateCoSkippedAck(arenaId: string): Promise<void> {
  return PersephoneService.advanceAfterPomegranateCoSkippedAck(arenaId, {
    roomRef,
    resolveTurn,
  });
}

/**
 * Advance from RESURRECTING phase to next fighter's turn.
 * Called after resurrection modal has been shown for 1 second (or acknowledged).
 */
export async function advanceAfterResurrection(arenaId: string): Promise<void> {
  return HadesService.advanceAfterResurrection(arenaId, {
    roomRef,
    runBattleResolveTailFromEffectSync,
  });
}

/* ── advance after Blossom Scentra D4 heal-crit roll (Efflorescence Muse) ─── */

export async function advanceAfterBlossomScentraHealD4(arenaId: string): Promise<void> {
  return PersephoneService.advanceAfterBlossomScentraHealD4(arenaId, {
    roomRef,
    findFighter,
    findFighterPath,
    sanitizeBattleLog,
  });
}

async function applyExperienceHealAndAdvance(
  room: BattleRoom,
  battle: BattleState,
  turn: TurnState,
  attackerId: string,
  allyTargetId: string,
  isCrit: boolean,
  healSkipped: boolean,
): Promise<void> {
  const attacker = findFighter(room, attackerId);
  const ally = findFighter(room, allyTargetId);
  if (!attacker || !ally) return;

  const updates: Record<string, unknown> = {};
  const baseHeal = Math.ceil(attacker.maxHp * 0.1);
  const actualHeal = healSkipped
    ? 0
    : getEffectiveHealForReceiver(
      isCrit ? baseHeal * 2 : baseHeal,
      ally,
      allyTargetId,
      battle.activeEffects || [],
    );
  const allyPath = findFighterPath(room, allyTargetId);
  const newHp = Math.min(ally.currentHp + actualHeal, ally.maxHp);
  if (allyPath) updates[`${allyPath}/currentHp`] = newHp;

  const effects = [...(battle.activeEffects || [])];
  if (!healSkipped) {
    addSunbornSovereignRecoveryStack(room, effects, attackerId);
    addSunbornSovereignRecoveryStack(room, effects, allyTargetId);
    updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effects;
  }

  updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog([
    ...(battle.log || []),
    {
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
      powerUsed: EXPERIENCE_HEAL_ACTION_LABEL,
      ...(healSkipped ? { healSkipReason: EFFECT_TAGS.HEALING_NULLIFIED } : {}),
      experienceHealCrit: isCrit,
    },
  ]);

  const latestEffects = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || battle.activeEffects || [];
  const getHp = (fighter: FighterState) => {
    const path = findFighterPath(room, fighter.characterId);
    if (path && `${path}/currentHp` in updates) return updates[`${path}/currentHp`] as number;
    return fighter.currentHp;
  };
  const teamAMembers = (room.teamA?.members || []).map(fighter => ({ ...fighter, currentHp: getHp(fighter) }));
  const teamBMembers = (room.teamB?.members || []).map(fighter => ({ ...fighter, currentHp: getHp(fighter) }));

  const updatedRoom = {
    ...room,
    teamA: { ...room.teamA, members: teamAMembers },
    teamB: { ...room.teamB, members: teamBMembers },
  } as BattleRoom;
  const updatedQueue = buildTurnQueue(updatedRoom, latestEffects);
  updates[ARENA_PATH.BATTLE_TURN_QUEUE] = updatedQueue;

  const currentAttackerIdx = updatedQueue.findIndex(entry => entry.characterId === attackerId);
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
    const nymphSkip = applyAporretaOfNymphaionPassive(room, skipEntry.characterId, battleForSkip, 0);
    if (nymphSkip[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, nymphSkip);
    const battleForEffSkip = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
    const effSkip = onEfflorescenceMuseTurnStart(room, battleForEffSkip, skipEntry.characterId);
    if (effSkip) Object.assign(updates, effSkip);
    updates[ARENA_PATH.BATTLE_TURN] = {
      ...clearStaleTurnFieldsForNewSelectAction(),
      attackerId: skipEntry.characterId,
      attackerTeam: skipEntry.team,
      phase: PHASE.SELECT_ACTION,
    };
  } else {
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
    const turnData: Record<string, unknown> = {
      ...clearStaleTurnFieldsForNewSelectAction(),
      attackerId: nextEntry.characterId,
      attackerTeam: nextEntry.team,
      phase: PHASE.SELECT_ACTION,
    };
    if (selfRes) turnData.resurrectTargetId = nextEntry.characterId;
    updates[ARENA_PATH.BATTLE_TURN] = turnData;
    const battleForNymph = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
    const nymphNext = applyAporretaOfNymphaionPassive(room, nextEntry.characterId, battleForNymph, 0);
    if (nymphNext[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, nymphNext);
    const battleForEff = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? latestEffects };
    const effNext = onEfflorescenceMuseTurnStart(room, battleForEff, nextEntry.characterId);
    if (effNext) Object.assign(updates, effNext);
  }

  await update(roomRef(room.arenaId), updates);
}

export async function advanceAfterExperienceHealD4(arenaId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle) return;
  const turn = battle?.turn;
  if (
    turn?.phase !== PHASE.ROLLING_EXPERIENCE_HEAL ||
    !turn.experienceHealWinFaces?.length ||
    turn.experienceHealRoll == null ||
    !turn.allyTargetId
  ) {
    return;
  }

  const winFaces = (turn.experienceHealWinFaces ?? []).map((face) => Number(face));
  const roll = Number(turn.experienceHealRoll);
  const isHealCrit = Number.isFinite(roll) && roll >= 1 && roll <= 4 && winFaces.includes(roll);

  await applyExperienceHealAndAdvance(room, battle, turn, turn.attackerId, turn.allyTargetId, isHealCrit, false);
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
  return PersephoneService.confirmSeason(arenaId, {
    roomRef,
    findFighter,
    findFighterPath,
    getWinningFaces,
    deductPowerQuotaIfPending,
    tickEffectsWithSkeletonBlock,
    sanitizeBattleLog,
    isTeamEliminated,
    buildTurnQueue,
    nextAliveIndex,
    applySelfResurrect,
  });
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

  // Pomegranate co-attack: dedicated phases (co D12 → co defend); rolls in coAttackRoll / coDefendRoll (not attackRoll/defendRoll).
  const pomCoAttackPhase =
    (turn.phase === PHASE.ROLLING_POMEGRANATE_CO_ATTACK ||
      (turn.awaitingPomegranateCoAttack && turn.phase === PHASE.ROLLING_ATTACK)) &&
    (turn.coAttackRoll == null || turn.coAttackRoll <= 0);
  if (pomCoAttackPhase) {
    const coAttackerId = effectivePomCoAttackerId(turn);
    const coAttacker = coAttackerId ? findFighter(room, coAttackerId) : undefined;
    const diceSize = getDiceSize(coAttacker?.wishOfIris);
    const r = Math.max(1, Math.min(diceSize, Math.floor(roll)));
    await update(roomRef(arenaId), {
      [ARENA_PATH.BATTLE_TURN]: {
        ...turn,
        coAttackRoll: r,
        phase: PHASE.ROLLING_POMEGRANATE_CO_DEFEND,
        coDefendRoll: null,
        // Nested co chain must not reuse main-hit dodge / crit / chain (stale isCrit caused ×2 in HUD before co D4).
        dodgeRoll: null,
        isDodged: null,
        dodgeWinFaces: null,
        critRoll: null,
        isCrit: null,
        critWinFaces: null,
        chainRoll: null,
        chainSuccess: null,
        chainWinFaces: null,
      },
    });
    return;
  }

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

  const turn = battle.turn;

  const pomCoDefendPhase =
    (turn.phase === PHASE.ROLLING_POMEGRANATE_CO_DEFEND ||
      (turn.awaitingPomegranateCoAttack && turn.phase === PHASE.ROLLING_DEFEND)) &&
    turn.coAttackRoll != null &&
    turn.coAttackRoll > 0 &&
    (turn.coDefendRoll == null || turn.coDefendRoll < 1);
  if (pomCoDefendPhase) {
    const coDefenderId = effectivePomCoDefenderId(turn);
    const coDefender = coDefenderId ? findFighter(room, coDefenderId) : undefined;
    const diceSize = getDiceSize(coDefender?.wishOfIris);
    const r = Math.max(1, Math.min(diceSize, Math.floor(roll)));
    await update(roomRef(arenaId), {
      [ARENA_PATH.BATTLE_TURN]: {
        ...turn,
        coDefendRoll: r,
        phase: PHASE.RESOLVING,
        // Fresh dodge → crit for co; clear in case any client wrote stale fields during co-defend phase.
        dodgeRoll: null,
        isDodged: null,
        dodgeWinFaces: null,
        critRoll: null,
        isCrit: null,
        critWinFaces: null,
        chainRoll: null,
        chainSuccess: null,
        chainWinFaces: null,
      },
    });
    return;
  }

  // Do not merge main defendRoll + RESOLVING while pomegranate co still needs coDefendRoll (dedicated phase or legacy ROLLING_DEFEND+awaiting).
  if (turn.phase === PHASE.ROLLING_POMEGRANATE_CO_DEFEND) return;
  if (
    turn.awaitingPomegranateCoAttack &&
    turn.coAttackRoll != null &&
    turn.coAttackRoll > 0 &&
    (turn.coDefendRoll == null || turn.coDefendRoll < 1)
  ) {
    return;
  }

  const updates: Record<string, unknown> = {
    [ARENA_PATH.BATTLE_TURN_DEFEND_ROLL]: roll,
    [ARENA_PATH.BATTLE_TURN_PHASE]: PHASE.RESOLVING,
  };

  await update(roomRef(arenaId), updates);
}

/** After main Pomegranate hit card, enter co-attack attack phase (D12 for oath caster). */
export async function advanceToPomegranateCoAttackPhase(arenaId: string): Promise<void> {
  return PersephoneService.advanceToPomegranateCoAttackPhase(arenaId, {
    roomRef,
    findFighter,
    applyDeferredPomegranateCoContinue,
  });
}

/* ── submit Rapid Fire D4 (Volley Arrow extra shot) ─────────────────────────── */

export async function submitRapidFireD4Roll(arenaId: string, roll: number): Promise<void> {
  return ApolloService.submitRapidFireD4Roll(arenaId, roll, {
    roomRef,
    findFighter,
    findFighterPath,
    resolveHitAtDefender,
    sanitizeBattleLog,
    resolveTurn,
  });
}

/** After client has shown the extra-shot damage card (RESOLVING_RAPID_FIRE_EXTRA_SHOT), advance to next D4 roll or end chain (or resolveTurn if that shot eliminated defender). */
export async function advanceToNextRapidFireStep(arenaId: string): Promise<void> {
  return ApolloService.advanceToNextRapidFireStep(arenaId, {
    roomRef,
    findFighter,
    applyImmediateResurrection,
  });
}

/** Called when attack dice animation finished — refill quota if roll total >= 11 (without waiting for resolve) */
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

/** Called when Pomegranate co-attack attack dice animation finished — refill co-attacker quota if roll total >= 11 */
export async function ackPomegranateCoAttackDiceShown(arenaId: string): Promise<void> {
  return PersephoneService.ackPomegranateCoAttackDiceShown(arenaId, {
    roomRef,
    findFighter,
    findFighterPath,
  });
}

/** Called when defend dice animation finished — refill quota if roll total >= 11 (without waiting for resolve) */
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

/** Called when Pomegranate co-attack defend dice animation finished — refill defender quota if roll total >= 11 */
export async function ackPomegranateCoDefendDiceShown(arenaId: string): Promise<void> {
  return PersephoneService.ackPomegranateCoDefendDiceShown(arenaId, {
    roomRef,
    findFighter,
    findFighterPath,
  });
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
  const { attackerId, defenderId, turn } = ctx;
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
    nikeAwardedAfterWinTheFight(teamAMembers);
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
    updates[ARENA_PATH.BATTLE_TURN] = { attackerId, attackerTeam: turn.attackerTeam, defenderId, phase: PHASE.DONE, attackRoll: turn.attackRoll, defendRoll: turn.defendRoll, action: turn.action, playbackStep: null, resolvingHitIndex: null };
    updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
    nikeAwardedAfterWinTheFight(teamBMembers);
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
    const battleForNymphSkip = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? latestEffects };
    const nymphSkip = applyAporretaOfNymphaionPassive(room, skipEntry.characterId, battleForNymphSkip, 0);
    if (nymphSkip[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, nymphSkip);
    const efflorescenceMuseSkip = onEfflorescenceMuseTurnStart(room, { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? latestEffects }, skipEntry.characterId);
    if (efflorescenceMuseSkip) Object.assign(updates, efflorescenceMuseSkip);
  } else {
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
    nextTurnOnly = { attackerId: nextEntry.characterId, attackerTeam: nextEntry.team, phase: PHASE.SELECT_ACTION };
    if (selfRes3) nextTurnOnly.resurrectTargetId = nextEntry.characterId;
    const battleForNymph = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? latestEffects };
    const nymphNext = applyAporretaOfNymphaionPassive(room, nextEntry.characterId, battleForNymph, 0);
    if (nymphNext[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, nymphNext);
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

/**
 * Jolt Arc: HP and log are already applied; only tick effects, win check, and advance turn.
 * Mirrors the tail of resolveTurn after damage resolution (spring heals, queue, next SELECT_ACTION).
 */
async function runJoltArcTurnAdvance(arenaId: string, room: BattleRoom, battle: BattleState): Promise<void> {
  const turn = battle.turn!;
  const attackerId = turn.attackerId;
  const defenderId = turn.defenderId!;
  const attackRoll = turn.attackRoll ?? 0;
  const defendRoll = turn.defendRoll ?? 0;
  const action = turn.action;
  const updates: Record<string, unknown> = {};
  let battleLocal = battle;

  const effectUpdates = await tickEffectsWithSkeletonBlock(arenaId, room, battleLocal, updates);
  Object.assign(updates, effectUpdates);
  if (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) {
    battleLocal = { ...battleLocal, activeEffects: updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] };
  }

  const getHp = (m: FighterState) => {
    const path = findFighterPath(room, m.characterId);
    if (path && `${path}/currentHp` in updates) return updates[`${path}/currentHp`] as number;
    return m.currentHp;
  };
  let teamAMembers = (room.teamA?.members || []).map((m) => ({ ...m, currentHp: getHp(m) }));
  let teamBMembers = (room.teamB?.members || []).map((m) => ({ ...m, currentHp: getHp(m) }));
  let latestEffects = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || battleLocal.activeEffects || [];

  const springCasterId = (battle as { springCasterId?: string }).springCasterId;
  const springHeal1 = (battle as { springHeal1?: number }).springHeal1;
  const springHeal1Received = (battle as { springHeal1Received?: string[] }).springHeal1Received ?? [];
  const springHeal2 = (battle as { springHeal2?: number | null }).springHeal2;
  const isCasterTeam =
    springCasterId &&
    ((room.teamA?.members || []).some((m: FighterState) => m.characterId === springCasterId)
      ? (room.teamA?.members || []).some((m: FighterState) => m.characterId === attackerId)
      : (room.teamB?.members || []).some((m: FighterState) => m.characterId === attackerId));
  if (springCasterId && isCasterTeam) {
    if (springHeal2 != null && attackerId === springCasterId) {
      const rawEff = room.battle?.activeEffects ?? battle.activeEffects;
      const effectsForHeal: ActiveEffect[] = Array.isArray(rawEff)
        ? rawEff
        : rawEff && typeof rawEff === 'object'
          ? (Object.values(rawEff) as ActiveEffect[])
          : [];
      let springHeal2Skipped = isHealingNullified(effectsForHeal, attackerId);
      const path = findFighterPath(room, attackerId);
      if (path) {
        const fighter = (room.teamA?.members || []).concat(room.teamB?.members || []).find((m) => m.characterId === attackerId);
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
      const withoutSpring = currentEffects.filter((e) => e.tag !== EFFECT_TAGS.SEASON_SPRING);
      addSunbornSovereignRecoveryStack(room, withoutSpring, springCasterId!);
      addSunbornSovereignRecoveryStack(room, withoutSpring, attackerId);
      updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = withoutSpring;
      latestEffects = withoutSpring;
    } else if (springHeal1 != null && !springHeal1Received.includes(attackerId)) {
      const rawEff1 = room.battle?.activeEffects ?? battle.activeEffects;
      const effectsForHeal: ActiveEffect[] = Array.isArray(rawEff1)
        ? rawEff1
        : rawEff1 && typeof rawEff1 === 'object'
          ? (Object.values(rawEff1) as ActiveEffect[])
          : [];
      let springHeal1Skipped = isHealingNullified(effectsForHeal, attackerId);
      const path = findFighterPath(room, attackerId);
      if (path) {
        const hpKey = `${path}/currentHp`;
        const fighter = (room.teamA?.members || []).concat(room.teamB?.members || []).find((m) => m.characterId === attackerId);
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

  if (springCasterId && (updates[ARENA_PATH.BATTLE_LOG] || updates[ARENA_PATH.BATTLE_SPRING_HEAL1_RECEIVED])) {
    teamAMembers = (room.teamA?.members || []).map((m: FighterState) => {
      const p = findFighterPath(room, m.characterId);
      const hp = p && `${p}/currentHp` in updates ? (updates[`${p}/currentHp`] as number) : m.currentHp;
      return { ...m, currentHp: hp };
    });
    teamBMembers = (room.teamB?.members || []).map((m: FighterState) => {
      const p = findFighterPath(room, m.characterId);
      const hp = p && `${p}/currentHp` in updates ? (updates[`${p}/currentHp`] as number) : m.currentHp;
      return { ...m, currentHp: hp };
    });
  }

  const END_ARENA_HIT_EFFECTS_DELAY_MS = 3500;
  if (isTeamEliminated(teamBMembers, latestEffects)) {
    updates[ARENA_PATH.BATTLE_TURN] = {
      attackerId,
      attackerTeam: turn.attackerTeam,
      defenderId,
      phase: PHASE.DONE,
      attackRoll,
      defendRoll,
      action,
      playbackStep: null,
      resolvingHitIndex: null,
    };
    updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
    nikeAwardedAfterWinTheFight(teamAMembers);
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
    updates[ARENA_PATH.BATTLE_TURN] = {
      attackerId,
      attackerTeam: turn.attackerTeam,
      defenderId,
      phase: PHASE.DONE,
      attackRoll,
      defendRoll,
      action,
      playbackStep: null,
      resolvingHitIndex: null,
    };
    updates[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
    nikeAwardedAfterWinTheFight(teamBMembers);
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
  const currentAttackerIdx = updatedQueue.findIndex((e) => e.characterId === attackerId);
  const fromIdx = currentAttackerIdx !== -1 ? currentAttackerIdx : battle.currentTurnIndex;
  const { index: nextIdx, wrapped } = nextAliveIndex(updatedQueue, fromIdx, updatedRoom, latestEffects);
  const nextEntry = updatedQueue[nextIdx];
  const selfRes3 = applySelfResurrect(nextEntry.characterId, updatedRoom as BattleRoom, latestEffects, updates, battle);
  const nextFighter = findFighter(updatedRoom, nextEntry.characterId);
  let nextTurnOnly: Record<string, unknown>;
  if (nextFighter && !selfRes3 && isStunned((updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || latestEffects, nextEntry.characterId)) {
    const afterStunRoom = { ...updatedRoom };
    const { index: skipIdx, wrapped: skipWrapped } = nextAliveIndex(updatedQueue, nextIdx, afterStunRoom, latestEffects);
    const skipEntry = updatedQueue[skipIdx];
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
    if (skipWrapped) updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = (updates[ARENA_PATH.BATTLE_ROUND_NUMBER] as number || battle.roundNumber) + 1;
    nextTurnOnly = { attackerId: skipEntry.characterId, attackerTeam: skipEntry.team, phase: PHASE.SELECT_ACTION };
    const battleForNymphSkip = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? latestEffects };
    const nymphSkip = applyAporretaOfNymphaionPassive(room, skipEntry.characterId, battleForNymphSkip, 0);
    if (nymphSkip[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, nymphSkip);
    const battleForEfflorescenceMuseSkip = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? latestEffects };
    const efflorescenceMuseSkipUpdates = onEfflorescenceMuseTurnStart(room, battleForEfflorescenceMuseSkip, skipEntry.characterId);
    if (efflorescenceMuseSkipUpdates) Object.assign(updates, efflorescenceMuseSkipUpdates);
  } else {
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
    nextTurnOnly = { attackerId: nextEntry.characterId, attackerTeam: nextEntry.team, phase: PHASE.SELECT_ACTION };
    if (selfRes3) (nextTurnOnly as any).resurrectTargetId = nextEntry.characterId;
    const battleForNymph = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? latestEffects };
    const nymphNext = applyAporretaOfNymphaionPassive(room, nextEntry.characterId, battleForNymph, 0);
    if (nymphNext[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, nymphNext);
    const battleForEfflorescenceMuse = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? latestEffects };
    const efflorescenceMuseUpdates = onEfflorescenceMuseTurnStart(room, battleForEfflorescenceMuse, nextEntry.characterId);
    if (efflorescenceMuseUpdates) Object.assign(updates, efflorescenceMuseUpdates);
  }

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

/**
 * Second resolveTurn pass after deferred Pomegranate co (main hit already applied).
 * Co-attack only applies when spirit `sourceId !== attackerId` (ally buff). Self-target oath
 * (caster === spirit-bearer) never reaches defer or this path — no co-attack in that case.
 * If the defender was eliminated by the main hit (`currentHp <= 0`), skips co-attack and runs Rapid Fire / skeleton / tail only.
 */
export async function applyDeferredPomegranateCoContinue(
  arenaId: string,
  room: BattleRoom,
  battle: BattleState,
  attacker: FighterState,
  defender: FighterState,
  turn: TurnState,
): Promise<void> {
  const ctx = turn.pomegranateDeferredCtx!;
  const { attackerId, defenderId } = turn;
  if (!defenderId) return;

  const updates: Record<string, unknown> = {};
  let activeEffects = battle.activeEffects || [];
  let immediateResurrections: string[] = [];

  // Check if defender can be immediately resurrected before skipping co-attack
  if (defender.currentHp <= 0) {
    const wasResurrected = applyImmediateResurrection(defenderId, room, activeEffects, updates, battle);

    if (wasResurrected) {
      // Defender was resurrected! Mark it and continue with co-attack
      immediateResurrections = [defenderId];
      updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = activeEffects;

      // Update defender object and context to reflect resurrection
      const defPath = findFighterPath(room, defenderId);
      if (defPath) {
        const newHp = updates[`${defPath}/currentHp`] as number;
        defender = { ...defender, currentHp: newHp };
        // Update context so Rapid Fire and other checks see the resurrected HP
        ctx.defenderHpAfter = newHp;
      }
    } else {
      // Defender stays dead - skip co-attack and await acknowledgment
      const pausedTurn = {
        ...turn,
        awaitingPomegranateCoAttack: false,
        pomegranateCoSkippedAwaitsAck: true,
        coAttackRoll: null,
        coDefendRoll: null,
        pomCoAttackerId: null,
        pomCoDefenderId: null,
        playbackStep: null,
        resolvingHitIndex: null,
      } as unknown as TurnState;
      updates[ARENA_PATH.BATTLE_TURN] = pausedTurn;
      await update(roomRef(arenaId), updates);
      return;
    }
  }

  const spiritEffect = activeEffects.find(
    e => e.targetId === attackerId && e.tag === EFFECT_TAGS.POMEGRANATE_OATH_SPIRIT,
  );
  if (defender.currentHp > 0 && spiritEffect && spiritEffect.sourceId !== attackerId) {
    const coRoll = turn.coAttackRoll!;
    const casterId = effectivePomCoAttackerId(turn) || spiritEffect.sourceId;
    const caster = findFighter(room, casterId);
    if (caster && caster.currentHp > 0) {
      const coBuff = getStatModifier(activeEffects, casterId, MOD_STAT.ATTACK_DICE_UP);
      const coRecovery = getStatModifier(activeEffects, casterId, MOD_STAT.RECOVERY_DICE_UP);
      const coTotal = coRoll + caster.attackDiceUp + coBuff + coRecovery;
      const defBuffCo = getStatModifier(activeEffects, defenderId, MOD_STAT.DEFEND_DICE_UP);
      const defRecoveryCo = getStatModifier(activeEffects, defenderId, MOD_STAT.RECOVERY_DICE_UP);
      const coDefRollSafe =
        typeof turn.coDefendRoll === 'number' && !isNaN(turn.coDefendRoll) ? turn.coDefendRoll : 0;
      const coDefTotal = coDefRollSafe + defender.defendDiceUp + defBuffCo + defRecoveryCo;
      const coHit = coTotal > coDefTotal;
      const logArrBase = (updates[ARENA_PATH.BATTLE_LOG] as typeof battle.log) || [...(battle.log || [])];
      const defendRollForCo = coDefRollSafe;
      let hpAfterCo = defender.currentHp;
      if (coHit) {
        const coDmgBuff = getStatModifier(activeEffects, casterId, MOD_STAT.DAMAGE);
        let coDmg = Math.max(0, caster.damage + coDmgBuff);
        if (coTotal >= 10 && turn.isCrit) coDmg *= 2;
        const coResolve = await resolveHitAtDefender(arenaId, room, defenderId, coDmg, updates, defender);
        const coDmgToMaster = coResolve.damageToMaster;
        if (coResolve.skippedMinionsPath) delete updates[coResolve.skippedMinionsPath];
        const defPath = findFighterPath(room, defenderId);
        if (defPath && coDmgToMaster > 0) {
          const currentDefHp = (updates[`${defPath}/currentHp`] as number | undefined) ?? defender.currentHp;
          updates[`${defPath}/currentHp`] = Math.max(0, currentDefHp - coDmgToMaster);
        }
        // Ensure clients see hit VFX / damage card for co-attack: set last-hit target when master took damage
        if (coDmgToMaster > 0) {
          updates[ARENA_PATH.BATTLE_LAST_HIT_MINION_ID] = null;
          updates[ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID] = defenderId;
        }
        let hpAfterCo = defender.currentHp;
        if (defPath) {
          hpAfterCo = (updates[`${defPath}/currentHp`] as number | undefined) ?? defender.currentHp;
        }
        const coAppend: Parameters<typeof appendPomegranateCoAttackLog>[1] = {
          round: battle.roundNumber,
          coAttackerId: casterId,
          defenderId,
          coRoll,
          defendRoll: defendRollForCo,
          coAtkTotal: coTotal,
          coDefTotal,
          hit: true,
          damage: coDmgToMaster,
          defenderHpAfter: hpAfterCo,
        };
        if (coDmgToMaster === 0 && coResolve.hitTargetId && coResolve.hitTargetId !== defenderId) {
          coAppend.hitTargetId = coResolve.hitTargetId;
        }
        updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog(appendPomegranateCoAttackLog(logArrBase as any[], coAppend));
      } else {
        updates[ARENA_PATH.BATTLE_LOG] = sanitizeBattleLog(
          appendPomegranateCoAttackLog(logArrBase as any[], {
            round: battle.roundNumber,
            coAttackerId: casterId,
            defenderId,
            coRoll,
            defendRoll: defendRollForCo,
            coAtkTotal: coTotal,
            coDefTotal,
            hit: false,
            damage: 0,
            defenderHpAfter: ctx.defenderHpAfter,
          }),
        );
      }

      if (
        coHit &&
        hpAfterCo > 0 &&
        defender.wishOfIris === DEITY.NEMESIS &&
        casterId
      ) {
        updates[ARENA_PATH.BATTLE_TURN] = {
          ...turn,
          awaitingPomegranateCoAttack: false,
          phase: PHASE.NEMESIS_WISH_BLESSING_REATTACK,
          nemesisReattackSourceId: defenderId,
          nemesisReattackTargetId: casterId,
          nemesisReattackDamage: 1,
          nemesisReattackFromCoAttack: true,
          pomegranateDeferredCtx: null,
          coAttackRoll: null,
          coDefendRoll: null,
          pomCoAttackerId: null,
          pomCoDefenderId: null,
          coAttackerId: null,
          playbackStep: null,
          resolvingHitIndex: null,
        };
        await update(roomRef(arenaId), updates);
        return;
      }
    }
  }

  const clearedTurn = {
    ...turn,
    awaitingPomegranateCoAttack: false,
    pomegranateDeferredCtx: null,
    coAttackRoll: null,
    coDefendRoll: null,
    pomCoAttackerId: null,
    pomCoDefenderId: null,
    coAttackerId: null,
    playbackStep: null,
    ...(immediateResurrections.length > 0 ? { immediateResurrections } : {}),
  } as unknown as TurnState;

  await runDeferredPomegranateTail(
    arenaId,
    room,
    battle,
    attacker,
    defender,
    clearedTurn,
    ctx,
    updates,
    activeEffects,
  );
}

async function runBattleResolveTailFromEffectSync(
  arenaId: string,
  room: BattleRoom,
  battle: BattleState,
  updates: Record<string, unknown>,
  tail: {
    attackerId: string;
    defenderId: string;
    attackRoll: number;
    defendRoll: number;
    action?: TurnAction;
    turn: TurnState;
    activeEffectsBaseline: ActiveEffect[];
  },
): Promise<void> {
  const { attackerId, defenderId, attackRoll, defendRoll, action, turn, activeEffectsBaseline: activeEffects } = tail;
  // (applyPowerEffect, applyLightningSparkPassive, applyKeraunosVoltageChain, applyAporretaOfNymphaionPassive
  //  all write to updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] but tickEffects reads from battle)
  if (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) {
    battle = { ...battle, activeEffects: updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] };
  }
  // Also update battle.log if it was modified in updates (e.g., by resurrection)
  if (updates[ARENA_PATH.BATTLE_LOG]) {
    battle = { ...battle, log: updates[ARENA_PATH.BATTLE_LOG] as BattleState["log"] };
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

  // Rebuild turn queue (base SPD only; effect speed mods do not reorder)
  let latestEffects = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) || battle.activeEffects || [];

  // Apply immediate auto-resurrection for any Hades son (Death Keeper holder) who just died
  const immediateResurrections: string[] = [];
  for (const member of [...teamAMembers, ...teamBMembers]) {
    if (member.currentHp <= 0) {
      const resurrected = applyImmediateResurrection(member.characterId, room, latestEffects, updates, battle);
      if (resurrected) {
        immediateResurrections.push(member.characterId);
      }
    }
  }

  // Rebuild team member lists after resurrection
  teamAMembers = (room.teamA?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
  teamBMembers = (room.teamB?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));

  // If immediate resurrections occurred, transition to RESURRECTING phase to show modal
  if (immediateResurrections.length > 0) {
    const resurrectingTurn: Record<string, unknown> = {
      attackerId,
      attackerTeam: turn.attackerTeam,
      phase: PHASE.RESURRECTING,
      immediateResurrections,
      // Preserve context needed for turn advance after resurrection modal
      resurrectContext: {
        attackerId,
        defenderId,
        attackRoll,
        defendRoll,
        action,
      },
    };
    updates[ARENA_PATH.BATTLE_TURN] = resurrectingTurn;
    await update(roomRef(arenaId), updates);
    return;
  }

  // ── Spring (Ephemeral Season): attack first then heal — after each attack, heal that attacker with heal1 (or heal2 for caster); caster gets heal1 then we roll heal2 ──
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
      // This attacker hasn't received heal1 yet: heal them (attack first then heal = attack already done).
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
    nikeAwardedAfterWinTheFight(teamAMembers);
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
    nikeAwardedAfterWinTheFight(teamBMembers);
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
  if (nextFighter && !selfRes3 && isStunned((updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? activeEffects, nextEntry.characterId)) {
    const afterStunRoom = { ...updatedRoom };
    const { index: skipIdx, wrapped: skipWrapped } = nextAliveIndex(updatedQueue, nextIdx, afterStunRoom, latestEffects);
    const skipEntry = updatedQueue[skipIdx];
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = skipIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
    if (skipWrapped) updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = (updates[ARENA_PATH.BATTLE_ROUND_NUMBER] as number || battle.roundNumber) + 1;
    nextTurnOnly = { attackerId: skipEntry.characterId, attackerTeam: skipEntry.team, phase: PHASE.SELECT_ACTION };
    const battleForNymphSkip = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? latestEffects };
    const nymphSkip = applyAporretaOfNymphaionPassive(room, skipEntry.characterId, battleForNymphSkip, 0);
    if (nymphSkip[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, nymphSkip);
    const battleForEfflorescenceMuseSkip = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? latestEffects };
    const efflorescenceMuseSkipUpdates = onEfflorescenceMuseTurnStart(room, battleForEfflorescenceMuseSkip, skipEntry.characterId);
    if (efflorescenceMuseSkipUpdates) Object.assign(updates, efflorescenceMuseSkipUpdates);
  } else {
    updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX] = nextIdx;
    updates[ARENA_PATH.BATTLE_ROUND_NUMBER] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
    nextTurnOnly = { attackerId: nextEntry.characterId, attackerTeam: nextEntry.team, phase: PHASE.SELECT_ACTION };
    if (selfRes3) nextTurnOnly.resurrectTargetId = nextEntry.characterId;
    const battleForNymph = { ...battle, activeEffects: (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] | undefined) ?? latestEffects };
    const nymphNext = applyAporretaOfNymphaionPassive(room, nextEntry.characterId, battleForNymph, 0);
    if (nymphNext[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) Object.assign(updates, nymphNext);
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
  const isSoulDevourerDrain = !!(turn as { soulDevourerDrain?: boolean })?.soulDevourerDrain;
  const SKELETON_PLAYBACK_DELAY_MS = (isSoulDevourerDrain ? SOUL_DEVOURER_CHAIN_START_MS : 0) + skeletonCount * SKELETON_MS_PER_HIT;

  // Check if Beyond the Nimbus shock was applied (needs delay for visual effects)
  const beyondNimbusShockApplied = !!updates[ARENA_PATH.BATTLE_BEYOND_NIMBUS_SHOCK_APPLIED];
  const BEYOND_NIMBUS_SHOCK_DELAY_MS = 2500; // Delay for shock application visual effects

  // Calculate total delay (skeleton hits + shock application)
  const totalEffectDelay = SKELETON_PLAYBACK_DELAY_MS + (beyondNimbusShockApplied ? BEYOND_NIMBUS_SHOCK_DELAY_MS : 0);

  const turnRef = ref(db, `arenas/${arenaId}/battle/turn`);

  if ((hasSkeletonHits || beyondNimbusShockApplied) && totalEffectDelay > 0) {
    const advancePayload = {
      [ARENA_PATH.BATTLE_CURRENT_TURN_INDEX]: updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX],
      [ARENA_PATH.BATTLE_ROUND_NUMBER]: updates[ARENA_PATH.BATTLE_ROUND_NUMBER],
      [ARENA_PATH.BATTLE_LAST_SKELETON_HITS]: null,
      [ARENA_PATH.BATTLE_BEYOND_NIMBUS_SHOCK_APPLIED]: null,
    };
    delete updates[ARENA_PATH.BATTLE_CURRENT_TURN_INDEX];
    delete updates[ARENA_PATH.BATTLE_ROUND_NUMBER];
    await update(roomRef(arenaId), updates);
    setTimeout(() => {
      set(turnRef, nextTurnOnly).catch(() => { });
      update(roomRef(arenaId), advancePayload).catch(() => { });
    }, totalEffectDelay);
  } else {
    await set(turnRef, nextTurnOnly);
    await update(roomRef(arenaId), updates);
  }
}

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

  if (turnPhase === PHASE.RESOLVING && (battle.turn as any).pomegranateCoSkippedAwaitsAck) return;

  // Soul Devourer heal skipped: skeleton hits and master hit can run; only block advancing to next attacker until Roger that (checked in skeleton "past last" block below)

  // Shadow Camouflaging: wait for player to roll D4 for refill; only advanceAfterShadowCamouflageD4 may advance
  const scWinFaces = (battle.turn as any)?.shadowCamouflageRefillWinFaces;
  const scRoll = (battle.turn as any)?.shadowCamouflageRefillRoll;
  if (Array.isArray(scWinFaces) && scWinFaces.length > 0 && scRoll == null) return;

  const { attackerId, defenderId, attackRoll = 0, defendRoll = 0, action } = battle.turn;

  if ((battle.turn as any).joltArcAwaitingAdvance && battle.turn.usedPowerName === POWER_NAMES.JOLT_ARC) {
    await runJoltArcTurnAdvance(arenaId, room, battle);
    return;
  }

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
      nikeAwardedAfterWinTheFight(teamAMembers);
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
      nikeAwardedAfterWinTheFight(teamBMembers);
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

  // Pomegranate's Oath: main hit already on Firebase; apply co-attack + Rapid Fire / skeleton / advance after co attack + co defend rolls
  if (turn.awaitingPomegranateCoAttack && turn.pomegranateDeferredCtx) {
    if (defender.currentHp > 0) {
      const coRoll = turn.coAttackRoll;
      if (coRoll == null || coRoll <= 0) return;
      const coDef = turn.coDefendRoll;
      if (coDef == null || coDef < 1) return;
    }
    await applyDeferredPomegranateCoContinue(arenaId, room, battle, attacker, defender, turn);
    return;
  }

  // Pomegranate co-attack tail: client showed DamageCard and called resolve. Now advance turn.
  if ((turn as any).pomegranateCoTailReady) {
    const updates: Record<string, unknown> = {};
    const clearedTurn = { ...turn };
    delete (clearedTurn as any).pomegranateCoTailReady;

    let battleMutable: BattleState = battle;
    if (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS]) {
      battleMutable = { ...battleMutable, activeEffects: updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[] };
    }

    // Advance to next turn
    await runBattleResolveTailFromEffectSync(arenaId, room, battleMutable, updates, {
      attackerId,
      defenderId,
      attackRoll: turn.attackRoll ?? 0,
      defendRoll: turn.defendRoll ?? 0,
      action: turn.action,
      turn: clearedTurn as TurnState,
      activeEffectsBaseline: battle.activeEffects || [],
    });
    return;
  }

  // Jolt Arc: one master playback card per shocked enemy; advance index until last, then flag turn advance
  if (playbackStep?.kind === BATTLE_PLAYBACK_KIND.MASTER && turn.usedPowerName === POWER_NAMES.JOLT_ARC) {
    const ids = ((turn as any).joltArcTargetIds as string[] | undefined) ?? [];
    const idx = (turn as any).joltArcResolveIndex ?? 0;
    if (ids.length > 0 && idx < ids.length - 1) {
      const nextIdx = idx + 1;
      const nextId = ids[nextIdx];
      const nextDef = findFighter(room, nextId);
      if (nextDef) {
        const turnWithIdx = { ...turn, joltArcResolveIndex: nextIdx, defenderId: nextId };
        const battleWithTurn = { ...battle, turn: turnWithIdx as TurnState };
        const nextStep = buildMasterPlaybackStep(room, battleWithTurn, attacker, nextDef);
        await update(roomRef(arenaId), {
          [ARENA_PATH.BATTLE_TURN]: { ...turnWithIdx, playbackStep: nextStep },
        });
        return;
      }
    }
    await runJoltArcTurnAdvance(arenaId, room, battle);
    return;
  }

  // Keraunos Voltage: after each damage card, apply the next bolt + one log line, then show the next card (last ACK → advance turn)
  if (playbackStep?.kind === BATTLE_PLAYBACK_KIND.MASTER && turn.usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE) {
    const ids = turn.keraunosResolveTargetIds ?? [];
    const idx = turn.keraunosResolveIndex ?? 0;
    if (ids.length > 0 && idx < ids.length - 1) {
      const nextIdx = idx + 1;
      const nextId = ids[nextIdx];
      const updatesK2: Record<string, unknown> = {};
      const exclude = [...(turn.keraunosShockExcludeTargetIds ?? [])];
      const isCritK2 = !!(turn as TurnState & { isCrit?: boolean }).isCrit;
      const critRollVal2 = (turn as TurnState & { critRoll?: number }).critRoll;
      const boltNext = await applyKeraunosVoltageBoltForTarget(
        arenaId, room, battle, turn, attackerId, attacker!, nextId, updatesK2, exclude,
      );
      const prevMap = { ...(turn.keraunosAoeDamageMap ?? {}) };
      const aoeMapNext = { ...prevMap, [nextId]: boltNext.totalDamage };
      const hpAfterNext = readFighterHpFromUpdates(room, nextId, updatesK2);
      mergeKeraunosBattleLog(battle, updatesK2, {
        round: battle.roundNumber,
        attackerId,
        defenderId: nextId,
        attackRoll: 0,
        defendRoll: 0,
        damage: boltNext.totalDamage,
        defenderHpAfter: hpAfterNext,
        eliminated: hpAfterNext <= 0,
        missed: boltNext.totalDamage <= 0,
        powerUsed: POWER_NAMES.KERAUNOS_VOLTAGE,
        aoeDamageMap: { ...aoeMapNext },
        keraunosDamageTier: boltNext.tier,
        ...(boltNext.shockBonus > 0 ? { shockDamage: boltNext.shockBonus } : {}),
        ...(isCritK2 && critRollVal2 != null ? { isCrit: true, critRoll: critRollVal2 } : {}),
      });
      const battleAfterLog2: BattleState = {
        ...battle,
        log: updatesK2[ARENA_PATH.BATTLE_LOG] as BattleState["log"],
      };
      const nextDef = findFighter(room, nextId);
      if (!nextDef) {
        await runBattleResolveTailFromEffectSync(arenaId, room, battleAfterLog2, updatesK2, {
          attackerId,
          defenderId: defenderId!,
          attackRoll,
          defendRoll,
          action,
          turn,
          activeEffectsBaseline: battle.activeEffects || [],
        });
        return;
      }
      const turnWithIdx: Record<string, unknown> = {
        ...turn,
        keraunosResolveIndex: nextIdx,
        defenderId: nextId,
        keraunosAoeDamageMap: aoeMapNext,
        keraunosShockExcludeTargetIds: [...exclude],
      };
      const battleWithTurn = { ...battleAfterLog2, turn: turnWithIdx as unknown as TurnState };
      const nextStep = buildMasterPlaybackStep(room, battleWithTurn, attacker, nextDef);
      updatesK2[ARENA_PATH.BATTLE_TURN] = { ...turnWithIdx, playbackStep: nextStep };
      await update(roomRef(arenaId), updatesK2);
      return;
    }
    await runJoltArcTurnAdvance(arenaId, room, battle);
    return;
  }

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

    if (
      turn.usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE &&
      turn.action === TURN_ACTION.POWER &&
      turn.phase === PHASE.RESOLVING
    ) {
      const orderedIds = computeKeraunosOrderedTargetIds(room, turn);
      const updatesKv: Record<string, unknown> = {};
      const exclude = [...(turn.keraunosShockExcludeTargetIds ?? [])];
      const isCritK = !!(turn as TurnState & { isCrit?: boolean }).isCrit;
      const critRollVal = (turn as TurnState & { critRoll?: number }).critRoll;

      if (orderedIds.length === 0) {
        const mainFallback = (turn as TurnState & { keraunosMainTargetId?: string }).keraunosMainTargetId ?? defenderId ?? attackerId;
        const fbHp = readFighterHpFromUpdates(room, mainFallback, updatesKv);
        mergeKeraunosBattleLog(battle, updatesKv, {
          round: battle.roundNumber,
          attackerId,
          defenderId: mainFallback,
          attackRoll: 0,
          defendRoll: 0,
          damage: 0,
          defenderHpAfter: fbHp,
          eliminated: fbHp <= 0,
          missed: true,
          powerUsed: POWER_NAMES.KERAUNOS_VOLTAGE,
        });
        const battleAfterEmpty: BattleState = {
          ...battle,
          log: updatesKv[ARENA_PATH.BATTLE_LOG] as BattleState["log"],
        };
        await runBattleResolveTailFromEffectSync(arenaId, room, battleAfterEmpty, updatesKv, {
          attackerId,
          defenderId: defenderId!,
          attackRoll,
          defendRoll,
          action,
          turn,
          activeEffectsBaseline: battle.activeEffects || [],
        });
        return;
      }

      const tid0 = orderedIds[0];
      const bolt0 = await applyKeraunosVoltageBoltForTarget(
        arenaId, room, battle, turn, attackerId, attacker!, tid0, updatesKv, exclude,
      );
      const aoeMap: Record<string, number> = { [tid0]: bolt0.totalDamage };
      const hpAfter0 = readFighterHpFromUpdates(room, tid0, updatesKv);
      mergeKeraunosBattleLog(battle, updatesKv, {
        round: battle.roundNumber,
        attackerId,
        defenderId: tid0,
        attackRoll: 0,
        defendRoll: 0,
        damage: bolt0.totalDamage,
        defenderHpAfter: hpAfter0,
        eliminated: hpAfter0 <= 0,
        missed: bolt0.totalDamage <= 0,
        powerUsed: POWER_NAMES.KERAUNOS_VOLTAGE,
        aoeDamageMap: { ...aoeMap },
        keraunosDamageTier: bolt0.tier,
        ...(bolt0.shockBonus > 0 ? { shockDamage: bolt0.shockBonus } : {}),
        ...(isCritK && critRollVal != null ? { isCrit: true, critRoll: critRollVal } : {}),
      });

      const battleAfterLog: BattleState = {
        ...battle,
        log: updatesKv[ARENA_PATH.BATTLE_LOG] as BattleState["log"],
      };
      const turnKv: Record<string, unknown> = {
        ...turn,
        keraunosResolveTargetIds: orderedIds,
        keraunosAoeDamageMap: aoeMap,
        keraunosResolveIndex: 0,
        keraunosShockExcludeTargetIds: [...exclude],
        defenderId: tid0,
      };
      const def0 = findFighter(room, tid0);
      if (!def0) {
        await runBattleResolveTailFromEffectSync(arenaId, room, battleAfterLog, updatesKv, {
          attackerId,
          defenderId: defenderId!,
          attackRoll,
          defendRoll,
          action,
          turn,
          activeEffectsBaseline: battle.activeEffects || [],
        });
        return;
      }
      const battleWithTurn = { ...battleAfterLog, turn: turnKv as unknown as TurnState };
      const initialStep = buildMasterPlaybackStep(room, battleWithTurn, attacker!, def0);
      updatesKv[ARENA_PATH.BATTLE_TURN] = { ...turnKv, playbackStep: initialStep };
      await update(roomRef(arenaId), updatesKv);
      return;
    }

    // Keraunos (fallback): main target; Jolt Arc: first shocked enemy in roster order
    const mainIdForStep =
      (turn as any).usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE
        ? ((turn as any).keraunosResolveTargetIds?.[0] ?? (turn as any).keraunosMainTargetId ?? defenderId)
        : (turn as any).usedPowerName === POWER_NAMES.JOLT_ARC && (turn as any).joltArcTargetIds?.[0]
          ? (turn as any).joltArcTargetIds[0]
          : defenderId;
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
      if ((turn as any).pomegranateCoSkippedAwaitsAck) return;
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
          nikeAwardedAfterWinTheFight(teamAMembersAdv);
          await update(roomRef(arenaId), updatesAdv);
          setTimeout(() => { update(roomRef(arenaId), { [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.A, [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED, [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null }).catch(() => { }); }, END_ARENA_DELAY_MS);
          return;
        }
        if (isTeamEliminated(teamAMembersAdv, latestEffectsAdv)) {
          updatesAdv[ARENA_PATH.BATTLE_TURN] = { ...turn, phase: PHASE.DONE };
          (updatesAdv[ARENA_PATH.BATTLE_TURN] as any).resolvingHitIndex = null;
          (updatesAdv[ARENA_PATH.BATTLE_TURN] as any).playbackStep = null;
          updatesAdv[ARENA_PATH.BATTLE_WINNER_DELAYED_AT] = Date.now();
          nikeAwardedAfterWinTheFight(teamBMembersAdv);
          await update(roomRef(arenaId), updatesAdv);
          setTimeout(() => { update(roomRef(arenaId), { [ARENA_PATH.BATTLE_WINNER]: BATTLE_TEAM.B, [ARENA_PATH.STATUS]: ROOM_STATUS.FINISHED, [ARENA_PATH.BATTLE_WINNER_DELAYED_AT]: null }).catch(() => { }); }, END_ARENA_DELAY_MS);
          return;
        }
        // Soul Devourer heal skipped: do not advance to next attacker until Roger that
        if ((turn as any).soulDevourerHealSkipAwaitsAck) return;
        if ((turn as any).pomegranateCoSkippedAwaitsAck) return;
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
          attackerName: sk.nicknameEng?.toLowerCase?.() || DEFAULT_NAMES.SKELETON,
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
            nikeAwardedAfterWinTheFight(teamAMembersSk);
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
            nikeAwardedAfterWinTheFight(teamBMembersSk);
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
      atkTotal,
      defTotal,
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
          ? ((updates[teamPath(defenderTeamForBlock, TEAM_SUB_PATH.MINIONS)] as any[]) ?? (room[defenderTeamForBlock]?.minions || []))
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
            // Mark that Beyond the Nimbus shock was applied (for turn advance delay)
            updates[ARENA_PATH.BATTLE_BEYOND_NIMBUS_SHOCK_APPLIED] = true;
            if (defenderHadShock) {
              rawDmg += baseDmg;
              shockBonusDamage = baseDmg;
            }
          } else {
            if (!skeletonBlocksHit) {
              const shockResult = applyLightningSparkPassive(room, attackerId, defenderId, battle, baseDmg);
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
        atkTotal,
        defTotal,
        damage: dmg,
        defenderHpAfter: hit ? defenderHpAfter : defender.currentHp,
        eliminated: hit && defenderHpAfter <= 0,
        missed: !hit,
      };
      if (hit) {
        logEntry.baseDmg = baseDmg;
        // Always record shock bonus (including 0) so clients don't re-infer from activeEffects
        // after this hit applies shock — that would wrongly show detonation bonus on first shock.
        logEntry.shockDamage = shockBonusDamage;
      }
      if (critRoll > 0) {
        logEntry.isCrit = isCrit;
        logEntry.critRoll = critRoll;
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

  const defenderHasNemesisWish = defender.wishOfIris === DEITY.NEMESIS;
  const nemesisReattackTargetId = turn.awaitingPomegranateCoAttack && turn.pomegranateDeferredCtx
    ? (effectivePomCoAttackerId(turn) ?? attackerId)
    : attackerId;
  const shouldPauseForNemesis =
    hit &&
    defenderHpAfter > 0 &&
    defenderHasNemesisWish &&
    !!nemesisReattackTargetId &&
    !(turn as { nemesisReattackSourceId?: string | null }).nemesisReattackSourceId;
  if (shouldPauseForNemesis) {
    const nemesisTurn: Record<string, unknown> = {
      ...turn,
      phase: PHASE.NEMESIS_WISH_BLESSING_REATTACK,
      nemesisReattackSourceId: defenderId,
      nemesisReattackTargetId: nemesisReattackTargetId,
      nemesisReattackDamage: 1,
      nemesisReattackFromCoAttack: !!(turn.awaitingPomegranateCoAttack && turn.pomegranateDeferredCtx),
      playbackStep: null,
      resolvingHitIndex: null,
    };
    updates[ARENA_PATH.BATTLE_TURN] = nemesisTurn;
    await update(roomRef(arenaId), updates);
    return;
  }

  // Rapid Fire (Volley Arrow) — use latest effects (updates may have modified); require effect still active (turnsRemaining > 0) so round 3 of buff still enters flow
  const effectsForRapidFireCheck = (updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] as ActiveEffect[]) ?? activeEffects;
  const attackerHasRapidFire =
    !soulDevourerDrain &&
    hit &&
    (action !== TURN_ACTION.POWER || isSelfBuffPower) &&
    (effectsForRapidFireCheck as ActiveEffect[]).some(
      (e: ActiveEffect) =>
        e.targetId === attackerId &&
        e.tag === EFFECT_TAGS.RAPID_FIRE &&
        (e.turnsRemaining == null || e.turnsRemaining > 0),
    );

  // Pomegranate: main hit eliminated defender — co-attack skipped; co-attacker must Roger that before tail
  const pomCoSkipAckEligible =
    !isDodged &&
    hit &&
    defenderHpAfter <= 0 &&
    (turn.coAttackRoll == null || turn.coAttackRoll <= 0) &&
    !turn.awaitingPomegranateCoAttack &&
    !(turn as any).pomegranateCoSkippedAwaitsAck;
  if (pomCoSkipAckEligible) {
    const spiritSkip = (effectsForRapidFireCheck as ActiveEffect[]).find(
      e => e.targetId === attackerId && e.tag === EFFECT_TAGS.POMEGRANATE_OATH_SPIRIT,
    );
    if (spiritSkip && spiritSkip.sourceId !== attackerId) {
      const casterSkip = findFighter(room, spiritSkip.sourceId);
      if (casterSkip && casterSkip.currentHp > 0) {
        updates[ARENA_PATH.BATTLE_TURN] = {
          ...turn,
          pomegranateCoSkippedAwaitsAck: true,
          coAttackerId: spiritSkip.sourceId,
          pomCoAttackerId: spiritSkip.sourceId,
          pomCoDefenderId: turn.defenderId ?? null,
          pomegranateDeferredCtx: {
            hit,
            isDodged,
            soulDevourerDrain,
            baseDmg,
            defenderHpAfter,
            dmg,
            attackerHasRapidFire,
            action,
            isSelfBuffPower,
            defTotal,
            isCrit,
          },
          playbackStep: null,
          resolvingHitIndex: null,
        };
        await update(roomRef(arenaId), updates);
        return;
      }
    }
  }

  // Pomegranate's Oath — co-attack rules:
  // - Self-target (spirit sourceId === attackerId): no co-attack; do not defer (guard below).
  // - Ally spirit (sourceId !== attackerId): defer until main hit is fully resolved, then D12 + co + Rapid Fire / skeleton / tail.
  // - If main hit eliminated the defender, skip co-attack (no target to strike), same as Rapid Fire when defenderHpAfter <= 0.
  const needsPomegranateCoDefer =
    !isDodged &&
    hit &&
    defenderHpAfter > 0 &&
    (turn.coAttackRoll == null || turn.coAttackRoll <= 0) &&
    !turn.awaitingPomegranateCoAttack;
  if (needsPomegranateCoDefer) {
    const spiritDefer = activeEffects.find(
      e => e.targetId === attackerId && e.tag === EFFECT_TAGS.POMEGRANATE_OATH_SPIRIT,
    );
    if (spiritDefer && spiritDefer.sourceId !== attackerId) {
      const casterDefer = findFighter(room, spiritDefer.sourceId);
      if (casterDefer && casterDefer.currentHp > 0) {
        updates[ARENA_PATH.BATTLE_TURN] = {
          ...turn,
          awaitingPomegranateCoAttack: true,
          coAttackerId: spiritDefer.sourceId,
          pomCoAttackerId: spiritDefer.sourceId,
          pomCoDefenderId: turn.defenderId ?? null,
          coAttackRoll: null,
          coDefendRoll: null,
          pomegranateDeferredCtx: {
            hit,
            isDodged,
            soulDevourerDrain,
            baseDmg,
            defenderHpAfter,
            dmg,
            attackerHasRapidFire,
            action,
            isSelfBuffPower,
            defTotal,
            isCrit,
          },
          playbackStep: null,
          resolvingHitIndex: null,
        };
        await update(roomRef(arenaId), updates);
        return;
      }
    }
  }

  // Only enter Rapid Fire chain when defender survived the main hit; if eliminated, resolve and advance (all three rounds)
  if (attackerHasRapidFire && defenderId && baseDmg > 0 && defenderHpAfter > 0) {
    // Let caster roll D4 themselves for each extra shot — change to phase ROLLING_RAPID_FIRE_D4 and wait for client to send roll
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
  // Pomegranate co-attack is applied only in applyDeferredPomegranateCoContinue (after co-attack / co-defend dice phases).

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
  await runBattleResolveTailFromEffectSync(arenaId, room, battle, updates, {
    attackerId,
    defenderId,
    attackRoll,
    defendRoll,
    action,
    turn,
    activeEffectsBaseline: activeEffects,
  });

}
