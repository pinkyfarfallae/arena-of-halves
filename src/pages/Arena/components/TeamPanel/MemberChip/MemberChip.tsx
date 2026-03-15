import type { RefObject } from 'react';
import { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { FighterState } from '../../../../../types/battle';
import { Minion } from '../../../../../types/minions';
import { DEITY_POWERS, NO_STACK_POWER_NAMES } from '../../../../../data/powers';
import { lightenColor } from '../../../../../utils/color';
import FloralMaiden from './icons/FloralMaiden';
import PetalVines from './icons/PetalVines';
import Flower from './icons/Flower';
import PomPearls from './icons/PomPearls';
import Rose from './icons/Rose';
import VoltageFrame from './icons/VoltageFrame';
import WavyLines from './icons/WavyLines';
import ReaperScythe from './icons/ReaperScythe';
import TargetCrosshair from './icons/TargetCrosshair';

import { DEITY_DISPLAY_OVERRIDES } from '../../../../CharacterInfo/constants/overrides';
import { DEITY_SVG, toDeityKey } from '../../../../../data/deities';

import MinionPopupPanel from './components/MinionPopupPanel/MinionPopupPanel';
import FighterPopupPanel from './components/FighterPopupPanel/FighterPopupPanel';
import { EFFECT_TAGS } from '../../../../../constants/effectTags';
import { CHARACTER } from '../../../../../constants/characters';
import { POWER_NAMES } from '../../../../../constants/powers';

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
  isEfflorescenceMuse?: boolean;
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
  /** Floral Fragrance heal amount from log (shown as +n HP in fragrance wave). */
  floralFragranceHeal?: number;
  /** When set, delay showing the fragrance wave by this many ms (e.g. to sync with D4 result card). */
  floralFragranceDelayMs?: number;
  /** True when Floral Heal D4 result card is visible; when false and isFloralHealTarget, hide fragrance wave (healing ended). */
  floralHealResultCardVisible?: boolean;
  /** True when this chip is the Floral Fragrance heal target (allyTargetId); used with floralHealResultCardVisible to hide wave after heal. */
  isFloralHealTarget?: boolean;
  /** True when the caster of Floral Fragrance (for this heal) is Rosabella — use Rose icon in petal emission instead of Flower. */
  floralFragranceCasterIsRosabella?: boolean;
  /** In demo mode, when this key changes (effect selection changed), hide the fragrance wave. Not tied to Replay so Replay can re-trigger hit/shock without breaking fragrance. */
  demoFragranceSessionKey?: string;
  /** Soul Devourer lifesteal: show +{n} HP in frame (inline, once per key). */
  soulDevourerHealAmount?: number;
  soulDevourerHealKey?: string;
  /** Ref for Arena soul float to target this chip's frame center (caster only). */
  casterFrameRef?: RefObject<HTMLDivElement | null>;
  /** Ref for Arena soul float to start from this chip's frame center (defender only). */
  defenderFrameRef?: RefObject<HTMLDivElement | null>;
}

