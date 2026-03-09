/**
 * Canonical value for "unlocked" skill point (passive / skill / ultimate).
 */
export const SKILL_UNLOCK = 'unlock' as const;

export function isSkillUnlocked(value: string | undefined): boolean {
  return value?.toLowerCase() === SKILL_UNLOCK;
}
