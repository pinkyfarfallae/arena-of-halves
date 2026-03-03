import { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { FighterState } from '../../../../../types/battle';
import { lightenColor } from '../../../../../utils/color';
import PetalShield from './icons/PetalShield';

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
function PopupPanel({ fighter, deityLabel, chipRef, onEnter, onLeave, statMods, battleEnded }: {
  fighter: FighterState;
  deityLabel: string;
  chipRef: React.RefObject<HTMLDivElement | null>;
  onEnter: () => void;
  onLeave: () => void;
  statMods?: Record<string, number>;
  battleEnded?: boolean;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const rect = chipRef.current?.getBoundingClientRect();

  const isCompact = window.innerWidth <= BP_COMPACT;

  useEffect(() => {
    const el = popupRef.current;
    if (!el || !rect) return;
    const pw = el.offsetWidth;
    const ph = el.offsetHeight;
    const pad = 6;
    let top: number;
    let left: number;

    if (isCompact) {
      top = rect.top + rect.height / 2 - ph / 2;
      left = rect.right + 5;
      // If overflows right, flip to left of chip
      if (left + pw > window.innerWidth - pad) left = rect.left - pw - 5;
    } else {
      top = rect.bottom - 15 + (battleEnded ? 20 : 0);
      left = rect.left + rect.width / 2 - pw / 2;
    }

    // Clamp to viewport
    top = Math.max(pad, Math.min(top, window.innerHeight - ph - pad));
    left = Math.max(pad, Math.min(left, window.innerWidth - pw - pad));
    setPos({ top, left });
  });

  if (!rect) return null;

  const style: React.CSSProperties = {
    '--chip-primary': fighter.theme[0],
    '--chip-accent': fighter.theme[1],
    position: 'fixed',
    visibility: pos ? 'visible' : 'hidden',
    top: pos?.top ?? 0,
    left: pos?.left ?? 0,
  } as React.CSSProperties;

  return (
    <div
      ref={popupRef}
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
          ['DMG', fighter.damage, statMods?.damage],
          ['+ATK', fighter.attackDiceUp, statMods?.attackDiceUp],
          ['+DEF', fighter.defendDiceUp, statMods?.defendDiceUp],
          ['SPD', fighter.speed, statMods?.speed],
          ['REROLL', fighter.rerollsLeft, undefined],
        ] as [string, number, number | undefined][]).map(([label, base, mod]) => {
          const m = mod ?? 0;
          return (
            <div className={`mchip__stat${m > 0 ? ' mchip__stat--buffed' : m < 0 ? ' mchip__stat--debuffed' : ''}`} key={label}>
              <span className="mchip__stat-lbl">{label}</span>
              <span className="mchip__stat-val">
                {base + m}
                {m !== 0 && <span className="mchip__stat-mod">{m > 0 ? `+${m}` : m}</span>}
              </span>
            </div>
          );
        })}
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

export interface EffectPip {
  powerName: string;
  sourceName: string;
  sourceTheme: [string, string];
  turnsLeft: number;
  /** Number of stacked instances of this same power from the same source */
  count: number;
}

/** Hover tooltip for effect pips — positioned via portal above all stacking contexts */
function EffectPipTooltip({ pip, rect }: { pip: EffectPip; rect: DOMRect }) {
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const el = tipRef.current;
    if (!el) return;
    const tipW = el.offsetWidth;
    const tipH = el.offsetHeight;
    // Position to the left of the pip
    let left = rect.left - tipW - 6;
    let top = rect.top + rect.height / 2 - tipH / 2;
    // If overflows left, flip to right
    if (left < 4) left = rect.right + 6;
    // Clamp vertical
    top = Math.max(4, Math.min(top, window.innerHeight - tipH - 4));
    setPos({ top, left });
  }, [rect]);

  return createPortal(
    <div
      ref={tipRef}
      className="mchip__pip-tooltip"
      style={{
        top: pos.top,
        left: pos.left,
        '--pip-c1': pip.sourceTheme[0],
        '--pip-c2': pip.sourceTheme[1],
      } as React.CSSProperties}
    >
      <span className="mchip__pip-tooltip-name">{pip.powerName}</span>
      <span className="mchip__pip-tooltip-source">by {pip.sourceName}</span>
      <div className="mchip__pip-tooltip-meta">
        {pip.count > 1 && <span className="mchip__pip-tooltip-stacks">{pip.count} stack{pip.count > 1 ? 's' : ''}</span>}
        <span className="mchip__pip-tooltip-turns">{pip.turnsLeft === 999 ? 'unlimited' : `${pip.turnsLeft * pip.count} turn${pip.turnsLeft * pip.count > 1 ? 's' : ''}`}</span>
      </div>
    </div>,
    document.body,
  );
}

