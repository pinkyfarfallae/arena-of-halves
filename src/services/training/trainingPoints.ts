import { ACTIONS } from "../../constants/action";
import { APPS_SCRIPT_URL } from "../../constants/sheets";

/**
 * Update character training points (add or subtract)
 * @param characterId - The character to update
 * @param amount - Amount to add (positive) or subtract (negative)
 * @returns Success status and updated point values
 */
export async function updateTrainingPoints(
  characterId: string,
  amount: number
): Promise<{ 
  success?: boolean; 
  characterId?: string;
  previous?: number;
  change?: number;
  current?: number;
  error?: string;
}> {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: ACTIONS.UPDATE_TRAINING_POINTS,
        characterId,
        amount,
      }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error updating training points:', error);
    return { error: 'Failed to update training points' };
  }
}

/**
 * Add training points to a character
 * @param characterId - The character to update
 * @param amount - Amount to add (must be positive)
 */
export async function addTrainingPoints(
  characterId: string,
  amount: number
): Promise<{ 
  success?: boolean; 
  current?: number;
  error?: string;
}> {
  if (amount <= 0) {
    return { error: 'Amount must be positive' };
  }
  return updateTrainingPoints(characterId, amount);
}

/**
 * Subtract training points from a character (e.g., when spending on upgrades)
 * @param characterId - The character to update
 * @param amount - Amount to subtract (must be positive)
 */
export async function spendTrainingPoints(
  characterId: string,
  amount: number
): Promise<{ 
  success?: boolean; 
  current?: number;
  error?: string;
}> {
  if (amount <= 0) {
    return { error: 'Amount must be positive' };
  }
  return updateTrainingPoints(characterId, -amount);
}
