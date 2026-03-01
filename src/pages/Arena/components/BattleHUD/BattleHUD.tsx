import { useRef, useCallback, useEffect, useState } from 'react';
import type { BattleState, FighterState } from '../../../../types/battle';
import { DEITY_THEMES, DEFAULT_THEME } from '../../../../constants/theme';
import DiceRoller from '../../../../components/DiceRoller/DiceRoller';
import WinBadge from './icons/Crown';
import LoseBadge from './icons/Skull';
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
  battle: BattleState;
  teamA: FighterState[];
  teamB: FighterState[];
  myId: string | undefined;
  onSelectTarget: (defenderId: string) => void;
  onSubmitAttackRoll: (roll: number) => void;
  onSubmitDefendRoll: (roll: number) => void;
  onResolve: () => void;
}

/** Find a fighter across both teams */
function find(teamA: FighterState[], teamB: FighterState[], id: string): FighterState | undefined {
  return [...teamA, ...teamB].find((f) => f.characterId === id);
}

/** Get die theme colors for a fighter, falling back to deity theme then default */
function dieColors(f?: FighterState): { primary: string; primaryDark: string } {
  const t = f?.theme ?? (f?.deityBlood ? DEITY_THEMES[f.deityBlood] : undefined) ?? DEFAULT_THEME;
  return { primary: t[0], primaryDark: t[18] };
}

