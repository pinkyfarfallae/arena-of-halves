import React, { useRef, useState, useEffect } from 'react';
import type { FighterState } from '../../../../../../../types/battle';
import SkillOrb from '../../icons/SkillOrb';
import LockOpen from '../../../../../../CharacterInfo/icons/LockOpen';
import LockClosed from '../../../../../../CharacterInfo/icons/LockClosed';
import { POWER_META } from '../../../../../../CharacterInfo/constants/powerMeta';
import { isSkillUnlocked } from '../../../../../../../constants/character';
import './FighterPopupPanel.scss';

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
