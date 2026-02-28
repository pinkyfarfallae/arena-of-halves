import { Power, Theme25 } from './character';

/** Fighter's combat snapshot at battle start */
export interface FighterState {
  characterId: string;
  nicknameEng: string;
  nicknameThai: string;
  sex: string;
  deityBlood: string;
  image?: string;
  theme: Theme25;

  /* Combat stats (snapshot) */
  maxHp: number;
  currentHp: number;
  damage: number;
  attackDiceUp: number;
  defendDiceUp: number;
  speed: number;
  rerollsLeft: number;

  /* Skill points */
  passiveSkillPoint: string;
  skillPoint: string;
  ultimateSkillPoint: string;

  /* Powers from deity */
  powers: Power[];
}

/** Battle room statuses */
export type RoomStatus = 'configuring' | 'waiting' | 'ready' | 'battling' | 'finished';

/** Who is viewing */
export interface Viewer {
  characterId: string;
  nicknameEng: string;
}

/** A team in the battle */
export interface Team {
  members: FighterState[];
  maxSize: number;
}

/* ── Battle / Turn system ── */

/** A single entry in the SPD-sorted turn queue */
export interface TurnQueueEntry {
  characterId: string;
  team: 'teamA' | 'teamB';
  speed: number;
}

/** Phase within a single turn */
export type TurnPhase = 'select-target' | 'rolling-attack' | 'rolling-defend' | 'resolving' | 'done';

/** State of the current turn */
export interface TurnState {
  attackerId: string;
  attackerTeam: 'teamA' | 'teamB';
  defenderId?: string;
  phase: TurnPhase;
  attackRoll?: number;   // raw D20 result
  defendRoll?: number;   // raw D20 result
}

/** A log entry for the battle feed */
export interface BattleLogEntry {
  round: number;
  attackerId: string;
  defenderId: string;
  attackRoll: number;
  defendRoll: number;
  damage: number;
  defenderHpAfter: number;
  eliminated: boolean;
  missed: boolean;
}

/** Full battle state stored alongside the room */
export interface BattleState {
  turnQueue: TurnQueueEntry[];
  currentTurnIndex: number;
  roundNumber: number;
  turn?: TurnState;
  log: BattleLogEntry[];
  winner?: 'teamA' | 'teamB';
}

/** The battle room stored in Firebase */
export interface BattleRoom {
  arenaId: string;
  roomName: string;
  status: RoomStatus;
  teamSize: number; // members per team (1 = 1v1, 2 = 2v2, etc.)

  teamA: Team;
  teamB: Team;

  viewers: Record<string, Viewer>;

  battle?: BattleState;
  testMode?: boolean;

  createdAt: number;
}
