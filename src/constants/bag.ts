export const BAG_ITEM_TYPES = {
  ITEM: 'item',
} as const;

export type BagItemType = typeof BAG_ITEM_TYPES[keyof typeof BAG_ITEM_TYPES];