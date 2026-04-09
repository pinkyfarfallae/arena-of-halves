/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback, useRef, startTransition, use } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation, Link as NavigatedLink } from 'react-router-dom';
import { ref, update, remove } from 'firebase/database';
import { db, firestore } from '../../firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { getPowers } from '../../data/powers';
import { POWER_OVERRIDES } from '../CharacterInfo/constants/overrides';
import { EFFECT_TAGS, isSeasonTag, SEASON_TAG_PREFIX } from '../../constants/effectTags';
import { POWER_NAMES } from '../../constants/powers';
import { TARGET_TYPES, MOD_STAT } from '../../constants/effectTypes';
import {
  ARENA_PATH,
  ARENA_ROLE,
  effectivePomCoAttackerId,
  effectivePomCoDefenderId,
  isPomegranateCoAttackDicePhase,
  isPomegranateCoDefendDicePhase,
  PANEL_SIDE,
  PHASE,
  ROOM_STATUS,
  TURN_ACTION,
  TurnAction,
  type ArenaRole,
  type PanelSide,
} from '../../constants/battle';
import { COPY_TYPE, type CopyType } from '../../constants/lobby';
import {
  onRoomChange,
  joinRoom,
  inviteReservationsFromFirebase,
  joinAsViewer,
  leaveViewer,
  deleteRoom,
  toFighterState,
  startBattle,
  selectTarget,
  selectKeraunosTier2Batch,
  selectAction,
  selectSeason,
  confirmSeason,
  cancelSeasonSelection,
  confirmPoem,
  cancelPoemSelection,
  cancelTargetSelection,
  submitAttackRoll,
  submitDefendRoll,
  submitRapidFireD4Roll,
  advanceToNextRapidFireStep,
  resolveTurn,
  normalizeFighter,
  teamMembersFromFirebase,
  skipTurnNoValidTarget,
  selectTargetDisoriented,
  advanceAfterFloralHealSkippedAck,
  advanceAfterSoulDevourerHealSkippedAck,
  advanceAfterPomegranateCoSkippedAck,
  advanceAfterRapidFireSkippedAck,
  advanceAfterSpringHealSkippedAck,
  advanceAfterResurrection,
  advanceToPomegranateCoAttackPhase,
  applyNpcResolvingCritIfPending,
  updateTodayWishesForRoom,
} from '../../services/battleRoom/battleRoom';
import { FIRESTORE_COLLECTIONS } from '../../constants/fireStoreCollections';
import { savePracticeProgress } from '../../services/training/dailyTrainingDice';
import type { BattleRoom, FighterState } from '../../types/battle';
import { type SeasonKey } from '../../data/seasons';
import BattleHUD from './components/BattleHUD/BattleHUD';
import TeamPanel from './components/TeamPanel/TeamPanel';
import SeasonalEffects from './components/SeasonalEffects/SeasonalEffects';
import ChevronLeft from '../../icons/ChevronLeft';
import BattleLogModal from '../Lobby/components/BattleLogModal/BattleLogModal';
import Copy from './icons/Copy';
import Link from './icons/Link';
import CheckIcon from './icons/Check';
import Eye from '../../icons/Eye';
import { CHARACTER } from '../../constants/characters';
import { fetchNPCs } from '../../data/npcs';
import { getDiceSize } from '../../utils/getDiceSize';
import { PRACTICE_STATES } from '../../constants/practice';
import { fetchTodayIrisWish } from '../../data/wishes';
import { getTodayDate } from '../../utils/date';
import { useDailyTrigger } from '../../hooks/useDailyTrigger';
import BeyondTodayPracticeModal from './components/BeyondTodayPracticeModal/BeyondTodayPracticeModal';
import { DEITY } from '../../constants/deities';
import './Arena.scss';

/**
 * NPC auto-defend after human attack: phase flips to ROLLING_DEFEND as soon as attack is submitted,
 * but the attack D12 + read delay in BattleHUD is ~2.3s anim + 2s PLAYER_ROLL_RESULT_VIEW_MS — scheduling
 * defend at 1200ms made resolution start before the attack “finished” on screen.
 */
const NPC_AUTO_DEFEND_DELAY_MS = 5400;

/* ── Build gradient background from all members' theme colors ── */
function buildHalfStyle(
  members: FighterState[],
  otherMembers: FighterState[],
  side: PanelSide,
): React.CSSProperties {
  const primaries = members.map((m) => m.theme[0]);
  const otherPrimaries = otherMembers.map((m) => m.theme[0]);

  // Same-theme detection: all primaries match across both sides
  const allSame =
    primaries.length > 0 &&
    otherPrimaries.length > 0 &&
    primaries.every((c) => otherPrimaries.includes(c)) &&
    otherPrimaries.every((c) => primaries.includes(c));

  const opacity = allSame ? (side === PANEL_SIDE.LEFT ? 18 : 8) : 14;

  const stops = primaries.map(
    (c) => `color-mix(in srgb, ${c} ${opacity}%, transparent)`,
  );

  const bg =
    stops.length === 1
      ? stops[0]
      : `linear-gradient(to bottom, ${stops.join(', ')})`;

  return { background: bg } as React.CSSProperties;
}

export interface ArenaDemoProps {
  /** When true, Arena runs in demo mode: no Firebase, field-only, uses demoRoom/demoSeason. */
  isDemo?: boolean;
  /** Room to display in demo mode (required when isDemo is true). */
  demoRoom?: BattleRoom | null;
  /** Season to show in demo (e.g. for SeasonalEffects preview). */
  demoSeason?: SeasonKey | null;
  /** When true, Arena is for Practice mode. */
  isPractice?: boolean;
}

