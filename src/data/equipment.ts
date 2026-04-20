import { EQUIPMENT_TIER_NAMES, EquipmentCategory, EquipmentTier } from "../constants/equipment";

export const getNonCustomEquipmentName = (key: EquipmentCategory, tier: EquipmentTier) => {
  return EQUIPMENT_TIER_NAMES[key][tier];
}



