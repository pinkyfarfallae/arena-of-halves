import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { 
  getEquipmentData, 
  upgradeEquipment as upgradeEquipmentService,
  initializeEquipment as initializeEquipmentService,
  getNextTier,
  getUpgradeCost,
  canCreateCustomEquipment as checkCustomEquipment
} from '../services/equipment/equipmentService';
import { updateCharacterDrachma } from '../services/character/currencyService';
import { EquipmentCategory, EquipmentTier } from '../constants/equipment';

interface PlayerEquipmentData {
  weapon?: EquipmentTier;
  armor?: EquipmentTier;
  shield?: EquipmentTier;
  boots?: EquipmentTier;
}

/**
 * Hook for managing player equipment
 * Provides equipment data and upgrade functionality
 * 
 * @example
 * ```tsx
 * const { equipment, loading, upgradeEquipment, canAffordUpgrade } = useEquipment();
 * 
 * if (canAffordUpgrade('weapon', character.currency)) {
 *   await upgradeEquipment('weapon', character.characterId);
 * }
 * ```
 */
export function useEquipment() {
  const [equipment, setEquipment] = useState<PlayerEquipmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load equipment data on mount
  useEffect(() => {
    const loadEquipment = async () => {
      if (!auth.currentUser) {
        setLoading(false);
        return;
      }

      try {
        const data = await getEquipmentData(auth.currentUser.uid);
        setEquipment(data);

        // Auto-initialize if no equipment exists
        if (!data.weapon && !data.armor && !data.shield && !data.boots) {
          await initializeEquipmentService(auth.currentUser.uid);
          const newData = await getEquipmentData(auth.currentUser.uid);
          setEquipment(newData);
        }
      } catch (err) {
        console.error('Failed to load equipment:', err);
        setError('Failed to load equipment');
      } finally {
        setLoading(false);
      }
    };

    loadEquipment();
  }, []);

  /**
   * Upgrade a specific equipment category
   * Handles both equipment upgrade and currency deduction
   * 
   * @param category - Equipment category to upgrade
   * @param characterId - Character ID for currency updates
   * @returns Result with success status and new tier
   */
  const upgradeEquipment = async (
    category: EquipmentCategory,
    characterId: string
  ): Promise<{ success: boolean; message: string; newTier?: EquipmentTier }> => {
    if (!equipment || !auth.currentUser) {
      return { success: false, message: 'Equipment not loaded' };
    }

    const currentTier = equipment[category];
    const cost = getUpgradeCost(currentTier);

    try {
      // Upgrade equipment in Firestore
      const result = await upgradeEquipmentService(auth.currentUser.uid, category, equipment);

      if (result.success && result.newTier) {
        // Deduct currency from Google Sheets
        const currencyResult = await updateCharacterDrachma(characterId, -cost);

        if (currencyResult.success) {
          // Update local state
          setEquipment({
            ...equipment,
            [category]: result.newTier,
          });

          return { 
            success: true, 
            message: `Upgraded ${category} to ${result.newTier}`, 
            newTier: result.newTier 
          };
        } else {
          return { success: false, message: 'Equipment upgraded but failed to deduct currency' };
        }
      }

      return result;
    } catch (err) {
      console.error('Error upgrading equipment:', err);
      return { success: false, message: 'An error occurred during upgrade' };
    }
  };

  /**
   * Check if player can afford an upgrade
   */
  const canAffordUpgrade = (category: EquipmentCategory, currency: number): boolean => {
    if (!equipment) return false;
    const currentTier = equipment[category];
    const cost = getUpgradeCost(currentTier);
    return currency >= cost;
  };

  /**
   * Check if player can create custom equipment with given categories
   */
  const canCreateCustomEquipment = (categories: EquipmentCategory[]) => {
    if (!equipment) {
      return { canCreate: false, missingCategories: categories };
    }
    return checkCustomEquipment(equipment, categories);
  };

  /**
   * Refresh equipment data from Firestore
   */
  const refreshEquipment = async () => {
    if (!auth.currentUser) return;

    try {
      const data = await getEquipmentData(auth.currentUser.uid);
      setEquipment(data);
    } catch (err) {
      console.error('Failed to refresh equipment:', err);
    }
  };

  return {
    equipment,
    loading,
    error,
    upgradeEquipment,
    canAffordUpgrade,
    canCreateCustomEquipment,
    refreshEquipment,
  };
}
