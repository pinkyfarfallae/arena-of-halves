/**
 * Turn phases — use when setting or comparing turn.phase.
 */
export const PHASE = {
  SELECT_TARGET: 'select-target',
  SELECT_ACTION: 'select-action',
  SELECT_SEASON: 'select-season',
  ROLLING_ATTACK: 'rolling-attack',
  ROLLING_DEFEND: 'rolling-defend',
  RESOLVING: 'resolving',
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
  A: 'teamA',
  B: 'teamB',
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
  BATTLE_WINNER: 'battle/winner',
  BATTLE_TURN_QUEUE: 'battle/turnQueue',
  BATTLE_CURRENT_TURN_INDEX: 'battle/currentTurnIndex',
  BATTLE_ROUND_NUMBER: 'battle/roundNumber',
  BATTLE_TURN_ATTACK_ROLL: 'battle/turn/attackRoll',
  BATTLE_TURN_DEFEND_ROLL: 'battle/turn/defendRoll',
  BATTLE_TURN_PHASE: 'battle/turn/phase',
  BATTLE_TURN_SELECTED_SEASON: 'battle/turn/selectedSeason',
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
 * Phase label for HUD (short status text).
 */
export function getPhaseLabel(
  phase: string,
  context?: { defenderName?: string; usedPowerName?: string; action?: string },
): string {
  switch (phase) {
    case PHASE.SELECT_TARGET:
      return 'selecting target...';
    case PHASE.SELECT_ACTION:
      return 'choosing action...';
    case PHASE.SELECT_SEASON:
      return 'choosing season...';
    case PHASE.ROLLING_ATTACK:
      return 'rolling...';
    case PHASE.ROLLING_DEFEND:
      return context?.defenderName ? `→ ${context.defenderName} defending...` : 'defending...';
    case PHASE.RESOLVING:
      if (context?.action === TURN_ACTION.POWER && !context?.usedPowerName) return 'used a power!';
      if (context?.action === TURN_ACTION.POWER && context?.usedPowerName)
        return `${context.usedPowerName} → ${context.defenderName ?? '...'}`;
      return context?.defenderName ? `→ ${context.defenderName}` : 'resolving...';
    case PHASE.DONE:
      return 'done';
    default:
      return '';
  }
}