export default function MemberChip({ fighter, isAttacker, isDefender, isEliminated, isTargetable, isSpotlight, isCrit, isHit, isShockHit, isKeraunosVoltageHit, isJoltArcAttackHit, isShocked, hasJoltArcDeceleration, isEfflorescenceMuse, hasPomegranateEffect, isSpiritForm, isShadowCamouflaged, hasBeyondNimbus, hasSoulDevourer, hasDeathKeeper, isResurrected, isResurrecting, isFragranceWaved, turnOrder, effectPips, statMods, battleLive, onSelect, minions, visualDefenderId, minionHitPulseId, hitEventKey, shockHitEventKey, playbackHitTargetId, playbackHitEventKey, minionPulseMap, allowTransientHits = true, floralLogKey, floralFragranceHeal, floralFragranceDelayMs, floralHealResultCardVisible, isFloralHealTarget, floralFragranceCasterIsRosabella, demoFragranceSessionKey, soulDevourerHealAmount = 0, soulDevourerHealKey, casterFrameRef, defenderFrameRef }: Props) {
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
      // Start shake immediately so it lines up with damage card (0ms; restart still works via false→true)
      hitPulseRestartRef.current = setTimeout(() => {
        hitPulseRestartRef.current = null;
        setIsHitActive(true);
        hitPulseTimerRef.current = setTimeout(() => {
          hitPulseTimerRef.current = null;
          setIsHitActive(false);
        }, 1500);
      }, 0);
      return () => {
        if (hitPulseRestartRef.current) clearTimeout(hitPulseRestartRef.current);
        hitPulseRestartRef.current = null;
        if (hitPulseTimerRef.current) clearTimeout(hitPulseTimerRef.current);
        hitPulseTimerRef.current = null;
      };
    }
  }, [minionHitPulseId, allowTransientHits]);

  // When a minion is the hit target (minionPulseMap[minion.characterId] set), show hit effect on that minion frame.
  // Start shake immediately (0ms) so it lines up with damage card.
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
        }, 0);
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
  const fragranceDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const springWaveActiveRef = useRef(false);
  const springShownKeyRef = useRef<string | null>(null);
  const [showSpringHealVfx, setShowSpringHealVfx] = useState(false);

  // Spring heal: โชว์ VFX แบบ Floral โดยใช้ state แยก ไม่มี effect อื่นมาเคลียร์
  useEffect(() => {
    const isSpring = typeof floralLogKey === 'string' && floralLogKey.startsWith('spring_') && floralFragranceHeal != null && floralFragranceHeal > 0;
    if (!isSpring) return;
    if (springShownKeyRef.current === floralLogKey) return;
    springShownKeyRef.current = floralLogKey;
    setShowSpringHealVfx(true);
    const t = setTimeout(() => {
      setShowSpringHealVfx(false);
      springShownKeyRef.current = null;
    }, 3000);
    return () => clearTimeout(t);
  }, [floralLogKey ?? '', floralFragranceHeal]);

  useEffect(() => {
    if (!isFragranceWaved) {
      prevFragranceRef.current = false;
      if (springWaveActiveRef.current) return;
      if (fragranceDelayTimerRef.current) {
        clearTimeout(fragranceDelayTimerRef.current);
        fragranceDelayTimerRef.current = null;
      }
      if (fragranceWaveTimerRef.current) {
        clearTimeout(fragranceWaveTimerRef.current);
        fragranceWaveTimerRef.current = null;
      }
      setShowFragranceWave(false);
      return;
    }
    const isSpringKey = typeof floralLogKey === 'string' && floralLogKey.startsWith('spring_');
    if (!isSpringKey && prevFragranceRef.current) return;

    // If this fragrance originates from a persistent log entry, check localStorage
    // so we only show it once per client (prevents showing again after reload).
    // Spring (Ephemeral Season) heal: never skip so VFX always shows.
    if (floralLogKey && !isSpringKey) {
      try {
        const seen = window.localStorage.getItem(floralLogKey);
        if (seen) {
          prevFragranceRef.current = true;
          return;
        }
      } catch (e) { }
    }

    // Show the wave when isFragranceWaved is true; optionally delay to sync with result card (e.g. D4 heal crit)
    const showWave = () => {
      if (isSpringKey) springWaveActiveRef.current = true;
      setShowFragranceWave(true);
      fragranceWaveTimerRef.current = setTimeout(() => {
        if (isSpringKey) springWaveActiveRef.current = false;
        setShowFragranceWave(false);
        fragranceWaveTimerRef.current = null;
        if (floralLogKey) {
          try { window.localStorage.setItem(floralLogKey, '1'); } catch (e) { }
        }
      }, 3000);
      prevFragranceRef.current = true;
    };
    if (typeof floralFragranceDelayMs === 'number' && floralFragranceDelayMs > 0) {
      if (fragranceDelayTimerRef.current) clearTimeout(fragranceDelayTimerRef.current);
      fragranceDelayTimerRef.current = setTimeout(showWave, floralFragranceDelayMs);
      return () => {
        if (fragranceDelayTimerRef.current) {
          clearTimeout(fragranceDelayTimerRef.current);
          fragranceDelayTimerRef.current = null;
        }
      };
    }
    if (fragranceDelayTimerRef.current) {
      clearTimeout(fragranceDelayTimerRef.current);
      fragranceDelayTimerRef.current = null;
    }
    showWave();
    // Dependencies normalized to stable primitives to avoid array size changing between renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(isFragranceWaved), floralLogKey ?? '', floralFragranceDelayMs ?? 0]);

  // When healing has ended (result card hidden or not shown) and this chip is the Floral heal target, hide the wave immediately
  const hideFragranceAfterHeal = Boolean(isFloralHealTarget && floralHealResultCardVisible !== true);
  useEffect(() => {
    if (!hideFragranceAfterHeal) return;
    setShowFragranceWave(false);
    prevFragranceRef.current = false;
    if (fragranceDelayTimerRef.current) {
      clearTimeout(fragranceDelayTimerRef.current);
      fragranceDelayTimerRef.current = null;
    }
    if (fragranceWaveTimerRef.current) {
      clearTimeout(fragranceWaveTimerRef.current);
      fragranceWaveTimerRef.current = null;
    }
  }, [hideFragranceAfterHeal]);

  // Demo mode: hide fragrance wave only when effect selection changes (_demoVfxKey), not when Replay is clicked, so Replay can re-trigger hit/shock without breaking
  const lastDemoSessionKeyRef = useRef<string | null>(null);
  if (demoFragranceSessionKey != null && demoFragranceSessionKey !== '' && showFragranceWave && isFragranceWaved && lastDemoSessionKeyRef.current === null) {
    lastDemoSessionKeyRef.current = demoFragranceSessionKey;
  }
  if (demoFragranceSessionKey == null || demoFragranceSessionKey === '' || !showFragranceWave) lastDemoSessionKeyRef.current = null;
  const demoSessionMismatch = demoFragranceSessionKey != null && lastDemoSessionKeyRef.current != null && lastDemoSessionKeyRef.current !== demoFragranceSessionKey;

  useEffect(() => {
    if (!demoSessionMismatch) return;
    setShowFragranceWave(false);
    lastDemoSessionKeyRef.current = null;
    if (fragranceDelayTimerRef.current) {
      clearTimeout(fragranceDelayTimerRef.current);
      fragranceDelayTimerRef.current = null;
    }
    if (fragranceWaveTimerRef.current) {
      clearTimeout(fragranceWaveTimerRef.current);
      fragranceWaveTimerRef.current = null;
    }
  }, [demoSessionMismatch]);

  // Derive visible state: hide when healing ended or (in demo) effect selection changed; Replay click does not hide. Spring heal ใช้ state แยก showSpringHealVfx
  const showFragranceVisual = (showFragranceWave && (isFragranceWaved || springWaveActiveRef.current) && !hideFragranceAfterHeal && !demoSessionMismatch) || showSpringHealVfx;

  // Target has Efflorescence Muse in effect pips (Secret of Dryad) — used to hide petal-emission splash when they already have that status at heal time
  const hasEfflorescenceMuseInPips = (effectPips ?? []).some((p) => p.powerName === POWER_NAMES.SECRET_OF_DRYAD);

  // If the fighter's HP increases (heal applied), clear the fragrance wave visual
  // immediately to avoid leaving the +HP text stuck — unless the increase is the
  // heal we are showing (Floral Fragrance or Ephemeral Season: Spring; same VFX, same prop).
  const prevHpRef = useRef<number>(fighter.currentHp);
  const [displayHp, setDisplayHp] = useState(fighter.currentHp);
  useEffect(() => {
    const prev = prevHpRef.current;
    if (fighter.currentHp > prev) {
      const increase = fighter.currentHp - prev;
      const isFloralFragranceHeal = floralFragranceHeal != null && increase === floralFragranceHeal;
      if (!isFloralFragranceHeal) {
        setShowFragranceWave(false);
        prevFragranceRef.current = false;
        fragranceSuppressRef.current = true;
        if (fragranceSuppressTimer.current) clearTimeout(fragranceSuppressTimer.current);
        fragranceSuppressTimer.current = setTimeout(() => {
          fragranceSuppressRef.current = false;
          fragranceSuppressTimer.current = null;
        }, 800);
      }
    }
    prevHpRef.current = fighter.currentHp;
    return undefined;
  }, [fighter.currentHp, floralFragranceHeal]);

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
      if (fragranceDelayTimerRef.current) clearTimeout(fragranceDelayTimerRef.current);
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
    battleLive && isEfflorescenceMuse && 'mchip--efflorescence-muse',
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
      {/* Wavy line background — Efflorescence Muse only: thin lines, green/yellow/white/pink, low opacity */}
      {isEfflorescenceMuse && battleLive && (
        <div className="mchip__wavy-line mchip__wavy-line--petal" aria-hidden="true">
          <WavyLines className="mchip__wavy-line-svg" />
        </div>
      )}

      {/* Falling petal/leaf particles — clipped by overflow:hidden wrapper */}
      {isEfflorescenceMuse && battleLive && <div className="mchip__petal-fall" aria-hidden="true" />}

      {/* Rising pink & green particles (nimbus-style, bottom to top), no glow */}
      {isEfflorescenceMuse && battleLive && (
        <div className="mchip__petal-rise" aria-hidden="true">
          {Array.from({ length: 40 }, (_, i) => (
            <span key={i} className="mchip__petal-rise-particle" />
          ))}
        </div>
      )}

      {/* Efflorescence Muse: raindrops (white and yellow only, like Beyond the Nimbus) */}
      {isEfflorescenceMuse && battleLive && (
        <div className="mchip__petal-rain" aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <span key={i} className="mchip__petal-drop" />
          ))}
        </div>
      )}

      {/* Wind VFX at bottom — pink / green / yellow (autumn-style): streaks + drifting squares */}
      {isEfflorescenceMuse && battleLive && (
        <div className="mchip__petal-wind" aria-hidden="true">
          <div className="mchip__petal-wind-streak mchip__petal-wind-streak--1" />
          <div className="mchip__petal-wind-streak mchip__petal-wind-streak--2" />
          <div className="mchip__petal-wind-streak mchip__petal-wind-streak--3" />
          <div className="mchip__petal-wind-streak mchip__petal-wind-streak--4" />
          <div className="mchip__petal-wind-streak mchip__petal-wind-streak--5" />
          <div className="mchip__petal-wind-drifts" aria-hidden="true">
            {Array.from({ length: 24 }, (_, i) => (
              <span
                key={i}
                className="mchip__petal-wind-drift"
                style={
                  {
                    '--drift-x': `${8 + (i * 4) % 84}%`,
                    '--drift-y': `${28 + (i * 3) % 68}%`,
                    '--drift-delay': `${(i * 0.25) % 3}s`,
                    '--drift-duration': `${3.5 + (i % 4) * 0.5}s`,
                    '--drift-color': ['#f48fb1', '#81c784', '#ffeb3b'][i % 3],
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
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

      {/* Fragrance Wave — falling flower/leaf particles (Floral Fragrance or Ephemeral Season: Spring heal, same VFX) */}
      {showFragranceVisual && battleLive && <div className="mchip__fragrance-wave" aria-hidden="true" />}

      {/* Fragrance petal emission — splash out (same VFX as Efflorescence Muse) only when target has no Efflorescence Muse in effect pips at heal time */}
      {showFragranceVisual && battleLive && !hasEfflorescenceMuseInPips && (() => {
        const flowerParticles = Array.from({ length: 12 }, (_, i) => ({
          angle: (i / 12) * 360 + 8,
          delay: i * 0.18,
          duration: 5 + (i % 3) * 0.8,
          distance: 80 + (i % 3) * 24,
        }));
        const leafParticles = Array.from({ length: 12 }, (_, i) => ({
          angle: (i / 12) * 360 + 7,
          delay: 0.1 + (i % 4) * 0.15,
          duration: 5.5 + (i % 5) * 0.5,
          distance: 92 + (i % 4) * 24,
          size: 0.8 + (i % 3) * 0.2,
        }));
        const dustParticles = Array.from({ length: 24 }, (_, i) => ({
          angle: (i / 24) * 360 + (i % 7) * 5,
          delay: (i % 6) * 0.12,
          duration: 4.5 + (i % 4) * 0.6,
          distance: 82 + (i % 5) * 20,
          size: 2.5 + (i % 4) * 0.8,
          scale: 0.9 + (i % 4) * 0.1,
          color: ['#f8bbd0', '#c8e6c9', '#fff9c4', '#e1bee7'][i % 4],
        }));
        return (
          <div className="mchip__fragrance-petal-emission" aria-hidden="true">
            {flowerParticles.map((p, i) => (
              <div
                key={`f-${i}`}
                className="mchip__fragrance-petal-emission-flower"
                style={
                  {
                    '--angle': `${p.angle}deg`,
                    '--delay': `${p.delay}s`,
                    '--duration': `${p.duration}s`,
                    '--distance': `${p.distance}px`,
                  } as React.CSSProperties
                }
              >
                {floralFragranceCasterIsRosabella ? (
                  <Rose width={14} height={14} color="#f48fb1" centerColor="#e91e63" />
                ) : (
                  <Flower width={14} height={14} />
                )}
              </div>
            ))}
            {leafParticles.map((p, i) => (
              <span
                key={`l-${i}`}
                className="mchip__fragrance-petal-emission-leaf"
                style={
                  {
                    '--angle': `${p.angle}deg`,
                    '--delay': `${p.delay}s`,
                    '--duration': `${p.duration}s`,
                    '--distance': `${p.distance}px`,
                    '--size': p.size,
                  } as React.CSSProperties
                }
              />
            ))}
            {dustParticles.map((p, i) => (
              <span
                key={`d-${i}`}
                className="mchip__fragrance-petal-emission-dust"
                style={
                  {
                    '--angle': `${p.angle}deg`,
                    '--delay': `${p.delay}s`,
                    '--duration': `${p.duration}s`,
                    '--distance': `${p.distance}px`,
                    '--size': `${p.size}px`,
                    '--scale': p.scale,
                    '--dust-color': p.color,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        );
      })()}

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
      {isEfflorescenceMuse && battleLive && (
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

      {/* Card frame — outside body so it's not masked; when Nimbus/Petal, wings align to frame via wrapper */}
      <div className={`mchip__frame-wrap ${hasBeyondNimbus && battleLive ? 'mchip__frame-wrap--nimbus' : ''} ${isEfflorescenceMuse && battleLive ? 'mchip__frame-wrap--efflorescence-muse' : ''} ${!battleLive ? 'mchip__frame-wrap--ended' : ''}`}>
        {/* Shocked — voltage frame (gold/blue + subtle line), same as Nimbus */}
        {((isShocked && !isJoltArcAttackActive) || (isShocked && hasJoltArcDeceleration)) && battleLive && (
          <div className="mchip__shocked-voltage" aria-hidden="true">
            <VoltageFrame className="mchip__shocked-voltage-svg" strokeLine1="#f6de8d" strokeLine2="#6bfeff" />
            <VoltageFrame className="mchip__shocked-voltage-svg" variant="single-subtle" strokeLine1="rgba(255,255,255,0.6)" />
          </div>
        )}
        {/* Jolt Arc Attack — voltage frame (white) */}
        {isJoltArcAttackActive && battleLive && (
          <div className="mchip__jolt-arc-voltage" aria-hidden="true">
            <VoltageFrame className="mchip__jolt-arc-voltage-svg" strokeLine1="#ffffff" strokeLine2="rgba(255,255,255,0.85)" />
            <VoltageFrame className="mchip__jolt-arc-voltage-svg" variant="single-subtle" strokeLine1="rgba(255,255,255,0.6)" />
          </div>
        )}
        {/* Keraunos Voltage — voltage frame (gold) */}
        {isKeraunosVoltageHit && battleLive && (
          <div className="mchip__keraunos-voltage" aria-hidden="true">
            <VoltageFrame className="mchip__keraunos-voltage-svg" strokeLine1="#f6de8d" strokeLine2="#fff59d" />
            <VoltageFrame className="mchip__keraunos-voltage-svg" variant="single-subtle" strokeLine1="rgba(255,248,225,0.7)" />
          </div>
        )}
        {hasBeyondNimbus && battleLive && (
          <>
            <span className="mchip__nimbus-lightning mchip__nimbus-lightning--1" aria-hidden="true" />
            <span className="mchip__nimbus-lightning mchip__nimbus-lightning--2" aria-hidden="true" />
            <div className="mchip__nimbus-voltage" aria-hidden="true">
              <VoltageFrame className="mchip__nimbus-voltage-svg" strokeLine1="#f6de8d" strokeLine2="#6bfeff" />
              <VoltageFrame className="mchip__nimbus-voltage-svg" variant="single-subtle" strokeLine1="rgba(255,255,255,0.6)" />
              <div className="mchip__nimbus-voltage-dots">
                <div className="mchip__nimbus-voltage-dot mchip__nimbus-voltage-dot--1" />
                <div className="mchip__nimbus-voltage-dot mchip__nimbus-voltage-dot--2" />
                <div className="mchip__nimbus-voltage-dot mchip__nimbus-voltage-dot--3" />
                <div className="mchip__nimbus-voltage-dot mchip__nimbus-voltage-dot--4" />
                <div className="mchip__nimbus-voltage-dot mchip__nimbus-voltage-dot--5" />
              </div>
            </div>
            <div className="mchip__nimbus-voltage mchip__nimbus-voltage--subtle-low" aria-hidden="true">
              <VoltageFrame className="mchip__nimbus-voltage-svg mchip__voltage-subtle-low" variant="single-subtle" strokeLine1="#ffffff" />
            </div>
          </>
        )}
        {/* Efflorescence Muse: fairy wings — 4 lobes (left top/bottom, right top/bottom) */}
        {isEfflorescenceMuse && battleLive && (
          <>
            <span className="mchip__petal-fairy-wing mchip__petal-fairy-wing--lt" aria-hidden="true" />
            <span className="mchip__petal-fairy-wing mchip__petal-fairy-wing--lb" aria-hidden="true" />
            <span className="mchip__petal-fairy-wing mchip__petal-fairy-wing--rt" aria-hidden="true" />
            <span className="mchip__petal-fairy-wing mchip__petal-fairy-wing--rb" aria-hidden="true" />
          </>
        )}
        {/* Vines climbing around all four sides of the frame + flowers at vine frame corners */}
        {isEfflorescenceMuse && battleLive && (() => {
          const charId = fighter.characterId;
          const charIdLower = charId?.toLowerCase();
          const isRosabella = charIdLower === CHARACTER.ROSABELLA;
                const flowerParticles = Array.from({ length: 12 }, (_, i) => ({
                  angle: (i / 12) * 360 + 8,
                  delay: i * 0.18,
                  duration: 5 + (i % 3) * 0.8,
                  distance: 80 + (i % 3) * 24,
                }));
                const leafParticles = Array.from({ length: 12 }, (_, i) => ({
                  angle: (i / 12) * 360 + 7,
                  delay: 0.1 + (i % 4) * 0.15,
                  duration: 5.5 + (i % 5) * 0.5,
                  distance: 92 + (i % 4) * 24,
                  size: 0.8 + (i % 3) * 0.2,
                }));
                const dustParticles = Array.from({ length: 24 }, (_, i) => ({
                  angle: (i / 24) * 360 + (i % 7) * 5,
                  delay: (i % 6) * 0.12,
                  duration: 4.5 + (i % 4) * 0.6,
                  distance: 82 + (i % 5) * 20,
                  size: 2.5 + (i % 4) * 0.8,
                  scale: 0.9 + (i % 4) * 0.1,
                  color: ['#f8bbd0', '#c8e6c9', '#fff9c4', '#e1bee7'][i % 4],
                }));
          return (
            <>
              <div className="mchip__petal-vines" aria-hidden="true">
                <PetalVines />
              </div>
              <div className="mchip__petal-corners" aria-hidden="true">
                <div className="mchip__petal-corner mchip__petal-corner--tl">
                  {isRosabella ? (
                    <Rose width={14} height={14} color="#f48fb1" centerColor="#e91e63" />
                  ) : (
                    <Flower width={14} height={14} />
                  )}
                </div>
                <div className="mchip__petal-corner mchip__petal-corner--tr">
                  {isRosabella ? (
                    <Rose width={14} height={14} color="#f48fb1" centerColor="#e91e63" />
                  ) : (
                    <Flower width={14} height={14} />
                  )}
                </div>
                <div className="mchip__petal-corner mchip__petal-corner--bl">
                  {isRosabella ? (
                    <Rose width={14} height={14} color="#f48fb1" centerColor="#e91e63" />
                  ) : (
                    <Flower width={14} height={14} />
                  )}
                </div>
                <div className="mchip__petal-corner mchip__petal-corner--br">
                  {isRosabella ? (
                    <Rose width={14} height={14} color="#f48fb1" centerColor="#e91e63" />
                  ) : (
                    <Flower width={14} height={14} />
                  )}
                </div>
                {/* Smaller flower/rose at the middle of each side */}
                <div className="mchip__petal-side mchip__petal-side--t">
                  {isRosabella ? (
                    <Rose width={10} height={10} color="#f48fb1" centerColor="#e91e63" />
                  ) : (
                    <Flower width={10} height={10} />
                  )}
                </div>
                <div className="mchip__petal-side mchip__petal-side--r">
                  {isRosabella ? (
                    <Rose width={10} height={10} color="#f48fb1" centerColor="#e91e63" />
                  ) : (
                    <Flower width={10} height={10} />
                  )}
                </div>
                <div className="mchip__petal-side mchip__petal-side--b">
                  {isRosabella ? (
                    <Rose width={10} height={10} color="#f48fb1" centerColor="#e91e63" />
                  ) : (
                    <Flower width={10} height={10} />
                  )}
                </div>
                <div className="mchip__petal-side mchip__petal-side--l">
                  {isRosabella ? (
                    <Rose width={10} height={10} color="#f48fb1" centerColor="#e91e63" />
                  ) : (
                    <Flower width={10} height={10} />
                  )}
                </div>
              </div>
              <div className="mchip__petal-emission" aria-hidden="true">
                {flowerParticles.map((p, i) => (
                  <div
                    key={`f-${i}`}
                    className="mchip__petal-emission-flower"
                    style={
                      {
                        '--angle': `${p.angle}deg`,
                        '--delay': `${p.delay}s`,
                        '--duration': `${p.duration}s`,
                        '--distance': `${p.distance}px`,
                      } as React.CSSProperties
                    }
                  >
                    {isRosabella ? (
                          <Rose width={14} height={14} color="#f48fb1" centerColor="#e91e63" />
                        ) : (
                          <Flower width={14} height={14} />
                        )}
                  </div>
                ))}
                {leafParticles.map((p, i) => (
                  <span
                    key={`l-${i}`}
                    className="mchip__petal-emission-leaf"
                    style={
                      {
                        '--angle': `${p.angle}deg`,
                        '--delay': `${p.delay}s`,
                        '--duration': `${p.duration}s`,
                        '--distance': `${p.distance}px`,
                        '--size': p.size,
                      } as React.CSSProperties
                    }
                  />
                ))}
                {dustParticles.map((p, i) => (
                  <span
                    key={`d-${i}`}
                    className="mchip__petal-emission-dust"
                    style={
                      {
                        '--angle': `${p.angle}deg`,
                        '--delay': `${p.delay}s`,
                        '--duration': `${p.duration}s`,
                        '--distance': `${p.distance}px`,
                        '--size': `${p.size}px`,
                        '--scale': p.scale,
                        '--dust-color': p.color,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>
            </>
          );
        })()}
        {/* Pomegranate caster — red pearls around frame */}
        {/* Pomegranate caster = red pearls; Spirit = black; caster+spirit = red-black alternating */}
        {(hasPomegranateEffect || isSpiritForm) && battleLive && (
          <div className="mchip__pom-pearls" aria-hidden="true">
            <PomPearls
              className="mchip__pom-pearls-svg"
              pearlColor={hasPomegranateEffect ? '#8b0000' : '#1a1a1a'}
              alternateColor={hasPomegranateEffect && isSpiritForm ? '#1a1a1a' : undefined}
              highlightColor={hasPomegranateEffect ? '#c62828' : '#444'}
            />
          </div>
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
              {isEfflorescenceMuse && <div className="mchip__petal-accents" aria-hidden="true" />}
              {/* Fragrance Wave border + accents (separate divs) + heal boost floating text */}
              {showFragranceVisual && (
                <>
                  <div className="mchip__fragrance-border" aria-hidden="true" />
                  <div className="mchip__fragrance-accents" aria-hidden="true" />
                  {floralFragranceHeal != null && floralFragranceHeal > 0 && (
                    <div className="mchip__heal-boost" aria-hidden="true">+{floralFragranceHeal} HP</div>
                  )}
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

              {/* Efflorescence Muse badge — status immunity */}
              {isEfflorescenceMuse && (
                <div className="mchip__petal-badge" aria-hidden="true">
                  <FloralMaiden
                    gradientId={`efflorescence-muse-grad-${fighter.characterId}`}
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

      {/* Pomegranate effect — corner/circle animation bg + ruby seeds, lights, glow rise, drops, mist, glow dots, oath particles */}
      {hasPomegranateEffect && !isSpiritForm && !isEfflorescenceMuse && battleLive && (
        <>
          {/* Triangle tunnel background (red/pink/white, 3D) */}
          <div className="mchip__pom-tris-wrap" aria-hidden="true">
            {Array.from({ length: 200 }, (_, i) => (
              <div key={i} className="mchip__pom-tri" />
            ))}
          </div>
          {/* Red/pink corner + circles animation background */}
          <div className="mchip__pom-canvas" aria-hidden="true">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <div key={`ninth-${n}`} className="mchip__pom-ninth">
                {n !== 5 && (
                  <div className="mchip__pom-corners-wrapper">
                    <div className="mchip__pom-corner mchip__pom-corner--large" />
                    <div className="mchip__pom-corner mchip__pom-corner--medium" />
                    <div className="mchip__pom-corner mchip__pom-corner--small" />
                  </div>
                )}
              </div>
            ))}
            {['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'].map((name) => (
              <div key={`circle-${name}`} className={`mchip__pom-circle mchip__pom-circle--${name}`} />
            ))}
            <div className="mchip__pom-meeting-point" />
          </div>
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
          <div className="mchip__pom-glow-rise" aria-hidden="true">
            {Array.from({ length: 24 }, (_, i) => (
              <span key={i} className="mchip__pom-glow-rise-particle" />
            ))}
          </div>
          <div className="mchip__pom-white-rise" aria-hidden="true">
            {Array.from({ length: 16 }, (_, i) => (
              <span key={i} className="mchip__pom-white-rise-particle" />
            ))}
          </div>
          <div className="mchip__pom-drops" aria-hidden="true">
            {/* Rain-style drops (like nimbus) — black and pink/red */}
            {Array.from({ length: 18 }, (_, i) => (
              <span key={`rain-${i}`} className="mchip__pom-drop" />
            ))}
            {/* Bolt-style drops (like nimbus) — black and pink/red */}
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <span key={`bolt-${n}`} className={`mchip__pom-bolt mchip__pom-bolt--${n}`} />
            ))}
          </div>
          <div className="mchip__pom-rise" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className="mchip__pom-rise-particle" />
            ))}
          </div>
          {/* Decorative: corner sparkles + edge sparkles + floating particles (no overlay) */}
          <div className="mchip__pom-deco" aria-hidden="true">
            {[1, 2, 3, 4].map((n) => (
              <span key={`corner-${n}`} className={`mchip__pom-deco-corner mchip__pom-deco-corner--${n}`} />
            ))}
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <span key={`edge-${n}`} className={`mchip__pom-deco-edge mchip__pom-deco-edge--${n}`} />
            ))}
            {Array.from({ length: 24 }, (_, i) => (
              <span key={`float-${i}`} className="mchip__pom-deco-float" />
            ))}
          </div>
          {/* Pomegranate's Oath caster-only: glow dots, oath particles */}
          <div className="mchip__pom-caster" aria-hidden="true">
            <div className="mchip__pom-glow-dots" aria-hidden="true">
              {Array.from({ length: 24 }, (_, i) => (
                <span key={i} className="mchip__pom-glow-dot" />
              ))}
            </div>
            <div className="mchip__pom-oath-particles">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className="mchip__pom-oath-particle" />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Spirit form — all effects (b&w/ethereal): tris, canvas, seeds, lights, rises, drops, deco, glow/oath + wisps */}
      {isSpiritForm && !isEfflorescenceMuse && battleLive && (
        <>
          <div className="mchip__spirit-tris-wrap" aria-hidden="true">
            {Array.from({ length: 200 }, (_, i) => (
              <div key={i} className="mchip__spirit-tri" />
            ))}
          </div>
          <div className="mchip__spirit-canvas" aria-hidden="true">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <div key={`ninth-${n}`} className="mchip__spirit-ninth">
                {n !== 5 && (
                  <div className="mchip__spirit-corners-wrapper">
                    <div className="mchip__spirit-corner mchip__spirit-corner--large" />
                    <div className="mchip__spirit-corner mchip__spirit-corner--medium" />
                    <div className="mchip__spirit-corner mchip__spirit-corner--small" />
                  </div>
                )}
              </div>
            ))}
            {['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'].map((name) => (
              <div key={`circle-${name}`} className={`mchip__spirit-circle mchip__spirit-circle--${name}`} />
            ))}
            <div className="mchip__spirit-meeting-point" />
          </div>
          <div className="mchip__spirit-seeds" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} className="mchip__spirit-seed" />
            ))}
          </div>
          <div className="mchip__spirit-lights" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="mchip__spirit-light" />
            ))}
          </div>
          <div className="mchip__spirit-glow-rise" aria-hidden="true">
            {Array.from({ length: 24 }, (_, i) => (
              <span key={i} className="mchip__spirit-glow-rise-particle" />
            ))}
          </div>
          <div className="mchip__spirit-white-rise" aria-hidden="true">
            {Array.from({ length: 16 }, (_, i) => (
              <span key={i} className="mchip__spirit-white-rise-particle" />
            ))}
          </div>
          <div className="mchip__spirit-drops" aria-hidden="true">
            {Array.from({ length: 18 }, (_, i) => (
              <span key={`rain-${i}`} className="mchip__spirit-drop" />
            ))}
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <span key={`bolt-${n}`} className={`mchip__spirit-bolt mchip__spirit-bolt--${n}`} />
            ))}
          </div>
          <div className="mchip__spirit-rise" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className="mchip__spirit-rise-particle" />
            ))}
          </div>
          <div className="mchip__spirit-deco" aria-hidden="true">
            {[1, 2, 3, 4].map((n) => (
              <span key={`corner-${n}`} className={`mchip__spirit-deco-corner mchip__spirit-deco-corner--${n}`} />
            ))}
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <span key={`edge-${n}`} className={`mchip__spirit-deco-edge mchip__spirit-deco-edge--${n}`} />
            ))}
            {Array.from({ length: 24 }, (_, i) => (
              <span key={`float-${i}`} className="mchip__spirit-deco-float" />
            ))}
          </div>
          <div className="mchip__spirit-caster" aria-hidden="true">
            <div className="mchip__spirit-glow-dots" aria-hidden="true">
              {Array.from({ length: 24 }, (_, i) => (
                <span key={i} className="mchip__spirit-glow-dot" />
              ))}
            </div>
            <div className="mchip__spirit-oath-particles">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className="mchip__spirit-oath-particle" />
              ))}
            </div>
          </div>
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

      {/* Efflorescence Muse — white overlay clipped by gradient (over image, under accents) */}
      {isEfflorescenceMuse && battleLive && <div className="mchip__petal-overlay" aria-hidden="true" />}

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
