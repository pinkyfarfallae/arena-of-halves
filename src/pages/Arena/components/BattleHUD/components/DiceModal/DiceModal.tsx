import type { FighterState, TurnState } from '../../../../../../types/battle';
import { DEITY_THEMES, DEFAULT_THEME } from '../../../../../../constants/theme';
import { PHASE, TURN_ACTION, type PanelSide } from '../../../../../../constants/battle';
import { POWERS_DEFENDER_CANNOT_DEFEND } from '../../../../../../constants/powers';
import { useEffect, useRef, useState } from 'react';
import DiceRoller from '../../../../../../components/DiceRoller/DiceRoller';
import './DiceModal.scss';

/** Brief delay after attack animation ends before showing defender (smooth transition to next phase) */
const AFTER_ANIM_MS = 150;

/** When server already has defend roll (e.g. NPC), show "defender rolling" this long before animating NPC dice */
const NPC_DEFEND_ROLL_DELAY_MS = 1000;

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
  /** When set, overrides isMyDefend for Pomegranate dodge D4 only (play-all: myId follows attacker during RESOLVING replay). */
  isDefenderDodgeInteractive?: boolean;
  /** Dev UI: myId follows attacker in RESOLVING — still show defender’s D12 replay until defRollDone (same as dodge embody). */
  embodyDefenderForDefReplay?: boolean;
  /** Play-all: myId follows attacker during pomegranate co-defend RESOLVING replay (co D12 only). */
  embodyDefenderForPomCoDefReplay?: boolean;
  /** Play-all: myId follows defender in ROLLING_DEFEND — still show atk-my-roll until atkRollDone. */
  embodyAttackerForAttackReplay?: boolean;
  /** Play-all host: suppress second attack DiceRoller (atk-defend-phase) that replays the same roll. */
  playbackHostHideEchoAttackReplay?: boolean;
  atkSide: PanelSide;
  defSide: PanelSide;
  onAttackRoll: (roll: number) => void;
  onDefendRoll: (roll: number) => void;
  /** Pre-rolled value so we send on click and animate to it (viewer gets result in sync) */
  preRolledAttack?: number | null;
  preRolledDefend?: number | null;
  onAttackRollStart?: () => void;
  onDefendRollStart?: () => void;
  onAtkRollDone: () => void;
  onDefRollDone: () => void;
  atkRollDone: boolean;
  defRollDone: boolean;
  defendReady: boolean;
  resolveReady: boolean;
  /** When true (inspect/viewer mode), skip replay and delays — show dice by phase/rolls only */
  isViewer?: boolean;
  /* D4 crit check */
  critEligible?: boolean;
  critReady?: boolean;
  critWinFaces?: number[];
  critRollResult?: number;
  onCritRollResult?: (roll: number) => void;
  /** Called when player clicks to roll — submit immediately so viewer dice start at same time */
  onCritRollStart?: () => void;
  /** When replay roller (viewer/NPC) finishes animating — wait for this before advancing */
  onCritReplayEnd?: () => void;
  /* Keraunos Voltage chain D4 check */
  chainEligible?: boolean;
  chainReady?: boolean;
  chainWinFaces?: number[];
  chainRollResult?: number;
  onChainRollResult?: (roll: number) => void;
  onChainRollStart?: () => void;
  onChainReplayEnd?: () => void;
  /* Pomegranate's Oath dodge D4 check */
  dodgeEligible?: boolean;
  dodgeReady?: boolean;
  dodgeWinFaces?: number[];
  dodgeRollResult?: number;
  onDodgeRollResult?: (roll: number) => void;
  onDodgeRollStart?: () => void;
  onDodgeReplayEnd?: () => void;
  /** Pomegranate co-attack: oath caster (D12) / same defender (defend) in dedicated phases */
  coAttackCaster?: FighterState;
  isMyPomegranateCoAttack?: boolean;
  /** Atk dice-up modifier for co caster (may differ from main attacker) */
  pomCoAtkBuffMod?: number;
  /* Active effect buff modifiers */
  atkBuffMod?: number;
  defBuffMod?: number;
  /** When true, current resolve is a skeleton/minion hit (non-defensible) — hide defense dice. */
  skeletonHitActive?: boolean;
}

