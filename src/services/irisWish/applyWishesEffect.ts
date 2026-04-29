import { BAG_ITEM_TYPES } from "../../constants/bag";
import { DEITY } from "../../constants/deities";
import { ITEMS } from "../../constants/items";
import { FighterState } from "../../types/battle";
import { Wish } from "../../types/wish";
import { giveItem } from "../bag/bagService";
import { updateCharacterDrachma } from "../character/currencyService";
import { updateTrainingPoints } from "../training/trainingPoints";
import { logActivity } from '../activityLog/activityLogService';
import { tryAwardNikeBonusDrachma } from "../../data/wishes";

export const applyWishEffect = (wish: Wish, characterId: string) => {
  const { deity } = wish;
  switch (deity) {
    case DEITY.HERMES:
      giveItem(characterId, ITEMS.SHOP_30_DISCOUNT_TICKET, 1, BAG_ITEM_TYPES.ITEM);
      logActivity({
        category: 'item',
        action: 'give_item',
        characterId,
        performedBy: 'iris_wish',
        amount: 1,
        metadata: { source: 'iris_wish', itemId: ITEMS.SHOP_30_DISCOUNT_TICKET, deity: DEITY.HERMES },
      });
      break;
    case DEITY.HEBE:
      giveItem(characterId, ITEMS.HEALTH_POTION_S, 1, BAG_ITEM_TYPES.ITEM);
      logActivity({
        category: 'item',
        action: 'give_item',
        characterId,
        performedBy: 'iris_wish',
        amount: 1,
        metadata: { source: 'iris_wish', itemId: ITEMS.HEALTH_POTION_S, deity: DEITY.HEBE },
      });
      break;
    case DEITY.HECATE:
      updateTrainingPoints(characterId, 1);
      break;
    default:
      break;
  }
};

export const nikeAwardedAfterWinTheFight = async (teamMembers: FighterState[]) => {
  for (const member of teamMembers) {
    if (member.wishOfIris === DEITY.NIKE) {
      await tryAwardNikeBonusDrachma(member.characterId);
    }
  }
}