import { useState, useRef, useEffect } from 'react';
import type { FighterState } from '../../../../../../types/battle';
import './TargetSelectModal.scss';

const RANDOM_CYCLE_MS = 150;
const RANDOM_MIN_ROUNDS = 2;
/** Minimum time the fast cycle runs (ms) before deceleration. */
const RANDOM_MIN_MS = 3000;
/** Deceleration: number of steps that slow down before stopping. */
const RANDOM_DECEL_STEPS = 5;
/** Delays (ms) for each deceleration step (last step = final stop). */
const RANDOM_DECEL_MS = [180, 280, 400, 550, 750];

interface Props {
  attackerName: string;
  targets: FighterState[];
  themeColor?: string;
  themeColorDark?: string;
  onSelect: (defenderId: string) => void;
  onBack?: () => void;
  /** When true, Back is hidden (e.g. Soul Devourer must pick target and cannot cancel). */
  backDisabled?: boolean;
  /** Optional subtitle (e.g. "Choose target" after poem verse selection). */
  subtitle?: string;
  /** When true, confirm button shows this label and click runs random cycle (2+ rounds) then selects. */
  randomMode?: boolean;
  /** Label for confirm button when randomMode (e.g. "Random"). */
  confirmLabel?: string;
  /** When set, show target list but no actions — display this as "Waiting for..." (e.g. for viewers/allies during Disoriented). */
  waitingForLabel?: string;
}

export default function TargetSelectModal({ attackerName, targets, themeColor, themeColorDark, onSelect, onBack, backDisabled, subtitle, randomMode, confirmLabel = 'Random', waitingForLabel }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cyclingIndex, setCyclingIndex] = useState<number>(0);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const stepCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const decelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (decelTimeoutRef.current) clearTimeout(decelTimeoutRef.current);
    };
  }, []);

  const n = targets.length;
  // When only one target in randomMode, pre-select it — user just clicks Confirm
  useEffect(() => {
    if (randomMode && n === 1 && targets[0]) {
      setSelectedId(targets[0].characterId);
    }
  }, [randomMode, n, targets[0]?.characterId]);

  const displayIndex = isRandomizing ? cyclingIndex : (selectedId ? targets.findIndex((t) => t.characterId === selectedId) : -1);
  const highlightId = displayIndex >= 0 && displayIndex < n ? targets[displayIndex].characterId : null;

  const handleRandomClick = () => {
    if (n === 0 || isRandomizing) return;
    setIsRandomizing(true);
    stepCountRef.current = 0;
    setCyclingIndex(0);

    const minSteps = Math.max(RANDOM_MIN_ROUNDS * n, Math.ceil(RANDOM_MIN_MS / RANDOM_CYCLE_MS));
    const extraSteps = Math.floor(Math.random() * n);
    const fastSteps = minSteps + extraSteps;
    const decelSteps = Math.min(RANDOM_DECEL_STEPS, RANDOM_DECEL_MS.length);

    const runDeceleration = (startCycleIndex: number) => {
      let step = 0;
      const scheduleNext = () => {
        if (step >= decelSteps) {
          const finalIdx = (startCycleIndex + decelSteps) % n;
          const chosenId = targets[finalIdx].characterId;
          setSelectedId(chosenId);
          setCyclingIndex(finalIdx);
          setIsRandomizing(false);
          decelTimeoutRef.current = null;
          return;
        }
        const delayMs = RANDOM_DECEL_MS[step] ?? 400;
        decelTimeoutRef.current = setTimeout(() => {
          setCyclingIndex((i) => (i + 1) % n);
          step += 1;
          scheduleNext();
        }, delayMs);
      };
      scheduleNext();
    };

    intervalRef.current = setInterval(() => {
      stepCountRef.current += 1;
      setCyclingIndex((i) => (i + 1) % n);
      if (stepCountRef.current >= fastSteps) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        const idxAfterFast = (stepCountRef.current - 1) % n;
        setCyclingIndex(idxAfterFast);
        runDeceleration(idxAfterFast);
      }
    }, RANDOM_CYCLE_MS);
  };

  return (
    <div
      className="bhud__targets-modal"
      style={{ '--modal-primary': themeColor, '--modal-dark': themeColorDark } as React.CSSProperties}
    >
      <span className="bhud__dice-label">{randomMode ? 'Disoriented' : 'Select Target'}</span>
      <span className="bhud__dice-sub">
        {waitingForLabel ? (subtitle ?? waitingForLabel) : (subtitle ?? (randomMode ? (selectedId ? 'Click Confirm to continue' : 'Click Random to pick target') : `${attackerName}'s turn`))}
      </span>
      <div className="bhud__targets-list">
        {targets.map((t) => (
          <button
            key={t.characterId}
            className={`bhud__target-btn${(randomMode && !waitingForLabel ? highlightId === t.characterId : selectedId === t.characterId) ? ' bhud__target-btn--selected' : ''}${waitingForLabel || randomMode ? ' bhud__target-btn--no-click' : ''}`}
            style={{ '--t-color': t.theme[0] } as React.CSSProperties}
            onClick={waitingForLabel || randomMode ? undefined : () => !isRandomizing && setSelectedId(t.characterId)}
            type="button"
            disabled={!!waitingForLabel}
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
      <div className="bhud__target-actions">
        {waitingForLabel ? (
          <p className="bhud__no-target-reason bhud__target-waiting">{waitingForLabel}</p>
        ) : (
          <>
            {onBack != null && !backDisabled && !isRandomizing && !(randomMode && selectedId) && (
              <button type="button" className="bhud__target-back" onClick={onBack}>
                Back
              </button>
            )}
            <button
              className="bhud__target-confirm"
              disabled={randomMode ? isRandomizing : !selectedId}
              onClick={
                randomMode
                  ? isRandomizing
                    ? undefined
                    : selectedId
                      ? () => onSelect(selectedId)
                      : handleRandomClick
                  : () => selectedId && onSelect(selectedId)
              }
            >
              {randomMode ? (isRandomizing ? confirmLabel : selectedId ? 'Confirm' : confirmLabel) : 'Confirm'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
