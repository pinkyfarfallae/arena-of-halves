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
  onSelectTarget, onSelectAction, onSelectSeason, onSubmitAttackRoll, onSubmitDefendRoll, onResolve, onResolveVisible,
}: Props) {
  const { turn, roundNumber, log = [], winner } = battle;

  const attacker = turn ? find(teamA, teamB, turn.attackerId) : undefined;
  const defender = turn?.defenderId ? find(teamA, teamB, turn.defenderId) : undefined;
  const isMyTurn = turn && turn.attackerId === myId;
  const isMyDefend = turn && turn.defenderId === myId;
  const opposingTeam = turn?.attackerTeam === 'teamA' ? teamB : teamA;
  const targets = (opposingTeam ?? []).filter((f) => f.currentHp > 0);

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

  // Compute crit eligibility when resolve is ready
  useEffect(() => {
    if (turn?.phase !== 'resolving' || !resolveReady || !attacker || !defender || !turn.defenderId) return;
    const key = `${turn.attackerId}:${turn.defenderId}:${turn.attackRoll}:${turn.defendRoll}`;
    if (critInitKey.current === key) return;
    critInitKey.current = key;

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
  }, [turn, resolveReady, attacker, defender, battle.activeEffects, arenaId, isMyTurn]);

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

  /* ── Auto-resolve after showing result (only after crit + chain check done) ── */
  useEffect(() => {
    if (turn?.phase !== 'resolving' || !resolveReady || !critReady || !chainReady) return;
    const timer = setTimeout(() => onResolve(), 5000);
    return () => clearTimeout(timer);
  }, [turn?.phase, resolveReady, critReady, chainReady, onResolve]);

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
  const resolveVisible = turn?.phase === 'resolving' && resolveReady && critReady && chainReady && !!attacker && !!defender;
  const waitingVisible = !!(!isMyTurn && turn?.phase === 'select-target' && !floralDelay);

  // Signal parent when resolve becomes visible (for hit effects)
  useEffect(() => {
    onResolveVisible?.(resolveVisible);
  }, [resolveVisible, onResolveVisible]);
  const [showResolve, resolveExiting] = useFadeTransition(resolveVisible, 250);
  const [showWaiting, waitingExiting] = useFadeTransition(waitingVisible, 250);

  // Cache resolve data so content doesn't flicker during exit animation
  const resolveCache = useRef({
    atkRoll: 0, defRoll: 0, atkBonus: 0, defBonus: 0, atkTotal: 0, defTotal: 0,
    isHit: false, damage: 0, baseDmg: 0, shockBonus: 0,
    isPower: false, powerName: '', critEligible: false, isCrit: false, critRoll: 0,
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

      resolveCache.current = {
        atkRoll: turn.attackRoll ?? 0, defRoll: turn.defendRoll ?? 0,
        atkBonus: attacker.attackDiceUp + atkBuff, defBonus: defender.defendDiceUp + defBuff,
        atkTotal: at, defTotal: dt, isHit: at > dt, damage, baseDmg, shockBonus,
        isPower: turn.action === 'power', powerName: turn.usedPowerName ?? '',
        critEligible, isCrit: cd.isCrit, critRoll: cd.critRoll,
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
        <div className={`bhud__dice-zone bhud__dice-zone--${winSide}`}>
          <div className="bhud__result-badge bhud__result-badge--winner">
            <WinBadge className="bhud__result-icon" />
            <span className="bhud__result-label">Victory</span>
            <div className="bhud__result-names">
              {winNames.map((name) => <span key={name}>{name}</span>)}
            </div>
          </div>
        </div>
        <div className={`bhud__dice-zone bhud__dice-zone--${loseSide}`}>
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
  const disabledPowerNames = (() => {
    const disabled = new Set<string>();
    const ae = battle.activeEffects || [];
    const enemyIds = new Set(opposingTeam?.map(f => f.characterId) ?? []);
    const hasEnemyShock = ae.some(e => e.tag === 'shock' && enemyIds.has(e.targetId));
    if (!hasEnemyShock) disabled.add('Jolt Arc');
    return disabled;
  })();

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
          />
        </div>
      )}

      {/* Action selection (attack or power) */}
      {turn.phase === 'select-action' && attacker && (
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
            onSelectAction={onSelectAction}
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
            onSelectSeason={onSelectSeason}
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
              {rc.isHit ? (
                <>
                  {rc.critEligible && (
                    <span className={rc.isCrit ? 'bhud__resolve-crit' : 'bhud__resolve-crit-miss'}>
                      {rc.critRoll > 0 && <>D4: {rc.critRoll} &mdash; </>}{rc.isCrit ? 'CRIT!' : 'NO CRIT'}
                    </span>
                  )}
                  <span className="bhud__resolve-dmg">{rc.isPower ? 'INVOKED!' : `-${rc.damage} DMG`}</span>
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
