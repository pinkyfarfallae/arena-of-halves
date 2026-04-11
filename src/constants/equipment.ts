import { MOD_STAT } from "./effectTypes";

export const EQUIPMENT_CATEGORIES = {
  WEAPON: 'weapon',
  ARMOR: 'armor',
  SHIELD: 'shield',
  BOOTS: 'boots',
} as const;

export type EquipmentCategory = typeof EQUIPMENT_CATEGORIES[keyof typeof EQUIPMENT_CATEGORIES];

export const EQUIPMENT_TIERS = {
  LEVEL_1: 'level_1',
  LEVEL_2: 'level_2',
  LEVEL_3: 'level_3',
} as const;

export type EquipmentTier = typeof EQUIPMENT_TIERS[keyof typeof EQUIPMENT_TIERS];

export const UPGRADE_COSTS = {
  [EQUIPMENT_TIERS.LEVEL_1]: 0,
  [EQUIPMENT_TIERS.LEVEL_2]: 500,
  [EQUIPMENT_TIERS.LEVEL_3]: 1000,
};

export interface Equipment {
  id: string;
  name: string;
  category: EquipmentCategory;
  tier: EquipmentTier;
  baseStats: EquipmentStats;
  currentStats: EquipmentStats;
  custom?: boolean;
  abilities?: string[];
}

export interface EquipmentStats {
  damage?: number;
  defense?: number;
  healing?: number;
  speed?: number;
}

export interface CustomEquipmentRequest {
  characterId: string;
  equipment: Omit<Equipment, 'id' | 'tier'>;
  requiredUpgrades: Record<EquipmentCategory, EquipmentTier>;
}

export const EQUIPMENT_CATEGORY_ABILITIES = {
  [EQUIPMENT_CATEGORIES.WEAPON]: [MOD_STAT.ATTACK_DICE_UP],
  [EQUIPMENT_CATEGORIES.ARMOR]: [MOD_STAT.MAX_HP],
  [EQUIPMENT_CATEGORIES.SHIELD]: [MOD_STAT.DEFEND_DICE_UP],
  [EQUIPMENT_CATEGORIES.BOOTS]: [MOD_STAT.SPEED],
};

export const EQUIPMENT_CATEGORY_LABELS = {
  [EQUIPMENT_CATEGORIES.WEAPON]: 'Weapon',
  [EQUIPMENT_CATEGORIES.ARMOR]: 'Armor',
  [EQUIPMENT_CATEGORIES.SHIELD]: 'Shield',
  [EQUIPMENT_CATEGORIES.BOOTS]: 'Boots',
};

export type EquipmentCategoryLabel = typeof EQUIPMENT_CATEGORY_LABELS[keyof typeof EQUIPMENT_CATEGORY_LABELS];

export const EQUIPMENT_CATEGORY_DESCRIPTIONS = {
  [EQUIPMENT_CATEGORIES.WEAPON]: 'Increases attack damage and dice rolls',
  [EQUIPMENT_CATEGORIES.ARMOR]: 'Increases maximum HP and healing received',
  [EQUIPMENT_CATEGORIES.SHIELD]: 'Increases defense and defensive dice rolls',
  [EQUIPMENT_CATEGORIES.BOOTS]: 'Increases speed and turn priority',
};

export const TIER_LABELS = {
  [EQUIPMENT_TIERS.LEVEL_1]: 'Level 1',
  [EQUIPMENT_TIERS.LEVEL_2]: 'Level 2',
  [EQUIPMENT_TIERS.LEVEL_3]: 'Level 3',
};

export const TIER_MATERIAL_LABELS = {
  [EQUIPMENT_TIERS.LEVEL_1]: 'Wooden',
  [EQUIPMENT_TIERS.LEVEL_2]: 'Iron',
  [EQUIPMENT_TIERS.LEVEL_3]: 'Bronze',
};

export const EQUIPMENT_TIER_NAMES = {
  [EQUIPMENT_CATEGORIES.WEAPON]: {
    [EQUIPMENT_TIERS.LEVEL_1]: 'Wooden Weapon',
    [EQUIPMENT_TIERS.LEVEL_2]: 'Iron Weapon',
    [EQUIPMENT_TIERS.LEVEL_3]: 'Bronze Weapon',
  },
  [EQUIPMENT_CATEGORIES.ARMOR]: {
    [EQUIPMENT_TIERS.LEVEL_1]: 'Wooden Armor',
    [EQUIPMENT_TIERS.LEVEL_2]: 'Iron Armor',
    [EQUIPMENT_TIERS.LEVEL_3]: 'Bronze Armor',
  },
  [EQUIPMENT_CATEGORIES.SHIELD]: {
    [EQUIPMENT_TIERS.LEVEL_1]: 'Wooden Shield',
    [EQUIPMENT_TIERS.LEVEL_2]: 'Iron Shield',
    [EQUIPMENT_TIERS.LEVEL_3]: 'Bronze Shield',
  },
  [EQUIPMENT_CATEGORIES.BOOTS]: {
    [EQUIPMENT_TIERS.LEVEL_1]: 'Basic Sneakers',
    [EQUIPMENT_TIERS.LEVEL_2]: 'Leather Boots',
    [EQUIPMENT_TIERS.LEVEL_3]: 'Winged Boots',
  },
};

export const EQUIPMENT_TIER_EFFECTS = {
  [EQUIPMENT_CATEGORIES.WEAPON]: {
    [EQUIPMENT_TIERS.LEVEL_1]: '+1 attack dice',
    [EQUIPMENT_TIERS.LEVEL_2]: '+1 damage',
    [EQUIPMENT_TIERS.LEVEL_3]: '25% critical hit chance',
  },
  [EQUIPMENT_CATEGORIES.ARMOR]: {
    [EQUIPMENT_TIERS.LEVEL_1]: '+2 HP',
    [EQUIPMENT_TIERS.LEVEL_2]: '+3 HP',
    [EQUIPMENT_TIERS.LEVEL_3]: '+5 HP',
  },
  [EQUIPMENT_CATEGORIES.SHIELD]: {
    [EQUIPMENT_TIERS.LEVEL_1]: '+1 defense dice',
    [EQUIPMENT_TIERS.LEVEL_2]: '+2 defense dice',
    [EQUIPMENT_TIERS.LEVEL_3]: 'Reduces incoming damage by 2',
  },
  [EQUIPMENT_CATEGORIES.BOOTS]: {
    [EQUIPMENT_TIERS.LEVEL_1]: '+2 speed',
    [EQUIPMENT_TIERS.LEVEL_2]: '+3 speed',
    [EQUIPMENT_TIERS.LEVEL_3]: 'Gain 3 rerolls per battle',
  },
};