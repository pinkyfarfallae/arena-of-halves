/**
 * Turn phases — use when setting or comparing turn.phase.
 */
export const PHASE = {
  SELECT_TARGET: 'select-target',
  SELECT_ACTION: 'select-action',
  /** Persephone's Ephemeral Season selection */
  SELECT_SEASON: 'select-season',
  /** Apollo's Imprecated Poem: choose verse then target enemy */
  SELECT_POEM: 'select-poem',
  /** Rolling attack roll */
  ROLLING_ATTACK: 'rolling-attack',
  /** Rolling defend roll */
  ROLLING_DEFEND: 'rolling-defend',
  /** Floral Fragrance on ally with Efflorescence Muse: roll D4 for heal crit (same rate as target's critical rate); crit = 2× heal */
  ROLLING_FLORAL_HEAL: 'rolling-floral-heal',
  /** Spring (Ephemeral Season): roll D4 for heal crit (1 or 2 HP until next caster turn) */
  ROLLING_SPRING_HEAL: 'rolling-spring-heal',
  /** Disoriented (Imprecated Poem): D4 roll for 25% no effect — client rolls on all screens, then advance */
  ROLLING_DISORIENTED_NO_EFFECT: 'rolling-disoriented-no-effect',
  /** Volley Arrow Rapid Fire: caster rolls D4 for each extra shot (75% → 50% → 25% → ...) */
  ROLLING_RAPID_FIRE_EXTRA_SHOT: 'rolling-rapid-fire-extra-shot',
  /** Show damage for one extra shot; after card completes, advance to next D4 or end chain. */
  RESOLVING_RAPID_FIRE_EXTRA_SHOT: 'resolving-rapid-fire-extra-shot',
  /** Advance only (Rapid Fire chain done); resolveTurn skips main resolution and runs co-attack → advance. */
  RESOLVING_AFTER_RAPID_FIRE: 'resolving-after-rapid-fire',
  /** Pomegranate's Oath co-attack: ally spirit rolls D12 (after main hit card). */
  ROLLING_POMEGRANATE_CO_ATTACK: 'rolling-pomegranate-co-attack',
  /** Pomegranate's Oath co-attack: defender rolls vs co (same die rules as main defend). */
  ROLLING_POMEGRANATE_CO_DEFEND: 'rolling-pomegranate-co-defend',
  RESOLVING: 'resolving',
  /** Show immediate resurrection modal (Death Keeper auto-resurrect) before advancing to next turn */
  RESURRECTING: 'resurrecting',
  DONE: 'done',
} as const;

/**
 * Turn action (attack or use a power).
 */
export const TURN_ACTION = {
  ATTACK: 'attack',
  POWER: 'power',
} as const;

export type TurnAction = (typeof TURN_ACTION)[keyof typeof TURN_ACTION];
/**
 * Room status values (must match RoomStatus type).
 */
export const ROOM_STATUS = {
  CONFIGURING: 'configuring',
  WAITING: 'waiting',
  READY: 'ready',
  BATTLING: 'battling',
  FINISHED: 'finished',
} as const;

/**
 * Arena participation role (which team or viewer).
 */
export const ARENA_ROLE = {
  TEAM_A: 'teamA',
  TEAM_B: 'teamB',
  VIEWER: 'viewer',
} as const;

export type ArenaRole = (typeof ARENA_ROLE)[keyof typeof ARENA_ROLE];

/**
 * Battle team key (teamA / teamB). Use for turn.attackerTeam, queue.team, etc.
 */
export const BATTLE_TEAM = {
  A: ARENA_ROLE.TEAM_A,
  B: ARENA_ROLE.TEAM_B,
} as const;

export type BattleTeamKey = (typeof BATTLE_TEAM)[keyof typeof BATTLE_TEAM];

/**
 * Firebase arena paths — use for update() keys instead of hardcoded strings.
 */
