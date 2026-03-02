import type { FighterState, TurnState } from '../../../../../types/battle';
import { DEITY_THEMES, DEFAULT_THEME } from '../../../../../constants/theme';
import DiceRoller from '../../../../../components/DiceRoller/DiceRoller';
import './DiceModal.scss';

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
  atkSide: 'left' | 'right';
  defSide: 'left' | 'right';
  onAttackRoll: (roll: number) => void;
  onDefendRoll: (roll: number) => void;
  onAtkRollDone: () => void;
  onDefRollDone: () => void;
  atkRollDone: boolean;
  defRollDone: boolean;
  defendReady: boolean;
  resolveReady: boolean;
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
}: Props) {
  const { phase } = turn;
  const atkTheme = themeStyle(attacker);
  const defTheme = themeStyle(defender);

  return (
    <>
      {/* ── ROLLING ATTACK ── */}
      {/* My attack dice roller */}
      {phase === 'rolling-attack' && isMyTurn && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <div className="bhud__dice-modal" style={atkTheme}>
            <span className="bhud__dice-label">Attack Roll</span>
            <span className="bhud__dice-sub">
              {attacker?.nicknameEng} → {defender?.nicknameEng}
            </span>
            <DiceRoller className="bhud__dice-roller" lockedDie={12} onRollResult={onAttackRoll} themeColors={dieColors(attacker)} hidePrompt />
            <span className="bhud__dice-bonus">dice up: {attacker?.attackDiceUp ?? 0}</span>
          </div>
        </div>
      )}
      {/* Opponent's attack — waiting spinner */}
      {phase === 'rolling-attack' && !isMyTurn && (
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
      {/* Attacker's result dice — only when opponent attacked (I need to see their roll) */}
      {phase === 'rolling-defend' && turn.attackRoll != null && !isMyTurn && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <div className="bhud__dice-modal" style={atkTheme}>
            <span className="bhud__dice-label">Attack Roll</span>
            <span className="bhud__dice-sub">{attacker?.nicknameEng}</span>
            <DiceRoller key="atk-defend-phase" className="bhud__dice-roller" lockedDie={12} fixedResult={turn.attackRoll} accentColor={attacker?.theme[9]} themeColors={dieColors(attacker)} autoRoll hidePrompt onRollEnd={onAtkRollDone} />
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
      {phase === 'rolling-defend' && isMyDefend && defendReady && (
        <div className={`bhud__dice-zone bhud__dice-zone--${defSide}`}>
          <div className="bhud__dice-modal" style={defTheme}>
            <span className="bhud__dice-label">Defense Roll</span>
            <span className="bhud__dice-sub">
              Defending against {attacker?.nicknameEng}
            </span>
            <DiceRoller key="def-my-roll" className="bhud__dice-roller" lockedDie={12} onRollResult={onDefendRoll} themeColors={dieColors(defender)} hidePrompt />
            <span className="bhud__dice-bonus">dice up: {defender?.defendDiceUp ?? 0}</span>
          </div>
        </div>
      )}
      {/* Opponent's defend — waiting spinner */}
      {phase === 'rolling-defend' && !isMyDefend && (
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

      {/* ── RESOLVING — show defend result dice (opponent defended, I need to see their roll) ── */}
      {phase === 'resolving' && !(turn.action === 'power' && !turn.attackRoll) && turn.defendRoll != null && !resolveReady && !isMyDefend && (
        <div className={`bhud__dice-zone bhud__dice-zone--${defSide}`}>
          <div className="bhud__dice-modal" style={defTheme}>
            <span className="bhud__dice-label">Defense Roll</span>
            <span className="bhud__dice-sub">{defender?.nicknameEng}</span>
            <DiceRoller key="def-resolve-phase" className="bhud__dice-roller" lockedDie={12} fixedResult={turn.defendRoll} accentColor={defender?.theme[9]} themeColors={dieColors(defender)} autoRoll hidePrompt onRollEnd={onDefRollDone} />
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
    </>
  );
}
