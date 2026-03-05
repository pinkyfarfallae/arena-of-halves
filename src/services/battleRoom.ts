import { ref, set, get, onValue, update, remove, off } from 'firebase/database';
import { db } from '../firebase';
import type {
  BattleRoom, BattleState, FighterState, Team,
  TurnQueueEntry, Viewer,
} from '../types/battle';
import type { Character } from '../types/character';
import type { PowerDefinition, ActiveEffect } from '../types/power';
import { getQuotaCost } from '../types/power';
import {
  getStatModifier, getReflectPercent,
  isStunned, applyPowerEffect, tickEffects, buildPassiveEffects,
  applyLightningReflexPassive, applyJoltArc, applyThunderboltChain,
  applySecretOfDryadPassive, applyFloralScented, applySeasonEffects,
  applyPomegranateOath,
} from './powerEngine';
import { getPowers } from '../data/powers';

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

/** Generate a 6-char uppercase room code */
function generateArenaId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

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
    status: 'configuring',
    teamSize: size,
    teamA: { members: teamAMembers, maxSize: size },
    teamB: { members: [], maxSize: size },
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
    'teamB/members': newMembers,
    roomName,
    status: bothFull ? 'ready' : 'waiting',
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
    if (!snap.exists()) {
      callback([]);
      return;
    }
    const data = snap.val() as Record<string, BattleRoom>;
    const rooms = Object.values(data)
      .filter((r) => r.status !== 'configuring')
      .sort((a, b) => b.createdAt - a.createdAt);
    callback(rooms);
  });

  return () => off(arenasRef, 'value', handler);
}

/* ── listen to room changes (realtime) ────────────────── */

export function onRoomChange(arenaId: string, callback: (room: BattleRoom | null) => void): () => void {
  const r = roomRef(arenaId);
  const handler = onValue(r, (snap) => {
    callback(snap.exists() ? (snap.val() as BattleRoom) : null);
  });

  // return unsubscribe function
  return () => off(r, 'value', handler);
}

/* ── delete room ──────────────────────────────────────── */

export async function deleteRoom(arenaId: string): Promise<void> {
  await remove(roomRef(arenaId));
}

/* ══════════════════════════════════════════════════════════
   BATTLE — turn-based combat
   ══════════════════════════════════════════════════════════ */

/** Build a SPD-sorted turn queue. TeamA wins ties (room creator advantage). */
export function buildTurnQueue(room: BattleRoom, effects?: ActiveEffect[]): TurnQueueEntry[] {
  const entries: TurnQueueEntry[] = [];

  for (const m of room.teamA?.members || []) {
    const spdMod = effects ? getStatModifier(effects, m.characterId, 'speed') : 0;
    entries.push({ characterId: m.characterId, team: 'teamA', speed: m.speed + spdMod });
  }
  for (const m of room.teamB?.members || []) {
    const spdMod = effects ? getStatModifier(effects, m.characterId, 'speed') : 0;
    entries.push({ characterId: m.characterId, team: 'teamB', speed: m.speed + spdMod });
  }

  entries.sort((a, b) => {
    if (b.speed !== a.speed) return b.speed - a.speed;
    // tiebreaker: teamA before teamB
    if (a.team !== b.team) return a.team === 'teamA' ? -1 : 1;
    return 0;
  });

  return entries;
}

/** Find a fighter across both teams by characterId */
function findFighter(room: BattleRoom, characterId: string): FighterState | undefined {
  const all = [...(room.teamA?.members || []), ...(room.teamB?.members || [])];
  return all.find((m) => m.characterId === characterId);
}

/** Find the index of a fighter in teamA or teamB members array */
function findFighterPath(room: BattleRoom, characterId: string): string | null {
  const teamAIdx = (room.teamA?.members || []).findIndex((m) => m.characterId === characterId);
  if (teamAIdx !== -1) return `teamA/members/${teamAIdx}`;
  const teamBIdx = (room.teamB?.members || []).findIndex((m) => m.characterId === characterId);
  if (teamBIdx !== -1) return `teamB/members/${teamBIdx}`;
  return null;
}

