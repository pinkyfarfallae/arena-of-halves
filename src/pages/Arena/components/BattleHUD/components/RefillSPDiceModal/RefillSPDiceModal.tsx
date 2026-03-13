import React, { useState, useEffect, useRef, useCallback } from 'react';
import DiceRoller from '../../../../../../components/DiceRoller/DiceRoller';
import type { FighterState } from '../../../../../../types/battle';
import type { PanelSide } from '../../../../../../constants/battle';
import './RefillSPDiceModal.scss';

/** Fallback: show result card after this ms if onRollEnd was not received (e.g. replay already finished). */
export const REFILL_DICE_VIEW_MS = 3500;

/** Time refill card stays visible before advance (at least as long as damage card in resolve). */
export const REFILL_CARD_VIEW_MS = 2000;

/** Short view of dice result after animation ends before showing refill card. */
const REFILL_RESULT_VIEW_MS = 700;

export interface RefillSPDiceModalProps {
  attacker?: FighterState;
  isMyTurn: boolean;
  winFaces: number[];
  roll: number | null | undefined;
  atkSide: PanelSide;
  onRoll: (roll: number) => void | Promise<void>;
  /** Ms to show dice before showing refill card (fallback if onRollEnd not fired). */
  diceViewMs?: number;
  /** Override labels for non-refill D4 (e.g. Floral Heal crit). */
  title?: string;
  subTitle?: string;
  wonText?: string;
  lostText?: string;
  bonusLabel?: string;
  /** Called when the result card (Normal Heal / Heal x2) is shown (after dice animation ends). */
  onResultCardVisible?: () => void;
}

/** Shadow Camouflaging: D4 roll for 25% refill SP (quota). Also used for Floral Heal crit (Efflorescence Muse). */
export default function RefillSPDiceModal({
  attacker,
  isMyTurn,
  winFaces,
  roll,
  atkSide,
  onRoll,
  diceViewMs = REFILL_DICE_VIEW_MS,
  title,
  subTitle,
  wonText,
  lostText,
  bonusLabel,
  onResultCardVisible,
}: RefillSPDiceModalProps) {
  const effectiveTitle = title ?? 'Refill SP Quota';
  const effectiveSub = subTitle ?? (attacker ? `${attacker.nicknameEng} — D4 (25%)` : 'D4 (25%)');
  const effectiveWon = wonText ?? '+ 1 SP';
  const effectiveLost = lostText ?? 'NO REFILL';
  const effectiveBonus = bonusLabel ?? `refill: ${[...winFaces].sort((a, b) => a - b).join(', ') || '—'}`;
  const [showRefillCard, setShowRefillCard] = useState(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Once we've shown the result card for this roll, don't reset to dice view (avoids "dice again" when effect re-runs). */
  const resultCardShownForRollRef = useRef<number | null>(null);
  const rollRef = useRef<number | null | undefined>(undefined);
  rollRef.current = roll;

  const clearTimers = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
  }, []);

  // When dice animation ends, wait briefly then show result card and notify parent (healing VFX shows at same time)
  const handleRollEnd = useCallback(() => {
    clearTimers();
    resultTimerRef.current = setTimeout(() => {
      onResultCardVisible?.(); // notify first so parent state batches with result card
      setShowRefillCard(true);
      const r = rollRef.current;
      if (r != null) resultCardShownForRollRef.current = r;
    }, REFILL_RESULT_VIEW_MS);
  }, [clearTimers, onResultCardVisible]);

  // When roll is set: show dice only; start fallback timer. Transition to result card only after onRollEnd or fallback. Do not reset to dice once result card was shown.
  useEffect(() => {
    if (roll == null) {
      setShowRefillCard(false);
      resultCardShownForRollRef.current = null;
      clearTimers();
      return;
    }
    if (resultCardShownForRollRef.current === roll) return; // already showing result card for this roll — don't show dice again
    setShowRefillCard(false);
    clearTimers();
    fallbackTimerRef.current = setTimeout(() => {
      onResultCardVisible?.(); // notify first so healing VFX shows with result card
      setShowRefillCard(true);
      resultCardShownForRollRef.current = roll;
    }, diceViewMs);
    return () => clearTimers();
  }, [roll, diceViewMs, clearTimers, onResultCardVisible]);

  const themeStyle: React.CSSProperties = {
    '--modal-primary': attacker?.theme?.[0] ?? '#666',
    '--modal-dark': attacker?.theme?.[18] ?? '#333',
  } as React.CSSProperties;

  const themeColors = attacker
    ? { primary: attacker.theme?.[0] ?? '#666', primaryDark: attacker.theme?.[18] ?? '#333' }
    : undefined;

  // Refill result card (shown after dice animation ends + brief view, or fallback timer)
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
            <span className="refill-card__total">{effectiveWon}</span>
          ) : (
            <span className="refill-card__invoked">{effectiveLost}</span>
          )}
        </div>
      </div>
    );
  }

  // Same modal + same DiceRoller for my turn (never unmount: just switch to fixedResult when we have roll, like other dice flows)
  return (
    <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
      <div className="bhud__dice-modal" style={themeStyle}>
        <span className="bhud__dice-label">{effectiveTitle}</span>
        <span className="bhud__dice-sub">{effectiveSub}</span>
        {isMyTurn ? (
          <DiceRoller
            key="sc-refill-my-roll"
            className="bhud__dice-roller"
            lockedDie={4}
            fixedResult={roll ?? undefined}
            onRollResult={roll == null ? onRoll : undefined}
            onRollEnd={roll != null ? handleRollEnd : undefined}
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
            onRollEnd={handleRollEnd}
            hidePrompt
            themeColors={themeColors}
          />
        ) : (
          <div className="bhud__dice-roller bhud__dice-roller--waiting">
            <div className="bhud__roll-waiting-spinner" />
          </div>
        )}
        <span className="bhud__dice-bonus">{effectiveBonus}</span>
      </div>
    </div>
  );
}