export const ARENA_PATH = {
  STATUS: 'status',
  BATTLE: 'battle',
  BATTLE_ACTIVE_EFFECTS: 'battle/activeEffects',
  BATTLE_LOG: 'battle/log',
  BATTLE_TURN: 'battle/turn',
  BATTLE_LAST_HIT_MINION_ID: 'battle/lastHitMinionId',
  BATTLE_LAST_HIT_TARGET_ID: 'battle/lastHitTargetId',
  BATTLE_LAST_SKELETON_HITS: 'battle/lastSkeletonHits',
  /** Flag set when Beyond the Nimbus applies team-wide shock (used for turn advance delay) */
  BATTLE_BEYOND_NIMBUS_SHOCK_APPLIED: 'battle/beyondNimbusShockApplied',
  BATTLE_WINNER: 'battle/winner',
  /** Set when damage eliminated a team; winner is written after delay so hit effects can play */
  BATTLE_WINNER_DELAYED_AT: 'battle/winnerDelayedAt',
  BATTLE_TURN_QUEUE: 'battle/turnQueue',
  BATTLE_CURRENT_TURN_INDEX: 'battle/currentTurnIndex',
  BATTLE_ROUND_NUMBER: 'battle/roundNumber',
  BATTLE_TURN_ATTACK_ROLL: 'battle/turn/attackRoll',
  BATTLE_TURN_DEFEND_ROLL: 'battle/turn/defendRoll',
  BATTLE_TURN_ATTACK_ROLL_STARTED_AT: 'battle/turn/attackRollStartedAt',
  BATTLE_TURN_DEFEND_ROLL_STARTED_AT: 'battle/turn/defendRollStartedAt',
  BATTLE_TURN_PHASE: 'battle/turn/phase',
  BATTLE_TURN_PLAYBACK_STEP: 'battle/turn/playbackStep',
  BATTLE_TURN_SELECTED_SEASON: 'battle/turn/selectedSeason',
  BATTLE_SPRING_CASTER_ID: 'battle/springCasterId',
  /** First D4 result (1 or 2); each ally gets this after they attack, in turn order from next person */
  BATTLE_SPRING_HEAL1: 'battle/springHeal1',
  /** Character ids who have received heal1; when caster is in this list we roll for heal2 */
  BATTLE_SPRING_HEAL1_RECEIVED: 'battle/springHeal1Received',
  /** Second D4 result; only caster gets this after their next attack, then Spring ends */
  BATTLE_SPRING_HEAL2: 'battle/springHeal2',
  /** True only while Spring D4 modal should be shown; cleared when advancing from D4 */
  BATTLE_SPRING_HEAL_ROLL_ACTIVE: 'battle/springHealRollActive',
} as const;

/** Build team path for Firebase (e.g. teamPath(BATTLE_TEAM.A, 'members') => 'teamA/members'). */
export function teamPath(team: BattleTeamKey, suffix: 'members' | 'maxSize' | 'minions'): string {
  return `${team}/${suffix}`;
}

/**
 * Panel/arena side (left vs right team display).
 */
export const PANEL_SIDE = {
  LEFT: 'left',
  RIGHT: 'right',
} as const;

export type PanelSide = (typeof PANEL_SIDE)[keyof typeof PANEL_SIDE];

/**
 * Pomegranate co-attack D12 (after main hit). Distinct from main {@link PHASE.ROLLING_ATTACK}.
 * Legacy rooms may still use `ROLLING_ATTACK` + `awaitingPomegranateCoAttack` until migrated.
 */
export function isPomegranateCoAttackDicePhase(
  phase: string | undefined | null,
  awaitingPomegranateCoAttack: boolean,
): boolean {
  if (phase == null) return false;
  /** Dedicated phase always means co D12 — do not require `awaitingPomegranateCoAttack` (avoids Firebase flag/phase ordering glitches). */
  if (phase === PHASE.ROLLING_POMEGRANATE_CO_ATTACK) return true;
  return awaitingPomegranateCoAttack && phase === PHASE.ROLLING_ATTACK;
}

