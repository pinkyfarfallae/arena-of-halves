import { useRef, useCallback, useEffect, useState } from 'react';
import type { BattleState, FighterState } from '../../../../types/battle';
import WinBadge from './icons/Winner';
import LoseBadge from './icons/Loser';
import TargetSelectModal from './components/TargetSelectModal';
import ActionSelectModal from './components/ActionSelectModal';
import DiceModal from './components/DiceModal';
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
  onSelectAction: (action: 'attack' | 'power', powerIndex?: number) => void;
  onSubmitAttackRoll: (roll: number) => void;
  onSubmitDefendRoll: (roll: number) => void;
  onResolve: () => void;
}

/** Find a fighter across both teams */
function find(teamA: FighterState[], teamB: FighterState[], id: string): FighterState | undefined {
  return [...teamA, ...teamB].find((f) => f.characterId === id);
}

export default function BattleHUD({
  battle, teamA, teamB, myId,
  onSelectTarget, onSelectAction, onSubmitAttackRoll, onSubmitDefendRoll, onResolve,
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
  const resolveCache = useRef({ atkRoll: 0, defRoll: 0, atkBonus: 0, defBonus: 0, atkTotal: 0, defTotal: 0, isHit: false, damage: 0, isPower: false, powerName: '' });
  if (resolveVisible && turn && attacker && defender) {
    const isSkipDicePower = turn.action === 'power' && !turn.attackRoll;
    if (isSkipDicePower) {
      resolveCache.current = {
        atkRoll: 0, defRoll: 0, atkBonus: 0, defBonus: 0, atkTotal: 0, defTotal: 0,
        isHit: true, damage: 0, isPower: true, powerName: turn.usedPowerName ?? 'Power',
      };
    } else {
      const at = (turn.attackRoll ?? 0) + attacker.attackDiceUp;
      const dt = (turn.defendRoll ?? 0) + defender.defendDiceUp;
      resolveCache.current = {
        atkRoll: turn.attackRoll ?? 0, defRoll: turn.defendRoll ?? 0,
        atkBonus: attacker.attackDiceUp, defBonus: defender.defendDiceUp,
        atkTotal: at, defTotal: dt, isHit: at > dt, damage: attacker.damage,
        isPower: turn.action === 'power', powerName: turn.usedPowerName ?? '',
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
                {turn.phase === 'select-action' && 'choosing action...'}
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
      {isMyTurn && turn.phase === 'select-target' && (
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
            onSelectAction={onSelectAction}
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
                <span className="bhud__resolve-dmg">{rc.isPower ? 'INVOKED!' : `-${rc.damage} DMG`}</span>
              ) : (
                <span className="bhud__resolve-miss">{rc.isPower ? 'RESISTED!' : 'BLOCKED!'}</span>
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
