import { ref, set, get, onValue, update, remove, off } from 'firebase/database';
import { db } from '../firebase';
import type { BattleRoom, FighterState, Team, Viewer } from '../types/battle';
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
    status: 'waiting',
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
    const rooms = Object.values(data).sort((a, b) => b.createdAt - a.createdAt);
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
