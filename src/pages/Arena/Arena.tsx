import { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ref, update } from 'firebase/database';
import { db } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { getPowers } from '../../data/powers';
import { fetchNPCs } from '../../data/npcs';
import { POWER_OVERRIDES } from '../CharacterInfo/constants/overrides';
import { EFFECT_TAGS, IMPRECATED_POEM_VERSE_TAGS, isSeasonTag, SEASON_TAG_PREFIX } from '../../constants/effectTags';
import { POWER_NAMES } from '../../constants/powers';
import { TARGET_TYPES, MOD_STAT } from '../../constants/effectTypes';
import { ARENA_PATH, ARENA_ROLE, PANEL_SIDE, PHASE, ROOM_STATUS, TURN_ACTION, TurnAction, type ArenaRole, type PanelSide } from '../../constants/battle';
import { COPY_TYPE, type CopyType } from '../../constants/lobby';
import {
  onRoomChange,
  joinRoom,
  joinAsViewer,
  leaveViewer,
  deleteRoom,
  toFighterState,
  startBattle,
  selectTarget,
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
  advanceAfterShadowCamouflageD4,
  advanceAfterDisorientedD4,
  advanceAfterFloralHealD4,
  advanceAfterSpringHealD4,
  skipTurnNoValidTarget,
  selectTargetDisoriented,
  advanceAfterFloralHealSkippedAck,
  advanceAfterSoulDevourerHealSkippedAck,
  advanceAfterSpringHealSkippedAck,
  advanceToPomegranateCoAttackPhase,
  submitPomegranateCoAttackRoll,
  submitPomegranateCoDefendRoll,
} from '../../services/battleRoom';
import { getAffordablePowers } from '../../services/powerEngine';
import type { BattleRoom, FighterState } from '../../types/battle';
import { SEASON_ORDER, type SeasonKey } from '../../data/seasons';
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
  const npcJoining = useRef(false);
  const npcPhaseRef = useRef<string | null>(null);
  const npcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  useEffect(() => {
    if (soulDrainTurn?.phase !== PHASE.RESOLVING || !(soulDrainTurn as { soulDevourerDrain?: boolean })?.soulDevourerDrain) {
      setSoulFloatActive(false);
      return;
    }
    const tStart = setTimeout(() => setSoulFloatActive(true), 500);
    const tEnd = setTimeout(() => setSoulFloatActive(false), 3800); // 0.5s delay + 2.8s float + 0.5s explode
    return () => {
      clearTimeout(tStart);
      clearTimeout(tEnd);
    };
  }, [soulDrainTurn?.phase, (soulDrainTurn as { soulDevourerDrain?: boolean })?.soulDevourerDrain]);

  // Volley Arrow: show amber/gold arrow (1) main hit — when resolve is shown and caster used Volley Arrow or has Rapid Fire (round 2/3); (2) each extra shot
  const turn = room?.battle?.turn;
  const activeEffects = room?.battle?.activeEffects ?? [];
  const attackerHasRapidFire = !!(turn?.attackerId && (activeEffects as { targetId?: string; tag?: string; turnsRemaining?: number }[]).some(
    (e) => e.targetId === turn?.attackerId && e.tag === EFFECT_TAGS.RAPID_FIRE && (e.turnsRemaining == null || e.turnsRemaining > 0),
  ));
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
        /* Advance after VFX ends (damage card is hidden so onDisplayComplete never runs — advance here) */
        if (arenaId) advanceToNextRapidFireStep(arenaId);
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
  }, [turn?.phase, turn?.usedPowerName, resolveShown, (turn as { rapidFireStep?: number })?.rapidFireStep, arenaId, attackerHasRapidFire]);
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
  useEffect(() => {
    const phase = room?.battle?.turn?.phase;
    if (phase && phase !== PHASE.SELECT_ACTION && phase !== PHASE.SELECT_TARGET) {
      setLastConfirmedPowerName(null);
      setReturnFromTargetCancel(false);
    }
  }, [room?.battle?.turn?.phase]);

  /* ── Death Keeper free action: server goes to SELECT_ACTION without usedPowerName; phase never left SELECT_ACTION so lastConfirmed would block ActionSelectModal ── */
  useEffect(() => {
    const t = room?.battle?.turn;
    if (!t || t.phase !== PHASE.SELECT_ACTION) return;
    if (t.resurrectTargetId && t.usedPowerName == null) {
      setLastConfirmedPowerName(null);
    }
  }, [room?.battle?.turn?.phase, room?.battle?.turn?.resurrectTargetId, room?.battle?.turn?.usedPowerName]);

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
    const teamAMembers = teamMembersFromFirebase(room.teamA?.members);
    const teamBMembers = teamMembersFromFirebase(room.teamB?.members);

    // Already in team A
    if (teamAMembers.some(m => m.characterId === myId)) {
      setRole(ARENA_ROLE.TEAM_A);
      setJoined(true);
      return;
    }

    // Already in team B
    if (teamBMembers.some(m => m.characterId === myId)) {
      setRole(ARENA_ROLE.TEAM_B);
      setJoined(true);
      return;
    }

    // Room is waiting & not watch-only — join team B first, then team A if B is full
    const maxA = room.teamA?.maxSize ?? 1;
    const maxB = room.teamB?.maxSize ?? 1;
    const teamAFull = teamAMembers.length >= maxA;
    const teamBFull = teamBMembers.length >= maxB;
    if (!watchOnly && room.status === ROOM_STATUS.WAITING && (!teamBFull || !teamAFull)) {
      try {
        const powerDeity = POWER_OVERRIDES[user.characterId?.toLowerCase()] ?? user.deityBlood;
        const powers = getPowers(powerDeity);
        const fighter = toFighterState(user, powers);
        const result = await joinRoom(arenaId, fighter);
        if (result) {
          const onA = result.teamA?.members?.some((m) => m.characterId === myId);
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

  /* ── Test mode: fetch selected NPC and auto-join to teamB ── */
  useEffect(() => {
    if (!room || !arenaId || !room.testMode) return;
    if (room.status !== ROOM_STATUS.WAITING) return;
    const teamBMembers = room.teamB?.members || [];
    if (teamBMembers.length > 0) return;
    if (npcJoining.current) return;

    npcJoining.current = true;
    let cancelled = false;

    // Check if pre-selected NPC team exists
    const npcTeam = (room as any).npcTeam;
    if (npcTeam && Array.isArray(npcTeam) && npcTeam.length > 0) {
      // Multi-fighter NPC team selected during config
      joinRoom(arenaId, npcTeam).finally(() => { npcJoining.current = false; });
      return () => { cancelled = true; };
    }

    // Single NPC: only when host picked an opponent via npcId (legacy / 1v1 shortcut)
    fetchNPCs().then((npcs) => {
      if (cancelled) return;
      const npcId = room.npcId;
      if (!npcId) {
        npcJoining.current = false;
        return;
      }
      const npc = npcs.find((n) => n.characterId === npcId);
      if (!npc) {
        npcJoining.current = false;
        return;
      }
      joinRoom(arenaId, npc);
    }).finally(() => { npcJoining.current = false; });
    return () => { cancelled = true; };
  }, [room, arenaId]);

  /* ── Test mode: auto-play for NPC enemy ────── */
  // Cleanup timer on unmount only
  useEffect(() => () => { if (npcTimerRef.current) clearTimeout(npcTimerRef.current); }, []);

  useEffect(() => {
    if (!room || !arenaId || !room.testMode) return;
    if (room.devPlayAllFightersSelf) return;
    if (room.devNpcAutoPlay === false) return;
    if (room.status !== ROOM_STATUS.BATTLING || !room.battle?.turn) return;

    const turn = room.battle.turn;
    const toArr = <T,>(v: T[] | Record<string, T> | undefined): T[] =>
      !v ? [] : Array.isArray(v) ? v : Object.values(v);
    const teamBIds = new Set(toArr(room.teamB?.members).map(m => m.characterId));
    const phaseKey = `${turn.phase}:${turn.attackerId}:${turn.defenderId ?? ''}`;

    // Same phase already scheduled and timer still pending — duplicate effect run (e.g. Strict Mode) must not return early or defend never fires
    if (npcPhaseRef.current === phaseKey && npcTimerRef.current !== null) return;

    // New phase — cancel any pending timer from old phase
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

    // NPC: Floral Fragrance heal skipped (e.g. target has Healing Nullified) — ack after delay, then advance
    const floralHealSkipped = (turn as any)?.floralHealSkipped;
    if (turn.phase === PHASE.ROLLING_FLORAL_HEAL && floralHealSkipped && teamBIds.has(turn.attackerId)) {
      schedule(() => advanceAfterFloralHealSkippedAck(arenaId), 1500);
      return;
    }

    // NPC: Floral Fragrance + Efflorescence Muse — roll D4 for heal crit, then advance
    const floralWinFaces = (turn as any)?.floralHealWinFaces;
    const floralRoll = (turn as any)?.floralHealRoll;
    if (turn.phase === PHASE.ROLLING_FLORAL_HEAL && Array.isArray(floralWinFaces) && floralWinFaces.length > 0 && floralRoll == null && teamBIds.has(turn.attackerId)) {
      schedule(async () => {
        const roll = Math.ceil(Math.random() * 4);
        try {
          await update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { floralHealRoll: roll });
          await advanceAfterFloralHealD4(arenaId);
        } catch (e) { }
      }, 2000);
      return;
    }

    // NPC: Spring heal skipped — wait then ack so D4 roll for heal2 can run (flow: hit → apply heal / show skipped heal & wait for ack → roll next heal crit)
    const springHealSkipAwaitsAck = (turn as any)?.springHealSkipAwaitsAck;
    if (turn.phase === PHASE.ROLLING_SPRING_HEAL && springHealSkipAwaitsAck && teamBIds.has(turn.attackerId)) {
      schedule(() => advanceAfterSpringHealSkippedAck(arenaId), 1500);
      return;
    }

    // NPC: Ephemeral Season Spring — roll D4 for heal amount (crit = 2, else 1), then advance (only when not waiting for skip ack)
    const springWinFaces = (turn as any)?.springHealWinFaces;
    const springRoll = (turn as any)?.springHealRoll;
    if (turn.phase === PHASE.ROLLING_SPRING_HEAL && !springHealSkipAwaitsAck && Array.isArray(springWinFaces) && springWinFaces.length > 0 && springRoll == null && teamBIds.has(turn.attackerId)) {
      schedule(async () => {
        const roll = Math.ceil(Math.random() * 4);
        try {
          await update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { springHealRoll: roll });
          await new Promise((r) => setTimeout(r, 800));
          await advanceAfterSpringHealD4(arenaId);
        } catch (e) { }
      }, 2000);
      return;
    }

    // NPC: Disoriented D4 roll (25% no effect), then advance
    const disorientedWinFaces = (turn as any)?.disorientedWinFaces;
    const disorientedRoll = (turn as any)?.disorientedRoll;
    if (turn.phase === PHASE.ROLLING_DISORIENTED_NO_EFFECT && Array.isArray(disorientedWinFaces) && disorientedWinFaces.length > 0 && disorientedRoll == null && teamBIds.has(turn.attackerId)) {
      schedule(async () => {
        const roll = Math.ceil(Math.random() * 4);
        try {
          await update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { disorientedRoll: roll });
          await new Promise((r) => setTimeout(r, 800));
          await advanceAfterDisorientedD4(arenaId);
        } catch (e) { }
      }, 1500);
      return;
    }

    // NPC: Rapid Fire (Volley Arrow) D4 roll for extra shot
    if (turn.phase === PHASE.ROLLING_RAPID_FIRE_EXTRA_SHOT && teamBIds.has(turn.attackerId)) {
      schedule(async () => {
        const roll = Math.ceil(Math.random() * 4);
        if (arenaId) await submitRapidFireD4Roll(arenaId, roll);
      }, 1800);
      return;
    }

    // NPC cast Shadow Camouflaging: roll D4 for refill SP, then advance
    const scWinFaces = (turn as any)?.shadowCamouflageRefillWinFaces;
    const scRoll = (turn as any)?.shadowCamouflageRefillRoll;
    if (turn.phase === PHASE.RESOLVING && Array.isArray(scWinFaces) && scWinFaces.length > 0 && scRoll == null && teamBIds.has(turn.attackerId)) {
      schedule(async () => {
        const roll = Math.ceil(Math.random() * 4);
        try {
          await update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { shadowCamouflageRefillRoll: roll });
          await advanceAfterShadowCamouflageD4(arenaId);
        } catch (e) { }
      }, 2000);
      return;
    }

    // NPC's turn to select target → pick random alive opponent (filtered by power requirements and Shadow Camouflage)
    // Disoriented: skip here; BattleHUD effect calls selectTargetDisoriented so server does 25% no-effect flow
    const battle = room.battle;
    const npcHasDisoriented = !!(turn.attackerId && (battle?.activeEffects || []).some((e: { targetId?: string; tag?: string }) => e.targetId === turn.attackerId && e.tag === EFFECT_TAGS.DISORIENTED));
    if (turn.phase === PHASE.SELECT_TARGET && teamBIds.has(turn.attackerId) && !npcHasDisoriented) {
      let teamAAlive = toArr(room.teamA?.members).filter(m => m.currentHp > 0);

      if (turn.usedPowerIndex != null && battle) {
        const npcFighter = toArr(room.teamB?.members).find(m => m.characterId === turn.attackerId);
        if (npcFighter) {
          const power = npcFighter.powers[turn.usedPowerIndex];
          const effects = battle.activeEffects || [];
          // If power requires specific effect on target, filter valid targets
          if (power?.requiresTargetHasEffect) {
            const requiredTag = power.requiresTargetHasEffect;
            teamAAlive = teamAAlive.filter(enemy =>
              effects.some(e => e.targetId === enemy.characterId && e.tag === requiredTag)
            );
          }
        }
      }
      // Shadow Camouflage: exclude shadow-camouflaged enemies unless current action is area attack
      if (battle) {
        const effects = battle.activeEffects || [];
        const isAreaAttack = turn.action === TURN_ACTION.POWER && turn.usedPowerIndex != null && (() => {
          const npcF = toArr(room.teamB?.members).find(m => m.characterId === turn.attackerId);
          const p = npcF?.powers?.[turn.usedPowerIndex!];
          return p?.target === TARGET_TYPES.AREA;
        })();
        teamAAlive = teamAAlive.filter(enemy =>
          !effects.some(e => e.targetId === enemy.characterId && e.modStat === MOD_STAT.SHADOW_CAMOUFLAGED) || isAreaAttack
        );
      }

      if (teamAAlive.length > 0) {
        const target = teamAAlive[Math.floor(Math.random() * teamAAlive.length)];
        // Extra delay after Floral Fragrance so fragrance wave visual plays
        const delay = turn.usedPowerName === POWER_NAMES.FLORAL_FRAGRANCE ? 5000 : 2000;
        // Show client-side visual selection immediately so NPC appears to aim (e.g., at skeletons)
        setNpcVisualTarget(target.characterId);
        // Preserve any known used power name (server may set turn.usedPowerName when arriving at select-target).
        // This ensures Floral powers have their visual name set so TeamPanel can show the fragrance VFX.
        setNpcVisualPowerName(turn?.usedPowerName ?? null);
        schedule(() => selectTarget(arenaId, target.characterId), delay);
        // Clear the client-side visual after the scheduled action completes (+ small buffer)
        setTimeout(() => { setNpcVisualTarget(null); setNpcVisualPowerName(null); }, delay + 2500);
      } else {
        // No valid target (e.g. all enemies under Shadow Camouflage) — skip turn; modal will show when log updates
        schedule(() => skipTurnNoValidTarget(arenaId), 1500);
      }
      return;
    }

    // NPC chooses action (attack or power)
    if (turn.phase === PHASE.SELECT_ACTION && teamBIds.has(turn.attackerId)) {
      // Death Keeper: always resurrect if available + dead allies exist
      const npcEffects = battle?.activeEffects || [];
      const hasDeathKeeper = npcEffects.some(e => e.targetId === turn.attackerId && e.tag === EFFECT_TAGS.DEATH_KEEPER);
      const deadAllies = toArr(room.teamB?.members).filter(m => m.currentHp <= 0);
      if (hasDeathKeeper && deadAllies.length > 0 && !turn.resurrectTargetId) {
        const target = deadAllies[Math.floor(Math.random() * deadAllies.length)];
        // Death Keeper is always index 0 (Passive)
        schedule(() => selectAction(arenaId, TURN_ACTION.POWER, 0, target.characterId), 1500);
        return;
      }

      const npcFighter = toArr(room.teamB?.members).find(m => m.characterId === turn.attackerId);
      if (npcFighter) {
        const affordable = getAffordablePowers(npcFighter);

        // Filter out powers that require specific target conditions but no valid targets exist
        const usablePowers = affordable.filter(({ power }) => {
          // If power requires target to have specific effect, check if any enemy has it
          if (power.requiresTargetHasEffect && battle) {
            const requiredTag = power.requiresTargetHasEffect;
            const enemies = toArr(room.teamA?.members).filter(m => m.currentHp > 0);
            const effects = battle.activeEffects || [];
            return enemies.some(enemy =>
              effects.some(e => e.targetId === enemy.characterId && e.tag === requiredTag)
            );
          }
          return true;
        });

        if (usablePowers.length > 0 && Math.random() < 0.8) {
          const pick = usablePowers[Math.floor(Math.random() * usablePowers.length)];
          // Ally-targeting power: pick a random alive teammate
          if (pick.power.target === TARGET_TYPES.ALLY) {
            const teammates = toArr(room.teamB?.members).filter(m => m.currentHp > 0);
            if (teammates.length > 0) {
              // Pomegranate's Oath: prefer other allies, self only if no others alive
              let pool = teammates;
              if (pick.power.name === POWER_NAMES.POMEGRANATES_OATH) {
                const others = teammates.filter(m => m.characterId !== turn.attackerId);
                if (others.length > 0) pool = others;
              }
              const ally = pool[Math.floor(Math.random() * pool.length)];
              // Show client-side visual for NPC ally-targeting powers (e.g., Floral Fragrance)
              setNpcVisualTarget(ally.characterId);
              setNpcVisualPowerName(pick.power.name);
              const actionDelay = 1000;
              // If Floral Fragrance, keep visual longer to allow fragrance VFX to play
              const keepMs = pick.power.name === POWER_NAMES.FLORAL_FRAGRANCE ? 5000 : 2500;
              schedule(() => selectAction(arenaId, TURN_ACTION.POWER, pick.index, ally.characterId), actionDelay);
              setTimeout(() => { setNpcVisualTarget(null); setNpcVisualPowerName(null); }, actionDelay + keepMs);
            } else {
              schedule(() => selectAction(arenaId, TURN_ACTION.ATTACK), 800);
            }
          } else {
            schedule(() => selectAction(arenaId, TURN_ACTION.POWER, pick.index), 1000);
          }
        } else {
          schedule(() => selectAction(arenaId, TURN_ACTION.ATTACK), 800);
        }
      } else {
        schedule(() => selectAction(arenaId, TURN_ACTION.ATTACK), 800);
      }
      return;
    }

    // NPC needs to select season (Ephemeral Season)
    if (turn.phase === PHASE.SELECT_SEASON && teamBIds.has(turn.attackerId)) {
      const seasons: SeasonKey[] = SEASON_ORDER;
      const pick = seasons[Math.floor(Math.random() * seasons.length)];
      schedule(() => handleSelectSeason(pick), 1500);
      return;
    }

    // NPC needs to select poem verse (Imprecated Poem)
    if (turn.phase === PHASE.SELECT_POEM && teamBIds.has(turn.attackerId)) {
      const verses = [...IMPRECATED_POEM_VERSE_TAGS];
      const pick = verses[Math.floor(Math.random() * verses.length)];
      schedule(() => handleSelectPoem(pick), 1500);
      return;
    }

    // NPC needs to roll attack dice (D12)
    if (turn.phase === PHASE.ROLLING_ATTACK && teamBIds.has(turn.attackerId)) {
      const roll = Math.floor(Math.random() * 12) + 1;
      schedule(() => submitAttackRoll(arenaId, roll), 1800);
      return;
    }

    // NPC needs to roll defend dice (D12)
    if (turn.phase === PHASE.ROLLING_DEFEND && turn.defenderId && teamBIds.has(turn.defenderId)) {
      const roll = Math.floor(Math.random() * 12) + 1;
      schedule(() => submitDefendRoll(arenaId, roll), 4500);
      return;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps -- battle/handleSelectSeason from room; omit to avoid extra NPC auto-actions
  }, [room, arenaId]);

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

  /* Pomegranate co-attack: keep these useCallbacks here only — before loading/error returns — never duplicate after handleResolveTurn. */
  const handleAdvancePomegranateCoAttackPhase = useCallback(() => {
    if (arenaId) advanceToPomegranateCoAttackPhase(arenaId).catch(() => { });
  }, [arenaId]);
  const handleSubmitPomegranateCoAttackRoll = useCallback(
    (roll: number) => {
      if (arenaId) submitPomegranateCoAttackRoll(arenaId, roll).catch(() => { });
    },
    [arenaId],
  );
  const handleSubmitPomegranateCoDefendRoll = useCallback(
    (roll: number) => {
      if (arenaId) submitPomegranateCoDefendRoll(arenaId, roll).catch(() => { });
    },
    [arenaId],
  );

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
  const teamBIds = new Set(teamBMembers.map((m) => m.characterId));
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
  /** Dev test: treat current attacker as local player for HUD/TeamPanel (full manual or any turn when NPC auto is off).
   *  Play-all-camp must not require testMode: rooms can omit it while devPlayAllFightersSelf is set — otherwise myId stays
   *  on the logged-in character and embedded allies' turns never get isMyTurn (no action/dice modals). */
  const devUiActAsAttacker =
    !!(
      (effectiveRoom.testMode || !!effectiveRoom.devPlayAllFightersSelf) &&
      (effectiveRoom.devPlayAllFightersSelf ? isPlayAllHost : isCreator) &&
      battle?.turn?.attackerId &&
      (effectiveRoom.devPlayAllFightersSelf ||
        effectiveRoom.devNpcAutoPlay === false)
    );
  const battleUiMyId = (() => {
    if (!devUiActAsAttacker || !battle?.turn) return user?.characterId;
    const t = battle.turn;
    /* You control attacker for attack phases; during defend rolls myId must be defender or DiceModal isMyDefend stays false. */
    if (
      (t.phase === PHASE.ROLLING_DEFEND || t.phase === PHASE.ROLLING_POMEGRANATE_CO_DEFEND) &&
      t.defenderId
    ) {
      return t.defenderId;
    }
    return t.attackerId ?? user?.characterId;
  })();
  const battleHudMyId = playAllNonHostViewer ? undefined : battleUiMyId;
  /** Don't show volley-arrow hit VFX on chips after extra-shot chain ends (RESOLVING_AFTER_RAPID_FIRE) so previous attacker doesn't keep golden pulse. */
  const showVolleyArrowChipVfx = !!volleyArrowHitActive && battle?.turn?.phase !== PHASE.RESOLVING_AFTER_RAPID_FIRE;
  const isBattling = effectiveRoom.status === ROOM_STATUS.BATTLING || effectiveRoom.status === ROOM_STATUS.FINISHED;
  const isNpcPlaybackDriver = !!(
    effectiveRoom.testMode &&
    battle?.turn?.attackerId &&
    teamBMembers.some((m) => m.characterId === battle.turn?.attackerId) &&
    (effectiveRoom.devPlayAllFightersSelf ? isPlayAllHost : isCreator)
  );
  const isPlaybackDriver = !!(
    effectiveRoom.devPlayAllFightersSelf
      ? isPlayAllHost
      : (battle?.turn?.attackerId === user?.characterId || isNpcPlaybackDriver || devUiActAsAttacker)
  );
  /** When true, attacker is NPC (PvE test mode); D4 crit/chain must be simulated on this client. Play-all mode: always false so the host gets modals for every fighter. */
  const isAttackerNpc =
    !!(effectiveRoom.testMode && battle?.turn?.attackerId && teamBIds.has(battle.turn.attackerId)) &&
    !effectiveRoom.devPlayAllFightersSelf;
  /** When true, defender is NPC; dodge D4 must be simulated here. Play-all: false so dodge/crit are manual. */
  const isDefenderNpc =
    !!(effectiveRoom.testMode && battle?.turn?.defenderId && teamBIds.has(battle.turn.defenderId)) &&
    !effectiveRoom.devPlayAllFightersSelf;
  const isPomCoCasterNpc =
    !!(effectiveRoom.testMode && battle?.turn?.coAttackerId && teamBIds.has(battle.turn.coAttackerId)) &&
    !effectiveRoom.devPlayAllFightersSelf;

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
          <span className="arena__bar-name">{effectiveRoom.roomName}</span>
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
            transientEffectsActive={transientEffectsActive}
            confirmedPowerName={selectedPowerName}
            onSelectTarget={onSelectTargetDeferred}
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
            onSubmitPomegranateCoAttackRoll={handleSubmitPomegranateCoAttackRoll}
            onSubmitPomegranateCoDefendRoll={handleSubmitPomegranateCoDefendRoll}
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