/** Single effect pip dot with hover-to-show tooltip */
function EffectPipDot({ pip }: { pip: EffectPip }) {
  const dotRef = useRef<HTMLDivElement>(null);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);

  const onEnter = useCallback(() => {
    if (dotRef.current) setHoverRect(dotRef.current.getBoundingClientRect());
  }, []);
  const onLeave = useCallback(() => setHoverRect(null), []);

  return (
    <>
      <div
        ref={dotRef}
        className="mchip__effect-pip"
        style={{ background: `linear-gradient(135deg, ${pip.sourceTheme[0]}, ${pip.sourceTheme[1]})` }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      />
      {hoverRect && <EffectPipTooltip pip={pip} rect={hoverRect} />}
    </>
  );
}

interface Props {
  fighter: FighterState;
  isAttacker?: boolean;
  isDefender?: boolean;
  isEliminated?: boolean;
  isTargetable?: boolean;
  isSpotlight?: boolean;
  isCrit?: boolean;
  isHit?: boolean;
  isShockHit?: boolean;
  isThunderboltHit?: boolean;
  isShocked?: boolean;
  isPetalShielded?: boolean;
  turnOrder?: number;
  effectPips?: EffectPip[];
  /** Stat modifiers from active effects: { damage, attackDiceUp, defendDiceUp, speed, criticalRate } */
  statMods?: Record<string, number>;
  battleEnded?: boolean;
  onSelect?: () => void;
}