/** CSS custom properties for modal theming */
function themeStyle(f?: FighterState): React.CSSProperties {
  const c = dieColors(f);
  return { '--modal-primary': c.primary, '--modal-dark': c.primaryDark } as React.CSSProperties;
}

export default function DiceModal({
  turn, attacker, defender,
  isMyTurn, isMyDefend, isDefenderDodgeInteractive, embodyDefenderForDefReplay = false, embodyDefenderForPomCoDefReplay = false, embodyAttackerForAttackReplay = false, playbackHostHideEchoAttackReplay = false, atkSide, defSide,
  preRolledAttack, preRolledDefend,
  onAttackRoll, onDefendRoll, onAttackRollStart, onDefendRollStart, onAtkRollDone, onDefRollDone,
  atkRollDone, defRollDone, defendReady, resolveReady, isViewer = false,
  critEligible, critReady, critWinFaces, critRollResult, onCritRollResult, onCritRollStart, onCritReplayEnd,
  chainEligible, chainReady, chainWinFaces, chainRollResult, onChainRollResult, onChainRollStart, onChainReplayEnd,
  dodgeEligible, dodgeReady, dodgeWinFaces, dodgeRollResult, onDodgeRollResult, onDodgeRollStart, onDodgeReplayEnd,
  coAttackCaster, isMyPomegranateCoAttack = false,
  pomCoAtkBuffMod = 0,
  atkBuffMod = 0, defBuffMod = 0,
  skeletonHitActive = false,
}: Props) {
  const { phase } = turn;
  const awaitingPom = !!(turn as { awaitingPomegranateCoAttack?: boolean }).awaitingPomegranateCoAttack;
  const coAtkActive = awaitingPom && !!coAttackCaster;
  const attackDiceHeaderLabel = coAtkActive ? 'Co-attack dice' : 'Attack Roll';
  const displayAttackFighter = coAtkActive ? coAttackCaster : attacker;
  const hasPomCoAttackRoll = turn.coAttackRoll != null && turn.coAttackRoll > 0;
  const pomCoCritUi =
    awaitingPom &&
    !!coAttackCaster &&
    hasPomCoAttackRoll &&
    turn.coDefendRoll != null &&
    turn.coDefendRoll >= 1;
  const critDisplayFighter = pomCoCritUi ? (coAttackCaster ?? attacker) : attacker;
  const critModalTheme = themeStyle(critDisplayFighter);
  const critRollInteractive = pomCoCritUi ? !!isMyPomegranateCoAttack : !!isMyTurn;
  const displayAtkBuffMod = coAtkActive ? pomCoAtkBuffMod : atkBuffMod;
  const displayAtkTheme = themeStyle(displayAttackFighter);
  const atkTheme = themeStyle(attacker);
  const defTheme = themeStyle(defender);
  const dodgeAsDefender = isDefenderDodgeInteractive ?? isMyDefend;
  const showMyAttackInteractive =
    phase === PHASE.ROLLING_ATTACK &&
    ((isMyTurn && !awaitingPom) || (awaitingPom && !!isMyPomegranateCoAttack));

  // ── Stable display state: only advance forward, never revert (fixes jitter when phase/turn updates arrive out of order) ──
  const turnKeyRef = useRef<string>('');
  const latchedPhaseRef = useRef<string>(phase);
  const latchedAttackRollRef = useRef<number | null>(null);
  const latchedDefendRollRef = useRef<number | null>(null);
  const [showDefenderWaiting, setShowDefenderWaiting] = useState(false);
  const [showNpcDefendDice, setShowNpcDefendDice] = useState(false);
  /** Player replay: show result text as soon as die lands; parent delays atkRollDone/defRollDone so modal stays visible */
  const [atkReplayLanded, setAtkReplayLanded] = useState(false);
  const [defReplayLanded, setDefReplayLanded] = useState(false);

  const turnKey = `${turn.attackerId ?? ''}:${turn.defenderId ?? ''}`;
  const viewerAttackReplayShownRef = useRef(false);
  /** True once this client showed "my defend" in ROLLING_DEFEND; keeps def-my-roll mounted across RESOLVING before server echoes defendRoll (avoids unmount → remount → replay). */
  const wasRollingDefendAsMeRef = useRef(false);
  /** Same for attacker when server jumps ROLLING_DEFEND → RESOLVING before attack die finishes (mirror defend replay). */
  const wasRollingAttackAsMeRef = useRef(false);
  if (turnKey !== turnKeyRef.current) {
    turnKeyRef.current = turnKey;
    latchedPhaseRef.current = phase;
    latchedAttackRollRef.current = turn.attackRoll ?? null;
    latchedDefendRollRef.current = turn.defendRoll ?? null;
    viewerAttackReplayShownRef.current = false;
    wasRollingDefendAsMeRef.current = false;
    wasRollingAttackAsMeRef.current = false;
  }
  const iAmCoAttacker = !!(awaitingPom && isMyPomegranateCoAttack);
  if (
    (phase === PHASE.ROLLING_ATTACK || phase === PHASE.ROLLING_DEFEND) &&
    (isMyTurn || embodyAttackerForAttackReplay || iAmCoAttacker)
  ) {
    wasRollingAttackAsMeRef.current = true;
  }
  if (phase === PHASE.ROLLING_DEFEND && isMyDefend && defendReady) {
    wasRollingDefendAsMeRef.current = true;
  }
  useEffect(() => {
    setShowDefenderWaiting(false);
    setShowNpcDefendDice(false);
  }, [turnKey]);

  // When RESOLVING with defend roll — show defender dice after attack animation (atkRollDone) or immediately if player rolled attack. In viewer: same flow, show defender dice content without 1s delay.
  const resolvingWithNpcDefend =
    phase === PHASE.RESOLVING &&
    turn.defendRoll != null &&
    !isMyDefend &&
    !embodyDefenderForDefReplay &&
    !(turn as any).soulDevourerDrain &&
    !(turn.action === TURN_ACTION.POWER && !turn.attackRoll) &&
    !(awaitingPom && turn.coDefendRoll != null);
  const attackDoneOrPlayerRolled = atkRollDone || isMyTurn || iAmCoAttacker;
  useEffect(() => {
    if (!resolvingWithNpcDefend) {
      if (!isViewer) {
        // Don't clear during transient frames (e.g. out-of-order updates) while still in RESOLVING as attacker watching NPC defend
        const holdNpcDefendDiceUi =
          phase === PHASE.RESOLVING &&
          !isMyDefend &&
          !embodyDefenderForDefReplay &&
          !(turn as any).soulDevourerDrain &&
          !(turn.action === TURN_ACTION.POWER && !turn.attackRoll);
        if (!holdNpcDefendDiceUi) setShowNpcDefendDice(false);
      }
      return;
    }
    if (isViewer) {
      setShowNpcDefendDice(true);
      return;
    }
    if (!attackDoneOrPlayerRolled) {
      setShowNpcDefendDice(false);
      return;
    }
    const t = window.setTimeout(() => setShowNpcDefendDice(true), NPC_DEFEND_ROLL_DELAY_MS);
    return () => clearTimeout(t);
  }, [
    resolvingWithNpcDefend,
    attackDoneOrPlayerRolled,
    isViewer,
    phase,
    isMyDefend,
    turn.action,
    turn.attackRoll,
    (turn as { soulDevourerDrain?: boolean }).soulDevourerDrain,
    embodyDefenderForDefReplay,
  ]);

  // Latch phase/rolls forward only
  if (phase === PHASE.ROLLING_ATTACK) {
    latchedPhaseRef.current = PHASE.ROLLING_ATTACK;
    latchedAttackRollRef.current = null;
    latchedDefendRollRef.current = null;
  }
  if (phase === PHASE.ROLLING_DEFEND) {
    latchedPhaseRef.current = PHASE.ROLLING_DEFEND;
    if (awaitingPom && turn.coAttackRoll != null && turn.coAttackRoll > 0) {
      latchedAttackRollRef.current = turn.coAttackRoll;
    } else if (turn.attackRoll != null) {
      latchedAttackRollRef.current = turn.attackRoll;
    }
  }
  if (phase === PHASE.RESOLVING) {
    latchedPhaseRef.current = PHASE.RESOLVING;
    if (turn.defendRoll != null) latchedDefendRollRef.current = turn.defendRoll;
    if (awaitingPom && hasPomCoAttackRoll) {
      latchedAttackRollRef.current = turn.coAttackRoll ?? latchedAttackRollRef.current;
    } else if (turn.attackRoll != null) {
      latchedAttackRollRef.current = turn.attackRoll;
    }
  }

  const latchedPhase = latchedPhaseRef.current;
  const latchedAttackRoll = latchedAttackRollRef.current;

  /** When true, defender has no roll — don't show defend roll/replay to defender or "defender rolling" to attacker. */
  const defenderCannotDefend = !!(turn?.usedPowerName && (POWERS_DEFENDER_CANNOT_DEFEND as readonly string[]).includes(turn.usedPowerName));

  // Attack dice: show when opponent has roll — same flow for player & viewer (including when player is defender).
  // Never replay attack after defender: use ref so we don't show attack from RESOLVING when we already showed it in ROLLING_DEFEND (atkRollDone resets on phase change).
  const serverSkippedToResolving =
    phase === PHASE.RESOLVING && turn.attackRoll != null && turn.defendRoll != null && !(turn as any).soulDevourerDrain && !(turn.action === TURN_ACTION.POWER && !turn.attackRoll);
  const fromRollingDefend = latchedPhase === PHASE.ROLLING_DEFEND && latchedAttackRoll != null && !isMyTurn;
  // Only show RESOLVING attack replay if we never showed in ROLLING_DEFEND AND we haven't already shown in RESOLVING
  const fromResolvingSkip = serverSkippedToResolving && !atkRollDone && !isMyTurn && latchedAttackRoll != null && !viewerAttackReplayShownRef.current;
  const showAttackReplay =
    (fromRollingDefend || fromResolvingSkip) && !defRollDone && !playbackHostHideEchoAttackReplay;

  // Set ref synchronously during render to prevent double replay
  if (showAttackReplay && !viewerAttackReplayShownRef.current) {
    viewerAttackReplayShownRef.current = true;
  }

  const defenderEligible =
    showAttackReplay &&
    !isMyDefend &&
    atkRollDone;
  useEffect(() => {
    if (!defenderEligible) {
      setShowDefenderWaiting(false);
      return;
    }
    const t = window.setTimeout(() => setShowDefenderWaiting(true), AFTER_ANIM_MS);
    return () => clearTimeout(t);
  }, [defenderEligible]);

  // What to show for attack side (opponent flow): wait → replay; never go back to wait once we have replay
  const showAttackWait = latchedPhase === PHASE.ROLLING_ATTACK || (latchedPhase === PHASE.ROLLING_DEFEND && latchedAttackRoll == null);
  // After I (attacker) clicked: phase is already ROLLING_DEFEND but keep showing my attack dice until atkRollDone (play-all: embody when myId tracks defender)
  const showMyAttackReplay =
    phase === PHASE.ROLLING_DEFEND &&
    !atkRollDone &&
    (isMyTurn || embodyAttackerForAttackReplay || iAmCoAttacker);
  const hasAttackResultForMyReplay =
    (!awaitingPom && turn.attackRoll != null) ||
    (awaitingPom && hasPomCoAttackRoll) ||
    preRolledAttack != null ||
    ((isMyTurn || embodyAttackerForAttackReplay || iAmCoAttacker) && wasRollingAttackAsMeRef.current);
  const showMyAttackResolvingReplay =
    phase === PHASE.RESOLVING &&
    !atkRollDone &&
    (isMyTurn || embodyAttackerForAttackReplay || iAmCoAttacker) &&
    hasAttackResultForMyReplay &&
    !(turn.action === TURN_ACTION.POWER && !turn.attackRoll && !awaitingPom) &&
    !(turn as any).soulDevourerDrain;
  const isMyAttackReplaySegment = showMyAttackReplay || showMyAttackResolvingReplay;
  // After I (defender) clicked: phase is already RESOLVING but keep showing my defend dice replay until animation ends.
  // Do not require turn.defendRoll immediately — phase can flip before Firebase echoes the roll; use preRolledDefend / wasRollingDefendAsMeRef so DiceRoller never unmounts in that gap.
  const hasDefendResultForReplay =
    turn?.defendRoll != null ||
    (awaitingPom && turn.coDefendRoll != null) ||
    preRolledDefend != null ||
    (isMyDefend && wasRollingDefendAsMeRef.current);
  const defendReplayEmbody = isMyDefend || embodyDefenderForDefReplay || embodyDefenderForPomCoDefReplay;
  const showMyDefendReplay =
    phase === PHASE.RESOLVING && !defRollDone && defendReplayEmbody && hasDefendResultForReplay;

  /** Pomegranate co: one fixedResult for defender (incl. embody) so phase flip doesn’t swap props and remount the D12. */
  const showPomCoMyDefDice =
    awaitingPom && (isMyDefend || embodyDefenderForPomCoDefReplay);
  const pomCoDefenderDieResult =
    showPomCoMyDefDice ? (turn.coDefendRoll ?? preRolledDefend ?? undefined) : undefined;
  const pomCoDefendSubmitLocked =
    awaitingPom && turn.coDefendRoll != null && turn.coDefendRoll >= 1;
  const mainDefendSubmitLocked =
    !awaitingPom && showMyDefendReplay && (turn.defendRoll != null || preRolledDefend != null);
  const defendDieSubmitLocked = pomCoDefendSubmitLocked || mainDefendSubmitLocked;

  useEffect(() => {
    if (!showMyAttackReplay && !showMyAttackResolvingReplay) {
      setAtkReplayLanded(false);
    }
  }, [showMyAttackReplay, showMyAttackResolvingReplay]);
  useEffect(() => {
    if (atkRollDone) wasRollingAttackAsMeRef.current = false;
  }, [atkRollDone]);
  useEffect(() => {
    if (!showMyDefendReplay) setDefReplayLanded(false);
  }, [showMyDefendReplay]);
  useEffect(() => {
    if (defRollDone) {
      wasRollingDefendAsMeRef.current = false;
    }
  }, [defRollDone]);

  const replayAttackFighter =
    awaitingPom && hasPomCoAttackRoll && latchedAttackRoll === turn.coAttackRoll
      ? coAttackCaster ?? displayAttackFighter
      : displayAttackFighter;
  const replayAttackTheme = themeStyle(replayAttackFighter);
  const replayAtkBuffMod =
    awaitingPom && hasPomCoAttackRoll && latchedAttackRoll === turn.coAttackRoll ? pomCoAtkBuffMod : displayAtkBuffMod;
  const rolledAttackValue = awaitingPom
    ? (turn.coAttackRoll ?? preRolledAttack)
    : (turn.attackRoll ?? preRolledAttack);

  return (
    <>
      {/* ── ROLLING ATTACK ── */}
      {/* My attack: one block so DiceRoller never remounts; through ROLLING_DEFEND or straight to RESOLVING (fast NPC) until atkRollDone */}
      {((showMyAttackInteractive) || isMyAttackReplaySegment) && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <div className="bhud__dice-modal" style={displayAtkTheme}>
            <span className="bhud__dice-label">{attackDiceHeaderLabel}</span>
            <span className="bhud__dice-sub">
              {isMyAttackReplaySegment
                ? displayAttackFighter?.nicknameEng
                : `${displayAttackFighter?.nicknameEng} → ${defender?.nicknameEng}`}
            </span>
            <DiceRoller
              key="atk-my-roll"
              className="bhud__dice-roller"
              lockedDie={12}
              fixedResult={
                isMyAttackReplaySegment
                  ? (rolledAttackValue != null && rolledAttackValue > 0 ? rolledAttackValue : undefined)
                  : (preRolledAttack ?? undefined)
              }
              autoRoll={false}
              accentColor={displayAttackFighter?.theme[9]}
              themeColors={dieColors(displayAttackFighter)}
              onRollResult={isMyAttackReplaySegment ? undefined : onAttackRoll}
              onRollStart={isMyAttackReplaySegment ? undefined : onAttackRollStart}
              onRollEnd={() => {
                if (isMyAttackReplaySegment) setAtkReplayLanded(true);
                onAtkRollDone();
              }}
              hidePrompt
            />
            <span className="bhud__dice-bonus">
              {isMyAttackReplaySegment
                ? (!(atkRollDone || atkReplayLanded)
                  ? 'rolling...'
                  : ((displayAttackFighter?.attackDiceUp ?? 0) + displayAtkBuffMod) > 0
                    ? `+${(displayAttackFighter?.attackDiceUp ?? 0) + displayAtkBuffMod} → ${(rolledAttackValue ?? preRolledAttack ?? 0) + (displayAttackFighter?.attackDiceUp ?? 0) + displayAtkBuffMod}`
                    : String(rolledAttackValue ?? preRolledAttack))
                : `dice up: ${(displayAttackFighter?.attackDiceUp ?? 0) + displayAtkBuffMod}`}
            </span>
          </div>
        </div>
      )}
      {/* Opponent's attack — waiting spinner (stable: show until we have attack roll, no revert) */}
      {showAttackWait && !showMyAttackInteractive && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <div className="bhud__dice-modal" style={coAtkActive && phase === PHASE.ROLLING_ATTACK ? displayAtkTheme : atkTheme}>
            <span className="bhud__dice-label">{attackDiceHeaderLabel}</span>
            <span className="bhud__dice-sub">
              {coAtkActive && phase === PHASE.ROLLING_ATTACK && displayAttackFighter
                ? `${displayAttackFighter.nicknameEng} → ${defender?.nicknameEng}`
                : `${attacker?.nicknameEng} → ${defender?.nicknameEng}`}
            </span>
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
          <div className="bhud__dice-modal" style={replayAttackTheme}>
            <span className="bhud__dice-label">{attackDiceHeaderLabel}</span>
            <span className="bhud__dice-sub">{replayAttackFighter?.nicknameEng}</span>
            <DiceRoller
              key="atk-defend-phase"
              className="bhud__dice-roller"
              lockedDie={12}
              fixedResult={latchedAttackRoll ?? 0}
              accentColor={replayAttackFighter?.theme[9]}
              themeColors={dieColors(replayAttackFighter)}
              autoRoll
              hidePrompt
              onRollEnd={onAtkRollDone}
            />
            <span className="bhud__dice-bonus">
              {!atkRollDone
                ? 'rolling...'
                : ((replayAttackFighter?.attackDiceUp ?? 0) + replayAtkBuffMod) > 0
                  ? `+${(replayAttackFighter?.attackDiceUp ?? 0) + replayAtkBuffMod} → ${(latchedAttackRoll ?? 0) + (replayAttackFighter?.attackDiceUp ?? 0) + replayAtkBuffMod}`
                  : latchedAttackRoll}
            </span>
          </div>
        </div>
      )}
      {/* My defend: one block so DiceRoller never remounts; show from ROLLING_DEFEND until defRollDone after submit. Hide when power does not allow defend (e.g. Keraunos) or Soul Devourer drain (no defense roll). */}
      {((phase === PHASE.ROLLING_DEFEND && isMyDefend && defendReady) || showMyDefendReplay) &&
        !((isMyDefend || embodyDefenderForDefReplay) && defenderCannotDefend) &&
        !(turn as any).soulDevourerDrain && (
          <div className={`bhud__dice-zone bhud__dice-zone--${defSide}`}>
            <div className="bhud__dice-modal" style={defTheme}>
              <span className="bhud__dice-label">Defense Roll</span>
              <span className="bhud__dice-sub">
                {showMyDefendReplay
                  ? defender?.nicknameEng
                  : `Defending against ${(awaitingPom ? displayAttackFighter?.nicknameEng : attacker?.nicknameEng) ?? ''}`}
              </span>
              <DiceRoller
                key="def-my-roll"
                className="bhud__dice-roller"
                lockedDie={12}
                fixedResult={
                  pomCoDefenderDieResult ??
                  (!awaitingPom && showMyDefendReplay
                    ? (preRolledDefend ?? turn.defendRoll ?? undefined)
                    : !awaitingPom
                      ? (preRolledDefend ?? undefined)
                      : undefined)
                }
                autoRoll={false}
                accentColor={defender?.theme[9]}
                themeColors={dieColors(defender)}
                onRollResult={defendDieSubmitLocked ? undefined : onDefendRoll}
                onRollStart={defendDieSubmitLocked ? undefined : onDefendRollStart}
                onRollEnd={() => {
                  if (showMyDefendReplay || pomCoDefendSubmitLocked) setDefReplayLanded(true);
                  onDefRollDone();
                }}
                hidePrompt
              />
              <span className="bhud__dice-bonus">
                {showMyDefendReplay
                  ? (!(defRollDone || defReplayLanded)
                    ? 'rolling...'
                    : ((defender?.defendDiceUp ?? 0) + defBuffMod) > 0
                      ? `+${(defender?.defendDiceUp ?? 0) + defBuffMod} → ${((awaitingPom ? turn.coDefendRoll : turn.defendRoll) ?? 0) + (defender?.defendDiceUp ?? 0) + defBuffMod}`
                      : String(awaitingPom ? turn.coDefendRoll : turn.defendRoll))
                  : `dice up: ${(defender?.defendDiceUp ?? 0) + defBuffMod}`}
              </span>
            </div>
          </div>
        )}
      {/* Opponent's defend — waiting: only after attack animation has ended (atkRollDone). Hide when power does not allow defend or Soul Devourer drain. */}
      {latchedPhase === PHASE.ROLLING_DEFEND && !isMyDefend && latchedAttackRoll != null && showDefenderWaiting && !defenderCannotDefend && !(turn as any).soulDevourerDrain && (
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

      {/* ── RESOLVING — defender dice (attacker / viewer path). Play-all host already rolled defense in def-my-roll / embody — hide this auto-roll echo (same idea as playbackHostHideEchoAttackReplay). ── */}
      {phase === PHASE.RESOLVING && (atkRollDone || isMyTurn || (isViewer && turn.defendRoll != null)) && !(turn as any).soulDevourerDrain && !(turn.action === TURN_ACTION.POWER && !turn.attackRoll) && !defenderCannotDefend && !skeletonHitActive && turn.defendRoll != null && !(defRollDone && resolveReady) && !isMyDefend && !embodyDefenderForDefReplay && !playbackHostHideEchoAttackReplay && !(awaitingPom && turn.coDefendRoll != null) && (
        <div className={`bhud__dice-zone bhud__dice-zone--${defSide}`}>
          <div className="bhud__dice-modal" style={defTheme}>
            <span className="bhud__dice-label">Defense Roll</span>
            <span className="bhud__dice-sub">{defender?.nicknameEng}</span>
            {(showNpcDefendDice || isViewer) ? (
              <>
                <DiceRoller key="def-resolve-phase" className="bhud__dice-roller" lockedDie={12} fixedResult={turn.defendRoll} accentColor={defender?.theme[9]} themeColors={dieColors(defender)} autoRoll hidePrompt onRollEnd={onDefRollDone} />
                <span className="bhud__dice-bonus">
                  {!defRollDone
                    ? 'rolling...'
                    : ((defender?.defendDiceUp ?? 0) + defBuffMod) > 0
                      ? `+${(defender?.defendDiceUp ?? 0) + defBuffMod} → ${turn.defendRoll + (defender?.defendDiceUp ?? 0) + defBuffMod}`
                      : turn.defendRoll}
                </span>
              </>
            ) : (
              <div className="bhud__dice-roller bhud__dice-roller--waiting">
                <div className="bhud__roll-waiting-spinner" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* RESOLVING — viewers only: live players get defRollDone from BattleHUD (no second auto-roll / remount). */}
      {phase === PHASE.RESOLVING &&
        isViewer &&
        awaitingPom &&
        turn.coDefendRoll != null &&
        !isMyDefend &&
        !embodyDefenderForDefReplay &&
        !embodyDefenderForPomCoDefReplay &&
        atkRollDone &&
        defender && (
          <div className={`bhud__dice-zone bhud__dice-zone--${defSide}`}>
            <div className="bhud__dice-modal" style={defTheme}>
              <span className="bhud__dice-label">Defense Roll</span>
              <span className="bhud__dice-sub">{defender.nicknameEng}</span>
              <DiceRoller
                key="pom-co-def-opp"
                className="bhud__dice-roller"
                lockedDie={12}
                fixedResult={turn.coDefendRoll}
                accentColor={defender?.theme[9]}
                themeColors={dieColors(defender)}
                autoRoll
                hidePrompt
                onRollEnd={onDefRollDone}
              />
              <span className="bhud__dice-bonus">
                {!defRollDone
                  ? 'rolling...'
                  : ((defender?.defendDiceUp ?? 0) + defBuffMod) > 0
                    ? `+${(defender?.defendDiceUp ?? 0) + defBuffMod} → ${turn.coDefendRoll + (defender?.defendDiceUp ?? 0) + defBuffMod}`
                    : turn.coDefendRoll}
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
            {dodgeAsDefender ? (
              <DiceRoller
                key="dodge-d4"
                className="bhud__dice-roller"
                lockedDie={4}
                fixedResult={(dodgeRollResult ?? 0) > 0 ? dodgeRollResult : undefined}
                autoRoll={(dodgeRollResult ?? 0) > 0}
                hidePrompt
                themeColors={dieColors(defender)}
                onRollStart={onDodgeRollStart}
                onRollEnd={onDodgeReplayEnd}
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
                onRollEnd={onDodgeReplayEnd}
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

      {/* ── D4 CRITICAL CHECK — after dodge, before resolve bar. Skip when Soul Devourer drain (no crit). One DiceRoller so click starts roll instead of remounting. ── */}
      {phase === PHASE.RESOLVING && !(turn as any).soulDevourerDrain && resolveReady && dodgeReady && !critReady && critEligible && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <div className="bhud__dice-modal" style={critModalTheme}>
            <span className="bhud__dice-label">Critical Check</span>
            <span className="bhud__dice-sub">{critDisplayFighter?.nicknameEng} — D4</span>
            {critRollInteractive ? (
              <DiceRoller
                key="crit-d4"
                className="bhud__dice-roller"
                lockedDie={4}
                fixedResult={(critRollResult ?? 0) > 0 ? critRollResult : undefined}
                autoRoll={(critRollResult ?? 0) > 0}
                hidePrompt
                themeColors={dieColors(critDisplayFighter)}
                onRollStart={onCritRollStart}
                onRollEnd={onCritReplayEnd}
              />
            ) : (critRollResult ?? 0) > 0 ? (
              <DiceRoller
                key={`crit-replay-${critRollResult}`}
                className="bhud__dice-roller"
                lockedDie={4}
                fixedResult={critRollResult}
                autoRoll
                hidePrompt
                themeColors={dieColors(critDisplayFighter)}
                onRollEnd={onCritReplayEnd}
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

      {/* ── D4 KERAUNOS VOLTAGE CHAIN CHECK — after crit, before resolve bar ── */}
      {phase === PHASE.RESOLVING && resolveReady && critReady && !chainReady && chainEligible && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <div className="bhud__dice-modal" style={atkTheme}>
            <span className="bhud__dice-label">Keraunos Voltage</span>
            <span className="bhud__dice-sub">{attacker?.nicknameEng} — D4 (50%)</span>
            {isMyTurn ? (
              <DiceRoller
                key="chain-d4"
                className="bhud__dice-roller"
                lockedDie={4}
                fixedResult={(chainRollResult ?? 0) > 0 ? chainRollResult : undefined}
                autoRoll={(chainRollResult ?? 0) > 0}
                hidePrompt
                themeColors={dieColors(attacker)}
                onRollStart={onChainRollStart}
                onRollEnd={onChainReplayEnd}
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
                onRollEnd={onChainReplayEnd}
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
    </>
  );
}
