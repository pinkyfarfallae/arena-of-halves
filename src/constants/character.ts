import { POWER_TYPES } from "./powers";

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
  if (lower === SKILL_UNLOCKED) return 2; // 'unlocked' = both slots
  const num = parseInt(value, 10);
  return isNaN(num) ? 0 : Math.max(0, Math.min(2, num));
}

/**
 * Get skill level for any power type
 * @param powerType - Power type (Passive, 1st Skill, 2nd Skill, Ultimate)
 * @param skillPointValue - The skill point value from character
 * @returns Current level (0 = locked, 1 = unlocked for passive/ultimate, 1-2 for skills)
 */
export function getPowerLevel(powerType: string, skillPointValue: string | undefined): number {
  if (!skillPointValue) return 0;
  
  const lower = skillPointValue.toLowerCase();
  
  // For regular skills (1st/2nd), return numeric level 0-2
  if (powerType === POWER_TYPES.FIRST_SKILL || powerType === POWER_TYPES.SECOND_SKILL) {
    if (lower === SKILL_UNLOCKED) return 2;
    const num = parseInt(skillPointValue, 10);
    return isNaN(num) ? 0 : Math.max(0, Math.min(2, num));
  }
  
  // For passive/ultimate, return 0 (locked) or 1 (unlocked)
  return lower === SKILL_UNLOCKED ? 1 : 0;
}

/**
 * Get maximum skill level for a power type
 * @param powerType - Power type (Passive, 1st Skill, 2nd Skill, Ultimate)
 * @returns Max level (1 for passive/ultimate, 2 for skills)
 */
export function getMaxPowerLevel(powerType: string): number {
  return powerType === POWER_TYPES.FIRST_SKILL || powerType === POWER_TYPES.SECOND_SKILL ? 2 : 1;
}

/**
 * Check if a power is unlocked for a character
 * @param powerType - Power type (Passive, 1st Skill, 2nd Skill, Ultimate)
 * @param character - Character with skill point values
 * @returns true if the power is unlocked
 */
export function isPowerUnlocked(powerType: string, character: { passiveSkillPoint?: string; skillPoint?: string; ultimateSkillPoint?: string }): boolean {
  if (powerType === POWER_TYPES.PASSIVE) {
    return getPowerLevel(powerType, character.passiveSkillPoint) > 0;
  }
  if (powerType === POWER_TYPES.FIRST_SKILL) {
    return getPowerLevel(powerType, character.skillPoint) > 0;
  }

  if (powerType === POWER_TYPES.SECOND_SKILL) {
    return getPowerLevel(powerType, character.skillPoint) > 1;
  }
  
  if (powerType === POWER_TYPES.ULTIMATE) {
    return getPowerLevel(powerType, character.ultimateSkillPoint) > 0;
  }
  return false;
}

/**
 * Default names for characters and actions.
 */
export const DEFAULT_NAMES = {
  SKELETON: 'skeleton',
  ATTACK: 'Attack',
} as const;
