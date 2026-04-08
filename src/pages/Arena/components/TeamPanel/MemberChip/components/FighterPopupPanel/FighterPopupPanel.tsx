import React, { useRef, useState, useEffect } from 'react';
import type { FighterState } from '../../../../../../../types/battle';
import SkillOrb from '../../icons/SkillOrb';
import LockOpen from '../../../../../../CharacterInfo/icons/LockOpen';
import LockClosed from '../../../../../../CharacterInfo/icons/LockClosed';
import { POWER_META } from '../../../../../../CharacterInfo/constants/powerMeta';
import { isSkillUnlocked } from '../../../../../../../constants/character';
import './FighterPopupPanel.scss';
import { POWER_TYPES } from '../../../../../../../constants/powers';
import { WISHES_ASSOCIATED_WITH_BATTLE } from '../../../../../../../data/wishes';
import { DEITY } from '../../../../../../../constants/deities';
import { DEITY_SVG } from '../../../../../../../data/deities';
import { DEITY_THEMES } from '../../../../../../../constants/theme';
import { hexToRgb } from '../../../../../../../utils/color';

const BP_COMPACT = 600;

export default function FighterPopupPanel({ fighter, deityLabel, chipRef, onEnter, onLeave, statMods, battleLive }: {
  fighter: FighterState;
  deityLabel: string;
  chipRef: React.RefObject<HTMLDivElement | null>;
  onEnter: () => void;
  onLeave: () => void;
  statMods?: Record<string, number>;
  battleLive?: boolean;
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
      left = rect.right + 5 - (!battleLive ? 20 : 0);
      // If overflows right, flip to left of chip
      if (left + pw > window.innerWidth - pad) left = rect.left - pw - 5;
    } else {
      top = rect.bottom - 25;
      left = rect.left + rect.width / 2 - pw / 2;
    }

    // Clamp to viewport
    top = Math.max(pad, Math.min(top, window.innerHeight - ph - pad));
    left = Math.max(pad, Math.min(left, window.innerWidth - pw - pad));

    if (pos?.top !== top || pos?.left !== left) {
      setPos({ top, left });
    }
  }, [rect, pos, battleLive, isCompact]);

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

      {fighter.wishOfIris && WISHES_ASSOCIATED_WITH_BATTLE.includes(fighter.wishOfIris) && (
        <div
          className="mchip__iris"
          style={{
            '--deity-primary': DEITY_THEMES[fighter.wishOfIris.toLowerCase()][0],
            '--deity-primary-rgb': hexToRgb(DEITY_THEMES[fighter.wishOfIris.toLowerCase()][0]),
            '--user-primary': fighter.theme[0],
          } as React.CSSProperties}
        >
          <span className="mchip__iris-icon">
            {DEITY_SVG[fighter.wishOfIris] || DEITY_SVG[DEITY.ZEUS]}
          </span>
          <span className="mchip__iris-deity">
            {fighter.wishOfIris}
          </span>
        </div>
      )}

      <div className="mchip__stats">
        {([
          ['HP', fighter.maxHp, statMods?.maxHp],
          ['DMG', fighter.damage, statMods?.damage],
          ['+ATK', fighter.attackDiceUp, statMods?.attackDiceUp],
          ['+DEF', fighter.defendDiceUp, statMods?.defendDiceUp],
          ['SPD', fighter.speed, statMods?.speed],
          ['REROLL', fighter.rerollsLeft, undefined],
        ] as [string, number, number | undefined][]).map(([label, base, mod]) => {
          const m = mod ?? 0;

          // Ares
          const hasAresBuff = label === 'DMG' && fighter.wishOfIris === DEITY.ARES;
          const aresPrimary = DEITY_THEMES[DEITY.ARES.toLowerCase()][0];

          // Artemis
          const hasArtemisBuff = label === 'SPD' && fighter.wishOfIris === DEITY.ARTEMIS;
          const artemisPrimary = DEITY_THEMES[DEITY.ARTEMIS.toLowerCase()][0];

          const statClassName = [
            'mchip__stat',
            m > 0 ? 'mchip__stat--buffed' : '',
            m < 0 ? 'mchip__stat--debuffed' : '',
            hasAresBuff ? 'mchip__stat--ares' : '',
            hasArtemisBuff ? 'mchip__stat--artemis' : '',
          ].join(' ');

          return (
            <div
              key={label}
              className={statClassName}
              style={
                hasAresBuff
                  ? { '--deity-primary': aresPrimary } as React.CSSProperties
                  : hasArtemisBuff
                    ? { '--deity-primary': artemisPrimary } as React.CSSProperties
                    : undefined
              }
            >
              <span className="mchip__stat-lbl">{label}</span>
              <span className="mchip__stat-val">
                <span className="mchip__stat-base">{base + m}</span>
                {m !== 0 && <span className="mchip__stat-mod">{m > 0 ? `+${m}` : m}</span>}
                {hasAresBuff && <span className="mchip__stat-mod" style={{ color: aresPrimary }}>+1 Ares</span>}
                {hasArtemisBuff && <span className="mchip__stat-mod" style={{ color: artemisPrimary }}>+3 Artemis</span>}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mchip__skills">
        {([
          [POWER_TYPES.PASSIVE, fighter.passiveSkillPoint],
          [POWER_TYPES.FIRST_SKILL, fighter.skillPoint],
          [POWER_TYPES.ULTIMATE, fighter.ultimateSkillPoint],
        ] as [string, string][]).map(([label, val]) => {
          const unlocked = isSkillUnlocked(val);
          return (
            <div key={label} className={`mchip__so ${unlocked ? '' : 'mchip__so--locked'}`}>
              <div className="mchip__so-orb">
                <SkillOrb className="mchip__so-svg" unlocked={unlocked} />
                {unlocked ? <LockOpen className="mchip__so-icon" /> : <LockClosed className="mchip__so-icon" />}
              </div>
              <span className="mchip__so-label">{label}</span>
            </div>
          );
        })}
      </div>

      <div className="mchip__powers">
        {([POWER_TYPES.PASSIVE, POWER_TYPES.FIRST_SKILL, POWER_TYPES.SECOND_SKILL, POWER_TYPES.ULTIMATE] as const).map((type) => {
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
