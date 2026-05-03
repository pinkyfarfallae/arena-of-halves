import { BAG_ITEM_TYPES } from "../../constants/bag";
import { ACTIONS } from "../../constants/action";
import { DEITY } from "../../constants/deities";
import { ITEMS } from "../../constants/items";
import { FighterState } from "../../types/battle";
import { Wish } from "../../types/wish";
import { giveItem } from "../bag/bagService";
import { updateCharacterDrachma } from "../character/currencyService";
import { updateTrainingPoints } from "../training/trainingPoints";
import { logActivity } from '../activityLog/activityLogService';
import { tryAwardNikeBonusDrachma } from "../../data/wishes";
import { ACTIVITY_LOG_ACTIONS } from "../../constants/activityLog";

export const applyWishEffect = (wish: Wish, characterId: string) => {
  const { deity } = wish;
  switch (deity) {
    case DEITY.HERMES:
      giveItem(characterId, ITEMS.SHOP_30_DISCOUNT_TICKET, 1, BAG_ITEM_TYPES.ITEM, undefined, 'iris_wish_hermes');
      logActivity({
        category: 'item',
        action: ACTIVITY_LOG_ACTIONS.GIVE_ITEM,
        characterId,
        performedBy: 'iris_wish',
        amount: 1,
        metadata: { source: 'iris_wish', itemId: ITEMS.SHOP_30_DISCOUNT_TICKET, deity: DEITY.HERMES },
      });
      break;
    case DEITY.HEBE:
      giveItem(characterId, ITEMS.HEALTH_POTION_S, 1, BAG_ITEM_TYPES.ITEM, undefined, 'iris_wish_hebe');
      logActivity({
        category: 'item',
        action: ACTIVITY_LOG_ACTIONS.GIVE_ITEM,
        characterId,
        performedBy: 'iris_wish',
        amount: 1,
        metadata: { source: 'iris_wish', itemId: ITEMS.HEALTH_POTION_S, deity: DEITY.HEBE },
      });
      break;
    case DEITY.HECATE:
      updateTrainingPoints(characterId, 1, {
        source: 'iris_wish_hecate',
        performedBy: 'iris_wish',
      });
      logActivity({
        category: 'stat',
        action: ACTIVITY_LOG_ACTIONS.ADD_TRAINING_POINTS,
        characterId,
        performedBy: 'iris_wish',
        amount: 1,
        metadata: { source: 'iris_wish_hecate', deity: DEITY.HECATE },
      });
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