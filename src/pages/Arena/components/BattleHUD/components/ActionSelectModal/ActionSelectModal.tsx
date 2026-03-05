import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { FighterState } from '../../../../../../types/battle';
import { getQuotaCost } from '../../../../../../types/power';
import { getAffordablePowers } from '../../../../../../services/powerEngine';
import './ActionSelectModal.scss';

interface Props {
  attacker: FighterState;
  defenderName?: string;
  isMyTurn: boolean;
  phase: string;
  themeColor?: string;
  themeColorDark?: string;
  side?: 'left' | 'right';
  /** Power names that are conditionally disabled (e.g. Jolt Arc when no shocks) */
  disabledPowerNames?: Set<string>;
  /** Attacker's teammates including self (for ally-targeting powers) */
  teammates?: FighterState[];
  /** Character IDs of dead teammates (for Death Keeper targeting) */
  deadTeammateIds?: Set<string>;
  onSelectAction: (action: 'attack' | 'power', powerIndex?: number, allyTargetId?: string) => void;
  initialShowPowers?: boolean;
}

/** Format description with newlines and bullets */
function FormatDesc({ text }: { text: string }) {
  const lines = text.split(/\s*\\n\s*|\s*\/\s*|\n/).filter(Boolean);
  // Helper to bold all text inside double quotes
  const boldQuoted = (str: string) => {
    const parts = [];
    let lastIdx = 0;
    const regex = /"([^"]+)"/g;
    let match;
    let key = 0;
    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIdx) {
        parts.push(str.slice(lastIdx, match.index));
      }
      parts.push(<b key={key++}>{match[1]}</b>);
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < str.length) {
      parts.push(str.slice(lastIdx));
    }
    return parts;
  };
  return (
    <>
      {lines.map((line, i) => {
        const starMatch = line.match(/^\s*\*\s*(.*)/);
        const extractedLine = starMatch ? starMatch[1] : line;
        const colonIdx = extractedLine.indexOf(':');
        const content = colonIdx > 0 ? (
          <>
            <strong>{extractedLine.substring(0, colonIdx).trim()}: </strong>
            <span>{boldQuoted(extractedLine.substring(colonIdx + 1).trim())}</span>
          </>
        ) : (
          <span>{boldQuoted(extractedLine.trim())}</span>
        );
        return (
          <div key={i} style={{ marginLeft: starMatch ? '0.5rem' : 0, position: 'relative' }}>
            {starMatch && <span style={{ position: 'absolute', left: '-0.4rem' }}>•</span>}
            {content}
          </div>
        );
      })}
    </>
  );
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
      <FormatDesc text={description} />
    </div>,
    document.body,
  );
}