/**
 * Pomegranate co-defend D12 — same `defenderId` as the main strike, separate roll from main defend.
 * Legacy: `ROLLING_DEFEND` while awaiting co.
 */
export function isPomegranateCoDefendDicePhase(
  phase: string | undefined | null,
  awaitingPomegranateCoAttack: boolean,
): boolean {
  if (phase == null) return false;
  if (phase === PHASE.ROLLING_POMEGRANATE_CO_DEFEND) return true;
  return awaitingPomegranateCoAttack && phase === PHASE.ROLLING_DEFEND;
}

/** Oath ally rolling co D12 — prefers `pomCoAttackerId`, falls back to legacy `coAttackerId`. */
export function effectivePomCoAttackerId(turn: {
  pomCoAttackerId?: string | null;
  coAttackerId?: string | null;
} | null | undefined): string | undefined {
  if (!turn) return undefined;
  const id = turn.pomCoAttackerId ?? turn.coAttackerId;
  return id == null || id === '' ? undefined : id;
}

/** Target rolling co-defend D12 — prefers `pomCoDefenderId`, falls back to `defenderId`. */
export function effectivePomCoDefenderId(turn: {
  pomCoDefenderId?: string | null;
  defenderId?: string | null;
} | null | undefined): string | undefined {
  if (!turn) return undefined;
  const id = turn.pomCoDefenderId ?? turn.defenderId;
  return id == null || id === '' ? undefined : id;
}

/**
 * Phase label for HUD (short status text).
 * Pass treatAsNormalAttack: true when the turn is a self-buff+attack (e.g. Beyond the Nimbus) so the label shows as normal attack, not power name.
 */
export function getPhaseLabel(
  phase: string,
  context?: { defenderName?: string; usedPowerName?: string; action?: string; treatAsNormalAttack?: boolean },
): string {
  switch (phase) {
    case PHASE.SELECT_TARGET:
      return 'selecting target...';
    case PHASE.SELECT_ACTION:
      return 'choosing action...';
    case PHASE.SELECT_SEASON:
      return 'choosing season...';
    case PHASE.SELECT_POEM:
      return 'choosing verse...';
    case PHASE.ROLLING_ATTACK:
      return 'rolling...';
    case PHASE.ROLLING_DEFEND:
      return context?.defenderName ? `→ ${context.defenderName} defending...` : 'defending...';
    case PHASE.RESOLVING:
      if (context?.treatAsNormalAttack)
        return context?.defenderName ? `→ ${context.defenderName}` : 'resolving...';
      if (context?.action === TURN_ACTION.POWER && !context?.usedPowerName) return 'Used a Power!';
      if (context?.action === TURN_ACTION.POWER && context?.usedPowerName)
        return `${context.usedPowerName} → ${context.defenderName ?? '...'}`;
      return context?.defenderName ? `→ ${context.defenderName}` : 'resolving...';
    case PHASE.ROLLING_FLORAL_HEAL:
      return 'Heal Crit';
    case PHASE.ROLLING_SPRING_HEAL:
      return 'Spring Heal';
    case PHASE.ROLLING_DISORIENTED_NO_EFFECT:
      return 'Disoriented';
    case PHASE.ROLLING_RAPID_FIRE_EXTRA_SHOT:
      return 'Rapid Fire';
    case PHASE.RESOLVING_RAPID_FIRE_EXTRA_SHOT:
      return 'Extra shot';
    case PHASE.RESOLVING_AFTER_RAPID_FIRE:
      return 'resolving...';
    case PHASE.ROLLING_POMEGRANATE_CO_ATTACK:
      return "Pomegranate Co-Attack";
    case PHASE.ROLLING_POMEGRANATE_CO_DEFEND:
      return context?.defenderName ? `Co vs ${context.defenderName}` : 'co defending...';
    case PHASE.DONE:
      return 'Done';
    default:
      return '';
  }
}
