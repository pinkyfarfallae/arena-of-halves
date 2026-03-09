import { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { flushSync } from 'react-dom';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ref, update } from 'firebase/database';
import { db } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { getPowers } from '../../data/powers';
import { fetchNPCs, pickRandomNPC } from '../../data/npcs';
import { POWER_OVERRIDES } from '../CharacterInfo/constants/overrides';
import { EFFECT_TAGS, isSeasonTag, SEASON_TAG_PREFIX } from '../../constants/effectTags';
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
  cancelTargetSelection,
  submitAttackRoll,
  submitDefendRoll,
  resolveTurn,
  normalizeFighter,
  advanceAfterShadowCamouflageD4,
  skipTurnNoValidTarget,
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


function Arena() {
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
  // Clear hit-pulse state when leaving RESOLVING so the next target selection doesn't show a stored shake
  const prevPhaseRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const phase = room?.battle?.turn?.phase;
    if (prevPhaseRef.current === PHASE.RESOLVING && phase !== PHASE.RESOLVING) {
      setMinionPulseMap({});
    }
    prevPhaseRef.current = phase;
  }, [room?.battle?.turn?.phase]);

  // Clear pulse map when skeleton chain ends (transientEffectsActive true → false) so next turn is fresh
  const prevTransientRef = useRef(false);
  useEffect(() => {
    if (prevTransientRef.current && !transientEffectsActive) setMinionPulseMap({});
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
  // Local visual override used when NPC schedules a target but server update is delayed
  const [npcVisualTarget, setNpcVisualTarget] = useState<string | null>(null);
  const [npcVisualPowerName, setNpcVisualPowerName] = useState<string | null>(null);

  // Track active season from Ephemeral Season power (displayed for 2 turns)
  const [activeSeason, setActiveSeason] = useState<SeasonKey | null>(null);
  const [returnFromSeason, setReturnFromSeason] = useState(false);

  /** Set when user confirms a power in the action modal (action === POWER). Cleared when turn/phase changes. */
  const [lastConfirmedPowerName, setLastConfirmedPowerName] = useState<string | null>(null);

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
    } else {
      setLastConfirmedPowerName(null);
    }
    runAsync(() => handleSelectAction(action, powerName, allyTargetId));
  }, [runAsync, handleSelectAction]);

  /* ── Clear confirmed power name when leaving action/target flow (so next turn shows action modal) ── */
  useEffect(() => {
    const phase = room?.battle?.turn?.phase;
    if (phase && phase !== PHASE.SELECT_ACTION && phase !== PHASE.SELECT_TARGET) {
      setLastConfirmedPowerName(null);
    }
  }, [room?.battle?.turn?.phase]);

  /* ── Subscribe to room changes ──────────────── */
  useEffect(() => {
    if (!arenaId) return;
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
  }, [arenaId]);

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
        // Extra delay after Floral Fragrance so scent wave visual plays
        const delay = turn.usedPowerName === POWER_NAMES.FLORAL_FRAGRANCE ? 5000 : 2000;
        // Show client-side visual selection immediately so NPC appears to aim (e.g., at skeletons)
        setNpcVisualTarget(target.characterId);
        // Preserve any known used power name (server may set turn.usedPowerName when arriving at select-target).
        // This ensures Floral powers have their visual name set so TeamPanel can show the scent VFX.
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
              // If Floral Fragrance, keep visual longer to allow scent VFX to play
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

    // Fallback: auto-resolve for NPC attacker only (BattleHUD handles player turns including crit)
    if (turn.phase === PHASE.RESOLVING && teamBIds.has(turn.attackerId)) {
      schedule(() => resolveTurn(arenaId), 15000);
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

  /* ── Copy helpers ────────────────────────────── */
  const viewerLink = `${window.location.origin}${window.location.pathname}#/arena/${arenaId}?watch=true`;

  const handleCopy = async (type: CopyType) => {
    const text = type === COPY_TYPE.CODE ? (arenaId || '') : viewerLink;
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setToast(type === COPY_TYPE.CODE ? 'Room code copied!' : 'Viewer link copied!');
    setTimeout(() => { setCopied(null); setToast(null); }, 2000);
  };

  /* ── Loading / Error states ─────────────────── */
  if (error) {
    return (
      <div className="arena">
        <div className="arena__state">
          <p className="arena__state-msg">{error}</p>
          <Link to="/arena" className="arena__action-btn arena__action-btn--secondary">Back to Lobby</Link>
        </div>
      </div>
    );
  }

  if (!room) {
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

  const viewerCount = room.viewers ? Object.keys(room.viewers).length : 0;
  const teamAMembers = (room.teamA?.members || []).map(m => normalizeFighter(m));
  const teamBMembers = (room.teamB?.members || []).map(m => normalizeFighter(m));
  const teamBFull = teamBMembers.length >= (room.teamB?.maxSize ?? 1);
  const isCreator = teamAMembers[0]?.characterId === user?.characterId;
  const battle = room.battle;
  const isBattling = room.status === ROOM_STATUS.BATTLING || room.status === ROOM_STATUS.FINISHED;

  /** Which power is selected this turn: from server (battle.turn.usedPowerName) or from last confirm (lastConfirmedPowerName). */
  const selectedPowerName = battle?.turn?.usedPowerName ?? lastConfirmedPowerName;

  const handlePreviewSeason = (season: SeasonKey | null) => {
    setActiveSeason(season);
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
          <span className="arena__bar-name">{room.roomName}</span>
        </div>

        <span className="arena__bar-spacer" />

        <div className="arena__bar-meta">
          {room.teamSize > 1 && (
            <span className="arena__bar-badge">{room.teamSize}v{room.teamSize}</span>
          )}
          {role === ARENA_ROLE.VIEWER && (
            <span className="arena__bar-badge arena__bar-badge--spectator">Spectating</span>
          )}
          {viewerCount > 0 && (
            <span className="arena__bar-viewers">{viewerCount} watching</span>
          )}
        </div>

        {room.status === ROOM_STATUS.FINISHED ? (
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
            {room.status === ROOM_STATUS.WAITING && (
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
      <div className={`arena__field ${room.status !== ROOM_STATUS.BATTLING ? 'arena__field--finished' : ''}`}>
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
            teamMinions={room.teamA?.minions}
            myId={user?.characterId}
            resolveShown={resolveShown}
            transientEffectsActive={transientEffectsActive}
            soulDevourerHealReady={soulDevourerHealReady}
            casterFrameRef={casterFrameRef}
            defenderFrameRef={defenderFrameRef}
            minionPulseMap={minionPulseMap}
            onSelectTarget={onSelectTargetDeferred}
            clientVisualDefenderId={npcVisualTarget}
            clientVisualPowerName={npcVisualPowerName}
            suppressHitAfterBack={suppressHitAfterBack}
          />
          {/* Seasonal effects overlay (left side) */}
          <SeasonalEffects season={activeSeason ?? undefined} side={PANEL_SIDE.LEFT} isActive={!!activeSeason && room?.status !== ROOM_STATUS.FINISHED} />
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
              teamMinions={room.teamB?.minions}
              myId={user?.characterId}
              resolveShown={resolveShown}
              transientEffectsActive={transientEffectsActive}
              soulDevourerHealReady={soulDevourerHealReady}
              casterFrameRef={casterFrameRef}
              defenderFrameRef={defenderFrameRef}
              minionPulseMap={minionPulseMap}
              onSelectTarget={onSelectTargetDeferred}
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
          <SeasonalEffects season={activeSeason ?? undefined} side={PANEL_SIDE.RIGHT} isActive={!!activeSeason && room?.status !== ROOM_STATUS.FINISHED} />
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
            teamMinionsA={room.teamA?.minions}
            teamMinionsB={room.teamB?.minions}
            myId={user?.characterId}
            transientEffectsActive={transientEffectsActive}
            confirmedPowerName={selectedPowerName}
            onSelectTarget={onSelectTargetDeferred}
            onSelectAction={onSelectActionDeferred}
            onSelectSeason={handleSelectSeason}
            onPreviewSeason={handlePreviewSeason}
            onCancelSeason={handleCancelSeason}
            onCancelTarget={handleCancelTarget}
            onSkipTurnNoTarget={handleSkipTurnNoTarget}
            initialShowPowers={returnFromSeason}
            onSubmitAttackRoll={handleSubmitAttackRoll}
            onSubmitDefendRoll={handleSubmitDefendRoll}
            onResolve={handleResolveTurn}
            onResolveVisible={setResolveShown}
            onTransientEffectsActive={setTransientEffectsActive}
            onSoulDevourerHealReady={setSoulDevourerHealReady}
            onMinionHitPulse={(attackerId: string, defenderId: string) => {
              minionPulseCounterRef.current += 1;
              const pulseId = minionPulseCounterRef.current;
              flushSync(() => setMinionPulseMap((m) => ({ ...m, [defenderId]: pulseId })));
              // Don't clear per-pulse: that removed pulse 1 before skeleton 2 (2.5s), so only 1 shake. Map cleared when chain ends (transientEffectsActive→false) and when leaving RESOLVING.
            }}
          />
        )}
      </div>

      {/* ── Footer actions ── */}
      <div className="arena__actions">
        {isCreator && room.status === ROOM_STATUS.READY && (
          <button className="arena__action-btn arena__action-btn--primary" onClick={() => runAsync(handleStartBattle)}>
            Start Battle
          </button>
        )}
        {isCreator && room.status === ROOM_STATUS.WAITING && (
          <button className="arena__action-btn arena__action-btn--danger" onClick={() => runAsync(handleClose)}>
            Close Room
          </button>
        )}
      </div>

      {showLog && room && (
        <BattleLogModal room={room} onClose={() => setShowLog(false)} />
      )}
    </div>
  );
}

export default Arena;
