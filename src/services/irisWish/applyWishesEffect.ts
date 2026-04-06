import { BAG_ITEM_TYPES } from "../../constants/bag";
import { DEITY } from "../../constants/deities";
import { Wish } from "../../types/wish";
import { giveItem } from "../bag/bagService";
import { updateTrainingPoints } from "../training/trainingPoints";

export const applyWishEffect = (wish: Wish, characterId: string) => {
  const { deity } = wish;
  switch (deity) {
    case DEITY.HEBE:
      const item = { itemId: 'health_potion_s', quantity: 1, type: BAG_ITEM_TYPES.ITEM };
      giveItem(characterId, item.itemId, item.quantity, item.type);
      break;
    case DEITY.HECATE:
      updateTrainingPoints(characterId, 1);
      break;
    default:
      break;
  }
};
