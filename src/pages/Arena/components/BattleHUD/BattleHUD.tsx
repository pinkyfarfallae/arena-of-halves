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
  myId: string | undefined;
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
}

/** Find a fighter across both teams */
function find(teamA: FighterState[], teamB: FighterState[], id: string): FighterState | undefined {
  return [...teamA, ...teamB].find((f) => f.characterId === id);
}

export default function BattleHUD({
  arenaId, battle, teamA, teamB, myId,
  onSelectTarget, onSelectAction, onSelectSeason, onPreviewSeason, onCancelSeason, onCancelTarget, initialShowPowers, onSubmitAttackRoll, onSubmitDefendRoll, onResolve, onResolveVisible,
}: Props) {
  const { turn, roundNumber, log = [], winner } = battle;

  const attacker = turn ? find(teamA, teamB, turn.attackerId) : undefined;
    // Keep canonical defender for HUD: even if a minion visually intercepted, the HUD should
    // still show the master as the defending target during resolving.
    const defender = turn?.defenderId ? find(teamA, teamB, turn.defenderId) : undefined;
    const isMyTurn = turn && turn.attackerId === myId;
    const isMyDefend = turn?.defenderId === myId;
  const opposingTeam = turn?.attackerTeam === 'teamA' ? teamB : teamA;

  // Filter targets based on power requirements (e.g., Jolt Arc needs 'shock')
  const targets = (() => {
    // Death Keeper: show dead teammates instead of alive enemies
    if (turn?.usedPowerIndex != null && attacker) {
      const power = attacker.powers[turn.usedPowerIndex];
      if (power?.name === 'Death Keeper') {
        const myTeam = turn.attackerTeam === 'teamA' ? teamA : teamB;
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
  if (turn?.phase === 'rolling-attack') defSubmitted.current = false;
  if (turn?.phase === 'select-action') atkSubmitted.current = false;

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
  useEffect(() => { if (turn?.phase === 'rolling-defend') setDefendReady(false); }, [turn?.phase]);
  useEffect(() => { if (turn?.phase === 'resolving') setResolveReady(false); }, [turn?.phase]);

  // If I attacked, no attack replay to wait for → short delay
  useEffect(() => {
    if (turn?.phase === 'rolling-defend' && turn.attackerId === myId) {
      const t = setTimeout(() => setDefendReady(true), 500);
      return () => clearTimeout(t);
    }
  }, [turn?.phase, turn?.attackerId, myId]);

  // If opponent attacked, wait for their roll animation to end + 2s viewing time
  useEffect(() => {
    if (atkRollDone && turn?.phase === 'rolling-defend') {
      const t = setTimeout(() => setDefendReady(true), 2000);
      return () => clearTimeout(t);
    }
  }, [atkRollDone, turn?.phase]);

  // If skipDice power was used, resolve immediately (no dice to show)
  useEffect(() => {
    if (turn?.phase === 'resolving' && turn.action === 'power' && !turn.attackRoll) {
      const t = setTimeout(() => setResolveReady(true), 800);
      return () => clearTimeout(t);
    }
  }, [turn?.phase, turn?.action, turn?.attackRoll]);

  // If I defended, no replay to wait for → short delay (skip for skipDice powers)
  useEffect(() => {
    if (turn?.phase === 'resolving' && turn.defenderId === myId && !(turn.action === 'power' && !turn.attackRoll)) {
      const t = setTimeout(() => setResolveReady(true), 500);
      return () => clearTimeout(t);
    }
  }, [turn?.phase, turn?.defenderId, turn?.action, turn?.attackRoll, myId]);

  // If opponent defended, wait for their roll animation to end + 2s viewing time
  useEffect(() => {
    if (defRollDone && turn?.phase === 'resolving') {
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
    if (turn?.phase !== 'resolving' || !resolveReady || !attacker || !defender || !turn.defenderId) return;
    const key = `dodge:${turn.attackerId}:${turn.defenderId}:${turn.attackRoll}:${turn.defendRoll}`;
    if (dodgeInitKey.current === key) return;
    dodgeInitKey.current = key;

    const isSkipDice = turn.action === 'power' && !turn.attackRoll;
    if (isSkipDice) { setDodgeReady(true); return; }

    // Check if defender has pomegranate-spirit
    const ae = battle.activeEffects || [];
    const hasSpirit = ae.some(e => e.targetId === turn.defenderId && e.tag === 'pomegranate-spirit');
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
      if (arenaId) update(ref(db, `arenas/${arenaId}/battle/turn`), { dodgeWinFaces: winFaces });
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
      if (arenaId) update(ref(db, `arenas/${arenaId}/battle/turn`), { isDodged: dg, dodgeRoll: roll, dodgeWinFaces: winFaces });
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
    if (arenaId) update(ref(db, `arenas/${arenaId}/battle/turn`), { isDodged: dg, dodgeRoll: roll });
    setTimeout(() => setDodgeReady(true), 1500);
  }, [arenaId]);

  // PvP watcher: defender rolled dodge D4 after we entered resolving
  useEffect(() => {
    if (turn?.phase !== 'resolving' || !resolveReady || dodgeReady || !dodgeEligible) return;
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
    if (turn?.phase !== 'resolving' || !resolveReady || !dodgeReady || !attacker || !defender || !turn.defenderId) return;
    const key = `${turn.attackerId}:${turn.defenderId}:${turn.attackRoll}:${turn.defendRoll}`;
    if (critInitKey.current === key) return;
    critInitKey.current = key;

    // Dodged → skip crit
    if (dodgeRef.current.isDodged) { setCritReady(true); return; }

    const isSkipDice = turn.action === 'power' && !turn.attackRoll;
    if (isSkipDice) {
      setCritReady(true);
      return;
    }
    // Self-buff powers (e.g. Beyond the Cloud) still do normal attacks → allow crit
    const usedPowerDef = turn.action === 'power' && turn.usedPowerIndex != null
      ? attacker?.powers?.[turn.usedPowerIndex] : undefined;
    if (turn.action === 'power' && usedPowerDef?.target !== 'self') {
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
      if (arenaId) update(ref(db, `arenas/${arenaId}/battle/turn`), { isCrit: true, critRoll: 0, critWinFaces: [1, 2, 3, 4] });
      setCritEligible(true);
      setCritReady(true);
      return;
    }

    // Use attacker's stored winFaces (PvP watcher) or generate new ones
    const winFaces = (!isMyTurn && turn.critWinFaces?.length) ? turn.critWinFaces : getWinningFaces(effectiveCrit);

    if (isMyTurn) {
      // Player: manual D4 roll — write winFaces so PvP opponent sees the same faces
      critRef.current = { effectiveCrit, winFaces, isCrit: false, critRoll: 0 };
      if (arenaId) update(ref(db, `arenas/${arenaId}/battle/turn`), { critWinFaces: winFaces });
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
      if (arenaId) update(ref(db, `arenas/${arenaId}/battle/turn`), { isCrit: crit.isCrit, critRoll: crit.critRoll, critWinFaces: winFaces });
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
    if (arenaId) update(ref(db, `arenas/${arenaId}/battle/turn`), { isCrit, critRoll: roll });
    setTimeout(() => setCritReady(true), 1500);
  }, [arenaId]);

  // PvP watcher: opponent rolled D4 after we entered resolving
  useEffect(() => {
    if (turn?.phase !== 'resolving' || !resolveReady || critReady || !critEligible) return;
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
    if (turn?.phase !== 'resolving' || !resolveReady || !critReady) return;
    // Dodged → skip chain
    if (dodgeRef.current.isDodged) { setChainReady(true); return; }
    if (turn.usedPowerName !== 'Thunderbolt') {
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
      if (arenaId) update(ref(db, `arenas/${arenaId}/battle/turn`), { chainRoll: roll, chainSuccess: success });
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
    if (arenaId) update(ref(db, `arenas/${arenaId}/battle/turn`), { chainRoll: roll, chainSuccess: success });
    setTimeout(() => setChainReady(true), 1500);
  }, [arenaId]);

  // PvP watcher: opponent rolled chain D4 after we entered resolving
  useEffect(() => {
    if (turn?.phase !== 'resolving' || !resolveReady || !critReady || chainReady || !chainEligible) return;
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
    if (turn?.phase !== 'resolving' || !resolveReady || !dodgeReady || !critReady || !chainReady) return;
    if (!attacker || !defender || !turn.defenderId) { setCoAttackReady(true); return; }

    // Dodged → no co-attack
    if (dodgeRef.current.isDodged) { setCoAttackReady(true); return; }

    const isSkipDice = turn.action === 'power' && !turn.attackRoll;
    if (isSkipDice) { setCoAttackReady(true); return; }

    // Check if attacker (the one attacking this turn) has pomegranate-spirit
    const ae = battle.activeEffects || [];
    const spiritEffect = ae.find(e => e.targetId === turn.attackerId && e.tag === 'pomegranate-spirit');
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
      if (arenaId) update(ref(db, `arenas/${arenaId}/battle/turn`), { coAttackerId: casterId });
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
      if (arenaId) update(ref(db, `arenas/${arenaId}/battle/turn`), { coAttackRoll: roll, coAttackerId: casterId, coAttackHit: coHit, coAttackDamage: coDmg });
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
    if (arenaId) update(ref(db, `arenas/${arenaId}/battle/turn`), { coAttackRoll: roll, coAttackHit: coHit, coAttackDamage: coDmg });
    setTimeout(() => setCoAttackReady(true), 1500);
  }, [arenaId, battle.activeEffects, teamA, teamB, turn, defender]);

  // PvP watcher: caster rolled co-attack after we entered resolving
  useEffect(() => {
    if (turn?.phase !== 'resolving' || !resolveReady || !critReady || !chainReady || coAttackReady || !coAttackEligible) return;
    if (coAttackRef.current.casterId === myId) return;
    if (coAttackRollResult > 0) return;
    if (turn?.coAttackRoll == null) return;
    coAttackRef.current = { ...coAttackRef.current, hit: !!turn.coAttackHit, damage: turn.coAttackDamage ?? 0, roll: turn.coAttackRoll };
    setCoAttackRollResult(turn.coAttackRoll);
    const t = setTimeout(() => setCoAttackReady(true), 3500);
    return () => clearTimeout(t);
  }, [turn?.phase, resolveReady, critReady, chainReady, coAttackReady, coAttackEligible, myId, coAttackRollResult, turn?.coAttackRoll, turn?.coAttackHit, turn?.coAttackDamage]);

  /* ── Auto-resolve after showing result (only after all checks done) ── */
  useEffect(() => {
    if (turn?.phase !== 'resolving' || !resolveReady || !dodgeReady || !critReady || !chainReady || !coAttackReady) return;
    const timer = setTimeout(() => onResolve(), 5000);
    return () => clearTimeout(timer);
  }, [turn?.phase, resolveReady, dodgeReady, critReady, chainReady, coAttackReady, onResolve]);

  /* ── Floral Scented: delay target selection so scent wave visual plays ── */
  const [floralDelay, setFloralDelay] = useState(false);
  useEffect(() => {
    if (turn?.phase === 'select-target' && turn.usedPowerName === 'Floral Scented' && turn.allyTargetId) {
      setFloralDelay(true);
      const t = setTimeout(() => setFloralDelay(false), 3000);
      return () => clearTimeout(t);
    }
    setFloralDelay(false);
  }, [turn?.phase, turn?.usedPowerName, turn?.allyTargetId]);

  /* ── Fade transitions for resolve & waiting panels ── */
  const resolveVisible = turn?.phase === 'resolving' && resolveReady && dodgeReady && critReady && chainReady && coAttackReady && !!attacker && !!defender;
  const waitingVisible = !!(!isMyTurn && turn?.phase === 'select-target' && !floralDelay);

  // Signal parent when resolve becomes visible (for hit effects)
  useEffect(() => {
    onResolveVisible?.(resolveVisible);
  }, [resolveVisible, onResolveVisible]);
  const [showResolve, resolveExiting] = useFadeTransition(resolveVisible, 250);
  const [showWaiting, waitingExiting] = useFadeTransition(waitingVisible, 250);

  // Delay action modal until DamageCard exit animation finishes + 750ms pause
  const [actionReady, setActionReady] = useState(true);
  const [showResurrecting, setShowResurrecting] = useState(false);
  const selfResurrectShown = useRef('');
  useEffect(() => {
    if (turn?.phase === 'select-action' && showResolve) {
      setActionReady(false);
    } else if (turn?.phase === 'select-action' && !showResolve && !actionReady && !showResurrecting) {
      const timer = setTimeout(() => setActionReady(true), 750);
      return () => clearTimeout(timer);
    }
  }, [turn?.phase, showResolve, actionReady, showResurrecting]);

  // Self-resurrect: trigger overlay only after DamageCard is gone
  useEffect(() => {
    if (turn?.phase === 'select-action' && turn.resurrectTargetId === turn.attackerId && !showResolve) {
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
  const resolveCache = useRef({
    atkRoll: 0, defRoll: 0, atkBonus: 0, defBonus: 0, atkTotal: 0, defTotal: 0,
    isHit: false, damage: 0, baseDmg: 0, shockBonus: 0,
    isPower: false, powerName: '', critEligible: false, isCrit: false, critRoll: 0,
    isDodged: false, coAttackHit: false, coAttackDamage: 0,
    attackerName: '', attackerTheme: '', defenderName: '', defenderTheme: '',
    side: 'right' as 'left' | 'right',
  });
  if (resolveVisible && turn && attacker && defender) {
    const isSkipDicePower = turn.action === 'power' && !turn.attackRoll;
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
        side: turn.attackerTeam === 'teamA' ? 'right' : 'left',
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
      if (at > dt && turn.action !== 'power') {
        const hasLR = attacker.passiveSkillPoint === 'unlock' &&
          attacker.powers?.some(p => p.type === 'Passive' && p.name === 'Lightning Reflex');
        const defShocks = hasLR && activeEffects.some(
          e => e.targetId === turn.defenderId && e.tag === 'shock',
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
        isPower: turn.action === 'power', powerName: turn.usedPowerName ?? '',
        critEligible: !dgd && critEligible, isCrit: cd.isCrit, critRoll: cd.critRoll,
        isDodged: dgd, coAttackHit: ca.hit, coAttackDamage: ca.damage,
        attackerName: attacker.nicknameEng, attackerTheme: attacker.theme[0],
        defenderName: defender.nicknameEng, defenderTheme: defender.theme[0],
        side: turn.attackerTeam === 'teamA' ? 'right' : 'left',
      };
    }
  }

  /* ── Winner ── */
  if (winner) {
    const isTeamAWinner = winner === 'teamA';
    const winTeam = isTeamAWinner ? teamA : teamB;
    const loseTeam = isTeamAWinner ? teamB : teamA;
    const winSide = isTeamAWinner ? 'left' : 'right';
    const loseSide = isTeamAWinner ? 'right' : 'left';
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

  if (!turn) return null;

  const atkSide = turn.attackerTeam === 'teamA' ? 'left' : 'right';
  const defSide = turn.attackerTeam === 'teamA' ? 'right' : 'left';

  // Compute conditionally disabled powers (e.g. Jolt Arc when no enemy shocks)
  const ae = battle.activeEffects || [];
  const disabledPowerNames = (() => {
    const disabled = new Set<string>();
    const enemyIds = new Set(opposingTeam?.map(f => f.characterId) ?? []);
    const hasEnemyShock = ae.some(e => e.tag === 'shock' && enemyIds.has(e.targetId));
    if (!hasEnemyShock) disabled.add('Jolt Arc');
    // Death Keeper: disabled once consumed (tag no longer exists on attacker)
    const hasDeathKeeper = ae.some(e => e.targetId === turn.attackerId && e.tag === 'death-keeper');
    if (!hasDeathKeeper) disabled.add('Death Keeper');
    // Undead Army: cannot summon more than 2 skeletons
    const attackerSkeletonCount = attacker ? (attacker.skeletonCount || 0) : 0;
    if (attackerSkeletonCount >= 2) disabled.add('Undead Army');
    return disabled;
  })();

  // Dead teammates for Death Keeper targeting
  const myTeamMembers = turn.attackerTeam === 'teamA' ? teamA : teamB;
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
                {turn.phase === 'select-target' && 'selecting target...'}
                {turn.phase === 'select-action' && 'choosing action...'}
                {turn.phase === 'select-season' && 'choosing season...'}
                {turn.phase === 'rolling-attack' && 'rolling...'}
                {turn.phase === 'rolling-defend' && `→ ${defender?.nicknameEng ?? '...'} defending...`}
                {turn.phase === 'resolving' && turn.action === 'power' && !turn.attackRoll && `used ${turn.usedPowerName ?? 'a power'}!`}
                {turn.phase === 'resolving' && turn.action === 'power' && !!turn.attackRoll && `${turn.usedPowerName ?? 'power'} → ${defender?.nicknameEng ?? '...'}`}
                {turn.phase === 'resolving' && turn.action !== 'power' && `→ ${defender?.nicknameEng ?? '...'}`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Target selection */}
      {isMyTurn && turn.phase === 'select-target' && !floralDelay && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <TargetSelectModal
            attackerName={attacker?.nicknameEng ?? ''}
            targets={targets}
            themeColor={attacker?.theme[0]}
            themeColorDark={attacker?.theme[18]}
            onSelect={onSelectTarget}
            onBack={onCancelTarget}
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
      {isMyTurn && turn.phase === 'select-action' && actionReady && !showResolve && attacker && (
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
            teammates={turn.attackerTeam === 'teamA' ? teamA : teamB}
            deadTeammateIds={deadTeammateIds}
            onSelectAction={onSelectAction}
            initialShowPowers={initialShowPowers}
          />
        </div>
      )}

      {/* Season selection (Persephone's Borrowed Season) */}
      {turn.phase === 'select-season' && attacker && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <SeasonSelectModal
            attacker={attacker}
            isMyTurn={!!isMyTurn}
            phase={turn.phase}
            themeColor={attacker?.theme[0]}
            themeColorDark={attacker?.theme[18]}
            side={atkSide}
            currentSeason={(battle.activeEffects || []).find(e => e.tag?.startsWith('season-'))?.tag?.replace('season-', '') as SeasonKey | undefined}
            onSelectSeason={onSelectSeason}
            onPreviewSeason={onPreviewSeason}
            onBack={onCancelSeason}
          />
        </div>
      )}

      {/* Dice rolling (attack, defend, resolving replay) */}
      {turn && (turn.phase === 'rolling-attack' || turn.phase === 'rolling-defend' || turn.phase === 'resolving') && (
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
      {showResolve && (
        <DamageCard data={resolveCache.current} exiting={resolveExiting} side={resolveCache.current.side} />
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
          const atkFighter = find(teamA, teamB, entry.attackerId);
          const defFighter = find(teamA, teamB, entry.defenderId);
          const atkName = atkFighter?.nicknameEng ?? '???';
          const defName = defFighter?.nicknameEng ?? '???';
          const atkColor = atkFighter?.theme[0];
          const defColor = defFighter?.theme[0];

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