export default function ActionSelectModal({ attacker, defenderName, isMyTurn, phase, themeColor, themeColorDark, side = 'left', disabledPowerNames, teammates, deadTeammateIds, onSelectAction, initialShowPowers }: Props) {
  const [showPowerPicker, setShowPowerPicker] = useState(false);
  const [selectedPowerIdx, setSelectedPowerIdx] = useState<number | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);

  // Ally selection step
  const [allyStep, setAllyStep] = useState(false);
  const [allyPowerIdx, setAllyPowerIdx] = useState<number | null>(null);
  const [selectedAllyId, setSelectedAllyId] = useState<string | null>(null);

  // Reset all state when phase changes
  useEffect(() => {
    setShowPowerPicker(!!initialShowPowers);
    setSelectedPowerIdx(null);
    setAllyStep(false);
    setAllyPowerIdx(null);
    setSelectedAllyId(null);
  }, [phase, initialShowPowers]);

  const themeStyle = { '--modal-primary': themeColor, '--modal-dark': themeColorDark } as React.CSSProperties;

  const handleMouseEnter = useCallback((realIdx: number, e: React.MouseEvent<HTMLButtonElement>) => {
    setHoveredIdx(realIdx);
    setHoveredRect(e.currentTarget.getBoundingClientRect());
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredIdx(null);
    setHoveredRect(null);
  }, []);

  // When user confirms a power, check if it's ally-targeting
  const handlePowerConfirm = () => {
    if (selectedPowerIdx == null) return;
    const power = attacker.powers[selectedPowerIdx];
    if (power?.target === 'ally' && teammates && teammates.length > 0) {
      setAllyPowerIdx(selectedPowerIdx);
      setAllyStep(true);
      setShowPowerPicker(false);
      return;
    }
    setShowPowerPicker(false);
    onSelectAction('power', selectedPowerIdx);
  };

  const handleAllyConfirm = () => {
    if (allyPowerIdx != null && selectedAllyId) {
      onSelectAction('power', allyPowerIdx, selectedAllyId);
    }
  };

  const handleAllyBack = () => {
    setAllyStep(false);
    setSelectedAllyId(null);
    setShowPowerPicker(true);
  };

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

  // Ally selection step
  if (allyStep && allyPowerIdx != null) {
    const allyPower = attacker.powers[allyPowerIdx];
    const isDeathKeeper = allyPower?.name === 'Death Keeper';
    const allAlive = (teammates || []).filter(m => m.currentHp > 0);
    const allDead = (teammates || []).filter(m => m.currentHp <= 0);
    // Death Keeper: show dead teammates only
    // Pomegranate's Oath: self only if no other allies alive
    const isPomegranate = allyPower?.name === "Pomegranate's Oath";
    const othersAlive = allAlive.filter(m => m.characterId !== attacker.characterId);
    const aliveTeammates = isDeathKeeper ? allDead : (isPomegranate && othersAlive.length > 0 ? othersAlive : allAlive);
    return (
      <div className="bhud__action-modal" style={themeStyle}>
        <span className="bhud__dice-label">{allyPower?.name ?? 'Select Target'}</span>
        <span className="bhud__dice-sub">เลือกเป้าหมาย</span>
        <div className="bhud__ally-picker">
          {aliveTeammates.map(m => {
            const selected = selectedAllyId === m.characterId;
            const isSelf = m.characterId === attacker.characterId;
            return (
              <button
                key={m.characterId}
                className={`bhud__ally-btn ${selected ? 'bhud__ally-btn--selected' : ''}`}
                onClick={() => setSelectedAllyId(selected ? null : m.characterId)}
              >
                {m.image ? (
                  <img className="bhud__ally-avatar" src={m.image} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <div className="bhud__ally-avatar bhud__ally-avatar--placeholder" style={{ background: m.theme[0], color: m.theme[9] }}>
                    {m.nicknameEng.charAt(0)}
                  </div>
                )}
                <span className="bhud__ally-name">
                  {m.nicknameEng}
                  {isSelf && <span className="bhud__ally-self"> (self)</span>}
                </span>
                <span className="bhud__ally-hp">{m.currentHp}/{m.maxHp}</span>
              </button>
            );
          })}
        </div>
        <div className="bhud__power-actions">
          <button className="bhud__power-back" onClick={handleAllyBack}>
            Back
          </button>
          <button
            className="bhud__power-confirm"
            disabled={!selectedAllyId}
            onClick={handleAllyConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    );
  }

  // My turn — choose action
  return (
    <div className="bhud__action-modal" style={themeStyle}>
      <span className="bhud__dice-label">Choose Action</span>
      <span className="bhud__dice-sub">{attacker.nicknameEng}{defenderName ? ` → ${defenderName}` : "'s turn"}</span>

      {/* Quota pips */}
      <div className="bhud__quota">
        {(() => {
          const quota = typeof attacker.quota === 'number' && !isNaN(attacker.quota) ? attacker.quota : attacker.maxQuota;
          const maxQuota = typeof attacker.maxQuota === 'number' && !isNaN(attacker.maxQuota) ? attacker.maxQuota : 0;
          return (
            <>
              {Array.from({ length: maxQuota }, (_, i) => (
                <span key={i} className={`bhud__quota-pip ${i < quota ? 'bhud__quota-pip--filled' : ''}`} />
              ))}
              <span className="bhud__quota-label">{quota}/{maxQuota} SP</span>
            </>
          );
        })()}
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
        <>
          <div className="bhud__power-picker">
            {attacker.powers.filter(p => {
              if (p.type === 'Passive' && p.name === 'Death Keeper') return true;
              return p.type !== 'Passive';
            }).map((p, idx: number) => {
            const realIdx = attacker.powers.indexOf(p);
            const cost = getQuotaCost(p.type);
            const isDK = p.name === 'Death Keeper';
            const unlocked = isDK || (
              (p.type === 'Ultimate' && attacker.ultimateSkillPoint === 'unlock') ||
              ((p.type === '1st Skill' || p.type === '2nd Skill') && attacker.skillPoint === 'unlock')
            );
            const canAfford = isDK || attacker.quota >= cost;
            const usable = isDK
              ? (deadTeammateIds?.size ?? 0) > 0 && !disabledPowerNames?.has(p.name)
              : unlocked && canAfford && !disabledPowerNames?.has(p.name);
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
                  <span className="bhud__power-type">{isDK ? 'Passive' : p.type}</span>
                  <span className="bhud__power-name">{p.name}</span>
                  <span className="bhud__power-cost">{isDK ? 'FREE' : `${cost} SP`}</span>
                  {!unlocked && <span className="bhud__power-lock">Locked</span>}
                </button>
              </div>
            );
          })}
          </div>
          <div className="bhud__power-actions">
            <button className="bhud__power-back" onClick={() => { setShowPowerPicker(false); setSelectedPowerIdx(null); }}>
              Back
            </button>
            <button
              className="bhud__power-confirm"
              disabled={selectedPowerIdx == null}
              onClick={handlePowerConfirm}
            >
              Confirm
            </button>
          </div>
        </>
      )}

      {/* Hover tooltip via portal */}
      {hoveredPower?.description && hoveredRect && (
        <PowerTooltip description={hoveredPower.description} rect={hoveredRect} themeStyle={themeStyle} side={side} />
      )}
    </div>
  );
}
