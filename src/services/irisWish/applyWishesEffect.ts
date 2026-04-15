import { BAG_ITEM_TYPES } from "../../constants/bag";
import { DEITY } from "../../constants/deities";
import { ITEMS } from "../../constants/items";
import { FighterState } from "../../types/battle";
import { Wish } from "../../types/wish";
import { giveItem } from "../bag/bagService";
import { updateCharacterDrachma } from "../character/currencyService";
import { updateTrainingPoints } from "../training/trainingPoints";

export const applyWishEffect = (wish: Wish, characterId: string) => {
  const { deity } = wish;
  switch (deity) {
    case DEITY.HERMES:
      giveItem(characterId, ITEMS.SHOP_30_DISCOUNT_TICKET, 1, BAG_ITEM_TYPES.ITEM);
      break;
    case DEITY.HEBE:
      giveItem(characterId, ITEMS.HEALTH_POTION_S, 1, BAG_ITEM_TYPES.ITEM);
      break;
    case DEITY.HECATE:
      updateTrainingPoints(characterId, 1);
      break;
    default:
      break;
  }
};

export const nikeAwardedAfterWinTheFight = (teamMembers: FighterState[]) => {
  teamMembers.forEach(member => {
    if (member.wishOfIris === DEITY.NIKE) {
      updateCharacterDrachma(member.characterId, 100);
    }
  });
}