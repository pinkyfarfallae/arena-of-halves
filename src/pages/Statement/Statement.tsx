import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { ActivityLog } from '../../types/activityLog';
import { fetchActivityLogs, fetchActivityLogsForCharacter } from '../../services/activityLog/activityLogService';
import { fetchUserWishOfIris, IrisWishDoc } from '../../data/wishes';
import { fetchAcceptedClaimsForCharacter } from '../../services/daily/dailyClaimService';
import { getAppDateString } from '../../utils/date';
import './Statement.scss';
import { Dropdown, Input } from '../../components/Form';
import { ACTIVITY_LOG_ACTIONS, ACTIVITY_LOG_CATEGORY, ACTIVITY_LOG_SOURCES, SOURCE_LABELS } from '../../constants/activityLog';
import { toTitleCase } from '../../utils/formatText';
import { DEITY_THEMES } from '../../constants/theme';
import { hexToRgb } from '../../utils/color';
import Drachma from '../../icons/Drachma';
import { Deity } from '../../constants/deities';
import { DEITY_SVG } from '../../data/deities';
import Refresh from '../IrisMessage/icons/Refresh';
import { EQUIPMENT_UPGRADE_OUTCOME } from '../../constants/equipment';
import { fetchHarvests } from '../../services/harvest/fetchHarvest';
import { HARVEST_SUBMISSION_STATUS } from '../../constants/harvest';
import { ITEMS } from '../../constants/items';
import { PRICE_UNIT } from '../../constants/priceUnit';

interface ExpandedRows {
  [key: string]: boolean;
}

interface FormattedActivity {
  log: ActivityLog;
  display: string;
  details?: React.ReactNode;
  createdAt: string;
}

const formatSourceLabel = (source: string): string => {
  if (!source) {
    return SOURCE_LABELS['unknown'];
  }

  if (SOURCE_LABELS[source]) {
    return SOURCE_LABELS[source];
  }

  return source
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
};

const formatShopCurrencyAmount = (amount: number, priceUnit?: string): string => {
  if (priceUnit === PRICE_UNIT.NPC_GIFT_CARD) {
    return `${amount.toLocaleString()} Gift Card${amount === 1 ? '' : 's'}`;
  }

  return `${amount.toLocaleString()} drachma`;
};

const formatDateOnly = (dateStr: string): string => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
};

const getDayKey = (dateStr: string): string => {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) {
    return dateStr.slice(0, 10);
  }

  return parsed.toISOString().slice(0, 10);
};

