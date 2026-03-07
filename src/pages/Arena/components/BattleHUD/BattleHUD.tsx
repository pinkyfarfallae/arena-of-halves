import { useRef, useCallback, useEffect, useState } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../../../../firebase';
import type { BattleState, FighterState } from '../../../../types/battle';
import { checkCritical, getWinningFaces } from '../../../../services/battleRoom';
import { getStatModifier } from '../../../../services/powerEngine';
import type { SeasonKey } from '../../../../data/seasons';
import WinBadge from './icons/Winner';
import LoseBadge from './icons/Loser';
import TargetSelectModal from './components/TargetSelectModal/TargetSelectModal';
import ActionSelectModal from './components/ActionSelectModal/ActionSelectModal';
import SeasonSelectModal from './components/SeasonSelectModal/SeasonSelectModal';
import DiceModal from './components/DiceModal/DiceModal';
import DamageCard from './components/DamageCard/DamageCard';
import './BattleHUD.scss';
import ResurrectingModal from './components/ResurrectingModal/ResurrectingModal';
import { DEFAULT_THEME } from '../../../../constants/theme';
import { EFFECT_TAGS } from '../../../../constants/effectTags';
import { POWER_NAMES, POWER_TYPES } from '../../../../constants/powers';
import { ARENA_PATH, BATTLE_TEAM, PHASE, getPhaseLabel, PANEL_SIDE, TURN_ACTION, type PanelSide } from '../../../../constants/battle';
import { TARGET_TYPES } from '../../../../constants/effectTypes';

/** Keep element rendered during a fade-out exit animation. */
function useFadeTransition(visible: boolean, ms = 250) {
  const [show, setShow] = useState(false);
  const [exit, setExit] = useState(false);
  const showRef = useRef(false);

  useEffect(() => {
    if (visible) {
      showRef.current = true;
      setShow(true);
      setExit(false);
    } else if (showRef.current) {
      setExit(true);
      const t = setTimeout(() => {
        showRef.current = false;
        setShow(false);
        setExit(false);
      }, ms);
      return () => clearTimeout(t);
    }
  }, [visible, ms]);

  return [show, exit] as const;
}

interface Props {
  arenaId?: string;
  battle: BattleState;
  teamA: FighterState[];
  teamB: FighterState[];
  teamMinionsA?: any[];
  teamMinionsB?: any[];
  myId: string | undefined;
  transientEffectsActive?: boolean;
  onSelectTarget: (defenderId: string) => void;
  onSelectAction: (action: 'attack' | 'power', powerIndex?: number, allyTargetId?: string) => void;
  onSelectSeason: (season: SeasonKey) => void;
  onPreviewSeason?: (season: SeasonKey | null) => void;
  onCancelSeason?: () => void;
  onCancelTarget?: () => void;
  initialShowPowers?: boolean;
  onSubmitAttackRoll: (roll: number) => void;
  onSubmitDefendRoll: (roll: number) => void;
  onResolve: () => void;
  onResolveVisible?: (visible: boolean) => void;
  onTransientEffectsActive?: (active: boolean) => void;
  onMinionHitPulse?: (attackerId: string, defenderId: string) => void;
}

/** Find a fighter across both teams */
function find(teamA: FighterState[], teamB: FighterState[], id: string): FighterState | undefined {
  // Search main members first
  const found = [...teamA, ...teamB].find((f) => f.characterId === id);
  if (found) return found;
  // Fallback: search team-level minions for transient display (map to FighterState-like)
  // @ts-ignore: minions may be absent in some battle formats
  const minionsA = (teamA as any[]).flatMap((m: any) => m?.minions ? m.minions : []);
  // @ts-ignore
  const minionsB = (teamB as any[]).flatMap((m: any) => m?.minions ? m.minions : []);
  const allMinions = [...minionsA, ...minionsB];
  const m = allMinions.find((mn: any) => mn && mn.characterId === id);
  if (m) {
    return {
      characterId: m.characterId,
      nicknameEng: m.nicknameEng || m.characterId,
      nicknameThai: m.nicknameThai || m.nicknameEng || m.characterId,
      sex: m.sex || 'unknown',
      deityBlood: m.deityBlood || 'unknown',
      image: m.image,
      theme: m.theme || DEFAULT_THEME[m.deityBlood] || DEFAULT_THEME[0],
      maxHp: m.maxHp || 1,
      currentHp: m.currentHp || 1,
      attackDiceUp: m.attackDiceUp || 0,
      defendDiceUp: m.defendDiceUp || 0,
      speed: m.speed || 0,
      rerollsLeft: m.rerollsLeft || 0,
      passiveSkillPoint: m.passiveSkillPoint || '',
      skillPoint: m.skillPoint || '',
      ultimateSkillPoint: m.ultimateSkillPoint || '',
      technique: m.technique || 0,
      quota: m.quota || 0,
      maxQuota: m.maxQuota || 0,
      criticalRate: m.criticalRate || 0,
      powers: m.powers || [],
    } as FighterState;
  }
  return undefined;
}

