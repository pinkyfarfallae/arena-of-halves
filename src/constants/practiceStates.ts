export const PRACTICE_STATES = {
  STRENGTH: 'strength',
  MOBILITY: 'mobility',
  INTELLIGENCE: 'intelligence',
  TECHNIQUE: 'technique',
  EXPERIENCE: 'experience',
  FORTUNE: 'fortune',
}

export type PracticeState = (typeof PRACTICE_STATES)[keyof typeof PRACTICE_STATES];

