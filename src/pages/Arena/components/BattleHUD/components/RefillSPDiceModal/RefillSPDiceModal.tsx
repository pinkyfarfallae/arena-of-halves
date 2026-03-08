import React, { useState, useEffect } from 'react';
import DiceRoller from '../../../../../../components/DiceRoller/DiceRoller';
import type { FighterState } from '../../../../../../types/battle';
import type { PanelSide } from '../../../../../../constants/battle';
import './RefillSPDiceModal.scss';

/** Time to show dice result before switching to refill card (let dice + effects finish). */
export const REFILL_DICE_VIEW_MS = 2800;

/** Time refill card stays visible before advance (at least as long as damage card in resolve). */
export const REFILL_CARD_VIEW_MS = 2000;

export interface RefillSPDiceModalProps {
  attacker?: FighterState;
  isMyTurn: boolean;
  winFaces: number[];
  roll: number | null | undefined;
  atkSide: PanelSide;
  onRoll: (roll: number) => void | Promise<void>;
  /** Ms to show dice before showing refill card (default REFILL_DICE_VIEW_MS). */
  diceViewMs?: number;
}

/** Shadow Camouflaging: D4 roll for 25% refill SP (quota). Reuses same modal + DiceRoller pattern as DiceModal. */
export default function RefillSPDiceModal({
  attacker,
  isMyTurn,
  winFaces,
  roll,
  atkSide,
  onRoll,
  diceViewMs = REFILL_DICE_VIEW_MS,
}: RefillSPDiceModalProps) {
  const [showRefillCard, setShowRefillCard] = useState(false);

  // After roll is set, show dice for diceViewMs then switch to refill card (so dice + effects can finish)
  useEffect(() => {
    if (roll == null) {
      setShowRefillCard(false);
      return;
    }
    setShowRefillCard(false);
    const t = setTimeout(() => setShowRefillCard(true), diceViewMs);
    return () => clearTimeout(t);
  }, [roll, diceViewMs]);

  const themeStyle: React.CSSProperties = {
    '--modal-primary': attacker?.theme?.[0] ?? '#666',
    '--modal-dark': attacker?.theme?.[18] ?? '#333',
  } as React.CSSProperties;

  const themeColors = attacker
    ? { primary: attacker.theme?.[0] ?? '#666', primaryDark: attacker.theme?.[18] ?? '#333' }
    : undefined;

  // Refill card after diceViewMs
  if (roll != null && showRefillCard) {
    const won = winFaces.includes(roll);
    const cardStyle = { '--refill-atk': themeColors?.primary ?? '#666', '--refill-def': themeColors?.primaryDark ?? '#333' } as React.CSSProperties;
    return (
      <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
        <div className="refill-card refill-card--result" style={cardStyle}>
          <div className="refill-card__header">
            <span className="refill-card__atkname" style={{ color: themeColors?.primary }}>{attacker?.nicknameEng ?? '—'}</span>
          </div>
          {won ? (
            <span className="refill-card__total">+ 1 SP</span>
          ) : (
            <span className="refill-card__invoked">NO REFILL</span>
          )}
        </div>
      </div>
    );
  }

  // Same modal + same DiceRoller for my turn (never unmount: just switch to fixedResult when we have roll, like other dice flows)
  return (
    <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
      <div className="bhud__dice-modal" style={themeStyle}>
        <span className="bhud__dice-label">Refill SP Quota</span>
        <span className="bhud__dice-sub">{attacker?.nicknameEng} — D4 (25%)</span>
        {isMyTurn ? (
          <DiceRoller
            key="sc-refill-my-roll"
            className="bhud__dice-roller"
            lockedDie={4}
            fixedResult={roll ?? undefined}
            onRollResult={roll == null ? onRoll : undefined}
            themeColors={themeColors}
            hidePrompt
          />
        ) : roll != null ? (
          <DiceRoller
            key={`sc-refill-replay-${roll}`}
            className="bhud__dice-roller"
            lockedDie={4}
            fixedResult={roll}
            autoRoll
            hidePrompt
            themeColors={themeColors}
          />
        ) : (
          <div className="bhud__dice-roller bhud__dice-roller--waiting">
            <div className="bhud__roll-waiting-spinner" />
          </div>
        )}
        <span className="bhud__dice-bonus">refill: {[...winFaces].sort((a, b) => a - b).join(', ') || '—'}</span>
      </div>
    </div>
  );
}