/** Find the next alive fighter index in the queue (skips eliminated) */
function nextAliveIndex(queue: TurnQueueEntry[], fromIndex: number, room: BattleRoom, effects?: ActiveEffect[]): { index: number; wrapped: boolean } {
  const len = queue.length;
  let wrapped = false;

  for (let i = 1; i <= len; i++) {
    const idx = (fromIndex + i) % len;
    if (idx <= fromIndex && i > 0) wrapped = true;
    const entry = queue[idx];
    const fighter = findFighter(room, entry.characterId);
    if (fighter && fighter.currentHp > 0) {
      return { index: idx, wrapped: idx < fromIndex };
    }
    // Dead fighter with death-keeper: allow their turn (self-resurrect)
    if (fighter && fighter.currentHp <= 0 && effects?.some(e => e.targetId === fighter.characterId && e.tag === 'death-keeper')) {
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
    if (effects?.some(e => e.targetId === m.characterId && e.tag === 'death-keeper')) return false;
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

  const dkIdx = effects.findIndex(e => e.targetId === nextCharId && e.tag === 'death-keeper');
  if (dkIdx === -1) return false;

  // Resurrect at 50% max HP
  const resHp = Math.ceil(fighter.maxHp * 0.5);
  const fPath = findFighterPath(room, nextCharId);
  if (fPath) updates[`${fPath}/currentHp`] = resHp;

  // Consume death-keeper, add resurrected tag
  effects.splice(dkIdx, 1);
  effects.push({
    id: `${nextCharId}::Death Keeper Risen`,
    powerName: 'Death Keeper',
    effectType: 'buff',
    sourceId: nextCharId,
    targetId: nextCharId,
    value: 0,
    turnsRemaining: 999,
    tag: 'resurrected',
  });
  updates['battle/activeEffects'] = effects;

  // Clear stun on the resurrected fighter (death resets debuffs)
  const stunIdx = effects.findIndex(e => e.targetId === nextCharId && e.tag === 'stun');
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
    powerUsed: 'Death Keeper',
    resurrectTargetId: nextCharId,
    resurrectHpRestored: resHp,
  };
  updates['battle/log'] = [...(battle.log as unknown[] || []), logEntry];

  return true;
}

/* ── start battle ────────────────────────────────────── */

export async function startBattle(arenaId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  if (room.status !== 'ready') return;

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
      phase: 'select-action',
    },
    log: [],
    activeEffects: passiveEffects,
  };

  await update(roomRef(arenaId), {
    status: 'battling',
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

  // Normal attack (including follow-up after ally/self-buff power)
  if (!turn.action || turn.action === 'attack') {
    await update(ref(db, `arenas/${arenaId}/battle/turn`), {
      defenderId,
      phase: 'rolling-attack',
    });
    return;
  }

  // Power: defender is now known — apply the power
  if (turn.action === 'power' && turn.usedPowerIndex != null) {
    const attacker = findFighter(room, attackerId);
    if (!attacker) return;
    const power = attacker.powers?.[turn.usedPowerIndex];
    if (!power) return;

    const updates: Record<string, unknown> = {};

    // Self-buff already applied in selectAction → just set defender for dice
    if (power.target === 'self') {
      updates['battle/turn'] = { ...turn, defenderId, phase: 'rolling-attack' };
      await update(roomRef(arenaId), updates);
      return;
    }

    if (power.skipDice) {
      // ── Jolt Arc: detonate all shocks on all enemies ──
      if (power.name === 'Jolt Arc') {
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
        updates['battle/log'] = [...(battle.log || []), logEntry];

        updates['battle/turn'] = {
          attackerId,
          attackerTeam: turn.attackerTeam,
          defenderId,
          phase: 'resolving',
          action: 'power',
          usedPowerIndex: turn.usedPowerIndex,
          usedPowerName: power.name,
        };

      // ── Thunderbolt: -3 primary, then D4 chain check ──
      } else if (power.name === 'Thunderbolt') {
        const defender = findFighter(room, defenderId);
        const defPath = findFighterPath(room, defenderId);
        const defHpAfter = defender ? Math.max(0, defender.currentHp - power.value) : 0;
        if (defPath && defender) updates[`${defPath}/currentHp`] = defHpAfter;

        // Only chain if there are other alive enemies (skip in 1v1)
        const isTeamA = (room.teamA?.members || []).some(m => m.characterId === attackerId);
        const enemies = isTeamA ? (room.teamB?.members || []) : (room.teamA?.members || []);
        const chainTargets = enemies.filter(e => e.characterId !== defenderId && e.currentHp > 0);
        const hasChainTargets = chainTargets.length > 0;

        const logEntry = {
          round: battle.roundNumber,
          attackerId,
          defenderId,
          attackRoll: 0,
          defendRoll: 0,
          damage: power.value,
          defenderHpAfter: defHpAfter,
          eliminated: defHpAfter <= 0,
          missed: false,
          powerUsed: power.name,
        };
        updates['battle/log'] = [...(battle.log || []), logEntry];

        updates['battle/turn'] = {
          attackerId,
          attackerTeam: turn.attackerTeam,
          defenderId,
          phase: 'resolving',
          action: 'power',
          usedPowerIndex: turn.usedPowerIndex,
          usedPowerName: power.name,
          ...(hasChainTargets && { chainWinFaces: getWinningFaces(50) }),
        };

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
          damage: power.effect === 'damage' || power.effect === 'lifesteal' ? power.value : 0,
          defenderHpAfter: (() => {
            const defender = findFighter(room, defenderId);
            if (!defender) return 0;
            if (power.effect === 'damage' || power.effect === 'lifesteal') {
              return Math.max(0, defender.currentHp - power.value);
            }
            return defender.currentHp;
          })(),
          eliminated: (() => {
            const defender = findFighter(room, defenderId);
            if (!defender) return false;
            if (power.effect === 'damage' || power.effect === 'lifesteal') {
              return defender.currentHp - power.value <= 0;
            }
            return false;
          })(),
          missed: false,
          powerUsed: power.name,
        };
        updates['battle/log'] = [...(battle.log || []), logEntry];

        updates['battle/turn'] = {
          attackerId,
          attackerTeam: turn.attackerTeam,
          defenderId,
          phase: 'resolving',
          action: 'power',
          usedPowerIndex: turn.usedPowerIndex,
          usedPowerName: power.name,
        };
      }

      await update(roomRef(arenaId), updates);
      return;
    }

    // Non-skipDice enemy power — go through dice rolling
    updates['battle/turn'] = { ...turn, defenderId, phase: 'rolling-attack' };
    await update(roomRef(arenaId), updates);
    return;
  }

  // Fallback: no action set
  await update(ref(db, `arenas/${arenaId}/battle/turn`), {
    defenderId,
    phase: 'rolling-attack',
  });
}

