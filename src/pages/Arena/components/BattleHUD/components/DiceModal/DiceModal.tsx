import type { FighterState, TurnState } from '../../../../../../types/battle';
import { DEITY_THEMES, DEFAULT_THEME } from '../../../../../../constants/theme';
import { PHASE, TURN_ACTION, type PanelSide } from '../../../../../../constants/battle';
import { useEffect, useRef, useState } from 'react';
import DiceRoller from '../../../../../../components/DiceRoller/DiceRoller';
import './DiceModal.scss';

/** Short delay after attack animation ends before showing defender waiting (stable transition) */
const DEFENDER_AFTER_ATK_DONE_MS = 100;

/** Get die theme colors for a fighter */
function dieColors(f?: FighterState): { primary: string; primaryDark: string } {
  const t = f?.theme ?? (f?.deityBlood ? DEITY_THEMES[f.deityBlood] : undefined) ?? DEFAULT_THEME;
  return { primary: t[0], primaryDark: t[18] };
}

interface Props {
  turn: TurnState;
  attacker?: FighterState;
  defender?: FighterState;
  isMyTurn: boolean;
  isMyDefend: boolean;
  atkSide: PanelSide;
  defSide: PanelSide;
  onAttackRoll: (roll: number) => void;
  onDefendRoll: (roll: number) => void;
  onAtkRollDone: () => void;
  onDefRollDone: () => void;
  atkRollDone: boolean;
  defRollDone: boolean;
  defendReady: boolean;
  resolveReady: boolean;
  /* D4 crit check */
  critEligible?: boolean;
  critReady?: boolean;
  critWinFaces?: number[];
  critRollResult?: number;
  onCritRollResult?: (roll: number) => void;
  /* Thunderbolt chain D4 check */
  chainEligible?: boolean;
  chainReady?: boolean;
  chainWinFaces?: number[];
  chainRollResult?: number;
  onChainRollResult?: (roll: number) => void;
  /* Pomegranate's Oath dodge D4 check */
  dodgeEligible?: boolean;
  dodgeReady?: boolean;
  dodgeWinFaces?: number[];
  dodgeRollResult?: number;
  onDodgeRollResult?: (roll: number) => void;
  /* Pomegranate's Oath co-attack D12 */
  coAttackEligible?: boolean;
  coAttackReady?: boolean;
  coAttackRollResult?: number;
  onCoAttackRollResult?: (roll: number) => void;
  coAttackCaster?: FighterState;
  /* Active effect buff modifiers */
  atkBuffMod?: number;
  defBuffMod?: number;
}

/** CSS custom properties for modal theming */
function themeStyle(f?: FighterState): React.CSSProperties {
  const c = dieColors(f);
  return { '--modal-primary': c.primary, '--modal-dark': c.primaryDark } as React.CSSProperties;
}

