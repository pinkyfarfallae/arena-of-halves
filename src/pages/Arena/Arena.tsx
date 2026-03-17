import { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ref, update } from 'firebase/database';
import { db } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { getPowers } from '../../data/powers';
import { fetchNPCs, pickRandomNPC } from '../../data/npcs';
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
  resolveTurn,
  normalizeFighter,
  advanceAfterShadowCamouflageD4,
  advanceAfterFloralHealD4,
  advanceAfterSpringHealD4,
  skipTurnNoValidTarget,
  advanceAfterFloralHealSkippedAck,
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
  // Local visual override: NPC schedules a target, or human selects ally for Floral Fragrance (show heal effect immediately)
  const [npcVisualTarget, setNpcVisualTarget] = useState<string | null>(null);
  const [npcVisualPowerName, setNpcVisualPowerName] = useState<string | null>(null);
  const floralVisualTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track active season from Ephemeral Season power (displayed for 2 turns)
  const [activeSeason, setActiveSeason] = useState<SeasonKey | null>(null);
  const [returnFromSeason, setReturnFromSeason] = useState(false);

  /** Set when user confirms a power in the action modal (action === POWER). Cleared when turn/phase changes. */
  const [lastConfirmedPowerName, setLastConfirmedPowerName] = useState<string | null>(null);
  /** Set when Floral Heal D4 result card is shown (so TeamPanel can show healing VFX in sync). Cleared when leaving ROLLING_FLORAL_HEAL. */
  const [floralHealResultCardVisible, setFloralHealResultCardVisible] = useState(false);

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
    }
  }, [room?.battle?.turn?.phase]);

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
    const teamAMembers = room.teamA?.members || [];
    const teamBMembers = room.teamB?.members || [];

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

    // Room is waiting & not watch-only — join team B
    const teamBFull = teamBMembers.length >= (room.teamB?.maxSize ?? 1);
    if (!watchOnly && room.status === ROOM_STATUS.WAITING && !teamBFull) {
      try {
        const powerDeity = POWER_OVERRIDES[user.characterId?.toLowerCase()] ?? user.deityBlood;
        const powers = getPowers(powerDeity);
        const fighter = toFighterState(user, powers);
        const result = await joinRoom(arenaId, fighter);
        if (result) {
          setRole(ARENA_ROLE.TEAM_B);
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
  const npcJoining = useRef(false);
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

    // Single NPC mode (original behavior)
    fetchNPCs().then((npcs) => {
      if (cancelled) return;
      const npcId = room.npcId;
      const npc = (npcId && npcs.find((n) => n.characterId === npcId)) || pickRandomNPC(npcs);
      if (!npc) return;
      joinRoom(arenaId, npc);
    }).finally(() => { npcJoining.current = false; });
    return () => { cancelled = true; };
  }, [room, arenaId]);

  /* ── Test mode: auto-play for NPC enemy ────── */
  const npcPhaseRef = useRef<string | null>(null);
  const npcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount only
  useEffect(() => () => { if (npcTimerRef.current) clearTimeout(npcTimerRef.current); }, []);

  useEffect(() => {
    if (!room || !arenaId || !room.testMode) return;
    if (room.status !== ROOM_STATUS.BATTLING || !room.battle?.turn) return;

    const turn = room.battle.turn;
    const toArr = <T,>(v: T[] | Record<string, T> | undefined): T[] =>
      !v ? [] : Array.isArray(v) ? v : Object.values(v);
    const teamBIds = new Set(toArr(room.teamB?.members).map(m => m.characterId));
    const phaseKey = `${turn.phase}:${turn.attackerId}:${turn.defenderId ?? ''}`;

    // Same phase already being handled — let the pending timer fire
    if (npcPhaseRef.current === phaseKey) return;

    // New phase — cancel any pending timer from old phase
    if (npcTimerRef.current) { clearTimeout(npcTimerRef.current); npcTimerRef.current = null; }

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
        } catch (e) {}
      }, 2000);
      return;
    }

    // NPC: Ephemeral Season Spring — roll D4 for heal amount (crit = 2, else 1), then advance after a short delay so server sees the roll
    const springWinFaces = (turn as any)?.springHealWinFaces;
    const springRoll = (turn as any)?.springHealRoll;
    if (turn.phase === PHASE.ROLLING_SPRING_HEAL && Array.isArray(springWinFaces) && springWinFaces.length > 0 && springRoll == null && teamBIds.has(turn.attackerId)) {
      schedule(async () => {
        const roll = Math.ceil(Math.random() * 4);
        try {
          await update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { springHealRoll: roll });
          await new Promise((r) => setTimeout(r, 800));
          await advanceAfterSpringHealD4(arenaId);
        } catch (e) {}
      }, 2000);
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
        } catch (e) {}
      }, 2000);
      return;
    }

    // NPC's turn to select target → pick random alive opponent (filtered by power requirements and Shadow Camouflage)
    if (turn.phase === PHASE.SELECT_TARGET && teamBIds.has(turn.attackerId)) {
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
  const teamAMembers = (effectiveRoom.teamA?.members || []).map(m => normalizeFighter(m));
  const teamBMembers = (effectiveRoom.teamB?.members || []).map(m => normalizeFighter(m));
  const teamBFull = teamBMembers.length >= (effectiveRoom.teamB?.maxSize ?? 1);
  const teamBIds = new Set(teamBMembers.map((m) => m.characterId));
  const isCreator = teamAMembers[0]?.characterId === user?.characterId;
  const battle = effectiveRoom.battle;
  const isBattling = effectiveRoom.status === ROOM_STATUS.BATTLING || effectiveRoom.status === ROOM_STATUS.FINISHED;
  const isNpcPlaybackDriver = !!(effectiveRoom.testMode && battle?.turn?.attackerId && teamBMembers.some((m) => m.characterId === battle.turn?.attackerId) && isCreator);
  const isPlaybackDriver = !!(battle?.turn?.attackerId === user?.characterId || isNpcPlaybackDriver);
  /** When true, attacker is NPC (PvE test mode); D4 crit/chain must be simulated on this client. When false (PvP), wait for opponent's roll. */
  const isAttackerNpc = !!(effectiveRoom.testMode && battle?.turn?.attackerId && teamBIds.has(battle.turn.attackerId));
  /** When true, defender is NPC; dodge D4 must be simulated here. When false (PvP), wait for opponent's roll. */
  const isDefenderNpc = !!(effectiveRoom.testMode && battle?.turn?.defenderId && teamBIds.has(battle.turn.defenderId));

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
    // 3s visual delay for the selecting player, then apply effects + end turn
    setTimeout(async () => {
      await confirmSeason(arenaId);
    }, 3000);
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
    await cancelPoemSelection(arenaId);
  };

  const handleCancelTarget = async () => {
    setSuppressHitAfterBack(true);
    if (suppressHitAfterBackTimerRef.current) clearTimeout(suppressHitAfterBackTimerRef.current);
    suppressHitAfterBackTimerRef.current = setTimeout(() => {
      setSuppressHitAfterBack(false);
      suppressHitAfterBackTimerRef.current = null;
    }, 500);
    if (!arenaId) return;
    try { setMinionPulseMap({}); } catch (e) {}
    try {
      await update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE}`), { [ARENA_PATH.BATTLE_LAST_HIT_MINION_ID]: null, [ARENA_PATH.BATTLE_LAST_HIT_TARGET_ID]: null });
    } catch (e) {}
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
              />
            ) : (
              <div className="arena__empty-slot">
                <span>Awaiting Challenger…</span>
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
          {effectiveRoom.teamSize > 1 && (
            <span className="arena__bar-badge">{effectiveRoom.teamSize}v{effectiveRoom.teamSize}</span>
          )}
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
            myId={user?.characterId}
            resolveShown={resolveShown}
            transientEffectsActive={transientEffectsActive}
            soulDevourerHealReady={soulDevourerHealReady}
            casterFrameRef={casterFrameRef}
            defenderFrameRef={defenderFrameRef}
            minionPulseMap={minionPulseMap}
            currentSkeletonHitTargetId={currentSkeletonHitTargetId}
            currentSkeletonPulseKey={currentSkeletonPulseKey}
            onSelectTarget={onSelectTargetDeferred}
            clientVisualDefenderId={npcVisualTarget}
            clientVisualPowerName={npcVisualPowerName}
            suppressHitAfterBack={suppressHitAfterBack}
            floralHealResultCardVisible={floralHealResultCardVisible}
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
              myId={user?.characterId}
              resolveShown={resolveShown}
              transientEffectsActive={transientEffectsActive}
              soulDevourerHealReady={soulDevourerHealReady}
              casterFrameRef={casterFrameRef}
              defenderFrameRef={defenderFrameRef}
              minionPulseMap={minionPulseMap}
              currentSkeletonHitTargetId={currentSkeletonHitTargetId}
              currentSkeletonPulseKey={currentSkeletonPulseKey}
              onSelectTarget={onSelectTargetDeferred}
              floralHealResultCardVisible={floralHealResultCardVisible}
              clientVisualDefenderId={npcVisualTarget}
              clientVisualPowerName={npcVisualPowerName}
              suppressHitAfterBack={suppressHitAfterBack}
            />
          ) : (
            <div className="arena__empty-slot">
              <span>Awaiting Challenger…</span>
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

        {/* Battle HUD overlay */}
        {isBattling && battle && (
          <BattleHUD
            arenaId={arenaId}
            battle={battle}
            teamA={teamAMembers}
            teamB={teamBMembers}
            teamMinionsA={effectiveRoom.teamA?.minions}
            teamMinionsB={effectiveRoom.teamB?.minions}
            myId={user?.characterId}
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
            onHealSkippedAck={handleHealSkippedAck}
            initialShowPowers={returnFromSeason}
            onSubmitAttackRoll={handleSubmitAttackRoll}
            onSubmitDefendRoll={handleSubmitDefendRoll}
            onResolve={handleResolveTurn}
            isPlaybackDriver={isPlaybackDriver}
            isViewer={role === ARENA_ROLE.VIEWER}
            isAttackerNpc={isAttackerNpc}
            isDefenderNpc={isDefenderNpc}
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
