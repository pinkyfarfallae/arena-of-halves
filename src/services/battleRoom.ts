import { ref, set, get, onValue, update, remove, off } from 'firebase/database';
import { db } from '../firebase';
import type {
  BattleRoom, BattleState, FighterState, Team,
  TurnQueueEntry, Viewer,
} from '../types/battle';
import type { Character, Power } from '../types/character';

/* ── helpers ─────────────────────────────────────────── */

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
export function toFighterState(character: Character, powers: Power[]): FighterState {
  return {
    characterId: character.characterId,
    nicknameEng: character.nicknameEng,
    nicknameThai: character.nicknameThai,
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
  fighter: FighterState,
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
  const roomName = customName?.trim() || `${fighter.nicknameEng} vs ???`;

  const room: BattleRoom = {
    arenaId,
    roomName,
    status: 'configuring',
    teamSize: size,
    teamA: { members: [fighter], maxSize: size },
    teamB: { members: [], maxSize: size },
    viewers: {},
    createdAt: Date.now(),
  };

  await set(roomRef(arenaId), room);
  return arenaId;
}

/* ── join as fighter (opponent team) ──────────────────── */

export async function joinRoom(arenaId: string, fighter: FighterState): Promise<BattleRoom | null> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return null;

  const room = snap.val() as BattleRoom;
  const teamBMembers = room.teamB?.members || [];
  const maxSize = room.teamB?.maxSize ?? room.teamSize;

  // team B already full
  if (teamBMembers.length >= maxSize) return null;

  // can't join if already in any team
  if (getAllFighterIds(room).includes(fighter.characterId)) return null;

  const newMembers = [...teamBMembers, fighter];
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
export function buildTurnQueue(room: BattleRoom): TurnQueueEntry[] {
  const entries: TurnQueueEntry[] = [];

  for (const m of room.teamA?.members || []) {
    entries.push({ characterId: m.characterId, team: 'teamA', speed: m.speed });
  }
  for (const m of room.teamB?.members || []) {
    entries.push({ characterId: m.characterId, team: 'teamB', speed: m.speed });
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
function nextAliveIndex(queue: TurnQueueEntry[], fromIndex: number, room: BattleRoom): { index: number; wrapped: boolean } {
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
  }

  // all dead (shouldn't happen — game should end before this)
  return { index: fromIndex, wrapped: false };
}

/** Check if all members of a team are eliminated */
function isTeamEliminated(members: FighterState[]): boolean {
  return members.every((m) => m.currentHp <= 0);
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
  const battle: BattleState = {
    turnQueue,
    currentTurnIndex: 0,
    roundNumber: 1,
    turn: {
      attackerId: first.characterId,
      attackerTeam: first.team,
      phase: 'select-target',
    },
    log: [],
  };

  await update(roomRef(arenaId), {
    status: 'battling',
    battle,
  });
}

/* ── select target ───────────────────────────────────── */

export async function selectTarget(arenaId: string, defenderId: string): Promise<void> {
  await update(ref(db, `arenas/${arenaId}/battle/turn`), {
    defenderId,
    phase: 'rolling-attack',
  });
}

/* ── submit attack dice roll ─────────────────────────── */

export async function submitAttackRoll(arenaId: string, roll: number): Promise<void> {
  await update(ref(db, `arenas/${arenaId}/battle/turn`), {
    attackRoll: roll,
    phase: 'rolling-defend',
  });
}

/* ── submit defend dice roll ─────────────────────────── */

export async function submitDefendRoll(arenaId: string, roll: number): Promise<void> {
  await update(ref(db, `arenas/${arenaId}/battle/turn`), {
    defendRoll: roll,
    phase: 'resolving',
  });
}

/* ── resolve turn (compare dice, apply damage, advance) ── */

export async function resolveTurn(arenaId: string): Promise<void> {
  const snap = await get(roomRef(arenaId));
  if (!snap.exists()) return;

  const room = snap.val() as BattleRoom;
  const battle = room.battle;
  if (!battle || !battle.turn || battle.turn.phase !== 'resolving') return;

  const { attackerId, defenderId, attackRoll = 0, defendRoll = 0 } = battle.turn;
  if (!defenderId) return;

  const attacker = findFighter(room, attackerId);
  const defender = findFighter(room, defenderId);
  if (!attacker || !defender) return;

  // Compare dice: attacker roll + bonus vs defender roll + bonus
  const atkTotal = attackRoll + attacker.attackDiceUp;
  const defTotal = defendRoll + defender.defendDiceUp;
  const hit = atkTotal > defTotal;

  // Apply damage only if attacker wins the roll
  const dmg = hit ? attacker.damage : 0;
  const newHp = Math.max(0, defender.currentHp - dmg);

  // Build update object
  const updates: Record<string, unknown> = {};

  // Update defender HP (only if hit)
  if (hit) {
    const defPath = findFighterPath(room, defenderId);
    if (defPath) {
      updates[`${defPath}/currentHp`] = newHp;
    }
  }

  // Log entry
  const logEntry = {
    round: battle.roundNumber,
    attackerId,
    defenderId,
    attackRoll,
    defendRoll,
    damage: dmg,
    defenderHpAfter: hit ? newHp : defender.currentHp,
    eliminated: hit && newHp <= 0,
    missed: !hit,
  };
  const logArr = [...(battle.log || []), logEntry];
  updates['battle/log'] = logArr;

  // Check win condition — need to check with updated HP
  const teamAMembers = (room.teamA?.members || []).map((m) =>
    m.characterId === defenderId ? { ...m, currentHp: hit ? newHp : m.currentHp } : m,
  );
  const teamBMembers = (room.teamB?.members || []).map((m) =>
    m.characterId === defenderId ? { ...m, currentHp: hit ? newHp : m.currentHp } : m,
  );

  if (isTeamEliminated(teamBMembers)) {
    updates['battle/winner'] = 'teamA';
    updates['battle/turn'] = { attackerId, attackerTeam: battle.turn.attackerTeam, defenderId, phase: 'done', attackRoll, defendRoll };
    updates['status'] = 'finished';
    await update(roomRef(arenaId), updates);
    return;
  }

  if (isTeamEliminated(teamAMembers)) {
    updates['battle/winner'] = 'teamB';
    updates['battle/turn'] = { attackerId, attackerTeam: battle.turn.attackerTeam, defenderId, phase: 'done', attackRoll, defendRoll };
    updates['status'] = 'finished';
    await update(roomRef(arenaId), updates);
    return;
  }

  // Advance to next alive fighter
  const updatedRoom = {
    ...room,
    teamA: { ...room.teamA, members: teamAMembers },
    teamB: { ...room.teamB, members: teamBMembers },
  };
  const { index: nextIdx, wrapped } = nextAliveIndex(battle.turnQueue, battle.currentTurnIndex, updatedRoom);
  const nextEntry = battle.turnQueue[nextIdx];

  updates['battle/currentTurnIndex'] = nextIdx;
  updates['battle/roundNumber'] = wrapped ? battle.roundNumber + 1 : battle.roundNumber;
  updates['battle/turn'] = {
    attackerId: nextEntry.characterId,
    attackerTeam: nextEntry.team,
    phase: 'select-target',
  };

  await update(roomRef(arenaId), updates);
}
