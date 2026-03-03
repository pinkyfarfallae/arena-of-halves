import { useState, useEffect, Suspense } from 'react';
import { createPortal } from 'react-dom';
import type { FighterState } from '../../../../../../types/battle';
import { getAllSeasons } from '../../../../../../data/seasons';
import type { SeasonKey } from '../../../../../../data/seasons';
import './SeasonSelectModal.scss';

interface Props {
  attacker: FighterState;
  isMyTurn: boolean;
  phase: string;
  themeColor?: string;
  themeColorDark?: string;
  side?: 'left' | 'right';
  onSelectSeason: (season: SeasonKey) => void;
}

/**
 * SeasonSelectModal — Allows Persephone player to select a season.
 * Similar structure to ActionSelectModal but with season-specific theming.
 */
export default function SeasonSelectModal({
  attacker,
  isMyTurn,
  phase,
  themeColor,
  themeColorDark,
  side = 'left',
  onSelectSeason,
}: Props) {
  const [selectedSeason, setSelectedSeason] = useState<SeasonKey | null>(null);

  // Reset state when phase changes
  useEffect(() => {
    setSelectedSeason(null);
  }, [phase]);

  const themeStyle = {
    '--modal-primary': themeColor,
    '--modal-dark': themeColorDark,
  } as React.CSSProperties;

  // Opponent is deciding
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

  // My turn — choose season
  return (
    <div className="bhud__action-modal bhud__action-modal--season" style={themeStyle}>
      <span className="bhud__dice-label">Choose Season</span>
      <span className="bhud__dice-sub">Borrowed Season</span>

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
              onClick={() => setSelectedSeason(selected ? null : season.key)}
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

      <button
        className="bhud__season-confirm"
        disabled={selectedSeason == null}
        onClick={() => {
          if (selectedSeason) onSelectSeason(selectedSeason);
        }}
      >
        Confirm
      </button>
    </div>
  );
}
