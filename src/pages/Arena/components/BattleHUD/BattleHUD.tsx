import { useRef, useCallback, useEffect, useState } from 'react';
import type { BattleState, FighterState } from '../../../../types/battle';
import { DEITY_THEMES, DEFAULT_THEME } from '../../../../constants/theme';
import DiceRoller from '../../../../components/DiceRoller/DiceRoller';
import './BattleHUD.scss';

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

  /* ── Sequencing: wait for opponent's dice to finish before next step ── */
  const [defendReady, setDefendReady] = useState(false);
  const [resolveReady, setResolveReady] = useState(false);

  // When rolling-defend starts, wait for attack result dice to animate (only when opponent attacked)
  useEffect(() => {
    if (turn?.phase === 'rolling-defend') {
      setDefendReady(false);
      // If I attacked, no attack replay to wait for → short delay
      // If opponent attacked, wait for their attack result autoRoll to finish
      const delay = turn.attackerId === myId ? 500 : 2800;
      const timer = setTimeout(() => setDefendReady(true), delay);
      return () => clearTimeout(timer);
    }
  }, [turn?.phase, turn?.attackerId, myId]);

  // When resolving starts, wait for defend result dice to animate (only when opponent defended)
  useEffect(() => {
    if (turn?.phase === 'resolving') {
      setResolveReady(false);
      // If I defended, no replay to wait for → short delay
      // If opponent defended, wait for their defend result autoRoll to finish
      const delay = turn.defenderId === myId ? 500 : 2800;
      const timer = setTimeout(() => setResolveReady(true), delay);
      return () => clearTimeout(timer);
    }
  }, [turn?.phase, turn?.defenderId, myId]);

  /* ── Auto-resolve after showing result (only after resolve is ready) ── */
  useEffect(() => {
    if (turn?.phase !== 'resolving' || !resolveReady) return;
    const timer = setTimeout(() => onResolve(), 2500);
    return () => clearTimeout(timer);
  }, [turn?.phase, resolveReady, onResolve]);

  /* ── Winner ── */
  if (winner) {
    const winTeam = winner === 'teamA' ? teamA : teamB;
    const winNames = winTeam.map((f) => f.nicknameEng).join(' & ');
    return (
      <div className="bhud">
        <div className="bhud__winner">
          <span className="bhud__winner-label">Victory</span>
          <span className="bhud__winner-name">{winNames}</span>
        </div>
      </div>
    );
  }

  if (!turn) return null;

  /* ── Resolve info ── */
  const atkTotal = (turn.attackRoll ?? 0) + (attacker?.attackDiceUp ?? 0);
  const defTotal = (turn.defendRoll ?? 0) + (defender?.defendDiceUp ?? 0);
  const hit = atkTotal > defTotal;

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
          </div>
        </div>
      )}
      {/* Opponent's attack — waiting spinner */}
      {turn.phase === 'rolling-attack' && !isMyTurn && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <div className="bhud__dice-modal">
            <span className="bhud__dice-label">Attack Roll</span>
            <span className="bhud__dice-sub">{attacker?.nicknameEng} → {defender?.nicknameEng}</span>
            <div className="bhud__roll-waiting-spinner" />
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
            <DiceRoller key="atk-defend-phase" className="bhud__dice-roller" lockedDie={12} fixedResult={turn.attackRoll} accentColor={attacker?.theme[9]} themeColors={dieColors(attacker)} autoRoll hidePrompt />
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
          </div>
        </div>
      )}
      {/* Opponent's defend — waiting spinner */}
      {turn.phase === 'rolling-defend' && !isMyDefend && (
        <div className={`bhud__dice-zone bhud__dice-zone--${defSide}`}>
          <div className="bhud__dice-modal">
            <span className="bhud__dice-label">Defense Roll</span>
            <span className="bhud__dice-sub">{defender?.nicknameEng}</span>
            <div className="bhud__roll-waiting-spinner" />
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
            <DiceRoller key="def-resolve-phase" className="bhud__dice-roller" lockedDie={12} fixedResult={turn.defendRoll} accentColor={defender?.theme[9]} themeColors={dieColors(defender)} autoRoll hidePrompt />
          </div>
        </div>
      )}
      {/* Resolve bar — only after defend result finishes */}
      {turn.phase === 'resolving' && resolveReady && attacker && defender && (
        <div className={`bhud__resolve ${hit ? '' : 'bhud__resolve--miss'}`}>
          <div className="bhud__resolve-info">
            <div className="bhud__resolve-rolls">
              <span className="bhud__resolve-roll">
                <span className="bhud__resolve-roll-label">ATK</span>
                <span className="bhud__resolve-roll-val">{turn.attackRoll ?? 0}</span>
                {(attacker.attackDiceUp > 0) && (
                  <span className="bhud__resolve-roll-bonus">+{attacker.attackDiceUp}</span>
                )}
                <span className="bhud__resolve-roll-total">= {atkTotal}</span>
              </span>
              <span className="bhud__resolve-vs">vs</span>
              <span className="bhud__resolve-roll">
                <span className="bhud__resolve-roll-label">DEF</span>
                <span className="bhud__resolve-roll-val">{turn.defendRoll ?? 0}</span>
                {(defender.defendDiceUp > 0) && (
                  <span className="bhud__resolve-roll-bonus">+{defender.defendDiceUp}</span>
                )}
                <span className="bhud__resolve-roll-total">= {defTotal}</span>
              </span>
            </div>
            {hit ? (
              <span className="bhud__resolve-dmg">-{attacker.damage} DMG</span>
            ) : (
              <span className="bhud__resolve-miss">BLOCKED!</span>
            )}
          </div>
        </div>
      )}

      {/* Waiting for opponent to select target */}
      {!isMyTurn && turn.phase === 'select-target' && (
        <div className="bhud__waiting">
          Waiting for {attacker?.nicknameEng ?? '...'}...
        </div>
      )}

      {/* Battle log */}
      {log.length > 0 && (
        <div className="bhud__log">
          {log.slice(-5).reverse().map((entry, i) => {
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
                <span className="bhud__log-vs">vs</span>
                <span className="bhud__log-name" style={defColor ? { color: defColor } : undefined}>{defName}</span>
                <span className="bhud__log-dice">{entry.defendRoll}</span>
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
      )}
    </div>
  );
}
