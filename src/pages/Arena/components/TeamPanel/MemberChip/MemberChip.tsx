import type { RefObject } from 'react';
import { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { FighterState } from '../../../../../types/battle';
import { Minion } from '../../../../../types/minions';
import { DEITY_POWERS, NO_STACK_POWER_NAMES } from '../../../../../data/powers';
import { lightenColor } from '../../../../../utils/color';
import PetalShield from './icons/PetalShield';
import Flower from './icons/Flower';
import WavyLines from './icons/WavyLines';
import ReaperScythe from './icons/ReaperScythe';
import TargetCrosshair from './icons/TargetCrosshair';

import { DEITY_DISPLAY_OVERRIDES } from '../../../../CharacterInfo/constants/overrides';
import { DEITY_SVG, toDeityKey } from '../../../../../data/deities';

import MinionPopupPanel from './components/MinionPopupPanel/MinionPopupPanel';
import FighterPopupPanel from './components/FighterPopupPanel/FighterPopupPanel';
import { EFFECT_TAGS } from '../../../../../constants/effectTags';

import './MemberChip.scss';

const PATTERN_ROWS = 23;
const ICONS_PER_ROW = 30;

// Spawn animation duration (ms) — keep in sync with SCSS animation
const MINION_SPAWN_MS = 1400;
// Despawn animation duration (ms) — matches dust (1000) + linger (750) + buffer
const MINION_DESPAWN_MS = 1900;

export interface EffectPip {
  powerName: string;
  /** Optional display name in tooltip (e.g. "Jolt Arc Deceleration" for Jolt Arc speed debuff) */
  displayName?: string;
  sourceName: string;
  /** Deity of the source (e.g. "Zeus") — used for DEITY_POWERS lookup; if missing, shocked check falls back to sourceName */
  sourceDeity?: string;
  sourceTheme: [string, string];
  turnsLeft: number;
  /** Number of stacked instances of this same power from the same source */
  count: number;
}

/** Hover tooltip for effect pips — positioned via portal above all stacking contexts */
function EffectPipTooltip({ pip, rect }: { pip: EffectPip; rect: DOMRect }) {
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const showStacks = pip.count > 1 && !NO_STACK_POWER_NAMES.has(pip.powerName);

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
      <span className="mchip__pip-tooltip-name">{pip.displayName ?? pip.powerName}</span>
      <span className="mchip__pip-tooltip-source">by {pip.sourceName}</span>
      <div className="mchip__pip-tooltip-meta">
        {showStacks && <span className="mchip__pip-tooltip-stacks">{pip.count} stacks</span>}
        <span className="mchip__pip-tooltip-turns">{pip.turnsLeft >= 99 ? 'conditional' : `${pip.turnsLeft} round${pip.turnsLeft > 1 ? 's' : ''}`}</span>
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
  isKeraunosVoltageHit?: boolean;
  isJoltArcAttackHit?: boolean;
  isShocked?: boolean;
  hasJoltArcDeceleration?: boolean;
  isPetalShielded?: boolean;
  hasPomegranateEffect?: boolean;
  isSpiritForm?: boolean;
  isShadowCamouflaged?: boolean;
  hasBeyondNimbus?: boolean;
  hasSoulDevourer?: boolean;
  hasDeathKeeper?: boolean;
  isResurrected?: boolean;
  isResurrecting?: boolean;
  isFragranceWaved?: boolean;
  turnOrder?: number;
  effectPips?: EffectPip[];
  /** Stat modifiers from active effects: { damage, attackDiceUp, defendDiceUp, speed, criticalRate } */
  statMods?: Record<string, number>;
  battleLive?: boolean;
  onSelect?: () => void;
  /** Minions associated with this fighter */
  minions?: Minion[];
  /** Visual defender ID — used to highlight which minion is the defender */
  visualDefenderId?: string;
  /** Pulse id for transient minion hits — when this changes, play a hit flash */
  minionHitPulseId?: number | undefined;
  /** Unique key for a master-hit playback step — when this changes, play one hit flash */
  hitEventKey?: string;
  /** When this key changes (e.g. demo replay), restart shock-hit effect. */
  shockHitEventKey?: string;
  /** Current playback-step target id/event for minion-frame hits */
  playbackHitTargetId?: string;
  playbackHitEventKey?: string;
  /** Map of characterId -> pulse id so minion frames can show hit when they are the target */
  minionPulseMap?: Record<string, number>;
  /** Whether transient-driven hits (minion pulses) are permitted right now */
  allowTransientHits?: boolean;
  /** Optional unique key derived from a recent log entry so Floral Fragrance
   *  from persistent logs is only shown once per client. If provided, the
   *  chip will consult localStorage to avoid re-showing the fragrance after a
   *  refresh. */
  floralLogKey?: string | undefined;
  /** Soul Devourer lifesteal: show +{n} HP in frame (inline, once per key). */
  soulDevourerHealAmount?: number;
  soulDevourerHealKey?: string;
  /** Ref for Arena soul float to target this chip's frame center (caster only). */
  casterFrameRef?: RefObject<HTMLDivElement | null>;
  /** Ref for Arena soul float to start from this chip's frame center (defender only). */
  defenderFrameRef?: RefObject<HTMLDivElement | null>;
}

export default function MemberChip({ fighter, isAttacker, isDefender, isEliminated, isTargetable, isSpotlight, isCrit, isHit, isShockHit, isKeraunosVoltageHit, isJoltArcAttackHit, isShocked, hasJoltArcDeceleration, isPetalShielded, hasPomegranateEffect, isSpiritForm, isShadowCamouflaged, hasBeyondNimbus, hasSoulDevourer, hasDeathKeeper, isResurrected, isResurrecting, isFragranceWaved, turnOrder, effectPips, statMods, battleLive, onSelect, minions, visualDefenderId, minionHitPulseId, hitEventKey, shockHitEventKey, playbackHitTargetId, playbackHitEventKey, minionPulseMap, allowTransientHits = true, floralLogKey, soulDevourerHealAmount = 0, soulDevourerHealKey, casterFrameRef, defenderFrameRef }: Props) {
  const chipRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [frameLayout, setFrameLayout] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const frameLayoutLatchedRef = useRef(false);

  const measureFrame = useCallback(() => {
    const chip = chipRef.current;
    const frame = frameRef.current;
    if (!chip || !frame) return;
    if (frameLayoutLatchedRef.current) return;
    const cr = chip.getBoundingClientRect();
    const fr = frame.getBoundingClientRect();
    const next = { top: fr.top - cr.top, left: fr.left - cr.left, width: fr.width };
    if (next.width <= 0) return;
    frameLayoutLatchedRef.current = true;
    setFrameLayout(next);
  }, []);

  const setFrameRef = useCallback((el: HTMLDivElement | null) => {
    frameRef.current = el;
    const ext = casterFrameRef ?? defenderFrameRef;
    if (ext) (ext as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (el) requestAnimationFrame(measureFrame);
    else {
      frameLayoutLatchedRef.current = false;
      setFrameLayout({ top: 0, left: 0, width: 0 });
    }
  }, [casterFrameRef, defenderFrameRef, measureFrame]);

  useEffect(() => {
    const chip = chipRef.current;
    if (!chip) return;
    const ro = new ResizeObserver(measureFrame);
    ro.observe(chip);
    return () => ro.disconnect();
  }, [measureFrame]);

  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [hovered, setHovered] = useState(false);
  const minionHoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const minionChipRef = useRef<HTMLDivElement | null>(null);
  const [hoveredMinion, setHoveredMinion] = useState<Minion | null>(null);
  // State tick to re-render when spawning timers expire
  const [now, setNow] = useState<number>(Date.now());
  // Keep recently-removed minions so we can play a despawn animation
  const [exitingMinions, setExitingMinions] = useState<Minion[]>([]);
  const prevMinionsRef = useRef<Minion[] | null>(null);
  // ids of exiting minions that should show a brief hit effect
  const [exitingHitMap, setExitingHitMap] = useState<Record<string, boolean>>({});
  const lastRenderedRef = useRef<Minion[]>([]);

  /* ── Hit flash: vibrate + red overlay (driven by isHit prop) ── */
  const [isHitActive, setIsHitActive] = useState(false);
  const prevIsHitRef = useRef(false);
  const isHitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isHit && !prevIsHitRef.current) {
      setIsHitActive(true);
      if (isHitTimerRef.current) clearTimeout(isHitTimerRef.current);
      isHitTimerRef.current = setTimeout(() => {
        isHitTimerRef.current = null;
        setIsHitActive(false);
      }, 1500);
      prevIsHitRef.current = true;
      return () => {
        if (isHitTimerRef.current) clearTimeout(isHitTimerRef.current);
        isHitTimerRef.current = null;
      };
    }
    if (!isHit) {
      prevIsHitRef.current = false;
      if (isHitTimerRef.current) clearTimeout(isHitTimerRef.current);
      isHitTimerRef.current = null;
      setIsHitActive(false);
    }
  }, [isHit]);

  const prevHitEventKeyRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!allowTransientHits) {
      if (isHitTimerRef.current) clearTimeout(isHitTimerRef.current);
      isHitTimerRef.current = null;
      setIsHitActive(false);
      return;
    }
    if (!hitEventKey) return;
    if (hitEventKey === prevHitEventKeyRef.current) return;
    prevHitEventKeyRef.current = hitEventKey;
    if (isHitTimerRef.current) clearTimeout(isHitTimerRef.current);
    isHitTimerRef.current = null;
    setIsHitActive(false);
    // Restart hit animation after brief delay so DOM loses class and replays (demo Replay / transient hits)
    const restart = setTimeout(() => {
      setIsHitActive(true);
      isHitTimerRef.current = setTimeout(() => {
        isHitTimerRef.current = null;
        setIsHitActive(false);
      }, 1500);
    }, 50);
    return () => clearTimeout(restart);
  }, [hitEventKey, allowTransientHits]);

  // Trigger hit flash when a transient minion hit pulse occurs (even if
  // `isHit` hasn't toggled). This ensures the defender frame shakes when a
  // skeleton/minion DamageCard plays. Reset to false, then after a short
  // delay set true so the DOM loses the class and the animation restarts (n pulses → n shakes).
  const prevPulseRef = useRef<number | undefined>(undefined);
  const hitPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hitPulseRestartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!allowTransientHits) {
      if (hitPulseRestartRef.current) clearTimeout(hitPulseRestartRef.current);
      hitPulseRestartRef.current = null;
      if (hitPulseTimerRef.current) clearTimeout(hitPulseTimerRef.current);
      hitPulseTimerRef.current = null;
      setIsHitActive(false);
      return;
    }
    if (minionHitPulseId == null) return;
    if (minionHitPulseId !== prevPulseRef.current) {
      prevPulseRef.current = minionHitPulseId;
      if (hitPulseTimerRef.current) clearTimeout(hitPulseTimerRef.current);
      hitPulseTimerRef.current = null;
      if (hitPulseRestartRef.current) clearTimeout(hitPulseRestartRef.current);
      hitPulseRestartRef.current = null;
      setIsHitActive(false);
      // Use setTimeout so "false" is committed and painted before we add "true" again (restarts animation)
      hitPulseRestartRef.current = setTimeout(() => {
        hitPulseRestartRef.current = null;
        setIsHitActive(true);
        hitPulseTimerRef.current = setTimeout(() => {
          hitPulseTimerRef.current = null;
          setIsHitActive(false);
        }, 1500);
      }, 50);
      return () => {
        if (hitPulseRestartRef.current) clearTimeout(hitPulseRestartRef.current);
        hitPulseRestartRef.current = null;
        if (hitPulseTimerRef.current) clearTimeout(hitPulseTimerRef.current);
        hitPulseTimerRef.current = null;
      };
    }
  }, [minionHitPulseId, allowTransientHits]);

  // When a minion is the hit target (minionPulseMap[minion.characterId] set), show hit effect on that minion frame.
  // Reset to false, then after 50ms set true so the animation restarts (n pulses → n shakes).
  const [minionHitActiveById, setMinionHitActiveById] = useState<Record<string, boolean>>({});
  const lastMinionPulseRef = useRef<Record<string, number>>({});
  const minionHitTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const minionHitRestartRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => {
    if (!minionPulseMap || !allowTransientHits) return;
    for (const [cid, pulseId] of Object.entries(minionPulseMap)) {
      if (pulseId == null) continue;
      if (pulseId !== lastMinionPulseRef.current[cid]) {
        if (minionHitTimersRef.current[cid]) clearTimeout(minionHitTimersRef.current[cid]);
        if (minionHitRestartRef.current[cid]) clearTimeout(minionHitRestartRef.current[cid]);
        delete minionHitTimersRef.current[cid];
        delete minionHitRestartRef.current[cid];
        lastMinionPulseRef.current[cid] = pulseId;
        setMinionHitActiveById((prev) => ({ ...prev, [cid]: false }));
        minionHitRestartRef.current[cid] = setTimeout(() => {
          delete minionHitRestartRef.current[cid];
          setMinionHitActiveById((prev) => ({ ...prev, [cid]: true }));
          const t = setTimeout(() => {
            delete minionHitTimersRef.current[cid];
            setMinionHitActiveById((prev) => ({ ...prev, [cid]: false }));
          }, 800);
          minionHitTimersRef.current[cid] = t;
        }, 50);
      }
    }
    return () => {
      Object.values(minionHitTimersRef.current).forEach((t) => clearTimeout(t));
      Object.values(minionHitRestartRef.current).forEach((t) => clearTimeout(t));
      minionHitTimersRef.current = {};
      minionHitRestartRef.current = {};
    };
  }, [minionPulseMap, allowTransientHits]);

  const [playbackMinionHitActiveById, setPlaybackMinionHitActiveById] = useState<Record<string, boolean>>({});
  const lastPlaybackMinionHitEventRef = useRef<string | undefined>(undefined);
  const playbackMinionHitTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const playbackMinionHitRestartRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => {
    if (!allowTransientHits) {
      Object.values(playbackMinionHitTimerRef.current).forEach((t) => clearTimeout(t));
      Object.values(playbackMinionHitRestartRef.current).forEach((t) => clearTimeout(t));
      playbackMinionHitTimerRef.current = {};
      playbackMinionHitRestartRef.current = {};
      setPlaybackMinionHitActiveById({});
      return;
    }
    if (!playbackHitEventKey || !playbackHitTargetId) return;
    if (lastPlaybackMinionHitEventRef.current === playbackHitEventKey) return;
    const isOwnedMinion = !!(minions || []).some((minion) => minion.characterId === playbackHitTargetId);
    if (!isOwnedMinion) return;
    lastPlaybackMinionHitEventRef.current = playbackHitEventKey;
    if (playbackMinionHitTimerRef.current[playbackHitTargetId]) clearTimeout(playbackMinionHitTimerRef.current[playbackHitTargetId]);
    if (playbackMinionHitRestartRef.current[playbackHitTargetId]) clearTimeout(playbackMinionHitRestartRef.current[playbackHitTargetId]);
    delete playbackMinionHitTimerRef.current[playbackHitTargetId];
    delete playbackMinionHitRestartRef.current[playbackHitTargetId];
    setPlaybackMinionHitActiveById((prev) => ({ ...prev, [playbackHitTargetId]: false }));
    playbackMinionHitRestartRef.current[playbackHitTargetId] = setTimeout(() => {
      delete playbackMinionHitRestartRef.current[playbackHitTargetId];
      setPlaybackMinionHitActiveById((prev) => ({ ...prev, [playbackHitTargetId]: true }));
      playbackMinionHitTimerRef.current[playbackHitTargetId] = setTimeout(() => {
        delete playbackMinionHitTimerRef.current[playbackHitTargetId];
        setPlaybackMinionHitActiveById((prev) => ({ ...prev, [playbackHitTargetId]: false }));
      }, 800);
    }, 50);
    return () => {
      if (playbackMinionHitRestartRef.current[playbackHitTargetId]) clearTimeout(playbackMinionHitRestartRef.current[playbackHitTargetId]);
      if (playbackMinionHitTimerRef.current[playbackHitTargetId]) clearTimeout(playbackMinionHitTimerRef.current[playbackHitTargetId]);
      delete playbackMinionHitRestartRef.current[playbackHitTargetId];
      delete playbackMinionHitTimerRef.current[playbackHitTargetId];
    };
  }, [allowTransientHits, minions, playbackHitEventKey, playbackHitTargetId]);

  /* ── Shock hit: electric zap on defender when attacker has Lightning Reflex ── */
  const [isShockHitActive, setIsShockHitActive] = useState(false);
  const [shockBridgeActive, setShockBridgeActive] = useState(false);
  const prevIsShockHitRef = useRef(false);
  const shockBridgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SHOCK_BRIDGE_MS = 5200;

  useEffect(() => {
    if (isShockHit && !prevIsShockHitRef.current) {
      setIsShockHitActive(true);
      const timer = setTimeout(() => setIsShockHitActive(false), 1500);
      prevIsShockHitRef.current = true;
      return () => clearTimeout(timer);
    }
    if (!isShockHit) prevIsShockHitRef.current = false;
  }, [isShockHit]);

  // When shockHitEventKey changes (e.g. demo "Play Shock Hit"), restart shock-hit effect
  const prevShockHitEventKeyRef = useRef<string | undefined>(undefined);
  const shockHitEventKeyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!shockHitEventKey) return;
    if (shockHitEventKey === prevShockHitEventKeyRef.current) return;
    prevShockHitEventKeyRef.current = shockHitEventKey;
    setIsShockHitActive(false);
    const restart = setTimeout(() => {
      setIsShockHitActive(true);
      if (shockHitEventKeyTimerRef.current) clearTimeout(shockHitEventKeyTimerRef.current);
      shockHitEventKeyTimerRef.current = setTimeout(() => {
        shockHitEventKeyTimerRef.current = null;
        setIsShockHitActive(false);
      }, 1500);
    }, 50);
    return () => {
      clearTimeout(restart);
      if (shockHitEventKeyTimerRef.current) {
        clearTimeout(shockHitEventKeyTimerRef.current);
        shockHitEventKeyTimerRef.current = null;
      }
    };
  }, [shockHitEventKey]);

  useEffect(() => {
    if (isShocked) {
      if (shockBridgeTimerRef.current) clearTimeout(shockBridgeTimerRef.current);
      shockBridgeTimerRef.current = null;
      setShockBridgeActive(false);
      return;
    }
    if (!isShockHit) return;
    setShockBridgeActive(true);
    if (shockBridgeTimerRef.current) clearTimeout(shockBridgeTimerRef.current);
    shockBridgeTimerRef.current = setTimeout(() => {
      shockBridgeTimerRef.current = null;
      setShockBridgeActive(false);
    }, SHOCK_BRIDGE_MS);
    return () => {
      if (shockBridgeTimerRef.current) clearTimeout(shockBridgeTimerRef.current);
      shockBridgeTimerRef.current = null;
    };
  }, [isShockHit, isShocked]);

  /* ── Jolt Arc attack hit: blue/white arc on targets when Jolt Arc confirms ── */
  const [isJoltArcAttackActive, setIsJoltArcAttackActive] = useState(false);
  const prevIsJoltArcAttackRef = useRef(false);

  useEffect(() => {
    if (isJoltArcAttackHit && !prevIsJoltArcAttackRef.current) {
      setIsJoltArcAttackActive(true);
      const timer = setTimeout(() => setIsJoltArcAttackActive(false), 2000);
      prevIsJoltArcAttackRef.current = true;
      return () => clearTimeout(timer);
    }
    if (!isJoltArcAttackHit) prevIsJoltArcAttackRef.current = false;
  }, [isJoltArcAttackHit]);

  /* ── Fragrance wave + heal boost: brief 3s effect when Floral Fragrance applied ── */
  const [showFragranceWave, setShowFragranceWave] = useState(false);
  const prevFragranceRef = useRef(false);
  const fragranceSuppressRef = useRef(false);
  const fragranceSuppressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fragranceWaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isFragranceWaved) {
      prevFragranceRef.current = false;
      if (fragranceWaveTimerRef.current) {
        clearTimeout(fragranceWaveTimerRef.current);
        fragranceWaveTimerRef.current = null;
      }
      setShowFragranceWave(false);
      return;
    }
    if (prevFragranceRef.current) return;

    // If this fragrance originates from a persistent log entry, check localStorage
    // so we only show it once per client (prevents showing again after reload).
    if (floralLogKey) {
      try {
        const seen = window.localStorage.getItem(floralLogKey);
        if (seen) {
          // Already shown before for this log — do not re-trigger.
          prevFragranceRef.current = true;
          return;
        }
      } catch (e) { }
    }

    if (!fragranceSuppressRef.current) {
      setShowFragranceWave(true);
      fragranceWaveTimerRef.current = setTimeout(() => {
        setShowFragranceWave(false);
        fragranceWaveTimerRef.current = null;
      }, 3000);
      prevFragranceRef.current = true;
      // Mark as shown if we were triggered by a persistent log
      if (floralLogKey) {
        try { window.localStorage.setItem(floralLogKey, '1'); } catch (e) { }
      }
      // Do not return a cleanup that clears the timer here: React Strict Mode runs
      // effect → cleanup → effect. That cleanup would clear the 3s timer before it
      // fires, so the wave would never auto-hide after replay. Timer is cleared
      // when isFragranceWaved becomes false and on unmount (empty-deps effect).
    }
    // Dependencies normalized to stable primitives to avoid array size changing between renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(isFragranceWaved), floralLogKey ?? '']);

  // Derive visible state: hide as soon as prop is false (no waiting for useEffect / state update)
  const showFragranceVisual = showFragranceWave && isFragranceWaved;

  // If the fighter's HP increases (heal applied), clear the fragrance wave visual
  // immediately to avoid leaving the +HP text/styling stuck after the heal.
  const prevHpRef = useRef<number>(fighter.currentHp);
  const [displayHp, setDisplayHp] = useState(fighter.currentHp);
  useEffect(() => {
    const prev = prevHpRef.current;
    if (fighter.currentHp > prev) {
      // HP increased — immediately clear fragrance state and class.
      setShowFragranceWave(false);
      prevFragranceRef.current = false;
      fragranceSuppressRef.current = true;
      if (fragranceSuppressTimer.current) clearTimeout(fragranceSuppressTimer.current);
      fragranceSuppressTimer.current = setTimeout(() => {
        fragranceSuppressRef.current = false;
        fragranceSuppressTimer.current = null;
      }, 800);
    }
    prevHpRef.current = fighter.currentHp;
    return undefined;
  }, [fighter.currentHp]);

  useEffect(() => {
    if (fighter.currentHp >= displayHp) {
      setDisplayHp(fighter.currentHp);
      return;
    }
    const shouldDelayHpDrop = !!hitPulseRestartRef.current || !!hitPulseTimerRef.current;
    if (!shouldDelayHpDrop) {
      setDisplayHp(fighter.currentHp);
      return;
    }
    const HP_DROP_DELAY_MS = 800;
    const t = setTimeout(() => setDisplayHp(fighter.currentHp), HP_DROP_DELAY_MS);
    return () => clearTimeout(t);
  }, [fighter.currentHp, displayHp]);

  useEffect(() => {
    return () => {
      if (fragranceSuppressTimer.current) clearTimeout(fragranceSuppressTimer.current);
      if (fragranceWaveTimerRef.current) clearTimeout(fragranceWaveTimerRef.current);
    };
  }, []);

  /* ── Soul Devourer lifesteal: same style as Floral Fragrance (wave + border + accents + heal text), black/purple; show 3s when key+amount appear ── */
  const [showSoulDevourerHeal, setShowSoulDevourerHeal] = useState(false);
  const [soulDevourerHealDisplayAmount, setSoulDevourerHealDisplayAmount] = useState(0);
  const prevSoulDevourerHealKeyRef = useRef<string | null>(null);
  const soulDevourerHealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!soulDevourerHealKey || soulDevourerHealAmount <= 0) {
      if (soulDevourerHealTimerRef.current) {
        clearTimeout(soulDevourerHealTimerRef.current);
        soulDevourerHealTimerRef.current = null;
      }
      setShowSoulDevourerHeal(false);
      setSoulDevourerHealDisplayAmount(0);
      return;
    }
    if (prevSoulDevourerHealKeyRef.current === soulDevourerHealKey) return;
    prevSoulDevourerHealKeyRef.current = soulDevourerHealKey;
    if (soulDevourerHealTimerRef.current) clearTimeout(soulDevourerHealTimerRef.current);
    setSoulDevourerHealDisplayAmount(soulDevourerHealAmount);
    setShowSoulDevourerHeal(true);
    soulDevourerHealTimerRef.current = setTimeout(() => {
      soulDevourerHealTimerRef.current = null;
      setShowSoulDevourerHeal(false);
      setSoulDevourerHealDisplayAmount(0);
    }, 3000);
  }, [soulDevourerHealKey, soulDevourerHealAmount]);
  useEffect(() => {
    return () => {
      if (soulDevourerHealTimerRef.current) clearTimeout(soulDevourerHealTimerRef.current);
    };
  }, []);

  /* ── Resurrecting: mist + falling lights for 2.5s, then purple glow flash on frame ── */
  const [showResurrecting, setShowResurrecting] = useState(false);
  const [showResFlash] = useState(false);
  const [showResGlow, setShowResGlow] = useState(false);
  const prevResurrecting = useRef(false);
  useEffect(() => {
    if (isResurrecting && !prevResurrecting.current) {
      prevResurrecting.current = true;
      setShowResurrecting(true);
      const timer = setTimeout(() => {
        setShowResurrecting(false);
        setShowResGlow(true);
        setTimeout(() => setShowResGlow(false), 800);
      }, 2500);
      return () => clearTimeout(timer);
    }
    if (!isResurrecting) prevResurrecting.current = false;
  }, [isResurrecting]);

  /* ── Delayed eliminate: wait for damage effects to finish before showing ── */
  const [showEliminated, setShowEliminated] = useState(isEliminated);

  useEffect(() => {
    if (!isEliminated) { setShowEliminated(false); return; }
    if (battleLive && (isHitActive || isShockHitActive || isKeraunosVoltageHit)) {
      setShowEliminated(false); // hide eliminated while damage effects play
    } else {
      setShowEliminated(true);  // show immediately when battle ended
    }
  }, [isEliminated, isHitActive, isShockHitActive, isKeraunosVoltageHit, battleLive]);

  const handleEnter = useCallback(() => {
    clearTimeout(hoverTimer.current);
    setHovered(true);
  }, []);

  const handleLeave = useCallback(() => {
    hoverTimer.current = setTimeout(() => setHovered(false), 100);
  }, []);

  const handleMinionEnter = useCallback((m: Minion, e: React.MouseEvent<HTMLDivElement>) => {
    clearTimeout(minionHoverTimer.current);
    // Prevent fighter hover from immediately hiding while interacting with minion
    clearTimeout(hoverTimer.current);
    minionChipRef.current = e.currentTarget as HTMLDivElement;
    setHoveredMinion(m);
  }, []);

  const handleMinionLeave = useCallback(() => {
    minionHoverTimer.current = setTimeout(() => {
      minionChipRef.current = null;
      setHoveredMinion(null);
    }, 100);
  }, []);

  // Refresh local time to clear spawn classes when they expire.
  useEffect(() => {
    if (!minions || minions.length === 0) return;
    const nowLocal = Date.now();
    let nextExpiry: number | null = null;
    for (const m of minions) {
      if (!m.createdAt) continue;
      const expiry = m.createdAt + MINION_SPAWN_MS;
      if (expiry > nowLocal && (nextExpiry === null || expiry < nextExpiry)) nextExpiry = expiry;
    }
    if (nextExpiry === null) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, nextExpiry - nowLocal) + 10);
    return () => clearTimeout(timer);
  }, [minions, now]);

  // Detect removed minions and keep them around briefly for exit animation
  useEffect(() => {
    const prev = prevMinionsRef.current ?? [];
    prevMinionsRef.current = minions ? [...minions] : [];
    if (!prev || prev.length === 0) return;
    const currIds = new Set((minions || []).map((m) => m.characterId));
    const removed = prev.filter((p) => !currIds.has(p.characterId));
    if (removed.length === 0) return;
    // add to exiting list
    setExitingMinions((existing) => [...existing, ...removed]);
    // trigger brief hit effect on removed minions (like a target hit)
    setExitingHitMap((m) => {
      const copy = { ...m };
      for (const r of removed) copy[r.characterId] = true;
      return copy;
    });
    // clear hit flags after a short moment so only the hit flash shows
    const hitClear = setTimeout(() => {
      setExitingHitMap((m) => {
        const copy = { ...m };
        for (const r of removed) delete copy[r.characterId];
        return copy;
      });
    }, 420);
    // schedule removal after despawn animation completes so mist can finish
    const t = setTimeout(() => {
      setExitingMinions((existing) => existing.filter((e) => !removed.find((r) => r.characterId === e.characterId)));
    }, MINION_DESPAWN_MS + 80);
    return () => {
      clearTimeout(t);
      clearTimeout(hitClear);
    };
  }, [minions]);

  const hpPct = Math.min((displayHp / fighter.maxHp) * 100, 100);
  const deityLabel = DEITY_DISPLAY_OVERRIDES[fighter.characterId] || fighter.deityBlood;
  const deityKey = toDeityKey(deityLabel);
  const deityIcon = deityKey ? DEITY_SVG[deityKey] : undefined;

  const chipClass = [
    'mchip',
    hovered && 'mchip--hovered',
    isAttacker && 'mchip--attacker',
    isDefender && 'mchip--defender',
    showEliminated && 'mchip--eliminated',
    isTargetable && !isEliminated && 'mchip--targetable',
    isSpotlight && 'mchip--spotlight',
    battleLive && isHitActive && 'mchip--hit',
    battleLive && isShockHitActive && 'mchip--shock-hit',
    battleLive && isKeraunosVoltageHit && 'mchip--keraunos-voltage',
    battleLive && isJoltArcAttackActive && 'mchip--jolt-arc-attack',
    battleLive && (isShocked || shockBridgeActive) && effectPips?.some(p => p.sourceDeity && DEITY_POWERS[p.sourceDeity]?.some(power => power.afflictions?.includes(EFFECT_TAGS.SHOCK))) && 'mchip--shocked',
    battleLive && hasJoltArcDeceleration && 'mchip--jolt-arc-deceleration',
    battleLive && isPetalShielded && 'mchip--petal-shielded',
    battleLive && hasPomegranateEffect && 'mchip--pomegranate',
    battleLive && isSpiritForm && 'mchip--spirit-form',
    battleLive && isShadowCamouflaged && 'mchip--shadow-camouflaged',
    battleLive && hasBeyondNimbus && 'mchip--beyond-the-nimbus',
    battleLive && hasSoulDevourer && 'mchip--soul-devourer',
    battleLive && hasDeathKeeper && 'mchip--death-keeper',
    battleLive && showResurrecting && 'mchip--resurrecting',
    battleLive && showResFlash && 'mchip--res-flash',
    battleLive && showResGlow && 'mchip--res-glow',
    battleLive && isResurrected && 'mchip--resurrected',
    battleLive && showFragranceVisual && 'mchip--fragrance-waved',
  ].filter(Boolean).join(' ');

  // Prepare list of minions to render (live + recently removed for exit animation)
  // Build a stable render order: start from last rendered order and keep items
  // that still exist (or are exiting). This prevents items shifting positions
  // while an exit animation plays.
  const liveMinions = minions || [];
  const exitingOnly = exitingMinions.filter((e) => !liveMinions.find((l) => l.characterId === e.characterId));
  const minionsToRender = (() => {
    const prev = lastRenderedRef.current || [];
    const next: Minion[] = [];
    const liveById = new Map(liveMinions.map((m) => [m.characterId, m] as const));
    const consumed = new Set<string>();

    // keep order from previous render where possible
    for (const p of prev) {
      if (liveById.has(p.characterId)) {
        const m = liveById.get(p.characterId)!;
        next.push(m);
        consumed.add(m.characterId);
      } else {
        // if this was removed but is still in exiting list, keep it in-place
        const ex = exitingOnly.find((e) => e.characterId === p.characterId);
        if (ex) {
          next.push(ex);
          consumed.add(ex.characterId);
        }
      }
    }

    // append any new live minions not yet accounted for
    for (const m of liveMinions) {
      if (!consumed.has(m.characterId)) {
        next.push(m);
        consumed.add(m.characterId);
      }
    }

    lastRenderedRef.current = next;
    return next;
  })();

  return (
    <div
      ref={chipRef}
      className={chipClass}
      style={{
        '--chip-primary': fighter.theme[0],
        '--chip-accent': fighter.theme[1],
        ...(frameLayout.width > 0 && {
          '--mchip-frame-top': `${frameLayout.top}px`,
          '--mchip-frame-left': `${frameLayout.left}px`,
          '--mchip-frame-width': `${frameLayout.width}px`,
        }),
      } as React.CSSProperties}
      onClick={isTargetable && !isEliminated && onSelect ? onSelect : undefined}
      role={isTargetable && !isEliminated ? 'button' : undefined}
    >
      {/* Wavy line background — Petal Shield only: thin lines, green/yellow/white/pink, low opacity */}
      {isPetalShielded && battleLive && (
        <div className="mchip__wavy-line mchip__wavy-line--petal" aria-hidden="true">
          <WavyLines className="mchip__wavy-line-svg" />
        </div>
      )}

      {/* Falling petal/leaf particles — clipped by overflow:hidden wrapper */}
      {isPetalShielded && battleLive && <div className="mchip__petal-fall" aria-hidden="true" />}

      {/* Rising pink & green particles (nimbus-style, bottom to top), no glow */}
      {isPetalShielded && battleLive && (
        <div className="mchip__petal-rise" aria-hidden="true">
          {Array.from({ length: 40 }, (_, i) => (
            <span key={i} className="mchip__petal-rise-particle" />
          ))}
        </div>
      )}

      {/* Jolt Arc Deceleration — rich decoration (storm, charge drops, rise particles) */}
      {hasJoltArcDeceleration && battleLive && (
        <>
          <div className="mchip__jolt-decel-storm" aria-hidden="true" />
          <div className="mchip__jolt-decel-rain" aria-hidden="true">
            {Array.from({ length: 18 }, (_, i) => (
              <span key={i} className="mchip__jolt-decel-rain-drop" />
            ))}
          </div>
          <div className="mchip__jolt-decel-smoke" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={`mchip__jolt-decel-smoke-wisp mchip__jolt-decel-smoke-wisp--${i + 1}`} />
            ))}
          </div>
          <div className="mchip__jolt-decel-drops" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} className={`mchip__jolt-decel-drop mchip__jolt-decel-drop--${i + 1}`} />
            ))}
          </div>
          <div className="mchip__jolt-decel-rise" aria-hidden="true">
            {Array.from({ length: 43 }, (_, i) => (
              <span key={i} className="mchip__jolt-decel-rise-particle" />
            ))}
          </div>
          <div className="mchip__jolt-decel-sparks" aria-hidden="true" />
          {/* Spark points scattered over chip (not in frame) */}
          <div className="mchip__jolt-decel-spark-points" aria-hidden="true">
            {Array.from({ length: 24 }, (_, i) => (
              <span key={i} className={`mchip__jolt-decel-spark-point mchip__jolt-decel-spark-point--${i + 1}`} />
            ))}
          </div>
        </>
      )}

      {/* Beyond the Nimbus — background storm, rain light, and cloud under frame */}
      {hasBeyondNimbus && battleLive && (
        <>
          <div className="mchip__nimbus-storm" aria-hidden="true">
            <span className="mchip__nimbus-bolt mchip__nimbus-bolt--1" />
            <span className="mchip__nimbus-bolt mchip__nimbus-bolt--2" />
            <span className="mchip__nimbus-bolt mchip__nimbus-bolt--3" />
            <span className="mchip__nimbus-bolt mchip__nimbus-bolt--4" />
            <span className="mchip__nimbus-bolt mchip__nimbus-bolt--5" />
            <span className="mchip__nimbus-bolt mchip__nimbus-bolt--6" />
            <span className="mchip__nimbus-bolt mchip__nimbus-bolt--7" />
          </div>
          <div className="mchip__nimbus-overlay" aria-hidden="true" />
          <div className="mchip__nimbus-overlay mchip__nimbus-overlay--lower" aria-hidden="true" />
          <div className="mchip__nimbus-rain" aria-hidden="true">
            {Array.from({ length: 18 }, (_, i) => (
              <span key={i} className="mchip__nimbus-drop" />
            ))}
          </div>
          <div className="mchip__nimbus-clouds" aria-hidden="true">
            <span className="mchip__nimbus-cloud mchip__nimbus-cloud--1" />
            <span className="mchip__nimbus-cloud mchip__nimbus-cloud--2" />
            <span className="mchip__nimbus-cloud mchip__nimbus-cloud--3" />
            <span className="mchip__nimbus-cloud mchip__nimbus-cloud--4" />
          </div>
          <div className="mchip__nimbus-rise" aria-hidden="true">
            {Array.from({ length: 40 }, (_, i) => (
              <span key={i} className="mchip__nimbus-rise-particle" />
            ))}
          </div>
        </>
      )}

      {/* Soul Devourer — souls from every edge/corner inhaled to center (black, purple, white) */}
      {hasSoulDevourer && battleLive && (
        <div className="mchip__soul-float" aria-hidden="true">
          {['tl', 'tr', 'br', 'bl', 't', 'r', 'b', 'l'].map((d) => (
            <span key={d} className={`mchip__soul-layer mchip__soul-layer--${d}`} />
          ))}
        </div>
      )}

      {/* Fragrance Wave — falling flower/leaf particles for Floral Fragrance buff */}
      {showFragranceVisual && battleLive && <div className="mchip__fragrance-wave" aria-hidden="true" />}

      {/* Keraunos Voltage — ultimate Zeus strike: rain + lightning drops (like Nimbus), multiple bolts, corona, sparks, rings */}
      {isKeraunosVoltageHit && battleLive && (
        <div className="mchip__keraunos-vfx" aria-hidden="true">
          {/* Dim overlay — dramatic darkening so lightning and effects pop */}
          <div className="mchip__keraunos-overlay" aria-hidden="true" />
          {/* Rain drops + lightning bolt drops (same effect as Beyond the Nimbus, gold/amber theme) */}
          <div className="mchip__keraunos-rain" aria-hidden="true">
            {Array.from({ length: 18 }, (_, i) => (
              <span key={i} className="mchip__keraunos-rain-drop" />
            ))}
          </div>
          <div className="mchip__keraunos-bolt-drops" aria-hidden="true">
            <span className="mchip__keraunos-bolt-drop mchip__keraunos-bolt-drop--1" />
            <span className="mchip__keraunos-bolt-drop mchip__keraunos-bolt-drop--2" />
            <span className="mchip__keraunos-bolt-drop mchip__keraunos-bolt-drop--3" />
            <span className="mchip__keraunos-bolt-drop mchip__keraunos-bolt-drop--4" />
            <span className="mchip__keraunos-bolt-drop mchip__keraunos-bolt-drop--5" />
            <span className="mchip__keraunos-bolt-drop mchip__keraunos-bolt-drop--6" />
            <span className="mchip__keraunos-bolt-drop mchip__keraunos-bolt-drop--7" />
          </div>
          {/* Floating splashing lights + scattered sparks */}
          <div className="mchip__keraunos-splash" aria-hidden="true">
            {Array.from({ length: 16 }, (_, i) => (
              <span key={i} className={`mchip__keraunos-splash-dot mchip__keraunos-splash-dot--${i + 1}`} />
            ))}
          </div>
          <div className="mchip__keraunos-scatter" aria-hidden="true">
            {Array.from({ length: 24 }, (_, i) => (
              <span key={i} className={`mchip__keraunos-scatter-spark mchip__keraunos-scatter-spark--${i + 1}`} />
            ))}
          </div>
          {/* Light blue rising particles — bottom to top */}
          <div className="mchip__keraunos-rise-blue" aria-hidden="true">
            {Array.from({ length: 20 }, (_, i) => (
              <span key={i} className={`mchip__keraunos-rise-blue-dot mchip__keraunos-rise-blue-dot--${i + 1}`} />
            ))}
          </div>
          <span className="mchip__keraunos-bolt mchip__keraunos-bolt--main" />
          <span className="mchip__keraunos-bolt mchip__keraunos-bolt--left" />
          <span className="mchip__keraunos-bolt mchip__keraunos-bolt--right" />
          <span className="mchip__keraunos-corona" />
          <span className="mchip__keraunos-ray mchip__keraunos-ray--1" />
          <span className="mchip__keraunos-ray mchip__keraunos-ray--2" />
          <span className="mchip__keraunos-ray mchip__keraunos-ray--3" />
          <span className="mchip__keraunos-ray mchip__keraunos-ray--4" />
          <span className="mchip__keraunos-ray mchip__keraunos-ray--5" />
          <span className="mchip__keraunos-ray mchip__keraunos-ray--6" />
          <span className="mchip__keraunos-ring mchip__keraunos-ring--inner" />
          <span className="mchip__keraunos-ring mchip__keraunos-ring--outer" />
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className={`mchip__keraunos-spark mchip__keraunos-spark--${i + 1}`} />
          ))}
        </div>
      )}

      {/* Soul Devourer lifesteal — same layout as Floral: wave (particles) only here; border + accents + text inside frame below */}
      {battleLive && showSoulDevourerHeal && soulDevourerHealDisplayAmount > 0 && (
        <div className="mchip__soul-devourer-wave" aria-hidden="true" />
      )}

      {/* Falling white (20) + yellow (15) + green (5) + pink (5) motes */}
      {isPetalShielded && battleLive && (
        <>
          <div className="mchip__dryad-lights" aria-hidden="true">
            {Array.from({ length: 20 }, (_, i) => (
              <span key={i} className="mchip__dryad-light" />
            ))}
          </div>
          <div className="mchip__petal-yellow-sparks" aria-hidden="true">
            {Array.from({ length: 15 }, (_, i) => (
              <span key={i} className="mchip__petal-yellow-spark" />
            ))}
          </div>
          <div className="mchip__petal-green-pink-sparks" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className="mchip__petal-green-pink-spark" />
            ))}
          </div>
          {/* Falling white flower shapes */}
          <div className="mchip__petal-flower-fall" aria-hidden="true">
            {Array.from({ length: 15 }, (_, i) => (
              <span key={i} className="mchip__petal-flower">
                <Flower />
              </span>
            ))}
          </div>
        </>
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

      {/* Card frame — outside body so it's not masked; when Nimbus, wings align to frame via wrapper */}
      <div className={`mchip__frame-wrap ${hasBeyondNimbus && battleLive ? 'mchip__frame-wrap--nimbus' : ''} ${!battleLive ? 'mchip__frame-wrap--ended' : ''}`}>
        {hasBeyondNimbus && battleLive && (
          <>
            <span className="mchip__nimbus-lightning mchip__nimbus-lightning--1" aria-hidden="true" />
            <span className="mchip__nimbus-lightning mchip__nimbus-lightning--2" aria-hidden="true" />
          </>
        )}
        <div ref={setFrameRef} className="mchip__frame" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
          {fighter.image ? (
            <img className="mchip__bg" src={fighter.image} alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className="mchip__bg mchip__bg--placeholder" style={{ background: fighter.theme[0], color: fighter.theme[9] }}>
              {fighter.nicknameEng.charAt(0)}
            </div>
          )}

          <div className="mchip__inner-border" />

          {/* Soul Devourer — frame-only effect (separate from soul-float): soft soul overlay inside frame */}

          {/* Shock sparks — electric dots (separate div to avoid ::before conflicts) */}
          {battleLive && (
            <>
              {/* Shocked effect — electric sparks around frame; also show while in Jolt Arc Deceleration state */}
              {((isShocked && !isJoltArcAttackActive) || (isShocked && hasJoltArcDeceleration)) && <div className="mchip__shock-sparks" aria-hidden="true" />}

              {/* Keraunos Voltage — gold/white spark frame (like shocked but divine theme) */}
              {isKeraunosVoltageHit && (
                <div className="mchip__keraunos-frame-sparks" aria-hidden="true">
                  <div className="mchip__keraunos-frame-sparks-inner" />
                </div>
              )}

              {/* Jolt Arc Deceleration — frame accents only (sparks are chip-level) */}
              {hasJoltArcDeceleration && (
                <div className="mchip__jolt-decel-accents" aria-hidden="true" />
              )}

              {/* Beyond the Nimbus — light storm glow on pic (like shocked sparks) */}
              {hasBeyondNimbus && <div className="mchip__nimbus-sparks" aria-hidden="true" />}

              {/* Soul Devourer — frame-only effect (separate from soul-float): soft soul overlay inside frame */}
              {hasSoulDevourer && <div className="mchip__soul-frame" aria-hidden="true" />}

              {/* Petal leaf accents — green spots around frame edge */}
              {isPetalShielded && <div className="mchip__petal-accents" aria-hidden="true" />}

              {/* Fragrance Wave border + accents (separate divs) + heal boost floating text */}
              {showFragranceVisual && (
                <>
                  <div className="mchip__fragrance-border" aria-hidden="true" />
                  <div className="mchip__fragrance-accents" aria-hidden="true" />
                  <div className="mchip__heal-boost" aria-hidden="true">+2 HP</div>
                </>
              )}

              {/* Soul Devourer lifesteal — same structure as Floral: border + accents + floating heal text (black/purple) */}
              {showSoulDevourerHeal && soulDevourerHealDisplayAmount > 0 && (
                <>
                  <div className="mchip__soul-devourer-border" aria-hidden="true" />
                  <div className="mchip__soul-devourer-accents" aria-hidden="true" />
                  <div className="mchip__soul-devourer-heal" aria-hidden="true">
                    +{soulDevourerHealDisplayAmount} HP
                  </div>
                </>
              )}

              {/* Petal shield badge — Secret of Dryad status immunity */}
              {isPetalShielded && (
                <div className="mchip__petal-badge" aria-hidden="true">
                  <PetalShield
                    gradientId={`petal-grad-${fighter.characterId}`}
                    color1={lightenColor(fighter.theme[0], 0.5)}
                    color2="#d1ffd4"
                  />
                </div>
              )}

              {/* Death Keeper scythe badge */}
              {hasDeathKeeper && (
                <div className="mchip__reaper-badge" aria-hidden="true">
                  <ReaperScythe
                    gradientId={`reaper-grad-${fighter.characterId}`}
                    color1="#88789fff"
                    color2="#cda4e0ff"
                  />
                </div>
              )}

              {/* Target crosshair badge — shown when selected as defend target */}
              {isDefender && (
                <div className="mchip__target-badge">
                  <TargetCrosshair />
                </div>
              )}
            </>
          )}

          <div className="mchip__overlay">
            <span className="mchip__name">{fighter.nicknameEng}</span>
            <span className="mchip__deity-tag">{deityLabel}</span>
            <div className="mchip__hp">
              <div className="mchip__hp-track">
                <div className="mchip__hp-fill" style={{ width: `${hpPct}%` }} />
              </div>
              <span className="mchip__hp-label">
                {displayHp}/{fighter.maxHp}
              </span>
            </div>
          </div>
        </div>
        {battleLive && (
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
          </>
        )}
      </div>

      {/* Pomegranate effect — ruby seeds + red/black lights + black mist (overlays frame) */}
      {hasPomegranateEffect && battleLive && (
        <>
          <div className="mchip__pom-seeds" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} className="mchip__pom-seed" />
            ))}
          </div>
          <div className="mchip__pom-lights" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="mchip__pom-light" />
            ))}
          </div>
          <div className="mchip__pom-rise" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className="mchip__pom-rise-particle" />
            ))}
          </div>
        </>
      )}

      {/* Spirit form — ethereal ghost wisps + badge (target only, overlays frame) */}
      {isSpiritForm && battleLive && (
        <>
          <div className="mchip__spirit-wisps" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className="mchip__spirit-wisp" />
            ))}
          </div>
        </>
      )}

      {/* Shadow Camouflage — dark wisps + shadow particles + badge (overlays frame) */}
      {isShadowCamouflaged && battleLive && (
        <>
          <div className="mchip__shadow-wisps" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className="mchip__shadow-wisp" />
            ))}
          </div>
          <div className="mchip__shadow-particles" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} className="mchip__shadow-particle" />
            ))}
          </div>
        </>
      )}

      {/* Petal shield — white overlay clipped by gradient (over image, under accents) */}
      {isPetalShielded && battleLive && <div className="mchip__petal-overlay" aria-hidden="true" />}

      {/* Resurrection flash — purple falling lights */}
      {showResurrecting && battleLive && (
        <div className="mchip__res-lights" aria-hidden="true">
          {Array.from({ length: 20 }, (_, i) => (
            <span key={i} className="mchip__res-light" />
          ))}
        </div>
      )}

      {/* Resurrecting — heavy purple-black mist while sigil overlay is active */}
      {showResurrecting && battleLive && (
        <div className="mchip__resurrect-mist" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className="mchip__resurrect-mist-particle" />
          ))}
        </div>
      )}

      {/* Resurrected — dark mist rising (permanent for rest of battle) */}
      {isResurrected && battleLive && (
        <div className="mchip__death-mist" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className="mchip__death-mist-particle" />
          ))}
        </div>
      )}

      {battleLive && (
        <>
          {/* Quota pips — below frame, inside chip */}
          {fighter.maxQuota > 0 && (
            <div className="mchip__quota">
              {Array.from({ length: fighter.maxQuota }, (_, i) => {
                const quota = typeof fighter.quota === 'number' && !isNaN(fighter.quota) ? fighter.quota : fighter.maxQuota;
                return (
                  <span key={i} className={`mchip__quota-pip${i < quota ? ' mchip__quota-pip--filled' : ''}`} />
                );
              })}
            </div>
          )}

          {/* Minions — rendered below main fighter */}
          {battleLive && ((minions && minions.length > 0) || exitingMinions.length > 0) && (
            <div className="mchip__minions">
              {/* Render live minions plus any recently-removed minions (for exit animation) */}
              {minionsToRender.map((minion, index) => {
                const displayName = minion.nicknameEng.split("'s")[0] + "'s " + minion.type.slice(0, 2).toUpperCase() + String(index + 1);
                const isSpawning = !!(minion.createdAt && (now - minion.createdAt) < MINION_SPAWN_MS);
                const isExiting = !!exitingMinions.find((e) => e.characterId === minion.characterId);
                const transientHit = exitingHitMap[minion.characterId] || Boolean((minion as any).__isHit) || !!minionHitActiveById[minion.characterId] || !!playbackMinionHitActiveById[minion.characterId];
                // Visual exiting state: either recently removed (isExiting) or transiently marked hit by engine (__isHit) or pulse target
                const visualExiting = isExiting || transientHit;
                const spawnClass = isSpawning && minion.type === 'skeleton' ? 'mchip--spawning-skeleton' : '';
                // If this is a transient hit (engine-marked __isHit), we want the
                // shake to play first and then start the despawn animation. Add
                // a transient marker class so CSS can delay the shrink animation.
                let exitClass = '';
                if (visualExiting && minion.type === 'skeleton') {
                  exitClass = transientHit
                    ? 'mchip--despawning-skeleton mchip--transient-exiting'
                    : 'mchip--despawning-skeleton';
                }
                const hitClass = transientHit ? ' mchip__frame--minion--hit' : '';
                // Check if this minion is the visual defender
                const isMinionDefender = visualDefenderId === minion.characterId;
                return (
                  <div key={minion.characterId} className="mchip__minion-wrap">
                    <div
                      className={`mchip__frame--minion ${spawnClass} ${exitClass}${hitClass}`}
                      onMouseEnter={(e) => handleMinionEnter(minion, e)}
                      onMouseLeave={handleMinionLeave}
                    >
                      {minion.image ? (
                        <img className="mchip__frame--minion__bg" src={minion.image} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="mchip__frame--minion__bg mchip__frame--minion__bg--placeholder" style={{ background: minion.theme[0], color: minion.theme[9] }}>
                          {minion.nicknameEng.charAt(0)}
                        </div>
                      )}

                      {/* Defender badge for minion */}
                      {isMinionDefender && (
                        <div className="mchip__target-badge">
                          <TargetCrosshair />
                        </div>
                      )}

                      <div className="mchip__frame--minion__overlay">
                        <span className="mchip__frame--minion__name">{displayName}</span>
                        {minion.type !== 'skeleton' && (
                          <div className="mchip__frame--minion__hp">
                            <div className="mchip__frame--minion__hp-track">
                              <div className="mchip__frame--minion__hp-fill" style={{ width: `${hpPct}%` }} />
                            </div>
                            <span className="mchip__frame--minion__hp-label">
                              {minion.currentHp}/{minion.maxHp}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mist elements moved out to be siblings so they can extend outside the frame */}
                    {isSpawning && minion.type === 'skeleton' && <div className="mchip__minion-mist mchip__minion-mist--spawn" aria-hidden="true" />}
                    {visualExiting && minion.type === 'skeleton' && <div className="mchip__minion-mist mchip__minion-mist--despawn" aria-hidden="true" />}
                  </div>
                );
              })}
              {/* exitingOnly items are rendered in-place via minionsToRender to preserve layout */}
            </div>
          )}
        </>
      )}

      {/* Hover stat popup — rendered via portal to escape stacking contexts */}
      {hovered && chipRef.current && createPortal(
        <FighterPopupPanel
          fighter={fighter}
          deityLabel={deityLabel}
          chipRef={chipRef}
          onEnter={handleEnter}
          onLeave={handleLeave}
          statMods={statMods}
          battleLive={battleLive}
        />,
        document.body,
      )}
      {hoveredMinion && minionChipRef.current && createPortal(
        <MinionPopupPanel
          minion={hoveredMinion}
          index={(lastRenderedRef.current || []).findIndex((m) => m.characterId === hoveredMinion.characterId)}
          masterName={fighter.nicknameEng}
          chipRef={minionChipRef}
          onEnter={() => clearTimeout(minionHoverTimer.current)}
          onLeave={handleMinionLeave}
        />,
        document.body,
      )}
    </div>
  );
}
