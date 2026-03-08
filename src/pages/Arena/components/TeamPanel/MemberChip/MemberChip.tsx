import { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { FighterState } from '../../../../../types/battle';
import { Minion } from '../../../../../types/minions';
import { lightenColor } from '../../../../../utils/color';
import PetalShield from './icons/PetalShield';
import ReaperScythe from './icons/ReaperScythe';
import TargetCrosshair from './icons/TargetCrosshair';

import { DEITY_DISPLAY_OVERRIDES } from '../../../../CharacterInfo/constants/overrides';
import { DEITY_SVG, toDeityKey } from '../../../../../data/deities';
import './MemberChip.scss';
import MinionPopupPanel from './components/MinionPopupPanel/MinionPopupPanel';
import FighterPopupPanel from './components/FighterPopupPanel/FighterPopupPanel';

const PATTERN_ROWS = 23;
const ICONS_PER_ROW = 30;

// Spawn animation duration (ms) — keep in sync with SCSS animation
const MINION_SPAWN_MS = 1400;
// Despawn animation duration (ms) — matches dust (1000) + linger (750) + buffer
const MINION_DESPAWN_MS = 1900;

export interface EffectPip {
  powerName: string;
  sourceName: string;
  sourceTheme: [string, string];
  turnsLeft: number;
  /** Number of stacked instances of this same power from the same source */
  count: number;
}

/** Hover tooltip for effect pips — positioned via portal above all stacking contexts */
function EffectPipTooltip({ pip, rect }: { pip: EffectPip; rect: DOMRect }) {
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

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
      <span className="mchip__pip-tooltip-name">{pip.powerName}</span>
      <span className="mchip__pip-tooltip-source">by {pip.sourceName}</span>
      <div className="mchip__pip-tooltip-meta">
        {pip.count > 1 && <span className="mchip__pip-tooltip-stacks">{pip.count} stack{pip.count > 1 ? 's' : ''}</span>}
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
  isThunderboltHit?: boolean;
  isShocked?: boolean;
  isPetalShielded?: boolean;
  hasPomegranateEffect?: boolean;
  isSpiritForm?: boolean;
  isShadowCamouflaged?: boolean;
  hasSoulDevourer?: boolean;
  hasDeathKeeper?: boolean;
  isResurrected?: boolean;
  isResurrecting?: boolean;
  isScentWaved?: boolean;
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
  /** Map of characterId -> pulse id so minion frames can show hit when they are the target */
  minionPulseMap?: Record<string, number>;
  /** Whether transient-driven hits (minion pulses) are permitted right now */
  allowTransientHits?: boolean;
  /** Optional unique key derived from a recent log entry so Floral Fragrance
   *  from persistent logs is only shown once per client. If provided, the
   *  chip will consult localStorage to avoid re-showing the scent after a
   *  refresh. */
  floralLogKey?: string | undefined;
  /** Soul Devourer lifesteal: show +{n} HP in frame (inline, once per key). */
  soulDevourerHealAmount?: number;
  soulDevourerHealKey?: string;
}

export default function MemberChip({ fighter, isAttacker, isDefender, isEliminated, isTargetable, isSpotlight, isCrit, isHit, isShockHit, isThunderboltHit, isShocked, isPetalShielded, hasPomegranateEffect, isSpiritForm, isShadowCamouflaged, hasSoulDevourer, hasDeathKeeper, isResurrected, isResurrecting, isScentWaved, turnOrder, effectPips, statMods, battleLive, onSelect, minions, visualDefenderId, minionHitPulseId, minionPulseMap, allowTransientHits = true, floralLogKey, soulDevourerHealAmount = 0, soulDevourerHealKey }: Props) {
  const chipRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (isHit && !prevIsHitRef.current) {
      setIsHitActive(true);
      const timer = setTimeout(() => setIsHitActive(false), 1500);
      prevIsHitRef.current = true;
      return () => clearTimeout(timer);
    }
    if (!isHit) prevIsHitRef.current = false;
  }, [isHit]);

  // Trigger hit flash when a transient minion hit pulse occurs (even if
  // `isHit` hasn't toggled). This ensures the defender frame shakes when a
  // skeleton/minion DamageCard plays. Reset to false, then after a short
  // delay set true so the DOM loses the class and the animation restarts (n pulses → n shakes).
  const prevPulseRef = useRef<number | undefined>(undefined);
  const hitPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hitPulseRestartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
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
  }, [minionHitPulseId]);

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

  /* ── Shock hit: electric zap on defender when attacker has Lightning Reflex ── */
  const [isShockHitActive, setIsShockHitActive] = useState(false);
  const prevIsShockHitRef = useRef(false);

  useEffect(() => {
    if (isShockHit && !prevIsShockHitRef.current) {
      setIsShockHitActive(true);
      const timer = setTimeout(() => setIsShockHitActive(false), 1500);
      prevIsShockHitRef.current = true;
      return () => clearTimeout(timer);
    }
    if (!isShockHit) prevIsShockHitRef.current = false;
  }, [isShockHit]);

  /* ── Thunderbolt hit: massive lightning strike ── */
  const [isThunderboltActive, setIsThunderboltActive] = useState(false);
  const prevIsThunderboltRef = useRef(false);

  useEffect(() => {
    if (isThunderboltHit && !prevIsThunderboltRef.current) {
      setIsThunderboltActive(true);
      const timer = setTimeout(() => setIsThunderboltActive(false), 2000);
      prevIsThunderboltRef.current = true;
      return () => clearTimeout(timer);
    }
    if (!isThunderboltHit) prevIsThunderboltRef.current = false;
  }, [isThunderboltHit]);

  /* ── Scent wave + heal boost: brief 3s effect when Floral Scented applied ── */
  const [showScentWave, setShowScentWave] = useState(false);
  const prevScentRef = useRef(false);
  const scentSuppressRef = useRef(false);
  const scentSuppressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isScentWaved) {
      prevScentRef.current = false;
      return;
    }
    if (prevScentRef.current) return;

    // If this scent originates from a persistent log entry, check localStorage
    // so we only show it once per client (prevents showing again after reload).
    if (floralLogKey) {
      try {
        const seen = window.localStorage.getItem(floralLogKey);
        if (seen) {
          // Already shown before for this log — do not re-trigger.
          prevScentRef.current = true;
          return;
        }
      } catch (e) { }
    }

    if (!scentSuppressRef.current) {
      setShowScentWave(true);
      const timer = setTimeout(() => setShowScentWave(false), 3000);
      prevScentRef.current = true;
      // Mark as shown if we were triggered by a persistent log
      if (floralLogKey) {
        try { window.localStorage.setItem(floralLogKey, '1'); } catch (e) { }
      }
      return () => clearTimeout(timer);
    }
    // Dependencies normalized to stable primitives to avoid array size changing between renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(isScentWaved), floralLogKey ?? '']);

  // If the fighter's HP increases (heal applied), clear the scent wave visual
  // immediately to avoid leaving the +HP text/styling stuck after the heal.
  const prevHpRef = useRef<number>(fighter.currentHp);
  useEffect(() => {
    const prev = prevHpRef.current;
    if (fighter.currentHp > prev) {
      // HP increased — immediately clear scent state and class.
      setShowScentWave(false);
      prevScentRef.current = false;
      scentSuppressRef.current = true;
      if (scentSuppressTimer.current) clearTimeout(scentSuppressTimer.current);
      scentSuppressTimer.current = setTimeout(() => {
        scentSuppressRef.current = false;
        scentSuppressTimer.current = null;
      }, 800);
    }
    prevHpRef.current = fighter.currentHp;
    return undefined;
  }, [fighter.currentHp]);

  useEffect(() => {
    return () => {
      if (scentSuppressTimer.current) clearTimeout(scentSuppressTimer.current);
    };
  }, []);

  /* ── Soul Devourer lifesteal: same style as Floral Fragrance (wave + border + accents + heal text), black/purple; show 3s when key+amount appear ── */
  const [showSoulDevourerHeal, setShowSoulDevourerHeal] = useState(false);
  const [soulDevourerHealDisplayAmount, setSoulDevourerHealDisplayAmount] = useState(0);
  const prevSoulDevourerHealKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!soulDevourerHealKey || soulDevourerHealAmount <= 0) return;
    if (prevSoulDevourerHealKeyRef.current === soulDevourerHealKey) return;
    prevSoulDevourerHealKeyRef.current = soulDevourerHealKey;
    setSoulDevourerHealDisplayAmount(soulDevourerHealAmount);
    setShowSoulDevourerHeal(true);
    const t = setTimeout(() => {
      setShowSoulDevourerHeal(false);
      setSoulDevourerHealDisplayAmount(0);
    }, 3000);
    return () => clearTimeout(t);
  }, [soulDevourerHealKey, soulDevourerHealAmount]);

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
    if (battleLive && (isHitActive || isShockHitActive || isThunderboltActive)) {
      setShowEliminated(false); // hide eliminated while damage effects play
    } else {
      setShowEliminated(true);  // show immediately when battle ended
    }
  }, [isEliminated, isHitActive, isShockHitActive, isThunderboltActive, battleLive]);

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

  const hpPct = Math.min((fighter.currentHp / fighter.maxHp) * 100, 100);
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
    battleLive && isThunderboltActive && 'mchip--thunderbolt',
    battleLive && isShocked && 'mchip--shocked',
    battleLive && isPetalShielded && 'mchip--petal-shielded',
    battleLive && hasPomegranateEffect && 'mchip--pomegranate',
    battleLive && isSpiritForm && 'mchip--spirit-form',
    battleLive && isShadowCamouflaged && 'mchip--shadow-camouflaged',
    battleLive && hasSoulDevourer && 'mchip--soul-devourer',
    battleLive && hasDeathKeeper && 'mchip--death-keeper',
    battleLive && showResurrecting && 'mchip--resurrecting',
    battleLive && showResFlash && 'mchip--res-flash',
    battleLive && showResGlow && 'mchip--res-glow',
    battleLive && isResurrected && 'mchip--resurrected',
    battleLive && showScentWave && 'mchip--scent-waved',
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
      style={{ '--chip-primary': fighter.theme[0], '--chip-accent': fighter.theme[1] } as React.CSSProperties}
      onClick={isTargetable && !isEliminated && onSelect ? onSelect : undefined}
      role={isTargetable && !isEliminated ? 'button' : undefined}
    >
      {/* Falling petal/leaf particles — clipped by overflow:hidden wrapper */}
      {isPetalShielded && battleLive && <div className="mchip__petal-fall" aria-hidden="true" />}

      {/* Soul Devourer — souls from every edge/corner inhaled to center (black, purple, white) */}
      {hasSoulDevourer && battleLive && (
        <div className="mchip__soul-float" aria-hidden="true">
          {['tl', 'tr', 'br', 'bl', 't', 'r', 'b', 'l'].map((d) => (
            <span key={d} className={`mchip__soul-layer mchip__soul-layer--${d}`} />
          ))}
        </div>
      )}

      {/* Scent Wave — falling flower/leaf particles for Floral Scented buff */}
      {showScentWave && battleLive && <div className="mchip__scent-wave" aria-hidden="true" />}

      {/* Soul Devourer lifesteal — same layout as Floral: wave (particles) only here; border + accents + text inside frame below */}
      {battleLive && showSoulDevourerHeal && soulDevourerHealDisplayAmount > 0 && (
        <div className="mchip__soul-devourer-wave" aria-hidden="true" />
      )}

      {/* Falling white light motes — like sunlight through leaves */}
      {isPetalShielded && battleLive && (
        <div className="mchip__dryad-lights" aria-hidden="true">
          {Array.from({ length: 15 }, (_, i) => (
            <span key={i} className="mchip__dryad-light" />
          ))}
        </div>
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

      {/* Card frame — outside body so it's not masked */}
      <div className="mchip__frame" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
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
            {/* Shocked effect — electric sparks around frame */}
            {isShocked && <div className="mchip__shock-sparks" aria-hidden="true" />}

            {/* Soul Devourer — frame-only effect (separate from soul-float): soft soul overlay inside frame */}
            {hasSoulDevourer && <div className="mchip__soul-frame" aria-hidden="true" />}

            {/* Petal leaf accents — green spots around frame edge */}
            {isPetalShielded && <div className="mchip__petal-accents" aria-hidden="true" />}

            {/* Scent Wave border + accents (separate divs) + heal boost floating text */}
            {showScentWave && (
              <>
                <div className="mchip__scent-border" aria-hidden="true" />
                <div className="mchip__scent-accents" aria-hidden="true" />
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
              {fighter.currentHp}/{fighter.maxHp}
            </span>
          </div>
        </div>
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
                const transientHit = exitingHitMap[minion.characterId] || Boolean((minion as any).__isHit) || !!minionHitActiveById[minion.characterId];
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