/* ── select action (attack or use power) ─────────────── */

export async function selectAction(
  arenaId: string,
  action: 'attack' | 'power',
  powerIndex?: number,
  allyTargetId?: string,
): Promise<void> {
  if (action === 'attack') {
    await update(ref(db, `arenas/${arenaId}/battle/turn`), {
      action: 'attack',
      phase: 'select-target',
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

  // Deduct quota
  const atkPath = findFighterPath(room, attackerId);
  const updates: Record<string, unknown> = {};
  if (atkPath) updates[`${atkPath}/quota`] = attacker.quota - cost;

  // ── Season selection power (e.g. Persephone's Borrowed Season): go to season selection ──
  // Also check canonical definition so rooms created before the flag was added still work
  const canonicalPower = getPowers(attacker.deityBlood)?.find(p => p.name === power.name);
  if (power.requiresSeasonSelection || canonicalPower?.requiresSeasonSelection) {
    updates['battle/turn'] = {
      attackerId,
      attackerTeam: battle.turn.attackerTeam,
      phase: 'select-season',
      action: 'power',
      usedPowerIndex: powerIndex,
      usedPowerName: power.name,
    };
    await update(roomRef(arenaId), updates);
    return;
  }

  // ── Ally-targeting power ──
  if (power.target === 'ally' && allyTargetId) {
    // ── Death Keeper: resurrect dead ally, free action (return to select-action) ──
    if (power.name === 'Death Keeper') {
      const target = findFighter(room, allyTargetId);
      if (!target || target.currentHp > 0) return; // target must be dead

      const effects = [...(battle.activeEffects || [])];
      const dkEffect = effects.find(e => e.targetId === attackerId && e.tag === 'death-keeper');
      if (!dkEffect) return; // no death-keeper available

      // Resurrect at 50% max HP
      const resHp = Math.ceil(target.maxHp * 0.5);
      const targetPath = findFighterPath(room, allyTargetId);
      if (targetPath) updates[`${targetPath}/currentHp`] = resHp;

      // Consume death-keeper, add resurrected tag on target
      const cleaned = effects.filter(e => e.id !== dkEffect.id);
      cleaned.push({
        id: `${attackerId}::Death Keeper Risen`,
        powerName: 'Death Keeper',
        effectType: 'buff' as const,
        sourceId: attackerId,
        targetId: allyTargetId,
        value: 0,
        turnsRemaining: 999,
        tag: 'resurrected',
      });
      updates['battle/activeEffects'] = cleaned;

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
        powerUsed: 'Death Keeper',
        resurrectTargetId: allyTargetId,
        resurrectHpRestored: resHp,
      };
      updates['battle/log'] = [...(battle.log || []), logEntry];

      // Free action: return to select-action (don't advance turn)
      updates['battle/turn'] = {
        attackerId,
        attackerTeam: battle.turn!.attackerTeam,
        phase: 'select-action',
        resurrectTargetId: allyTargetId,
      };

      await update(roomRef(arenaId), updates);
      return;
    }

    // ── Pomegranate's Oath: apply buff + end turn immediately (like confirmSeason) ──
    if (power.name === "Pomegranate's Oath") {
      const oathUpdates = applyPomegranateOath(room, attackerId, allyTargetId, battle);
      Object.assign(updates, oathUpdates);

      // Sync activeEffects into battle for tickEffects
      const battleForTick = updates['battle/activeEffects']
        ? { ...battle, activeEffects: updates['battle/activeEffects'] as ActiveEffect[] }
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
      updates['battle/log'] = [...(battle.log || []), logEntry];

      // Win condition check (DOT from tick may have eliminated someone)
      const getHp = (m: FighterState) => {
        const path = findFighterPath(room, m.characterId);
        if (path && `${path}/currentHp` in updates) return updates[`${path}/currentHp`] as number;
        return m.currentHp;
      };
      const teamAMembers = (room.teamA?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
      const teamBMembers = (room.teamB?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));

      // Advance turn (same pattern as confirmSeason)
      const latestEffects = (updates['battle/activeEffects'] as ActiveEffect[]) || battle.activeEffects || [];

      if (isTeamEliminated(teamBMembers, latestEffects)) {
        updates['battle/winner'] = 'teamA';
        updates['battle/turn'] = { attackerId, attackerTeam: battle.turn!.attackerTeam, phase: 'done' };
        updates['status'] = 'finished';
        await update(roomRef(arenaId), updates);
        return;
      }
      if (isTeamEliminated(teamAMembers, latestEffects)) {
        updates['battle/winner'] = 'teamB';
        updates['battle/turn'] = { attackerId, attackerTeam: battle.turn!.attackerTeam, phase: 'done' };
        updates['status'] = 'finished';
        await update(roomRef(arenaId), updates);
        return;
      }
      const updatedRoom = {
        ...room,
        teamA: { ...room.teamA, members: teamAMembers },
        teamB: { ...room.teamB, members: teamBMembers },
      } as BattleRoom;
      const updatedQueue = buildTurnQueue(updatedRoom, latestEffects);
      updates['battle/turnQueue'] = updatedQueue;

      const currentAttackerIdx = updatedQueue.findIndex(e => e.characterId === attackerId);
      const fromIdx = currentAttackerIdx !== -1 ? currentAttackerIdx : battle.currentTurnIndex;
      const { index: nextIdx, wrapped } = nextAliveIndex(updatedQueue, fromIdx, updatedRoom, latestEffects);
      const nextEntry = updatedQueue[nextIdx];

      // Death Keeper: self-resurrect if next fighter is dead with death-keeper
      const selfRes1 = applySelfResurrect(nextEntry.characterId, updatedRoom, latestEffects, updates, battle);

      const nextFighter = findFighter(updatedRoom, nextEntry.characterId);
      if (nextFighter && !selfRes1 && isStunned(latestEffects, nextEntry.characterId)) {
        updates['battle/currentTurnIndex'] = nextIdx;
        updates['battle/roundNumber'] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
        const { index: skipIdx, wrapped: skipWrapped } = nextAliveIndex(updatedQueue, nextIdx, updatedRoom, latestEffects);
        const skipEntry = updatedQueue[skipIdx];
        updates['battle/currentTurnIndex'] = skipIdx;
        if (skipWrapped) updates['battle/roundNumber'] = (updates['battle/roundNumber'] as number || battle.roundNumber) + 1;
        updates['battle/turn'] = { attackerId: skipEntry.characterId, attackerTeam: skipEntry.team, phase: 'select-action' };
      } else {
        updates['battle/currentTurnIndex'] = nextIdx;
        updates['battle/roundNumber'] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
        const turnData: Record<string, unknown> = { attackerId: nextEntry.characterId, attackerTeam: nextEntry.team, phase: 'select-action' };
        if (selfRes1) turnData.resurrectTargetId = nextEntry.characterId;
        updates['battle/turn'] = turnData;
      }

      await update(roomRef(arenaId), updates);
      return;
    }

    // ── Floral Scented (and other ally powers): apply buff, then follow-up normal attack ──
    const floralUpdates = applyFloralScented(room, attackerId, allyTargetId, battle, power);
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
    updates['battle/log'] = [...(battle.log || []), logEntry];

    updates['battle/turn'] = {
      attackerId,
      attackerTeam: battle.turn.attackerTeam,
      phase: 'select-target',
      action: 'attack',       // follow-up as normal attack
      usedPowerIndex: powerIndex,
      usedPowerName: power.name,
      allyTargetId,
    };
    await update(roomRef(arenaId), updates);
    return;
  }

  // ── Self-buff power (non-skipDice): apply buff now, then select target for dice ──
  if (!power.skipDice && power.target === 'self' && (power.effect === 'buff' || power.effects)) {
    const adjusted = power.effects
      ? { ...power, effects: power.effects.map(e => ({ ...e, duration: e.duration + 1 })) }
      : { ...power, duration: power.duration + 1 };
    const effectUpdates = applyPowerEffect(room, attackerId, attackerId, adjusted as PowerDefinition, battle);
    Object.assign(updates, effectUpdates);

    updates['battle/turn'] = {
      attackerId,
      attackerTeam: battle.turn.attackerTeam,
      phase: 'select-target',
      action: 'power',
      usedPowerIndex: powerIndex,
      usedPowerName: power.name,
    };
    await update(roomRef(arenaId), updates);
    return;
  }

  // ── Enemy-targeting power (skipDice or dice): store choice, go to target selection ──
  // Power effects will be applied in selectTarget() once defender is known
  updates['battle/turn'] = {
    attackerId,
    attackerTeam: battle.turn.attackerTeam,
    phase: 'select-target',
    action: 'power',
    usedPowerIndex: powerIndex,
    usedPowerName: power.name,
  };
  await update(roomRef(arenaId), updates);
}

/* ── select season for Persephone's Borrowed Season power ────── */

export async function selectSeason(
  arenaId: string,
  season: string, // 'summer' | 'autumn' | 'winter' | 'spring'
): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle?.turn) return;

  const { attackerId } = battle.turn;

  // Update turn with selected season
  const updates: Record<string, unknown> = {
    'battle/turn/selectedSeason': season,
    // Will transition to select-target on client after 3-second delay for visual effects
  };

  await update(roomRef(arenaId), updates);
}

