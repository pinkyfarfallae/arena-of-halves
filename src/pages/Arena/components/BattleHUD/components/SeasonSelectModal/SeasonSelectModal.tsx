import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import type { FighterState } from '../../../../../../types/battle';
import { getAllSeasons, getSeasonConfig } from '../../../../../../data/seasons';
import type { SeasonKey } from '../../../../../../data/seasons';
import './SeasonSelectModal.scss';

const SEASON_DETAILS: Record<SeasonKey, { effect: string; effectTh: string }> = {
  summer: {
    effect: '+2 Attack Dice',
    effectTh: '+2 แต้มเต๋าโจมตี',
  },
  autumn: {
    effect: '+2 Max HP',
    effectTh: '+2 HP สูงสุด',
  },
  winter: {
    effect: '+2 Defense Dice',
    effectTh: '+2 แต้มเต๋าป้องกัน',
  },
  spring: {
    effect: 'Heal 1 HP / turn',
    effectTh: 'ฮีล 1 HP ทุกเทิร์น',
  },
};

/* ── Portal tooltip ── */
function SeasonTooltip({ anchorEl, seasonKey }: { anchorEl: HTMLElement; seasonKey: SeasonKey }) {
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const rect = anchorEl.getBoundingClientRect();
    const tipW = tipRef.current?.offsetWidth ?? 160;
    let left = rect.left + rect.width / 2 - tipW / 2;
    // Clamp so it doesn't go off-screen
    left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
    setPos({ top: rect.top - 6, left });
  }, [anchorEl]);

  const season = getSeasonConfig(seasonKey);
  const detail = SEASON_DETAILS[seasonKey];

  return createPortal(
    <div
      ref={tipRef}
      className={`season-tip ${pos ? 'season-tip--visible' : ''}`}
      style={{
        '--tip-color': season.color,
        '--tip-dark': season.colorDark,
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
      } as React.CSSProperties}
    >
      <span className="season-tip__accent" />
      <div className="season-tip__body">
        <span className="season-tip__icon">
          <Suspense fallback={null}>
            <season.icon />
          </Suspense>
        </span>
        <div className="season-tip__text">
          <span className="season-tip__name">{season.labelEn}</span>
          <span className="season-tip__effect">{detail.effect}</span>
          <span className="season-tip__th">{detail.effectTh}</span>
        </div>
      </div>
      <span className="season-tip__scope">All Team · 2 Rounds</span>
      <span className="season-tip__arrow" />
    </div>,
    document.body,
  );
}

/* ── Main component ── */

interface Props {
  attacker: FighterState;
  isMyTurn: boolean;
  phase: string;
  themeColor?: string;
  themeColorDark?: string;
  side?: 'left' | 'right';
  onSelectSeason: (season: SeasonKey) => void;
  onPreviewSeason?: (season: SeasonKey | null) => void;
  onBack?: () => void;
  currentSeason?: SeasonKey;
}

export default function SeasonSelectModal({
  attacker,
  isMyTurn,
  phase,
  themeColor,
  themeColorDark,
  side = 'left',
  onSelectSeason,
  onPreviewSeason,
  onBack,
  currentSeason,
}: Props) {
  const [selectedSeason, setSelectedSeason] = useState<SeasonKey | null>(null);
  const [hoveredSeason, setHoveredSeason] = useState<SeasonKey | null>(null);
  const [hoveredEl, setHoveredEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSelectedSeason(null);
    setHoveredSeason(null);
    setHoveredEl(null);
  }, [phase]);

  const handleEnter = useCallback((key: SeasonKey, el: HTMLElement) => {
    setHoveredSeason(key);
    setHoveredEl(el);
  }, []);

  const handleLeave = useCallback(() => {
    setHoveredSeason(null);
    setHoveredEl(null);
  }, []);

  const themeStyle = {
    '--modal-primary': themeColor,
    '--modal-dark': themeColorDark,
  } as React.CSSProperties;

  if (!isMyTurn) {
    return (
      <div className="bhud__season-modal" style={themeStyle}>
        <span className="bhud__dice-label">Choosing Season</span>
        <span className="bhud__dice-sub">{attacker.nicknameEng} is deciding...</span>
        <div className="bhud__dice-roller bhud__dice-roller--waiting">
          <div className="bhud__roll-waiting-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="bhud__action-modal bhud__action-modal--season" style={themeStyle}>
      <span className="bhud__dice-label">Choose Season</span>
      <span className="bhud__dice-sub">Borrowed Season</span>

      {currentSeason && (
        <span className="bhud__season-note">
          Active: {getSeasonConfig(currentSeason).labelEn} — will be replaced
        </span>
      )}

      <div className="bhud__season-picker">
        {getAllSeasons().map((season) => {
          const IconComponent = season.icon;
          const selected = selectedSeason === season.key;
          return (
            <button
              key={season.key}
              className={`bhud__season-btn ${selected ? 'bhud__season-btn--selected' : ''}`}
              style={{
                '--season-color': season.color,
                '--season-dark': season.colorDark,
              } as React.CSSProperties}
              onMouseEnter={(e) => handleEnter(season.key, e.currentTarget)}
              onMouseLeave={handleLeave}
              onClick={() => {
                const next = selected ? null : season.key;
                setSelectedSeason(next);
                onPreviewSeason?.(next);
              }}
            >
              <span className="bhud__season-icon">
                <Suspense fallback={<div style={{ width: '32px', height: '32px' }} />}>
                  <IconComponent />
                </Suspense>
              </span>
              <span className="bhud__season-label">{season.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* Portal tooltip */}
      {hoveredSeason && hoveredEl && (
        <SeasonTooltip anchorEl={hoveredEl} seasonKey={hoveredSeason} />
      )}

      <div className="bhud__power-actions">
        {onBack && (
          <button className="bhud__power-back" onClick={onBack}>
            Back
          </button>
        )}

        <button
          className="bhud__power-confirm"
          disabled={selectedSeason == null}
          onClick={() => {
            if (selectedSeason) onSelectSeason(selectedSeason);
          }}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
