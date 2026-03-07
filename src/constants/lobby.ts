/**
 * Arena config game mode (invite a player or play vs NPC).
 */
export const GAME_MODE = {
  INVITE: 'invite',
  NPC: 'npc',
} as const;

export type GameMode = (typeof GAME_MODE)[keyof typeof GAME_MODE];

/**
 * Copy target for room code vs viewer link (used in Arena and ConfigArenaModal).
 */
export const COPY_TYPE = {
  CODE: 'code',
  LINK: 'link',
} as const;

export type CopyType = (typeof COPY_TYPE)[keyof typeof COPY_TYPE];
