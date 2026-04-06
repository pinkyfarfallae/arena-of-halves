/**
 * BAG SERVICE USAGE EXAMPLES
 * 
 * This file demonstrates how to use the bag service functions
 * for managing player inventory across your application.
 */

import { BAG_ITEM_TYPES, BagItemType } from '../../constants/bag';
import {
  giveItem,
  consumeItem,
  getItemAmount,
  hasItem,
  hasEnoughItems,
  transferItem,
  consumeMultipleItems,
  removeItem,
} from './bagService';

/* ═══════════════════════════════════════════════════
   BASIC OPERATIONS
   ═══════════════════════════════════════════════════ */

// Example 1: Give items to a player (e.g., shop purchase, quest reward)
async function handleShopPurchase(userId: string) {
  const result = await giveItem(userId, 'item_potion_001', 5, 'item');

  if (result.success) {
    // console.log(`Player now has ${result.newAmount} potions`);
  } else {
    // console.error(`Failed: ${result.error}`);
  }
}

// Example 2: Consume an item (e.g., use healing potion)
async function useHealingPotion(userId: string) {
  const result = await consumeItem(userId, 'item_potion_001', 1);

  if (result.success) {
    // console.log(`Used potion! ${result.newAmount} remaining`);
    // Apply healing effect here
  } else {
    // console.error(`Cannot use potion: ${result.error}`);
  }
}

// Example 3: Check if player has an item
async function canEquipSword(userId: string) {
  const hasSword = await hasItem(userId, 'weapon_sword_001');

  if (hasSword) {
    // console.log('Player can equip sword');
  } else {
    // console.log('Player does not have sword');
  }
}

// Example 4: Check specific amount
async function checkPotionCount(userId: string) {
  const potionCount = await getItemAmount(userId, 'item_potion_001');
  // console.log(`Player has ${potionCount} potions`);
}

/* ═══════════════════════════════════════════════════
   SHOP SYSTEM
   ═══════════════════════════════════════════════════ */

async function buyItem(
  userId: string,
  itemId: string,
  price: number,
  amount: number,
  type: BagItemType
) {
  // Check if player has enough drachma (currency check would go here)
  // ...

  // Give the item
  const result = await giveItem(userId, itemId, amount, type);

  if (result.success) {
    // Deduct currency
    // await updateCharacterDrachma(userId, -price);
    return { success: true, message: `Purchased ${amount}x ${itemId}` };
  }

  return { success: false, message: result.error };
}

/* ═══════════════════════════════════════════════════
   CRAFTING SYSTEM
   ═══════════════════════════════════════════════════ */

async function craftItem(userId: string) {
  // Example: Craft a sword requires 3 iron + 2 wood
  const recipe = [
    { itemId: 'item_iron_001', amount: 3 },
    { itemId: 'item_wood_001', amount: 2 },
  ];

  // Check if has all materials
  for (const { itemId, amount } of recipe) {
    const hasEnough = await hasEnoughItems(userId, itemId, amount);
    if (!hasEnough) {
      return { success: false, message: `Not enough ${itemId}` };
    }
  }

  // Consume all materials at once
  const consumeResult = await consumeMultipleItems(userId, recipe);

  if (!consumeResult.success) {
    return { success: false, message: consumeResult.error };
  }

  // Give crafted item
  const giveResult = await giveItem(userId, 'weapon_sword_001', 1, BAG_ITEM_TYPES.WEAPON);

  if (giveResult.success) {
    return { success: true, message: 'Sword crafted successfully!' };
  }

  // If giving fails, we should refund materials (error recovery)
  return { success: false, message: giveResult.error };
}

/* ═══════════════════════════════════════════════════
   BATTLE SYSTEM
   ═══════════════════════════════════════════════════ */

async function useBattleItem(userId: string, itemId: string) {
  // Check if player has the item
  const has = await hasItem(userId, itemId);

  if (!has) {
    return { success: false, message: 'Item not found in inventory' };
  }

  // Consume the item
  const result = await consumeItem(userId, itemId, 1);

  if (result.success) {
    // Apply item effect based on itemId
    if (itemId === 'item_potion_001') {
      // Heal player
      return { success: true, message: 'Healed 50 HP', effect: 'heal' };
    } else if (itemId === 'item_bomb_001') {
      // Damage enemy
      return { success: true, message: 'Dealt 30 damage', effect: 'damage' };
    }
  }

  return { success: false, message: result.error };
}

/* ═══════════════════════════════════════════════════
   TRADING SYSTEM
   ═══════════════════════════════════════════════════ */

async function tradeItem(
  fromUserId: string,
  toUserId: string,
  itemId: string,
  amount: number
) {
  // Check if source player has the item
  const hasEnough = await hasEnoughItems(fromUserId, itemId, amount);

  if (!hasEnough) {
    return {
      success: false,
      message: 'Source player does not have enough items'
    };
  }

  // Transfer the item
  const result = await transferItem(fromUserId, toUserId, itemId, amount);

  if (result.success) {
    return {
      success: true,
      message: `Transferred ${amount}x ${itemId}`
    };
  }

  return { success: false, message: result.error };
}

/* ═══════════════════════════════════════════════════
   ADMIN TOOLS
   ═══════════════════════════════════════════════════ */

async function grantReward(userId: string, rewardType: string) {
  switch (rewardType) {
    case 'starter_pack':
      // Give multiple items
      await giveItem(userId, 'item_potion_001', 10, BAG_ITEM_TYPES.ITEM);
      await giveItem(userId, 'weapon_sword_001', 1, BAG_ITEM_TYPES.WEAPON);
      await giveItem(userId, 'item_bread_001', 5, BAG_ITEM_TYPES.ITEM);
      return { success: true, message: 'Starter pack granted!' };

    case 'vip_reward':
      await giveItem(userId, 'item_rare_gem_001', 1, BAG_ITEM_TYPES.ITEM);
      return { success: true, message: 'VIP reward granted!' };

    default:
      return { success: false, message: 'Unknown reward type' };
  }
}

async function clearInventory(userId: string, itemId: string) {
  const result = await removeItem(userId, itemId);

  if (result.success) {
    return { success: true, message: `Removed ${itemId} from inventory` };
  }

  return { success: false, message: result.error };
}

/* ═══════════════════════════════════════════════════
   ERROR HANDLING
   ═══════════════════════════════════════════════════ */

async function safeConsumeItem(userId: string, itemId: string) {
  try {
    // Check first if has item
    const currentAmount = await getItemAmount(userId, itemId);

    if (currentAmount === 0) {
      // console.warn(`Player ${userId} does not have ${itemId}`);
      return { success: false, message: 'Item not found' };
    }

    // Consume
    const result = await consumeItem(userId, itemId, 1);

    if (result.success) {
      // console.log(`Consumed ${itemId}. Remaining: ${result.newAmount}`);
      return { success: true, remaining: result.newAmount };
    }

    // console.error(`Failed to consume ${itemId}: ${result.error}`);
    return { success: false, message: result.error };

  } catch (error) {
    // console.error('Unexpected error:', error);
    return {
      success: false,
      message: 'An unexpected error occurred'
    };
  }
}

export {
  handleShopPurchase,
  useHealingPotion,
  canEquipSword,
  checkPotionCount,
  buyItem,
  craftItem,
  useBattleItem,
  tradeItem,
  grantReward,
  clearInventory,
  safeConsumeItem,
};
