import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { DEFAULT_THEME, DEITY_THEMES, type BagEntry, type ItemInfo } from '../../../../data/characters';
import './ItemDetailModal.scss';
import Close from '../../../../icons/Close';
import { ITEMS_ACTIONS } from '../../../../data/items';
import { DEITY_SVG, toDeityKey } from '../../../../data/deities';
import Lightning from '../../../../icons/Lightning';
import { DEITY } from '../../../../constants/deities';

interface ItemModalProps {
  itemInfo: ItemInfo & Partial<BagEntry>;
  onClose: () => void;
  onUse?: () => void | Promise<void>;
  isUsing?: boolean;
  todayWish?: {
    deity: string;
    name?: string;
    description?: string;
    canceled?: boolean;
  } | null;
  onDecreeTodayWish?: () => void | Promise<void>;
  canDecreeTodayWish?: boolean;
  trainingPoints?: number;
  codexCount?: number;
  wishesProgress?: {
    current: number;
    total: number;
    claimed?: boolean;
  } | null;
  onExchangeCodex?: () => void;
  canExchangeCodex?: boolean;
}

function Description({ text }: { text?: string }) {
  if (!text?.trim()) {
    return <p className="item-detail-modal__empty">No description recorded for this item yet.</p>;
  }

  const lines = text
    .split(/\s*\\n\s*|\s*\/\s*|\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="item-detail-modal__lines">
      {lines.map((line, i) => {
        const bullet = line.match(/^\*\s*(.*)/);
        const content = bullet ? bullet[1] : line;
        return (
          <div
            key={`${i}-${content}`}
            className={bullet ? 'item-detail-modal__line item-detail-modal__line--bullet' : 'item-detail-modal__line'}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}

export const ItemDetailModal = ({
  itemInfo,
  onClose,
  onUse,
  isUsing,
  todayWish,
  onDecreeTodayWish,
  canDecreeTodayWish,
  trainingPoints = 0,
  codexCount = 0,
  wishesProgress = null,
  onExchangeCodex,
  canExchangeCodex = false,
}: ItemModalProps) => {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const hasImage = !!itemInfo.imageUrl?.trim();
  const ownedAmount = itemInfo.amount ?? 0;
  const canUse = typeof onUse === 'function' && ownedAmount > 0 && !isUsing;
  const actionInfo = ITEMS_ACTIONS[itemInfo.itemId];
  const usageLines = actionInfo?.usage || null;
  const actions = actionInfo?.actions ?? null;
  const sections = actionInfo?.sections ?? [];
  const footerNote = actionInfo?.note ?? null;
  const todayWishSection = sections.find((section) => section.kind === 'todayWish');
  const incomeTrackerSection = sections.find((section) => section.kind === 'incomeTracker');
  const trainingPointsSection = sections.find((section) => section.kind === 'trainingPoints');
  const wishesProgressSection = sections.find((section) => section.kind === 'wishesProgress');
  const todayWishIconKey = todayWish?.deity ? toDeityKey(todayWish.deity) : undefined;
  const wishTheme = todayWish?.deity ? DEITY_THEMES[todayWish.deity.toLowerCase()] : undefined;
  const wishThemeStyle = todayWish?.deity
    ? ({
        '--deity-primary': wishTheme?.[0] || DEFAULT_THEME[0],
        '--deity-secondary': wishTheme?.[1] || DEFAULT_THEME[1],
      } as CSSProperties)
    : undefined;
  const incomeCount = itemInfo.income ?? 0;
  const incomeGoal = 1000;
  const incomeProgress = Math.max(0, Math.min(100, (incomeCount / incomeGoal) * 100));
  const hermesTheme = DEITY_THEMES[DEITY.HERMES.toLowerCase()] || DEFAULT_THEME;
  const incomeThemeStyle = {
    '--deity-primary': hermesTheme[0],
    '--deity-secondary': hermesTheme[1],
  } as CSSProperties;
  const isIncomeRewardClaimed = itemInfo.available === false;
  const wishesCurrent = wishesProgress?.current ?? 0;
  const wishesTotal = wishesProgress?.total ?? 0;
  const wishesProgressPercent = wishesTotal > 0 ? Math.max(0, Math.min(100, (wishesCurrent / wishesTotal) * 100)) : 0;
  const irisTheme = DEITY_THEMES[DEITY.IRIS.toLowerCase()] || DEFAULT_THEME;
  const wishesThemeStyle = {
    '--deity-primary': irisTheme[0],
    '--deity-secondary': irisTheme[1],
  } as CSSProperties;
  const isWishesRewardClaimed = !!wishesProgress?.claimed;

  return (
    <div className="item-detail-modal__overlay" onClick={onClose} role="presentation">
      <div
        className="item-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-detail-modal-title"
        aria-describedby="item-detail-modal-body"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Hero ─────────────────────────── */}
        <div className="item-detail-modal__hero">
          <div className="item-detail-modal__visual-shell">
            <div className="item-detail-modal__visual">
              {hasImage ? (
                <img
                  className="item-detail-modal__image"
                  src={itemInfo.imageUrl}
                  alt={itemInfo.labelEng}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="item-detail-modal__image item-detail-modal__image--fallback" aria-hidden>
                  {itemInfo.labelEng?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
            </div>
          </div>

          <div className="item-detail-modal__heading">
            <h2 id="item-detail-modal-title" className="item-detail-modal__title">
              {itemInfo.labelEng}
            </h2>
            {itemInfo.labelThai && (
              <p className="item-detail-modal__subtitle">{itemInfo.labelThai}</p>
            )}
            <div className="item-detail-modal__owned-row">
              <span className="item-detail-modal__owned-badge">
                In bag: <strong>{ownedAmount}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* ── Body ─────────────────────────── */}
        <div className="item-detail-modal__body" id="item-detail-modal-body">
          <section className="item-detail-modal__panel">
            <div className="item-detail-modal__panel-head">
              <span className="item-detail-modal__panel-title">Description</span>
              <span className="item-detail-modal__panel-line" />
            </div>
            <Description text={itemInfo.description} />
          </section>

          {usageLines && (
            <section className="item-detail-modal__panel">
              <div className="item-detail-modal__panel-head">
                <span className="item-detail-modal__panel-title">How to Use</span>
                <span className="item-detail-modal__panel-line" />
              </div>
              <Description text={usageLines || undefined} />
          </section>)}

          {todayWishSection && (
            <section className="item-detail-modal__panel">
              <div className="item-detail-modal__panel-head">
                <span className="item-detail-modal__panel-title">{todayWishSection.title}</span>
                <span className="item-detail-modal__panel-line" />
              </div>
              {todayWish?.deity ? (
                <div
                  className={`item-detail-modal__wish-card${todayWish.canceled ? ' item-detail-modal__wish-card--canceled' : ''}`}
                  style={wishThemeStyle}
                >
                  <div className="item-detail-modal__wish-header">
                    <div className="item-detail-modal__wish-icon">
                      {todayWishIconKey ? DEITY_SVG[todayWishIconKey] : <Lightning width={14} height={14} />}
                    </div>
                    <div className="item-detail-modal__wish-text">
                      <p className="item-detail-modal__wish-deity">
                        Wish given by <b>{todayWish.deity}</b>
                      </p>
                      <p className="item-detail-modal__wish-name">{todayWish.name || todayWish.deity}</p>
                    </div>
                  </div>
                  <p className="item-detail-modal__wish-description">
                    {todayWish.description || 'No description recorded for this wish yet.'}
                  </p>
                  <div className="item-detail-modal__wish-actions">
                    <button
                      type="button"
                      className="item-detail-modal__wish-action"
                      onClick={onDecreeTodayWish}
                      disabled={!canDecreeTodayWish}
                    >
                      {todayWish.canceled ? 'Decreed Purge' : 'Decree Purge'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="item-detail-modal__empty">
                  No active wish is recorded for today. Toss a drachma to the wishing well and see if you can get a wish from the gods!
                </p>
              )}
            </section>
          )}

          {trainingPointsSection && (
            <section className="item-detail-modal__panel">
              <div className="item-detail-modal__panel-head">
                <span className="item-detail-modal__panel-title">{trainingPointsSection.title}</span>
                <span className="item-detail-modal__panel-line" />
              </div>
              <div className="item-detail-modal__training-card">
                <div className="item-detail-modal__training-stats">
                  <div className="item-detail-modal__training-stat">
                    <p className="item-detail-modal__training-stat-label">Current Points</p>
                    <p className="item-detail-modal__training-stat-value">{trainingPoints}</p>
                  </div>
                  <div className="item-detail-modal__training-stat">
                    <p className="item-detail-modal__training-stat-label">Codex in Bag</p>
                    <p className="item-detail-modal__training-stat-value">{codexCount}</p>
                  </div>
                  <div className="item-detail-modal__training-stat">
                    <p className="item-detail-modal__training-stat-label">Conversion Rate</p>
                    <p className="item-detail-modal__training-stat-value">1:3</p>
                  </div>
                  <div className="item-detail-modal__training-stat">
                    <p className="item-detail-modal__training-stat-label">Potential Gain</p>
                    <p className="item-detail-modal__training-stat-value">{codexCount * 3}</p>
                  </div>
                </div>
                <p className="item-detail-modal__training-note">
                  {codexCount > 0 
                    ? `Exchange all ${codexCount} codex${codexCount === 1 ? '' : 'es'} to gain ${codexCount * 3} training point${codexCount * 3 === 1 ? '' : 's'}.`
                    : 'You don\'t have any Athena\'s Codex yet. Visit the Training Grounds to see how to obtain one.'}
                </p>
                <button
                  type="button"
                  className="item-detail-modal__button item-detail-modal__button--primary"
                  onClick={onExchangeCodex}
                  disabled={!canExchangeCodex || codexCount === 0}
                >
                  {codexCount > 0 ? `Exchange ${codexCount} Codex` : 'No Codex to Exchange'}
                </button>
              </div>
            </section>
          )}

          {wishesProgressSection && (
            <section className="item-detail-modal__panel">
              <div className="item-detail-modal__panel-head">
                <span className="item-detail-modal__panel-title">{wishesProgressSection.title}</span>
                <span className="item-detail-modal__panel-line" />
              </div>
              <div className="item-detail-modal__income-card" style={wishesThemeStyle}>
                <div className="item-detail-modal__income-header">
                  <div className="item-detail-modal__income-icon">
                    {DEITY_SVG[DEITY.IRIS] || <Lightning width={14} height={14} />}
                  </div>
                  <div className="item-detail-modal__income-copy">
                    <p className="item-detail-modal__income-label">Iris Keychain Progress</p>
                    <p className="item-detail-modal__income-value">
                      {wishesCurrent.toLocaleString()} / {wishesTotal.toLocaleString()} wishes collected
                    </p>
                  </div>
                  <div className={`item-detail-modal__income-state${isWishesRewardClaimed ? ' item-detail-modal__income-state--done' : ''}`}>
                    {isWishesRewardClaimed ? 'Reward claimed' : `${Math.round(wishesProgressPercent)}%`}
                  </div>
                </div>
                <div className="item-detail-modal__income-bar" aria-hidden="true">
                  <span className="item-detail-modal__income-fill" style={{ width: `${wishesProgressPercent}%` }} />
                </div>
                <p className="item-detail-modal__income-note">
                  {isWishesRewardClaimed
                    ? 'This keychain has already granted its 5000 drachma bonus.'
                    : `${Math.max(0, wishesTotal - wishesCurrent).toLocaleString()} more deity wish${wishesTotal - wishesCurrent === 1 ? '' : 'es'} needed to trigger the 5000 drachma bonus.`}
                </p>
              </div>
            </section>
          )}

          {incomeTrackerSection && (
            <section className="item-detail-modal__panel">
              <div className="item-detail-modal__panel-head">
                <span className="item-detail-modal__panel-title">{incomeTrackerSection.title}</span>
                <span className="item-detail-modal__panel-line" />
              </div>
              <div className="item-detail-modal__income-card" style={incomeThemeStyle}>
                <div className="item-detail-modal__income-header">
                  <div className="item-detail-modal__income-icon">
                    {DEITY_SVG[DEITY.HERMES] || <Lightning width={14} height={14} />}
                  </div>
                  <div className="item-detail-modal__income-copy">
                    <p className="item-detail-modal__income-label">Hermes Purse Progress</p>
                    <p className="item-detail-modal__income-value">
                      {incomeCount.toLocaleString()} / {incomeGoal.toLocaleString()} drachma
                    </p>
                  </div>
                  <div className={`item-detail-modal__income-state${isIncomeRewardClaimed ? ' item-detail-modal__income-state--done' : ''}`}>
                    {isIncomeRewardClaimed ? 'Reward claimed' : `${Math.round(incomeProgress)}%`}
                  </div>
                </div>
                <div className="item-detail-modal__income-bar" aria-hidden="true">
                  <span className="item-detail-modal__income-fill" style={{ width: `${incomeProgress}%` }} />
                </div>
                <p className="item-detail-modal__income-note">
                  {isIncomeRewardClaimed
                    ? 'This purse has already completed its 500 drachma payout.'
                    : `${Math.max(0, incomeGoal - incomeCount).toLocaleString()} more drachma income needed to trigger the 500 drachma bonus.`}
                </p>
              </div>
            </section>
          )}
        </div>

        {/* ── Footer ───────────────────────── */}
        <div className="item-detail-modal__footer">
          <p className="item-detail-modal__footer-note">{footerNote}</p>
          <button
            type="button"
            className="item-detail-modal__button item-detail-modal__button--secondary"
            onClick={onClose}
          >
            Close
          </button>
          <div className="item-detail-modal__footer-actions">
            {actions?.map((a, i) => (
              <button
                key={i}
                type="button"
                className={`item-detail-modal__button ${a.variant === 'dark' ? 'item-detail-modal__button--dark' : 'item-detail-modal__button--primary'}`}
                onClick={() => {
                  if (typeof a.action === 'string' && a.action) {
                    window.open(a.action, '_blank');
                  } else if (a.onClick) {
                    a.onClick();
                  } else if (canUse && onUse) {
                    onUse();
                  }
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
