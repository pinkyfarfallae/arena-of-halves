import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { FighterState } from '../../../../../types/battle';
import { getQuotaCost } from '../../../../../types/power';
import { getAffordablePowers } from '../../../../../services/powerEngine';
import './ActionSelectModal.scss';

interface Props {
  attacker: FighterState;
  defenderName: string;
  isMyTurn: boolean;
  phase: string;
  themeColor?: string;
  themeColorDark?: string;
  side?: 'left' | 'right';
  onSelectAction: (action: 'attack' | 'power', powerIndex?: number) => void;
}

/** Hover tooltip via portal — below on compact, side on larger screens */
function PowerTooltip({ description, rect, themeStyle, side }: { description: string; rect: DOMRect; themeStyle: React.CSSProperties; side: 'left' | 'right' }) {
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    const tip = tipRef.current;
    if (!tip) return;
    const tipW = tip.offsetWidth;
    const compact = window.innerWidth <= 600;
    if (compact) {
      const top = Math.min(rect.bottom + 3, window.innerHeight - tip.offsetHeight - 25);
      const left = Math.max(8, Math.min(rect.left + rect.width / 2 - tipW / 2, window.innerWidth - tipW - 8));
      setPos({ top, left });
    } else {
      const preferLeft = side === 'right';
      const left = preferLeft ? rect.left - tipW - 8 : rect.right + 8;
      const top = Math.max(8, Math.min(rect.top, window.innerHeight - tip.offsetHeight - 8));
      setPos({ top, left });
    }
  }, [rect, side]);

  return createPortal(
    <div
      ref={tipRef}
      className="bhud__power-tooltip"
      style={{ ...themeStyle, top: pos.top, left: pos.left }}
    >
      {description}
    </div>,
    document.body,
  );
}

export default function ActionSelectModal({ attacker, defenderName, isMyTurn, phase, themeColor, themeColorDark, side = 'left', onSelectAction }: Props) {
  const [showPowerPicker, setShowPowerPicker] = useState(false);
  const [selectedPowerIdx, setSelectedPowerIdx] = useState<number | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);

  // Reset picker when phase changes
  useEffect(() => { setShowPowerPicker(false); setSelectedPowerIdx(null); }, [phase]);

  const themeStyle = { '--modal-primary': themeColor, '--modal-dark': themeColorDark } as React.CSSProperties;

  const handleMouseEnter = useCallback((realIdx: number, e: React.MouseEvent<HTMLButtonElement>) => {
    setHoveredIdx(realIdx);
    setHoveredRect(e.currentTarget.getBoundingClientRect());
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredIdx(null);
    setHoveredRect(null);
  }, []);

  // Find the hovered power's description
  const hoveredPower = hoveredIdx != null ? attacker.powers[hoveredIdx] : null;

  // Opponent is deciding
  if (!isMyTurn) {
    return (
      <div className="bhud__dice-modal" style={themeStyle}>
        <span className="bhud__dice-label">Choosing Action</span>
        <span className="bhud__dice-sub">{attacker.nicknameEng} is deciding...</span>
        <div className="bhud__dice-roller bhud__dice-roller--waiting">
          <div className="bhud__roll-waiting-spinner" />
        </div>
      </div>
    );
  }

  // My turn — choose action
  return (
    <div className="bhud__action-modal" style={themeStyle}>
      <span className="bhud__dice-label">Choose Action</span>
      <span className="bhud__dice-sub">{attacker.nicknameEng} → {defenderName}</span>

      {/* Quota pips */}
      <div className="bhud__quota">
        {Array.from({ length: attacker.maxQuota }, (_, i) => (
          <span key={i} className={`bhud__quota-pip ${i < attacker.quota ? 'bhud__quota-pip--filled' : ''}`} />
        ))}
        <span className="bhud__quota-label">{attacker.quota}/{attacker.maxQuota} SP</span>
      </div>

      {!showPowerPicker ? (
        <div className="bhud__action-btns">
          <button className="bhud__action-btn bhud__action-btn--attack" onClick={() => onSelectAction('attack')}>
            Attack
          </button>
          <button
            className="bhud__action-btn bhud__action-btn--power"
            disabled={getAffordablePowers(attacker).length === 0}
            onClick={() => setShowPowerPicker(true)}
          >
            Use Power
          </button>
        </div>
      ) : (
        <div className="bhud__power-picker">
          {attacker.powers.filter(p => p.type !== 'Passive').map((p, idx) => {
            const realIdx = attacker.powers.indexOf(p);
            const cost = getQuotaCost(p.type);
            const unlocked =
              (p.type === 'Ultimate' && attacker.ultimateSkillPoint === 'unlock') ||
              ((p.type === '1st Skill' || p.type === '2nd Skill') && attacker.skillPoint === 'unlock');
            const canAfford = attacker.quota >= cost;
            const usable = unlocked && canAfford;
            const selected = selectedPowerIdx === realIdx;
            return (
              <div key={idx} className="bhud__power-item">
                <button
                  className={`bhud__power-btn ${!usable ? 'bhud__power-btn--disabled' : ''} ${selected ? 'bhud__power-btn--selected' : ''}`}
                  disabled={!usable}
                  onClick={() => setSelectedPowerIdx(selected ? null : realIdx)}
                  onMouseEnter={(e) => handleMouseEnter(realIdx, e)}
                  onMouseLeave={handleMouseLeave}
                >
                  <span className="bhud__power-type">{p.type}</span>
                  <span className="bhud__power-name">{p.name}</span>
                  <span className="bhud__power-cost">{cost} SP</span>
                  {!unlocked && <span className="bhud__power-lock">Locked</span>}
                </button>
              </div>
            );
          })}
          <button className="bhud__power-back" onClick={() => { setShowPowerPicker(false); setSelectedPowerIdx(null); }}>
            Back
          </button>
          <button
            className="bhud__power-confirm"
            disabled={selectedPowerIdx == null}
            onClick={() => { if (selectedPowerIdx != null) { setShowPowerPicker(false); onSelectAction('power', selectedPowerIdx); } }}
          >
            Confirm
          </button>
        </div>
      )}

      {/* Hover tooltip via portal */}
      {hoveredPower?.description && hoveredRect && (
        <PowerTooltip description={hoveredPower.description} rect={hoveredRect} themeStyle={themeStyle} side={side} />
      )}
    </div>
  );
}
