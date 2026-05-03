import { APPS_SCRIPT_URL } from '../../constants/sheets';
import { ACTIONS } from '../../constants/action';
import { getBagData, setBagItemData } from '../bag/bagService';
import { ITEMS } from '../../constants/items';
import { logActivity } from '../activityLog/activityLogService';
import { ACTIVITY_LOG_ACTIONS } from '../../constants/activityLog';

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
  amount: number,
  options?: { skipHermesTracking?: boolean; performedBy?: string; source?: string; extraMetadata?: Record<string, any> }
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

    if (data.success) {
      if (amount > 0 && !options?.skipHermesTracking) {
        applyHermesPurseIncome(characterId, amount).catch(() => {});
      }
      try {
        logActivity({
          category: 'drachma',
          action: amount >= 0 ? ACTIVITY_LOG_ACTIONS.AWARD : ACTIVITY_LOG_ACTIONS.DEDUCT,
          characterId,
          performedBy: options?.performedBy ?? characterId,
          amount: Math.abs(amount),
          metadata: { 
            source: options?.source ?? 'unknown', 
            delta: amount,
            previous: data.previous,
            current: data.current,
            ...(options?.extraMetadata ?? {}),
          },
        });
      } catch (_e) {
        // Secondary effects must not propagate and roll back the daily claim
      }
    }

    return data;
  } catch (error) {
    // console.error('Error updating drachma:', error);
    return { success: false, error: (error as Error).message };
  }
}

async function applyHermesPurseIncome(characterId: string, amount: number): Promise<void> {
  const bagData = await getBagData(characterId);
  const purse = bagData[ITEMS.HERMES_S_PURSE];
  const statue = bagData[ITEMS.NIKE_S_STATUE];

  if (!purse || !statue || purse.available === false) {
    return;
  }

  const nextIncome = (purse.income ?? 0) + amount;

  await setBagItemData(characterId, ITEMS.HERMES_S_PURSE, {
    amount: purse.amount,
    type: purse.type,
    income: nextIncome,
    available: true,
  }, {
    performedBy: characterId,
    source: 'hermes_purse_tracking',
  });

  if (nextIncome >= 1000) {
    const bonusResult = await updateCharacterDrachma(characterId, 500, {
      skipHermesTracking: true,
      source: 'hermes_purse_bonus',
    });

    if (bonusResult.success) {
      await setBagItemData(characterId, ITEMS.HERMES_S_PURSE, {
        amount: purse.amount,
        type: purse.type,
        income: nextIncome,
        available: false,
      }, {
        performedBy: characterId,
        source: 'hermes_purse_bonus',
      });
    }
  }
}
