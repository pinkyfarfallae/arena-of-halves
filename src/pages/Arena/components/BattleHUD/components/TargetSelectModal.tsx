import type { FighterState } from '../../../../../types/battle';
import './TargetSelectModal.scss';

interface Props {
  attackerName: string;
  targets: FighterState[];
  themeColor?: string;
  themeColorDark?: string;
  onSelect: (defenderId: string) => void;
}

export default function TargetSelectModal({ attackerName, targets, themeColor, themeColorDark, onSelect }: Props) {
  return (
    <div
      className="bhud__targets-modal"
      style={{ '--modal-primary': themeColor, '--modal-dark': themeColorDark } as React.CSSProperties}
    >
      <span className="bhud__dice-label">Select Target</span>
      <span className="bhud__dice-sub">{attackerName}'s turn</span>
      <div className="bhud__targets-list">
        {targets.map((t) => (
          <button
            key={t.characterId}
            className="bhud__target-btn"
            style={{ '--t-color': t.theme[0] } as React.CSSProperties}
            onClick={() => onSelect(t.characterId)}
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
    </div>
  );
}
