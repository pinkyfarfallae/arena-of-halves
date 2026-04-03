import { APPS_SCRIPT_URL } from "../../constants/sheets";
import { ACTIONS } from "../../constants/action";

/**
 * Upgrade a specific stat using training points
 * @param characterId - The character to upgrade
 * @param statId - The stat to upgrade (from PRACTICE_STATES)
 * @param pointsToSpend - Number of training points to spend
 * @returns Success status and updated values
 */
export async function upgradeStat(
  characterId: string,
  statId: string,
  pointsToSpend: number
): Promise<{
  success?: boolean;
  characterId?: string;
  stat?: string;
  previousValue?: number;
  newValue?: number;
  pointsSpent?: number;
  remainingPoints?: number;
  error?: string;
}> {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: ACTIONS.UPGRADE_STAT,
        characterId,
        statId,
        pointsToSpend,
      }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    return { error: 'Failed to upgrade stat' };
  }
}

/**
 * Get the cost to upgrade a stat from current level to next
 * Stats range from 0-5, cost is always 1 point per level
 */
export function getUpgradeCost(currentValue: number): number {
  if (currentValue >= 5) return 0; // Max level reached
  return 1; // Flat cost of 1 point per level
}

/**
 * Calculate how many levels can be gained with given points
 */
export function calculateLevelsFromPoints(currentValue: number, points: number): number {
  const maxLevel = 5;
  const availableLevels = maxLevel - currentValue;
  return Math.min(availableLevels, points);
}

/**
 * Refund a stat level and return the training point
 * @param characterId - The character to refund
 * @param statId - The stat to refund (from PRACTICE_STATES)
 * @returns Success status and updated values
 */
export async function refundStat(
  characterId: string,
  statId: string
): Promise<{
  success?: boolean;
  characterId?: string;
  stat?: string;
  previousValue?: number;
  newValue?: number;
  pointsRefunded?: number;
  remainingPoints?: number;
  error?: string;
}> {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: ACTIONS.REFUND_STAT,
        characterId,
        statId,
      }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    return { error: 'Failed to refund stat' };
  }
}

/**
 * Refund all training stats at once and return all spent training points.
 * The backend should zero all stats and add the total refunded TP back to the user.
 */
export async function refundAllStats(
  characterId: string
): Promise<{
  success?: boolean;
  characterId?: string;
  previousValues?: Record<string, number>;
  newValues?: Record<string, number>;
  pointsRefunded?: number;
  remainingPoints?: number;
  error?: string;
}> {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: ACTIONS.REFUND_ALL_STATS,
        characterId,
      }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    return { error: 'Failed to refund all stats' };
  }
}
