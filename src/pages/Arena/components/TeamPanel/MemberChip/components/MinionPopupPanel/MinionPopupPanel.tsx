import React, { useRef, useState, useEffect } from 'react';
import type { Minion } from '../../../../../../../types/minions';
import { POWER_META } from '../../../../../../CharacterInfo/constants/powerMeta';
import './MinionPopupPanel.scss';

const BP_COMPACT = 600;

export default function MinionPopupPanel({ minion, index, masterName, chipRef, onEnter, onLeave, description, statMods }: {
  minion: Minion;
  index: number;
  masterName?: string;
  chipRef: React.RefObject<HTMLDivElement | null>;
  onEnter: () => void;
  onLeave: () => void;
  description?: string;
  statMods?: Record<string, number>;
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
      top = rect.bottom + 5;
      left = rect.left + rect.width / 2 - pw / 2;
    }

    // Clamp to viewport
    top = Math.max(pad, Math.min(top, window.innerHeight - ph - pad));
    left = Math.max(pad, Math.min(left, window.innerWidth - pw - pad));

    setPos((p) => (p?.top !== top || p?.left !== left ? { top, left } : p));
  }, [rect, isCompact]);

  if (!rect) return null;

  const style: React.CSSProperties = {
    '--chip-primary': minion.theme[0],
    '--chip-accent': minion.theme[1],
    position: 'fixed',
    visibility: pos ? 'visible' : 'hidden',
    top: pos?.top ?? 0,
    left: pos?.left ?? 0,
  } as React.CSSProperties;

  const desc = description ?? minion.description;

  return (
    <div
      ref={popupRef}
      className="mchip__popup mchip__popup--visible"
      style={style}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className="mchip__popup-header">
        <span className="mchip__popup-name">{minion.nicknameEng ? `${minion.nicknameEng} ${index + 1}` : `Minion ${index + 1}`  }</span>
        <span className="mchip__popup-master">{masterName ?? ''}</span>
      </div>

      {/* If description provided (or minion has one), show it; otherwise render basic stat list (kept minimal) */}
      {desc ? (
        <div className="mchip__desc">{desc}</div>
      ) : (
        <div className="mchip__stats">
          {([
            ['HP', minion.maxHp, statMods?.maxHp],
            ['DMG', minion.damage, statMods?.damage],
            ['+ATK', minion.attackDiceUp, statMods?.attackDiceUp],
            ['+DEF', minion.defendDiceUp, statMods?.defendDiceUp],
            ['SPD', minion.speed, statMods?.speed],
            ['REROLL', minion.rerollsLeft, undefined],
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
      )}

      {/* Minimal powers display for non-skeleton minions */}
      {minion.powers?.length > 0 && (
        <div className="mchip__powers">
          {(['Passive', '1st Skill', '2nd Skill', 'Ultimate'] as const).map((type) => {
            const p = (minion.powers || []).find((pw) => pw.type === type);
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
      )}
    </div>
  );
}