export default function BattleHUD({
  battle, teamA, teamB, myId,
  onSelectTarget, onSubmitAttackRoll, onSubmitDefendRoll, onResolve,
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
  if (turn?.phase === 'select-target') atkSubmitted.current = false;

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

  // If I defended, no replay to wait for → short delay
  useEffect(() => {
    if (turn?.phase === 'resolving' && turn.defenderId === myId) {
      const t = setTimeout(() => setResolveReady(true), 500);
      return () => clearTimeout(t);
    }
  }, [turn?.phase, turn?.defenderId, myId]);

  // If opponent defended, wait for their roll animation to end + 2s viewing time
  useEffect(() => {
    if (defRollDone && turn?.phase === 'resolving') {
      const t = setTimeout(() => setResolveReady(true), 2000);
      return () => clearTimeout(t);
    }
  }, [defRollDone, turn?.phase]);

  /* ── Auto-resolve after showing result (only after resolve is ready) ── */
  useEffect(() => {
    if (turn?.phase !== 'resolving' || !resolveReady) return;
    const timer = setTimeout(() => onResolve(), 3500);
    return () => clearTimeout(timer);
  }, [turn?.phase, resolveReady, onResolve]);

  /* ── Fade transitions for resolve & waiting panels ── */
  const resolveVisible = turn?.phase === 'resolving' && resolveReady && !!attacker && !!defender;
  const waitingVisible = !!(!isMyTurn && turn?.phase === 'select-target');
  const [showResolve, resolveExiting] = useFadeTransition(resolveVisible, 250);
  const [showWaiting, waitingExiting] = useFadeTransition(waitingVisible, 250);

  // Cache resolve data so content doesn't flicker during exit animation
  const resolveCache = useRef({ atkRoll: 0, defRoll: 0, atkBonus: 0, defBonus: 0, atkTotal: 0, defTotal: 0, isHit: false, damage: 0 });
  if (resolveVisible && turn && attacker && defender) {
    const at = (turn.attackRoll ?? 0) + attacker.attackDiceUp;
    const dt = (turn.defendRoll ?? 0) + defender.defendDiceUp;
    resolveCache.current = {
      atkRoll: turn.attackRoll ?? 0, defRoll: turn.defendRoll ?? 0,
      atkBonus: attacker.attackDiceUp, defBonus: defender.defendDiceUp,
      atkTotal: at, defTotal: dt, isHit: at > dt, damage: attacker.damage,
    };
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
        {/* Side result icons */}
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
        {/* Bottom winner bar */}
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
                {turn.phase === 'select-target' && 'is attacking'}
                {turn.phase === 'rolling-attack' && 'rolling...'}
                {turn.phase === 'rolling-defend' && `→ ${defender?.nicknameEng ?? '...'} defending...`}
                {turn.phase === 'resolving' && `→ ${defender?.nicknameEng ?? '...'}`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Target selection — modal on attacker's side */}
      {isMyTurn && turn.phase === 'select-target' && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <div className="bhud__targets-modal">
            <span className="bhud__dice-label">Select Target</span>
            <span className="bhud__dice-sub">{attacker?.nicknameEng}'s turn</span>
            <div className="bhud__targets-list">
              {targets.map((t) => (
                <button
                  key={t.characterId}
                  className="bhud__target-btn"
                  style={{ '--t-color': t.theme[0] } as React.CSSProperties}
                  onClick={() => onSelectTarget(t.characterId)}
                >
                  {t.image ? (
                    <img className="bhud__target-img" src={t.image} alt="" />
                  ) : (
                    <span className="bhud__target-initial">{t.nicknameEng.charAt(0)}</span>
                  )}
                  <div className="bhud__target-info">
                    <span className="bhud__target-name">{t.nicknameEng}</span>
                    <span className="bhud__target-hp">{t.currentHp}/{t.maxHp}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ROLLING ATTACK ── */}
      {/* My attack dice roller */}
      {turn.phase === 'rolling-attack' && isMyTurn && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <div className="bhud__dice-modal">
            <span className="bhud__dice-label">Attack Roll</span>
            <span className="bhud__dice-sub">
              {attacker?.nicknameEng} → {defender?.nicknameEng}
            </span>
            <DiceRoller className="bhud__dice-roller" lockedDie={12} onRollResult={handleAttackRollResult} themeColors={dieColors(attacker)} hidePrompt />
            <span className="bhud__dice-bonus">dice up: {attacker?.attackDiceUp ?? 0}</span>
          </div>
        </div>
      )}
      {/* Opponent's attack — waiting spinner */}
      {turn.phase === 'rolling-attack' && !isMyTurn && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <div className="bhud__dice-modal">
            <span className="bhud__dice-label">Attack Roll</span>
            <span className="bhud__dice-sub">{attacker?.nicknameEng} → {defender?.nicknameEng}</span>
            <div className="bhud__dice-roller bhud__dice-roller--waiting">
              <div className="bhud__roll-waiting-spinner" />
            </div>
          </div>
        </div>
      )}

      {/* ── ROLLING DEFEND ── */}
      {/* Attacker's result dice — only when opponent attacked (I need to see their roll) */}
      {turn.phase === 'rolling-defend' && turn.attackRoll != null && !isMyTurn && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <div className="bhud__dice-modal">
            <span className="bhud__dice-label">Attack Roll</span>
            <span className="bhud__dice-sub">{attacker?.nicknameEng}</span>
            <DiceRoller key="atk-defend-phase" className="bhud__dice-roller" lockedDie={12} fixedResult={turn.attackRoll} accentColor={attacker?.theme[9]} themeColors={dieColors(attacker)} autoRoll hidePrompt onRollEnd={() => setAtkRollDone(true)} />
            <span className="bhud__dice-bonus">
              {!atkRollDone
                ? 'rolling...'
                : (attacker?.attackDiceUp ?? 0) > 0
                  ? `+${attacker!.attackDiceUp} → ${turn.attackRoll + attacker!.attackDiceUp}`
                  : turn.attackRoll}
            </span>
          </div>
        </div>
      )}
      {/* My defend dice roller — only after attack result finishes */}
      {turn.phase === 'rolling-defend' && isMyDefend && defendReady && (
        <div className={`bhud__dice-zone bhud__dice-zone--${defSide}`}>
          <div className="bhud__dice-modal">
            <span className="bhud__dice-label">Defense Roll</span>
            <span className="bhud__dice-sub">
              Defending against {attacker?.nicknameEng}
            </span>
            <DiceRoller key="def-my-roll" className="bhud__dice-roller" lockedDie={12} onRollResult={handleDefendRollResult} themeColors={dieColors(defender)} hidePrompt />
            <span className="bhud__dice-bonus">dice up: {defender?.defendDiceUp ?? 0}</span>
          </div>
        </div>
      )}
      {/* Opponent's defend — waiting spinner */}
      {turn.phase === 'rolling-defend' && !isMyDefend && (
        <div className={`bhud__dice-zone bhud__dice-zone--${defSide}`}>
          <div className="bhud__dice-modal">
            <span className="bhud__dice-label">Defense Roll</span>
            <span className="bhud__dice-sub">{defender?.nicknameEng}</span>
            <div className="bhud__dice-roller bhud__dice-roller--waiting">
              <div className="bhud__roll-waiting-spinner" />
            </div>
          </div>
        </div>
      )}

      {/* ── RESOLVING ── */}
      {/* Show defend result dice only when opponent defended (I need to see their roll) */}
      {turn.phase === 'resolving' && turn.defendRoll != null && !resolveReady && !isMyDefend && (
        <div className={`bhud__dice-zone bhud__dice-zone--${defSide}`}>
          <div className="bhud__dice-modal">
            <span className="bhud__dice-label">Defense Roll</span>
            <span className="bhud__dice-sub">{defender?.nicknameEng}</span>
            <DiceRoller key="def-resolve-phase" className="bhud__dice-roller" lockedDie={12} fixedResult={turn.defendRoll} accentColor={defender?.theme[9]} themeColors={dieColors(defender)} autoRoll hidePrompt onRollEnd={() => setDefRollDone(true)} />
            <span className="bhud__dice-bonus">
              {!defRollDone
                ? 'rolling...'
                : (defender?.defendDiceUp ?? 0) > 0
                  ? `+${defender!.defendDiceUp} → ${turn.defendRoll + defender!.defendDiceUp}`
                  : turn.defendRoll}
            </span>
          </div>
        </div>
      )}
      {/* Resolve bar — only after defend result finishes, with exit fade */}
      {showResolve && (() => {
        const rc = resolveCache.current;
        return (
          <div className={`bhud__resolve ${rc.isHit ? '' : 'bhud__resolve--miss'} ${resolveExiting ? 'bhud__resolve--exit' : ''}`}>
            <div className="bhud__resolve-info">
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
                <span className="bhud__resolve-dmg">-{rc.damage} DMG</span>
              ) : (
                <span className="bhud__resolve-miss">BLOCKED!</span>
              )}
            </div>
          </div>
        );
      })()}

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
