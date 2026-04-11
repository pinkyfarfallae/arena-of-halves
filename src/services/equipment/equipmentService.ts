import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { firestore } from '../../firebase';
import { FIRESTORE_COLLECTIONS } from '../../constants/fireStoreCollections';
import { 
  EQUIPMENT_CATEGORIES, 
  EQUIPMENT_TIERS, 
  UPGRADE_COSTS, 
  EquipmentCategory, 
  EquipmentTier 
} from '../../constants/equipment';
import { Character } from '../../types/character';

/**
 * Equipment data stored in Firestore per user
 */
interface PlayerEquipmentData {
  weapon?: EquipmentTier;
  armor?: EquipmentTier;
  shield?: EquipmentTier;
  boots?: EquipmentTier;
  custom?: {
    [itemId: string]: {
      tier: EquipmentTier;
      categories: string[]; // e.g., ['weapon', 'armor']
    };
  };
}

/**
 * Get equipment data for a character
 */
export const getEquipmentData = async (characterId: string): Promise<PlayerEquipmentData> => {
  try {
    const docRef = doc(firestore, FIRESTORE_COLLECTIONS.PLAYER_EQUIPMENT, characterId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as PlayerEquipmentData;
    }
    
    // Return default Level 1 equipment if not found
    return {
      weapon: EQUIPMENT_TIERS.LEVEL_1,
      armor: EQUIPMENT_TIERS.LEVEL_1,
      shield: EQUIPMENT_TIERS.LEVEL_1,
      boots: EQUIPMENT_TIERS.LEVEL_1,
    };
  } catch (error) {
    console.error('Error getting equipment data:', error);
    return {
      weapon: EQUIPMENT_TIERS.LEVEL_1,
      armor: EQUIPMENT_TIERS.LEVEL_1,
      shield: EQUIPMENT_TIERS.LEVEL_1,
      boots: EQUIPMENT_TIERS.LEVEL_1,
    };
  }
};

/**
 * Get the next tier for equipment
 */
export const getNextTier = (currentTier?: EquipmentTier): EquipmentTier | null => {
  if (!currentTier || currentTier === EQUIPMENT_TIERS.LEVEL_1) {
    return EQUIPMENT_TIERS.LEVEL_2;
  }
  if (currentTier === EQUIPMENT_TIERS.LEVEL_2) {
    return EQUIPMENT_TIERS.LEVEL_3;
  }
  return null; // Already at max level
};

/**
 * Get upgrade cost for moving from current tier to next
 */
export const getUpgradeCost = (currentTier?: EquipmentTier): number => {
  const nextTier = getNextTier(currentTier);
  if (!nextTier) return 0;
  return UPGRADE_COSTS[nextTier];
};

/**
 * Check if a character can afford an equipment upgrade
 */
export const canAffordUpgrade = (currency: number, currentTier?: EquipmentTier): boolean => {
  const cost = getUpgradeCost(currentTier);
  return currency >= cost;
};

/**
 * Upgrade equipment for a character
 * Note: This only updates the equipment tier in Firestore.
 * Currency must be handled separately through the character data system.
 */
export const upgradeEquipment = async (
  characterId: string,
  category: EquipmentCategory,
  currentEquipment: PlayerEquipmentData
): Promise<{ success: boolean; message: string; newTier?: EquipmentTier }> => {
  try {
    const currentTier = currentEquipment[category] || EQUIPMENT_TIERS.LEVEL_1;
    const nextTier = getNextTier(currentTier);

    if (!nextTier) {
      return { success: false, message: 'Equipment already at maximum level' };
    }

    const docRef = doc(firestore, FIRESTORE_COLLECTIONS.PLAYER_EQUIPMENT, characterId);
    
    // Update equipment with new tier
    const updatedEquipment = {
      ...currentEquipment,
      [category]: nextTier,
    };

    await setDoc(docRef, updatedEquipment, { merge: true });

    return { success: true, message: 'Equipment upgraded successfully', newTier: nextTier };
  } catch (error) {
    console.error('Error upgrading equipment:', error);
    return { success: false, message: 'Failed to upgrade equipment' };
  }
};

/**
 * Initialize all equipment at Level 1 for a character
 */
export const initializeEquipment = async (
  characterId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const docRef = doc(firestore, FIRESTORE_COLLECTIONS.PLAYER_EQUIPMENT, characterId);
    const docSnap = await getDoc(docRef);

    // Don't reinitialize if equipment already exists
    if (docSnap.exists()) {
      return { success: false, message: 'Equipment already initialized' };
    }

    const initialEquipment: PlayerEquipmentData = {
      [EQUIPMENT_CATEGORIES.WEAPON]: EQUIPMENT_TIERS.LEVEL_1,
      [EQUIPMENT_CATEGORIES.ARMOR]: EQUIPMENT_TIERS.LEVEL_1,
      [EQUIPMENT_CATEGORIES.SHIELD]: EQUIPMENT_TIERS.LEVEL_1,
      [EQUIPMENT_CATEGORIES.BOOTS]: EQUIPMENT_TIERS.LEVEL_1,
    };

    await setDoc(docRef, initialEquipment);

    return { success: true, message: 'Equipment initialized successfully' };
  } catch (error) {
    console.error('Error initializing equipment:', error);
    return { success: false, message: 'Failed to initialize equipment' };
  }
};