/* ── cancel season selection: refund quota and go back to select-action ─── */

export async function cancelSeasonSelection(arenaId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle?.turn || battle.turn.phase !== 'select-season') return;

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
  updates['battle/turn'] = {
    attackerId,
    attackerTeam,
    phase: 'select-action',
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
  if (!battle?.turn || battle.turn.phase !== 'select-target') return;

  const { attackerId, attackerTeam, action, usedPowerIndex } = battle.turn;
  const attacker = findFighter(room, attackerId);
  if (!attacker) return;

  const updates: Record<string, unknown> = {};

  // Refund quota if a power was selected
  if (action === 'power' && usedPowerIndex != null) {
    const power = attacker.powers?.[usedPowerIndex as number];
    const cost = power ? getQuotaCost(power.type) : 1;
    const atkPath = findFighterPath(room, attackerId);
    if (atkPath) updates[`${atkPath}/quota`] = attacker.quota + cost;
  }

  // Reset turn back to select-action
  updates['battle/turn'] = {
    attackerId,
    attackerTeam,
    phase: 'select-action',
    action: null,
  };

  await update(roomRef(arenaId), updates);
}

/* ── confirm season: apply effects + end turn (no dice) ─── */

export async function confirmSeason(arenaId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  let battle = room.battle;
  if (!battle?.turn || battle.turn.phase !== 'select-season') return;

  const { attackerId, attackerTeam, selectedSeason } = battle.turn;
  if (!selectedSeason) return;

  const attacker = findFighter(room, attackerId);
  if (!attacker) return;

  const updates: Record<string, unknown> = {};

  // Apply season effects to all alive teammates
  const seasonUpdates = applySeasonEffects(room, attackerId, selectedSeason, battle);
  Object.assign(updates, seasonUpdates);

  // Sync activeEffects into battle for tickEffects
  if (updates['battle/activeEffects']) {
    battle = { ...battle, activeEffects: updates['battle/activeEffects'] as ActiveEffect[] };
  }

  // Tick active effects (DOT damage, spring heal, decrement durations)
  const effectUpdates = tickEffects(room, battle, updates);
  Object.assign(updates, effectUpdates);

  // Battle log entry
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
    powerUsed: 'Borrowed Season',
    selectedSeason,
  };
  updates['battle/log'] = [...(battle.log || []), logEntry];

  // Build updated HP map for win condition check
  const getHp = (m: FighterState) => {
    const path = findFighterPath(room, m.characterId);
    if (path && `${path}/currentHp` in updates) return updates[`${path}/currentHp`] as number;
    return m.currentHp;
  };
  const teamAMembers = (room.teamA?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));
  const teamBMembers = (room.teamB?.members || []).map(m => ({ ...m, currentHp: getHp(m) }));

  // Advance turn — same logic as end of resolveTurn()
  const latestEffects = (updates['battle/activeEffects'] as ActiveEffect[]) || battle.activeEffects || [];

  if (isTeamEliminated(teamBMembers, latestEffects)) {
    updates['battle/winner'] = 'teamA';
    updates['battle/turn'] = { attackerId, attackerTeam, phase: 'done' };
    updates['status'] = 'finished';
    await update(roomRef(arenaId), updates);
    return;
  }

  if (isTeamEliminated(teamAMembers, latestEffects)) {
    updates['battle/winner'] = 'teamB';
    updates['battle/turn'] = { attackerId, attackerTeam, phase: 'done' };
    updates['status'] = 'finished';
    await update(roomRef(arenaId), updates);
    return;
  }
  const updatedRoom = {
    ...room,
    teamA: { ...room.teamA, members: teamAMembers },
    teamB: { ...room.teamB, members: teamBMembers },
  } as BattleRoom;
  const updatedQueue = buildTurnQueue(updatedRoom, latestEffects);
  updates['battle/turnQueue'] = updatedQueue;

  const currentAttackerIdx = updatedQueue.findIndex(e => e.characterId === attackerId);
  const fromIdx = currentAttackerIdx !== -1 ? currentAttackerIdx : battle.currentTurnIndex;

  const { index: nextIdx, wrapped } = nextAliveIndex(updatedQueue, fromIdx, updatedRoom, latestEffects);
  const nextEntry = updatedQueue[nextIdx];

  // Death Keeper: self-resurrect if next fighter is dead with death-keeper
  const selfRes2 = applySelfResurrect(nextEntry.characterId, updatedRoom, latestEffects, updates, battle);

  // Skip stunned fighters
  const nextFighter = findFighter(updatedRoom, nextEntry.characterId);
  if (nextFighter && !selfRes2 && isStunned(latestEffects, nextEntry.characterId)) {
    updates['battle/currentTurnIndex'] = nextIdx;
    updates['battle/roundNumber'] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;

    const { index: skipIdx, wrapped: skipWrapped } = nextAliveIndex(updatedQueue, nextIdx, updatedRoom, latestEffects);
    const skipEntry = updatedQueue[skipIdx];
    updates['battle/currentTurnIndex'] = skipIdx;
    if (skipWrapped) updates['battle/roundNumber'] = (updates['battle/roundNumber'] as number || battle.roundNumber) + 1;
    updates['battle/turn'] = {
      attackerId: skipEntry.characterId,
      attackerTeam: skipEntry.team,
      phase: 'select-action',
    };
  } else {
    updates['battle/currentTurnIndex'] = nextIdx;
    updates['battle/roundNumber'] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
    const turnData: Record<string, unknown> = {
      attackerId: nextEntry.characterId,
      attackerTeam: nextEntry.team,
      phase: 'select-action',
    };
    if (selfRes2) turnData.resurrectTargetId = nextEntry.characterId;
    updates['battle/turn'] = turnData;
  }

  await update(roomRef(arenaId), updates);
}

