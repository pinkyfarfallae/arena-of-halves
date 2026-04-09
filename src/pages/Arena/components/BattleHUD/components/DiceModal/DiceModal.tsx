import type { FighterState, TurnState } from '../../../../../../types/battle';
import { DEITY_THEMES, DEFAULT_THEME } from '../../../../../../constants/theme';
import {
  PHASE,
  TURN_ACTION,
  effectivePomCoAttackerId,
  isPomegranateCoAttackDicePhase,
  isPomegranateCoDefendDicePhase,
  type PanelSide,
} from '../../../../../../constants/battle';
import { POWERS_DEFENDER_CANNOT_DEFEND } from '../../../../../../constants/powers';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import DiceRoller from '../../../../../../components/DiceRoller/DiceRoller';
import './DiceModal.scss';
import { Deity, DEITY } from '../../../../../../constants/deities';
import { getDiceSize } from '../../../../../../utils/getDiceSize';

/** Brief delay after attack animation ends before showing defender (smooth transition to next phase) */
const AFTER_ANIM_MS = 150;

/** When server already has defend roll (e.g. NPC), show "defender rolling" this long before animating NPC dice */
const NPC_DEFEND_ROLL_DELAY_MS = 1000;

/** Dice disruption of Zeus */
const ZEUS_DICE_DISRUPTION = 'Zeus Disruption: -2 (min 1)';
/** Dice empowerment of Poseidon */
const POSEIDON_DICE_STRENGTHEN = 'Poseidon Strength: min 6';
/** Dice Curse of Hypnos: D10 */
const HYPNOS_DICE_CURSE = 'Dice Curse of Hypnos: D10';
/** Dice Blessing of Tyche: D20 */
const TYCHE_DICE_BLESSING = 'Dice Blessing of Tyche: D20';

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
  /** RESOLVING only: hide defense replay while team shock applies (Nimbus delay) or LR shock on normal attack. */
  hideResolvingDefenseDiceForShockApply?: boolean;
  /** Original attack roll before Zeus/Poseidon buff modifications (used for dice animation) */
  originalAttackRollBeforeBuff?: number | null;
  /** Original defend roll before Zeus/Poseidon buff modifications (used for dice animation) */
  originalDefendRollBeforeBuff?: number | null;
  /** Original co-attack roll before Zeus/Poseidon buff modifications (used for dice animation) */
  originalCoAttackRollBeforeBuff?: number | null;
  /** Original co-defend roll before Zeus/Poseidon buff modifications (used for dice animation) */
  originalCoDefendRollBeforeBuff?: number | null;
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
  hideResolvingDefenseDiceForShockApply = false,
  originalAttackRollBeforeBuff = null,
  originalDefendRollBeforeBuff = null,
  originalCoAttackRollBeforeBuff = null,
  originalCoDefendRollBeforeBuff = null,
}: Props) {
  const { phase } = turn;
  const awaitingPom = !!(turn as { awaitingPomegranateCoAttack?: boolean }).awaitingPomegranateCoAttack;
  const pomCoExplicitDicePhase =
    phase === PHASE.ROLLING_POMEGRANATE_CO_ATTACK || phase === PHASE.ROLLING_POMEGRANATE_CO_DEFEND;
  const hasPomCoAttackRoll = turn.coAttackRoll != null && turn.coAttackRoll > 0;
  /** Co strike pipeline: defer flag and/or explicit dice phases and/or RESOLVING after both co D12s are on the wire. */
  const pomCoAtkIdForUi = effectivePomCoAttackerId(turn);
  const pomCoFlowActive =
    awaitingPom ||
    pomCoExplicitDicePhase ||
    (phase === PHASE.RESOLVING &&
      !!pomCoAtkIdForUi &&
      hasPomCoAttackRoll &&
      turn.coDefendRoll != null &&
      turn.coDefendRoll >= 1);
  const coAtkActive = !!coAttackCaster && (awaitingPom || pomCoExplicitDicePhase);
  const attackDiceHeaderLabel = coAtkActive ? 'Co-attack dice' : 'Attack Roll';
  const displayAttackFighter = coAtkActive ? coAttackCaster : attacker;
  const pomCoCritUi =
    pomCoFlowActive &&
    !!coAttackCaster &&
    hasPomCoAttackRoll &&
    turn.coDefendRoll != null &&
    turn.coDefendRoll >= 1;
  /** Co-defend replay for non-defenders: prefer atkRollDone, but if co atk is on the wire do not block on a missed replay (same turnKey as main kept viewerAttackReplayShownRef stuck). */
  const pomCoDefReplayAtkPrimed =
    atkRollDone || ((awaitingPom || pomCoExplicitDicePhase) && hasPomCoAttackRoll);
  const critDisplayFighter = pomCoCritUi ? (coAttackCaster ?? attacker) : attacker;
  const critModalTheme = themeStyle(critDisplayFighter);
  const critRollInteractive = pomCoCritUi ? !!isMyPomegranateCoAttack : !!isMyTurn;
  const displayAtkBuffMod = coAtkActive ? pomCoAtkBuffMod : atkBuffMod;
  const displayAtkTheme = themeStyle(displayAttackFighter);
  const atkTheme = themeStyle(attacker);
  const defTheme = themeStyle(defender);
  const dodgeAsDefender = isDefenderDodgeInteractive ?? isMyDefend;
  const showMyAttackInteractive =
    (phase === PHASE.ROLLING_ATTACK && isMyTurn && !awaitingPom) ||
    (isPomegranateCoAttackDicePhase(phase, awaitingPom) && !!isMyPomegranateCoAttack);

  // ── Stable display state: only advance forward, never revert (fixes jitter when phase/turn updates arrive out of order) ──
  const turnKeyRef = useRef<string>('');
  const latchedPhaseRef = useRef<string>(phase);
  const latchedAttackRollRef = useRef<number | null>(null);
  const latchedDefendRollRef = useRef<number | null>(null);
  const [showDefenderWaiting, setShowDefenderWaiting] = useState(false);
  const [showNpcDefendDice, setShowNpcDefendDice] = useState(false);
  const npcDefendDiceScheduledRef = useRef(false);
  const [showNpcPomCoDefendDice, setShowNpcPomCoDefendDice] = useState(false);
  const npcPomCoDefendDiceScheduledRef = useRef(false);
  /** Player replay: show result text as soon as die lands; parent delays atkRollDone/defRollDone so modal stays visible */
  const [atkReplayLanded, setAtkReplayLanded] = useState(false);
  const [defReplayLanded, setDefReplayLanded] = useState(false);

  const turnKey = `${turn.attackerId ?? ''}:${turn.defenderId ?? ''}`;
  const viewerAttackReplayShownRef = useRef(false);
  /** Pom co shares attackerId/defenderId with main hit — reset replay latch when co D12 lands so RESOLVING can replay co atk if ROLLING_DEFEND was skipped. */
  const pomCoAttackReplayLatchRef = useRef<number | null>(null);
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
    pomCoAttackReplayLatchRef.current = null;
  }
  if (!awaitingPom && !pomCoExplicitDicePhase) {
    pomCoAttackReplayLatchRef.current = null;
  } else {
    const cr = turn.coAttackRoll;
    if (cr != null && cr > 0 && pomCoAttackReplayLatchRef.current !== cr) {
      viewerAttackReplayShownRef.current = false;
      pomCoAttackReplayLatchRef.current = cr;
    }
  }
  const iAmCoAttacker = !!(isMyPomegranateCoAttack && pomCoFlowActive);
  if (
    (phase === PHASE.ROLLING_ATTACK ||
      phase === PHASE.ROLLING_POMEGRANATE_CO_ATTACK ||
      phase === PHASE.ROLLING_DEFEND ||
      phase === PHASE.ROLLING_POMEGRANATE_CO_DEFEND) &&
    (isMyTurn || embodyAttackerForAttackReplay || iAmCoAttacker)
  ) {
    wasRollingAttackAsMeRef.current = true;
  }
  if (
    ((phase === PHASE.ROLLING_DEFEND && !awaitingPom) || isPomegranateCoDefendDicePhase(phase, awaitingPom)) &&
    isMyDefend &&
    defendReady
  ) {
    wasRollingDefendAsMeRef.current = true;
  }
  useEffect(() => {
    setShowDefenderWaiting(false);
    setShowNpcDefendDice(false);
    npcDefendDiceScheduledRef.current = false;
    setShowNpcPomCoDefendDice(false);
    npcPomCoDefendDiceScheduledRef.current = false;
  }, [turnKey]);

  // Show NPC defend dice after the attack reveal has finished. Main defend can appear in ROLLING_DEFEND; co-defend can appear in ROLLING_POMEGRANATE_CO_DEFEND.
  const revealingNpcDefendDice =
    (phase === PHASE.ROLLING_DEFEND || phase === PHASE.RESOLVING) &&
    turn.defendRoll != null &&
    !isMyDefend &&
    !embodyDefenderForDefReplay &&
    !(turn as any).soulDevourerDrain &&
    !(turn.action === TURN_ACTION.POWER && !turn.attackRoll) &&
    !(pomCoFlowActive && turn.coDefendRoll != null) &&
    // Don't show main defend dice during main attack RESOLVING when awaiting Pomegranate co-attack
    !(awaitingPom && turn.coDefendRoll == null);
  const revealingNpcPomCoDefendDice =
    (phase === PHASE.RESOLVING || isPomegranateCoDefendDicePhase(phase, awaitingPom)) &&
    pomCoFlowActive &&
    turn.coDefendRoll != null &&
    turn.coDefendRoll >= 1 &&
    !isMyDefend &&
    !embodyDefenderForPomCoDefReplay &&
    !(turn as any).soulDevourerDrain &&
    !(turn.action === TURN_ACTION.POWER && !turn.attackRoll) &&
    !(awaitingPom && turn.coDefendRoll == null);
  const attackDoneOrPlayerRolled = atkRollDone || isMyTurn || iAmCoAttacker;
  const turnAction = turn.action;
  const turnAttackRoll = turn.attackRoll;
  const turnSoulDevourerDrain = (turn as { soulDevourerDrain?: boolean })?.soulDevourerDrain;
  useEffect(() => {
    if (!revealingNpcDefendDice) {
      if (!isViewer) {
        // Don't clear during transient frames (e.g. out-of-order updates) while still in RESOLVING as attacker watching NPC defend
        const holdNpcDefendDiceUi =
          (phase === PHASE.ROLLING_DEFEND || phase === PHASE.RESOLVING) &&
          !isMyDefend &&
          !embodyDefenderForDefReplay &&
          !turnSoulDevourerDrain &&
          !(turnAction === TURN_ACTION.POWER && !turnAttackRoll);
        if (!holdNpcDefendDiceUi) {
          setShowNpcDefendDice(false);
          npcDefendDiceScheduledRef.current = false;
        }
      }
      return;
    }
    if (isViewer) {
      setShowNpcDefendDice(true);
      return;
    }
    // Once we schedule showing NPC defend dice, don't reset the timer on re-renders
    if (npcDefendDiceScheduledRef.current) return;

    if (!attackDoneOrPlayerRolled) {
      // Schedule dice to show anyway after a longer delay if attack animation hasn't completed yet
      // This prevents stuck turns when NPC defense happens very quickly after attack
      npcDefendDiceScheduledRef.current = true;
      const t = window.setTimeout(() => setShowNpcDefendDice(true), NPC_DEFEND_ROLL_DELAY_MS + 1000);
      return () => clearTimeout(t);
    }
    npcDefendDiceScheduledRef.current = true;
    const t = window.setTimeout(() => setShowNpcDefendDice(true), NPC_DEFEND_ROLL_DELAY_MS);
    return () => clearTimeout(t);
  }, [revealingNpcDefendDice, attackDoneOrPlayerRolled, isViewer, phase, isMyDefend, turnAction, turnAttackRoll, turnSoulDevourerDrain, embodyDefenderForDefReplay, embodyDefenderForPomCoDefReplay]);
  useEffect(() => {
    if (!revealingNpcPomCoDefendDice) {
      if (!isViewer) {
        const holdNpcPomCoDefendDiceUi =
          (phase === PHASE.RESOLVING || isPomegranateCoDefendDicePhase(phase, awaitingPom)) &&
          pomCoFlowActive &&
          !isMyDefend &&
          !embodyDefenderForPomCoDefReplay &&
          !(turn as any).soulDevourerDrain &&
          !(turn.action === TURN_ACTION.POWER && !turn.attackRoll);
        if (!holdNpcPomCoDefendDiceUi) {
          setShowNpcPomCoDefendDice(false);
          npcPomCoDefendDiceScheduledRef.current = false;
        }
      }
      return;
    }
    if (isViewer) {
      setShowNpcPomCoDefendDice(true);
      return;
    }
    if (npcPomCoDefendDiceScheduledRef.current) return;
    if (!attackDoneOrPlayerRolled) {
      npcPomCoDefendDiceScheduledRef.current = true;
      const t = window.setTimeout(() => setShowNpcPomCoDefendDice(true), NPC_DEFEND_ROLL_DELAY_MS + 1000);
      return () => clearTimeout(t);
    }
    npcPomCoDefendDiceScheduledRef.current = true;
    const t = window.setTimeout(() => setShowNpcPomCoDefendDice(true), NPC_DEFEND_ROLL_DELAY_MS);
    return () => clearTimeout(t);
  }, [revealingNpcPomCoDefendDice, attackDoneOrPlayerRolled, isViewer, phase, isMyDefend, pomCoFlowActive, turnAction, turnAttackRoll, turnSoulDevourerDrain, embodyDefenderForPomCoDefReplay, awaitingPom]);

  // Latch phase/rolls forward only
  if (phase === PHASE.ROLLING_ATTACK || phase === PHASE.ROLLING_POMEGRANATE_CO_ATTACK) {
    latchedPhaseRef.current = phase;
    latchedAttackRollRef.current = null;
    latchedDefendRollRef.current = null;
  }
  if (phase === PHASE.ROLLING_DEFEND || phase === PHASE.ROLLING_POMEGRANATE_CO_DEFEND) {
    latchedPhaseRef.current = phase;
    if (hasPomCoAttackRoll && (awaitingPom || pomCoExplicitDicePhase)) {
      latchedAttackRollRef.current = turn.coAttackRoll ?? null;
    } else if (turn.attackRoll != null) {
      latchedAttackRollRef.current = turn.attackRoll;
    }
  }
  if (phase === PHASE.RESOLVING) {
    latchedPhaseRef.current = PHASE.RESOLVING;
    if (turn.defendRoll != null) latchedDefendRollRef.current = turn.defendRoll;
    if (hasPomCoAttackRoll && pomCoFlowActive) {
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
  // Pomegranate co: turn.attackerId is still the oath wielder but the co D12 is rolled by coAttackerId — main attacker must still see atk-side replay so atkRollDone runs and defender co-defend + viewer echo can show.
  /** Co caster is not `isMyTurn` (turn.attackerId is spirit bearer) — exclude them from "opponent replay" so they get interactive co-atk dice, not spectator replay. */
  const watchOpponentAttackReplay =
    pomCoFlowActive && isMyPomegranateCoAttack
      ? false
      : !isMyTurn || (pomCoFlowActive && isMyTurn && !isMyPomegranateCoAttack);
  // Never replay attack after defender: use ref so we don't show attack from RESOLVING when we already showed it in ROLLING_DEFEND (atkRollDone resets on phase change).
  const serverSkippedToResolving =
    phase === PHASE.RESOLVING && turn.attackRoll != null && turn.defendRoll != null && !(turn as any).soulDevourerDrain && !(turn.action === TURN_ACTION.POWER && !turn.attackRoll);
  const fromRollingDefend =
    (latchedPhase === PHASE.ROLLING_DEFEND || latchedPhase === PHASE.ROLLING_POMEGRANATE_CO_DEFEND) &&
    latchedAttackRoll != null &&
    watchOpponentAttackReplay;
  // Only show RESOLVING attack replay if we never showed in ROLLING_DEFEND AND we haven't already shown in RESOLVING
  const fromResolvingSkip =
    serverSkippedToResolving && !atkRollDone && watchOpponentAttackReplay && latchedAttackRoll != null && !viewerAttackReplayShownRef.current;
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
  const showAttackWait =
    latchedPhase === PHASE.ROLLING_ATTACK ||
    latchedPhase === PHASE.ROLLING_POMEGRANATE_CO_ATTACK ||
    ((latchedPhase === PHASE.ROLLING_DEFEND || latchedPhase === PHASE.ROLLING_POMEGRANATE_CO_DEFEND) &&
      latchedAttackRoll == null);
  // After I (attacker) clicked: phase is already defend rolling but keep showing my attack dice until atkRollDone (play-all: embody when myId tracks defender)
  const showMyAttackReplay =
    (phase === PHASE.ROLLING_DEFEND || phase === PHASE.ROLLING_POMEGRANATE_CO_DEFEND) &&
    !atkRollDone &&
    (isMyTurn || embodyAttackerForAttackReplay || iAmCoAttacker);
  const hasAttackResultForMyReplay =
    (!awaitingPom && turn.attackRoll != null) ||
    (pomCoFlowActive && hasPomCoAttackRoll) ||
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
    (pomCoFlowActive && turn.coDefendRoll != null) ||
    preRolledDefend != null ||
    (isMyDefend && wasRollingDefendAsMeRef.current);
  const defendReplayEmbody = isMyDefend || embodyDefenderForDefReplay || embodyDefenderForPomCoDefReplay;
  const showMyDefendReplay =
    phase === PHASE.RESOLVING && !defRollDone && defendReplayEmbody && hasDefendResultForReplay &&
    // Don't show main defend replay during main attack RESOLVING when awaiting Pomegranate co-attack
    !(awaitingPom && turn.coDefendRoll == null);

  /** Pomegranate co-defend: same defender as main strike; separate from main defendRoll — fixedResult for defender (incl. embody). */
  const showPomCoMyDefDice =
    pomCoFlowActive &&
    (isMyDefend || embodyDefenderForPomCoDefReplay) &&
    (isPomegranateCoDefendDicePhase(phase, awaitingPom) || phase === PHASE.RESOLVING);
  const pomCoDefenderDieResult =
    showPomCoMyDefDice ? (turn.coDefendRoll ?? preRolledDefend ?? undefined) : undefined;
  const pomCoDefendSubmitLocked =
    pomCoFlowActive && turn.coDefendRoll != null && turn.coDefendRoll >= 1;
  const mainDefendSubmitLocked =
    !pomCoFlowActive && showMyDefendReplay && (turn.defendRoll != null || preRolledDefend != null);
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
    pomCoFlowActive && hasPomCoAttackRoll && latchedAttackRoll === turn.coAttackRoll
      ? coAttackCaster ?? displayAttackFighter
      : displayAttackFighter;
  const replayAttackTheme = themeStyle(replayAttackFighter);
  const replayAtkBuffMod =
    pomCoFlowActive && hasPomCoAttackRoll && latchedAttackRoll === turn.coAttackRoll ? pomCoAtkBuffMod : displayAtkBuffMod;

  // Use original roll before Zeus/Poseidon buff for dice animation if available
  const attackerHasZeusOrPoseidon = displayAttackFighter?.wishOfIris === DEITY.ZEUS || displayAttackFighter?.wishOfIris === DEITY.POSEIDON;

  const rolledAttackValue = pomCoFlowActive
    ? (attackerHasZeusOrPoseidon && originalCoAttackRollBeforeBuff ? originalCoAttackRollBeforeBuff : (turn.coAttackRoll ?? preRolledAttack))
    : (attackerHasZeusOrPoseidon && originalAttackRollBeforeBuff ? originalAttackRollBeforeBuff : (turn.attackRoll ?? preRolledAttack));
  const attackReplayDeity =
    isMyAttackReplaySegment &&
      (displayAttackFighter?.wishOfIris === DEITY.ZEUS || displayAttackFighter?.wishOfIris === DEITY.POSEIDON)
      ? displayAttackFighter.wishOfIris
      : null;
  const attackReplayValue = rolledAttackValue ?? preRolledAttack ?? 0;
  const getWishAdjustedRollValue = (value: number, deity: Deity | null | undefined) => {
    if (deity === DEITY.ZEUS) return Math.max(1, value - 2);
    if (deity === DEITY.POSEIDON) return Math.max(6, value);
    return value;
  };
  const getWishOriginalReplayRoll = (
    roll: number | null | undefined,
    originalRollBeforeBuff: number | null | undefined,
    deity: Deity | null | undefined,
  ) => ((deity === DEITY.ZEUS || deity === DEITY.POSEIDON) && originalRollBeforeBuff != null
    ? originalRollBeforeBuff
    : (roll ?? undefined));
  const attackReplayAdjustedValue = getWishAdjustedRollValue(attackReplayValue, displayAttackFighter?.wishOfIris);
  const defendReplayBaseValue = (originalDefendRollBeforeBuff ?? (pomCoFlowActive ? turn.coDefendRoll : turn.defendRoll)) ?? 0;
  const defendReplayAdjustedValue = getWishAdjustedRollValue(defendReplayBaseValue, defender?.wishOfIris);
  const resolvingDefendAdjustedValue = getWishAdjustedRollValue(turn.defendRoll ?? 0, defender?.wishOfIris);
  const coDefendBaseValue = (originalCoDefendRollBeforeBuff ?? turn.coDefendRoll) ?? 0;
  const coDefendAdjustedValue = getWishAdjustedRollValue(coDefendBaseValue, defender?.wishOfIris);
  const renderWishDeityNode = (deity: Deity | null | undefined) => {
    if (deity !== DEITY.ZEUS && deity !== DEITY.POSEIDON) return null;
    return (
      <>
        <span
          style={{
            color: deity === DEITY.ZEUS ? '#ddb400' : '#0077be',
          }}
        >
          <b>{deity}</b>
        </span>
        {' '}
        →
        {' '}
      </>
    );
  };
  const attackReplayDeityNode = renderWishDeityNode(attackReplayDeity);
  const defendReplayDeityNode = renderWishDeityNode(defender?.wishOfIris);
  const renderDiceBonusNode = ({
    rolling,
    diceUp,
    buffMod,
    adjustedValue,
    deityNode,
  }: {
    rolling: boolean;
    diceUp: number;
    buffMod: number;
    adjustedValue: number;
    deityNode?: ReactNode;
  }) => {
    if (rolling) return 'rolling...';
    const bonus = diceUp + buffMod;
    if (bonus > 0) {
      return (
        <>
          {deityNode}
          +{bonus} →
          {' '}
          {adjustedValue + bonus}
        </>
      );
    }
    return (
      <>
        {deityNode}
        {' '}
        {adjustedValue}
      </>
    );
  };
  const attackReplayBonusNode = renderDiceBonusNode({
    rolling: isMyAttackReplaySegment && !(atkRollDone || atkReplayLanded),
    diceUp: displayAttackFighter?.attackDiceUp ?? 0,
    buffMod: displayAtkBuffMod,
    adjustedValue: attackReplayAdjustedValue,
    deityNode: attackReplayDeityNode,
  });
  const replayAttackDeityNode = renderWishDeityNode(replayAttackFighter?.wishOfIris);
  const replayAttackBonusNode = renderDiceBonusNode({
    rolling: !atkRollDone,
    diceUp: replayAttackFighter?.attackDiceUp ?? 0,
    buffMod: replayAtkBuffMod,
    adjustedValue: latchedAttackRoll ?? 0,
    deityNode: replayAttackDeityNode,
  });
  const defendReplayBonusNode = renderDiceBonusNode({
    rolling: showMyDefendReplay && !(defRollDone || defReplayLanded),
    diceUp: defender?.defendDiceUp ?? 0,
    buffMod: defBuffMod,
    adjustedValue: defendReplayAdjustedValue,
    deityNode: defendReplayDeityNode,
  });
  const resolvingDefendBonusNode = renderDiceBonusNode({
    rolling: !defRollDone,
    diceUp: defender?.defendDiceUp ?? 0,
    buffMod: defBuffMod,
    adjustedValue: resolvingDefendAdjustedValue,
    deityNode: defendReplayDeityNode,
  });
  const coDefendBonusNode = renderDiceBonusNode({
    rolling: !defRollDone,
    diceUp: defender?.defendDiceUp ?? 0,
    buffMod: defBuffMod,
    adjustedValue: coDefendAdjustedValue,
    deityNode: defendReplayDeityNode,
  });

  const wishedEffectedOnDiceLabels = (deity: Deity | null | undefined) => {
    switch (deity) {
      case DEITY.ZEUS:
        return ZEUS_DICE_DISRUPTION;
      case DEITY.POSEIDON:
        return POSEIDON_DICE_STRENGTHEN;
      case DEITY.HYPNOS:
        return HYPNOS_DICE_CURSE;
      case DEITY.TYCHE:
        return TYCHE_DICE_BLESSING;
      default:
        return null;
    }
  };

  const isSubWithDeity = (deity: Deity | null | undefined) => (
    deity === DEITY.HYPNOS ||
    deity === DEITY.TYCHE ||
    deity === DEITY.ZEUS ||
    deity === DEITY.POSEIDON
  );

  return (
    <>
      {/* ── ROLLING ATTACK ── */}
      {/* My attack: one block so DiceRoller never remounts; through ROLLING_DEFEND or straight to RESOLVING (fast NPC) until atkRollDone */}
      {((showMyAttackInteractive) || isMyAttackReplaySegment) && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <div className="bhud__dice-modal" style={displayAtkTheme}>
            <span className="bhud__dice-label">{attackDiceHeaderLabel}</span>
            <span className={`bhud__dice-sub ${isSubWithDeity(displayAttackFighter?.wishOfIris) ? 'bhud__dice-sub--deity' : ''}`}>
              {isMyAttackReplaySegment
                ? displayAttackFighter?.nicknameEng
                : `${displayAttackFighter?.nicknameEng} → ${defender?.nicknameEng}`}
              {wishedEffectedOnDiceLabels(displayAttackFighter?.wishOfIris) && (
                <span className={`bhud__dice-sub--${displayAttackFighter?.wishOfIris?.toLowerCase()}`}>
                  {wishedEffectedOnDiceLabels(displayAttackFighter?.wishOfIris)}
                </span>
              )}
            </span>
            <DiceRoller
              key="atk-my-roll"
              className="bhud__dice-roller"
              lockedDie={getDiceSize(displayAttackFighter?.wishOfIris)}
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
              {isMyAttackReplaySegment ? attackReplayBonusNode : `dice up: ${(displayAttackFighter?.attackDiceUp ?? 0) + displayAtkBuffMod}`}
            </span>
          </div>
        </div>
      )}
      {/* Opponent's attack — waiting spinner (stable: show until we have attack roll, no revert) */}
      {showAttackWait && !showMyAttackInteractive && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <div
            className="bhud__dice-modal"
            style={coAtkActive && isPomegranateCoAttackDicePhase(phase, awaitingPom) ? displayAtkTheme : atkTheme}
          >
            <span className="bhud__dice-label">{attackDiceHeaderLabel}</span>
            <span className="bhud__dice-sub">
              {coAtkActive && isPomegranateCoAttackDicePhase(phase, awaitingPom) && displayAttackFighter
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
            <span className={`bhud__dice-sub ${isSubWithDeity(replayAttackFighter?.wishOfIris) ? 'bhud__dice-sub--deity' : ''}`}>
              {replayAttackFighter?.nicknameEng}
              {wishedEffectedOnDiceLabels(replayAttackFighter?.wishOfIris) && (
                <span className={`bhud__dice-sub--${replayAttackFighter?.wishOfIris?.toLowerCase()}`}>
                  {wishedEffectedOnDiceLabels(replayAttackFighter?.wishOfIris)}
                </span>
              )}
            </span>
            <DiceRoller
              key="atk-defend-phase"
              className="bhud__dice-roller"
              lockedDie={getDiceSize(replayAttackFighter?.wishOfIris)}
              fixedResult={
                getWishOriginalReplayRoll(
                  latchedAttackRoll,
                  pomCoFlowActive ? originalCoAttackRollBeforeBuff : originalAttackRollBeforeBuff,
                  replayAttackFighter?.wishOfIris,
                )
              }
              accentColor={replayAttackFighter?.theme[9]}
              themeColors={dieColors(replayAttackFighter)}
              autoRoll
              hidePrompt
              onRollEnd={onAtkRollDone}
            />
            <span className="bhud__dice-bonus">
              {replayAttackBonusNode}
            </span>
          </div>
        </div>
      )}
      {/* My defend: one block so DiceRoller never remounts; show from ROLLING_DEFEND until defRollDone after submit. Hide when power does not allow defend (e.g. Keraunos) or Soul Devourer drain (no defense roll). */}
      {(
        (((phase === PHASE.ROLLING_DEFEND && !awaitingPom) || isPomegranateCoDefendDicePhase(phase, awaitingPom)) &&
          isMyDefend &&
          defendReady) ||
        showMyDefendReplay
      ) &&
        !((isMyDefend || embodyDefenderForDefReplay) && defenderCannotDefend) &&
        !(turn as any).soulDevourerDrain &&
        (
          <div className={`bhud__dice-zone bhud__dice-zone--${defSide}`}>
            <div className="bhud__dice-modal" style={defTheme}>
              <span className="bhud__dice-label">{pomCoFlowActive ? 'Co-attack defense' : 'Defense Roll'}</span>
              <span className={`bhud__dice-sub ${isSubWithDeity(defender?.wishOfIris) ? 'bhud__dice-sub--deity' : ''}`}>
                {showMyDefendReplay
                  ? defender?.nicknameEng
                  : `Defending against ${(pomCoFlowActive ? displayAttackFighter?.nicknameEng : attacker?.nicknameEng) ?? ''}`}
                {wishedEffectedOnDiceLabels(defender?.wishOfIris) && (
                  <span className={`bhud__dice-sub--${defender?.wishOfIris?.toLowerCase()}`}>
                    {wishedEffectedOnDiceLabels(defender?.wishOfIris)}
                  </span>
                )}
              </span>
              <DiceRoller
                key="def-my-roll"
                className="bhud__dice-roller"
                lockedDie={getDiceSize(defender?.wishOfIris)}
                fixedResult={
                  pomCoDefenderDieResult ??
                  (!pomCoFlowActive && showMyDefendReplay
                    ? getWishOriginalReplayRoll(
                      preRolledDefend ?? turn.defendRoll,
                      originalDefendRollBeforeBuff,
                      defender?.wishOfIris,
                    )
                    : !pomCoFlowActive
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
                {showMyDefendReplay ? defendReplayBonusNode : `dice up: ${(defender?.defendDiceUp ?? 0) + defBuffMod}`}
              </span>
            </div>
          </div>
        )}
      {/* Opponent's defend — waiting: only after attack animation has ended (atkRollDone). Hide when power does not allow defend or Soul Devourer drain. */}
      {(latchedPhase === PHASE.ROLLING_DEFEND || latchedPhase === PHASE.ROLLING_POMEGRANATE_CO_DEFEND) &&
        !isMyDefend &&
        latchedAttackRoll != null &&
        showDefenderWaiting &&
        !defenderCannotDefend &&
        !(turn as any).soulDevourerDrain &&
        (
          <div className={`bhud__dice-zone bhud__dice-zone--${defSide}`}>
            <div className="bhud__dice-modal" style={defTheme}>
              <span className="bhud__dice-label">
                {latchedPhase === PHASE.ROLLING_POMEGRANATE_CO_DEFEND ? 'Co-attack defense' : 'Defense Roll'}
              </span>
              <span className="bhud__dice-sub">{defender?.nicknameEng}</span>
              <div className="bhud__dice-roller bhud__dice-roller--waiting">
                {latchedPhase === PHASE.ROLLING_POMEGRANATE_CO_DEFEND &&
                turn.coDefendRoll != null &&
                turn.coDefendRoll >= 1 &&
                (showNpcPomCoDefendDice || isViewer) ? (
                  <DiceRoller
                    key="pom-co-def-roll"
                    className="bhud__dice-roller"
                    lockedDie={getDiceSize(defender?.wishOfIris)}
                    fixedResult={
                      getWishOriginalReplayRoll(turn.coDefendRoll, originalCoDefendRollBeforeBuff, defender?.wishOfIris)
                    }
                    accentColor={defender?.theme[9]}
                    themeColors={dieColors(defender)}
                    autoRoll
                    hidePrompt
                    onRollEnd={onDefRollDone}
                  />
                ) : latchedPhase === PHASE.ROLLING_DEFEND &&
                  turn.defendRoll != null &&
                  turn.defendRoll >= 1 &&
                  (showNpcDefendDice || isViewer) ? (
                  <DiceRoller
                    key="def-roll"
                    className="bhud__dice-roller"
                    lockedDie={getDiceSize(defender?.wishOfIris)}
                    fixedResult={
                      getWishOriginalReplayRoll(turn.defendRoll, originalDefendRollBeforeBuff, defender?.wishOfIris)
                    }
                    accentColor={defender?.theme[9]}
                    themeColors={dieColors(defender)}
                    autoRoll
                    hidePrompt
                    onRollEnd={onDefRollDone}
                  />
                ) : (
                  <div className="bhud__roll-waiting-spinner" />
                )}
              </div>
            </div>
          </div>
        )}

      {/* ── RESOLVING — defender dice (attacker / viewer path). Play-all host already rolled defense in def-my-roll / embody — hide this auto-roll echo (same idea as playbackHostHideEchoAttackReplay). Only show for the actual defender, not during shock application to other team members. ── */}
      {phase === PHASE.RESOLVING && !hideResolvingDefenseDiceForShockApply && (atkRollDone || isMyTurn || (isViewer && turn.defendRoll != null)) && !(turn as any).soulDevourerDrain && !(turn.action === TURN_ACTION.POWER && !turn.attackRoll) && !defenderCannotDefend && !skeletonHitActive && turn.defendRoll != null && !(defRollDone && resolveReady) && !isMyDefend && !embodyDefenderForDefReplay && !playbackHostHideEchoAttackReplay && !(pomCoFlowActive && turn.coDefendRoll != null) && !(awaitingPom && turn.coDefendRoll == null) && defender?.characterId === turn.defenderId && (
        <div className={`bhud__dice-zone bhud__dice-zone--${defSide}`}>
          <div className="bhud__dice-modal" style={defTheme}>
            <span className="bhud__dice-label">Defense Roll</span>
            <span className={`bhud__dice-sub ${isSubWithDeity(defender?.wishOfIris) ? 'bhud__dice-sub--deity' : ''}`}>
              {defender?.nicknameEng}
              {wishedEffectedOnDiceLabels(defender?.wishOfIris) && (
                <span className={`bhud__dice-sub--${defender?.wishOfIris?.toLowerCase()}`}>
                  {wishedEffectedOnDiceLabels(defender?.wishOfIris)}
                </span>
              )}
            </span>
            {(showNpcDefendDice || isViewer) ? (
              <>
                <DiceRoller
                  key="def-resolve-phase"
                  className="bhud__dice-roller"
                  lockedDie={getDiceSize(defender?.wishOfIris)}
                  fixedResult={
                    getWishOriginalReplayRoll(turn.defendRoll, originalDefendRollBeforeBuff, defender?.wishOfIris)
                  }
                  accentColor={defender?.theme[9]}
                  themeColors={dieColors(defender)}
                  autoRoll
                  hidePrompt
                  onRollEnd={onDefRollDone}
                />
                <span className="bhud__dice-bonus">
                  {resolvingDefendBonusNode}
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

      {/* RESOLVING — co defend replay for everyone except the defender (they use def-my-roll above) and play-all embody. Oath holder / co-attacker / viewer all see D12 before dodge+crit. */}
      {phase === PHASE.RESOLVING &&
        !hideResolvingDefenseDiceForShockApply &&
        !skeletonHitActive &&
        pomCoFlowActive &&
        turn.coDefendRoll != null &&
        turn.coDefendRoll >= 1 &&
        !defRollDone &&
        !isMyDefend &&
        !embodyDefenderForDefReplay &&
        !embodyDefenderForPomCoDefReplay &&
        pomCoDefReplayAtkPrimed &&
        defender && (
          <div className={`bhud__dice-zone bhud__dice-zone--${defSide}`}>
            <div className="bhud__dice-modal" style={defTheme}>
              <span className="bhud__dice-label">Co-attack defense</span>
              <span className={`bhud__dice-sub ${isSubWithDeity(defender?.wishOfIris) ? 'bhud__dice-sub--deity' : ''}`}>
                {defender.nicknameEng}
                {wishedEffectedOnDiceLabels(defender?.wishOfIris) && (
                  <span className={`bhud__dice-sub--${defender?.wishOfIris?.toLowerCase()}`}>
                    {wishedEffectedOnDiceLabels(defender?.wishOfIris)}
                  </span>
                )}
              </span>
              {(showNpcPomCoDefendDice || isViewer) ? (
                <>
                  <DiceRoller
                    key="pom-co-def-opp"
                    className="bhud__dice-roller"
                    lockedDie={getDiceSize(defender.wishOfIris)}
                    fixedResult={
                      getWishOriginalReplayRoll(turn.coDefendRoll, originalCoDefendRollBeforeBuff, defender?.wishOfIris)
                    }
                    accentColor={defender?.theme[9]}
                    themeColors={dieColors(defender)}
                    autoRoll
                    hidePrompt
                    onRollEnd={onDefRollDone}
                  />
                  <span className="bhud__dice-bonus">
                    {coDefendBonusNode}
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