export default function MemberChip({ fighter, isAttacker, isDefender, isEliminated, isTargetable, isSpotlight, isCrit, isHit, isShockHit, isThunderboltHit, isShocked, isPetalShielded, turnOrder, effectPips, statMods, battleEnded, onSelect }: Props) {
  const chipRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [hovered, setHovered] = useState(false);

  /* ── Hit flash: vibrate + red overlay (driven by isHit prop) ── */
  const [isHitActive, setIsHitActive] = useState(false);
  const prevIsHitRef = useRef(false);

  useEffect(() => {
    if (isHit && !prevIsHitRef.current) {
      setIsHitActive(true);
      const timer = setTimeout(() => setIsHitActive(false), 1500);
      prevIsHitRef.current = true;
      return () => clearTimeout(timer);
    }
    if (!isHit) prevIsHitRef.current = false;
  }, [isHit]);

  /* ── Shock hit: electric zap on defender when attacker has Lightning Reflex ── */
  const [isShockHitActive, setIsShockHitActive] = useState(false);
  const prevIsShockHitRef = useRef(false);

  useEffect(() => {
    if (isShockHit && !prevIsShockHitRef.current) {
      setIsShockHitActive(true);
      const timer = setTimeout(() => setIsShockHitActive(false), 1500);
      prevIsShockHitRef.current = true;
      return () => clearTimeout(timer);
    }
    if (!isShockHit) prevIsShockHitRef.current = false;
  }, [isShockHit]);

  /* ── Thunderbolt hit: massive lightning strike ── */
  const [isThunderboltActive, setIsThunderboltActive] = useState(false);
  const prevIsThunderboltRef = useRef(false);

  useEffect(() => {
    if (isThunderboltHit && !prevIsThunderboltRef.current) {
      setIsThunderboltActive(true);
      const timer = setTimeout(() => setIsThunderboltActive(false), 2000);
      prevIsThunderboltRef.current = true;
      return () => clearTimeout(timer);
    }
    if (!isThunderboltHit) prevIsThunderboltRef.current = false;
  }, [isThunderboltHit]);

  /* ── Delayed eliminate: wait for damage effects to finish before showing ── */
  const [showEliminated, setShowEliminated] = useState(isEliminated);

  useEffect(() => {
    if (!isEliminated) { setShowEliminated(false); return; }
    if (!battleEnded && (isHitActive || isShockHitActive || isThunderboltActive)) {
      setShowEliminated(false); // hide eliminated while damage effects play
    } else {
      setShowEliminated(true);  // show immediately when battle ended
    }
  }, [isEliminated, isHitActive, isShockHitActive, isThunderboltActive, battleEnded]);

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
    showEliminated && 'mchip--eliminated',
    isTargetable && !isEliminated && 'mchip--targetable',
    isSpotlight && 'mchip--spotlight',
    !showEliminated && isHitActive && 'mchip--hit',
    !showEliminated && isShockHitActive && 'mchip--shock-hit',
    !showEliminated && isThunderboltActive && 'mchip--thunderbolt',
    !showEliminated && isShocked && 'mchip--shocked',
    isPetalShielded && 'mchip--petal-shielded',
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={chipRef}
      className={chipClass}
      style={{ '--chip-primary': fighter.theme[0], '--chip-accent': fighter.theme[1] } as React.CSSProperties}
      onClick={isTargetable && !isEliminated && onSelect ? onSelect : undefined}
      role={isTargetable && !isEliminated ? 'button' : undefined}
    >
      {/* Falling petal/leaf particles — clipped by overflow:hidden wrapper */}
      {isPetalShielded && <div className="mchip__petal-fall" aria-hidden="true" />}

      {/* Falling white light motes — like sunlight through leaves */}
      {isPetalShielded && (
        <div className="mchip__dryad-lights" aria-hidden="true">
          {Array.from({ length: 15 }, (_, i) => (
            <span key={i} className="mchip__dryad-light" />
          ))}
        </div>
      )}

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
          <img className="mchip__bg" src={fighter.image} alt="" referrerPolicy="no-referrer" />
        ) : (
          <div className="mchip__bg mchip__bg--placeholder" style={{ background: fighter.theme[0], color: fighter.theme[9] }}>
            {fighter.nicknameEng.charAt(0)}
          </div>
        )}

        <div className="mchip__inner-border" />

        {/* Petal shield badge — Secret of Dryad status immunity */}
        {isPetalShielded && (
          <div className="mchip__petal-badge" aria-hidden="true">
            <PetalShield
              gradientId={`petal-grad-${fighter.characterId}`}
              color1={lightenColor(fighter.theme[0], 0.5)}
              color2="#d1ffd4ff"
            />
          </div>
        )}

        {/* Target crosshair badge — shown when selected as defend target */}
        {isDefender && !isEliminated && (
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

      {!battleEnded && (
        <>
          {/* Critical rate bar — outside frame */}
          <div className="mchip__critical">
            <div className={`mchip__crit-label${isCrit ? ' mchip__crit-label--active' : ''}`}>CRIT</div>
            <div className="mchip__crit-bar">
              <div className="mchip__crit-fill" style={{ height: `${Math.min(100, Math.max(0, fighter.criticalRate + (statMods?.criticalRate ?? 0)))}%` }} />
            </div>
          </div>

          {/* Turn order + active effect pips */}
          <div className="mchip__powerside">
            {turnOrder != null && (
              <div className="mchip__order">{turnOrder}</div>
            )}
            {effectPips && effectPips.length > 0 && (
              <div className="mchip__effected-powers">
                {effectPips.map((ep, idx) => (
                  <EffectPipDot key={idx} pip={ep} />
                ))}
              </div>
            )}
          </div>

          {/* Quota pips — below frame, inside chip */}
          {fighter.maxQuota > 0 && (
            <div className="mchip__quota">
              {Array.from({ length: fighter.maxQuota }, (_, i) => (
                <span key={i} className={`mchip__quota-pip${i < fighter.quota ? ' mchip__quota-pip--filled' : ''}`} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Hover stat popup — rendered via portal to escape stacking contexts */}
      {hovered && chipRef.current && createPortal(
        <PopupPanel
          fighter={fighter}
          deityLabel={deityLabel}
          chipRef={chipRef}
          onEnter={handleEnter}
          onLeave={handleLeave}
          statMods={statMods}
          battleEnded={battleEnded}
        />,
        document.body,
      )}
    </div>
  );
}
