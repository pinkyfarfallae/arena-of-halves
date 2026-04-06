import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { firestore } from '../firebase';
import { FIRESTORE_COLLECTIONS } from '../constants/fireStoreCollections';
import type { BagData, BagEntry } from '../types/character';
import { BAG_ITEM_TYPES, BagItemType } from '../constants/bag';

/**
 * Custom hook for managing player bag data in Firestore
 * 
 * Structure in Firestore:
 * playerBags/{userId} = {
 *   itemId1: { amount: number, type: 'weapon' | 'item' },
 *   itemId2: { amount: number, type: 'weapon' | 'item' },
 *   ...
 * }
 */
export function useBag(userId: string | undefined) {
  const [bagData, setBagData] = useState<BagData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time subscription to bag data
  useEffect(() => {
    if (!userId) {
      setBagData({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const docRef = doc(firestore, FIRESTORE_COLLECTIONS.PLAYER_BAGS, userId);
    
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setBagData(snapshot.data() as BagData);
        } else {
          setBagData({});
        }
        setLoading(false);
      },
      (err) => {
        // console.error('Error fetching bag data:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // Convert bag data to array format (for backward compatibility)
  const bagEntries: BagEntry[] = Object.entries(bagData).map(([itemId, data]) => ({
    itemId,
    amount: data.amount,
    type: data.type,
  }));

  // Separate items and weapons
  const items = bagEntries.filter((entry) => entry.type === BAG_ITEM_TYPES.ITEM);
  const weapons = bagEntries.filter((entry) => entry.type === BAG_ITEM_TYPES.WEAPON);

  /**
   * Add or update an item in the bag
   * @param itemId - The item ID (e.g., 'item_001' or 'weapon_001')
   * @param amount - The amount to set
   * @param type - 'weapon' or 'item'
   */
  const addItem = async (itemId: string, amount: number, type: BagItemType) => {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (amount < 0) {
      throw new Error('Amount must be non-negative');
    }

    const docRef = doc(firestore, FIRESTORE_COLLECTIONS.PLAYER_BAGS, userId);
    
    try {
      await setDoc(docRef, {
        [itemId]: { amount, type },
      }, { merge: true });
    } catch (err) {
      // console.error('Error adding item:', err);
      throw err;
    }
  };

  /**
   * Update item amount (add or subtract)
   * @param itemId - The item ID
   * @param delta - Amount to add (positive) or subtract (negative)
   */
  const updateItemAmount = async (itemId: string, delta: number) => {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const currentItem = bagData[itemId];
    if (!currentItem) {
      throw new Error(`Item ${itemId} not found in bag`);
    }

    const newAmount = currentItem.amount + delta;
    
    if (newAmount < 0) {
      throw new Error('Cannot reduce amount below 0');
    }

    if (newAmount === 0) {
      // Remove item if amount reaches 0
      await removeItem(itemId);
    } else {
      await addItem(itemId, newAmount, currentItem.type);
    }
  };

  /**
   * Remove an item from the bag entirely
   * @param itemId - The item ID to remove
   */
  const removeItem = async (itemId: string) => {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const docRef = doc(firestore, FIRESTORE_COLLECTIONS.PLAYER_BAGS, userId);
    
    try {
      await updateDoc(docRef, {
        [itemId]: deleteField(),
      });
    } catch (err) {
      // console.error('Error removing item:', err);
      throw err;
    }
  };

  /**
   * Get amount of a specific item
   * @param itemId - The item ID
   * @returns The amount, or 0 if item not found
   */
  const getItemAmount = (itemId: string): number => {
    return bagData[itemId]?.amount ?? 0;
  };

  /**
   * Check if bag has a specific item
   * @param itemId - The item ID
   * @returns True if item exists with amount > 0
   */
  const hasItem = (itemId: string): boolean => {
    return (bagData[itemId]?.amount ?? 0) > 0;
  };

  return {
    // Data
    bagData,      // Raw Firestore data
    bagEntries,   // Array format with all items
    items,        // Array of items only
    weapons,      // Array of weapons only
    
    // State
    loading,
    error,
    
    // Getters
    getItemAmount,
    hasItem,
    
    // Mutations
    addItem,
    updateItemAmount,
    removeItem,
  };
}
