import { PHASE, ROOM_STATUS, TURN_ACTION, type BattleTeamKey } from '../constants/battle';
import { Theme25 } from './character';
import { Deity } from './deity';
import { Minion } from './minions';
import type { PowerDefinition, ActiveEffect } from './power';

/** Fighter's combat snapshot at battle start */
export interface FighterState {
  characterId: string;
  nicknameEng: string;
  nicknameThai: string;
  sex: string;
  deityBlood: Deity;
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

/** Battle room statuses (derived from ROOM_STATUS so type and runtime stay in sync). */
export type RoomStatus = (typeof ROOM_STATUS)[keyof typeof ROOM_STATUS];

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
  team: BattleTeamKey;
  speed: number;
}

export const BATTLE_PLAYBACK_KIND = {
  MASTER: 'master',
  MINION: 'minion',
} as const;

export type BattlePlaybackKind = (typeof BATTLE_PLAYBACK_KIND)[keyof typeof BATTLE_PLAYBACK_KIND];

export interface BattlePlaybackStep {
  kind: BattlePlaybackKind;
  hitIndex: number;
  attackerId: string;
  defenderId: string;
  isHit: boolean;
  isPower: boolean;
  powerName: string;
  isCrit: boolean;
  baseDmg: number;
  damage: number;
  shockBonus: number;
  atkRoll: number;
  defRoll: number;
  isDodged: boolean;
  coAttackHit: boolean;
  coAttackDamage: number;
  attackerName: string;
  attackerTheme: string;
  defenderName: string;
  defenderTheme: string;
  soulDevourerDrain?: boolean;
  isMinionHit?: boolean;
}

export function buildBattlePlaybackEventKey(
  roundNumber: number,
  currentTurnIndex: number,
  step?: Partial<Pick<BattlePlaybackStep, 'kind' | 'hitIndex' | 'attackerId' | 'defenderId' | 'damage' | 'isMinionHit'>> | null,
): string {
  return [
    roundNumber,
    currentTurnIndex,
    step?.kind ?? 'step',
    step?.hitIndex ?? 0,
    step?.attackerId ?? '',
    step?.defenderId ?? '',
    step?.damage ?? 0,
    step?.isMinionHit ? BATTLE_PLAYBACK_KIND.MINION : BATTLE_PLAYBACK_KIND.MASTER,
  ].join('|');
}

/** Phase within a single turn (derived from PHASE so type and runtime stay in sync). */
export type TurnPhase = (typeof PHASE)[keyof typeof PHASE];

/** State of the current turn */
export interface TurnState {
  attackerId: string;
  attackerTeam: BattleTeamKey;
  defenderId?: string;
  phase: TurnPhase;
  attackRoll?: number;
  defendRoll?: number;

  /* Power usage */
  action?: (typeof TURN_ACTION)[keyof typeof TURN_ACTION];
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

  /* Persephone's Ephemeral Season selection */
  selectedSeason?: string; // 'summer' | 'autumn' | 'winter' | 'spring'

  /* Death Keeper resurrection */
  resurrectTargetId?: string;

  /* Soul Devourer (Hades): skip dice and resolve as HP drain */
  soulDevourerDrain?: boolean;
  /* Soul Devourer: chose Use Power that cannot attack — end turn without resolving */
  soulDevourerEndTurnOnly?: boolean;

  /* Shadow Camouflaging: D4 roll for 25% refill SP (quota) — server sets winFaces, client writes roll then calls advanceAfterShadowCamouflageD4 */
  shadowCamouflageRefillWinFaces?: number[];
  shadowCamouflageRefillRoll?: number;

  /** Per-hit resolve: 0 = master applied next, 1 = skeleton 0 next, 2 = skeleton 1 next, … Client calls resolveTurn() again after each hit to get real-time HP updates. */
  resolvingHitIndex?: number;
  /** Server-driven resolve playback: client renders this step, then calls resolveTurn() to acknowledge VFX completion. */
  playbackStep?: BattlePlaybackStep | null;
}

/** A log entry for the battle feed */
export interface BattleLogEntry {
  round: number;
  attackerId: string;
  defenderId: string;
  attackerName?: string;
  attackerTheme?: string;
  defenderName?: string;
  defenderTheme?: string;
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
  /** Turn was skipped because attacker had no valid target (e.g. all enemies under Shadow Camouflage) */
  skippedNoValidTarget?: boolean;
  skipReason?: string;
  /** Logged when confirming power before target/season; show power name only, no arrow/target until resolved */
  pendingTarget?: boolean;
}

/** Full battle state stored alongside the room */
export interface BattleState {
  turnQueue: TurnQueueEntry[];
  currentTurnIndex: number;
  roundNumber: number;
  turn?: TurnState;
  log: BattleLogEntry[];
  activeEffects: ActiveEffect[];
  winner?: BattleTeamKey;
  /** Timestamp when winner will be set after delay (so hit effects can play before end arena) */
  winnerDelayedAt?: number;
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
