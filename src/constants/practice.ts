export const PRACTICE_STATS = {
  STRENGTH: 'strength',
  MOBILITY: 'mobility',
  INTELLIGENCE: 'intelligence',
  TECHNIQUE: 'technique',
  EXPERIENCE: 'experience',
  FORTUNE: 'fortune',
};

export const PRACTICE_MODE = {
  NORMAL: 'admin',
  PVP: 'pvp', 
};

export const PRACTICE_STATES = {
  WAITING: 'waiting',
  LIVE: 'live',
  FINISHED: 'finished',
};

export type PracticeStat = (typeof PRACTICE_STATS)[keyof typeof PRACTICE_STATS];
export type PracticeMode = (typeof PRACTICE_MODE)[keyof typeof PRACTICE_MODE];
export type PracticeState = (typeof PRACTICE_STATES)[keyof typeof PRACTICE_STATES];

