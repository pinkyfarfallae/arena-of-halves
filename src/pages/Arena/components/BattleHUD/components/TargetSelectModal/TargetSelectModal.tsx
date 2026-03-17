import { useState } from 'react';
import type { FighterState } from '../../../../../../types/battle';
import './TargetSelectModal.scss';

interface Props {
  attackerName: string;
  targets: FighterState[];
  themeColor?: string;
  themeColorDark?: string;
  onSelect: (defenderId: string) => void;
  onBack?: () => void;
  /** When true, Back is hidden (e.g. Soul Devourer must pick target and cannot cancel). */
  backDisabled?: boolean;
  /** Optional subtitle (e.g. "Choose target" after poem verse selection). */
  subtitle?: string;
}

export default function TargetSelectModal({ attackerName, targets, themeColor, themeColorDark, onSelect, onBack, backDisabled, subtitle }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div
      className="bhud__targets-modal"
      style={{ '--modal-primary': themeColor, '--modal-dark': themeColorDark } as React.CSSProperties}
    >
      <span className="bhud__dice-label">Select Target</span>
      <span className="bhud__dice-sub">{subtitle ?? `${attackerName}'s turn`}</span>
      <div className="bhud__targets-list">
        {targets.map((t) => (
          <button
            key={t.characterId}
            className={`bhud__target-btn${selectedId === t.characterId ? ' bhud__target-btn--selected' : ''}`}
            style={{ '--t-color': t.theme[0] } as React.CSSProperties}
            onClick={() => setSelectedId(t.characterId)}
          >
            {t.image ? (
              <img className="bhud__target-img" src={t.image} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="bhud__target-initial" style={{ background: t.theme[0], color: t.theme[9] }}>{t.nicknameEng.charAt(0)}</span>
            )}
            <div className="bhud__target-info">
              <span className="bhud__target-name">{t.nicknameEng}</span>
              <span className="bhud__target-hp">{t.currentHp}/{t.maxHp}</span>
            </div>
          </button>
        ))}
      </div>
      <div className="bhud__target-actions">
        {onBack != null && !backDisabled && (
          <button type="button" className="bhud__target-back" onClick={onBack}>
            Back
          </button>
        )}
        <button
          className="bhud__target-confirm"
          disabled={!selectedId}
          onClick={() => selectedId && onSelect(selectedId)}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
