import { doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { firestore } from '../../firebase';
import { FIRESTORE_COLLECTIONS } from '../../constants/fireStoreCollections';
import type { BagData, BagItemData } from '../../types/character';
import { BagItemType } from '../../constants/bag';
import { logActivity } from '../activityLog/activityLogService';

/** Strip undefined values so Firestore never receives them */
function clean(obj: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
}

/**
 * Bag Service - Functions for managing player inventory
 * These can be called from anywhere (not just React components)
 */

/**
 * Get current bag data for a user
 */
export async function getBagData(userId: string): Promise<BagData> {
  const docRef = doc(firestore, FIRESTORE_COLLECTIONS.PLAYER_BAGS, userId);
  const snapshot = await getDoc(docRef);

  if (snapshot.exists()) {
    return snapshot.data() as BagData;
  }

  return {};
}

/**
 * Merge metadata into an item while keeping its existing fields.
 */
export async function setBagItemData(
  userId: string,
  itemId: string,
  data: BagItemData
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(firestore, FIRESTORE_COLLECTIONS.PLAYER_BAGS, userId);
    const currentBag = await getBagData(userId);
    const currentItem = currentBag[itemId];

    if (!currentItem) {
      await setDoc(docRef, {
        [itemId]: clean(data),
      }, { merge: true });
      return { success: true };
    }

    await setDoc(docRef, {
      [itemId]: clean({ ...currentItem, ...data }),
    }, { merge: true });

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get amount of a specific item in a user's bag
 */
export async function getItemAmount(userId: string, itemId: string): Promise<number> {
  const bagData = await getBagData(userId);
  return bagData[itemId]?.amount ?? 0;
}

/**
 * Check if a user has a specific item (amount > 0)
 */
export async function hasItem(userId: string, itemId: string): Promise<boolean> {
  const amount = await getItemAmount(userId, itemId);
  return amount > 0;
}

/**
 * Add or update an item in a user's bag
 * If item exists, replaces the amount (doesn't add to it)
 * 
 * @param userId - Character ID
 * @param itemId - Item ID (e.g., 'item_001', 'weapon_sword_001')
 * @param amount - New amount to set
 * @param type - 'weapon' or 'item'
 * @returns Success status
 */
export async function setItemAmount(
  userId: string,
  itemId: string,
  amount: number,
  type: BagItemType,
  extraData?: Partial<BagItemData>
): Promise<{ success: boolean; error?: string }> {
  if (amount < 0) {
    return { success: false, error: 'Amount cannot be negative' };
  }

  try {
    const docRef = doc(firestore, FIRESTORE_COLLECTIONS.PLAYER_BAGS, userId);

    if (amount === 0) {
      // Remove item if amount is 0
      await updateDoc(docRef, {
        [itemId]: deleteField(),
      });
    } else {
      const currentBag = await getBagData(userId);
      const currentItem = currentBag[itemId];
      // Set or update item
      await setDoc(docRef, {
        [itemId]: clean({ ...currentItem, amount, type, ...extraData }),
      }, { merge: true });
    }

    return { success: true };
  } catch (error) {
    console.error('Error setting item amount:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Give items to a user (adds to existing amount)
 * Creates the item if it doesn't exist
 * 
 * @param userId - Character ID
 * @param itemId - Item ID
 * @param amount - Amount to add (must be positive)
 * @param type - 'weapon' or 'item'
 * @returns New total amount and success status
 */
export async function giveItem(
  userId: string,
  itemId: string,
  amount: number,
  type: BagItemType,
  extraData?: Partial<BagItemData>,
): Promise<{ success: boolean; newAmount?: number; error?: string }> {
  if (amount <= 0) {
    return { success: false, error: 'Amount must be positive' };
  }

  try {
    const currentAmount = await getItemAmount(userId, itemId);
    const newAmount = currentAmount + amount;

    const result = await setItemAmount(userId, itemId, newAmount, type, extraData);

    if (result.success) {
      return { success: true, newAmount };
    }

    return result;
  } catch (error) {
    // console.error('Error giving item:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Remove/consume items from a user's bag
 * Decrements the amount by the specified value
 * Removes the item entirely if amount reaches 0
 * 
 * @param userId - Character ID
 * @param itemId - Item ID
 * @param amount - Amount to remove (must be positive)
 * @returns New amount and success status
 */
export async function consumeItem(
  userId: string,
  itemId: string,
  amount: number = 1
): Promise<{ success: boolean; newAmount?: number; error?: string }> {
  if (amount <= 0) {
    return { success: false, error: 'Amount must be positive' };
  }

  try {
    const bagData = await getBagData(userId);
    const currentItem = bagData[itemId];

    if (!currentItem) {
      return { success: false, error: `Item ${itemId} not found in bag` };
    }

    const currentAmount = currentItem.amount;

    if (currentAmount < amount) {
      return {
        success: false,
        error: `Insufficient items. Has ${currentAmount}, tried to consume ${amount}`
      };
    }

    const newAmount = currentAmount - amount;
    const { amount: _a, type: _t, ...metadata } = currentItem;
    const result = await setItemAmount(userId, itemId, newAmount, currentItem.type, metadata);

    if (result.success) {
      return { success: true, newAmount };
    }

    return result;
  } catch (error) {
    // console.error('Error consuming item:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Remove an item completely from a user's bag
 * 
 * @param userId - Character ID
 * @param itemId - Item ID to remove
 */
export async function removeItem(
  userId: string,
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(firestore, FIRESTORE_COLLECTIONS.PLAYER_BAGS, userId);

    await updateDoc(docRef, {
      [itemId]: deleteField(),
    });

    return { success: true };
  } catch (error) {
    // console.error('Error removing item:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Transfer an item from one user to another
 * 
 * @param fromUserId - Source character ID
 * @param toUserId - Destination character ID
 * @param itemId - Item ID to transfer
 * @param amount - Amount to transfer
 * @returns Success status
 */
export async function transferItem(
  fromUserId: string,
  toUserId: string,
  itemId: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  if (amount <= 0) {
    return { success: false, error: 'Amount must be positive' };
  }

  try {
    // Get source item
    const sourceBag = await getBagData(fromUserId);
    const sourceItem = sourceBag[itemId];

    if (!sourceItem) {
      return { success: false, error: `Item ${itemId} not found in source bag` };
    }

    if (sourceItem.amount < amount) {
      return {
        success: false,
        error: `Insufficient items. Has ${sourceItem.amount}, tried to transfer ${amount}`
      };
    }

    // Remove from source
    const removeResult = await consumeItem(fromUserId, itemId, amount);
    // console.log('Remove result:', removeResult);
    if (!removeResult.success) {
      return removeResult;
    }

    // Add to destination
    const { amount: _amount, type: _type, ...metadata } = sourceItem;
    const giveResult = await giveItem(toUserId, itemId, amount, sourceItem.type, metadata);
    if (!giveResult.success) {
      // Rollback: give back to source
      await giveItem(fromUserId, itemId, amount, sourceItem.type, metadata);
      return giveResult;
    }

    logActivity({
      category: 'item',
      action: 'transfer_item',
      characterId: toUserId,
      performedBy: fromUserId,
      amount,
      metadata: { itemId },
    });
    return { success: true };
  } catch (error) {
    // console.error('Error transferring item:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Check if user has enough of an item
 * 
 * @param userId - Character ID
 * @param itemId - Item ID
 * @param requiredAmount - Required amount
 * @returns True if user has enough
 */
export async function hasEnoughItems(
  userId: string,
  itemId: string,
  requiredAmount: number
): Promise<boolean> {
  const currentAmount = await getItemAmount(userId, itemId);
  return currentAmount >= requiredAmount;
}

/**
 * Consume multiple items at once (for crafting, etc.)
 * All-or-nothing operation: either all items are consumed or none are
 * 
 * @param userId - Character ID
 * @param items - Array of {itemId, amount} to consume
 * @returns Success status
 */
export async function consumeMultipleItems(
  userId: string,
  items: Array<{ itemId: string; amount: number }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const bagData = await getBagData(userId);

    // First, check if user has all required items
    for (const { itemId, amount } of items) {
      const currentItem = bagData[itemId];
      if (!currentItem) {
        return { success: false, error: `Missing item: ${itemId}` };
      }
      if (currentItem.amount < amount) {
        return {
          success: false,
          error: `Insufficient ${itemId}. Has ${currentItem.amount}, needs ${amount}`
        };
      }
    }

    // If we get here, user has all items. Now consume them
    for (const { itemId, amount } of items) {
      const result = await consumeItem(userId, itemId, amount);
      if (!result.success) {
        // This shouldn't happen since we checked above, but handle it anyway
        return result;
      }
    }

    return { success: true };
  } catch (error) {
    // console.error('Error consuming multiple items:', error);
    return { success: false, error: (error as Error).message };
  }
}
