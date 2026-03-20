import { useState, useRef, useEffect } from 'react';
import type { FighterState } from '../../../../../../types/battle';
import type { ActiveEffect } from '../../../../../../types/power';
import { isAffliction } from '../../../../../../data/statusCategory';
import { EFFECT_TAGS, IMPRECATED_POEM_VERSE_TAGS } from '../../../../../../constants/effectTags';
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
  /** When true (Eternal Agony selected), show "No afflictions" on targets that have no afflictions. */
  eternalAgonySelected?: boolean;
  /** Used with eternalAgonySelected to compute which targets have no afflictions. */
  activeEffects?: ActiveEffect[];
  /** When true (ally-heal target selection), show "Healing nullified" on targets that have that effect. */
  healTargetSelect?: boolean;
  /** Imprecated Poem verse tag — only used to show "Efflorescence Muse" on targets that actually have Muse (matches pips); we do not show the verse name as if it were already on the target. */
  afflictionVerseTag?: string | null;
}

export default function TargetSelectModal({ attackerName, targets, themeColor, themeColorDark, onSelect, onBack, backDisabled, subtitle, randomMode, confirmLabel = 'Random', waitingForLabel, eternalAgonySelected, activeEffects, healTargetSelect, afflictionVerseTag }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cyclingIndex, setCyclingIndex] = useState<number>(0);
  const [isRandomizing, setIsRandomizing] = useState(false);
  /** True after the Random spinner animation has finished (not used for single-target pre-select). */
  const [randomAnimationFinished, setRandomAnimationFinished] = useState(false);
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
  const targetIdsKey = targets.map((t) => t.characterId).join(',');

  useEffect(() => {
    if (!randomMode) return;
    setSelectedId(null);
    setRandomAnimationFinished(false);
    setIsRandomizing(false);
    setCyclingIndex(0);
  }, [randomMode, targetIdsKey]);

  // When only one target in randomMode, pre-select it — user just clicks Confirm (Back stays enabled)
  useEffect(() => {
    if (randomMode && n === 1 && targets[0]) {
      setSelectedId(targets[0].characterId);
      setRandomAnimationFinished(false);
    }
  }, [randomMode, n, targets[0]?.characterId]);

  const displayIndex = isRandomizing ? cyclingIndex : (selectedId ? targets.findIndex((t) => t.characterId === selectedId) : -1);
  const highlightId = displayIndex >= 0 && displayIndex < n ? targets[displayIndex].characterId : null;
  /** Dim non-chosen rows only after Disoriented random animation has finished (not while cycling, not in normal pick). */
  const dimFocusTargetId =
    randomMode && !waitingForLabel && randomAnimationFinished && selectedId != null ? selectedId : null;
  const dimUnselectedOthers = dimFocusTargetId != null;

  const handleRandomClick = () => {
    if (n === 0 || isRandomizing || selectedId != null) return;
    setRandomAnimationFinished(false);
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
          setRandomAnimationFinished(true);
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
        {targets.map((t) => {
          const targetEffs = (eternalAgonySelected && activeEffects) ? activeEffects.filter((e) => String(e.targetId) === String(t.characterId)) : [];
          const hasAffliction = targetEffs.some((e) => isAffliction(e) && (e.turnsRemaining ?? 0) > 0);
          const showNoAfflictionWarning = eternalAgonySelected && !hasAffliction;
          const hasHealingNullified = !!(healTargetSelect && activeEffects?.some((e) => String(e.targetId) === String(t.characterId) && e.tag === EFFECT_TAGS.HEALING_NULLIFIED));
          const poemAfflictionTarget =
            typeof afflictionVerseTag === 'string' &&
            (IMPRECATED_POEM_VERSE_TAGS as readonly string[]).includes(afflictionVerseTag);
          const showEfflorescenceMuseHint = !!(
            poemAfflictionTarget &&
            activeEffects?.some(
              (e) => String(e.targetId) === String(t.characterId) && e.tag === EFFECT_TAGS.EFFLORESCENCE_MUSE,
            )
          );
          const isSelectedRow = randomMode && !waitingForLabel ? highlightId === t.characterId : selectedId === t.characterId;
          return (
            <button
              key={t.characterId}
              className={`bhud__target-btn${isSelectedRow ? ' bhud__target-btn--selected' : ''}${dimUnselectedOthers && t.characterId !== dimFocusTargetId ? ' bhud__target-btn--dim-unselected' : ''}${waitingForLabel || randomMode ? ' bhud__target-btn--no-click' : ''}`}
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
                <span className="bhud__target-hp-line">
                  <span className="bhud__target-hp">{t.currentHp}/{t.maxHp}</span>
                  {showNoAfflictionWarning && (
                    <>
                      <span className="bhud__target-hp-divider" aria-hidden="true"> · </span>
                      <span className="bhud__target-no-affliction" title="Eternal Agony will not extend any duration on this target.">No afflictions</span>
                    </>
                  )}
                  {hasHealingNullified && (
                    <>
                      <span className="bhud__target-hp-divider" aria-hidden="true"> · </span>
                      <span className="bhud__target-healing-nullified" title="Healing will have no effect on this target.">Healing nullified</span>
                    </>
                  )}
                  {showEfflorescenceMuseHint && (
                    <>
                      <span className="bhud__target-hp-divider" aria-hidden="true"> · </span>
                      <span
                        className="bhud__target-efflorescence-muse"
                        title="Efflorescence Muse will block this affliction and be consumed."
                      >
                        Efflorescence Muse
                      </span>
                    </>
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="bhud__target-actions">
        {waitingForLabel ? (
          <p className="bhud__no-target-reason bhud__target-waiting">{waitingForLabel}</p>
        ) : (
          <>
            {onBack != null &&
              !backDisabled &&
              !isRandomizing &&
              !(randomMode && selectedId && randomAnimationFinished) && (
                <button type="button" className="bhud__target-back" onClick={onBack}>
                  Back
                </button>
              )}
            <button
              className="bhud__target-confirm"
              disabled={
                randomMode
                  ? isRandomizing || (!selectedId && n === 0)
                  : !selectedId
              }
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
