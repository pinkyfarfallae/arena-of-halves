/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ref, update } from 'firebase/database';
import { db } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { getPowers } from '../../data/powers';
import { POWER_OVERRIDES } from '../CharacterInfo/constants/overrides';
import { EFFECT_TAGS, isSeasonTag, SEASON_TAG_PREFIX } from '../../constants/effectTags';
import { POWER_NAMES } from '../../constants/powers';
import { TARGET_TYPES, MOD_STAT } from '../../constants/effectTypes';
import { ARENA_PATH, ARENA_ROLE, PANEL_SIDE, PHASE, ROOM_STATUS, TURN_ACTION, TurnAction, type ArenaRole, type PanelSide } from '../../constants/battle';
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
  advanceAfterSpringHealSkippedAck,
  advanceToPomegranateCoAttackPhase,
  applyNpcResolvingCritIfPending,
} from '../../services/battleRoom';
import type { BattleRoom, FighterState } from '../../types/battle';
import { type SeasonKey } from '../../data/seasons';
import BattleHUD from './components/BattleHUD/BattleHUD';
import TeamPanel from './components/TeamPanel/TeamPanel';
import SeasonalEffects from './components/SeasonalEffects/SeasonalEffects';
import ChevronLeft from '../../icons/ChevronLeft';
import BattleLogModal from '../Lobby/components/BattleLogModal/BattleLogModal';
import CopyIcon from './icons/CopyIcon';
import LinkIcon from './icons/LinkIcon';
import CheckIcon from './icons/CheckIcon';
import Eye from '../../icons/Eye';
import './Arena.scss';
import { CHARACTER } from '../../constants/characters';
import { fetchNPCs } from '../../data/npcs';

/**
 * NPC auto-defend after human attack: phase flips to ROLLING_DEFEND as soon as attack is submitted,
 * but the attack D12 + read delay in BattleHUD is ~2.3s anim + 2s PLAYER_ROLL_RESULT_VIEW_MS — scheduling
 * defend at 1200ms made resolution start before the attack “finished” on screen.
 */
const NPC_AUTO_DEFEND_DELAY_MS = 5200;

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
}