export default function DiceModal({
  turn, attacker, defender,
  isMyTurn, isMyDefend, atkSide, defSide,
  onAttackRoll, onDefendRoll, onAtkRollDone, onDefRollDone,
  atkRollDone, defRollDone, defendReady, resolveReady,
  critEligible, critReady, critWinFaces, critRollResult, onCritRollResult,
  chainEligible, chainReady, chainWinFaces, chainRollResult, onChainRollResult,
  dodgeEligible, dodgeReady, dodgeWinFaces, dodgeRollResult, onDodgeRollResult,
  coAttackEligible, coAttackReady, coAttackRollResult, onCoAttackRollResult, coAttackCaster,
  atkBuffMod = 0, defBuffMod = 0,
}: Props) {
  const { phase } = turn;
  const atkTheme = themeStyle(attacker);
  const defTheme = themeStyle(defender);

  // ── Stable display state: only advance forward, never revert (fixes jitter when phase/turn updates arrive out of order) ──
  const turnKeyRef = useRef<string>('');
  const latchedPhaseRef = useRef<string>(phase);
  const latchedAttackRollRef = useRef<number | null>(null);
  const latchedDefendRollRef = useRef<number | null>(null);
  const [showDefenderWaiting, setShowDefenderWaiting] = useState(false);

  const turnKey = `${turn.attackerId ?? ''}:${turn.defenderId ?? ''}`;
  const prevTurnKeyRef = useRef(turnKey);
  if (turnKey !== turnKeyRef.current) {
    prevTurnKeyRef.current = turnKeyRef.current;
    turnKeyRef.current = turnKey;
    latchedPhaseRef.current = phase;
    latchedAttackRollRef.current = turn.attackRoll ?? null;
    latchedDefendRollRef.current = turn.defendRoll ?? null;
  }
  useEffect(() => {
    if (prevTurnKeyRef.current !== turnKeyRef.current) {
      prevTurnKeyRef.current = turnKeyRef.current;
      setShowDefenderWaiting(false);
    }
  });

  // Latch phase/rolls forward only
  if (phase === PHASE.ROLLING_DEFEND && turn.attackRoll != null) {
    latchedPhaseRef.current = PHASE.ROLLING_DEFEND;
    latchedAttackRollRef.current = turn.attackRoll;
  }
  if (phase === PHASE.RESOLVING) {
    latchedPhaseRef.current = PHASE.RESOLVING;
    if (turn.defendRoll != null) latchedDefendRollRef.current = turn.defendRoll;
  }
  if (phase === PHASE.ROLLING_ATTACK) {
    latchedAttackRollRef.current = null;
    latchedDefendRollRef.current = null;
  }

  const latchedPhase = latchedPhaseRef.current;
  const latchedAttackRoll = latchedAttackRollRef.current;

  // Show defender-side "waiting" ONLY after attack roll animation has fully ended (atkRollDone). No time-based fallback — wait for animation.
  const defenderEligible =
    latchedPhase === PHASE.ROLLING_DEFEND &&
    !isMyDefend &&
    latchedAttackRoll != null &&
    atkRollDone;
  useEffect(() => {
    if (!defenderEligible) {
      setShowDefenderWaiting(false);
      return;
    }
    const t = window.setTimeout(() => setShowDefenderWaiting(true), DEFENDER_AFTER_ATK_DONE_MS);
    return () => clearTimeout(t);
  }, [defenderEligible]);

  // What to show for attack side (opponent flow): wait → replay; never go back to wait once we have replay
  const showAttackWait = latchedPhase === PHASE.ROLLING_ATTACK || (latchedPhase === PHASE.ROLLING_DEFEND && latchedAttackRoll == null);
  const showAttackReplay = latchedPhase === PHASE.ROLLING_DEFEND && latchedAttackRoll != null && !isMyTurn;

  return (
    <>
      {/* ── ROLLING ATTACK ── */}
      {/* My attack dice roller */}
      {phase === PHASE.ROLLING_ATTACK && isMyTurn && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <div className="bhud__dice-modal" style={atkTheme}>
            <span className="bhud__dice-label">Attack Roll</span>
            <span className="bhud__dice-sub">
              {attacker?.nicknameEng} → {defender?.nicknameEng}
            </span>
            <DiceRoller className="bhud__dice-roller" lockedDie={12} onRollResult={onAttackRoll} themeColors={dieColors(attacker)} hidePrompt />
            <span className="bhud__dice-bonus">dice up: {(attacker?.attackDiceUp ?? 0) + atkBuffMod}</span>
          </div>
        </div>
      )}
      {/* Opponent's attack — waiting spinner (stable: show until we have attack roll, no revert) */}
      {showAttackWait && !isMyTurn && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <div className="bhud__dice-modal" style={atkTheme}>
            <span className="bhud__dice-label">Attack Roll</span>
            <span className="bhud__dice-sub">{attacker?.nicknameEng} → {defender?.nicknameEng}</span>
            <div className="bhud__dice-roller bhud__dice-roller--waiting">
              <div className="bhud__roll-waiting-spinner" />
            </div>
          </div>
        </div>
      )}

      {/* ── ROLLING DEFEND ── */}
      {/* Attacker's result dice (stable: once we have roll we keep showing until atkRollDone) */}
      {showAttackReplay && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <div className="bhud__dice-modal" style={atkTheme}>
            <span className="bhud__dice-label">Attack Roll</span>
            <span className="bhud__dice-sub">{attacker?.nicknameEng}</span>
            <DiceRoller key="atk-defend-phase" className="bhud__dice-roller" lockedDie={12} fixedResult={latchedAttackRoll ?? 0} accentColor={attacker?.theme[9]} themeColors={dieColors(attacker)} autoRoll hidePrompt onRollEnd={onAtkRollDone} />
            <span className="bhud__dice-bonus">
              {!atkRollDone
                ? 'rolling...'
                : ((attacker?.attackDiceUp ?? 0) + atkBuffMod) > 0
                  ? `+${(attacker?.attackDiceUp ?? 0) + atkBuffMod} → ${(latchedAttackRoll ?? 0) + (attacker?.attackDiceUp ?? 0) + atkBuffMod}`
                  : latchedAttackRoll}
            </span>
          </div>
        </div>
      )}
      {/* My defend dice roller — only after attack result finishes */}
      {phase === PHASE.ROLLING_DEFEND && isMyDefend && defendReady && (
        <div className={`bhud__dice-zone bhud__dice-zone--${defSide}`}>
          <div className="bhud__dice-modal" style={defTheme}>
            <span className="bhud__dice-label">Defense Roll</span>
            <span className="bhud__dice-sub">
              Defending against {attacker?.nicknameEng}
            </span>
            <DiceRoller key="def-my-roll" className="bhud__dice-roller" lockedDie={12} onRollResult={onDefendRoll} themeColors={dieColors(defender)} hidePrompt />
            <span className="bhud__dice-bonus">dice up: {(defender?.defendDiceUp ?? 0) + defBuffMod}</span>
          </div>
        </div>
      )}
      {/* Opponent's defend — waiting spinner (stable: only after attack replay has been visible for min time) */}
      {latchedPhase === PHASE.ROLLING_DEFEND && !isMyDefend && latchedAttackRoll != null && showDefenderWaiting && (
        <div className={`bhud__dice-zone bhud__dice-zone--${defSide}`}>
          <div className="bhud__dice-modal" style={defTheme}>
            <span className="bhud__dice-label">Defense Roll</span>
            <span className="bhud__dice-sub">{defender?.nicknameEng}</span>
            <div className="bhud__dice-roller bhud__dice-roller--waiting">
              <div className="bhud__roll-waiting-spinner" />
            </div>
          </div>
        </div>
      )}

      {/* ── RESOLVING — show defend result dice (opponent defended, I need to see their roll). Skip when Soul Devourer drain (no defend roll). ── */}
      {phase === PHASE.RESOLVING && !(turn as any).soulDevourerDrain && !(turn.action === TURN_ACTION.POWER && !turn.attackRoll) && turn.defendRoll != null && !resolveReady && !isMyDefend && (
        <div className={`bhud__dice-zone bhud__dice-zone--${defSide}`}>
          <div className="bhud__dice-modal" style={defTheme}>
            <span className="bhud__dice-label">Defense Roll</span>
            <span className="bhud__dice-sub">{defender?.nicknameEng}</span>
            <DiceRoller key="def-resolve-phase" className="bhud__dice-roller" lockedDie={12} fixedResult={turn.defendRoll} accentColor={defender?.theme[9]} themeColors={dieColors(defender)} autoRoll hidePrompt onRollEnd={onDefRollDone} />
            <span className="bhud__dice-bonus">
              {!defRollDone
                ? 'rolling...'
                : ((defender?.defendDiceUp ?? 0) + defBuffMod) > 0
                  ? `+${(defender?.defendDiceUp ?? 0) + defBuffMod} → ${turn.defendRoll + (defender?.defendDiceUp ?? 0) + defBuffMod}`
                  : turn.defendRoll}
            </span>
          </div>
        </div>
      )}

      {/* ── D4 DODGE CHECK (Pomegranate's Oath) — after defend replay, before crit ── */}
      {phase === PHASE.RESOLVING && resolveReady && !dodgeReady && dodgeEligible && (
        <div className={`bhud__dice-zone bhud__dice-zone--${defSide}`}>
          <div className="bhud__dice-modal" style={defTheme}>
            <span className="bhud__dice-label">Spirit Dodge</span>
            <span className="bhud__dice-sub">{defender?.nicknameEng} — D4 (50%)</span>
            {isMyDefend ? (
              <DiceRoller
                key="dodge-my-roll"
                className="bhud__dice-roller"
                lockedDie={4}
                onRollResult={onDodgeRollResult}
                themeColors={dieColors(defender)}
                hidePrompt
              />
            ) : (dodgeRollResult ?? 0) > 0 ? (
              <DiceRoller
                key={`dodge-replay-${dodgeRollResult}`}
                className="bhud__dice-roller"
                lockedDie={4}
                fixedResult={dodgeRollResult}
                autoRoll
                hidePrompt
                themeColors={dieColors(defender)}
              />
            ) : (
              <div className="bhud__dice-roller bhud__dice-roller--waiting">
                <div className="bhud__roll-waiting-spinner" />
              </div>
            )}
            <span className="bhud__dice-bonus">dodge: {dodgeWinFaces?.sort((a, b) => a - b).join(', ') || '—'}</span>
          </div>
        </div>
      )}

      {/* ── D4 CRITICAL CHECK — after dodge, before resolve bar. Skip when Soul Devourer drain (no crit). ── */}
      {phase === PHASE.RESOLVING && !(turn as any).soulDevourerDrain && resolveReady && dodgeReady && !critReady && critEligible && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <div className="bhud__dice-modal" style={atkTheme}>
            <span className="bhud__dice-label">Critical Check</span>
            <span className="bhud__dice-sub">{attacker?.nicknameEng} — D4</span>
            {isMyTurn ? (
              <DiceRoller
                key="crit-my-roll"
                className="bhud__dice-roller"
                lockedDie={4}
                onRollResult={onCritRollResult}
                themeColors={dieColors(attacker)}
                hidePrompt
              />
            ) : (critRollResult ?? 0) > 0 ? (
              <DiceRoller
                key={`crit-replay-${critRollResult}`}
                className="bhud__dice-roller"
                lockedDie={4}
                fixedResult={critRollResult}
                autoRoll
                hidePrompt
                themeColors={dieColors(attacker)}
              />
            ) : (
              <div className="bhud__dice-roller bhud__dice-roller--waiting">
                <div className="bhud__roll-waiting-spinner" />
              </div>
            )}
            <span className="bhud__dice-bonus">critical: {critWinFaces?.sort((a, b) => a - b).join(', ') || '—'}</span>
          </div>
        </div>
      )}

      {/* ── D4 THUNDERBOLT CHAIN CHECK — after crit, before resolve bar ── */}
      {phase === PHASE.RESOLVING && resolveReady && critReady && !chainReady && chainEligible && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <div className="bhud__dice-modal" style={atkTheme}>
            <span className="bhud__dice-label">Thunderbolt Chain</span>
            <span className="bhud__dice-sub">{attacker?.nicknameEng} — D4 (50%)</span>
            {isMyTurn ? (
              <DiceRoller
                key="chain-my-roll"
                className="bhud__dice-roller"
                lockedDie={4}
                onRollResult={onChainRollResult}
                themeColors={dieColors(attacker)}
                hidePrompt
              />
            ) : (chainRollResult ?? 0) > 0 ? (
              <DiceRoller
                key={`chain-replay-${chainRollResult}`}
                className="bhud__dice-roller"
                lockedDie={4}
                fixedResult={chainRollResult}
                autoRoll
                hidePrompt
                themeColors={dieColors(attacker)}
              />
            ) : (
              <div className="bhud__dice-roller bhud__dice-roller--waiting">
                <div className="bhud__roll-waiting-spinner" />
              </div>
            )}
            <span className="bhud__dice-bonus">chain: {chainWinFaces?.sort((a, b) => a - b).join(', ') || '—'}</span>
          </div>
        </div>
      )}

      {/* ── D12 CO-ATTACK (Pomegranate's Oath) — after chain, before resolve bar ── */}
      {phase === PHASE.RESOLVING && resolveReady && critReady && chainReady && !coAttackReady && coAttackEligible && coAttackCaster && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <div className="bhud__dice-modal" style={themeStyle(coAttackCaster)}>
            <span className="bhud__dice-label">Co-Attack</span>
            <span className="bhud__dice-sub">{coAttackCaster.nicknameEng} — D12</span>
            {coAttackCaster.characterId === attacker?.characterId ? (
              // Self-oath: caster is the attacker (isMyTurn controls)
              isMyTurn ? (
                <DiceRoller
                  key="coatk-my-roll"
                  className="bhud__dice-roller"
                  lockedDie={12}
                  onRollResult={onCoAttackRollResult}
                  themeColors={dieColors(coAttackCaster)}
                  hidePrompt
                />
              ) : (coAttackRollResult ?? 0) > 0 ? (
                <DiceRoller
                  key={`coatk-replay-${coAttackRollResult}`}
                  className="bhud__dice-roller"
                  lockedDie={12}
                  fixedResult={coAttackRollResult}
                  autoRoll
                  hidePrompt
                  themeColors={dieColors(coAttackCaster)}
                />
              ) : (
                <div className="bhud__dice-roller bhud__dice-roller--waiting">
                  <div className="bhud__roll-waiting-spinner" />
                </div>
              )
            ) : (
              // Caster is a teammate, not the current attacker
              (coAttackRollResult ?? 0) > 0 ? (
                <DiceRoller
                  key={`coatk-replay-${coAttackRollResult}`}
                  className="bhud__dice-roller"
                  lockedDie={12}
                  fixedResult={coAttackRollResult}
                  autoRoll
                  hidePrompt
                  themeColors={dieColors(coAttackCaster)}
                />
              ) : (
                <div className="bhud__dice-roller bhud__dice-roller--waiting">
                  <div className="bhud__roll-waiting-spinner" />
                </div>
              )
            )}
            <span className="bhud__dice-bonus">co-attack</span>
          </div>
        </div>
      )}
    </>
  );
}