export default function BattleHUD({
  arenaId, battle, teamA, teamB, teamMinionsA, teamMinionsB, myId, transientEffectsActive,
  onSelectTarget, onSelectAction, onSelectSeason, onPreviewSeason, onCancelSeason, onCancelTarget, initialShowPowers, onSubmitAttackRoll, onSubmitDefendRoll, onResolve, onResolveVisible, onTransientEffectsActive, onMinionHitPulse,
}: Props) {
  const { turn, roundNumber, log = [], winner } = battle;

  const attacker = turn ? find(teamA, teamB, turn.attackerId) : undefined;
    // Keep canonical defender for HUD: even if a minion visually intercepted, the HUD should
    // still show the master as the defending target during resolving.
    const defender = turn?.defenderId ? find(teamA, teamB, turn.defenderId) : undefined;
    const isMyTurn = turn && turn.attackerId === myId;
    const isMyDefend = turn?.defenderId === myId;
  const opposingTeam = turn?.attackerTeam === BATTLE_TEAM.A ? teamB : teamA;

  // Filter targets based on power requirements (e.g., Jolt Arc needs 'shock')
  const targets = (() => {
    // Death Keeper: show dead teammates instead of alive enemies
    if (turn?.usedPowerIndex != null && attacker) {
      const power = attacker.powers[turn.usedPowerIndex];
      if (power?.name === POWER_NAMES.DEATH_KEEPER) {
        const myTeam = turn.attackerTeam === BATTLE_TEAM.A ? teamA : teamB;
        return (myTeam ?? []).filter((f) => f.currentHp <= 0);
      }
    }

    const alive = (opposingTeam ?? []).filter((f) => f.currentHp > 0);

    // If using a power that requires specific effect on target
    if (turn?.usedPowerIndex != null && attacker) {
      const power = attacker.powers[turn.usedPowerIndex];
      if (power?.requiresTargetHasEffect) {
        const requiredTag = power.requiresTargetHasEffect;
        const effects = battle.activeEffects || [];
        return alive.filter((f) =>
          effects.some((e) => e.targetId === f.characterId && e.tag === requiredTag)
        );
      }
    }

    return alive;
  })();

  /* ── Dice submit with brief delay so user sees result ── */
  const atkSubmitted = useRef(false);
  const defSubmitted = useRef(false);

  // Reset submitted flags when phase changes
  if (turn?.phase === PHASE.ROLLING_ATTACK) defSubmitted.current = false;
  if (turn?.phase === PHASE.SELECT_ACTION) atkSubmitted.current = false;

  const handleAttackRollResult = useCallback((n: number) => {
    if (atkSubmitted.current) return;
    atkSubmitted.current = true;
    setTimeout(() => onSubmitAttackRoll(n), 1500);
  }, [onSubmitAttackRoll]);

  const handleDefendRollResult = useCallback((n: number) => {
    if (defSubmitted.current) return;
    defSubmitted.current = true;
    setTimeout(() => onSubmitDefendRoll(n), 1500);
  }, [onSubmitDefendRoll]);

  /* ── Track when opponent auto-roll animations finish (for bonus text) ── */
  const [atkRollDone, setAtkRollDone] = useState(false);
  const [defRollDone, setDefRollDone] = useState(false);

  // Reset when phase changes
  useEffect(() => { setAtkRollDone(false); }, [turn?.phase]);
  useEffect(() => { setDefRollDone(false); }, [turn?.phase]);

  /* ── Sequencing: wait for opponent's dice to finish before next step ── */
  const [defendReady, setDefendReady] = useState(false);
  const [resolveReady, setResolveReady] = useState(false);

  // Reset ready flags when phase changes
  useEffect(() => { if (turn?.phase === PHASE.ROLLING_DEFEND) setDefendReady(false); }, [turn?.phase]);
  useEffect(() => { if (turn?.phase === PHASE.RESOLVING) setResolveReady(false); }, [turn?.phase]);

  // Clear transient DamageCard state when turn changes (avoid overlap into next attacker)
  useEffect(() => {
    setTransientDamage(null);
    setTransientDamageActive(false);
    setPendingSkeletonCount(0);
  }, [turn?.attackerId, turn?.defenderId, roundNumber]);

  // If I attacked, no attack replay to wait for → short delay
  useEffect(() => {
    if (turn?.phase === PHASE.ROLLING_DEFEND && turn.attackerId === myId) {
      const t = setTimeout(() => setDefendReady(true), 500);
      return () => clearTimeout(t);
    }
  }, [turn?.phase, turn?.attackerId, myId]);

  // If opponent attacked, wait for their roll animation to end + 2s viewing time
  useEffect(() => {
    if (atkRollDone && turn?.phase === PHASE.ROLLING_DEFEND) {
      const t = setTimeout(() => setDefendReady(true), 2000);
      return () => clearTimeout(t);
    }
  }, [atkRollDone, turn?.phase]);

  // If skipDice power was used, resolve immediately (no dice to show)
  useEffect(() => {
    if (turn?.phase === PHASE.RESOLVING && turn.action === TURN_ACTION.POWER && !turn.attackRoll) {
      const t = setTimeout(() => setResolveReady(true), 800);
      return () => clearTimeout(t);
    }
  }, [turn?.phase, turn?.action, turn?.attackRoll]);

  // If I defended, no replay to wait for → short delay (skip for skipDice powers)
  useEffect(() => {
    if (turn?.phase === PHASE.RESOLVING && turn.defenderId === myId && !(turn.action === TURN_ACTION.POWER && !turn.attackRoll)) {
      const t = setTimeout(() => setResolveReady(true), 500);
      return () => clearTimeout(t);
    }
  }, [turn?.phase, turn?.defenderId, turn?.action, turn?.attackRoll, myId]);

  // If opponent defended, wait for their roll animation to end + 2s viewing time
  useEffect(() => {
    if (defRollDone && turn?.phase === PHASE.RESOLVING) {
      const t = setTimeout(() => setResolveReady(true), 2000);
      return () => clearTimeout(t);
    }
  }, [defRollDone, turn?.phase]);

  /* ── Pomegranate's Oath: Dodge D4 check ── */
  const [dodgeReady, setDodgeReady] = useState(false);
  const [dodgeEligible, setDodgeEligible] = useState(false);
  const [dodgeRollResult, setDodgeRollResult] = useState(0);
  const dodgeRef = useRef({ winFaces: [] as number[], isDodged: false, roll: 0 });
  const dodgeInitKey = useRef('');
  const dodgeSubmitted = useRef(false);

  // Reset dodge state on phase change
  useEffect(() => {
    setDodgeReady(false);
    setDodgeEligible(false);
    setDodgeRollResult(0);
    dodgeInitKey.current = '';
    dodgeSubmitted.current = false;
    dodgeRef.current = { winFaces: [], isDodged: false, roll: 0 };
  }, [turn?.phase]);

  // Compute dodge eligibility when resolve is ready
  useEffect(() => {
    if (turn?.phase !== PHASE.RESOLVING || !resolveReady || !attacker || !defender || !turn.defenderId) return;
    const key = `dodge:${turn.attackerId}:${turn.defenderId}:${turn.attackRoll}:${turn.defendRoll}`;
    if (dodgeInitKey.current === key) return;
    dodgeInitKey.current = key;

    const isSkipDice = turn.action === TURN_ACTION.POWER && !turn.attackRoll;
    if (isSkipDice) { setDodgeReady(true); return; }

    // Check if defender has pomegranate-spirit
    const ae = battle.activeEffects || [];
    const hasSpirit = ae.some(e => e.targetId === turn.defenderId && e.tag === EFFECT_TAGS.POMEGRANATE_SPIRIT);
    if (!hasSpirit) { setDodgeReady(true); return; }

    // Check if attack actually hit (need hit to dodge)
    const atkBuff = getStatModifier(ae, turn.attackerId, 'attackDiceUp');
    const defBuff = getStatModifier(ae, turn.defenderId, 'defendDiceUp');
    const at = (turn.attackRoll ?? 0) + attacker.attackDiceUp + atkBuff;
    const dt = (turn.defendRoll ?? 0) + defender.defendDiceUp + defBuff;
    if (at <= dt) { setDodgeReady(true); return; }

    // Dodge D4: 50% → 2 winning faces
    const winFaces = (!isMyDefend && turn.dodgeWinFaces?.length) ? turn.dodgeWinFaces : getWinningFaces(50);

    if (isMyDefend) {
      dodgeRef.current = { winFaces, isDodged: false, roll: 0 };
      if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { dodgeWinFaces: winFaces });
      setDodgeEligible(true);
    } else if (turn.dodgeRoll != null && turn.dodgeRoll > 0) {
      dodgeRef.current = { winFaces, isDodged: !!turn.isDodged, roll: turn.dodgeRoll };
      setDodgeRollResult(turn.dodgeRoll);
      setDodgeEligible(true);
      setTimeout(() => setDodgeReady(true), 3500);
    } else {
      // NPC: compute dodge now
      const roll = Math.ceil(Math.random() * 4);
      const dg = winFaces.includes(roll);
      dodgeRef.current = { winFaces, isDodged: dg, roll };
      if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { isDodged: dg, dodgeRoll: roll, dodgeWinFaces: winFaces });
      setDodgeRollResult(roll);
      setDodgeEligible(true);
      setTimeout(() => setDodgeReady(true), 3500);
    }
  }, [turn, resolveReady, attacker, defender, battle.activeEffects, arenaId, isMyDefend]);

  // Player rolls dodge D4 manually (isMyDefend)
  const handleDodgeRollResult = useCallback((roll: number) => {
    if (dodgeSubmitted.current) return;
    dodgeSubmitted.current = true;
    const dr = dodgeRef.current;
    const dg = dr.winFaces.includes(roll);
    dodgeRef.current = { ...dr, isDodged: dg, roll };
    if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { isDodged: dg, dodgeRoll: roll });
    setTimeout(() => setDodgeReady(true), 1500);
  }, [arenaId]);

  // PvP watcher: defender rolled dodge D4 after we entered resolving
  useEffect(() => {
    if (turn?.phase !== PHASE.RESOLVING || !resolveReady || dodgeReady || !dodgeEligible) return;
    if (isMyDefend) return;
    if (dodgeRollResult > 0) return;
    if (turn?.dodgeRoll == null) return;
    dodgeRef.current = { ...dodgeRef.current, isDodged: !!turn.isDodged, roll: turn.dodgeRoll };
    setDodgeRollResult(turn.dodgeRoll);
    const t = setTimeout(() => setDodgeReady(true), 3500);
    return () => clearTimeout(t);
  }, [turn?.phase, resolveReady, dodgeReady, dodgeEligible, isMyDefend, dodgeRollResult, turn?.dodgeRoll, turn?.isDodged]);

  /* ── D4 critical hit check ── */
  const [critReady, setCritReady] = useState(false);
  const [critEligible, setCritEligible] = useState(false);
  const [critRollResult, setCritRollResult] = useState(0);
  const critRef = useRef({ effectiveCrit: 0, winFaces: [] as number[], isCrit: false, critRoll: 0 });
  const critInitKey = useRef('');
  const critSubmitted = useRef(false);

  // Reset crit state on phase change
  useEffect(() => {
    setCritReady(false);
    setCritEligible(false);
    setCritRollResult(0);
    critInitKey.current = '';
    critSubmitted.current = false;
    critRef.current = { effectiveCrit: 0, winFaces: [], isCrit: false, critRoll: 0 };
  }, [turn?.phase]);

  // Compute crit eligibility when dodge check is done
  useEffect(() => {
    if (turn?.phase !== PHASE.RESOLVING || !resolveReady || !dodgeReady || !attacker || !defender || !turn.defenderId) return;
    const key = `${turn.attackerId}:${turn.defenderId}:${turn.attackRoll}:${turn.defendRoll}`;
    if (critInitKey.current === key) return;
    critInitKey.current = key;

    // Dodged → skip crit
    if (dodgeRef.current.isDodged) { setCritReady(true); return; }

    const isSkipDice = turn.action === TURN_ACTION.POWER && !turn.attackRoll;
    if (isSkipDice) {
      setCritReady(true);
      return;
    }
    // Self-buff powers (e.g. Beyond the Cloud) still do normal attacks → allow crit
    const usedPowerDef = turn.action === TURN_ACTION.POWER && turn.usedPowerIndex != null
      ? attacker?.powers?.[turn.usedPowerIndex] : undefined;
    if (turn.action === TURN_ACTION.POWER && usedPowerDef?.target !== TARGET_TYPES.SELF) {
      setCritReady(true);
      return;
    }

    const ae = battle.activeEffects || [];
    const atkBuff = getStatModifier(ae, turn.attackerId, 'attackDiceUp');
    const defBuff = getStatModifier(ae, turn.defenderId, 'defendDiceUp');
    const atkTotal = (turn.attackRoll ?? 0) + attacker.attackDiceUp + atkBuff;
    const defTotal = (turn.defendRoll ?? 0) + defender.defendDiceUp + defBuff;

    if (atkTotal <= defTotal || atkTotal < 10) {
      setCritReady(true);
      return;
    }

    const critBuff = getStatModifier(ae, turn.attackerId, 'criticalRate');
    const effectiveCrit = Math.max(attacker.criticalRate, attacker.criticalRate + critBuff);

    if (effectiveCrit <= 0) {
      setCritReady(true);
      return;
    }

    if (effectiveCrit >= 100) {
      critRef.current = { effectiveCrit, winFaces: [1, 2, 3, 4], isCrit: true, critRoll: 0 };
      if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { isCrit: true, critRoll: 0, critWinFaces: [1, 2, 3, 4] });
      setCritEligible(true);
      setCritReady(true);
      return;
    }

    // Use attacker's stored winFaces (PvP watcher) or generate new ones
    const winFaces = (!isMyTurn && turn.critWinFaces?.length) ? turn.critWinFaces : getWinningFaces(effectiveCrit);

    if (isMyTurn) {
      // Player: manual D4 roll — write winFaces so PvP opponent sees the same faces
      critRef.current = { effectiveCrit, winFaces, isCrit: false, critRoll: 0 };
      if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { critWinFaces: winFaces });
      setCritEligible(true);
    } else if (turn.critRoll != null && turn.critRoll > 0) {
      // PvP: opponent already rolled before we got here
      critRef.current = { effectiveCrit, winFaces, isCrit: !!turn.isCrit, critRoll: turn.critRoll };
      setCritRollResult(turn.critRoll);
      setCritEligible(true);
      setTimeout(() => setCritReady(true), 3500);
    } else {
      // NPC: compute crit now, show replay immediately (no waiting)
      const crit = checkCritical(effectiveCrit, winFaces);
      critRef.current = { effectiveCrit, winFaces, isCrit: crit.isCrit, critRoll: crit.critRoll };
      if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { isCrit: crit.isCrit, critRoll: crit.critRoll, critWinFaces: winFaces });
      setCritRollResult(crit.critRoll);
      setCritEligible(true);
      setTimeout(() => setCritReady(true), 3500);
    }
  }, [turn, resolveReady, dodgeReady, attacker, defender, battle.activeEffects, arenaId, isMyTurn]);

  // Player rolls D4 manually (isMyTurn)
  const handleCritRollResult = useCallback((roll: number) => {
    if (critSubmitted.current) return;
    critSubmitted.current = true;
    const cd = critRef.current;
    const isCrit = cd.winFaces.includes(roll);
    critRef.current = { ...cd, isCrit, critRoll: roll };
    if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { isCrit, critRoll: roll });
    setTimeout(() => setCritReady(true), 1500);
  }, [arenaId]);

  // PvP watcher: opponent rolled D4 after we entered resolving
  useEffect(() => {
    if (turn?.phase !== PHASE.RESOLVING || !resolveReady || critReady || !critEligible) return;
    if (isMyTurn) return;
    if (critRollResult > 0) return; // Already have result (NPC or early PvP)
    if (turn?.critRoll == null) return;
    critRef.current = { ...critRef.current, isCrit: !!turn.isCrit, critRoll: turn.critRoll };
    setCritRollResult(turn.critRoll);
    const t = setTimeout(() => setCritReady(true), 3500);
    return () => clearTimeout(t);
  }, [turn?.phase, resolveReady, critReady, critEligible, isMyTurn, critRollResult, turn?.critRoll, turn?.isCrit]);

  /* ── Thunderbolt chain D4 check ── */
  const [chainReady, setChainReady] = useState(false);
  const [chainEligible, setChainEligible] = useState(false);
  const [chainRollResult, setChainRollResult] = useState(0);
  const chainRef = useRef({ winFaces: [] as number[], success: false, roll: 0 });
  const chainSubmitted = useRef(false);

  // Reset chain state on phase change
  useEffect(() => {
    setChainReady(false);
    setChainEligible(false);
    setChainRollResult(0);
    chainSubmitted.current = false;
    chainRef.current = { winFaces: [], success: false, roll: 0 };
  }, [turn?.phase]);

  // Compute chain eligibility when crit check is done
  useEffect(() => {
    if (turn?.phase !== PHASE.RESOLVING || !resolveReady || !critReady) return;
    // Dodged → skip chain
    if (dodgeRef.current.isDodged) { setChainReady(true); return; }
    if (turn.usedPowerName !== POWER_NAMES.THUNDERBOLT) {
      setChainReady(true);
      return;
    }
    // Skip chain in 1v1 (no chainWinFaces set by server)
    if (!turn.chainWinFaces || turn.chainWinFaces.length === 0) {
      setChainReady(true);
      return;
    }
    const winFaces = turn.chainWinFaces;
    chainRef.current = { winFaces, success: false, roll: 0 };

    if (isMyTurn) {
      // Player: manual D4 roll
      setChainEligible(true);
    } else if (turn.chainRoll != null && turn.chainRoll > 0) {
      // PvP: opponent already rolled
      chainRef.current = { winFaces, success: !!turn.chainSuccess, roll: turn.chainRoll };
      setChainRollResult(turn.chainRoll);
      setChainEligible(true);
      setTimeout(() => setChainReady(true), 3500);
    } else {
      // NPC: compute chain now
      const roll = Math.ceil(Math.random() * 4);
      const success = winFaces.includes(roll);
      chainRef.current = { winFaces, success, roll };
      if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { chainRoll: roll, chainSuccess: success });
      setChainRollResult(roll);
      setChainEligible(true);
      setTimeout(() => setChainReady(true), 3500);
    }
  }, [turn?.phase, resolveReady, critReady, turn?.usedPowerName, turn?.chainWinFaces, turn?.chainRoll, turn?.chainSuccess, arenaId, isMyTurn]);

  // Player rolls chain D4 manually
  const handleChainRollResult = useCallback((roll: number) => {
    if (chainSubmitted.current) return;
    chainSubmitted.current = true;
    const cr = chainRef.current;
    const success = cr.winFaces.includes(roll);
    chainRef.current = { ...cr, success, roll };
    if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { chainRoll: roll, chainSuccess: success });
    setTimeout(() => setChainReady(true), 1500);
  }, [arenaId]);

  // PvP watcher: opponent rolled chain D4 after we entered resolving
  useEffect(() => {
    if (turn?.phase !== PHASE.RESOLVING || !resolveReady || !critReady || chainReady || !chainEligible) return;
    if (isMyTurn) return;
    if (chainRollResult > 0) return;
    if (turn?.chainRoll == null) return;
    chainRef.current = { ...chainRef.current, success: !!turn.chainSuccess, roll: turn.chainRoll };
    setChainRollResult(turn.chainRoll);
    const t = setTimeout(() => setChainReady(true), 3500);
    return () => clearTimeout(t);
  }, [turn?.phase, resolveReady, critReady, chainReady, chainEligible, isMyTurn, chainRollResult, turn?.chainRoll, turn?.chainSuccess]);

  /* ── Pomegranate's Oath: Co-attack D12 ── */
  const [coAttackReady, setCoAttackReady] = useState(false);
  const [coAttackEligible, setCoAttackEligible] = useState(false);
  const [coAttackRollResult, setCoAttackRollResult] = useState(0);
  const coAttackRef = useRef({ casterId: '', hit: false, damage: 0, roll: 0 });
  const coAttackSubmitted = useRef(false);

  // Reset co-attack state on phase change
  useEffect(() => {
    setCoAttackReady(false);
    setCoAttackEligible(false);
    setCoAttackRollResult(0);
    coAttackSubmitted.current = false;
    coAttackRef.current = { casterId: '', hit: false, damage: 0, roll: 0 };
  }, [turn?.phase]);

  // Compute co-attack eligibility when all prior checks done
  useEffect(() => {
    if (turn?.phase !== PHASE.RESOLVING || !resolveReady || !dodgeReady || !critReady || !chainReady) return;
    if (!attacker || !defender || !turn.defenderId) { setCoAttackReady(true); return; }

    // Dodged → no co-attack
    if (dodgeRef.current.isDodged) { setCoAttackReady(true); return; }

    const isSkipDice = turn.action === TURN_ACTION.POWER && !turn.attackRoll;
    if (isSkipDice) { setCoAttackReady(true); return; }

    // Check if attacker (the one attacking this turn) has pomegranate-spirit
    const ae = battle.activeEffects || [];
    const spiritEffect = ae.find(e => e.targetId === turn.attackerId && e.tag === EFFECT_TAGS.POMEGRANATE_SPIRIT);
    if (!spiritEffect) { setCoAttackReady(true); return; }

    // Self-target (caster === oath-bearer): no co-attack
    if (spiritEffect.sourceId === turn.attackerId) { setCoAttackReady(true); return; }

    // Check if main attack hit
    const atkBuff = getStatModifier(ae, turn.attackerId, 'attackDiceUp');
    const defBuff = getStatModifier(ae, turn.defenderId, 'defendDiceUp');
    const at = (turn.attackRoll ?? 0) + attacker.attackDiceUp + atkBuff;
    const dt = (turn.defendRoll ?? 0) + defender.defendDiceUp + defBuff;
    if (at <= dt) { setCoAttackReady(true); return; }

    // Check if caster is alive
    const casterId = spiritEffect.sourceId;
    const caster = find(teamA, teamB, casterId);
    if (!caster || caster.currentHp <= 0) { setCoAttackReady(true); return; }

    coAttackRef.current = { casterId, hit: false, damage: 0, roll: 0 };
    const isMyCaster = casterId === myId;

    if (isMyCaster) {
      if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { coAttackerId: casterId });
      setCoAttackEligible(true);
    } else if (turn.coAttackRoll != null && turn.coAttackRoll > 0) {
      // PvP: opponent already rolled
      coAttackRef.current = { casterId, hit: !!turn.coAttackHit, damage: turn.coAttackDamage ?? 0, roll: turn.coAttackRoll };
      setCoAttackRollResult(turn.coAttackRoll);
      setCoAttackEligible(true);
      setTimeout(() => setCoAttackReady(true), 3500);
    } else {
      // NPC: compute co-attack now
      const roll = Math.ceil(Math.random() * 12);
      const coBuff = getStatModifier(ae, casterId, 'attackDiceUp');
      const coTotal = roll + caster.attackDiceUp + coBuff;
      const coHit = coTotal > dt;
      const coDmgBuff = getStatModifier(ae, casterId, 'damage');
      const coDmg = coHit ? Math.max(0, caster.damage + coDmgBuff) : 0;
      coAttackRef.current = { casterId, hit: coHit, damage: coDmg, roll };
      if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { coAttackRoll: roll, coAttackerId: casterId, coAttackHit: coHit, coAttackDamage: coDmg });
      setCoAttackRollResult(roll);
      setCoAttackEligible(true);
      setTimeout(() => setCoAttackReady(true), 3500);
    }
  }, [turn, resolveReady, dodgeReady, critReady, chainReady, attacker, defender, battle.activeEffects, teamA, teamB, arenaId, myId]);

  // Player rolls co-attack D12 manually (isMyCaster)
  const handleCoAttackRollResult = useCallback((roll: number) => {
    if (coAttackSubmitted.current) return;
    coAttackSubmitted.current = true;
    const cr = coAttackRef.current;
    const ae = battle.activeEffects || [];
    const caster = find(teamA, teamB, cr.casterId);
    if (!caster || !turn?.defenderId || !defender) return;
    const coBuff = getStatModifier(ae, cr.casterId, 'attackDiceUp');
    const defBuff = getStatModifier(ae, turn.defenderId, 'defendDiceUp');
    const coTotal = roll + caster.attackDiceUp + coBuff;
    const dt = (turn.defendRoll ?? 0) + defender.defendDiceUp + defBuff;
    const coHit = coTotal > dt;
    const coDmgBuff = getStatModifier(ae, cr.casterId, 'damage');
    const coDmg = coHit ? Math.max(0, caster.damage + coDmgBuff) : 0;
    coAttackRef.current = { ...cr, hit: coHit, damage: coDmg, roll };
    if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { coAttackRoll: roll, coAttackHit: coHit, coAttackDamage: coDmg });
    setTimeout(() => setCoAttackReady(true), 1500);
  }, [arenaId, battle.activeEffects, teamA, teamB, turn, defender]);

  // PvP watcher: caster rolled co-attack after we entered resolving
  useEffect(() => {
    if (turn?.phase !== PHASE.RESOLVING || !resolveReady || !critReady || !chainReady || coAttackReady || !coAttackEligible) return;
    if (coAttackRef.current.casterId === myId) return;
    if (coAttackRollResult > 0) return;
    if (turn?.coAttackRoll == null) return;
    coAttackRef.current = { ...coAttackRef.current, hit: !!turn.coAttackHit, damage: turn.coAttackDamage ?? 0, roll: turn.coAttackRoll };
    setCoAttackRollResult(turn.coAttackRoll);
    const t = setTimeout(() => setCoAttackReady(true), 3500);
    return () => clearTimeout(t);
  }, [turn?.phase, resolveReady, critReady, chainReady, coAttackReady, coAttackEligible, myId, coAttackRollResult, turn?.coAttackRoll, turn?.coAttackHit, turn?.coAttackDamage]);

  /* ── Auto-resolve after showing result (only after all checks done) ── */
  // Transient DamageCard state (declare early so effects can reference)
  const [transientDamageActive, setTransientDamageActive] = useState(false);
  const [transientDamage, setTransientDamage] = useState<ResolveCacheType | null>(null);
  // State-based count so auto-resolve re-runs when all skeleton playbacks finish
  const [pendingSkeletonCount, setPendingSkeletonCount] = useState(0);
  useEffect(() => {
    if (turn?.phase !== PHASE.RESOLVING || !resolveReady || !dodgeReady || !critReady || !chainReady || !coAttackReady) return;

    // Do not auto-resolve until every skeleton/minion DamageCard has finished.
    const hasPendingPlayback = transientDamageActive || pendingSkeletonCount > 0 || !!transientEffectsActive;
    if (hasPendingPlayback) {
      return;
    }

    const timer = setTimeout(() => onResolve(), 5000);
    return () => clearTimeout(timer);
  }, [turn?.phase, resolveReady, dodgeReady, critReady, chainReady, coAttackReady, onResolve, transientDamageActive, pendingSkeletonCount, transientEffectsActive]);

  /* ── Floral Fragrance: delay target selection so scent wave visual plays ── */
  const [floralDelay, setFloralDelay] = useState(false);
  useEffect(() => {
    if (turn?.phase === PHASE.SELECT_TARGET && turn.usedPowerName === POWER_NAMES.FLORAL_FRAGRANCE && turn.allyTargetId) {
      setFloralDelay(true);
      const t = setTimeout(() => setFloralDelay(false), 3000);
      return () => clearTimeout(t);
    }
    setFloralDelay(false);
  }, [turn?.phase, turn?.usedPowerName, turn?.allyTargetId]);

  /* ── Fade transitions for resolve & waiting panels ── */
  const resolveVisible = turn?.phase === PHASE.RESOLVING && resolveReady && dodgeReady && critReady && chainReady && coAttackReady && !!attacker && !!defender;
  const waitingVisible = !!(!isMyTurn && turn?.phase === PHASE.SELECT_TARGET && !floralDelay);
  // Signal parent when resolve becomes visible (for hit effects)
  useEffect(() => {
    onResolveVisible?.(resolveVisible);
  }, [resolveVisible, onResolveVisible]);
  // Keep resolve panel visible while a transient DamageCard (minion hit) is showing
  const [showResolve, resolveExiting] = useFadeTransition(resolveVisible || transientDamageActive, 250);
  const [showWaiting, waitingExiting] = useFadeTransition(waitingVisible, 250);
  // Prevent re-processing the same `lastSkeletonHits` buffer repeatedly
  // (Firebase may update unrelated fields, causing `battle` to change refs).
  const lastSkeletonHitsKeyRef = useRef<string | null>(null);
  // Throttle DB writes for last-hit markers to avoid hitting rate limits
  // when many skeletons play in quick succession. We batch the latest
  // payload and write it at most once per `WRITE_THROTTLE_MS` window.
  const lastHitWriteTimerRef = useRef<number | null>(null);
  const pendingLastHitPayloadRef = useRef<Record<string, unknown> | null>(null);
  const WRITE_THROTTLE_MS = 140; // ms

  const scheduleLastHitUpdate = (payload: Record<string, unknown>) => {
    pendingLastHitPayloadRef.current = payload;
    if (lastHitWriteTimerRef.current != null) return;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    lastHitWriteTimerRef.current = window.setTimeout(() => {
      const p = pendingLastHitPayloadRef.current;
      pendingLastHitPayloadRef.current = null;
      lastHitWriteTimerRef.current = null;
      if (!p) return;
      try { update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE}`), p).catch(() => {}); } catch (e) {}
    }, WRITE_THROTTLE_MS) as unknown as number;
  };

  useEffect(() => {
    return () => {
      if (lastHitWriteTimerRef.current) clearTimeout(lastHitWriteTimerRef.current);
      pendingLastHitPayloadRef.current = null;
    };
  }, []);
  // Also render DamageCards directly from transient server buffer `lastSkeletonHits`
  const lastSkeletonHits = (battle as any)?.lastSkeletonHits as any[] | undefined;
  useEffect(() => {
    const skHits = lastSkeletonHits;
    if (!Array.isArray(skHits) || skHits.length === 0) return;

    // Build a stable key for this buffer so we don't reprocess the same data
    // multiple times if unrelated parts of `battle` change.
    const skKey = skHits.map((e: any) => `${String(e.attackerId)}|${String(e.defenderId)}|${String(e.isMinionHit)}|${String(e.damage ?? 0)}`).join(',');
    if (lastSkeletonHitsKeyRef.current === skKey) return;
    lastSkeletonHitsKeyRef.current = skKey;

    const HIT_DISPLAY_MS = 1500;
    setPendingSkeletonCount((c) => c + skHits.length);

    let index = 0;
    const showNext = () => {
      if (index >= skHits.length) {
        try { update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE}`), { [ARENA_PATH.BATTLE_LAST_SKELETON_HITS]: null }); } catch (e) {}
        lastSkeletonHitsKeyRef.current = null;
        return;
      }
      const entry = skHits[index];
      const atk = find(teamA, teamB, entry.attackerId);
      const def = find(teamA, teamB, entry.defenderId);
      let transientMinion: any | undefined;
      if (!atk && (teamMinionsA || teamMinionsB)) {
        const allMinions = [...(teamMinionsA || []), ...(teamMinionsB || [])];
        transientMinion = allMinions.find((mn: any) => mn && mn.characterId === entry.attackerId);
      }
      const attackerIsTeamA = !!(teamA || []).find(f => f.characterId === entry.attackerId);
      const rc = {
        isHit: !entry.missed,
        isPower: false,
        powerName: '',
        isCrit: !!(entry.isCrit),
        baseDmg: Number(entry.baseDmg) || 0,
        damage: (entry.damage as number) || 0,
        shockBonus: 0,
        atkRoll: 0,
        isDodged: false,
        coAttackHit: false,
        coAttackDamage: 0,
        attackerName: transientMinion?.nicknameEng?.toLowerCase() || atk?.nicknameEng || entry.attackerId,
        attackerTheme: atk?.theme?.[0] || (transientMinion?.theme ? transientMinion.theme[0] : '#666'),
        defenderName: def?.nicknameEng || entry.defenderId,
        defenderTheme: def?.theme?.[0] || '#666',
        side: (entry as any).isMinionHit
          ? (attackerIsTeamA ? PANEL_SIDE.RIGHT : PANEL_SIDE.LEFT)
          : (attackerIsTeamA ? PANEL_SIDE.LEFT : PANEL_SIDE.RIGHT),
      } as any;

      resolveCache.current = { ...resolveCache.current, ...rc } as any;
      onResolveVisible?.(true);
      setTransientDamage(rc as any);
      setTransientDamageActive(true);

      try {
        scheduleLastHitUpdate({ lastHitMinionId: entry.attackerId, lastHitTargetId: entry.defenderId });
      } catch (e) {}
      try { onMinionHitPulse?.(entry.attackerId, entry.defenderId); } catch (e) {}

      setTimeout(() => {
        setTransientDamage(null);
        setTransientDamageActive(false);
        setPendingSkeletonCount((c) => Math.max(0, c - 1));
        index++;
        showNext();
      }, HIT_DISPLAY_MS + 50);
    };

    const totalDisplayMs = skHits.length * (HIT_DISPLAY_MS + 50);
    setTimeout(() => {
      onResolveVisible?.(false);
      try { scheduleLastHitUpdate({ lastHitMinionId: null, lastHitTargetId: null }); } catch (e) {}
    }, totalDisplayMs);

    showNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scheduleLastHitUpdate is ref-stable; including it retriggers every render
  }, [lastSkeletonHits, battle, arenaId, teamA, teamB, teamMinionsA, teamMinionsB, onResolveVisible, onMinionHitPulse, turn]);

  // Notify parent when transient effects (transientDamageActive or skeleton buffer) are active
  useEffect(() => {
    const skBuffer = (battle as any)?.lastSkeletonHits as any[] | undefined;
    const hasPendingPlayback = transientDamageActive || (Array.isArray(skBuffer) && skBuffer.length > 0) || pendingSkeletonCount > 0;
    onTransientEffectsActive?.(hasPendingPlayback);
  }, [transientDamageActive, battle, pendingSkeletonCount, onTransientEffectsActive]);

  // Delay action modal until DamageCard exit animation finishes + 750ms pause
  const [actionReady, setActionReady] = useState(true);
  const [showResurrecting, setShowResurrecting] = useState(false);
  const selfResurrectShown = useRef('');
  useEffect(() => {
    if (turn?.phase === PHASE.SELECT_ACTION && showResolve) {
      setActionReady(false);
    } else if (turn?.phase === PHASE.SELECT_ACTION && !showResolve && !actionReady && !showResurrecting) {
      const timer = setTimeout(() => setActionReady(true), 750);
      return () => clearTimeout(timer);
    }
  }, [turn?.phase, showResolve, actionReady, showResurrecting]);

  // Self-resurrect: trigger overlay only after DamageCard is gone
  useEffect(() => {
    if (turn?.phase === PHASE.SELECT_ACTION && turn.resurrectTargetId === turn.attackerId && !showResolve) {
      const key = `${turn.attackerId}:${battle.roundNumber}`;
      if (selfResurrectShown.current !== key) {
        selfResurrectShown.current = key;
        setActionReady(false);
        setShowResurrecting(true);
      }
    }
  }, [turn?.phase, turn?.resurrectTargetId, turn?.attackerId, battle.roundNumber, showResolve]);

  // Self-resurrect: timer to dismiss overlay (separate effect so cleanup works with Strict Mode)
  useEffect(() => {
    if (!showResurrecting) return;
    const timer = setTimeout(() => { setShowResurrecting(false); setActionReady(true); }, 2500);
    return () => clearTimeout(timer);
  }, [showResurrecting]);

  // Cache resolve data so content doesn't flicker during exit animation
  type ResolveCacheType = {
    atkRoll: number;
    defRoll: number;
    atkBonus: number;
    defBonus: number;
    atkTotal: number;
    defTotal: number;
    isHit: boolean;
    damage: number;
    baseDmg: number;
    shockBonus: number;
    isPower: boolean;
    powerName: string;
    critEligible: boolean;
    isCrit: boolean;
    critRoll: number;
    isDodged: boolean;
    coAttackHit: boolean;
    coAttackDamage: number;
    attackerName: string;
    attackerTheme: string;
    defenderName: string;
    defenderTheme: string;
    side: PanelSide;
    shownLogIndex?: number;
    [key: string]: any;
  };
  const resolveCache = useRef<ResolveCacheType>({
    atkRoll: 0, defRoll: 0, atkBonus: 0, defBonus: 0, atkTotal: 0, defTotal: 0,
    isHit: false, damage: 0, baseDmg: 0, shockBonus: 0,
    isPower: false, powerName: '', critEligible: false, isCrit: false, critRoll: 0,
    isDodged: false, coAttackHit: false, coAttackDamage: 0,
    attackerName: '', attackerTheme: '', defenderName: '', defenderTheme: '',
    side: PANEL_SIDE.RIGHT,
  });
  if (resolveVisible && turn && attacker && defender) {
    const isSkipDicePower = turn.action === TURN_ACTION.POWER && !turn.attackRoll;
    if (isSkipDicePower) {
      // Read actual damage from log entry (skipDice powers write damage/aoeDamageMap to log)
      const lastLog = (battle.log || []).at(-1);
      const logDmg = (lastLog?.attackerId === turn.attackerId) ? (lastLog.damage ?? 0) : 0;
      resolveCache.current = {
        atkRoll: 0, defRoll: 0, atkBonus: 0, defBonus: 0, atkTotal: 0, defTotal: 0,
        isHit: true, damage: logDmg, baseDmg: 0, shockBonus: 0,
        isPower: true, powerName: turn.usedPowerName ?? 'Power',
        critEligible: false, isCrit: false, critRoll: 0,
        isDodged: false, coAttackHit: false, coAttackDamage: 0,
        attackerName: attacker.nicknameEng, attackerTheme: attacker.theme[0],
        defenderName: defender.nicknameEng, defenderTheme: defender.theme[0],
        side: turn.attackerTeam === 'teamA' ? PANEL_SIDE.RIGHT : PANEL_SIDE.LEFT,
      };
    } else {
      const activeEffects = battle.activeEffects || [];
      const atkBuff = getStatModifier(activeEffects, turn.attackerId, 'attackDiceUp');
      const defBuff = getStatModifier(activeEffects, turn.defenderId!, 'defendDiceUp');
      const at = (turn.attackRoll ?? 0) + attacker.attackDiceUp + atkBuff;
      const dt = (turn.defendRoll ?? 0) + defender.defendDiceUp + defBuff;
      const dmgBuff = getStatModifier(activeEffects, turn.attackerId, 'damage');
      const baseDmg = Math.max(0, attacker.damage + dmgBuff);
      let damage = baseDmg;

      // Read crit result from critRef (already determined by D4 roll)
      const cd = critRef.current;
      if (cd.isCrit) damage *= 2;

      // Shock detonation bonus: compute client-side (log isn't written until resolveTurn)
      // Lightning Reflex passive: if attacker has it + defender has shock DOTs → bonus = baseDmg
      let shockBonus = 0;
      if (at > dt && turn.action !== TURN_ACTION.POWER) {
        const hasLR = attacker.passiveSkillPoint === 'unlock' &&
          attacker.powers?.some(p => p.type === POWER_TYPES.PASSIVE && p.name === POWER_NAMES.LIGHTNING_REFLEX);
        const defShocks = hasLR && activeEffects.some(
          e => e.targetId === turn.defenderId && e.tag === EFFECT_TAGS.SHOCK,
        );
        if (defShocks) shockBonus = baseDmg;
      }
      damage += shockBonus;

      const dgd = dodgeRef.current.isDodged;
      const ca = coAttackRef.current;

      resolveCache.current = {
        atkRoll: turn.attackRoll ?? 0, defRoll: turn.defendRoll ?? 0,
        atkBonus: attacker.attackDiceUp + atkBuff, defBonus: defender.defendDiceUp + defBuff,
        atkTotal: at, defTotal: dt, isHit: at > dt && !dgd, damage: dgd ? 0 : damage, baseDmg, shockBonus,
        isPower: turn.action === TURN_ACTION.POWER, powerName: turn.usedPowerName ?? '',
        critEligible: !dgd && critEligible, isCrit: cd.isCrit, critRoll: cd.critRoll,
        isDodged: dgd, coAttackHit: ca.hit, coAttackDamage: ca.damage,
        attackerName: attacker.nicknameEng, attackerTheme: attacker.theme[0],
        defenderName: defender.nicknameEng, defenderTheme: defender.theme[0],
        side: turn.attackerTeam === 'teamA' ? PANEL_SIDE.RIGHT : PANEL_SIDE.LEFT,
      };
    }
  }

  // Play back new entries in the persistent battle.log so every hit (master + minions)
  // shows a DamageCard and triggers hit visuals. We track which log entries we've
  // already rendered using `shownLogIndex` to only play new entries.
  useEffect(() => {
    if (!arenaId) return;
    const logArr = battle.log || [];
    if (!Array.isArray(logArr)) return;
    const total = logArr.length;
    if (!('shownLogIndex' in resolveCache.current)) {
      // initialize to current length (don't replay old entries on mount)
      resolveCache.current.shownLogIndex = total;
      return;
    }

    const prevIndex: number = resolveCache.current.shownLogIndex || 0;
    if (total <= prevIndex) return;

    // If lastSkeletonHits is present, minion hits will be played from that buffer (chained);
    // skip playing them from log to avoid duplicate playback.
    const skBuffer = (battle as any)?.lastSkeletonHits as any[] | undefined;
    const minionHitsPlayedElsewhere = Array.isArray(skBuffer) && skBuffer.length > 0;

    const STAGGER_MS = 400;
    const HIT_DISPLAY_MS = 1500;
    let delayAcc = 0;

    for (let i = prevIndex; i < total; i++) {
      const entry = logArr[i];
      if ((entry as any).isMinionHit && minionHitsPlayedElsewhere) {
        delayAcc += STAGGER_MS;
        continue;
      }
      const delay = delayAcc;
      delayAcc += STAGGER_MS;

      setTimeout(() => {
        // Map attacker/defender to fighter/minion display names
        const atk = find(teamA, teamB, entry.attackerId);
        const def = find(teamA, teamB, entry.defenderId);
        // fallback to teamMinions arrays
        let minionFromTeams: any | undefined;
        if (!atk && (teamMinionsA || teamMinionsB)) {
          const allMinions = [...(teamMinionsA || []), ...(teamMinionsB || [])];
          minionFromTeams = allMinions.find((mn: any) => mn && mn.characterId === entry.attackerId);
        }

        // Determine whether the attacker belongs to teamA (used for deciding DamageCard side)
        const attackerIsTeamA = !!(teamA || []).find((f: any) => f.characterId === entry.attackerId);

        const rc = {
          isHit: !entry.missed,
          isPower: !!entry.powerUsed,
          powerName: entry.powerUsed || '',
          isCrit: !!(entry.isCrit),
          baseDmg: (Number((entry as any).baseDmg) || 0) as number,
          damage: (entry.damage as number) || 0,
          shockBonus: (entry.shockDamage as number) || 0,
          atkRoll: (entry.attackRoll as number) || 0,
          isDodged: !!entry.isDodged,
          coAttackHit: !!entry.coAttackDamage,
          coAttackDamage: (entry.coAttackDamage as number) || 0,
          // Use lowercase minion nickname for minion attacker when available
          attackerName: (entry as any).isMinionHit
            ? (minionFromTeams?.nicknameEng?.toLowerCase().slice(0,11) + "..." || atk?.nicknameEng || entry.attackerId)
            : (atk?.nicknameEng || minionFromTeams?.nicknameEng || entry.attackerId),
          attackerTheme: atk?.theme?.[0] || (minionFromTeams?.theme ? minionFromTeams.theme[0] : '#666'),
          defenderName: def?.nicknameEng || entry.defenderId,
          defenderTheme: def?.theme?.[0] || '#666',
          // For minion hits, show DamageCard on defender side (opposite of attacker);
          // otherwise show on attacker side.
          side: (entry as any).isMinionHit ? (attackerIsTeamA ? PANEL_SIDE.RIGHT : PANEL_SIDE.LEFT) : (attackerIsTeamA ? PANEL_SIDE.LEFT : PANEL_SIDE.RIGHT),
        } as any;

        // Show DamageCard in resolve panel if currently resolving, otherwise show
        // a transient DamageCard for minion hits so skeletons produce a DamageCard.
        resolveCache.current = { ...resolveCache.current, ...rc } as any;
        onResolveVisible?.(true);
        if ((entry as any).isMinionHit) {
          setPendingSkeletonCount((c) => c + 1);
          setTransientDamage(rc as any);
          setTransientDamageActive(true);
          setTimeout(() => {
            setTransientDamage(null);
            setTransientDamageActive(false);
            setPendingSkeletonCount((c) => Math.max(0, c - 1));
          }, HIT_DISPLAY_MS + 50);
        }

        // Pulse transient hit markers (throttled to avoid rate limit)
        try {
          const lastHitPayload: Record<string, unknown> = {};
          if ((entry as any).isMinionHit) {
            lastHitPayload.lastHitMinionId = entry.attackerId;
            lastHitPayload.lastHitTargetId = entry.defenderId;
          } else {
            lastHitPayload.lastHitMinionId = null;
            lastHitPayload.lastHitTargetId = entry.defenderId;
          }
          scheduleLastHitUpdate(lastHitPayload);
          if ((entry as any).isMinionHit) onMinionHitPulse?.(entry.attackerId, entry.defenderId);
        } catch (e) {}

        // Clear visuals after display time
        setTimeout(() => {
          onResolveVisible?.(false);
        }, HIT_DISPLAY_MS);
      }, delay);
    }

    // After all cards, clear last-hit markers once (throttled) and advance shown index
    setTimeout(() => {
      resolveCache.current.shownLogIndex = total;
      try {
        scheduleLastHitUpdate({ lastHitMinionId: null, lastHitTargetId: null });
        update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE}`), { [ARENA_PATH.BATTLE_LAST_SKELETON_HITS]: null }).catch(() => {});
      } catch (e) {}
    }, delayAcc + HIT_DISPLAY_MS + 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- scheduleLastHitUpdate ref-stable; battle included
  }, [battle?.log, battle, arenaId, teamA, teamB, teamMinionsA, teamMinionsB, onResolveVisible, onMinionHitPulse, turn]);

  /* ── Winner: show only after all minion/skeleton hit effects have played ── */
  if (winner) {
    const stillPlayingEffects = transientDamageActive || pendingSkeletonCount > 0;
    if (!stillPlayingEffects) {
      const isTeamAWinner = winner === BATTLE_TEAM.A;
      const winTeam = isTeamAWinner ? teamA : teamB;
      const loseTeam = isTeamAWinner ? teamB : teamA;
      const winSide = isTeamAWinner ? PANEL_SIDE.LEFT : PANEL_SIDE.RIGHT;
      const loseSide = isTeamAWinner ? PANEL_SIDE.RIGHT : PANEL_SIDE.LEFT;
      const winNames = [...winTeam].sort((a, b) => a.nicknameEng.length - b.nicknameEng.length).map((f) => f.nicknameEng);
      const loseNames = [...loseTeam].sort((a, b) => a.nicknameEng.length - b.nicknameEng.length).map((f) => f.nicknameEng);

      return (
        <div className="bhud">
          <div className={`bhud__dice-zone bhud__dice-zone--${winSide} bhud__dice-zone--finished`}>
            <div className="bhud__result-badge bhud__result-badge--winner">
              <WinBadge className="bhud__result-icon" />
              <span className="bhud__result-label">Victory</span>
              <div className="bhud__result-names">
                {winNames.map((name) => <span key={name}>{name}</span>)}
              </div>
            </div>
          </div>
          <div className={`bhud__dice-zone bhud__dice-zone--${loseSide} bhud__dice-zone--finished`}>
            <div className="bhud__result-badge bhud__result-badge--loser">
              <LoseBadge className="bhud__result-icon" />
              <span className="bhud__result-label">Defeat</span>
              <div className="bhud__result-names">
                {loseNames.map((name) => <span key={name}>{name}</span>)}
              </div>
            </div>
          </div>
          <div className="bhud__winner">
            <span className="bhud__winner-label">Victory</span>
            <span className="bhud__winner-name">{winNames.join(' & ')}</span>
          </div>
        </div>
      );
    }
    // Fall through: keep showing resolve/turn UI until all skeleton cards have played
  }

  if (!turn) return null;

  const atkSide = turn.attackerTeam === BATTLE_TEAM.A ? PANEL_SIDE.LEFT : PANEL_SIDE.RIGHT;
  const defSide = turn.attackerTeam === BATTLE_TEAM.A ? PANEL_SIDE.RIGHT : PANEL_SIDE.LEFT;

  // Compute conditionally disabled powers (e.g. Jolt Arc when no enemy shocks)
  const ae = battle.activeEffects || [];
  const disabledPowerNames = (() => {
    const disabled = new Set<string>();
    const enemyIds = new Set(opposingTeam?.map(f => f.characterId) ?? []);
    const hasEnemyShock = ae.some(e => e.tag === EFFECT_TAGS.SHOCK && enemyIds.has(e.targetId));
    if (!hasEnemyShock) disabled.add(POWER_NAMES.JOLT_ARC);
    // Death Keeper: disabled once consumed (tag no longer exists on attacker)
    const hasDeathKeeper = ae.some(e => e.targetId === turn.attackerId && e.tag === EFFECT_TAGS.DEATH_KEEPER);
    if (!hasDeathKeeper) disabled.add(POWER_NAMES.DEATH_KEEPER);
    // Undead Army: cannot summon more than 2 skeletons
    const attackerSkeletonCount = attacker ? (attacker.skeletonCount || 0) : 0;
    if (attackerSkeletonCount >= 2) disabled.add(POWER_NAMES.UNDEAD_ARMY);
    return disabled;
  })();

  // Dead teammates for Death Keeper targeting
  const myTeamMembers = turn.attackerTeam === BATTLE_TEAM.A ? teamA : teamB;
  const deadTeammateIds = new Set(
    (myTeamMembers || []).filter(m => m.currentHp <= 0).map(m => m.characterId),
  );

  return (
    <div className="bhud">
      {/* Round & turn indicator */}
      <div className="bhud__bar">
        <span className="bhud__round">Round {roundNumber}</span>
        <div className="bhud__turn-info">
          {attacker && (
            <>
              <span className="bhud__attacker-name">{attacker.nicknameEng}</span>
              <span className="bhud__phase-label">
                {turn.phase && getPhaseLabel(turn.phase, { defenderName: defender?.nicknameEng, usedPowerName: turn.usedPowerName, action: turn.action })}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Target selection */}
      {isMyTurn && turn.phase === PHASE.SELECT_TARGET && !floralDelay && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <TargetSelectModal
            attackerName={attacker?.nicknameEng ?? ''}
            targets={targets}
            themeColor={attacker?.theme[0]}
            themeColorDark={attacker?.theme[18]}
            onSelect={(id) => setTimeout(() => onSelectTarget(id), 0)}
            onBack={() => setTimeout(() => onCancelTarget?.(), 0)}
          />
        </div>
      )}

      {/* Self-resurrect Hades overlay */}
      {showResurrecting && !showResolve && attacker && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <ResurrectingModal name={attacker.nicknameEng} />
        </div>
      )}

      {/* Action selection (attack or power) — delayed until DamageCard exits */}
      {isMyTurn && turn.phase === PHASE.SELECT_ACTION && actionReady && !showResolve && attacker && !transientDamageActive && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <ActionSelectModal
            attacker={attacker}
            defenderName={defender?.nicknameEng ?? ''}
            isMyTurn={!!isMyTurn}
            phase={turn.phase}
            themeColor={attacker?.theme[0]}
            themeColorDark={attacker?.theme[18]}
            side={atkSide}
            disabledPowerNames={disabledPowerNames}
            teammates={turn.attackerTeam === BATTLE_TEAM.A ? teamA : teamB}
            deadTeammateIds={deadTeammateIds}
            onSelectAction={(...args) => setTimeout(() => onSelectAction(...args), 0)}
            initialShowPowers={initialShowPowers}
          />
        </div>
      )}

      {/* Season selection (Persephone's Ephemeral Season) */}
      {turn.phase === PHASE.SELECT_SEASON && attacker && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <SeasonSelectModal
            attacker={attacker}
            isMyTurn={!!isMyTurn}
            phase={turn.phase}
            themeColor={attacker?.theme[0]}
            themeColorDark={attacker?.theme[18]}
            side={atkSide}
            currentSeason={(battle.activeEffects || []).find(e => e.tag?.startsWith('season-'))?.tag?.replace('season-', '') as SeasonKey | undefined}
            onSelectSeason={(s) => setTimeout(() => onSelectSeason(s), 0)}
            onPreviewSeason={onPreviewSeason}
            onBack={() => setTimeout(() => onCancelSeason?.(), 0)}
          />
        </div>
      )}

      {/* Dice rolling (attack, defend, resolving replay) */}
      {turn && (turn.phase === PHASE.ROLLING_ATTACK || turn.phase === PHASE.ROLLING_DEFEND || turn.phase === PHASE.RESOLVING) && (
        <DiceModal
          turn={turn}
          attacker={attacker}
          defender={defender}
          isMyTurn={!!isMyTurn}
          isMyDefend={!!isMyDefend}
          atkSide={atkSide}
          defSide={defSide}
          onAttackRoll={handleAttackRollResult}
          onDefendRoll={handleDefendRollResult}
          onAtkRollDone={() => setAtkRollDone(true)}
          onDefRollDone={() => setDefRollDone(true)}
          atkRollDone={atkRollDone}
          defRollDone={defRollDone}
          defendReady={defendReady}
          resolveReady={resolveReady}
          critEligible={critEligible}
          critReady={critReady}
          critWinFaces={critRef.current.winFaces}
          critRollResult={critRollResult}
          onCritRollResult={handleCritRollResult}
          chainEligible={chainEligible}
          chainReady={chainReady}
          chainWinFaces={chainRef.current.winFaces}
          chainRollResult={chainRollResult}
          onChainRollResult={handleChainRollResult}
          dodgeEligible={dodgeEligible}
          dodgeReady={dodgeReady}
          dodgeWinFaces={dodgeRef.current.winFaces}
          dodgeRollResult={dodgeRollResult}
          onDodgeRollResult={handleDodgeRollResult}
          coAttackEligible={coAttackEligible}
          coAttackReady={coAttackReady}
          coAttackRollResult={coAttackRollResult}
          onCoAttackRollResult={handleCoAttackRollResult}
          coAttackCaster={coAttackRef.current.casterId ? find(teamA, teamB, coAttackRef.current.casterId) : undefined}
          atkBuffMod={getStatModifier(battle.activeEffects || [], turn.attackerId, 'attackDiceUp')}
          defBuffMod={turn.defenderId ? getStatModifier(battle.activeEffects || [], turn.defenderId, 'defendDiceUp') : 0}
        />
      )}

      {/* Resolve bar */}
      {showResolve && (() => {
        const rc = resolveCache.current;
        if (rc.isPower && rc.atkRoll === 0) {
          return (
            <div className={`bhud__resolve bhud__resolve--power ${resolveExiting ? 'bhud__resolve--exit' : ''}`}>
              <div className="bhud__resolve-info">
                <span className="bhud__resolve-power-name">{rc.powerName}</span>
              </div>
            </div>
          );
        }
        return (
          <div className={`bhud__resolve ${rc.isHit ? '' : 'bhud__resolve--miss'} ${rc.isPower ? 'bhud__resolve--power' : ''} ${resolveExiting ? 'bhud__resolve--exit' : ''}`}>
            <div className="bhud__resolve-info">
              {rc.isPower && rc.powerName && (
                <span className="bhud__resolve-power-name">{rc.powerName}</span>
              )}
              <div className="bhud__resolve-rolls">
                <span className="bhud__resolve-roll">
                  <span className="bhud__resolve-roll-label">ATK</span>
                  <span className="bhud__resolve-roll-val">{rc.atkRoll}</span>
                  {rc.atkBonus > 0 && (
                    <span className="bhud__resolve-roll-bonus">+{rc.atkBonus}</span>
                  )}
                  <span className="bhud__resolve-roll-total">= {rc.atkTotal}</span>
                </span>
                <span className="bhud__resolve-vs">vs</span>
                <span className="bhud__resolve-roll">
                  <span className="bhud__resolve-roll-label">DEF</span>
                  <span className="bhud__resolve-roll-val">{rc.defRoll}</span>
                  {rc.defBonus > 0 && (
                    <span className="bhud__resolve-roll-bonus">+{rc.defBonus}</span>
                  )}
                  <span className="bhud__resolve-roll-total">= {rc.defTotal}</span>
                </span>
              </div>
              {rc.isDodged ? (
                <span className="bhud__resolve-miss">DODGED!</span>
              ) : rc.isHit ? (
                <>
                  {rc.critEligible && (
                    <span className={rc.isCrit ? 'bhud__resolve-crit' : 'bhud__resolve-crit-miss'}>
                      {rc.critRoll > 0 && <>D4: {rc.critRoll} &mdash; </>}{rc.isCrit ? 'CRIT!' : 'NO CRIT'}
                    </span>
                  )}
                  <span className="bhud__resolve-dmg">{rc.isPower ? 'INVOKED!' : `-${rc.damage} DMG`}</span>
                  {rc.coAttackHit && rc.coAttackDamage > 0 && (
                    <span className="bhud__resolve-dmg">Co-Attack: -{rc.coAttackDamage} DMG</span>
                  )}
                </>
              ) : (
                <span className="bhud__resolve-miss">{rc.isPower ? 'RESISTED!' : 'BLOCKED!'}</span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Damage breakdown card — on defender side */}
      {showResolve && !transientDamageActive && (
        <DamageCard data={resolveCache.current} exiting={resolveExiting} side={resolveCache.current.side} />
      )}

      {/* Transient DamageCard for replayed log entries (minion hits like skeletons) */}
      {transientDamage && (
        <DamageCard data={transientDamage} exiting={false} side={transientDamage.side} />
      )}

      {/* Waiting for opponent to select target */}
      {showWaiting && (
        <div className={`bhud__waiting ${waitingExiting ? 'bhud__waiting--exit' : ''}`}>
          Waiting for {attacker?.nicknameEng ?? '...'}...
        </div>
      )}

      {/* Battle log */}
      <div className="bhud__log">
        {log.length === 0 ? (
          <div className="bhud__log-empty">No actions yet</div>
        ) : [...log].reverse().map((entry, i) => {
          let atkFighter = find(teamA, teamB, entry.attackerId);
          let defFighter = find(teamA, teamB, entry.defenderId);
          // Fallback: look through team-level minions passed from Arena
          if (!atkFighter && (teamMinionsA || teamMinionsB)) {
            const allMinions = [...(teamMinionsA || []), ...(teamMinionsB || [])];
            const m = allMinions.find((mn: any) => mn && mn.characterId === entry.attackerId);
            if (m) atkFighter = ({
              characterId: m.characterId,
              nicknameEng: m.nicknameEng || m.characterId,
              nicknameThai: m.nicknameThai || m.nicknameEng || m.characterId,
              sex: m.sex || 'unknown',
              deityBlood: m.deityBlood || 'unknown',
              image: m.image,
              theme: m.theme || DEFAULT_THEME[m.deityBlood] || DEFAULT_THEME[0],
              maxHp: m.maxHp || 1,
              currentHp: m.currentHp || 1,
              damage: m.damage || 0,
              attackDiceUp: m.attackDiceUp || 0,
              defendDiceUp: m.defendDiceUp || 0,
              speed: m.speed || 0,
              rerollsLeft: m.rerollsLeft || 0,
              passiveSkillPoint: m.passiveSkillPoint || '',
              skillPoint: m.skillPoint || '',
              ultimateSkillPoint: m.ultimateSkillPoint || '',
              technique: m.technique || 0,
              quota: m.quota || 0,
              maxQuota: m.maxQuota || 0,
              criticalRate: m.criticalRate || 0,
              powers: m.powers || [],
            } as FighterState);
          }
          if (!defFighter && (teamMinionsA || teamMinionsB)) {
            const allMinions = [...(teamMinionsA || []), ...(teamMinionsB || [])];
            const m = allMinions.find((mn: any) => mn && mn.characterId === entry.defenderId);
            if (m) defFighter = ({
              characterId: m.characterId,
              nicknameEng: m.nicknameEng || m.characterId,
              nicknameThai: m.nicknameThai || m.nicknameEng || m.characterId,
              sex: m.sex || 'unknown',
              deityBlood: m.deityBlood || 'unknown',
              image: m.image,
              theme: m.theme || DEFAULT_THEME[m.deityBlood] || DEFAULT_THEME[0],
              maxHp: m.maxHp || 1,
              currentHp: m.currentHp || 1,
              damage: m.damage || 0,
              attackDiceUp: m.attackDiceUp || 0,
              defendDiceUp: m.defendDiceUp || 0,
              speed: m.speed || 0,
              rerollsLeft: m.rerollsLeft || 0,
              passiveSkillPoint: m.passiveSkillPoint || '',
              skillPoint: m.skillPoint || '',
              ultimateSkillPoint: m.ultimateSkillPoint || '',
              technique: m.technique || 0,
              quota: m.quota || 0,
              maxQuota: m.maxQuota || 0,
              criticalRate: m.criticalRate || 0,
              powers: m.powers || [],
            } as FighterState);
          }
          const atkName = atkFighter?.nicknameEng ?? '???';
          const defName = defFighter?.nicknameEng ?? '???';
          const atkColor = atkFighter?.theme[0];
          const defColor = defFighter?.theme[0];

          if ((entry as any).isMinionHit) {
            // Compact minion log: do not render dice breakdown for minion hits
            return (
              <div className="bhud__log-entry bhud__log-entry--minion" key={i}>
                <span className="bhud__log-round">R{entry.round}</span>
                <span className="bhud__log-name" style={atkColor ? { color: atkColor } : undefined}>{atkName}</span>
                <span className="bhud__log-vs">vs</span>
                <span className="bhud__log-name" style={defColor ? { color: defColor } : undefined}>{defName}</span>
                <span className="bhud__log-sep">—</span>
                {entry.missed ? (
                  <span>{atkName} missed {defName}</span>
                ) : (
                  <span>{atkName} hit {defName} for <span className="bhud__log-hit">{entry.damage} dmg</span></span>
                )}
                {entry.eliminated && <span className="bhud__log-ko">KO!</span>}
              </div>
            );
          }

          if (entry.powerUsed) {
            return (
              <div className="bhud__log-entry bhud__log-entry--power" key={i}>
                <span className="bhud__log-round">R{entry.round}</span>
                <span className="bhud__log-name" style={atkColor ? { color: atkColor } : undefined}>{atkName}</span>
                <span className="bhud__log-power">{entry.powerUsed}</span>
                <span className="bhud__log-sep">→</span>
                <span className="bhud__log-name" style={defColor ? { color: defColor } : undefined}>{defName}</span>
                {entry.damage > 0 && <span className="bhud__log-hit">{entry.damage} dmg</span>}
                {entry.eliminated && <span className="bhud__log-ko">KO!</span>}
              </div>
            );
          }

          return (
            <div className="bhud__log-entry" key={i}>
              <span className="bhud__log-round">R{entry.round}</span>
              <span className="bhud__log-name" style={atkColor ? { color: atkColor } : undefined}>{atkName}</span>
              <span className="bhud__log-dice">{entry.attackRoll}</span>
              {(atkFighter?.attackDiceUp ?? 0) > 0 && (
                <span className="bhud__log-bonus">+{atkFighter!.attackDiceUp}={entry.attackRoll + atkFighter!.attackDiceUp}</span>
              )}
              <span className="bhud__log-vs">vs</span>
              <span className="bhud__log-name" style={defColor ? { color: defColor } : undefined}>{defName}</span>
              <span className="bhud__log-dice">{entry.defendRoll}</span>
              {(defFighter?.defendDiceUp ?? 0) > 0 && (
                <span className="bhud__log-bonus">+{defFighter!.defendDiceUp}={entry.defendRoll + defFighter!.defendDiceUp}</span>
              )}
              <span className="bhud__log-sep">—</span>
              {entry.missed ? (
                <span>{defName} blocked {atkName}</span>
              ) : (
                <span>{atkName} hit {defName} for <span className="bhud__log-hit">{entry.damage} dmg</span></span>
              )}
              {entry.eliminated && <span className="bhud__log-ko">KO!</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
