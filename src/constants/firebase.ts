/**
 * Firebase database paths and event types.
 * Use these constants instead of hardcoded strings when interacting with Firebase.
 */

/**
 * Firebase database root paths.
 */
export const FIREBASE_PATHS = {
  ARENAS: 'arenas',
  TRAINING_QUOTAS: 'trainingQuotas',
} as const;

/**
 * Firebase event types for onValue/off listeners.
 */
export const FIREBASE_EVENTS = {
  VALUE: 'value',
} as const;