/* ── submit attack dice roll ─────────────────────────── */

export async function submitAttackRoll(arenaId: string, roll: number): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;
  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle?.turn) return;

  const updates: Record<string, unknown> = {
    'battle/turn/attackRoll': roll,
    'battle/turn/phase': 'rolling-defend',
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
    'battle/turn/defendRoll': roll,
    'battle/turn/phase': 'resolving',
  };

  // Quota gain: roll + defendDiceUp + buff modifiers >= 11
  const defender = battle.turn.defenderId ? findFighter(room, battle.turn.defenderId) : undefined;
  if (defender) {
    const buffMod = getStatModifier(battle.activeEffects || [], defender.characterId, 'defendDiceUp');
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
  if (!battle || !battle.turn || battle.turn.phase !== 'resolving') return;

  const { attackerId, defenderId, attackRoll = 0, defendRoll = 0, action } = battle.turn;
  if (!defenderId) return;

  const attacker = findFighter(room, attackerId);
  const defender = findFighter(room, defenderId);
  if (!attacker || !defender) return;

  const updates: Record<string, unknown> = {};
  const activeEffects = battle.activeEffects || [];

  let dmg = 0;
  let hit = false;
  let isDodged = false;
  let atkTotal = 0;
  let defTotal = 0;
  let defenderHpAfter = defender.currentHp;

  // Resolve power that went through dice rolling
  const { usedPowerIndex } = battle.turn;
  const usedPower = action === 'power' && usedPowerIndex != null
    ? attacker.powers?.[usedPowerIndex]
    : undefined;

  // Self-buff power (e.g. Beyond the Cloud): buffs already applied in selectAction().
  // Treat as normal attack for damage calculation.
  const isSelfBuffPower = action === 'power' && usedPower && !usedPower.skipDice && usedPower.target === 'self';

  if (action === 'power' && usedPower && !usedPower.skipDice && !isSelfBuffPower) {
    // Power with dice (damage/enemy-target) — compare rolls, apply effect on hit
    const atkBuff = getStatModifier(activeEffects, attackerId, 'attackDiceUp');
    const defBuff = getStatModifier(activeEffects, defenderId, 'defendDiceUp');
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

      if (usedPower.effect === 'damage' || usedPower.effect === 'lifesteal') {
        dmg = usedPower.value;
        defenderHpAfter = Math.max(0, defender.currentHp - usedPower.value);
      }
    }

    const logEntry = {
      round: battle.roundNumber,
      attackerId,
      defenderId,
      attackRoll,
      defendRoll,
      damage: dmg,
      defenderHpAfter: hit ? defenderHpAfter : defender.currentHp,
      eliminated: hit && defenderHpAfter <= 0,
      missed: !hit,
      powerUsed: usedPower.name,
      ...(isDodged && { isDodged: true, dodgeRoll: battle.turn.dodgeRoll }),
    };
    updates['battle/log'] = [...(battle.log || []), logEntry];

  } else if (action !== 'power' || isSelfBuffPower) {
    // Normal attack: compare dice with active effect modifiers
    const atkBuff = getStatModifier(activeEffects, attackerId, 'attackDiceUp');
    const defBuff = getStatModifier(activeEffects, defenderId, 'defendDiceUp');
    atkTotal = attackRoll + attacker.attackDiceUp + atkBuff;
    defTotal = defendRoll + defender.defendDiceUp + defBuff;
    hit = atkTotal > defTotal;

    // Pomegranate's Oath dodge: defender with spirit may dodge
    if (hit && battle.turn.isDodged) {
      isDodged = true;
      hit = false;
    }

    let isCrit = false;
    let critRoll = 0;
    let shockBonusDamage = 0;

    if (hit) {
      const dmgBuff = getStatModifier(activeEffects, attackerId, 'damage');
      const baseDmg = Math.max(0, attacker.damage + dmgBuff);
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

      // Lightning Reflex passive: apply shock or detonate for bonus damage (only on pure normal attacks)
      // Use pre-crit baseDmg so shock detonation = x2 of base damage, not x2 of crit-doubled damage
      if (!isSelfBuffPower) {
        const shockResult = applyLightningReflexPassive(room, attackerId, defenderId, battle, baseDmg);
        rawDmg += shockResult.bonusDamage;
        shockBonusDamage = shockResult.bonusDamage;
        Object.assign(updates, shockResult.updates);
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
        // Remove depleted shields, persist remaining values (keep tagged shields like petal-shield)
        const cleaned = activeEffects.filter(e => !(e.effectType === 'shield' && e.value <= 0 && !e.tag));
        updates['battle/activeEffects'] = cleaned;
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
    }

    // Log entry for normal attack (or self-buff power + attack)
    const logEntry = {
      round: battle.roundNumber,
      attackerId,
      defenderId,
      attackRoll,
      defendRoll,
      damage: dmg,
      defenderHpAfter: hit ? defenderHpAfter : defender.currentHp,
      eliminated: hit && defenderHpAfter <= 0,
      missed: !hit,
      ...(critRoll > 0 && { isCrit, critRoll }),
      ...(shockBonusDamage > 0 && { shockDamage: shockBonusDamage }),
      ...(isSelfBuffPower && usedPower && { powerUsed: usedPower.name }),
      ...(isDodged && { isDodged: true, dodgeRoll: battle.turn.dodgeRoll }),
    };
    updates['battle/log'] = [...(battle.log || []), logEntry];
  }
  // skipDice powers: effect + log already written in selectAction()

  // Thunderbolt chain: if D4 succeeded, apply -1 AoE to other enemies
  const turn = battle.turn;
  if (turn.usedPowerName === 'Thunderbolt' && turn.chainSuccess && defenderId) {
    const { updates: chainUpdates, aoeDamageMap } = applyThunderboltChain(room, attackerId, defenderId, battle);
    Object.assign(updates, chainUpdates);
    // Append chain AoE info to the last log entry
    const existingLog = [...(battle.log || [])];
    if (existingLog.length > 0) {
      existingLog[existingLog.length - 1].aoeDamageMap = aoeDamageMap;
      updates['battle/log'] = existingLog;
    }
  }

  // Secret of Dryad passive: grant petal-shield if atkTotal > 10
  const dryadUpdates = applySecretOfDryadPassive(room, attackerId, battle, atkTotal);
  if (dryadUpdates['battle/activeEffects']) {
    Object.assign(updates, dryadUpdates);
  }

  // Pomegranate's Oath co-attack: when oath-bearer attacks + hits, caster co-attacks
  // Self-target (caster === oath-bearer): no co-attack
  if (!isDodged && hit && turn.coAttackRoll != null && turn.coAttackRoll > 0) {
    const spiritEffect = activeEffects.find(
      e => e.targetId === attackerId && e.tag === 'pomegranate-spirit',
    );
    if (spiritEffect && spiritEffect.sourceId !== attackerId) {
      const casterId = turn.coAttackerId || spiritEffect.sourceId;
      const caster = findFighter(room, casterId);
      if (caster && caster.currentHp > 0) {
        const coBuff = getStatModifier(activeEffects, casterId, 'attackDiceUp');
        const coTotal = turn.coAttackRoll + caster.attackDiceUp + coBuff;
        const coHit = coTotal > defTotal;
        if (coHit) {
          const coDmgBuff = getStatModifier(activeEffects, casterId, 'damage');
          const coDmg = Math.max(0, caster.damage + coDmgBuff);
          const defPath = findFighterPath(room, defenderId);
          if (defPath) {
            const currentDefHp = (updates[`${defPath}/currentHp`] as number | undefined) ?? defender.currentHp;
            updates[`${defPath}/currentHp`] = Math.max(0, currentDefHp - coDmg);
          }
          // Append co-attack info to the last log entry
          const logArr = (updates['battle/log'] as typeof battle.log) || [...(battle.log || [])];
          if (logArr.length > 0) {
            logArr[logArr.length - 1].coAttackDamage = coDmg;
            logArr[logArr.length - 1].coAttackerId = casterId;
            updates['battle/log'] = logArr;
          }
        }
      }
    }
  }

  // Sync accumulated activeEffects changes so tickEffects sees them
  // (applyPowerEffect, applyLightningReflexPassive, applyThunderboltChain, applySecretOfDryadPassive
  //  all write to updates['battle/activeEffects'] but tickEffects reads from battle)
  if (updates['battle/activeEffects']) {
    battle = { ...battle, activeEffects: updates['battle/activeEffects'] as ActiveEffect[] };
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
  const latestEffects = (updates['battle/activeEffects'] as ActiveEffect[]) || battle.activeEffects || [];

  if (isTeamEliminated(teamBMembers, latestEffects)) {
    updates['battle/winner'] = 'teamA';
    updates['battle/turn'] = { attackerId, attackerTeam: turn.attackerTeam, defenderId, phase: 'done', attackRoll, defendRoll, action };
    updates['status'] = 'finished';
    await update(roomRef(arenaId), updates);
    return;
  }

  if (isTeamEliminated(teamAMembers, latestEffects)) {
    updates['battle/winner'] = 'teamB';
    updates['battle/turn'] = { attackerId, attackerTeam: turn.attackerTeam, defenderId, phase: 'done', attackRoll, defendRoll, action };
    updates['status'] = 'finished';
    await update(roomRef(arenaId), updates);
    return;
  }
  const updatedRoom = {
    ...room,
    teamA: { ...room.teamA, members: teamAMembers },
    teamB: { ...room.teamB, members: teamBMembers },
  };
  const updatedQueue = buildTurnQueue(updatedRoom as BattleRoom, latestEffects);
  updates['battle/turnQueue'] = updatedQueue;

  // Find where the current attacker is in the new queue to advance from there
  const currentAttackerIdx = updatedQueue.findIndex(e => e.characterId === attackerId);
  const fromIdx = currentAttackerIdx !== -1 ? currentAttackerIdx : battle.currentTurnIndex;

  const { index: nextIdx, wrapped } = nextAliveIndex(updatedQueue, fromIdx, updatedRoom, latestEffects);
  const nextEntry = updatedQueue[nextIdx];

  // Death Keeper: self-resurrect if next fighter is dead with death-keeper
  const selfRes3 = applySelfResurrect(nextEntry.characterId, updatedRoom as BattleRoom, latestEffects, updates, battle);

  // Skip stunned fighters
  const nextFighter = findFighter(updatedRoom, nextEntry.characterId);
  if (nextFighter && !selfRes3 && isStunned(updates['battle/activeEffects'] as typeof activeEffects || activeEffects, nextEntry.characterId)) {
    // Stunned: consume the stun turn and advance again
    updates['battle/currentTurnIndex'] = nextIdx;
    updates['battle/roundNumber'] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;

    const afterStunRoom = { ...updatedRoom };
    const { index: skipIdx, wrapped: skipWrapped } = nextAliveIndex(updatedQueue, nextIdx, afterStunRoom, latestEffects);
    const skipEntry = updatedQueue[skipIdx];
    updates['battle/currentTurnIndex'] = skipIdx;
    if (skipWrapped) updates['battle/roundNumber'] = (updates['battle/roundNumber'] as number || battle.roundNumber) + 1;
    updates['battle/turn'] = {
      attackerId: skipEntry.characterId,
      attackerTeam: skipEntry.team,
      phase: 'select-action',
    };
  } else {
    updates['battle/currentTurnIndex'] = nextIdx;
    updates['battle/roundNumber'] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
    const turnData: Record<string, unknown> = {
      attackerId: nextEntry.characterId,
      attackerTeam: nextEntry.team,
      phase: 'select-action',
    };
    if (selfRes3) turnData.resurrectTargetId = nextEntry.characterId;
    updates['battle/turn'] = turnData;
  }

  await update(roomRef(arenaId), updates);
}