function Arena(props?: ArenaDemoProps) {
  const { isDemo = false, demoRoom = null, demoSeason = null, isPractice = false } = props ?? {};
  const { arenaId } = useParams<{ arenaId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const watchOnly = searchParams.get('watch') === 'true';
  const { user } = useAuth();
  const navigate = useNavigate();

  const [beyondTodayPractice, setBeyondTodayPractice] = useState(false);

  useDailyTrigger(() => {
    if (!arenaId) return;
    if (isPractice) {
      setBeyondTodayPractice(true);
    } else if (!isDemo) {
      updateTodayWishesForRoom(arenaId);
    }
  });

  /** Suppress hit visuals briefly when user clicks Back from target modal (no opposite frame shake) */
  const [suppressHitAfterBack, setSuppressHitAfterBack] = useState(false);
  const suppressHitAfterBackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [room, setRoom] = useState<BattleRoom | null>(null);

  const effectiveRoom = isDemo ? (demoRoom ?? null) : room;
  const isPracticeRoom = !!effectiveRoom?.practiceMode || location.pathname.startsWith('/training-grounds/pvp/');

  const [role, setRole] = useState<ArenaRole | null>(null);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<CopyType | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [resolveShown, setResolveShown] = useState(false);
  const [stuckContinueVisible, setStuckContinueVisible] = useState(false);
  const stuckContinueClickRef = useRef<(() => void) | null>(null);

  const onStuckContinueVisibleChange = useCallback((visible: boolean) => {
    setStuckContinueVisible(visible);
  }, []);

  const [transientEffectsActive, setTransientEffectsActive] = useState(false);

  /** True 2s after RESOLVING with Soul Devourer drain (when soul lands on caster) so heal shows */
  const [soulDevourerHealReady, setSoulDevourerHealReady] = useState(false);

  /** Soul float VFX: true 0.5s–2s into RESOLVING with Soul Devourer drain (soul flies defender → caster) */
  const [soulFloatActive, setSoulFloatActive] = useState(false);

  /** Center of caster's mchip__frame (viewport px) so soul lands on caster chip */
  const [casterFrameCenter, setCasterFrameCenter] = useState<{ x: number; y: number } | null>(null);

  /** Center of defender's mchip__frame (viewport px) so soul starts from target chip */
  const [defenderFrameCenter, setDefenderFrameCenter] = useState<{ x: number; y: number } | null>(null);

  /** Volley Arrow extra shot: amber/gold arrow VFX from caster to defender */
  const [volleyArrowHitActive, setVolleyArrowHitActive] = useState(false);
  const [volleyArrowCasterPos, setVolleyArrowCasterPos] = useState<{ x: number; y: number } | null>(null);
  const [volleyArrowDefenderPos, setVolleyArrowDefenderPos] = useState<{ x: number; y: number } | null>(null);
  const casterFrameRef = useRef<HTMLDivElement | null>(null);
  const defenderFrameRef = useRef<HTMLDivElement | null>(null);
  const [minionPulseMap, setMinionPulseMap] = useState<Record<string, number>>({});
  const minionPulseCounterRef = useRef(0);

  /** Skeleton card + hit target in one state so they paint together (same as player hit) */
  const [transientSkeletonCard, setTransientSkeletonCard] = useState<Record<string, unknown> | null>(null);
  const [transientSkeletonCardKey, setTransientSkeletonCardKey] = useState('');
  const [currentSkeletonHitTargetId, setCurrentSkeletonHitTargetId] = useState<string | null>(null);
  const skeletonPulseKeyRef = useRef(0);
  const [currentSkeletonPulseKey, setCurrentSkeletonPulseKey] = useState(0);

  /** True while pomegranate co-resolve card is showing (from BattleHUD) — allows transient hit effects even after phase changes */
  const [pomegranateCoResolveActive, setPomegranateCoResolveActive] = useState(false);

  // Local visual override: NPC schedules a target, or human selects ally for Floral Fragrance (show heal effect immediately)
  const [npcVisualTarget, setNpcVisualTarget] = useState<string | null>(null);
  const [npcVisualPowerName, setNpcVisualPowerName] = useState<string | null>(null);
  const floralVisualTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track active season from Ephemeral Season power (displayed for 2 turns)
  const [activeSeason, setActiveSeason] = useState<SeasonKey | null>(null);
  const [returnFromSeason, setReturnFromSeason] = useState(false);

  /** After cancel target (Back from target selection), open action modal on power list instead of Attack/Use power. */
  const [returnFromTargetCancel, setReturnFromTargetCancel] = useState(false);

  /** Set when user confirms a power in the action modal (action === POWER). Cleared when turn/phase changes. */
  const [lastConfirmedPowerName, setLastConfirmedPowerName] = useState<string | null>(null);
  /** Set when Floral Heal D4 result card is shown (so TeamPanel can show healing VFX in sync). Cleared when leaving ROLLING_FLORAL_HEAL. */
  const [floralHealResultCardVisible, setFloralHealResultCardVisible] = useState(false);

  /** Ref to track if volley main attack arrow has been shown, so we can show extra arrow for co-attack if needed. Resets on turn change. */
  const volleyMainArrowShownRef = useRef(false);

  /** Pomegranate Oath (and similar): attacker id while phase stays SELECT_ACTION — clear local confirm when turn advances. */
  const prevSelectActionAttackerIdRef = useRef<string | null>(null);
  const npcPhaseRef = useRef<string | null>(null);
  const npcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Spreadsheet NPC ids — auto-play applies to these fighters on either team (not "team B only"). */
  const [npcCharacterIdSet, setNpcCharacterIdSet] = useState<Set<string>>(new Set());

  /** Zeus and Poseidon buff - separate for attack and defend */
  const [originalAttackRollBeforeBuff, setOriginalAttackRollBeforeBuff] = useState<number | null>(null);
  const [originalDefendRollBeforeBuff, setOriginalDefendRollBeforeBuff] = useState<number | null>(null);
  /** Pomegranate co-attack original roll (before Zeus/Poseidon buff) */
  const [originalCoAttackRollBeforeBuff, setOriginalCoAttackRollBeforeBuff] = useState<number | null>(null);
  /** Pomegranate co-defend original roll (before Zeus/Poseidon buff) */
  const [originalCoDefendRollBeforeBuff, setOriginalCoDefendRollBeforeBuff] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchNPCs()
      .then((npcs) => {
        if (cancelled) return;
        setNpcCharacterIdSet(new Set(npcs.map((n) => n.characterId.toLowerCase())));
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSkeletonCardShow = useCallback((payload: { cardData: Record<string, unknown>; key: string; hitTargetId: string }) => {
    setTransientSkeletonCard(payload.cardData);
    setTransientSkeletonCardKey(payload.key);
    const hitId = payload.hitTargetId?.trim() || null;
    if (hitId) {
      skeletonPulseKeyRef.current += 1;
      setCurrentSkeletonHitTargetId(hitId);
      setCurrentSkeletonPulseKey(skeletonPulseKeyRef.current);
    } else {
      setCurrentSkeletonHitTargetId(null);
    }
  }, []);
  const onSkeletonCardClear = useCallback(() => {
    setTransientSkeletonCard(null);
    setTransientSkeletonCardKey('');
    setCurrentSkeletonHitTargetId(null);
  }, []);
  const onSkeletonCardTarget = useCallback((hitTargetId: string | null) => {
    if (hitTargetId == null) setCurrentSkeletonHitTargetId(null);
  }, []);
  // Clear hit-pulse state when leaving RESOLVING — but not while skeleton cards are still playing (same as player hit: don't let phase cut VFX)
  const prevPhaseRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const phase = room?.battle?.turn?.phase;
    if (prevPhaseRef.current === PHASE.RESOLVING && phase !== PHASE.RESOLVING) {
      if (!transientEffectsActive) {
        setMinionPulseMap({});
        setTransientSkeletonCard(null);
        setTransientSkeletonCardKey('');
        setCurrentSkeletonHitTargetId(null);
      }
    }
    prevPhaseRef.current = phase;
  }, [room?.battle?.turn?.phase, transientEffectsActive]);

  // Debug log: deps array must have fixed length so it doesn't change between renders (e.g. before/after user loads).
  const phase = room?.battle?.turn?.phase;
  const characterId = user?.characterId ?? null;

  useEffect(() => {
    const isLocal = window.location.hostname === 'localhost';
    const isRosabella = characterId === CHARACTER.ROSABELLA;
    if (isLocal && isRosabella) {
      console.log({ phase, turn });
    }
  }, [phase, transientSkeletonCard, characterId, room?.battle?.turn]);

  useEffect(() => {
    const isLocal = window.location.hostname === 'localhost';
    const isRosabella = characterId === CHARACTER.ROSABELLA;
    if (isLocal && isRosabella) {
      // console.log({ teamAMembers, teamBMembers });
    }
  }, [phase, transientSkeletonCard, characterId]);

  // Clear pulse map and skeleton card when skeleton chain ends
  const prevTransientRef = useRef(false);
  useEffect(() => {
    if (prevTransientRef.current && !transientEffectsActive) {
      setMinionPulseMap({});
      setTransientSkeletonCard(null);
      setTransientSkeletonCardKey('');
      setCurrentSkeletonHitTargetId(null);
    }
    prevTransientRef.current = transientEffectsActive;
  }, [transientEffectsActive]);

  // Reset Soul Devourer heal-ready and soul float when turn or phase changes
  useEffect(() => {
    setSoulDevourerHealReady(false);
    setSoulFloatActive(false);
    setCasterFrameCenter(null);
    setDefenderFrameCenter(null);
  }, [room?.battle?.turn?.phase, room?.battle?.turn?.attackerId]);

  // When soul float starts, measure defender and caster frame centers (viewport px)
  useEffect(() => {
    if (!soulFloatActive) {
      setCasterFrameCenter(null);
      setDefenderFrameCenter(null);
      return;
    }
    const id = requestAnimationFrame(() => {
      const casterEl = casterFrameRef.current;
      const defenderEl = defenderFrameRef.current;
      if (casterEl) {
        const r = casterEl.getBoundingClientRect();
        setCasterFrameCenter({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }
      if (defenderEl) {
        const r = defenderEl.getBoundingClientRect();
        setDefenderFrameCenter({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [soulFloatActive]);

  // Soul Devourer: start soul float 0.5s into RESOLVING (after hit); float 2.8s + explode 0.5s, hide at 3.8s then heal shows
  const soulDrainTurn = room?.battle?.turn;
  const soulDevourerDrainFlag = !!(soulDrainTurn as { soulDevourerDrain?: boolean })?.soulDevourerDrain;
  useEffect(() => {
    if (soulDrainTurn?.phase !== PHASE.RESOLVING || !soulDevourerDrainFlag) {
      setSoulFloatActive(false);
      return;
    }
    const tStart = setTimeout(() => setSoulFloatActive(true), 500);
    const tEnd = setTimeout(() => setSoulFloatActive(false), 3800); // 0.5s delay + 2.8s float + 0.5s explode
    return () => {
      clearTimeout(tStart);
      clearTimeout(tEnd);
    };
  }, [soulDrainTurn?.phase, soulDevourerDrainFlag]);

  // Volley Arrow: show amber/gold arrow (1) main hit — when resolve is shown and caster used Volley Arrow or has Rapid Fire (round 2/3); (2) each extra shot
  const turn = room?.battle?.turn;
  const activeEffects = room?.battle?.activeEffects ?? [];
  const attackerHasRapidFire = !!(turn?.attackerId && (activeEffects as { targetId?: string; tag?: string; turnsRemaining?: number }[]).some(
    (e) => e.targetId === turn?.attackerId && e.tag === EFFECT_TAGS.RAPID_FIRE && (e.turnsRemaining == null || e.turnsRemaining > 0),
  ));
  const rapidFireStep = (turn as { rapidFireStep?: number })?.rapidFireStep;
  useEffect(() => {
    if (turn?.phase !== PHASE.RESOLVING || (turn?.usedPowerName !== POWER_NAMES.VOLLEY_ARROW && !attackerHasRapidFire)) {
      volleyMainArrowShownRef.current = false;
    }
  }, [turn?.phase, turn?.usedPowerName, attackerHasRapidFire]);
  useEffect(() => {
    const isExtraShot = turn?.phase === PHASE.RESOLVING_RAPID_FIRE_EXTRA_SHOT;
    const isMainVolleyResolveShown = turn?.phase === PHASE.RESOLVING && (turn?.usedPowerName === POWER_NAMES.VOLLEY_ARROW || attackerHasRapidFire) && resolveShown && !volleyMainArrowShownRef.current;
    if (isExtraShot) {
      setVolleyArrowHitActive(true);
      const t = setTimeout(() => {
        setVolleyArrowHitActive(false);
        setVolleyArrowCasterPos(null);
        setVolleyArrowDefenderPos(null);
        /* Turn advance: BattleHUD DamageCard onDisplayComplete → onRapidFireDamageCardComplete → advanceToNextRapidFireStep */
      }, 1850); /* arrow 0.72s + impact 0.8s + buffer */
      return () => clearTimeout(t);
    }
    if (isMainVolleyResolveShown) {
      volleyMainArrowShownRef.current = true;
      setVolleyArrowHitActive(true);
      const t = setTimeout(() => {
        setVolleyArrowHitActive(false);
        setVolleyArrowCasterPos(null);
        setVolleyArrowDefenderPos(null);
      }, 1850); /* arrow 0.72s + impact 0.8s + buffer */
      return () => clearTimeout(t);
    }
    if (!isExtraShot) {
      setVolleyArrowHitActive(false);
      setVolleyArrowCasterPos(null);
      setVolleyArrowDefenderPos(null);
    }
    return undefined;
  }, [turn?.phase, turn?.usedPowerName, resolveShown, rapidFireStep, arenaId, attackerHasRapidFire]);
  useEffect(() => {
    if (!volleyArrowHitActive) return;
    const measure = () => {
      const casterEl = casterFrameRef.current;
      const defenderEl = defenderFrameRef.current;
      if (casterEl) {
        const r = casterEl.getBoundingClientRect();
        setVolleyArrowCasterPos({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }
      if (defenderEl) {
        const r = defenderEl.getBoundingClientRect();
        setVolleyArrowDefenderPos({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }
    };
    const t = setTimeout(measure, 80);
    const id = requestAnimationFrame(measure);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(id);
    };
  }, [volleyArrowHitActive]);

  /* ── Handlers (must be before any early return for rules-of-hooks) ── */
  const handleStartBattle = useCallback(async () => {
    if (!arenaId) return;
    await startBattle(arenaId);
  }, [arenaId]);

  const handleSelectTarget = useCallback(async (defenderId: string) => {
    if (arenaId) await selectTarget(arenaId, defenderId);
  }, [arenaId]);

  const handleSelectKeraunosTier2Batch = useCallback(
    async (defenderIds: string[]) => {
      if (arenaId) await selectKeraunosTier2Batch(arenaId, defenderIds);
    },
    [arenaId],
  );

  const handleSelectAction = useCallback(async (action: TurnAction, powerName?: string, allyTargetId?: string) => {
    setReturnFromSeason(false);
    setReturnFromTargetCancel(false);
    if (action === TURN_ACTION.POWER && powerName) {
      setLastConfirmedPowerName(powerName);
    } else {
      setLastConfirmedPowerName(null);
    }
    let powerIndex: number | undefined;
    if (action === TURN_ACTION.POWER && powerName && room?.battle?.turn?.attackerId) {
      const allMembers = [...(room.teamA?.members ?? []), ...(room.teamB?.members ?? [])];
      const attacker = allMembers.find((m) => m.characterId === room.battle!.turn!.attackerId);
      powerIndex = attacker?.powers?.findIndex((p) => p.name === powerName) ?? -1;
      if (powerIndex < 0) powerIndex = undefined;
    }
    if (arenaId) await selectAction(arenaId, action, powerIndex, allyTargetId);
  }, [arenaId, room]);

  const handleClose = useCallback(async () => {
    if (!arenaId || !room) return;
    // Allow closing practice rooms in CONFIGURING or WAITING status
    if (room.practiceMode &&
      room.status !== ROOM_STATUS.CONFIGURING &&
      room.status !== ROOM_STATUS.WAITING) {
      return;
    }

    // Clean up practice quota and Firestore progress before deleting room
    if (room.practiceMode && user?.characterId) {
      const todayDate = getTodayDate();
      try {
        // Delete quota from Realtime Database
        const quotaPath = `trainingQuotas/${user.characterId}/${todayDate}`;
        await remove(ref(db, quotaPath));

        // Delete practice progress from Firestore
        const progressDocId = `${user.characterId}_${todayDate}`;
        const progressRef = doc(firestore, FIRESTORE_COLLECTIONS.USER_DAILY_PROGRESS, progressDocId);
        await deleteDoc(progressRef);
      } catch (err) {
        // Continue with room deletion even if cleanup fails
      }
    }

    await deleteRoom(arenaId);
    if (user?.characterId) {
      try {
        localStorage.removeItem(`training-pvp-session:${user.characterId}`);
      } catch {
        // Ignore storage failures.
      }
    }
    if (isPracticeRoom) {
      navigate('/training-grounds');
    } else {
      navigate('/arena');
    }
  }, [arenaId, room, navigate, user?.characterId, isPracticeRoom]);

  const runAsync = useCallback((fn: () => void | Promise<void>) => {
    setTimeout(() => { fn(); }, 0);
  }, []);

  const handleSelectAllyTarget = useCallback((allyId: string) => {
    const turn = room?.battle?.turn;
    if (!arenaId || !turn) return;
    let powerIdx = turn.usedPowerIndex;
    if (powerIdx == null && turn.usedPowerName && turn.attackerId) {
      const allMembers = [...(room.teamA?.members ?? []), ...(room.teamB?.members ?? [])];
      const attacker = allMembers.find((m) => m.characterId === turn.attackerId);
      const found = attacker?.powers?.findIndex((p) => p.name === turn.usedPowerName) ?? -1;
      if (found >= 0) powerIdx = found;
    }
    if (powerIdx == null) return;
    if (turn.usedPowerName === POWER_NAMES.FLORAL_FRAGRANCE) {
      if (floralVisualTimerRef.current) clearTimeout(floralVisualTimerRef.current);
      setNpcVisualTarget(allyId);
      setNpcVisualPowerName(POWER_NAMES.FLORAL_FRAGRANCE);
      floralVisualTimerRef.current = setTimeout(() => {
        setNpcVisualTarget(null);
        setNpcVisualPowerName(null);
        floralVisualTimerRef.current = null;
      }, 4000);
    }
    runAsync(() => selectAction(arenaId, TURN_ACTION.POWER, powerIdx as number, allyId));
  }, [arenaId, room, runAsync]);

  const onSelectTargetDeferred = useCallback((defenderId: string) => {
    if (effectiveRoom?.practiceMode) {
      void handleSelectTarget(defenderId);
      return;
    }
    runAsync(() => handleSelectTarget(defenderId));
  }, [runAsync, handleSelectTarget, effectiveRoom?.practiceMode]);

  const onSelectKeraunosTier2BatchDeferred = useCallback(
    (defenderIds: string[]) => {
      runAsync(() => handleSelectKeraunosTier2Batch(defenderIds));
    },
    [runAsync, handleSelectKeraunosTier2Batch],
  );

  const onSelectActionDeferred = useCallback((action: TurnAction, powerName?: string, allyTargetId?: string) => {
    if (action === TURN_ACTION.POWER && powerName) {
      setLastConfirmedPowerName(powerName);
      // Show Floral Fragrance healing effect immediately when human selects ally (choose → select target → show)
      if (powerName === POWER_NAMES.FLORAL_FRAGRANCE && allyTargetId) {
        if (floralVisualTimerRef.current) clearTimeout(floralVisualTimerRef.current);
        setNpcVisualTarget(allyTargetId);
        setNpcVisualPowerName(POWER_NAMES.FLORAL_FRAGRANCE);
        floralVisualTimerRef.current = setTimeout(() => {
          setNpcVisualTarget(null);
          setNpcVisualPowerName(null);
          floralVisualTimerRef.current = null;
        }, 3000);
      }
    } else {
      setLastConfirmedPowerName(null);
    }
    if (effectiveRoom?.practiceMode && action === TURN_ACTION.ATTACK && !powerName && !allyTargetId) {
      void handleSelectAction(action, powerName, allyTargetId);
      return;
    }
    runAsync(() => handleSelectAction(action, powerName, allyTargetId));
  }, [runAsync, handleSelectAction, effectiveRoom?.practiceMode]);

  useEffect(() => {
    return () => {
      if (floralVisualTimerRef.current) clearTimeout(floralVisualTimerRef.current);
    };
  }, []);

  /* ── Clear confirmed power name when leaving action/target flow (so next turn shows action modal) ── */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const phase = room?.battle?.turn?.phase;
    if (phase && phase !== PHASE.SELECT_ACTION && phase !== PHASE.SELECT_TARGET) {
      setLastConfirmedPowerName(null);
      setReturnFromTargetCancel(false);
    }
  }, [room?.battle?.turn?.phase]);

  /* ── Death Keeper free action: server goes to SELECT_ACTION without usedPowerName; phase never left SELECT_ACTION so lastConfirmed would block ActionSelectModal ── */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = room?.battle?.turn;
    if (!t || t.phase !== PHASE.SELECT_ACTION) return;
    if (t.resurrectTargetId && t.usedPowerName == null) {
      setLastConfirmedPowerName(null);
    }
  }, [room?.battle?.turn?.phase, room?.battle?.turn?.resurrectTargetId, room?.battle?.turn?.usedPowerName]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = room?.battle?.turn;
    const phase = t?.phase;
    const id = t?.attackerId ?? null;
    if (phase !== PHASE.SELECT_ACTION || id == null) {
      prevSelectActionAttackerIdRef.current = id;
      return;
    }
    if (prevSelectActionAttackerIdRef.current != null && id !== prevSelectActionAttackerIdRef.current) {
      setLastConfirmedPowerName(null);
    }
    prevSelectActionAttackerIdRef.current = id;
  }, [room?.battle?.turn?.phase, room?.battle?.turn?.attackerId]);

  /* ── Clear floral heal result card flag when leaving D4 phase ── */
  useEffect(() => {
    if (room?.battle?.turn?.phase !== PHASE.ROLLING_FLORAL_HEAL) {
      setFloralHealResultCardVisible(false);
    }
  }, [room?.battle?.turn?.phase]);

  /* ── Subscribe to room changes (skip when demo mode) ──────────────── */
  useEffect(() => {
    if (isDemo || !arenaId) return;
    const unsub = onRoomChange(arenaId, (r) => {
      const apply = () => {
        if (!r) {
          setError('Room has been closed.');
          startTransition(() => setRoom(null));
          return;
        }
        startTransition(() => setRoom(r));
      };
      // Defer to next frame so scheduler message handler stays short (avoids violation)
      requestAnimationFrame(apply);
    });
    return unsub;
  }, [arenaId, isDemo]);

  /* ── Determine role & join ──────────────────── */
  const join = useCallback(async () => {
    if (!room || !user || !arenaId || joined) return;

    const myId = user.characterId;
    const idEq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
    const teamAMembers = teamMembersFromFirebase(room.teamA?.members);
    const teamBMembers = teamMembersFromFirebase(room.teamB?.members);

    // Already in team A
    if (teamAMembers.some(m => idEq(m.characterId, myId))) {
      setRole(ARENA_ROLE.TEAM_A);
      setJoined(true);
      return;
    }

    // Already in team B
    if (teamBMembers.some(m => idEq(m.characterId, myId))) {
      setRole(ARENA_ROLE.TEAM_B);
      setJoined(true);
      return;
    }

    const maxA = room.teamA?.maxSize ?? 1;
    const maxB = room.teamB?.maxSize ?? 1;
    const teamAFull = teamAMembers.length >= maxA;
    const teamBFull = teamBMembers.length >= maxB;
    const reserved = inviteReservationsFromFirebase(room.inviteReservations);
    const hasReservedSlot = reserved.some((r) => idEq(r.characterId, myId));

    // Practice rooms: allow room creator (when teamA is empty) or invited opponent to join as fighter
    const isRoomCreatorJoining = room.practiceMode && teamAMembers.length === 0 && !teamAFull;
    const practiceRoomBlocksFighterJoin = !!room.practiceMode && !hasReservedSlot && !isRoomCreatorJoining;

    // CONFIGURING or WAITING: join as fighter if there is open capacity OR this login matches host invite
    const canJoinAsFighter = !watchOnly &&
      (room.status === ROOM_STATUS.CONFIGURING || room.status === ROOM_STATUS.WAITING) &&
      !practiceRoomBlocksFighterJoin &&
      (hasReservedSlot || !teamBFull || !teamAFull);

    if (canJoinAsFighter) {
      try {
        const powerDeity = POWER_OVERRIDES[user.characterId?.toLowerCase()] ?? user.deityBlood;
        const powers = room.practiceMode ? [] : getPowers(powerDeity);
        const wishesOfIris = await fetchTodayIrisWish(user.characterId);
        const fighter = toFighterState(user, powers, wishesOfIris?.deity);
        const result = await joinRoom(arenaId, fighter);
        if (result) {
          const resultA = teamMembersFromFirebase(result.teamA?.members);
          const onA = resultA.some((m) => idEq(m.characterId, myId));
          setRole(onA ? ARENA_ROLE.TEAM_A : ARENA_ROLE.TEAM_B);
          setJoined(true);
        } else {
          // slot taken, become viewer
          await joinAsViewer(arenaId, { characterId: myId, nicknameEng: user.nicknameEng });
          setRole(ARENA_ROLE.VIEWER);
          setJoined(true);
        }
      } catch (err) {
        setError('Failed to join as fighter.');
      }
      return;
    }

    // Watch-only or teams full — join as viewer
    await joinAsViewer(arenaId, { characterId: myId, nicknameEng: user.nicknameEng });
    setRole(ARENA_ROLE.VIEWER);
    setJoined(true);
  }, [room, user, arenaId, joined, watchOnly]);

  /* ── Track active season from Ephemeral Season power ── */
  useEffect(() => {
    if (!room?.battle) {
      setActiveSeason(null);
      ;
      return;
    }

    const { battle } = room;
    const { turn } = battle;

    // During select-season: only the selecting player sees the preview
    if (turn?.selectedSeason && turn?.phase === PHASE.SELECT_SEASON) {
      if (user?.characterId === turn.attackerId) {
        setActiveSeason(turn.selectedSeason as SeasonKey);
      }
      return;
    }

    // After season is confirmed: check activeEffects for any season buff
    // to show effects on both sides for all clients
    const seasonEffect = (battle.activeEffects || []).find(e =>
      isSeasonTag(e.tag ?? ''),
    );
    if (seasonEffect) {
      const seasonName = seasonEffect.tag!.replace(SEASON_TAG_PREFIX, '') as SeasonKey;
      setActiveSeason(seasonName);
      ;
    } else {
      setActiveSeason(null);
      ;
    }
  }, [room, room?.battle?.roundNumber, room?.battle?.turn, room?.battle?.activeEffects, user?.characterId]);

  useEffect(() => {
    join();
  }, [join]);

  /* ── Normal mode: NPC auto-play (disabled when Play Every Fighters by Self) ── */
  useEffect(() => () => { if (npcTimerRef.current) clearTimeout(npcTimerRef.current); }, []);
  useEffect(() => {
    if (!room || !arenaId || !room.testMode) return;
    if (room.devPlayAllFightersSelf) return;
    if (room.devNpcAutoPlay === false) return;
    if (room.status !== ROOM_STATUS.BATTLING || !room.battle?.turn) return;
    if (npcCharacterIdSet.size === 0) return;

    const turn = room.battle.turn;
    const toArr = <T,>(v: T[] | Record<string, T> | undefined): T[] =>
      !v ? [] : Array.isArray(v) ? v : Object.values(v);
    const isNpcId = (id: string | undefined) =>
      !!id && npcCharacterIdSet.has(String(id).toLowerCase());
    const phaseKey = `${turn.phase}:${turn.attackerId}:${turn.defenderId ?? ''}`;

    if (npcPhaseRef.current === phaseKey && npcTimerRef.current !== null) return;
    if (npcTimerRef.current) {
      clearTimeout(npcTimerRef.current);
      npcTimerRef.current = null;
      npcPhaseRef.current = null;
    }
    const schedule = (fn: () => void, delay: number) => {
      npcPhaseRef.current = phaseKey;
      npcTimerRef.current = setTimeout(() => {
        npcPhaseRef.current = null;
        npcTimerRef.current = null;
        fn();
      }, delay);
    };

    if (turn.phase === PHASE.SELECT_ACTION && isNpcId(turn.attackerId)) {
      schedule(() => selectAction(arenaId, TURN_ACTION.ATTACK), 700);
      return;
    }
    if (turn.phase === PHASE.SELECT_TARGET && isNpcId(turn.attackerId)) {
      const battle = room.battle;
      const npcHasDisoriented = !!(turn.attackerId && (battle?.activeEffects || []).some((e: { targetId?: string; tag?: string }) => e.targetId === turn.attackerId && e.tag === EFFECT_TAGS.DISORIENTED));
      if (npcHasDisoriented) {
        schedule(() => { selectTargetDisoriented(arenaId).catch(() => { }); }, 2000);
        return;
      }
      const membersAll = [...toArr(room.teamA?.members), ...toArr(room.teamB?.members)];
      const npcF = membersAll.find((m: any) => m.characterId === turn.attackerId);
      const isAreaAttack = turn.action === TURN_ACTION.POWER && turn.usedPowerIndex != null && (() => {
        const p = npcF?.powers?.[turn.usedPowerIndex!];
        return p?.target === TARGET_TYPES.AREA;
      })();
      const attackerOnTeamA = toArr(room.teamA?.members).some((m: any) => m.characterId === turn.attackerId);
      const enemyTeamMembers = toArr(attackerOnTeamA ? room.teamB?.members : room.teamA?.members);
      const enemiesAlive = enemyTeamMembers.filter((m: any) => m.currentHp > 0);
      const effects = battle?.activeEffects || [];
      const validTargets = enemiesAlive.filter((enemy: any) =>
        !effects.some((e: any) => e.targetId === enemy.characterId && e.modStat === MOD_STAT.SHADOW_CAMOUFLAGED) || isAreaAttack
      );
      if (validTargets.length === 0) {
        schedule(() => skipTurnNoValidTarget(arenaId), 700);
      } else {
        const target = validTargets[Math.floor(Math.random() * validTargets.length)];
        schedule(() => selectTarget(arenaId, target.characterId), 3000);
      }
      return;
    }
    const awaitingPomNpc = !!(turn as { awaitingPomegranateCoAttack?: boolean }).awaitingPomegranateCoAttack;
    const npcMainAtk =
      turn.phase === PHASE.ROLLING_ATTACK && !awaitingPomNpc && isNpcId(turn.attackerId);
    if (npcMainAtk) {
      const membersAll = [...toArr(room.teamA?.members), ...toArr(room.teamB?.members)];
      const atkFighter = membersAll.find((m: any) => m.characterId === turn.attackerId);
      const diceSize = getDiceSize(atkFighter?.wishOfIris);
      const roll = Math.floor(Math.random() * diceSize) + 1;
      schedule(() => submitAttackRoll(arenaId, roll), 1200);
      return;
    }
    const npcMainDef =
      turn.phase === PHASE.ROLLING_DEFEND && !awaitingPomNpc && turn.defenderId && isNpcId(turn.defenderId);

    if (npcMainDef) {
      const membersAll = [...toArr(room.teamA?.members), ...toArr(room.teamB?.members)];
      const defFighter = membersAll.find((m: any) => m.characterId === turn.defenderId);
      const diceSize = getDiceSize(defFighter?.wishOfIris);
      const roll = Math.floor(Math.random() * diceSize) + 1;
      schedule(() => submitDefendRoll(arenaId, roll), NPC_AUTO_DEFEND_DELAY_MS);
      return;
    }
  }, [room, arenaId, npcCharacterIdSet]);

  /* ── PvE: NPC crit D4 in RESOLVING (not covered by NPC timer above; Firebase updates would cancel a shared timer). ── */
  useEffect(() => {
    if (!room?.testMode || room.devPlayAllFightersSelf) return;
    if (room.status !== ROOM_STATUS.BATTLING || !arenaId) return;
    if (npcCharacterIdSet.size === 0) return;
    const turn = room.battle?.turn;
    if (!turn || turn.phase !== PHASE.RESOLVING) return;
    const isNpcId = (id: string | undefined) =>
      !!id && npcCharacterIdSet.has(String(id).toLowerCase());
    const awaitingPom = !!(turn as { awaitingPomegranateCoAttack?: boolean }).awaitingPomegranateCoAttack;
    const pomCoNeedsCrit =
      awaitingPom &&
      isNpcId(effectivePomCoAttackerId(turn)) &&
      turn.coAttackRoll != null &&
      turn.coAttackRoll > 0 &&
      turn.coDefendRoll != null &&
      turn.coDefendRoll >= 1;
    const mainNpcNeedsCrit = isNpcId(turn.attackerId);
    if (!pomCoNeedsCrit && !mainNpcNeedsCrit) return;
    if ((turn.critRoll ?? 0) > 0 || turn.isCrit === true) return;
    const t = window.setTimeout(() => {
      applyNpcResolvingCritIfPending(arenaId, npcCharacterIdSet).catch(() => { });
    }, 1600);
    return () => window.clearTimeout(t);
  }, [
    room?.testMode,
    room?.devPlayAllFightersSelf,
    room?.status,
    room?.battle?.roundNumber,
    room?.battle?.currentTurnIndex,
    room?.battle?.turn?.phase,
    room?.battle?.turn?.attackerId,
    room?.battle?.turn?.defenderId,
    room?.battle?.turn?.attackRoll,
    room?.battle?.turn?.defendRoll,
    room?.battle?.turn?.coAttackRoll,
    room?.battle?.turn?.coDefendRoll,
    room?.battle?.turn?.critRoll,
    room?.battle?.turn?.isCrit,
    room?.battle?.turn?.isDodged,
    (room?.battle?.turn as { dodgeRoll?: number })?.dodgeRoll,
    (room?.battle?.turn as { awaitingPomegranateCoAttack?: boolean })?.awaitingPomegranateCoAttack,
    (room?.battle?.turn as { pomCoAttackerId?: string })?.pomCoAttackerId,
    (room?.battle?.turn as { coAttackerId?: string })?.coAttackerId,
    arenaId,
    npcCharacterIdSet,
  ]);

  /* PvE: auto-ack Pomegranate co-attack skipped (NPC is oath caster) */
  useEffect(() => {
    if (!room?.testMode || room.devPlayAllFightersSelf) return;
    if (room.status !== ROOM_STATUS.BATTLING || !arenaId) return;
    if (npcCharacterIdSet.size === 0) return;
    const turn = room.battle?.turn;
    if (!turn || turn.phase !== PHASE.RESOLVING) return;
    if (!(turn as { pomegranateCoSkippedAwaitsAck?: boolean }).pomegranateCoSkippedAwaitsAck) return;
    const cid = effectivePomCoAttackerId(turn);
    if (!cid || !npcCharacterIdSet.has(String(cid).toLowerCase())) return;
    const timer = window.setTimeout(() => {
      advanceAfterPomegranateCoSkippedAck(arenaId).catch(() => { });
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [
    room?.testMode,
    room?.devPlayAllFightersSelf,
    room?.status,
    room?.battle?.turn,
    arenaId,
    npcCharacterIdSet,
  ]);

  /* PvE: auto-ack Rapid Fire skipped (NPC is attacker) */
  useEffect(() => {
    if (!room?.testMode || room.devPlayAllFightersSelf) return;
    if (room.status !== ROOM_STATUS.BATTLING || !arenaId) return;
    if (npcCharacterIdSet.size === 0) return;
    const turn = room.battle?.turn;
    if (!turn) return;
    if ((turn.phase !== PHASE.RESOLVING && turn.phase !== PHASE.RESOLVING_RAPID_FIRE_EXTRA_SHOT)) return;
    if (!(turn as { rapidFireSkippedAwaitsAck?: boolean }).rapidFireSkippedAwaitsAck) return;
    if (!turn.attackerId || !npcCharacterIdSet.has(String(turn.attackerId).toLowerCase())) return;
    const timer = window.setTimeout(() => {
      advanceAfterRapidFireSkippedAck(arenaId).catch(() => { });
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [
    room?.testMode,
    room?.devPlayAllFightersSelf,
    room?.status,
    room?.battle?.turn,
    arenaId,
    npcCharacterIdSet,
  ]);

  /* PvE: auto-advance to Pomegranate co-attack phase (NPC and Player is co-attacker) */
  useEffect(() => {
    if (!room?.testMode) return;
    if (room.status !== ROOM_STATUS.BATTLING || !arenaId) return;
    if (npcCharacterIdSet.size === 0) return;
    const turn = room.battle?.turn;
    if (!turn || turn.phase !== PHASE.RESOLVING) return;
    const awaitingPom = !!(turn as { awaitingPomegranateCoAttack?: boolean }).awaitingPomegranateCoAttack;
    if (!awaitingPom) return;
    if (turn.coAttackRoll != null && turn.coAttackRoll > 0) return;
    const pomCoAtkId = effectivePomCoAttackerId(turn);
    if (!pomCoAtkId) return;
    const timer = window.setTimeout(() => {
      advanceToPomegranateCoAttackPhase(arenaId).catch(() => { });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [
    room?.testMode,
    room?.devPlayAllFightersSelf,
    room?.status,
    room?.battle?.turn,
    arenaId,
    npcCharacterIdSet,
  ]);

  /* ── Leave viewer on unmount ────────────────── */
  useEffect(() => {
    return () => {
      if (role === ARENA_ROLE.VIEWER && arenaId && user) {
        leaveViewer(arenaId, user.characterId);
      }
    };
  }, [role, arenaId, user]);

  /* ── Clear original rolls when turn changes ────────────────── */
  useEffect(() => {
    setOriginalAttackRollBeforeBuff(null);
    setOriginalDefendRollBeforeBuff(null);
    setOriginalCoDefendRollBeforeBuff(null);
  }, [room?.battle?.turn?.attackerId, room?.battle?.turn?.defenderId, room?.battle?.roundNumber]);

  const handleSkipTurnNoTarget = useCallback(async () => {
    if (arenaId) await skipTurnNoValidTarget(arenaId);
  }, [arenaId]);

  const handleHealSkippedAck = useCallback(async () => {
    if (arenaId) await advanceAfterFloralHealSkippedAck(arenaId);
  }, [arenaId]);

  const handleSoulDevourerHealSkippedAck = useCallback(async () => {
    if (!arenaId) return;
    await advanceAfterSoulDevourerHealSkippedAck(arenaId);
    // Brief delay so resolveTurn's get() sees the cleared flag (avoid race)
    await new Promise((r) => setTimeout(r, 150));
    await resolveTurn(arenaId); // start skeleton resolve
  }, [arenaId]);

  const handlePomegranateCoSkippedAck = useCallback(async () => {
    if (!arenaId) return;
    await advanceAfterPomegranateCoSkippedAck(arenaId);
  }, [arenaId]);

  const handleRapidFireSkippedAck = useCallback(async () => {
    if (!arenaId) return;
    await advanceAfterRapidFireSkippedAck(arenaId);
  }, [arenaId]);

  const handleSpringHealSkippedAck = useCallback(async () => {
    if (arenaId) await advanceAfterSpringHealSkippedAck(arenaId);
  }, [arenaId]);

  const handleResurrectionComplete = useCallback(async () => {
    if (arenaId) await advanceAfterResurrection(arenaId);
  }, [arenaId]);

  const handleSelectTargetDisoriented = useCallback(async () => {
    if (arenaId) await selectTargetDisoriented(arenaId);
  }, [arenaId]);

  const handleAdvancePomegranateCoAttackPhase = useCallback(() => {
    if (arenaId) advanceToPomegranateCoAttackPhase(arenaId).catch(() => { });
  }, [arenaId]);

  /* ── Copy helpers ────────────────────────────── */
  const viewerLink = `${window.location.origin}${window.location.pathname}#/arena/${arenaId}?watch=true`;

  const handleCopy = async (type: CopyType) => {
    const text = type === COPY_TYPE.CODE ? (arenaId || '') : viewerLink;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('clipboard api unavailable');
      }
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        setToast('Could not copy — try HTTPS or copy the text manually');
        setTimeout(() => setToast(null), 3500);
        return;
      }
    }
    setCopied(type);
    setToast(type === COPY_TYPE.CODE ? 'Room code copied!' : 'Viewer link copied!');
    setTimeout(() => { setCopied(null); setToast(null); }, 2000);
  };

  const viewerCount = effectiveRoom?.viewers ? Object.keys(effectiveRoom.viewers).length : 0;
  const teamAMembers = effectiveRoom
    ? teamMembersFromFirebase<FighterState>(
      effectiveRoom.teamA?.members as FighterState[] | Record<string, FighterState> | undefined,
    ).map((m: FighterState) => normalizeFighter(m))
    : [];
  const teamBMembers = effectiveRoom
    ? teamMembersFromFirebase<FighterState>(
      effectiveRoom.teamB?.members as FighterState[] | Record<string, FighterState> | undefined,
    ).map((m: FighterState) => normalizeFighter(m))
    : [];
  const teamALead = teamAMembers[0] ?? null;
  const teamBLead = teamBMembers[0] ?? null;
  const teamBFull = teamBMembers.length >= (effectiveRoom?.teamB?.maxSize ?? 1);
  const isCreator = teamAMembers[0]?.characterId === user?.characterId;
  /** Solo “play all camp”: any logged-in fighter on team A may drive every camp turn (not only devPlayAllHostCharacterId / slot 0 — fixes ally-slot login or host id drift). */
  const userIsOnTeamA = !!(
    user?.characterId &&
    teamAMembers.some((m) => m.characterId.toLowerCase() === user.characterId.toLowerCase())
  );
  const isPlayAllHost = !!(effectiveRoom?.devPlayAllFightersSelf && userIsOnTeamA);
  /** Play-all-fighters: only the configurated host drives; embedded teammates watch like viewers. */
  const playAllNonHostViewer = !!(effectiveRoom?.devPlayAllFightersSelf && !isPlayAllHost);
  const battle = effectiveRoom?.battle;
  /** Play-all-camp only: host controls whichever fighter is acting. */
  const devUiActAsAttacker =
    !!(
      effectiveRoom?.devPlayAllFightersSelf &&
      isPlayAllHost &&
      battle?.turn?.attackerId
    );
  const battleUiMyId = (() => {
    if (!battle?.turn) return user?.characterId;
    const t = battle.turn;
    const uid = user?.characterId;
    const uidLc = uid?.toLowerCase();
    /* Co-attack D12: roller is pomCoAttackerId / coAttackerId (not turn.attackerId spirit bearer). */
    const pomCoAtkUi = effectivePomCoAttackerId(t);
    if (isPomegranateCoAttackDicePhase(t.phase, !!t.awaitingPomegranateCoAttack) && pomCoAtkUi) {
      if (devUiActAsAttacker) return pomCoAtkUi;
      if (uidLc && pomCoAtkUi.toLowerCase() === uidLc) return pomCoAtkUi;
      return uid;
    }
    /* Main defend vs Pomegranate co-defend: pomCoDefenderId / defenderId; separate phase from main ROLLING_DEFEND. */
    const pomCoDefUi = effectivePomCoDefenderId(t);
    if (
      (t.phase === PHASE.ROLLING_DEFEND && !t.awaitingPomegranateCoAttack) ||
      isPomegranateCoDefendDicePhase(t.phase, !!t.awaitingPomegranateCoAttack)
    ) {
      if (pomCoDefUi) {
        if (devUiActAsAttacker) return pomCoDefUi;
        if (uidLc && pomCoDefUi.toLowerCase() === uidLc) return pomCoDefUi;
      }
      return uid;
    }
    if (!devUiActAsAttacker) return uid;
    return t.attackerId ?? uid;
  })();
  const battleHudMyId = playAllNonHostViewer ? undefined : battleUiMyId;
  /** Don't show volley-arrow hit VFX on chips after extra-shot chain ends (RESOLVING_AFTER_RAPID_FIRE) so previous attacker doesn't keep golden pulse. */
  const showVolleyArrowChipVfx = !!volleyArrowHitActive && battle?.turn?.phase !== PHASE.RESOLVING_AFTER_RAPID_FIRE;
  const isBattling = (effectiveRoom?.status === ROOM_STATUS.BATTLING || effectiveRoom?.status === ROOM_STATUS.FINISHED);

  /**
   * Exactly one human client should write NPC sub-phase rolls (crit D4, chain, dodge sim) to Firebase.
   * Previously only `isCreator` (team A slot 0) drove — team-B humans (or non-slot-0) never got `isPlaybackDriver`,
   * so NPC critical checks stuck on "waiting" with no auto-roll.
   */
  const npcAutomationAnchorId = (() => {
    if (!effectiveRoom || !effectiveRoom.testMode || npcCharacterIdSet.size === 0) return null;
    const humans = [...teamAMembers, ...teamBMembers].filter(
      (m) => m?.characterId && !npcCharacterIdSet.has(String(m.characterId).toLowerCase()),
    );
    if (humans.length === 0) return null;
    return [...humans].sort((a, b) =>
      String(a.characterId).localeCompare(String(b.characterId), undefined, { sensitivity: 'base' }),
    )[0].characterId;
  })();

  // Check if user is pomegranate co-attacker (drives phase during co-attack)
  const pomCoAtkId = battle?.turn ? effectivePomCoAttackerId(battle.turn) : undefined;
  const awaitingPom = !!(battle?.turn as any)?.awaitingPomegranateCoAttack;
  const isPomCoAttacker = !!(
    user?.characterId &&
    pomCoAtkId &&
    awaitingPom &&
    user.characterId.toLowerCase() === pomCoAtkId.toLowerCase()
  );

  const isPlaybackDriver = !!(
    effectiveRoom && effectiveRoom.devPlayAllFightersSelf
      ? isPlayAllHost
      : (
        // During pomegranate co-attack in RESOLVING, only the co-attacker drives (not the main attacker)
        (awaitingPom && battle?.turn?.phase === PHASE.RESOLVING)
          ? isPomCoAttacker
          : (
            battle?.turn?.attackerId === user?.characterId ||
            (
              effectiveRoom &&
              effectiveRoom.testMode &&
              !!user?.characterId &&
              role !== ARENA_ROLE.VIEWER &&
              !playAllNonHostViewer &&
              !!battle?.turn?.attackerId &&
              npcCharacterIdSet.size > 0 &&
              npcCharacterIdSet.has(battle.turn.attackerId.toLowerCase()) &&
              npcAutomationAnchorId != null &&
              user.characterId.toLowerCase() === npcAutomationAnchorId.toLowerCase()
            )
          )
      )
  );

  const isAttackerNpc =
    !!(
      effectiveRoom &&
      effectiveRoom.testMode &&
      battle?.turn?.attackerId &&
      npcCharacterIdSet.size > 0 &&
      npcCharacterIdSet.has(battle.turn.attackerId.toLowerCase())
    ) && !effectiveRoom.devPlayAllFightersSelf;
  const isDefenderNpc =
    !!(
      effectiveRoom &&
      effectiveRoom.testMode &&
      battle?.turn?.defenderId &&
      npcCharacterIdSet.size > 0 &&
      npcCharacterIdSet.has(battle.turn.defenderId.toLowerCase())
    ) && !effectiveRoom.devPlayAllFightersSelf;
  const pomCoAtkNpcId = battle?.turn ? effectivePomCoAttackerId(battle.turn) : undefined;
  const isPomCoCasterNpc =
    !!(
      effectiveRoom &&
      effectiveRoom.testMode &&
      pomCoAtkNpcId &&
      npcCharacterIdSet.size > 0 &&
      npcCharacterIdSet.has(pomCoAtkNpcId.toLowerCase())
    ) && !effectiveRoom.devPlayAllFightersSelf;

  // Save practice progress when PvP room is created/joined (CONFIGURING or WAITING)
  useEffect(() => {
    const room = effectiveRoom;
    if (!room?.practiceMode || !arenaId || !user?.characterId) return;
    if (room.status !== ROOM_STATUS.CONFIGURING && room.status !== ROOM_STATUS.WAITING) return;
    if (role == null || role === ARENA_ROLE.VIEWER) return;
    if (!joined) return; // Only save after successfully joining

    const opponent =
      role === ARENA_ROLE.TEAM_A
        ? teamBLead
        : teamALead;

    // Save initial practice record with state: 'waiting' when room is created/joined
    savePracticeProgress({
      userId: user.characterId,
      arenaId,
      roomCode: arenaId,
      role,
      rolls: [0, 0, 0, 0, 0],
      battleRolls: [],
      opponentId: opponent?.characterId,
      opponentName: opponent?.nicknameEng,
      state: PRACTICE_STATES.WAITING,
      rounds: 0,
      winner: false,
    }).catch((err) => {
      // console.error('[Arena] Failed to save PVP WAITING state:', err);
    });
  }, [
    arenaId,
    effectiveRoom?.practiceMode,
    effectiveRoom?.status,
    role,
    joined,
    user?.characterId,
    teamALead?.characterId,
    teamBLead?.characterId,
  ]);

  // Save practice progress when PvP battle starts (not just when it finishes)
  useEffect(() => {
    const room = effectiveRoom;
    if (!room?.practiceMode || !arenaId || !user?.characterId) return;
    if (!room.battle || room.status === ROOM_STATUS.WAITING || room.status === ROOM_STATUS.FINISHED) return;
    if (role == null || role === ARENA_ROLE.VIEWER) return;
    if (!joined) return; // Only save after successfully joining

    const opponent =
      role === ARENA_ROLE.TEAM_A
        ? teamBLead
        : teamALead;

    // Save initial practice record with state: 'live' when battle starts
    savePracticeProgress({
      userId: user.characterId,
      arenaId,
      roomCode: arenaId,
      role,
      rolls: [0, 0, 0, 0, 0],
      battleRolls: [],
      opponentId: opponent?.characterId,
      opponentName: opponent?.nicknameEng,
      state: PRACTICE_STATES.LIVE,
      rounds: 0,
      winner: false,
    }).catch((err) => {
      // console.error('[Arena] Failed to save PVP LIVE state:', err);
    });

    try {
      localStorage.setItem(`training-pvp-session:${user.characterId}`, JSON.stringify({
        arenaId,
        roomCode: arenaId,
        state: PRACTICE_STATES.LIVE,
        date: getTodayDate(),
      }));
    } catch {
      // Ignore storage failures.
    }
  }, [
    arenaId,
    effectiveRoom?.practiceMode,
    effectiveRoom?.battle,
    effectiveRoom?.status,
    role,
    joined,
    user?.characterId,
    teamALead?.characterId,
    teamBLead?.characterId,
  ]);

  // Save practice progress when PvP battle finishes
  useEffect(() => {
    const room = effectiveRoom;
    if (!room?.practiceMode || !arenaId || !user?.characterId) return;
    if (room.status !== ROOM_STATUS.FINISHED) return;
    if (role == null || role === ARENA_ROLE.VIEWER) return;

    const opponent =
      role === ARENA_ROLE.TEAM_A
        ? teamBLead
        : teamALead;
    const practiceBattleRolls = (room.battle?.log ?? []).reduce<number[]>((rolls, entry) => {
      if (typeof entry.attackRoll === 'number') rolls.push(entry.attackRoll);
      if (typeof entry.defendRoll === 'number') rolls.push(entry.defendRoll);
      return rolls;
    }, []);

    const practiceRolls = (() => {
      const rolls = [...practiceBattleRolls.slice(0, 5)];
      while (rolls.length < 5) rolls.push(0);
      return rolls;
    })();

    savePracticeProgress({
      userId: user.characterId,
      arenaId,
      roomCode: arenaId,
      role,
      rolls: practiceRolls,
      battleRolls: practiceBattleRolls,
      opponentId: opponent?.characterId,
      opponentName: opponent?.nicknameEng,
      state: PRACTICE_STATES.FINISHED,
      rounds: room.battle?.roundNumber ?? 0,
      winner: room.battle?.winner === role,
    }).catch((err) => {
      // console.error('[Arena] Failed to save PVP practice result:', err);
      // Still save local state even if sheet submission fails
    });

    try {
      localStorage.setItem(`training-pvp-session:${user.characterId}`, JSON.stringify({
        arenaId,
        roomCode: arenaId,
        state: PRACTICE_STATES.FINISHED,
        date: getTodayDate(),
      }));
    } catch {
      // Ignore storage failures.
    }
  }, [
    arenaId,
    effectiveRoom?.practiceMode,
    effectiveRoom?.status,
    effectiveRoom?.battle?.roundNumber,
    effectiveRoom?.battle?.winner,
    role,
    user?.characterId,
    teamALead?.characterId,
    teamALead?.nicknameEng,
    teamBLead?.characterId,
    teamBLead?.nicknameEng,
  ]);

  /* ── Loading / Error states (skip when demo mode) ─────────────────── */
  if (!isDemo && error) {
    return (
      <div className="arena">
        <div className="arena__state">
          <p className="arena__state-msg">{error}</p>
          <NavigatedLink
            to={isPracticeRoom ? '/training-grounds' : '/arena'}
            className="arena__action-btn arena__action-btn--secondary"
          >
            {isPracticeRoom ? 'Back to Training Grounds' : 'Back to Arena Lobby'}
          </NavigatedLink>
        </div>
      </div>
    );
  }

  if (!effectiveRoom) {
    return (
      <div className="arena">
        <div className="arena__state">
          <div className="arena__state-loader">
            <div className="app-loader__ring" />
          </div>
        </div>
      </div>
    );
  }

  /** Disoriented + player's turn: target must be chosen via modal (Random → Confirm), not by clicking panel. */
  const isDisorientedPlayerTurn = !!(battle?.turn?.phase === PHASE.SELECT_TARGET && battle?.turn?.attackerId === battleHudMyId && battle?.turn?.attackerId && (battle?.activeEffects || []).some((e: { targetId?: string; tag?: string }) => e.targetId === battle?.turn?.attackerId && e.tag === EFFECT_TAGS.DISORIENTED));

  /** In demo mode use demoSeason; otherwise use battle-driven activeSeason. */
  const effectiveSeason = isDemo ? (demoSeason ?? undefined) : (activeSeason ?? undefined);

  /** Which power is selected this turn: from server (battle.turn.usedPowerName) or from last confirm (lastConfirmedPowerName). */
  const selectedPowerName = battle?.turn?.usedPowerName ?? lastConfirmedPowerName;

  const handlePreviewSeason = (season: SeasonKey | null) => {
    if (!isDemo) setActiveSeason(season);
  };

  const handleSelectSeason = async (season: SeasonKey) => {
    if (!arenaId) return;
    await selectSeason(arenaId, season);
    // Short delay so season selection is visible, then confirm (e.g. Spring → heal crit roll)
    setTimeout(async () => {
      await confirmSeason(arenaId);
    }, 200);
  };

  const handleCancelSeason = async () => {
    if (!arenaId) return;
    setActiveSeason(null);
    setReturnFromSeason(true);
    await cancelSeasonSelection(arenaId);
  };

  const handleSelectPoem = async (poemTag: string) => {
    if (!arenaId) return;
    await confirmPoem(arenaId, poemTag);
  };

  const handleCancelPoem = async () => {
    if (!arenaId) return;
    setLastConfirmedPowerName(null); /* so action modal shows again after back to SELECT_ACTION */
    setReturnFromTargetCancel(true); /* they had chosen a power (Imprecated Poem) -> open on power list */
    await cancelPoemSelection(arenaId);
  };

  const handleCancelTarget = async () => {
    setSuppressHitAfterBack(true);
    const hadPowerSelected = !!(room?.battle?.turn?.usedPowerName ?? lastConfirmedPowerName);
    setLastConfirmedPowerName(null); /* so action modal shows again after back to SELECT_ACTION */
    setReturnFromTargetCancel(hadPowerSelected); /* only open on power list if they had confirmed a power; else Attack/Use power */
    if (suppressHitAfterBackTimerRef.current) clearTimeout(suppressHitAfterBackTimerRef.current);
    suppressHitAfterBackTimerRef.current = setTimeout(() => {
      setSuppressHitAfterBack(false);
      suppressHitAfterBackTimerRef.current = null;
    }, 500);
    if (!arenaId) return;
    try { setMinionPulseMap({}); } catch (e) { }
    try {
      await update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE}`), { [ARENA_PATH.BATTLE_LAST_HIT_MINION_ID]: null, [ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID]: null });
    } catch (e) { }
    await cancelTargetSelection(arenaId);
  };

  const handleSubmitAttackRoll = async (roll: number) => {
    if (!arenaId) return;

    const allMembers = [...teamAMembers, ...teamBMembers];
    const turn = battle?.turn;
    
    // Check if this is a Pomegranate co-attack
    const isPomCoAttack = turn && (
      (turn.phase === PHASE.ROLLING_POMEGRANATE_CO_ATTACK) ||
      ((turn as any).awaitingPomegranateCoAttack && turn.phase === PHASE.ROLLING_ATTACK)
    ) && ((turn as any).coAttackRoll == null || (turn as any).coAttackRoll <= 0);
    
    // Get the appropriate attacker (co-attacker for Pomegranate, main attacker otherwise)
    const attackerId = isPomCoAttack ? effectivePomCoAttackerId(turn!) : turn?.attackerId;
    const attacker = allMembers.find((m) => m.characterId === attackerId);
    const attackerTodayWishOfIris = attacker?.wishOfIris;

    if (attackerTodayWishOfIris === DEITY.ZEUS) {
      // Submit modified roll (Zeus: -2, min 1)
      const modifiedRoll = Math.max(1, roll - 2);
      if (isPomCoAttack) {
        setOriginalCoAttackRollBeforeBuff(roll);
      } else {
        setOriginalAttackRollBeforeBuff(roll);
      }
      await submitAttackRoll(arenaId, modifiedRoll);
    } else if (attackerTodayWishOfIris === DEITY.POSEIDON) {
      // Submit boosted roll (Poseidon: min 6)
      const modifiedRoll = Math.max(6, roll);
      if (isPomCoAttack) {
        setOriginalCoAttackRollBeforeBuff(roll);
      } else {
        setOriginalAttackRollBeforeBuff(roll);
      }
      await submitAttackRoll(arenaId, modifiedRoll);
    } else {
      await submitAttackRoll(arenaId, roll);
    }
  };

  const handleSubmitDefendRoll = async (roll: number) => {
    if (!arenaId) return;

    const allMembers = [...teamAMembers, ...teamBMembers];
    const defender = allMembers.find((m) => m.characterId === battle?.turn?.defenderId);
    const defenderTodayWishOfIris = defender?.wishOfIris;
    const awaitingPom = !!(battle?.turn as { awaitingPomegranateCoAttack?: boolean } | undefined)?.awaitingPomegranateCoAttack;
    const isPomCoDefend =
      !!battle?.turn &&
      awaitingPom &&
      (battle.turn.phase === PHASE.ROLLING_POMEGRANATE_CO_DEFEND ||
        (battle.turn.phase === PHASE.ROLLING_DEFEND && battle.turn.coAttackRoll != null && battle.turn.coAttackRoll > 0));

    if (defenderTodayWishOfIris === DEITY.ZEUS) {
      // Submit modified roll (Zeus: -2, min 1)
      const modifiedRoll = Math.max(1, roll - 2);
      if (isPomCoDefend) {
        setOriginalCoDefendRollBeforeBuff(roll);
      } else {
        setOriginalDefendRollBeforeBuff(roll);
      }

      await submitDefendRoll(arenaId, modifiedRoll);
    } else if (defenderTodayWishOfIris === DEITY.POSEIDON) {
      // Submit boosted roll (Poseidon: min 6)
      const modifiedRoll = Math.max(6, roll);
      if (isPomCoDefend) {
        setOriginalCoDefendRollBeforeBuff(roll);
      } else {
        setOriginalDefendRollBeforeBuff(roll);
      }
      await submitDefendRoll(arenaId, modifiedRoll);
    } else {
      await submitDefendRoll(arenaId, roll);
    }
  };

  const handleResolveTurn = async () => {
    if (arenaId) await resolveTurn(arenaId);
  };

  /* ── Demo mode: field only (includes SeasonalEffects), no bar / HUD / actions ── */
  if (isDemo) {
    return (
      <div className="arena arena--demo">
        <div className={`arena__field ${effectiveRoom.status !== ROOM_STATUS.BATTLING ? 'arena__field--finished' : ''}`}>
          <div
            className="arena__half arena__half--left"
            style={teamAMembers.length ? buildHalfStyle(teamAMembers, teamBMembers, PANEL_SIDE.LEFT) : undefined}
          >
            <TeamPanel
              members={teamAMembers}
              allMembers={[...teamAMembers, ...teamBMembers]}
              side={PANEL_SIDE.LEFT}
              battle={battle}
              teamMinions={effectiveRoom.teamA?.minions}
              myId={undefined}
              resolveShown={resolveShown}
              transientEffectsActive={transientEffectsActive}
              soulDevourerHealReady={soulDevourerHealReady}
              casterFrameRef={casterFrameRef}
              defenderFrameRef={defenderFrameRef}
              minionPulseMap={minionPulseMap}
              currentSkeletonHitTargetId={currentSkeletonHitTargetId}
              currentSkeletonPulseKey={currentSkeletonPulseKey}
              clientVisualDefenderId={npcVisualTarget}
              clientVisualPowerName={npcVisualPowerName}
              suppressHitAfterBack={suppressHitAfterBack}
              floralHealResultCardVisible={floralHealResultCardVisible}
              volleyArrowHitActive={volleyArrowHitActive}
              volleyArrowHitDefenderId={showVolleyArrowChipVfx ? battle?.turn?.defenderId : undefined}
              volleyArrowHitAttackerId={showVolleyArrowChipVfx ? battle?.turn?.attackerId : undefined}
              pomegranateCoResolveActive={pomegranateCoResolveActive}
            />
            <SeasonalEffects season={effectiveSeason ?? undefined} side={PANEL_SIDE.LEFT} isActive={!!effectiveSeason && effectiveRoom.status !== ROOM_STATUS.FINISHED} />
          </div>
          <div className="arena__divider">
            <div className="arena__vs-ring">
              <span className="arena__vs">{battle?.roundNumber ? `R${battle.roundNumber}` : 'VS'}</span>
            </div>
          </div>
          <div
            className={`arena__half arena__half--right ${!teamBFull ? 'arena__half--empty' : ''}`}
            style={teamBMembers.length ? buildHalfStyle(teamBMembers, teamAMembers, PANEL_SIDE.RIGHT) : undefined}
          >
            {teamBMembers.length > 0 ? (
              <TeamPanel
                isPracticeRoom={isPracticeRoom}
                members={teamBMembers}
                allMembers={[...teamAMembers, ...teamBMembers]}
                side={PANEL_SIDE.RIGHT}
                battle={battle}
                teamMinions={effectiveRoom.teamB?.minions}
                myId={undefined}
                resolveShown={resolveShown}
                transientEffectsActive={transientEffectsActive}
                soulDevourerHealReady={soulDevourerHealReady}
                casterFrameRef={casterFrameRef}
                defenderFrameRef={defenderFrameRef}
                minionPulseMap={minionPulseMap}
                currentSkeletonHitTargetId={currentSkeletonHitTargetId}
                currentSkeletonPulseKey={currentSkeletonPulseKey}
                clientVisualDefenderId={npcVisualTarget}
                clientVisualPowerName={npcVisualPowerName}
                suppressHitAfterBack={suppressHitAfterBack}
                floralHealResultCardVisible={floralHealResultCardVisible}
                volleyArrowHitActive={volleyArrowHitActive}
                volleyArrowHitDefenderId={showVolleyArrowChipVfx ? battle?.turn?.defenderId : undefined}
                volleyArrowHitAttackerId={showVolleyArrowChipVfx ? battle?.turn?.attackerId : undefined}
                pomegranateCoResolveActive={pomegranateCoResolveActive}
              />
            ) : (
              <div className="arena__empty-slot">
                <span>Awaiting Challenger...</span>
              </div>
            )}
            <SeasonalEffects season={effectiveSeason ?? undefined} side={PANEL_SIDE.RIGHT} isActive={!!effectiveSeason && effectiveRoom.status !== ROOM_STATUS.FINISHED} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="arena">
      {/* ── Toast notification ── */}
      {toast && (
        <div className="arena__toast" key={toast}>
          <CheckIcon /> {toast}
        </div>
      )}

      {/* ── Top bar ── */}
      <header className="arena__bar">
        <NavigatedLink to={isPracticeRoom ? '/training-grounds' : '/arena'} className="arena__bar-back">
          <ChevronLeft width={15} height={15} />
          {isPracticeRoom ? 'Back' : 'Back to Lobby'}
        </NavigatedLink>

        <div className="arena__bar-title">
          <span className="arena__bar-name">
            {effectiveRoom.roomName?.trim() || effectiveRoom.arenaId || arenaId || 'Arena'}
          </span>
        </div>

        <span className="arena__bar-spacer" />

        <div className="arena__bar-meta">
          {(() => {
            const a = effectiveRoom.teamA?.maxSize ?? effectiveRoom.teamSize;
            const b = effectiveRoom.teamB?.maxSize ?? effectiveRoom.teamSize;
            if (Math.max(a, b) <= 1) return null;
            return (
              <span className="arena__bar-badge">{a === b ? `${a}v${a}` : `${a}v${b}`}</span>
            );
          })()}
          {role === ARENA_ROLE.VIEWER && (
            <span className="arena__bar-badge arena__bar-badge--spectator">Spectating</span>
          )}
          {viewerCount > 0 && (
            <span className="arena__bar-viewers">{viewerCount} watching</span>
          )}
        </div>

        {/* {stuckContinueVisible && (
          <button
            type="button"
            className="arena__bar-stuck-continue"
            aria-label="Continue battle"
            onClick={() => stuckContinueClickRef.current?.()}
          >
            Continue battle
          </button>
        )} */}

        {effectiveRoom.status === ROOM_STATUS.FINISHED ? (
          <div className="arena__bar-share">
            <button
              className="arena__share-btn"
              onClick={() => setShowLog(true)}
              data-tooltip="Log"
              data-tooltip-pos="bottom"
            >
              <Eye width={14} height={14} />
            </button>
            <button
              className={`arena__share-btn ${copied === COPY_TYPE.LINK ? 'arena__share-btn--copied' : ''}`}
              onClick={() => handleCopy(COPY_TYPE.LINK)}
              data-tooltip={copied === COPY_TYPE.LINK ? 'Copied!' : 'Copy viewer link'}
              data-tooltip-pos="bottom"
            >
              {copied === COPY_TYPE.LINK ? <CheckIcon /> : <Link />}
            </button>
          </div>
        ) : (
          <div className="arena__bar-share">
            {effectiveRoom.status === ROOM_STATUS.WAITING && (
              <button
                className={`arena__share-btn ${copied === COPY_TYPE.CODE ? 'arena__share-btn--copied' : ''}`}
                onClick={() => handleCopy(COPY_TYPE.CODE)}
                data-tooltip={copied === COPY_TYPE.CODE ? 'Copied!' : 'Copy room code'}
                data-tooltip-pos="bottom"
              >
                {copied === COPY_TYPE.CODE ? <CheckIcon /> : <Copy />}
              </button>
            )}
            <button
              className={`arena__share-btn ${copied === COPY_TYPE.LINK ? 'arena__share-btn--copied' : ''}`}
              onClick={() => handleCopy(COPY_TYPE.LINK)}
              data-tooltip={copied === COPY_TYPE.LINK ? 'Copied!' : 'Copy viewer link'}
              data-tooltip-pos="bottom"
            >
              {copied === COPY_TYPE.LINK ? <CheckIcon /> : <Link />}
            </button>
          </div>
        )}
      </header>

      {/* ── Battle field ── */}
      <div className={`arena__field ${effectiveRoom.status !== ROOM_STATUS.BATTLING ? 'arena__field--finished' : ''}`}>
        {/* Team A */}
        <div
          className="arena__half arena__half--left"
          style={teamAMembers.length ? buildHalfStyle(teamAMembers, teamBMembers, PANEL_SIDE.LEFT) : undefined}
        >
          <TeamPanel
            isPracticeRoom={isPracticeRoom}
            members={teamAMembers}
            allMembers={[...teamAMembers, ...teamBMembers]}
            side={PANEL_SIDE.LEFT}
            battle={battle}
            teamMinions={effectiveRoom.teamA?.minions}
            myId={battleHudMyId}
            resolveShown={resolveShown}
            transientEffectsActive={transientEffectsActive}
            soulDevourerHealReady={soulDevourerHealReady}
            casterFrameRef={casterFrameRef}
            defenderFrameRef={defenderFrameRef}
            minionPulseMap={minionPulseMap}
            currentSkeletonHitTargetId={currentSkeletonHitTargetId}
            currentSkeletonPulseKey={currentSkeletonPulseKey}
            onSelectTarget={playAllNonHostViewer || isDisorientedPlayerTurn ? undefined : onSelectTargetDeferred}
            clientVisualDefenderId={npcVisualTarget}
            clientVisualPowerName={npcVisualPowerName}
            suppressHitAfterBack={suppressHitAfterBack}
            floralHealResultCardVisible={floralHealResultCardVisible}
            volleyArrowHitActive={volleyArrowHitActive}
            volleyArrowHitDefenderId={showVolleyArrowChipVfx ? battle?.turn?.defenderId : undefined}
            volleyArrowHitAttackerId={showVolleyArrowChipVfx ? battle?.turn?.attackerId : undefined}
            pomegranateCoResolveActive={pomegranateCoResolveActive}
          />
          {/* Seasonal effects overlay (left side) */}
          <SeasonalEffects season={activeSeason ?? undefined} side={PANEL_SIDE.LEFT} isActive={!!activeSeason && effectiveRoom.status !== ROOM_STATUS.FINISHED} />
        </div>

        <div className="arena__divider">
          <div className="arena__vs-ring">
            <span className="arena__vs">{battle?.roundNumber ? `R${battle.roundNumber}` : 'VS'}</span>
          </div>
        </div>

        {/* Team B */}
        <div
          className={`arena__half arena__half--right ${!teamBFull ? 'arena__half--empty' : ''}`}
          style={teamBMembers.length ? buildHalfStyle(teamBMembers, teamAMembers, PANEL_SIDE.RIGHT) : undefined}
        >
          {teamBMembers.length > 0 ? (
            <TeamPanel
              isPracticeRoom={isPracticeRoom}
              members={teamBMembers}
              allMembers={[...teamAMembers, ...teamBMembers]}
              side={PANEL_SIDE.RIGHT}
              battle={battle}
              teamMinions={effectiveRoom.teamB?.minions}
              myId={battleHudMyId}
              resolveShown={resolveShown}
              transientEffectsActive={transientEffectsActive}
              soulDevourerHealReady={soulDevourerHealReady}
              casterFrameRef={casterFrameRef}
              defenderFrameRef={defenderFrameRef}
              minionPulseMap={minionPulseMap}
              currentSkeletonHitTargetId={currentSkeletonHitTargetId}
              currentSkeletonPulseKey={currentSkeletonPulseKey}
              onSelectTarget={playAllNonHostViewer || isDisorientedPlayerTurn ? undefined : onSelectTargetDeferred}
              floralHealResultCardVisible={floralHealResultCardVisible}
              clientVisualDefenderId={npcVisualTarget}
              clientVisualPowerName={npcVisualPowerName}
              suppressHitAfterBack={suppressHitAfterBack}
              volleyArrowHitActive={volleyArrowHitActive}
              volleyArrowHitDefenderId={showVolleyArrowChipVfx ? battle?.turn?.defenderId : undefined}
              volleyArrowHitAttackerId={showVolleyArrowChipVfx ? battle?.turn?.attackerId : undefined}
              pomegranateCoResolveActive={pomegranateCoResolveActive}
            />
          ) : (
            <div className="arena__empty-slot">
              <span>Awaiting Challenger...</span>
            </div>
          )}
          {/* Seasonal effects overlay (right side) */}
          <SeasonalEffects season={activeSeason ?? undefined} side={PANEL_SIDE.RIGHT} isActive={!!activeSeason && effectiveRoom.status !== ROOM_STATUS.FINISHED} />
        </div>

        {/* Soul Devourer: soul floats from defender frame center to caster frame center, then explodes */}
        {soulFloatActive && casterFrameCenter && defenderFrameCenter && battle?.turn?.defenderId && battle?.turn?.attackerId && (() => {
          const allMembers = [...teamAMembers, ...teamBMembers];
          const defender = allMembers.find((m) => m.characterId === battle.turn?.defenderId);
          const caster = allMembers.find((m) => m.characterId === battle.turn?.attackerId);
          const defenderPrimary = defender?.theme?.[0] ?? 'rgba(94, 53, 117, 0.9)';
          const casterPrimary = caster?.theme?.[0] ?? 'rgba(94, 53, 117, 0.9)';
          return (
            <div
              className={`arena__soul-float arena__soul-float--${teamAMembers.some((m) => m.characterId === battle.turn?.defenderId) ? 'left-to-right' : 'right-to-left'}`}
              style={
                {
                  '--soul-start-x': `${defenderFrameCenter.x}px`,
                  '--soul-start-y': `${defenderFrameCenter.y}px`,
                  '--soul-end-x': `${casterFrameCenter.x}px`,
                  '--soul-end-y': `${casterFrameCenter.y}px`,
                  '--soul-color-start': defenderPrimary,
                  '--soul-color-end': casterPrimary,
                } as React.CSSProperties
              }
              aria-hidden
            >
              <div className="arena__soul-float-orb">
                <div className="arena__soul-float-orb-base" aria-hidden />
                <div className="arena__soul-float-orb-blend" aria-hidden />
              </div>
              <div className="arena__soul-float-burst" />
            </div>
          );
        })()}

        {/* Volley Arrow extra shot: thin arched gold arrow (CSS) from caster to defender */}
        {volleyArrowHitActive && volleyArrowCasterPos && volleyArrowDefenderPos && turn?.attackerId && turn?.defenderId && (() => {
          const dx = volleyArrowDefenderPos.x - volleyArrowCasterPos.x;
          const dy = volleyArrowDefenderPos.y - volleyArrowCasterPos.y;
          const angleRad = Math.atan2(dy, dx);
          const angleDeg = (angleRad * 180) / Math.PI;
          const midX = (volleyArrowCasterPos.x + volleyArrowDefenderPos.x) / 2;
          const midY = (volleyArrowCasterPos.y + volleyArrowDefenderPos.y) / 2;
          const arrowHalfLen = 50;
          const tipHitX = volleyArrowDefenderPos.x - arrowHalfLen * Math.cos(angleRad);
          const tipHitY = volleyArrowDefenderPos.y - arrowHalfLen * Math.sin(angleRad);
          return (
            <div
              className="arena__volley-arrow-hit"
              style={
                {
                  '--volley-arrow-start-x': `${volleyArrowCasterPos.x}px`,
                  '--volley-arrow-start-y': `${volleyArrowCasterPos.y}px`,
                  '--volley-arrow-mid-x': `${midX}px`,
                  '--volley-arrow-mid-y': `${midY}px`,
                  '--volley-arrow-end-x': `${volleyArrowDefenderPos.x}px`,
                  '--volley-arrow-end-y': `${volleyArrowDefenderPos.y}px`,
                  '--volley-arrow-tip-hit-x': `${tipHitX}px`,
                  '--volley-arrow-tip-hit-y': `${tipHitY}px`,
                  '--volley-arrow-angle': `${angleDeg}deg`,
                } as React.CSSProperties
              }
              aria-hidden
            >
              <div className="arena__volley-arrow-hit__arrow" />
              <div className="arena__volley-arrow-hit__impact">
                <span className="arena__volley-arrow-hit__impact-flash" />
                <span className="arena__volley-arrow-hit__impact-frame" aria-hidden />
              </div>
            </div>
          );
        })()}

        {/* Battle HUD overlay */}
        {isBattling && battle && (
          <BattleHUD
            arenaId={arenaId}
            battle={battle}
            teamA={teamAMembers}
            teamB={teamBMembers}
            teamMinionsA={effectiveRoom.teamA?.minions}
            teamMinionsB={effectiveRoom.teamB?.minions}
            myId={battleHudMyId}
            battleParticipantCharacterId={user?.characterId}
            onStuckContinueVisibleChange={onStuckContinueVisibleChange}
            stuckContinueClickRef={stuckContinueClickRef}
            transientEffectsActive={transientEffectsActive}
            confirmedPowerName={selectedPowerName}
            onSelectTarget={onSelectTargetDeferred}
            onSelectKeraunosTier2Batch={onSelectKeraunosTier2BatchDeferred}
            onSelectAction={onSelectActionDeferred}
            onSelectSeason={handleSelectSeason}
            onPreviewSeason={handlePreviewSeason}
            onCancelSeason={handleCancelSeason}
            onSelectPoem={handleSelectPoem}
            onCancelPoem={handleCancelPoem}
            onCancelTarget={handleCancelTarget}
            onSkipTurnNoTarget={handleSkipTurnNoTarget}
            onSelectTargetDisoriented={isAttackerNpc ? handleSelectTargetDisoriented : undefined}
            onConfirmDisorientedTarget={isDisorientedPlayerTurn ? handleSelectTarget : undefined}
            onSelectAllyTarget={handleSelectAllyTarget}
            onHealSkippedAck={handleHealSkippedAck}
            onSoulDevourerHealSkippedAck={handleSoulDevourerHealSkippedAck}
            onPomegranateCoSkippedAck={handlePomegranateCoSkippedAck}
            onRapidFireSkippedAck={handleRapidFireSkippedAck}
            onSpringHealSkippedAck={handleSpringHealSkippedAck}
            onResurrectionComplete={handleResurrectionComplete}
            initialShowPowers={returnFromSeason || returnFromTargetCancel}
            onSubmitAttackRoll={handleSubmitAttackRoll}
            onSubmitDefendRoll={handleSubmitDefendRoll}
            onSubmitRapidFireD4Roll={arenaId ? (roll: number) => submitRapidFireD4Roll(arenaId, roll) : () => { }}
            onRapidFireDamageCardComplete={() => {
              setVolleyArrowHitActive(false);
              if (arenaId) advanceToNextRapidFireStep(arenaId);
            }}
            onResolve={handleResolveTurn}
            isPlaybackDriver={isPlaybackDriver}
            isViewer={role === ARENA_ROLE.VIEWER || playAllNonHostViewer}
            isAttackerNpc={isAttackerNpc}
            isDefenderNpc={isDefenderNpc}
            practiceMode={!!effectiveRoom.practiceMode}
            isPomCoCasterNpc={isPomCoCasterNpc}
            onAdvancePomegranateCoAttackPhase={handleAdvancePomegranateCoAttackPhase}
            devPlayAllFightersSelf={!!effectiveRoom.devPlayAllFightersSelf}
            devUiActAsAttacker={devUiActAsAttacker}
            onResolveVisible={setResolveShown}
            onTransientEffectsActive={setTransientEffectsActive}
            onSoulDevourerHealReady={setSoulDevourerHealReady}
            transientSkeletonCard={transientSkeletonCard}
            transientSkeletonCardKey={transientSkeletonCardKey}
            onSkeletonCardShow={onSkeletonCardShow}
            onSkeletonCardClear={onSkeletonCardClear}
            onSkeletonCardTarget={onSkeletonCardTarget}
            onMinionHitPulse={(attackerId: string, defenderId: string) => {
              minionPulseCounterRef.current += 1;
              const pulseId = minionPulseCounterRef.current;
              const key = defenderId != null ? String(defenderId) : '';
              if (!key) return;
              queueMicrotask(() => setMinionPulseMap((m) => ({ ...m, [key]: pulseId })));
            }}
            volleyArrowHitActive={volleyArrowHitActive}
            onPomegranateCoResolveActive={setPomegranateCoResolveActive}
            onFloralHealResultCardVisible={() => setFloralHealResultCardVisible(true)}
            onFloralHealResultCardHidden={() => setFloralHealResultCardVisible(false)}
            originalAttackRollBeforeBuff={originalAttackRollBeforeBuff}
            originalDefendRollBeforeBuff={originalDefendRollBeforeBuff}
            originalCoAttackRollBeforeBuff={originalCoAttackRollBeforeBuff}
            originalCoDefendRollBeforeBuff={originalCoDefendRollBeforeBuff}
          />
        )}
      </div>

      {/* ── Footer actions ── */}
      <div className="arena__actions">
        {isCreator && effectiveRoom.status === ROOM_STATUS.READY && (
          <button className="arena__action-btn arena__action-btn--primary" onClick={() => runAsync(handleStartBattle)}>
            Start Battle
          </button>
        )}
        {isCreator && (effectiveRoom.status === ROOM_STATUS.CONFIGURING || effectiveRoom.status === ROOM_STATUS.WAITING || effectiveRoom.status === ROOM_STATUS.READY) && (
          <button className="arena__action-btn arena__action-btn--danger" onClick={() => runAsync(handleClose)}>
            Close Room
          </button>
        )}
      </div>

      {showLog && effectiveRoom && (
        <BattleLogModal room={effectiveRoom} onClose={() => setShowLog(false)} />
      )}

      {beyondTodayPractice && (
        <BeyondTodayPracticeModal
          onClose={() => {
            setBeyondTodayPractice(false);
            deleteRoom(arenaId ?? '').catch(() => { });
            navigate('/training-grounds');
          }}
        />
      )}
    </div>
  );
}

export default Arena;
