export const ARENA_ACTIONS = {
  CREATE: "create",
  JOIN: "join",
};

export type ArenaAction = (typeof ARENA_ACTIONS)[keyof typeof ARENA_ACTIONS];