const dedupeStatementLogs = (activityLogs: ActivityLog[]): ActivityLog[] => {
  const seenDailyGiftDays = new Set<string>();
  // Keep only the latest WISH_TOSSED per day (retosses produce multiple logs)
  const seenWishTossedDays = new Set<string>();
  // Deduplicate admin item grants that produced two Firestore docs:
  // one "give_item" (old manual log) + one "receive_item" (auto-log from bagService).
  // Normalize both to the same key so only the first one survives.
  const seenItemGrantKeys = new Set<string>();
  // Some users may have duplicate keychain bonus award logs from earlier race paths.
  // Keep only the latest one per character in Statement.
  const seenIrisKeychainBonusAward = new Set<string>();
  // Deduplicate training roleplay skip tickets by characterId + trainingDate.
  // Only collapse when trainingDate is explicitly stored in metadata — old logs
  // without it are kept as-is to avoid incorrectly merging different-task entries.
  const seenRoleplaySkipKeys = new Set<string>();

  // Historical bug path: admin TP changes created two logs for one transaction
  // (service default source=training_grounds + manual admin source log).
  // Prefer the admin-source row and hide the training_grounds duplicate.
  const adminTrainingSources: string[] = [
    ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY_ADD,
    ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY_BULK_ADD,
    ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY,
    ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY_BULK,
    ACTIVITY_LOG_SOURCES.PLAYER_INVENTORY,
    ACTIVITY_LOG_SOURCES.PLAYER_INVENTORY_BULK,
  ];
  const trainingActions = new Set<string>([
    ACTIVITY_LOG_ACTIONS.ADD_TRAINING_POINTS,
    ACTIVITY_LOG_ACTIONS.DEDUCT_TRAINING_POINTS,
    ACTIVITY_LOG_ACTIONS.SPEND_TRAINING_POINTS_UPGRADE,
  ]);

  const adminTrainingEvents: Array<{ key: string; ts: number }> = [];
  const TRAINING_DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

  activityLogs.forEach((log) => {
    const metadata = (log.metadata as Record<string, any>) || {};
    const source = String(metadata.source || '');
    const isTrainingChange =
      log.category === ACTIVITY_LOG_CATEGORY.STAT &&
      trainingActions.has(log.action);

    if (!isTrainingChange || !adminTrainingSources.includes(source)) {
      return;
    }

    const ts = new Date(log.createdAt).getTime();
    if (Number.isNaN(ts)) {
      return;
    }

    const key = `${log.characterId}:${log.action}:${log.amount || 0}`;
    adminTrainingEvents.push({ key, ts });
  });

  return activityLogs.filter((log) => {
    // Logs are sorted newest-first, so the first WISH_TOSSED seen per day is the final selection
    if (log.action === ACTIVITY_LOG_ACTIONS.WISH_TOSSED) {
      const dayKey = `${log.characterId}:${getDayKey(log.createdAt)}`;
      if (seenWishTossedDays.has(dayKey)) return false;
      seenWishTossedDays.add(dayKey);
      return true;
    }
    const metadata = (log.metadata as Record<string, any>) || {};
    const source = String(metadata.source || '');

    const isTrainingChange =
      log.category === ACTIVITY_LOG_CATEGORY.STAT &&
      trainingActions.has(log.action);
    if (isTrainingChange && source === ACTIVITY_LOG_SOURCES.TRAINING_GROUNDS) {
      const ts = new Date(log.createdAt).getTime();
      if (!Number.isNaN(ts)) {
        const key = `${log.characterId}:${log.action}:${log.amount || 0}`;
        const hasAdminTwin = adminTrainingEvents.some(
          (event) => event.key === key && Math.abs(event.ts - ts) <= TRAINING_DUPLICATE_WINDOW_MS
        );
        if (hasAdminTwin) return false;
      }
    }

    const isDailyGiftLog = log.category === ACTIVITY_LOG_CATEGORY.DRACHMA && source === ACTIVITY_LOG_SOURCES.DAILY_GIFT;

    if (isDailyGiftLog) {
      const dayKey = `${log.characterId}:${getDayKey(log.createdAt)}`;
      if (seenDailyGiftDays.has(dayKey)) return false;
      seenDailyGiftDays.add(dayKey);
      return true;
    }

    const isIrisKeychainBonusAward =
      log.category === ACTIVITY_LOG_CATEGORY.DRACHMA &&
      (log.action === ACTIVITY_LOG_ACTIONS.AWARD || log.action === ACTIVITY_LOG_ACTIONS.EARN_DRACHMA) &&
      (source === ACTIVITY_LOG_SOURCES.IRIS_WISH_BONUS || source === ACTIVITY_LOG_SOURCES.IRIS_KEYCHAIN_BONUS);

    if (isIrisKeychainBonusAward) {
      const key = `${log.characterId}:iris_keychain_bonus_award`;
      if (seenIrisKeychainBonusAward.has(key)) return false;
      seenIrisKeychainBonusAward.add(key);
      return true;
    }

    // Deduplicate skip ticket usage only when trainingDate is explicitly in metadata.
    // Using day-of-createdAt as a fallback is unsafe: a player can submit skip tickets
    // for multiple different tasks on the same calendar day, so those logs share the
    // same createdAt day but must be kept as separate entries.
    if (
      log.category === ACTIVITY_LOG_CATEGORY.ITEM &&
      log.action === ACTIVITY_LOG_ACTIONS.CONSUME_ITEM &&
      source === ACTIVITY_LOG_SOURCES.TRAINING_ROLEPLAY_SKIP &&
      metadata.trainingDate
    ) {
      const key = `${log.characterId}:${String(metadata.trainingDate)}`;
      if (seenRoleplaySkipKeys.has(key)) return false;
      seenRoleplaySkipKeys.add(key);
      return true;
    }

    // Hide technical keychain state flip for bonus claim to avoid duplicate-looking
    // Statement rows (the user-facing drachma award row is kept).
    const isIrisKeychainStateFlip =
      log.category === ACTIVITY_LOG_CATEGORY.ITEM &&
      log.action === ACTIVITY_LOG_ACTIONS.UPDATE_ITEM_STATE &&
      String(metadata.itemId || '') === ITEMS.IRIS_KEYCHAIN &&
      (source === ACTIVITY_LOG_SOURCES.IRIS_WISH_BONUS || source === ACTIVITY_LOG_SOURCES.IRIS_KEYCHAIN_BONUS);

    if (isIrisKeychainStateFlip) {
      return false;
    }

    // Both "give_item" and "receive_item" from admin sources represent the same
    // item grant event. Collapse them using characterId + itemId + amount + minute.
    const adminItemSources: string[] = [
      ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY_ADD,
      ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY_BULK_ADD,
      ACTIVITY_LOG_SOURCES.PLAYER_INVENTORY,
      ACTIVITY_LOG_SOURCES.PLAYER_INVENTORY_BULK,
    ];
    const isAdminItemGrant =
      log.category === ACTIVITY_LOG_CATEGORY.ITEM &&
      (log.action === ACTIVITY_LOG_ACTIONS.RECEIVE_ITEM || log.action === ACTIVITY_LOG_ACTIONS.GIVE_ITEM) &&
      adminItemSources.includes(source);

    if (isAdminItemGrant) {
      const minuteSlot = Math.floor(new Date(log.createdAt).getTime() / 60_000);
      const key = `${log.characterId}:${metadata.itemId || ''}:${log.amount}:${minuteSlot}`;
      if (seenItemGrantKeys.has(key)) return false;
      seenItemGrantKeys.add(key);
    }

    return true;
  });
};

const toWishTossLog = (wish: IrisWishDoc): ActivityLog => ({
  id: `wish-${wish.userId}-${wish.date}-${wish.deity}`,
  category: ACTIVITY_LOG_CATEGORY.ACTION,
  action: ACTIVITY_LOG_ACTIONS.WISH_TOSSED,
  characterId: wish.userId,
  performedBy: wish.userId,
  metadata: {
    source: ACTIVITY_LOG_SOURCES.IRIS_FOUNTAIN,
    deity: wish.deity,
    date: wish.date,
    tossedAt: wish.tossedAt,
    canceled: wish.canceled || false,
  },
  createdAt: wish.tossedAt || `${wish.date}T00:00:00.000Z`,
});

const hasWishTossLog = (logs: ActivityLog[], wish: IrisWishDoc): boolean => logs.some(log => {
  if (log.action !== ACTIVITY_LOG_ACTIONS.WISH_TOSSED) {
    return false;
  }

  const metadata = (log.metadata as Record<string, any>) || {};
  return (
    log.characterId === wish.userId &&
    String(metadata.deity || '') === String(wish.deity || '') &&
    String(metadata.date || '') === String(wish.date || '')
  );
});

const isWishLog = (log: ActivityLog): boolean => {
  const metadata = (log.metadata as Record<string, any>) || {};
  const source = String(metadata.source || '');

  return (
    log.action === ACTIVITY_LOG_ACTIONS.WISH_TOSSED ||
    log.action === ACTIVITY_LOG_ACTIONS.WISH_RECEIVED ||
    source === ACTIVITY_LOG_SOURCES.IRIS_WISH ||
    source.startsWith('iris_wish_') ||
    source === ACTIVITY_LOG_SOURCES.NIKE_WISH_BATTLE_BONUS ||
    log.performedBy === ACTIVITY_LOG_SOURCES.IRIS_WISH
  );
};