/**
 * Check if equipment allows creating custom equipment
 */
export const canCreateCustomEquipment = (
  equipment: PlayerEquipmentData,
  categories: EquipmentCategory[]
): { canCreate: boolean; missingCategories: EquipmentCategory[] } => {
  const missingCategories: EquipmentCategory[] = [];

  for (const category of categories) {
    const currentTier = equipment[category];
    if (currentTier !== EQUIPMENT_TIERS.LEVEL_3) {
      missingCategories.push(category);
    }
  }

  return {
    canCreate: missingCategories.length === 0,
    missingCategories,
  };
};

/**
 * Add a custom equipment item to player's equipment
 */
export const addCustomEquipment = async (
  characterId: string,
  itemId: string,
  categories: string[],
  initialTier: EquipmentTier = EQUIPMENT_TIERS.LEVEL_1
): Promise<{ success: boolean; message: string }> => {
  try {
    const docRef = doc(firestore, FIRESTORE_COLLECTIONS.PLAYER_EQUIPMENT, characterId);
    const docSnap = await getDoc(docRef);

    let equipment: PlayerEquipmentData;

    if (!docSnap.exists()) {
      // Auto-initialize equipment if it doesn't exist
      equipment = {
        [EQUIPMENT_CATEGORIES.WEAPON]: EQUIPMENT_TIERS.LEVEL_1,
        [EQUIPMENT_CATEGORIES.ARMOR]: EQUIPMENT_TIERS.LEVEL_1,
        [EQUIPMENT_CATEGORIES.SHIELD]: EQUIPMENT_TIERS.LEVEL_1,
        [EQUIPMENT_CATEGORIES.BOOTS]: EQUIPMENT_TIERS.LEVEL_1,
      };
      await setDoc(docRef, equipment);
    } else {
      equipment = docSnap.data() as PlayerEquipmentData;
    }

    // Check if player has all required categories at Level 3
    const missingCategories = categories.filter(cat => {
      const categoryKey = cat as EquipmentCategory;
      return equipment[categoryKey] !== EQUIPMENT_TIERS.LEVEL_3;
    });

    if (missingCategories.length > 0) {
      return { 
        success: false, 
        message: `Player needs these categories at Level 3: ${missingCategories.join(', ')}` 
      };
    }

    // Add custom equipment
    const customEquipment = equipment.custom || {};
    customEquipment[itemId] = {
      tier: initialTier,
      categories: categories,
    };

    await updateDoc(docRef, {
      custom: customEquipment,
    });

    return { success: true, message: 'Custom equipment added successfully' };
  } catch (error) {
    console.error('Error adding custom equipment:', error);
    return { success: false, message: 'Failed to add custom equipment' };
  }
};

/**
 * Upgrade a custom equipment item's tier
 */
export const upgradeCustomEquipment = async (
  characterId: string,
  itemId: string
): Promise<{ success: boolean; message: string; newTier?: EquipmentTier }> => {
  try {
    const docRef = doc(firestore, FIRESTORE_COLLECTIONS.PLAYER_EQUIPMENT, characterId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, message: 'Player equipment not found' };
    }

    const equipment = docSnap.data() as PlayerEquipmentData;
    const customItem = equipment.custom?.[itemId];

    if (!customItem) {
      return { success: false, message: 'Custom equipment not found' };
    }

    const nextTier = getNextTier(customItem.tier);
    if (!nextTier) {
      return { success: false, message: 'Custom equipment already at max level' };
    }

    // Update the tier
    const updatedCustom = { ...equipment.custom };
    updatedCustom[itemId] = {
      ...customItem,
      tier: nextTier,
    };

    await updateDoc(docRef, {
      custom: updatedCustom,
    });

    return { success: true, message: 'Custom equipment upgraded', newTier: nextTier };
  } catch (error) {
    console.error('Error upgrading custom equipment:', error);
    return { success: false, message: 'Failed to upgrade custom equipment' };
  }
};

/**
 * Remove a custom equipment item from player's equipment
 */
export const removeCustomEquipment = async (
  characterId: string,
  itemId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const docRef = doc(firestore, FIRESTORE_COLLECTIONS.PLAYER_EQUIPMENT, characterId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, message: 'Player equipment not found' };
    }

    const equipment = docSnap.data() as PlayerEquipmentData;

    if (!equipment.custom?.[itemId]) {
      return { success: false, message: 'Custom equipment not found' };
    }

    const updatedCustom = { ...equipment.custom };
    delete updatedCustom[itemId];

    await updateDoc(docRef, {
      custom: updatedCustom,
    });

    return { success: true, message: 'Custom equipment removed' };
  } catch (error) {
    console.error('Error removing custom equipment:', error);
    return { success: false, message: 'Failed to remove custom equipment' };
  }
};

/**
 * Get all custom equipment for a player
 */
export const getPlayerCustomEquipment = async (
  characterId: string
): Promise<{ [itemId: string]: { tier: EquipmentTier; categories: string[] } }> => {
  try {
    const equipment = await getEquipmentData(characterId);
    return equipment.custom || {};
  } catch (error) {
    console.error('Error getting custom equipment:', error);
    return {};
  }
};


