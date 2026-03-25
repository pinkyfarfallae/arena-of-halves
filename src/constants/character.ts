/**
 * Canonical value for "unlocked" skill point (passive / skill / ultimate).
 */
export const SKILL_UNLOCK = 'unlock';

export function isSkillUnlocked(value: string | undefined): boolean {
  return value?.toLowerCase() === SKILL_UNLOCK;
}

/**
 * Default names for characters and actions.
 */
export const DEFAULT_NAMES = {
  SKELETON: 'skeleton',
  ATTACK: 'Attack',
} as const;
