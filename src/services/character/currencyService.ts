import { APPS_SCRIPT_URL } from '../../constants/sheets';
import { ACTIONS } from '../../constants/action';

/**
 * Update character's drachma (currency)
 * Supports both additions (positive) and deductions (negative)
 * 
 * @param characterId - Character ID
 * @param amount - Amount to add (positive) or subtract (negative)
 * @returns Success status, previous amount, and new amount
 */
export async function updateCharacterDrachma(
  characterId: string,
  amount: number
): Promise<{ success: boolean; previous?: number; current?: number; error?: string }> {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: ACTIONS.UPDATE_CHARACTER_DRACHMA,
        characterId,
        amount,
      }),
    });

    const data = await res.json();
    return data;
  } catch (error) {
    // console.error('Error updating drachma:', error);
    return { success: false, error: (error as Error).message };
  }
}