function Arena(props?: ArenaDemoProps) {
  const { isDemo = false, demoRoom = null, demoSeason = null } = props ?? {};
  const { arenaId } = useParams<{ arenaId: string }>();
  const [searchParams] = useSearchParams();
  const watchOnly = searchParams.get('watch') === 'true';
  const { user } = useAuth();
  const navigate = useNavigate();
  /** Suppress hit visuals briefly when user clicks Back from target modal (no opposite frame shake) */
  const [suppressHitAfterBack, setSuppressHitAfterBack] = useState(false);
  const suppressHitAfterBackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [room, setRoom] = useState<BattleRoom | null>(null);
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

  const volleyMainArrowShownRef = useRef(false);
  /** Pomegranate Oath (and similar): attacker id while phase stays SELECT_ACTION — clear local confirm when turn advances. */
  const prevSelectActionAttackerIdRef = useRef<string | null>(null);
  const npcPhaseRef = useRef<string | null>(null);
  const npcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Spreadsheet NPC ids — auto-play applies to these fighters on either team (not "team B only"). */
  const [npcCharacterIdSet, setNpcCharacterIdSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetchNPCs()
      .then((npcs) => {
        if (cancelled) return;
        setNpcCharacterIdSet(new Set(npcs.map((n) => n.characterId.toLowerCase())));
      })
      .catch(() => {});
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
      console.log({ phase, transientSkeletonCard });
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
    if (arenaId) {
      await deleteRoom(arenaId);
      navigate('/arena');
    }
  }, [arenaId, navigate]);

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
    runAsync(() => handleSelectTarget(defenderId));
  }, [runAsync, handleSelectTarget]);

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
    runAsync(() => handleSelectAction(action, powerName, allyTargetId));
  }, [runAsync, handleSelectAction]);

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

    // WAITING: join as fighter if there is open capacity OR this login matches host invite (correct team in joinRoom)
    if (!watchOnly && room.status === ROOM_STATUS.WAITING && (hasReservedSlot || !teamBFull || !teamAFull)) {
      try {
        const powerDeity = POWER_OVERRIDES[user.characterId?.toLowerCase()] ?? user.deityBlood;
        const powers = getPowers(powerDeity);
        const fighter = toFighterState(user, powers);
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
      } catch {
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
    if (turn.phase === PHASE.ROLLING_ATTACK) {
      const awaitingPom = !!(turn as { awaitingPomegranateCoAttack?: boolean }).awaitingPomegranateCoAttack;
      const npcCo = awaitingPom && turn.coAttackerId && isNpcId(turn.coAttackerId as string);
      const npcMain = !awaitingPom && isNpcId(turn.attackerId);
      if (npcCo || npcMain) {
        const roll = Math.floor(Math.random() * 12) + 1;
        schedule(() => submitAttackRoll(arenaId, roll), 1200);
        return;
      }
    }
    if (turn.phase === PHASE.ROLLING_DEFEND && turn.defenderId && isNpcId(turn.defenderId)) {
      const roll = Math.floor(Math.random() * 12) + 1;
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
      isNpcId((turn as { coAttackerId?: string }).coAttackerId) &&
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
    (room?.battle?.turn as { coAttackerId?: string })?.coAttackerId,
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

  const handleSpringHealSkippedAck = useCallback(async () => {
    if (arenaId) await advanceAfterSpringHealSkippedAck(arenaId);
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
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setToast(type === COPY_TYPE.CODE ? 'Room code copied!' : 'Viewer link copied!');
    setTimeout(() => { setCopied(null); setToast(null); }, 2000);
  };

  const effectiveRoom = isDemo ? (demoRoom ?? null) : room;

  /* ── Loading / Error states (skip when demo mode) ─────────────────── */
  if (!isDemo && error) {
    return (
      <div className="arena">
        <div className="arena__state">
          <p className="arena__state-msg">{error}</p>
          <Link to="/arena" className="arena__action-btn arena__action-btn--secondary">Back to Lobby</Link>
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

  const viewerCount = effectiveRoom.viewers ? Object.keys(effectiveRoom.viewers).length : 0;
  const teamAMembers = teamMembersFromFirebase<FighterState>(
    effectiveRoom.teamA?.members as FighterState[] | Record<string, FighterState> | undefined,
  ).map((m: FighterState) => normalizeFighter(m));
  const teamBMembers = teamMembersFromFirebase<FighterState>(
    effectiveRoom.teamB?.members as FighterState[] | Record<string, FighterState> | undefined,
  ).map((m: FighterState) => normalizeFighter(m));
  const teamBFull = teamBMembers.length >= (effectiveRoom.teamB?.maxSize ?? 1);
  const isCreator = teamAMembers[0]?.characterId === user?.characterId;
  /** Solo “play all camp”: any logged-in fighter on team A may drive every camp turn (not only devPlayAllHostCharacterId / slot 0 — fixes ally-slot login or host id drift). */
  const userIsOnTeamA = !!(
    user?.characterId &&
    teamAMembers.some((m) => m.characterId.toLowerCase() === user.characterId.toLowerCase())
  );
  const isPlayAllHost = !!(effectiveRoom.devPlayAllFightersSelf && userIsOnTeamA);
  /** Play-all-fighters: only the configurated host drives; embedded teammates watch like viewers. */
  const playAllNonHostViewer = !!(effectiveRoom.devPlayAllFightersSelf && !isPlayAllHost);
  const battle = effectiveRoom.battle;
  /** Play-all-camp only: host controls whichever fighter is acting. */
  const devUiActAsAttacker =
    !!(
      effectiveRoom.devPlayAllFightersSelf &&
      isPlayAllHost &&
      battle?.turn?.attackerId
    );
  const battleUiMyId = (() => {
    if (!devUiActAsAttacker || !battle?.turn) return user?.characterId;
    const t = battle.turn;
    /* Co-attack uses ROLLING_ATTACK but roller is coAttackerId, not turn attacker. */
    if (t.awaitingPomegranateCoAttack && t.phase === PHASE.ROLLING_ATTACK && t.coAttackerId) {
      return t.coAttackerId;
    }
    /* During defend rolls myId must be defender or DiceModal isMyDefend stays false. */
    if (t.phase === PHASE.ROLLING_DEFEND && t.defenderId) {
      return t.defenderId;
    }
    return t.attackerId ?? user?.characterId;
  })();
  const battleHudMyId = playAllNonHostViewer ? undefined : battleUiMyId;
  /** Don't show volley-arrow hit VFX on chips after extra-shot chain ends (RESOLVING_AFTER_RAPID_FIRE) so previous attacker doesn't keep golden pulse. */
  const showVolleyArrowChipVfx = !!volleyArrowHitActive && battle?.turn?.phase !== PHASE.RESOLVING_AFTER_RAPID_FIRE;
  const isBattling = effectiveRoom.status === ROOM_STATUS.BATTLING || effectiveRoom.status === ROOM_STATUS.FINISHED;
  /**
   * Exactly one human client should write NPC sub-phase rolls (crit D4, chain, dodge sim) to Firebase.
   * Previously only `isCreator` (team A slot 0) drove — team-B humans (or non-slot-0) never got `isPlaybackDriver`,
   * so NPC critical checks stuck on "waiting" with no auto-roll.
   */
  const npcAutomationAnchorId = (() => {
    if (!effectiveRoom.testMode || npcCharacterIdSet.size === 0) return null;
    const humans = [...teamAMembers, ...teamBMembers].filter(
      (m) => m?.characterId && !npcCharacterIdSet.has(String(m.characterId).toLowerCase()),
    );
    if (humans.length === 0) return null;
    return [...humans].sort((a, b) =>
      String(a.characterId).localeCompare(String(b.characterId), undefined, { sensitivity: 'base' }),
    )[0].characterId;
  })();
  const isPlaybackDriver = !!(
    effectiveRoom.devPlayAllFightersSelf
      ? isPlayAllHost
      : (
        battle?.turn?.attackerId === user?.characterId ||
        (
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
  );
  const isAttackerNpc =
    !!(
      effectiveRoom.testMode &&
      battle?.turn?.attackerId &&
      npcCharacterIdSet.size > 0 &&
      npcCharacterIdSet.has(battle.turn.attackerId.toLowerCase())
    ) && !effectiveRoom.devPlayAllFightersSelf;
  const isDefenderNpc =
    !!(
      effectiveRoom.testMode &&
      battle?.turn?.defenderId &&
      npcCharacterIdSet.size > 0 &&
      npcCharacterIdSet.has(battle.turn.defenderId.toLowerCase())
    ) && !effectiveRoom.devPlayAllFightersSelf;
  const isPomCoCasterNpc =
    !!(
      effectiveRoom.testMode &&
      battle?.turn?.coAttackerId &&
      npcCharacterIdSet.size > 0 &&
      npcCharacterIdSet.has(battle.turn.coAttackerId.toLowerCase())
    ) && !effectiveRoom.devPlayAllFightersSelf;

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
    if (arenaId) await submitAttackRoll(arenaId, roll);
  };

  const handleSubmitDefendRoll = async (roll: number) => {
    if (arenaId) await submitDefendRoll(arenaId, roll);
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
        <Link to="/arena" className="arena__bar-back">
          <ChevronLeft width={15} height={15} />
          Leave Arena
        </Link>

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

        {stuckContinueVisible && (
          <button
            type="button"
            className="arena__bar-stuck-continue"
            aria-label="Continue battle"
            onClick={() => stuckContinueClickRef.current?.()}
          >
            Continue battle
          </button>
        )}

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
              {copied === COPY_TYPE.LINK ? <CheckIcon /> : <LinkIcon />}
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
                {copied === COPY_TYPE.CODE ? <CheckIcon /> : <CopyIcon />}
              </button>
            )}
            <button
              className={`arena__share-btn ${copied === COPY_TYPE.LINK ? 'arena__share-btn--copied' : ''}`}
              onClick={() => handleCopy(COPY_TYPE.LINK)}
              data-tooltip={copied === COPY_TYPE.LINK ? 'Copied!' : 'Copy viewer link'}
              data-tooltip-pos="bottom"
            >
              {copied === COPY_TYPE.LINK ? <CheckIcon /> : <LinkIcon />}
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
            onSpringHealSkippedAck={handleSpringHealSkippedAck}
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
            onFloralHealResultCardVisible={() => setFloralHealResultCardVisible(true)}
            onFloralHealResultCardHidden={() => setFloralHealResultCardVisible(false)}
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
        {isCreator && effectiveRoom.status === ROOM_STATUS.WAITING && (
          <button className="arena__action-btn arena__action-btn--danger" onClick={() => runAsync(handleClose)}>
            Close Room
          </button>
        )}
      </div>

      {showLog && effectiveRoom && (
        <BattleLogModal room={effectiveRoom} onClose={() => setShowLog(false)} />
      )}
    </div>
  );
}

export default Arena;
