export const PRICE_UNIT = {
  DRACHMA: 'drachma',
  NPC_GIFT_CARD: 'npc_gift_card',
} as const;

export type PriceUnit = typeof PRICE_UNIT[keyof typeof PRICE_UNIT];
