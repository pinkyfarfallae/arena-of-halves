import React, { useEffect, useState } from 'react';
import { ACTIONS } from '../../constants/action';
import { useAuth } from '../../hooks/useAuth';
import { ActivityLog } from '../../types/activityLog';
import { fetchActivityLogs } from '../../services/activityLog/activityLogService';
import { fetchUserWishOfIris, IrisWishDoc } from '../../data/wishes';
import './Statement.scss';
import { Dropdown, Input } from '../../components/Form';
import { ACTIVITY_LOG_ACTIONS, SOURCE_LABELS } from '../../constants/activityLog';
import { toTitleCase } from '../../utils/formatText';
import { DEITY_THEMES } from '../../constants/theme';
import { hexToRgb } from '../../utils/color';
import Drachma from '../../icons/Drachma';
import { Deity } from '../../constants/deities';
import { DEITY_SVG } from '../../data/deities';

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

const toWishTossLog = (wish: IrisWishDoc): ActivityLog => ({
  id: `wish-${wish.userId}-${wish.date}-${wish.deity}`,
  category: 'action',
  action: ACTIVITY_LOG_ACTIONS.WISH_TOSSED,
  characterId: wish.userId,
  performedBy: wish.userId,
  metadata: {
    source: 'iris_fountain',
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
    source === 'iris_wish' ||
    source.startsWith('iris_wish_') ||
    source === 'nike_wish_battle_bonus' ||
    log.performedBy === 'iris_wish'
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

const formatActivityDisplay = (log: ActivityLog): FormattedActivity => {
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

    if (log.category === 'item') {
      return {
        ...baseResult,
        display: `Wish of ${deity} granted ${log.amount || 1} x ${itemId}.`,
      };
    };

    if (log.category === 'stat') {
      return {
        ...baseResult,
        display: `Wish of ${deity} granted ${log.amount || 0} Training Point${log.amount === 1 ? '' : 's'}.`,
      };
    }

    if (log.category === 'drachma' && wishSource === 'nike_wish_battle_bonus') {
      return {
        ...baseResult,
        display: `Earned ${log.amount?.toLocaleString() || 0} drachma bonus from the Wish of Nike after winning a battle.`,
      };
    }
  }

  switch (log.category) {
    case 'drachma':
      if (log.action === ACTIVITY_LOG_ACTIONS.EARN_DRACHMA || log.action === ACTIVITY_LOG_ACTIONS.AWARD) {
        const source = metadata.source || 'unknown source';

        if (source === 'iris_fountain') {
          return {
            ...baseResult,
            display: `Earned ${log.amount?.toLocaleString()} drachma from Rainbow Drachma after the Wish of Iris.`,
          };
        }

        if (source === 'treasury_transfer') {
          const fromName = (metadata.fromName as string) || (metadata.fromUserId as string) || 'another character';
          return {
            ...baseResult,
            display: `Received ${log.amount?.toLocaleString()} drachma from ${fromName} via Camp Treasury Transfer.`,
          };
        }

        return {
          ...baseResult,
          display: `Earned ${log.amount?.toLocaleString()} drachma from ${formatSourceLabel(String(source))}.`,
        };
      }
      if (log.action === ACTIVITY_LOG_ACTIONS.DEDUCT || log.action === ACTIVITY_LOG_ACTIONS.SPEND_DRACHMA || log.action === ACTIVITY_LOG_ACTIONS.CONSUME_DRACHMA) {
        const source = metadata.source || 'unknown source';

        if (source === 'treasury_transfer') {
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

    case 'item':
      if (log.action === ACTIVITY_LOG_ACTIONS.SHOP_PURCHASE) {
        const purchasedItems = (metadata.items as Array<{ itemId: string; quantity: number; price: number }>) || [];
        const finalPrice = metadata.finalPrice ?? metadata.totalPrice ?? log.amount ?? 0;
        const discountApplied = Boolean(metadata.discountApplied);
        const discountAmount = metadata.discountAmount ?? 0;
        const itemCount = purchasedItems.reduce((sum: number, i: { quantity: number }) => sum + i.quantity, 0) || log.amount || purchasedItems.length;
        const discountNote = discountApplied ? ` (saved ${Number(discountAmount).toLocaleString()} drachma with 30% discount)` : '';
        return {
          ...baseResult,
          display: `Purchased ${itemCount} item${itemCount === 1 ? '' : 's'} from the Shop for ${Number(finalPrice).toLocaleString()} drachma${discountNote}.`,
          details: purchasedItems.length > 0 ? (
            <div className="activity-details">
              {discountApplied && (
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
                    {item.price != null && <span className="detail-price"> — {Number(item.price * item.quantity).toLocaleString()} drachma</span>}
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
        const source = metadata.source || 'unknown';
        return {
          ...baseResult,
          display: `Received ${log.amount} x ${toTitleCase(itemId)}${source !== 'manual' ? ` from ${formatSourceLabel(String(source))}` : ''}.`,
        };
      }
      if (log.action === ACTIVITY_LOG_ACTIONS.CONSUME_ITEM) {
        const itemId = metadata.itemId || 'item';
        const source = metadata.source || 'usage';
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

    case 'stat':
      if (log.action === ACTIVITY_LOG_ACTIONS.APPROVE_TRAINING) {
        const trainingDate = metadata.date || 'unknown date';
        const withFortune = Boolean(metadata.withFullLevelFortune);
        const isAthena = Boolean(metadata.isAthena);
        const athenaBonus = metadata.athenaBonus ?? 0;
        const totalTP = metadata.totalTP ?? log.amount;
        const hasDetails = withFortune || isAthena || athenaBonus > 0;

        return {
          ...baseResult,
          display: `Your roleplay submission was approved. Earned ${totalTP} Training Point${totalTP === 1 ? '' : 's'}.`,
          details: hasDetails ? (
            <div className="activity-details">
              <div className="activity-detail-item">
                <span className="detail-bullet" />
                <span className="detail-text">Training date: {formatDateOnly(trainingDate)}</span>
              </div>
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
              {!withFortune && !isAthena && (
                <div className="activity-detail-item">
                  <span className="detail-bullet" />
                  <span className="detail-text">Base approval: {log.amount} TP</span>
                </div>
              )}
            </div>
          ) : undefined,
        };
      }
      if (log.action === ACTIVITY_LOG_ACTIONS.ADD_TRAINING_POINTS) {
        return {
          ...baseResult,
          display: `Earned ${log.amount} Training Point${log.amount === 1 ? '' : 's'} from ${sourceLabel}.`,
        };
      }
      if (log.action === ACTIVITY_LOG_ACTIONS.DEDUCT_TRAINING_POINTS || log.action === ACTIVITY_LOG_ACTIONS.SPEND_TRAINING_POINTS_UPGRADE) {
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

    case 'action':
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

        return {
          ...baseResult,
          display: `${isHarvest ? 'Harvest' : 'Mission'} approval granted. Earned ${log.amount} drachma.`,
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
      if (log.action === 'approveBigHouseRoleplay' || log.action === 'approve_big_house') {
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

  useEffect(() => {
    loadActivityLogs();
  }, [user]);

  const loadActivityLogs = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [allLogs, userWishes] = await Promise.all([
        fetchActivityLogs(500),
        fetchUserWishOfIris(user.characterId),
      ]);

      const userLogs = allLogs
        .filter(log => log.characterId === user.characterId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const syntheticWishLogs = userWishes
        .filter(wish => Boolean(wish.deity))
        .filter(wish => !hasWishTossLog(userLogs, wish))
        .map(toWishTossLog);

      setLogs(
        [...userLogs, ...syntheticWishLogs]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .filter(log => getDisplayCategory(log) !== 'action')
      );
    } catch (error) {
      console.error('Failed to load activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formattedLogs = logs.map(log => formatActivityDisplay(log));

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
