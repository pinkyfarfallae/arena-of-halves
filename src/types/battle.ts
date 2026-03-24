import { ArenaRole, PHASE, ROOM_STATUS, TURN_ACTION, type BattleTeamKey, type TurnAction } from '../constants/battle';
import { SeasonKey } from '../data/seasons';
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
  /** True after SP/quota was deducted for this power commit (used for idempotency and cancel refunds). */
  powerQuotaApplied?: boolean;

  /* Critical hit (written by BattleHUD before resolve) */
  isCrit?: boolean;
  critRoll?: number;
  critWinFaces?: number[];

  /* Keraunos Voltage chain D4 (legacy; Keraunos now uses crit D4 + chosen targets) */
  chainRoll?: number;
  chainSuccess?: boolean;
  chainWinFaces?: number[];

  /* Keraunos Voltage: D4 crit before target selection, then multi-step targets (3 / 2 / 1, ×2 on crit) */
  /** When true, show D4 crit roll before target modal; set false after roll is submitted. */
  keraunosAwaitingCrit?: boolean;
  /** Main target (3 damage). Same as defenderId when power is Keraunos. */
  keraunosMainTargetId?: string;
  /** Up to 2 targets (2 then 1 damage). */
  keraunosSecondaryTargetIds?: string[];
  /** 0 = main (3 dmg), 1 = choosing 2-dmg target(s). Third bolt targets are auto-filled. Legacy 2/3 still read via effectiveKeraunosStep. */
  keraunosTargetStep?: number;
  /** Keraunos Voltage: bolt targets in order (main, then secondaries) — one resolve card / log line each (see Jolt Arc). */
  keraunosResolveTargetIds?: string[];
  keraunosAoeDamageMap?: Record<string, number>;
  keraunosResolveIndex?: number;
  /** Masters whose bolt was absorbed by skeleton — no shock on that master (persists across sequential bolts). */
  keraunosShockExcludeTargetIds?: string[];

  /* Pomegranate's Oath — dodge D4 (written by BattleHUD before resolve) */
  isDodged?: boolean;
  dodgeRoll?: number;
  dodgeWinFaces?: number[];

  /* Pomegranate's Oath — co-attack dice (server + client; own attack → defend → resolving like main hit) */
  coAttackRoll?: number;
  /** Defender's roll for the co-attack hit line only (main turn still uses defendRoll). */
  coDefendRoll?: number;
  /**
   * Who rolls the co-attack D12 (oath ally). Same as {@link coAttackerId} when set; explicit id so HUD/log can ignore
   * `attackerId` (spirit bearer) during co phases.
   */
  pomCoAttackerId?: string;
  /**
   * Who rolls co-defend D12 — always the struck target for this turn (mirrors `defenderId` for the co line).
   * Stored explicitly so co strike roles are not inferred from main turn alone.
   */
  pomCoDefenderId?: string;
  /** Same as `pomCoAttackerId` when both written; older rooms may only have this field. */
  coAttackerId?: string;
  coAttackHit?: boolean;
  coAttackDamage?: number;

  /* Ally-targeting power (e.g. Floral Fragrance) */
  allyTargetId?: string;

  /* Floral Fragrance + Efflorescence Muse: D4 roll for healing critical (server sets winFaces, client writes roll then advanceAfterFloralHealD4) */
  floralHealWinFaces?: number[];
  floralHealRoll?: number;
  /** Floral Fragrance: heal skipped (e.g. target has Healing Nullified) — show modal, caster acks, then advanceAfterFloralHealSkippedAck */
  floralHealSkipped?: boolean;
  /** Reason tag for heal skip (e.g. HEALING_NULLIFIED) for modal text */
  healSkipReason?: string;

  /* Persephone's Ephemeral Season selection */
  selectedSeason?: SeasonKey;

  /* Apollo's Imprecated Poem: chosen verse (effect tag) before selecting enemy */
  selectedPoem?: string;

  /* Spring (Ephemeral Season): D4 roll for heal amount (crit = 2, else 1); same flow as Floral Fragrance */
  springHealWinFaces?: number[];
  springHealRoll?: number;
  /** 1 = from confirm (store and advance), 2 = from after resolve (store second amount and advance) */
  springRound?: 1 | 2;

  /* Death Keeper resurrection */
  resurrectTargetId?: string;

  /* Soul Devourer (Hades): skip dice and resolve as HP drain */
  soulDevourerDrain?: boolean;
  /* Soul Devourer: chose Use Power that cannot attack — end turn without resolving */
  soulDevourerEndTurnOnly?: boolean;

  /* Shadow Camouflaging: D4 roll for 25% refill SP (quota) — server sets winFaces, client writes roll then calls advanceAfterShadowCamouflageD4 */
  shadowCamouflageRefillWinFaces?: number[];
  shadowCamouflageRefillRoll?: number;

  /* Disoriented (Imprecated Poem): D4 roll for 25% action has no effect — server sets winFaces, client rolls on all screens then advanceAfterDisorientedD4 */
  disorientedWinFaces?: number[];
  disorientedRoll?: number;

  /** Per-hit resolve: 0 = master applied next, 1 = skeleton 0 next, 2 = skeleton 1 next, ... Client calls resolveTurn() again after each hit to get real-time HP updates. */
  resolvingHitIndex?: number;
  /** Server-driven resolve playback: client renders this step, then calls resolveTurn() to acknowledge VFX completion. */
  playbackStep?: BattlePlaybackStep | null;

  /** Jolt Arc: shocked enemies in roster order — one DamageCard per ID (sequential resolve). */
  joltArcTargetIds?: string[];
  joltArcAoeDamageMap?: Record<string, number>;
  joltArcResolveIndex?: number;
  /** After the last Jolt card is dismissed, next resolveTurn() only advances turn (HP already applied). */
  joltArcAwaitingAdvance?: boolean;
  /** When current player started rolling attack dice (timestamp) — so viewers can show rolling state in sync */
  attackRollStartedAt?: number;
  /** When current player started rolling defend dice (timestamp) — so viewers can show rolling state in sync */
  defendRollStartedAt?: number;

  /** Main hit committed; waiting for Pomegranate co-attack D12 (ally spirit only; self-target oath has no co-attack) */
  awaitingPomegranateCoAttack?: boolean;
  /** Main hit eliminated defender — co-attack skipped; oath caster must Roger that before skeleton / turn advance */
  pomegranateCoSkippedAwaitsAck?: boolean;
  /** Snapshot for continuing resolve after deferred co-attack (same turn) */
  pomegranateDeferredCtx?: {
    hit: boolean;
    isDodged: boolean;
    soulDevourerDrain: boolean;
    baseDmg: number;
    defenderHpAfter: number;
    dmg: number;
    attackerHasRapidFire: boolean;
    action?: TurnAction;
    isSelfBuffPower: boolean;
    defTotal: number;
    isCrit: boolean;
  };
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
  /** Compare totals used for hit vs block (die + character dice-up + effect modifiers incl. recovery). Omitted on legacy log rows. */
  atkTotal?: number;
  defTotal?: number;
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
  /** Caster has Beyond the Nimbus this turn; show "Caster Beyond the nimbus" before the attack result line */
  beyondTheNimbus?: boolean;
  /** Floral Fragrance (and similar) heal amount */
  heal?: number;
  /** When heal was skipped (e.g. Healing Nullified); effect tag for display */
  healSkipReason?: string;
  /** Floral Fragrance + Efflorescence Muse: D4 heal crit (2× heal) */
  floralHealCrit?: boolean;
  /** Ephemeral Season Spring: heal amount (1 or 2) applied at end of caster turn */
  springHeal?: number;
  springHealCrit?: boolean;
  /** Imprecated Poem: which verse was applied (effect tag) */
  imprecatedPoemVerse?: string;
  /** When skeleton/minion blocked: actual hit target id (blocker). Client uses this so hit VFX shows on skeleton, not master. */
  hitTargetId?: string;
  /** True when this entry is from attacker's skeleton/minion hit (not main or co-attack). */
  isMinionHit?: boolean;
  /** Pomegranate's Oath: separate log line for spirit co-attack (after main hit line). */
  isPomegranateCoAttack?: boolean;
  /** Co-attack vs same defense total used for the main hit (for resolve bar ATK vs DEF). */
  coAtkTotal?: number;
  coDefTotal?: number;
  /** Volley Arrow Rapid Fire: extra shot from chain (75% → 50% → 25% → ...). */
  rapidFire?: boolean;
  /** Extra shot — log has attackRoll/defendRoll 0 */
  rapidFireNoDefend?: boolean;
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
  /** Set true briefly after Beyond the Nimbus resolves so clients delay turn advance for team shock VFX; cleared with next update. */
  beyondNimbusShockApplied?: boolean | null;
  /** Ephemeral Season Spring: attack first then heal; heal1 per ally in turn order, then caster gets heal1 and we roll heal2, then caster gets heal2 and end */
  springCasterId?: string;
  springHeal1?: number;
  springHeal1Received?: string[];
  springHeal2?: number | null;
  springHealRollActive?: boolean | null;
}

/** Host assigns a player slot to a specific demigod; join by code places them on that team */
export interface InviteReservation {
  characterId: string;
  team: ArenaRole;
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
  /** Dev arena (config modal): auto-run NPC / other-side turns; default true */
  devNpcAutoPlay?: boolean;
  /** Dev arena: host acts every fighter (disables NPC auto script; UI treats current attacker as you) */
  devPlayAllFightersSelf?: boolean;
  /** When devPlayAllFightersSelf: configurating player's characterId (authoritative host for HUD; avoids teamA[0] / casing drift). */
  devPlayAllHostCharacterId?: string | null;
  npcId?: string;
  /** When set, matching characterId joins the given team (see joinRoom) */
  inviteReservations?: InviteReservation[];

  createdAt: number;
}