const getDisplayCategory = (log: ActivityLog): string => {
  if (isWishLog(log)) {
    return 'wish';
  }

  return log.category;
};

const getCategoryCode = (category: string, deity?: Deity): any => {
  const codes: Record<string, any> = {
    drachma: <Drachma width={25} height={25} />,
    item: 'IT',
    equipment: 'EQ',
    stat: 'ST',
  };

  if (category === 'wish') {
    return deity ? DEITY_SVG[deity] : 'WS';
  }

  return codes[category] || 'LG';
};



const getCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    drachma: 'Drachma',
    item: 'Item',
    equipment: 'Equipment',
    stat: 'Stat',
    wish: 'Wish',
  };

  return labels[category] || 'All';
};

const getWishDeityStyles = (log: ActivityLog): React.CSSProperties => {
  if (!isWishLog(log)) return {};

  const metadata = log.metadata as Record<string, any> || {};
  const deity = metadata.deity || 'iris';
  const deityKey = deity.toLowerCase();

  const deityTheme = DEITY_THEMES[deityKey];
  if (!deityTheme) return {};

  const primaryColor = deityTheme[0];
  const darkColor = deityTheme[1];

  return {
    '--deity-primary-color': primaryColor,
    '--deity-primary-color-rgb': hexToRgb(primaryColor),
    '--deity-dark-color': darkColor,
    '--deity-dark-color-rgb': hexToRgb(darkColor),
  } as React.CSSProperties;
};

