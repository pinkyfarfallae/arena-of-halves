/**
 * Iris message phase values — use instead of string literals.
 */
export const IRIS_PHASE = {
  IDLE: 'idle',
  TOSSING: 'tossing',
  REVEAL: 'reveal',
} as const;

export type Phase = (typeof IRIS_PHASE)[keyof typeof IRIS_PHASE];

export const NEMESIS_RETALIATION = 'Nemesis Retaliation';
