/**
 * Canonical value for "unlocked" skill point (passive / skill / ultimate).
 */
export const SKILL_UNLOCKED = 'unlocked';

/**
 * Check if a skill point slot is unlocked.
 * For passive/ultimate: checks for 'unlocked' string
 * For regular skills: checks numeric value (0 = locked, 1 = first slot, 2 = both slots)
 */
export function isSkillUnlocked(value: string | undefined): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  if (lower === SKILL_UNLOCKED) return true;
  // Also accept numeric string '1' or '2' as unlocked for skill points
  const num = parseInt(value, 10);
  return !isNaN(num) && num > 0;
}

/**
 * Get skill point level (0 = locked, 1 = first slot, 2 = both slots)
 * Returns 0 if locked, otherwise returns the numeric level
 */
export function getSkillPointLevel(value: string | undefined): number {
  if (!value) return 0;
  const lower = value.toLowerCase();
  if (lower === SKILL_UNLOCKED || lower === 'unlocked') return 2; // 'unlocked' = both slots
  const num = parseInt(value, 10);
  return isNaN(num) ? 0 : Math.max(0, Math.min(2, num));
}

/**
 * Default names for characters and actions.
 */
export const DEFAULT_NAMES = {
  SKELETON: 'skeleton',
  ATTACK: 'Attack',
} as const;