const formatActivityDisplay = (log: ActivityLog, currentCharacterId?: string): FormattedActivity => {
  const metadata = log.metadata as Record<string, any> || {};
  const deity = metadata.deity || 'Iris';
  const itemId = metadata.itemId || 'item';
  const wishSource = String(metadata.source || '');
  const sourceLabel = formatSourceLabel(wishSource);

  const baseResult = {
    log,
    createdAt: log.createdAt,
    display: '',
    details: undefined,
  };

  if (isWishLog(log)) {
    if (log.action === ACTIVITY_LOG_ACTIONS.WISH_TOSSED) {
      return {
        ...baseResult,
        display: `Tossed for the Wish of ${deity} at the Iris Fountain.`,
      };
    }

    if (log.action === ACTIVITY_LOG_ACTIONS.WISH_RECEIVED) {
      return {
        ...baseResult,
        display: `Received the Wish of ${deity} through the Iris Fountain.`,
      };
    }

    if (log.category === ACTIVITY_LOG_CATEGORY.ITEM) {
      return {
        ...baseResult,
        display: `Wish of ${deity} granted ${log.amount || 1} x ${toTitleCase(itemId)}.`,
      };
    };

    if (log.category === ACTIVITY_LOG_CATEGORY.STAT) {
      return {
        ...baseResult,
        display: `Wish of ${deity} granted ${log.amount || 0} Training Point${log.amount === 1 ? '' : 's'}.`,
      };
    }

    if (log.category === ACTIVITY_LOG_CATEGORY.DRACHMA && wishSource === ACTIVITY_LOG_SOURCES.NIKE_WISH_BATTLE_BONUS) {
      return {
        ...baseResult,
        display: `Earned ${log.amount?.toLocaleString() || 0} drachma bonus from the Wish of Nike after winning a battle.`,
      };
    }
  }

  switch (log.category) {
    case ACTIVITY_LOG_CATEGORY.DRACHMA:
      if (log.action === ACTIVITY_LOG_ACTIONS.EARN_DRACHMA || log.action === ACTIVITY_LOG_ACTIONS.AWARD) {
        const source = metadata.source || ACTIVITY_LOG_SOURCES.UNKNOWN;
        const isIrisKeychainBonus =
          source === ACTIVITY_LOG_SOURCES.IRIS_KEYCHAIN_BONUS ||
          (source === ACTIVITY_LOG_SOURCES.IRIS_WISH_BONUS && (
            String(metadata.itemId || '') === ITEMS.IRIS_KEYCHAIN || Number(log.amount || 0) === 5000
          ));

        if (isIrisKeychainBonus) {
          return {
            ...baseResult,
            display: `Earned ${log.amount?.toLocaleString()} drachma from Iris Keychain bonus.`,
          };
        }

        if (source === ACTIVITY_LOG_SOURCES.IRIS_FOUNTAIN) {
          return {
            ...baseResult,
            display: `Earned ${log.amount?.toLocaleString()} drachma from Rainbow Drachma after the Wish of Iris.`,
          };
        }

        if (source === ACTIVITY_LOG_SOURCES.TREASURY_TRANSFER) {
          const fromName = (metadata.fromName as string) || (metadata.fromUserId as string) || 'another character';
          return {
            ...baseResult,
            display: `Received ${log.amount?.toLocaleString()} drachma from ${fromName} via Camp Treasury Transfer.`,
          };
        }

        const adminSources = [
          ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY,
          ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY_BULK,
          ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY_ADD,
          ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY_BULK_ADD,
          ACTIVITY_LOG_SOURCES.PLAYER_INVENTORY,
          ACTIVITY_LOG_SOURCES.PLAYER_INVENTORY_BULK,
        ];
        if (adminSources.includes(source)) {
          return {
            ...baseResult,
            display: `Earned ${log.amount?.toLocaleString()} drachma awarded by admin.`,
          };
        }

        return {
          ...baseResult,
          display: `Earned ${log.amount?.toLocaleString()} drachma from ${formatSourceLabel(String(source))}.`,
        };
      }
      if (log.action === ACTIVITY_LOG_ACTIONS.DEDUCT || log.action === ACTIVITY_LOG_ACTIONS.SPEND_DRACHMA || log.action === ACTIVITY_LOG_ACTIONS.CONSUME_DRACHMA) {
        const source = metadata.source || ACTIVITY_LOG_SOURCES.UNKNOWN;

        if (source === ACTIVITY_LOG_SOURCES.TREASURY_TRANSFER) {
          const toName = (metadata.toName as string) || (metadata.toUserId as string) || 'another character';
          return {
            ...baseResult,
            display: `Sent ${log.amount?.toLocaleString()} drachma to ${toName} via Camp Treasury Transfer.`,
          };
        }

        const reason = metadata.reason || sourceLabel;
        return {
          ...baseResult,
          display: `Spent ${log.amount?.toLocaleString()} drachma on ${reason}.`,
        };
      }
      if (log.action === 'rainbow_toss_reward') {
        return {
          ...baseResult,
          display: `Earned ${log.amount?.toLocaleString()} drachma from Rainbow Drachma after toss.`,
        };
      }
      return {
        ...baseResult,
        display: `${log.action.replace(/_/g, ' ')}: ${log.amount?.toLocaleString() || 0} drachma.`,
      };

    case ACTIVITY_LOG_CATEGORY.ITEM:
      if (log.action === ACTIVITY_LOG_ACTIONS.SHOP_PURCHASE) {
        const purchasedItems = (metadata.items as Array<{ itemId: string; quantity: number; price: number; priceUnit?: string }>) || [];
        const finalPrice = metadata.finalPrice ?? metadata.totalPrice ?? log.amount ?? 0;
        const discountApplied = Boolean(metadata.discountApplied);
        const discountAmount = metadata.discountAmount ?? 0;
        const priceUnit = String(metadata.priceUnit || purchasedItems[0]?.priceUnit || PRICE_UNIT.DRACHMA);
        const itemCount = purchasedItems.reduce((sum: number, i: { quantity: number }) => sum + i.quantity, 0) || log.amount || purchasedItems.length;
        const discountNote = discountApplied && priceUnit === PRICE_UNIT.DRACHMA
          ? ` (saved ${Number(discountAmount).toLocaleString()} drachma with 30% discount)`
          : '';
        return {
          ...baseResult,
          display: `Purchased ${itemCount} item${itemCount === 1 ? '' : 's'} from the Shop for ${formatShopCurrencyAmount(Number(finalPrice), priceUnit)}${discountNote}.`,
          details: purchasedItems.length > 0 ? (
            <div className="activity-details">
              {discountApplied && priceUnit === PRICE_UNIT.DRACHMA && (
                <div className="activity-detail-item activity-detail-discount">
                  <span className="detail-bullet" />
                  <span className="detail-text">30% Discount Ticket applied — saved {Number(discountAmount).toLocaleString()} drachma</span>
                </div>
              )}
              {purchasedItems.map((item, idx) => (
                <div key={idx} className="activity-detail-item">
                  <span className="detail-bullet" />
                  <span className="detail-text">
                    {toTitleCase(item.itemId)} ×{item.quantity}
                    {item.price != null && <span className="detail-price"> — {formatShopCurrencyAmount(Number(item.price * item.quantity), item.priceUnit || priceUnit)}</span>}
                  </span>
                </div>
              ))}
            </div>
          ) : undefined,
        };
      }
      if (log.action === ACTIVITY_LOG_ACTIONS.UPDATE_ITEM_STATE) {
        const isAvailable = Boolean(metadata.currentAvailable);
        return {
          ...baseResult,
          display: `${toTitleCase(metadata.itemName || 'item')} is now ${isAvailable ? 'available' : 'unavailable'} from ${sourceLabel}.`,
        };
      }
      if (log.action === ACTIVITY_LOG_ACTIONS.RECEIVE_ITEM || log.action === ACTIVITY_LOG_ACTIONS.GIVE_ITEM) {
        const itemId = metadata.itemId || 'item';
        const source = metadata.source || ACTIVITY_LOG_SOURCES.UNKNOWN;
        const adminSources = [
          ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY,
          ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY_BULK,
          ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY_ADD,
          ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY_BULK_ADD,
          ACTIVITY_LOG_SOURCES.PLAYER_INVENTORY,
          ACTIVITY_LOG_SOURCES.PLAYER_INVENTORY_BULK,
        ];
        if (adminSources.includes(source)) {
          return {
            ...baseResult,
            display: `Received ${log.amount} x ${toTitleCase(itemId)} from admin.`,
          };
        }
        return {
          ...baseResult,
          display: `Received ${log.amount} x ${toTitleCase(itemId)}${source !== 'manual' ? ` from ${formatSourceLabel(String(source))}` : ''}.`,
        };
      }
      if (log.action === ACTIVITY_LOG_ACTIONS.CONSUME_ITEM) {
        const itemId = metadata.itemId || 'item';
        const source = metadata.source || ACTIVITY_LOG_SOURCES.UNKNOWN;
        const adminSources = [
          ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY,
          ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY_BULK,
          ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY_ADD,
          ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY_BULK_ADD,
          ACTIVITY_LOG_SOURCES.PLAYER_INVENTORY,
          ACTIVITY_LOG_SOURCES.PLAYER_INVENTORY_BULK,
        ];
        if (adminSources.includes(source)) {
          return {
            ...baseResult,
            display: `${log.amount} x ${toTitleCase(itemId)} removed by admin.`,
          };
        }
        if (source === ACTIVITY_LOG_SOURCES.TRAINING_ROLEPLAY_SKIP) {
          const remaining = metadata.newAmount != null ? Number(metadata.newAmount) : null;
          const trainingDate = metadata.trainingDate as string | undefined;
          const hasDetails = trainingDate || remaining != null;
          return {
            ...baseResult,
            display: `Used ${log.amount} x ${toTitleCase(itemId)} for training roleplay ${trainingDate ? `of task on ${formatDateOnly(trainingDate)}` : ''} skip.`,
            details: hasDetails ? (
              <div className="activity-details">
                {trainingDate && (
                  <div className="activity-detail-item">
                    <span className="detail-bullet" />
                    <span className="detail-text">Training date: {formatDateOnly(trainingDate)}</span>
                  </div>
                )}
                {remaining != null && (
                  <div className="activity-detail-item">
                    <span className="detail-bullet" />
                    <span className="detail-text">Remaining: {remaining} Skip Ticket{remaining === 1 ? '' : 's'}</span>
                  </div>
                )}
              </div>
            ) : undefined,
          };
        }
        return {
          ...baseResult,
          display: `Used ${log.amount} x ${toTitleCase(itemId)} for ${formatSourceLabel(String(source))}.`,
        };
      }
      if (log.action === ACTIVITY_LOG_ACTIONS.TRANSFER_ITEM) {
        const transferItemId = metadata.itemId || 'item';
        const direction = (metadata.direction as string) || (log.performedBy !== log.characterId ? 'received' : 'sent');
        const isSent = direction === 'sent';
        const otherName = isSent
          ? ((metadata.toName as string) || (metadata.toUserId as string) || 'another character')
          : ((metadata.fromName as string) || (metadata.fromUserId as string) || log.performedBy || 'another character');
        return {
          ...baseResult,
          display: isSent
            ? `Sent ${log.amount} x ${toTitleCase(transferItemId)} to ${otherName}.`
            : `Received ${log.amount} x ${toTitleCase(transferItemId)} from ${otherName}.`,
          details: (
            <div className="activity-details">
              <div className="activity-detail-item">
                <span className="detail-bullet" />
                <span className="detail-text">{isSent ? 'To' : 'From'}: {otherName}</span>
              </div>
              <div className="activity-detail-item">
                <span className="detail-bullet" />
                <span className="detail-text">
                  {toTitleCase(transferItemId)} ×{log.amount}
                </span>
              </div>
            </div>
          ),
        };
      }
      return {
        ...baseResult,
        display: `${log.action.replace(/_/g, ' ')}: ${log.amount} items.`,
      };

    case ACTIVITY_LOG_CATEGORY.EQUIPMENT:
      if (log.action === ACTIVITY_LOG_ACTIONS.EQUIPMENT_UPGRADE) {
        const outcome = String(metadata.outcome || log.note || '').toLowerCase();
        const passed = outcome === EQUIPMENT_UPGRADE_OUTCOME.SUCCESS || outcome === EQUIPMENT_UPGRADE_OUTCOME.PASS;
        const equipmentName = (metadata.equipmentName as string) || 'equipment';
        const fromTier = metadata.fromTier != null ? String(metadata.fromTier).replace('level_', '') : '?';
        const toTier = metadata.toTier != null ? String(metadata.toTier).replace('level_', '') : '?';
        const category = (metadata.category as string) || 'equipment';
        const ticketsUsed = Number(metadata.ticketsUsed || 0);
        const successRate = metadata.successRate != null ? Number(metadata.successRate) : null;

        return {
          ...baseResult,
          display: `${passed ? 'Passed' : 'Failed'} ${equipmentName} upgrade from tier ${fromTier} to ${toTier}.`,
          details: (
            <div className="activity-details">
              <div className="activity-detail-item">
                <span className="detail-bullet" />
                <span className="detail-text">Category: {toTitleCase(category)}</span>
              </div>
              <div className="activity-detail-item">
                <span className="detail-bullet" />
                <span className="detail-text">Outcome: {passed ? 'Pass' : 'Fail'}</span>
              </div>
              <div className="activity-detail-item">
                <span className="detail-bullet" />
                <span className="detail-text">Tier change: {fromTier} → {toTier}</span>
              </div>
              <div className="activity-detail-item">
                <span className="detail-bullet" />
                <span className="detail-text">Tickets used: {ticketsUsed}</span>
              </div>
              {successRate != null && (
                <div className="activity-detail-item activity-detail-bonus">
                  <span className="detail-bullet" />
                  <span className="detail-text">Success rate: {successRate.toLocaleString()}%</span>
                </div>
              )}
              {metadata.reason && (
                <div className="activity-detail-item">
                  <span className="detail-bullet" />
                  <span className="detail-text">Reason: {String(metadata.reason)}</span>
                </div>
              )}
            </div>
          ),
        };
      }
      return {
        ...baseResult,
        display: `${log.action.replace(/_/g, ' ')}: ${log.amount}.`,
      };

    case ACTIVITY_LOG_CATEGORY.STAT:
      if (log.action === ACTIVITY_LOG_ACTIONS.APPROVE_TRAINING) {
        const trainingDate = metadata.date || '';
        const withFortune = Boolean(metadata.withFullLevelFortune);
        const isAthena = Boolean(metadata.isAthena);
        const athenaBonus = metadata.athenaBonus ?? 0;
        const totalTP = metadata.totalTP ?? log.amount;
        const hasDetails = withFortune || isAthena || athenaBonus > 0;
        const datePart = trainingDate ? `${formatDateOnly(trainingDate)}` : '';

        return {
          ...baseResult,
          display: `Your roleplay submission for ${datePart} was approved. Earned ${totalTP} Training Point${totalTP === 1 ? '' : 's'}.`,
          details: hasDetails ? (
            <div className="activity-details">
              {withFortune && (
                <div className="activity-detail-item activity-detail-bonus">
                  <span className="detail-bullet" />
                  <span className="detail-text">Full-level Fortune Bonus: +1 TP</span>
                </div>
              )}
              {isAthena && (
                <div className="activity-detail-item activity-detail-bonus">
                  <span className="detail-bullet" />
                  <span className="detail-text">Athena's Blessing: +{athenaBonus > 1 ? 2 : 1} TP</span>
                </div>
              )}
            </div>
          ) : undefined,
        };
      }
      if (log.action === ACTIVITY_LOG_ACTIONS.ADD_TRAINING_POINTS) {
        const source = metadata.source || ACTIVITY_LOG_SOURCES.UNKNOWN;
        const adminSources = [
          ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY,
          ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY_BULK,
          ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY_ADD,
          ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY_BULK_ADD,
          ACTIVITY_LOG_SOURCES.PLAYER_INVENTORY,
          ACTIVITY_LOG_SOURCES.PLAYER_INVENTORY_BULK,
        ];
        if (adminSources.includes(source)) {
          return {
            ...baseResult,
            display: `Earned ${log.amount} Training Point${log.amount === 1 ? '' : 's'} awarded by admin.`,
          };
        }
        return {
          ...baseResult,
          display: `Earned ${log.amount} Training Point${log.amount === 1 ? '' : 's'} from ${sourceLabel}.`,
        };
      }
      if (log.action === ACTIVITY_LOG_ACTIONS.DEDUCT_TRAINING_POINTS || log.action === ACTIVITY_LOG_ACTIONS.SPEND_TRAINING_POINTS_UPGRADE) {
        const source = metadata.source || ACTIVITY_LOG_SOURCES.UNKNOWN;
        const adminSources = [
          ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY,
          ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY_BULK,
          ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY_ADD,
          ACTIVITY_LOG_SOURCES.ADMIN_PLAYER_INVENTORY_BULK_ADD,
          ACTIVITY_LOG_SOURCES.PLAYER_INVENTORY,
          ACTIVITY_LOG_SOURCES.PLAYER_INVENTORY_BULK,
        ];
        if (adminSources.includes(source)) {
          return {
            ...baseResult,
            display: `Spent ${log.amount} Training Point${log.amount === 1 ? '' : 's'} removed by admin.`,
          };
        }
        return {
          ...baseResult,
          display: `Spent ${log.amount} Training Point${log.amount === 1 ? '' : 's'} on ${sourceLabel}.`,
        };
      }
      if (log.action === ACTIVITY_LOG_ACTIONS.REJECT_TRAINING) {
        return {
          ...baseResult,
          display: 'Training was rejected.',
        };
      }
      if (log.action === ACTIVITY_LOG_ACTIONS.STAT_UPGRADE || log.action === ACTIVITY_LOG_ACTIONS.SKILL_UPGRADE) {
        const stat = metadata.stat || 'skill';
        return {
          ...baseResult,
          display: `Upgraded ${toTitleCase(stat)} by ${log.amount}.`,
        };
      }
      if (log.action === ACTIVITY_LOG_ACTIONS.STAT_REFUND) {
        return {
          ...baseResult,
          display: `A refund was approved. Earned ${log.amount} Training Points.`,
        };
      }
      return {
        ...baseResult,
        display: `${log.action.replace(/_/g, ' ')}: ${log.amount}.`,
      };

    case ACTIVITY_LOG_CATEGORY.ACTION:
      if (log.action === ACTIVITY_LOG_ACTIONS.TRAINING_APPROVED) {
        return {
          ...baseResult,
          display: `Your training submission was approved. Earned ${log.amount} drachma.`,
          details: (
            <div className="activity-details">
              {metadata.date && (
                <div className="activity-detail-item">
                  <span className="detail-bullet" />
                  <span className="detail-text">Submitted date: {formatDateOnly(metadata.date as string)}</span>
                </div>
              )}
              <div className="activity-detail-item">
                <span className="detail-bullet" />
                <span className="detail-text">Approved by: {log.performedBy || 'admin'}</span>
              </div>
            </div>
          ),
        };
      }
      if (log.action === ACTIVITY_LOG_ACTIONS.TASK_APPROVED) {
        const taskType = (metadata.taskType as string) || 'task';
        return {
          ...baseResult,
          display: `${taskType.charAt(0).toUpperCase() + taskType.slice(1)} approval granted. Earned ${log.amount} Training Points.`,
          details: (
            <div className="activity-details">
              {metadata.submissionId && (
                <div className="activity-detail-item">
                  <span className="detail-bullet" />
                  <span className="detail-text">Submission ID: {metadata.submissionId}</span>
                </div>
              )}
              <div className="activity-detail-item">
                <span className="detail-bullet" />
                <span className="detail-text">Approved by: {metadata.approvedBy || 'admin'}</span>
              </div>
            </div>
          ),
        };
      }
      if (log.action === ACTIVITY_LOG_ACTIONS.HARVEST_APPROVED || log.action === ACTIVITY_LOG_ACTIONS.MISSION_APPROVED) {
        const isHarvest = log.action === ACTIVITY_LOG_ACTIONS.HARVEST_APPROVED;
        const roleplayers = (metadata.roleplayers as string[]) || [];
        const hasDetails = roleplayers.length > 0;

        let earnedDrachma = log.amount;
        if (currentCharacterId && metadata.drachmaReward) {
          try {
            const rewardMap: Record<string, number> = typeof metadata.drachmaReward === 'string'
              ? JSON.parse(metadata.drachmaReward)
              : metadata.drachmaReward;
            if (rewardMap[currentCharacterId] != null) {
              earnedDrachma = rewardMap[currentCharacterId];
            }
          } catch {
            // fall back to log.amount
          }
        }

        return {
          ...baseResult,
          display: `${isHarvest ? 'Harvest' : 'Mission'} approval granted. Earned ${earnedDrachma?.toLocaleString()} drachma.`,
          details: hasDetails ? (
            <div className="activity-details">
              <div className="activity-detail-item">
                <span className="detail-bullet" />
                <span className="detail-text">{isHarvest ? 'Harvest' : 'Mission'} ID: {metadata.submissionId || 'unknown'}</span>
              </div>
              {roleplayers.length > 0 && (
                <div className="activity-detail-item">
                  <span className="detail-bullet" />
                  <span className="detail-text">Roleplayers: {roleplayers.join(', ')}</span>
                </div>
              )}
              {metadata.totalDrachma != null && (
                <div className="activity-detail-item activity-detail-bonus">
                  <span className="detail-bullet" />
                  <span className="detail-text">Total drachma awarded: {Number(metadata.totalDrachma).toLocaleString()}</span>
                </div>
              )}
            </div>
          ) : undefined,
        };
      }
      if (log.action === ACTIVITY_LOG_ACTIONS.APPROVE_BIG_HOUSE_ROLEPLAY) {
        const roleplayers = (metadata.roleplayers as string[]) || [];
        let drachmaRewardMap: Record<string, number> = {};

        // Parse drachma reward from metadata (could be JSON string or number)
        if (typeof metadata.drachmaReward === 'string') {
          try {
            drachmaRewardMap = JSON.parse(metadata.drachmaReward);
          } catch {
            // If parsing fails, treat as legacy format
          }
        }

        const date = metadata.date ? formatDateOnly(metadata.date as string) : log.createdAt ? formatDateOnly(log.createdAt) : 'unknown date';
        const hasRewardBreakdown = Object.keys(drachmaRewardMap).length > 0;
        const hasDetails = hasRewardBreakdown || roleplayers.length > 0 || metadata.charCount || metadata.tweetCount;

        return {
          ...baseResult,
          display: `Big House roleplay approval granted. Earned ${metadata.totalDrachma} drachma.`,
          details: hasDetails ? (
            <div className="activity-details">
              <div className="activity-detail-item">
                <span className="detail-bullet" />
                <span className="detail-text">Submitted: {date}</span>
              </div>
              {hasRewardBreakdown && (
                <div className="activity-detail-item activity-detail-bonus">
                  <span className="detail-bullet" />
                  <span className="detail-text">
                    Drachma: {Object.entries(drachmaRewardMap).map(([id, amount]) => `${id}: ${Number(amount).toLocaleString()}`).join(', ')}
                  </span>
                </div>
              )}
              {(metadata.charCount || metadata.tweetCount) && (
                <div className="activity-detail-item">
                  <span className="detail-bullet" />
                  <span className="detail-text">
                    {metadata.charCount ? `${Number(metadata.charCount).toLocaleString()} chars` : ''}
                    {metadata.charCount && metadata.tweetCount ? ' • ' : ''}
                    {metadata.tweetCount ? `${metadata.tweetCount} tweet${metadata.tweetCount === 1 ? '' : 's'}` : ''}
                  </span>
                </div>
              )}
            </div>
          ) : undefined,
        };
      }

      if (log.action === ACTIVITY_LOG_ACTIONS.WISH_RECEIVED) {
        const deity = metadata.deity || 'deity';
        return {
          ...baseResult,
          display: `Received a wish from "${deity}" through the Iris Fountain.`,
        };
      }
      return {
        ...baseResult,
        display: `${log.action.replace(/_/g, ' ')}${log.amount ? `: ${log.amount}` : ''}.`,
      };

    default:
      return {
        ...baseResult,
        display: `${log.action.replace(/_/g, ' ')}${log.amount ? ` - ${log.amount}` : ''}.`,
      };
  }
};

