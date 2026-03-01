import { useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { FighterState } from '../../../../../types/battle';
import { POWER_META } from '../../../../CharacterInfo/constants/powerMeta';
import { DEITY_DISPLAY_OVERRIDES } from '../../../../CharacterInfo/constants/overrides';
import LockOpen from '../../../../CharacterInfo/icons/LockOpen';
import LockClosed from '../../../../CharacterInfo/icons/LockClosed';
import { DEITY_SVG } from '../../../../../data/deities';
import './MemberChip.scss';

const PATTERN_ROWS = 23;
const ICONS_PER_ROW = 30;
const BP_COMPACT = 600;

/** Popup rendered via portal so it sits above all stacking contexts. */
function PopupPanel({ fighter, deityLabel, chipRef, onEnter, onLeave }: {
  fighter: FighterState;
  deityLabel: string;
  chipRef: React.RefObject<HTMLDivElement | null>;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const rect = chipRef.current?.getBoundingClientRect();
  if (!rect) return null;

  const isCompact = window.innerWidth <= BP_COMPACT;
  const style: React.CSSProperties = {
    '--chip-primary': fighter.theme[0],
    '--chip-accent': fighter.theme[1],
  } as React.CSSProperties;

  if (isCompact) {
    Object.assign(style, {
      position: 'fixed' as const,
      top: rect.top + rect.height / 2,
      left: rect.right + 5,
      transform: 'translateY(-50%)',
    });
  } else {
    Object.assign(style, {
      position: 'fixed' as const,
      top: rect.bottom - 32 + 5,
      left: rect.left + rect.width / 2,
      transform: 'translateX(-50%)',
    });
  }

  return (
    <div
      className="mchip__popup mchip__popup--visible"
      style={style}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className="mchip__popup-header">
        <span className="mchip__popup-name">{fighter.nicknameEng}</span>
        <span className="mchip__popup-deity">{deityLabel}</span>
      </div>

      <div className="mchip__stats">
        {([
          ['DMG', fighter.damage],
          ['+ATK', fighter.attackDiceUp],
          ['+DEF', fighter.defendDiceUp],
          ['SPD', fighter.speed],
          ['REROLL', fighter.rerollsLeft],
        ] as [string, number][]).map(([label, val]) => (
          <div className="mchip__stat" key={label}>
            <span className="mchip__stat-lbl">{label}</span>
            <span className="mchip__stat-val">{val}</span>
          </div>
        ))}
      </div>

      <div className="mchip__skills">
        {([
          ['PASSIVE', fighter.passiveSkillPoint],
          ['SKILL', fighter.skillPoint],
          ['ULTIMATE', fighter.ultimateSkillPoint],
        ] as [string, string][]).map(([label, val]) => {
          const unlocked = val.toLowerCase() === 'unlock';
          return (
            <div key={label} className={`mchip__so ${unlocked ? '' : 'mchip__so--locked'}`}>
              <div className="mchip__so-orb">
                <svg className="mchip__so-svg" viewBox="0 0 60 60">
                  <circle cx="30" cy="30" r={26} className="mchip__so-track" />
                  <circle cx="30" cy="30" r={26} className="mchip__so-arc"
                    strokeDasharray={2 * Math.PI * 26}
                    strokeDashoffset={unlocked ? 0 : 2 * Math.PI * 26} />
                </svg>
                {unlocked ? <LockOpen className="mchip__so-icon" /> : <LockClosed className="mchip__so-icon" />}
              </div>
              <span className="mchip__so-label">{label}</span>
            </div>
          );
        })}
      </div>

      <div className="mchip__powers">
        {(['Passive', '1st Skill', '2nd Skill', 'Ultimate'] as const).map((type) => {
          const p = (fighter.powers || []).find((pw) => pw.type === type);
          const meta = POWER_META[type] || { icon: '◇', tag: type.toUpperCase(), cls: '' };
          return (
            <div className={`mchip__power${p ? '' : ' mchip__power--locked'}`} key={type}>
              <span className="mchip__power-icon">{meta.icon}</span>
              <div className="mchip__power-info">
                <span className="mchip__power-tag">{meta.tag}</span>
                <span className="mchip__power-name">{p ? p.name : '—'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface Props {
  fighter: FighterState;
  isAttacker?: boolean;
  isDefender?: boolean;
  isEliminated?: boolean;
  isTargetable?: boolean;
  isSpotlight?: boolean;
  onSelect?: () => void;
}

export default function MemberChip({ fighter, isAttacker, isDefender, isEliminated, isTargetable, isSpotlight, onSelect }: Props) {
  const chipRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [hovered, setHovered] = useState(false);

  const handleEnter = useCallback(() => {
    clearTimeout(hoverTimer.current);
    setHovered(true);
  }, []);

  const handleLeave = useCallback(() => {
    hoverTimer.current = setTimeout(() => setHovered(false), 100);
  }, []);

  const hpPct = Math.min((fighter.currentHp / fighter.maxHp) * 100, 100);
  const deityLabel = DEITY_DISPLAY_OVERRIDES[fighter.characterId] || fighter.deityBlood;
  const deityIcon = DEITY_SVG[deityLabel.toLowerCase()];

  const chipClass = [
    'mchip',
    hovered && 'mchip--hovered',
    isAttacker && 'mchip--attacker',
    isDefender && 'mchip--defender',
    isEliminated && 'mchip--eliminated',
    isTargetable && !isEliminated && 'mchip--targetable',
    isSpotlight && 'mchip--spotlight',
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={chipRef}
      className={chipClass}
      style={{ '--chip-primary': fighter.theme[0], '--chip-accent': fighter.theme[1] } as React.CSSProperties}
      onClick={isTargetable && !isEliminated && onSelect ? onSelect : undefined}
      role={isTargetable && !isEliminated ? 'button' : undefined}
    >
      {/* Body — clips pattern, fades edges with gradient */}
      <div className="mchip__body">
        {deityIcon && (
          <div className="mchip__pattern" aria-hidden="true">
            {Array.from({ length: PATTERN_ROWS }, (_, row) => (
              <div className="mchip__pattern-row" key={row}>
                {Array.from({ length: ICONS_PER_ROW }, (_, col) => (
                  <span className="mchip__pattern-icon" key={col}>{deityIcon}</span>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Card frame — outside body so it's not masked */}
      <div className="mchip__frame" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
        {fighter.image ? (
          <img className="mchip__bg" src={fighter.image} alt="" />
        ) : (
          <div className="mchip__bg mchip__bg--placeholder">
            {fighter.nicknameEng.charAt(0)}
          </div>
        )}

        <div className="mchip__inner-border" />

        {/* Target crosshair badge — shown when selected as defend target */}
        {isDefender && (
          <div className="mchip__target-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
            </svg>
          </div>
        )}

        <div className="mchip__overlay">
          <span className="mchip__name">{fighter.nicknameEng}</span>
          <span className="mchip__deity-tag">{deityLabel}</span>
          <div className="mchip__hp">
            <div className="mchip__hp-track">
              <div className="mchip__hp-fill" style={{ width: `${hpPct}%` }} />
            </div>
            <span className="mchip__hp-label">
              {fighter.currentHp}/{fighter.maxHp}
            </span>
          </div>
        </div>
      </div>

      {/* Hover stat popup — rendered via portal to escape stacking contexts */}
      {hovered && chipRef.current && createPortal(
        <PopupPanel
          fighter={fighter}
          deityLabel={deityLabel}
          chipRef={chipRef}
          onEnter={handleEnter}
          onLeave={handleLeave}
        />,
        document.body,
      )}
    </div>
  );
}
