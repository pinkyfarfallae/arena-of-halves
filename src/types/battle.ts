import { Theme25 } from './character';
import { Minion } from './minions';
import type { PowerDefinition, ActiveEffect } from './power';

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

  /* Power quota */
  technique: number;
  quota: number;
  maxQuota: number;

  /* Critical hit rate (0-100) */
  criticalRate: number;

  /* Powers from deity */
  powers: PowerDefinition[];

  /* Skeleton count (Hades' Undead Army) - max 2 */
  skeletonCount?: number;
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
  minions?: Minion[]; // Summoned minions (e.g., skeletons from Undead Army)
}

/* ── Battle / Turn system ── */

/** A single entry in the SPD-sorted turn queue */
export interface TurnQueueEntry {
  characterId: string;
  team: 'teamA' | 'teamB';
  speed: number;
}

/** Phase within a single turn */
export type TurnPhase =
  | 'select-target'
  | 'select-action'    // choose normal attack or use a power
  | 'select-season'    // Persephone's Borrowed Season season selection
  | 'rolling-attack'
  | 'rolling-defend'
  | 'resolving'
  | 'done';

/** State of the current turn */
export interface TurnState {
  attackerId: string;
  attackerTeam: 'teamA' | 'teamB';
  defenderId?: string;
  phase: TurnPhase;
  attackRoll?: number;
  defendRoll?: number;

  /* Power usage */
  action?: 'attack' | 'power';
  usedPowerIndex?: number;
  usedPowerName?: string;

  /* Critical hit (written by BattleHUD before resolve) */
  isCrit?: boolean;
  critRoll?: number;
  critWinFaces?: number[];

  /* Thunderbolt chain D4 (written by BattleHUD before resolve) */
  chainRoll?: number;
  chainSuccess?: boolean;
  chainWinFaces?: number[];

  /* Pomegranate's Oath — dodge D4 (written by BattleHUD before resolve) */
  isDodged?: boolean;
  dodgeRoll?: number;
  dodgeWinFaces?: number[];

  /* Pomegranate's Oath — co-attack D12 (written by BattleHUD before resolve) */
  coAttackRoll?: number;
  coAttackerId?: string;
  coAttackHit?: boolean;
  coAttackDamage?: number;

  /* Ally-targeting power (e.g. Floral Scented) */
  allyTargetId?: string;

  /* Persephone's Borrowed Season selection */
  selectedSeason?: string; // 'summer' | 'autumn' | 'winter' | 'spring'

  /* Death Keeper resurrection */
  resurrectTargetId?: string;
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
  powerUsed?: string;
  isCrit?: boolean;
  critRoll?: number;
  shockDamage?: number;
  aoeDamageMap?: Record<string, number>;
  isDodged?: boolean;
  dodgeRoll?: number;
  coAttackDamage?: number;
  coAttackerId?: string;
  resurrectTargetId?: string;
  resurrectHpRestored?: number;
}

/** Full battle state stored alongside the room */
export interface BattleState {
  turnQueue: TurnQueueEntry[];
  currentTurnIndex: number;
  roundNumber: number;
  turn?: TurnState;
  log: BattleLogEntry[];
  activeEffects: ActiveEffect[];
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
  npcId?: string;

  createdAt: number;
}