export const Statement: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<ExpandedRows>({});
  const latestLoadRef = useRef(0);

  useEffect(() => {
    loadActivityLogs();
  }, [user?.characterId]);

  const loadActivityLogs = async () => {
    const loadId = ++latestLoadRef.current;

    if (!user) {
      // Avoid a permanent spinner while auth is restoring or user is signed out.
      setLogs([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [userLogsResult, userWishesResult, acceptedClaimsResult] = await Promise.allSettled([
        fetchActivityLogsForCharacter(user.characterId, 200),
        fetchUserWishOfIris(user.characterId),
        fetchAcceptedClaimsForCharacter(user.characterId, 14),
      ]);

      if (loadId !== latestLoadRef.current) return;

      const userLogs = userLogsResult.status === 'fulfilled' ? userLogsResult.value : [];
      const userWishes = userWishesResult.status === 'fulfilled' ? userWishesResult.value : [];
      const acceptedClaims = acceptedClaimsResult.status === 'fulfilled' ? acceptedClaimsResult.value : [];

      if (userLogsResult.status === 'rejected') {
        console.error('Failed to load activity logs list:', userLogsResult.reason);
      }
      if (userWishesResult.status === 'rejected') {
        console.error('Failed to load Iris wishes:', userWishesResult.reason);
      }
      if (acceptedClaimsResult.status === 'rejected') {
        console.error('Failed to load accepted daily claims:', acceptedClaimsResult.reason);
      }

      let sortedLogs = [...userLogs]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Enrich old HARVEST_APPROVED logs that are missing drachmaReward in metadata
      const harvestLogsNeedingEnrichment = sortedLogs.filter(l =>
        (l.action === ACTIVITY_LOG_ACTIONS.HARVEST_APPROVED || l.action === ACTIVITY_LOG_ACTIONS.MISSION_APPROVED) &&
        !(l.metadata as Record<string, any>)?.drachmaReward
      );
      if (harvestLogsNeedingEnrichment.length > 0) {
        const { harvests } = await fetchHarvests(user.characterId, HARVEST_SUBMISSION_STATUS.APPROVED);
        const harvestById = new Map(harvests.map(h => [h.id, h]));
        sortedLogs = sortedLogs.map(l => {
          if (
            (l.action === ACTIVITY_LOG_ACTIONS.HARVEST_APPROVED || l.action === ACTIVITY_LOG_ACTIONS.MISSION_APPROVED) &&
            !(l.metadata as Record<string, any>)?.drachmaReward
          ) {
            const submissionId = (l.metadata as Record<string, any>)?.submissionId as string | undefined;
            const harvestRecord = submissionId ? harvestById.get(submissionId) : undefined;
            if (harvestRecord?.drachmaReward) {
              return {
                ...l,
                metadata: {
                  ...(l.metadata as Record<string, any>),
                  drachmaReward: harvestRecord.drachmaReward,
                },
              } as ActivityLog;
            }
          }
          return l;
        });
      }

      const syntheticWishLogs = userWishes
        .filter(wish => Boolean(wish.deity))
        .filter(wish => !hasWishTossLog(sortedLogs, wish))
        .map(toWishTossLog);

      // Dates that already have a daily gift log (Bangkok timezone)
      const loggedGiftDates = new Set(
        sortedLogs
          .filter(l => l.category === ACTIVITY_LOG_CATEGORY.DRACHMA && (l.metadata as Record<string, any>)?.source === ACTIVITY_LOG_SOURCES.DAILY_GIFT)
          .map(l => getAppDateString(l.createdAt))
      );

      // Synthetic daily gift logs for accepted claims not in ActivityLogs
      const syntheticClaimLogs: ActivityLog[] = acceptedClaims
        .filter(c => !loggedGiftDates.has(c.date))
        .map(c => ({
          id: `daily-gift-${user.characterId}-${c.date}`,
          category: ACTIVITY_LOG_CATEGORY.DRACHMA,
          action: ACTIVITY_LOG_ACTIONS.AWARD,
          characterId: user.characterId,
          performedBy: user.characterId,
          amount: c.amount,
          metadata: { source: ACTIVITY_LOG_SOURCES.DAILY_GIFT, syntheticFromClaim: true },
          createdAt: `${c.date}T05:00:00.000Z`,
        }));

      setLogs(
        dedupeStatementLogs(
          [...sortedLogs, ...syntheticWishLogs, ...syntheticClaimLogs]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .filter(log => getDisplayCategory(log) !== ACTIVITY_LOG_CATEGORY.ACTION)
        )
      );
    } catch (error) {
      console.error('Failed to load activity logs:', error);
    } finally {
      if (loadId === latestLoadRef.current) {
        setLoading(false);
      }
    }
  };

  const formattedLogs = logs.map(log => formatActivityDisplay(log, user?.characterId));

  const filteredLogs = formattedLogs.filter(formatted => {
    const log = formatted.log;
    const matchesCategory = categoryFilter === 'all' || getDisplayCategory(log) === categoryFilter;
    const searchLower = searchText.toLowerCase();
    const matchesSearch =
      formatted.display.toLowerCase().includes(searchLower) ||
      log.note?.toLowerCase().includes(searchLower);

    return matchesCategory && matchesSearch;
  });

  const categories = ['all', ...Array.from(new Set(logs.map(log => getDisplayCategory(log))))];

  const formatDate = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  const toggleRowExpansion = (logId: string | undefined) => {
    if (!logId) return;
    setExpandedRows(prev => ({
      ...prev,
      [logId]: !prev[logId],
    }));
  };

  const displayName = user?.nicknameEng || user?.nameEng || 'Character';
  return (
    <div
      className="statement"
      style={{
        '--primary-gradient-start': user?.theme?.[0] || '#667eea',
        '--primary-gradient-end': user?.theme?.[1] || '#764ba2',
        '--primary-color': user?.theme?.[0] || '#667eea',
        '--dark-color': user?.theme?.[1] || '#764ba2',
        '--accent-color': user?.theme?.[3] || '#667eea',
      } as React.CSSProperties}
    >
      <div className="statement-shell">
        <section className="statement-header">
          <div className="statement-title-section">
            <p className="statement-kicker">Camp Half-Blood Record</p>
            <h1>Statement of Activity</h1>
            <p className="statement-subtitle">
              A consolidated record of recent account activity for {displayName}.
            </p>
          </div>
          <div className="statement-stats">
            <div className="stat-box">
              <div className="stat-value">{logs.length}</div>
              <div className="stat-label">Entries</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{filteredLogs.length}</div>
              <div className="stat-label">Visible</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{categories.length - 1}</div>
              <div className="stat-label">Categories</div>
            </div>
          </div>
        </section>

        <section className="statement-controls">
          <Input
            type="text"
            placeholder="Search activity"
            value={searchText}
            onChange={text => setSearchText(text)}
          />

          <Dropdown
            options={categories.map(c => ({ label: getCategoryLabel(c), value: c }))}
            value={categoryFilter}
            onChange={c => setCategoryFilter(c as string)}
          />
        </section>

        <section className="statement-feed">
          <div className="statement-feed__header">
            <h2>Activity Entries</h2>
            <p>Entries are listed from newest to oldest.</p>
            <button
              className="statement-refresh-btn"
              onClick={loadActivityLogs}
              disabled={loading}
              title="Refresh"
            >
              <Refresh /> Refresh
            </button>
          </div>

          {loading && logs.length === 0 ? (
            <div className="statement-loading">
              <div className="loader-spinner" />
              <p>Loading statement entries...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="statement-empty">
              <p>{logs.length === 0 ? 'No activity records are available.' : 'No records match the current filters.'}</p>
            </div>
          ) : (
            <div className="activity-list">
              {filteredLogs.map((formatted) => {
                const isWish = isWishLog(formatted.log);
                const deityStyles = getWishDeityStyles(formatted.log);
                const metadata = formatted.log.metadata as Record<string, any> || {};
                const deityClass = isWish ? `activity-card--deity-${(metadata.deity || 'iris').toLowerCase()}` : '';

                return (
                  <article
                    key={formatted.log.id || formatted.log.createdAt}
                    className={`activity-card ${isWish ? 'activity-card--wish' : ''} ${deityClass}`.trim()}
                    style={deityStyles}
                  >
                    <div className="activity-card-header">
                      <div className="activity-icon-badge" aria-hidden="true">
                        <span className="icon">{getCategoryCode(getDisplayCategory(formatted.log), metadata.deity)}</span>
                      </div>
                      <div className="activity-content">
                        <div className="activity-meta">
                          <span className="activity-category">{getCategoryLabel(getDisplayCategory(formatted.log))}</span>
                          <span className="activity-separator" />
                          <span className="activity-timestamp">{formatDate(formatted.log.createdAt)}</span>
                        </div>
                        <div className="activity-main-text">{formatted.display}</div>
                      </div>
                      {formatted.details && (
                        <button
                          className="expand-toggle"
                          onClick={() => toggleRowExpansion(formatted.log.id)}
                          title={expandedRows[formatted.log.id || ''] ? 'Hide details' : 'Show details'}
                        >
                          <span className={`toggle-icon ${expandedRows[formatted.log.id || ''] ? 'open' : ''}`}>
                            Details
                          </span>
                        </button>
                      )}
                    </div>
                    {formatted.details && expandedRows[formatted.log.id || ''] && (
                      <div className="activity-card-details">
                        {formatted.details}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Statement;
