import { useRef, useCallback, useEffect, useLayoutEffect, useReducer, useState } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../../../../firebase';
import type { BattleLogEntry, BattleState, FighterState } from '../../../../types/battle';
import { buildBattlePlaybackEventKey } from '../../../../types/battle';
import { checkCritical, getWinningFaces, advanceAfterShadowCamouflageD4, advanceAfterFloralHealD4, advanceAfterSpringHealD4, advanceAfterDisorientedD4, ackAttackDiceShown, ackDefendDiceShown, effectiveKeraunosStep } from '../../../../services/battleRoom';
import { getStatModifier } from '../../../../services/powerEngine';
import type { SeasonKey } from '../../../../data/seasons';
import WinBadge from './icons/Winner';
import LoseBadge from './icons/Loser';
import TargetSelectModal from './components/TargetSelectModal/TargetSelectModal';
import ActionSelectModal from './components/ActionSelectModal/ActionSelectModal';
import SeasonSelectModal from './components/SeasonSelectModal/SeasonSelectModal';
import PoemSelectModal from './components/PoemSelectModal/PoemSelectModal';
import DiceModal from './components/DiceModal/DiceModal';
import DiceRoller from '../../../../components/DiceRoller/DiceRoller';
import RefillSPDiceModal, { REFILL_DICE_VIEW_MS, REFILL_CARD_VIEW_MS } from './components/RefillSPDiceModal/RefillSPDiceModal';
import DamageCard from './components/DamageCard/DamageCard';
import './BattleHUD.scss';
import ResurrectingModal from './components/ResurrectingModal/ResurrectingModal';
import { DEFAULT_THEME } from '../../../../constants/theme';
import { EFFECT_TAGS, IMPRECATED_POEM_VERSE_TAGS, isSeasonTag, SEASON_TAG_PREFIX } from '../../../../constants/effectTags';
import { getPowers } from '../../../../data/powers';
import { getDisabledPowersAndReasons } from '../../../../data/power-disable-reason';
import { POWER_NAMES, POWER_TYPES } from '../../../../constants/powers';
import { ARENA_PATH, BATTLE_TEAM, PHASE, getPhaseLabel, PANEL_SIDE, TURN_ACTION, type PanelSide, TurnAction } from '../../../../constants/battle';
import { TARGET_TYPES, MOD_STAT } from '../../../../constants/effectTypes';
import { SKILL_UNLOCK } from '../../../../constants/character';

/** Keep element rendered during a fade-out exit animation. useLayoutEffect avoids a visible frame where show is still false while visible became true (resolve bar / damage zone flash). */
function useFadeTransition(visible: boolean, ms = 250) {
  const [show, setShow] = useState(false);
  const [exit, setExit] = useState(false);
  const showRef = useRef(false);

  useLayoutEffect(() => {
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

/** Resolve bar + DamageCard payload (main hit or Pomegranate co-attack log line). */
type ResolveCacheRow = {
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
  [key: string]: unknown;
};

interface Props {
  arenaId?: string;
  battle: BattleState;
  teamA: FighterState[];
  teamB: FighterState[];
  teamMinionsA?: any[];
  teamMinionsB?: any[];
  myId: string | undefined;
  isPlaybackDriver?: boolean;
  transientEffectsActive?: boolean;
  onSelectTarget: (defenderId: string) => void;
  /** Keraunos Voltage: confirm two 2-damage targets at once when ≥3 enemies. */
  onSelectKeraunosTier2Batch?: (defenderIds: string[]) => void;
  onSelectAction: (action: TurnAction, powerName?: string, allyTargetId?: string) => void;
  onSelectSeason: (season: SeasonKey) => void;
  onPreviewSeason?: (season: SeasonKey | null) => void;
  onCancelSeason?: () => void;
  onSelectPoem?: (poemTag: string) => void;
  onCancelPoem?: () => void;
  onCancelTarget?: () => void;
  initialShowPowers?: boolean;
  onSubmitAttackRoll: (roll: number) => void;
  onSubmitDefendRoll: (roll: number) => void;
  /** Volley Arrow Rapid Fire: caster rolls D4 for each extra shot (75% → 50% → 25% → ...). */
  onSubmitRapidFireD4Roll?: (roll: number) => void;
  /** After showing damage for one Rapid Fire extra shot, call to advance to next D4 roll. */
  onRapidFireDamageCardComplete?: () => void;
  onResolve: () => void;
  onResolveVisible?: (visible: boolean) => void;
  /** When true (spectator/viewer), skip dice animation sequencing — show rolls simply to avoid messy inspect mode */
  isViewer?: boolean;
  /** When true (PvE), attacker is NPC; this client simulates D4 crit/chain. When false (PvP), wait for opponent's roll. */
  isAttackerNpc?: boolean;
  /** When true (PvE), defender is NPC; this client simulates dodge D4. When false (PvP), wait for opponent's roll. */
  isDefenderNpc?: boolean;
  /** Dev: host plays every fighter — Pomegranate dodge D4 must be interactive even when HUD myId follows the attacker during replay. */
  devPlayAllFightersSelf?: boolean;
  /** Dev: HUD myId follows attacker in RESOLVING — defender replay needs separate “embody defender” (see DiceModal). */
  devUiActAsAttacker?: boolean;
  onTransientEffectsActive?: (active: boolean) => void;
  /** Called true 2.5s after entering RESOLVING with Soul Devourer drain so heal shows after master damage card */
  onSoulDevourerHealReady?: (ready: boolean) => void;
  /** Skeleton card + hit in one update (from Arena) so card and VFX start together */
  transientSkeletonCard?: Record<string, unknown> | null;
  transientSkeletonCardKey?: string;
  onSkeletonCardShow?: (payload: { cardData: Record<string, unknown>; key: string; hitTargetId: string }) => void;
  onSkeletonCardClear?: () => void;
  onSkeletonCardTarget?: (hitTargetId: string | null) => void;
  onMinionHitPulse?: (attackerId: string, defenderId: string) => void;
  /** Power name just confirmed in action modal (e.g. "Soul Devourer") — used to disable Back on target select when needed */
  confirmedPowerName?: string | null;
  /** When in SELECT_TARGET with no valid target (e.g. all under Shadow Camouflage), call to skip turn */
  onSkipTurnNoTarget?: () => void;
  /** When in SELECT_TARGET and attacker has Disoriented (NPC auto path), let server pick random target and run 25% check. */
  onSelectTargetDisoriented?: () => void;
  /** Only way to advance when Disoriented + player's turn: called when player clicks Confirm in Disoriented modal. Passed only to attacker's client. */
  onConfirmDisorientedTarget?: (defenderId: string) => void;
  /** When Floral Fragrance heal was skipped (e.g. target has Healing Nullified), caster clicks Roger → call this to advance */
  onHealSkippedAck?: () => void;
  /** When Soul Devourer heal was skipped (e.g. caster has Healing Nullified), caster clicks Roger → clear ack flag so skeleton resolve can start */
  onSoulDevourerHealSkippedAck?: () => void;
  /** When Spring heal was skipped (e.g. caster has Healing Nullified), caster clicks Roger → advance to D4 roll for heal2 */
  onSpringHealSkippedAck?: () => void;
  /** Called when Floral Heal D4 result card (Normal Heal / Heal x2) is shown — so healing VFX can sync */
  onFloralHealResultCardVisible?: () => void;
  /** Called when Floral Heal advance is about to run — hide result card + fragrance wave immediately (don't wait for phase update) */
  onFloralHealResultCardHidden?: () => void;
  /** When target modal is used to pick an ally (e.g. Floral Fragrance, Apollo's Hymn), call with selected ally id instead of onSelectTarget. */
  onSelectAllyTarget?: (allyId: string) => void;
  /** True while Volley Arrow hit VFX is active. When false, Rapid Fire extra-shot damage card is hidden. */
  volleyArrowHitActive?: boolean;
  /** PvE: oath caster is NPC — auto-roll co-attack D12 in ROLLING_ATTACK while awaitingPomegranateCoAttack. */
  isPomCoCasterNpc?: boolean;
  /** After main hit card when server deferred Pomegranate co — enter co attack phase. */
  onAdvancePomegranateCoAttackPhase?: () => void;
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
  arenaId, 
  battle, 
  teamA, 
  teamB, 
  teamMinionsA, 
  teamMinionsB, 
  myId, 
  isPlaybackDriver = false, 
  isViewer = false, 
  isAttackerNpc = false, 
  isDefenderNpc = false, 
  devPlayAllFightersSelf = false, 
  devUiActAsAttacker = false, 
  transientEffectsActive,
  onSelectTarget,
  onSelectKeraunosTier2Batch,
  onSelectAction, 
  onSelectSeason, 
  onPreviewSeason, 
  onCancelSeason, 
  onSelectPoem, 
  onCancelPoem, 
  onCancelTarget, 
  initialShowPowers, 
  onSubmitAttackRoll, 
  onSubmitDefendRoll, 
  onSubmitRapidFireD4Roll, 
  onRapidFireDamageCardComplete, 
  onResolve, 
  onResolveVisible, 
  onTransientEffectsActive, 
  onSoulDevourerHealReady,
  transientSkeletonCard, 
  transientSkeletonCardKey, 
  onSkeletonCardShow, 
  onSkeletonCardClear, 
  onSkeletonCardTarget, 
  onMinionHitPulse,
  confirmedPowerName, 
  onSkipTurnNoTarget, 
  onSelectTargetDisoriented,
  onConfirmDisorientedTarget, 
  onSelectAllyTarget, 
  onHealSkippedAck, 
  onSoulDevourerHealSkippedAck, 
  onSpringHealSkippedAck, 
  onFloralHealResultCardVisible, 
  onFloralHealResultCardHidden,
  volleyArrowHitActive,
  isPomCoCasterNpc = false,
  onAdvancePomegranateCoAttackPhase,
}: Props) {
  const { turn, roundNumber, log = [], winner } = battle;

  const attacker = turn ? find(teamA, teamB, turn.attackerId) : undefined;
  // Keep canonical defender for HUD: even if a minion visually intercepted, the HUD should
  // still show the master as the defending target during resolving.
  const defender = turn?.defenderId ? find(teamA, teamB, turn.defenderId) : undefined;
  const isMyTurn = turn && turn.attackerId === myId;
  const isMyDefend = turn?.defenderId === myId;
  const opposingTeam = turn?.attackerTeam === BATTLE_TEAM.A ? teamB : teamA;

  /** When true, hide Back on target select modal (e.g. Soul Devourer must pick target; Beyond the Nimbus has no back; Floral Fragrance follow-up after heal must pick enemy). */
  const backDisabled = (confirmedPowerName === POWER_NAMES.SOUL_DEVOURER || turn?.usedPowerName === POWER_NAMES.SOUL_DEVOURER || confirmedPowerName === POWER_NAMES.BEYOND_THE_NIMBUS || turn?.usedPowerName === POWER_NAMES.BEYOND_THE_NIMBUS || (turn?.usedPowerName === POWER_NAMES.FLORAL_FRAGRANCE && !!turn?.allyTargetId)) ?? false;

  // Filter targets based on power requirements (e.g., Jolt Arc needs 'shock')
  const targets = (() => {
    // Death Keeper: show dead teammates instead of alive enemies
    if (turn?.usedPowerIndex != null && attacker) {
      const power = attacker.powers[turn.usedPowerIndex];
      if (power?.name === POWER_NAMES.DEATH_KEEPER) {
        const myTeam = turn.attackerTeam === BATTLE_TEAM.A ? teamA : teamB;
        return (myTeam ?? []).filter((f) => f.currentHp <= 0);
      }
      // Ally-heal (Floral Fragrance, Apollo's Hymn, etc.): show alive teammates so target modal is used
      if (power?.target === TARGET_TYPES.ALLY && !turn?.allyTargetId) {
        const myTeam = turn.attackerTeam === BATTLE_TEAM.A ? teamA : teamB;
        return (myTeam ?? []).filter((f) => f.currentHp > 0);
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

    // Shadow Camouflage: exclude enemies that cannot be targeted (only area attacks can target them)
    const effects = battle.activeEffects || [];
    const isAreaAttack = !!(turn?.action === TURN_ACTION.POWER && turn?.usedPowerIndex != null && attacker?.powers?.[turn.usedPowerIndex]?.target === TARGET_TYPES.AREA);
    return alive.filter((f) => {
      const hasShadowCamouflage = effects.some((e) => e.targetId === f.characterId && e.modStat === MOD_STAT.SHADOW_CAMOUFLAGED);
      return !hasShadowCamouflage || isAreaAttack;
    });
  })();

  const hasDisoriented = !!(turn?.attackerId && (battle.activeEffects || []).some((e) => e.targetId === turn.attackerId && e.tag === EFFECT_TAGS.DISORIENTED));

  // Disoriented: NPC only — auto-pick when attacker is NPC; player must use modal (Random → wait 3s → Confirm)
  const disorientedTriggeredRef = useRef(false);
  useEffect(() => {
    const isPlayerAttacker = turn?.attackerId === myId;
    if (turn?.phase !== PHASE.SELECT_TARGET || !hasDisoriented || turn.defenderId || isPlayerAttacker || !onSelectTargetDisoriented) {
      if (turn?.phase !== PHASE.SELECT_TARGET) disorientedTriggeredRef.current = false;
      return;
    }
    if (disorientedTriggeredRef.current) return;
    disorientedTriggeredRef.current = true;
    onSelectTargetDisoriented();
  }, [turn?.phase, turn?.defenderId, turn?.attackerId, hasDisoriented, myId, onSelectTargetDisoriented]);

  /* ── Dice submit: pre-roll when entering phase, send result when player clicks so viewer gets it in sync ── */
  const atkSubmitted = useRef(false);
  const defSubmitted = useRef(false);
  const prevPhaseForAtkHoldRef = useRef<typeof PHASE[keyof typeof PHASE] | undefined>(undefined);

  // Pre-roll so we can send result on click (viewer gets result when player clicks, not when animation ends)
  const [preRolledAttack, setPreRolledAttack] = useState<number | null>(null);
  const [preRolledDefend, setPreRolledDefend] = useState<number | null>(null);
  const [atkRollDone, setAtkRollDone] = useState(false);
  const [defRollDone, setDefRollDone] = useState(false);
  const pomCoDefNonViewerAckRef = useRef<string | null>(null);
  useEffect(() => {
    const awaitingPom = !!(turn as { awaitingPomegranateCoAttack?: boolean })?.awaitingPomegranateCoAttack;
    const myCoAttackRoll =
      turn?.phase === PHASE.ROLLING_ATTACK &&
      awaitingPom &&
      (turn?.coAttackerId === myId ||
        (!!devPlayAllFightersSelf && isPlaybackDriver && !isViewer));
    if (
      (turn?.phase === PHASE.ROLLING_ATTACK && turn?.attackerId === myId && !awaitingPom) ||
      myCoAttackRoll
    ) {
      setPreRolledAttack(Math.floor(Math.random() * 12) + 1);
    } else if (
      turn?.phase === PHASE.ROLLING_DEFEND &&
      !atkRollDone &&
      (turn?.attackerId === myId ||
        (awaitingPom && turn?.coAttackerId === myId) ||
        (devUiActAsAttacker && preRolledAttack != null))
    ) {
      /* Keep through phase flip; play-all switches myId to defender before atkRollDone. */
    } else if (
      turn?.phase === PHASE.RESOLVING &&
      !atkRollDone &&
      (turn?.attackerId === myId ||
        (awaitingPom && turn?.coAttackerId === myId) ||
        (devUiActAsAttacker && preRolledAttack != null)) &&
      (turn?.attackRoll != null ||
        (awaitingPom && turn.coAttackRoll != null && turn.coAttackRoll > 0) ||
        preRolledAttack != null)
    ) {
      /* NPC / fast server can skip ROLLING_DEFEND — keep pre-roll through RESOLVING until atkRollDone. */
    } else {
      setPreRolledAttack(null);
    }
  }, [
    turn?.phase,
    turn?.attackerId,
    turn?.coAttackerId,
    myId,
    atkRollDone,
    devUiActAsAttacker,
    devPlayAllFightersSelf,
    isPlaybackDriver,
    isViewer,
    turn?.attackRoll,
    turn?.coAttackRoll,
    (turn as { awaitingPomegranateCoAttack?: boolean })?.awaitingPomegranateCoAttack,
  ]);
  useEffect(() => {
    const awaitingPomPre = !!(turn as { awaitingPomegranateCoAttack?: boolean })?.awaitingPomegranateCoAttack;
    const pomCoDefCommitted =
      awaitingPomPre && turn?.coDefendRoll != null && typeof turn.coDefendRoll === 'number' && turn.coDefendRoll >= 1;
    if (turn?.phase === PHASE.ROLLING_DEFEND && turn?.defenderId === myId) {
      setPreRolledDefend(Math.floor(Math.random() * 12) + 1);
    } else if (
      turn?.phase === PHASE.RESOLVING &&
      !defRollDone &&
      (turn?.defenderId === myId ||
        (devUiActAsAttacker && (preRolledDefend != null || pomCoDefCommitted)))
    ) {
      /* RESOLVING replay: play-all switches myId to attacker before defRollDone — keep pre-roll for fixedResult. */
    } else {
      setPreRolledDefend(null);
    }
  }, [
    turn?.phase,
    turn?.defenderId,
    myId,
    defRollDone,
    devUiActAsAttacker,
    isPlaybackDriver,
    turn?.coDefendRoll,
    (turn as { awaitingPomegranateCoAttack?: boolean })?.awaitingPomegranateCoAttack,
    preRolledDefend,
  ]);

  // Reset submitted flags when phase changes
  if (turn?.phase === PHASE.ROLLING_ATTACK) defSubmitted.current = false;
  if (turn?.phase === PHASE.SELECT_ACTION) atkSubmitted.current = false;

  const handleAttackRollResult = useCallback((n: number) => {
    if (atkSubmitted.current) return;
    atkSubmitted.current = true;
    void (async () => {
      try {
        await Promise.resolve(onSubmitAttackRoll(n));
        if (arenaId) await ackAttackDiceShown(arenaId);
      } catch { /* noop */ }
    })();
  }, [arenaId, onSubmitAttackRoll]);

  const handleDefendRollResult = useCallback((n: number) => {
    if (defSubmitted.current) return;
    defSubmitted.current = true;
    void (async () => {
      try {
        await Promise.resolve(onSubmitDefendRoll(n));
        if (arenaId) await ackDefendDiceShown(arenaId);
      } catch { /* noop */ }
    })();
  }, [arenaId, onSubmitDefendRoll]);

  const handleAttackRollStart = useCallback(() => {
    if (atkSubmitted.current || preRolledAttack == null) return;
    atkSubmitted.current = true;
    void (async () => {
      try {
        await Promise.resolve(onSubmitAttackRoll(preRolledAttack));
        if (arenaId) await ackAttackDiceShown(arenaId);
      } catch { /* noop */ }
    })();
  }, [arenaId, onSubmitAttackRoll, preRolledAttack]);
  const handleDefendRollStart = useCallback(() => {
    if (defSubmitted.current || preRolledDefend == null) return;
    defSubmitted.current = true;
    void (async () => {
      try {
        await Promise.resolve(onSubmitDefendRoll(preRolledDefend));
        if (arenaId) await ackDefendDiceShown(arenaId);
      } catch { /* noop */ }
    })();
  }, [arenaId, onSubmitDefendRoll, preRolledDefend]);

  /* ── Track when opponent auto-roll animations finish (for bonus text) ── */
  /** Delay before hiding player dice after animation ends — match viewer/NPC (2s after roll ends). Shorter for viewer so dice don't overlap damage card. */
  const PLAYER_ROLL_RESULT_VIEW_MS = 2000;
  const VIEWER_ROLL_RESULT_VIEW_MS = 1100;
  const atkRollDoneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const defRollDoneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dodgeReplayDoneTimeoutRef = useRef<number | null>(null);
  const critReplayDoneTimeoutRef = useRef<number | null>(null);
  const chainReplayDoneTimeoutRef = useRef<number | null>(null);
  /** Viewer uses shorter delay so dice don't overlap damage card */
  const replayResultViewMsRef = useRef(PLAYER_ROLL_RESULT_VIEW_MS);
  replayResultViewMsRef.current = isViewer ? VIEWER_ROLL_RESULT_VIEW_MS : PLAYER_ROLL_RESULT_VIEW_MS;

  useEffect(() => {
    const phase = turn?.phase;
    const prev = prevPhaseForAtkHoldRef.current;

    if (phase === PHASE.RESOLVING && isViewer) {
      prevPhaseForAtkHoldRef.current = phase;
      return;
    }

    /** New planning / target / fresh attack step — always drop attack-dice latch */
    const coAttackFromResolving =
      phase === PHASE.ROLLING_ATTACK &&
      prev === PHASE.RESOLVING &&
      !!(turn as { awaitingPomegranateCoAttack?: boolean })?.awaitingPomegranateCoAttack;

    // Pomegranate co D12 after main resolve: must start a fresh attack-dice cycle. Otherwise (1) atkSubmitted
    // stays true from the main hit and handleAttackRollStart never writes coAttackRoll (die can still animate);
    // (2) atkRollDone stays true so showMyAttackReplay is false in ROLLING_DEFEND and onAtkRollDone never runs for defenders.
    if (coAttackFromResolving) {
      if (atkRollDoneTimeoutRef.current) {
        clearTimeout(atkRollDoneTimeoutRef.current);
        atkRollDoneTimeoutRef.current = null;
      }
      atkSubmitted.current = false;
      setAtkRollDone(false);
      prevPhaseForAtkHoldRef.current = phase;
      return;
    }

    const hardReset =
      phase === PHASE.SELECT_ACTION ||
      phase === PHASE.SELECT_TARGET ||
      (phase === PHASE.ROLLING_ATTACK &&
        prev != null &&
        prev !== PHASE.ROLLING_DEFEND &&
        prev !== PHASE.RESOLVING &&
        prev !== PHASE.ROLLING_ATTACK);

    const preserveByTransition =
      (prev === PHASE.ROLLING_ATTACK && (phase === PHASE.ROLLING_DEFEND || phase === PHASE.RESOLVING)) ||
      (prev === PHASE.ROLLING_DEFEND && phase === PHASE.RESOLVING);

    const preservePendingViewDelay =
      !hardReset && atkRollDoneTimeoutRef.current != null;

    if (!hardReset && (preserveByTransition || preservePendingViewDelay)) {
      prevPhaseForAtkHoldRef.current = phase;
      return;
    }

    if (atkRollDoneTimeoutRef.current) {
      clearTimeout(atkRollDoneTimeoutRef.current);
      atkRollDoneTimeoutRef.current = null;
    }
    // After attack read-delay finished, stay true through RESOLVING (NPC skip, fast server) — don’t wipe here
    if (hardReset || phase !== PHASE.RESOLVING) {
      setAtkRollDone(false);
    }

    prevPhaseForAtkHoldRef.current = phase;
  }, [turn?.phase, turn?.awaitingPomegranateCoAttack, isViewer]);
  // Don't reset defRollDone when entering RESOLVING if player defended — we use defRollDone (animation end) to trigger resolve
  useEffect(() => {
    const awaitingPom = !!(turn as { awaitingPomegranateCoAttack?: boolean })?.awaitingPomegranateCoAttack;
    if (turn?.phase === PHASE.RESOLVING && turn?.defenderId === myId && !awaitingPom && turn.coDefendRoll == null) return;
    if (
      turn?.phase === PHASE.RESOLVING &&
      turn?.defenderId === myId &&
      awaitingPom &&
      turn.coDefendRoll != null
    ) {
      return;
    }
    /* Play-all: myId follows attacker in RESOLVING while defend dice finish — never clear defRollDone here for that segment (myId flip or preRoll→server echo); avoids unmount → remount → “replay”. */
    if (
      turn?.phase === PHASE.RESOLVING &&
      devUiActAsAttacker &&
      isPlaybackDriver &&
      turn.defenderId &&
      turn.defenderId !== myId &&
      (turn.defendRoll != null || preRolledDefend != null)
    ) {
      return;
    }
    /* Play-all: during pomegranate co-defend replay, myId is attacker — don’t clear defRollDone while embody shows co-def die */
    if (
      turn?.phase === PHASE.RESOLVING &&
      devUiActAsAttacker &&
      isPlaybackDriver &&
      turn.defenderId &&
      turn.defenderId !== myId &&
      awaitingPom &&
      turn.coDefendRoll != null &&
      !defRollDone
    ) {
      return;
    }
    if (defRollDoneTimeoutRef.current) {
      clearTimeout(defRollDoneTimeoutRef.current);
      defRollDoneTimeoutRef.current = null;
    }
    setDefRollDone(false);
  }, [
    turn?.phase,
    turn?.defenderId,
    myId,
    devUiActAsAttacker,
    isPlaybackDriver,
    turn?.defendRoll,
    preRolledDefend,
    turn?.coDefendRoll,
    (turn as { awaitingPomegranateCoAttack?: boolean })?.awaitingPomegranateCoAttack,
  ]);

  /** Pomegranate co defend: after co D12 is on turn, non-defender live clients must still set defRollDone (resolve chain) without a second mounted D12. */
  useEffect(() => {
    const t = turn;
    if (!t || t.phase !== PHASE.RESOLVING) {
      pomCoDefNonViewerAckRef.current = null;
      return;
    }
    const awaitingPom = !!(t as { awaitingPomegranateCoAttack?: boolean }).awaitingPomegranateCoAttack;
    if (!awaitingPom) return;
    if (t.coDefendRoll == null || t.coDefendRoll < 1) return;
    if (isViewer) return;
    const embodyPomCoDefReplay =
      !!devUiActAsAttacker &&
      isPlaybackDriver &&
      !isViewer &&
      t.phase === PHASE.RESOLVING &&
      awaitingPom &&
      t.coDefendRoll != null &&
      !defRollDone &&
      !!t.defenderId;
    const embodyDefenderForDefReplayInline =
      !!devUiActAsAttacker &&
      isPlaybackDriver &&
      !isViewer &&
      t.phase === PHASE.RESOLVING &&
      (t.defendRoll != null || preRolledDefend != null) &&
      !defRollDone &&
      !!t.defenderId &&
      !(awaitingPom && t.coDefendRoll != null);
    const someoneUsesDefMyRoll =
      t.defenderId === myId || embodyPomCoDefReplay || embodyDefenderForDefReplayInline;
    if (someoneUsesDefMyRoll) return;
    if (defRollDone) return;
    const ackKey = `${roundNumber}|${battle.currentTurnIndex}|pomdef|${t.coDefendRoll}`;
    if (pomCoDefNonViewerAckRef.current === ackKey) return;
    pomCoDefNonViewerAckRef.current = ackKey;
    const tid = window.setTimeout(() => setDefRollDone(true), 80);
    return () => window.clearTimeout(tid);
  }, [
    turn,
    turn?.phase,
    turn?.coDefendRoll,
    turn?.defenderId,
    turn?.defendRoll,
    myId,
    devUiActAsAttacker,
    isPlaybackDriver,
    isViewer,
    defRollDone,
    preRolledDefend,
    roundNumber,
    battle.currentTurnIndex,
    (turn as { awaitingPomegranateCoAttack?: boolean } | undefined)?.awaitingPomegranateCoAttack,
  ]);

  // Clear replay-dice timeouts on phase change (same as attack/defend)
  useEffect(() => {
    if (turn?.phase !== PHASE.RESOLVING) {
      [dodgeReplayDoneTimeoutRef, critReplayDoneTimeoutRef, chainReplayDoneTimeoutRef].forEach(ref => {
        if (ref.current) {
          clearTimeout(ref.current);
          ref.current = null;
        }
      });
    }
  }, [turn?.phase]);

  /* ── Sequencing: wait for opponent's dice to finish before next step ── */
  const [defendReady, setDefendReady] = useState(false);
  const [resolveReady, setResolveReady] = useState(false);

  // When I am defender, unlock defend dice only after attack roll is on the wire and attack animation + read delay finished (atkRollDone).
  useEffect(() => {
    if (turn?.phase !== PHASE.ROLLING_DEFEND) {
      setDefendReady(false);
      return;
    }
    if (turn.defenderId === myId) {
      const awaitingPom = !!(turn as { awaitingPomegranateCoAttack?: boolean })?.awaitingPomegranateCoAttack;
      const primed = awaitingPom
        ? turn.coAttackRoll != null && turn.coAttackRoll > 0 && atkRollDone
        : turn.attackRoll != null && atkRollDone;
      setDefendReady(primed);
    } else {
      setDefendReady(false);
    }
  }, [
    turn?.phase,
    turn?.defenderId,
    turn?.attackRoll,
    turn?.coAttackRoll,
    myId,
    atkRollDone,
    (turn as { awaitingPomegranateCoAttack?: boolean })?.awaitingPomegranateCoAttack,
  ]);
  useEffect(() => { if (turn?.phase === PHASE.RESOLVING) setResolveReady(false); }, [turn?.phase]);

  // Skip card (turn skipped — no valid target): same style as DamageCard, on attacker side
  const [skipCard, setSkipCard] = useState<{ attackerName: string; attackerTheme: string; side: PanelSide } | null>(null);

  // No-target modal: track when shown so we can keep it visible at least 3s before skip
  const noTargetShownAtRef = useRef<number | null>(null);
  const noTargetMinShowMs = 3000;
  useEffect(() => {
    if (turn?.phase === PHASE.SELECT_TARGET && targets.length === 0) {
      if (noTargetShownAtRef.current == null) noTargetShownAtRef.current = Date.now();
    } else {
      noTargetShownAtRef.current = null;
    }
  }, [turn?.phase, targets.length]);

  // If I am defender: sequencing is atkRollDone + effect above. Attack-only player is not isMyDefend — no separate shortcut.

  // If I am defender (NPC attacked): show defend roller only after attack dice animation (atkRollDone) — handled in the ROLLING_DEFEND effect above
  // If opponent attacked and we're not defender: wait for their roll animation to end + 2s viewing time
  useEffect(() => {
    if (atkRollDone && turn?.phase === PHASE.ROLLING_DEFEND && turn?.defenderId !== myId) {
      const t = setTimeout(() => setDefendReady(true), 2000);
      return () => clearTimeout(t);
    }
  }, [atkRollDone, turn?.phase, turn?.defenderId, myId]);

  // If skipDice power was used, resolve immediately (no dice to show)
  useEffect(() => {
    if (turn?.phase === PHASE.RESOLVING && turn.action === TURN_ACTION.POWER && !turn.attackRoll) {
      const t = setTimeout(() => setResolveReady(true), 800);
      return () => clearTimeout(t);
    }
  }, [turn?.phase, turn?.action, turn?.attackRoll]);

  // Soul Devourer drain: no dice; show resolve bar after short delay so user can resolve
  const turnPhase = turn?.phase;
  const soulDevourerDrainTurn = (turn as any)?.soulDevourerDrain;
  useEffect(() => {
    if (turnPhase === PHASE.RESOLVING && soulDevourerDrainTurn) {
      const t = setTimeout(() => setResolveReady(true), 800);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- turnPhase/soulDevourerDrainTurn are derived from turn; keep deps array length constant
  }, [turnPhase, soulDevourerDrainTurn]);

  // Soul Devourer end turn only (Use Power that cannot attack): advance immediately
  const soulDevourerEndTurnOnlyTurn = (turn as any)?.soulDevourerEndTurnOnly;
  useEffect(() => {
    if (turnPhase === PHASE.RESOLVING && soulDevourerEndTurnOnlyTurn && isPlaybackDriver) {
      const t = setTimeout(() => onResolve(), 600);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- turnPhase/soulDevourerEndTurnOnlyTurn derived from turn; keep deps array length constant
  }, [turnPhase, soulDevourerEndTurnOnlyTurn, isPlaybackDriver, onResolve]);

  // Resolve (damage card) only after defender dice animation has ended: wait for defRollDone then 2s. Same delay for viewer so they see damage card in sync with player.
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
    const atkBuff = getStatModifier(ae, turn.attackerId, MOD_STAT.ATTACK_DICE_UP);
    const defBuff = getStatModifier(ae, turn.defenderId, MOD_STAT.DEFEND_DICE_UP);
    const at = (turn.attackRoll ?? 0) + attacker.attackDiceUp + atkBuff;
    const dt = (turn.defendRoll ?? 0) + defender.defendDiceUp + defBuff;
    if (at <= dt) { setDodgeReady(true); return; }

    // Dodge D4: 50% → 2 winning faces
    const winFaces = (!isMyDefend && turn.dodgeWinFaces?.length) ? turn.dodgeWinFaces : getWinningFaces(50);

    /** Play-all: myId stays attacker during RESOLVING replay but host must still set up dodge like the defender. */
    const embodyDefenderForDodgeSetup =
      isMyDefend ||
      (!!devPlayAllFightersSelf && isPlaybackDriver && !isViewer && !!turn.defenderId);

    if (embodyDefenderForDodgeSetup) {
      dodgeRef.current = { winFaces, isDodged: false, roll: 0 };
      if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { dodgeWinFaces: winFaces });
      setDodgeEligible(true);
    } else if (turn.dodgeRoll != null && turn.dodgeRoll > 0) {
      dodgeRef.current = { winFaces, isDodged: !!turn.isDodged, roll: turn.dodgeRoll };
      setDodgeRollResult(turn.dodgeRoll);
      setDodgeEligible(true);
    } else if (isViewer || !isDefenderNpc || !isPlaybackDriver) {
      // Viewer, PvP opponent, or ally (not roller): wait for defender's roll — do not compute; show waiting until turn.dodgeRoll arrives
      dodgeRef.current = { winFaces, isDodged: false, roll: 0 };
      setDodgeEligible(true);
    } else {
      // NPC defender and I am playback driver: compute dodge now
      const roll = Math.ceil(Math.random() * 4);
      const dg = winFaces.includes(roll);
      dodgeRef.current = { winFaces, isDodged: dg, roll };
      if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { isDodged: dg, dodgeRoll: roll, dodgeWinFaces: winFaces });
      setDodgeRollResult(roll);
      setDodgeEligible(true);
    }
  }, [turn, resolveReady, attacker, defender, battle.activeEffects, arenaId, isMyDefend, isViewer, isDefenderNpc, isPlaybackDriver, devPlayAllFightersSelf]);

  // Player clicks → generate roll, write immediately so viewer sees dice start at same time
  const handleDodgeRollStart = useCallback(() => {
    if (dodgeSubmitted.current) return;
    dodgeSubmitted.current = true;
    const roll = Math.ceil(Math.random() * 4);
    const dr = dodgeRef.current;
    const dg = dr.winFaces.includes(roll);
    dodgeRef.current = { ...dr, isDodged: dg, roll };
    if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { isDodged: dg, dodgeRoll: roll, dodgeWinFaces: dr.winFaces });
    setDodgeRollResult(roll);
  }, [arenaId]);

  const handleDodgeRollResult = useCallback((roll: number) => {
    if (dodgeSubmitted.current) return;
    dodgeSubmitted.current = true;
    const dr = dodgeRef.current;
    const dg = dr.winFaces.includes(roll);
    dodgeRef.current = { ...dr, isDodged: dg, roll };
    if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { isDodged: dg, dodgeRoll: roll });
    setDodgeRollResult(roll);
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
    // Replay: wait for roller onRollEnd (onDodgeReplayEnd)
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
    const awaitingPomCrit = !!(turn as { awaitingPomegranateCoAttack?: boolean }).awaitingPomegranateCoAttack;
    const pomCoCritSegment =
      awaitingPomCrit &&
      !!turn.coAttackerId &&
      turn.coAttackRoll != null &&
      turn.coAttackRoll > 0 &&
      turn.coDefendRoll != null &&
      typeof turn.coDefendRoll === 'number' &&
      turn.coDefendRoll >= 1;
    const key = pomCoCritSegment
      ? `pomco:${turn.coAttackerId}:${turn.defenderId}:${turn.coAttackRoll}:${turn.coDefendRoll}`
      : `${turn.attackerId}:${turn.defenderId}:${turn.attackRoll}:${turn.defendRoll}`;
    if (critInitKey.current === key) return;
    critInitKey.current = key;

    // Dodged → skip crit
    if (dodgeRef.current.isDodged) { setCritReady(true); return; }

    if (pomCoCritSegment && turn.coAttackerId) {
      const coCaster = find(teamA, teamB, turn.coAttackerId);
      if (!coCaster) {
        setCritReady(true);
        return;
      }
      const isMyCoCritRoller =
        coCaster.characterId === myId ||
        (!!devPlayAllFightersSelf && isPlaybackDriver && !isViewer);
      const ae = battle.activeEffects || [];
      const coBuff = getStatModifier(ae, turn.coAttackerId, MOD_STAT.ATTACK_DICE_UP);
      const coRecovery = getStatModifier(ae, turn.coAttackerId, MOD_STAT.RECOVERY_DICE_UP);
      const defBuff = getStatModifier(ae, turn.defenderId, MOD_STAT.DEFEND_DICE_UP);
      const defRecovery = getStatModifier(ae, turn.defenderId, MOD_STAT.RECOVERY_DICE_UP);
      const coTotal =
        (turn.coAttackRoll ?? 0) + coCaster.attackDiceUp + coBuff + coRecovery;
      const coDefTotal =
        (turn.coDefendRoll ?? 0) + defender.defendDiceUp + defBuff + defRecovery;
      if (coTotal <= coDefTotal || coTotal < 10) {
        setCritReady(true);
        return;
      }
      const critBuffCo = getStatModifier(ae, turn.coAttackerId, MOD_STAT.CRITICAL_RATE);
      const effectiveCrit = Math.max(coCaster.criticalRate, coCaster.criticalRate + critBuffCo);
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
      const winFacesCo = (!isMyCoCritRoller && turn.critWinFaces?.length) ? turn.critWinFaces : getWinningFaces(effectiveCrit);
      if (isMyCoCritRoller) {
        critRef.current = { effectiveCrit, winFaces: winFacesCo, isCrit: false, critRoll: 0 };
        if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { critWinFaces: winFacesCo });
        setCritEligible(true);
      } else if (turn.critRoll != null && turn.critRoll > 0) {
        critRef.current = { effectiveCrit, winFaces: winFacesCo, isCrit: !!turn.isCrit, critRoll: turn.critRoll };
        setCritRollResult(turn.critRoll);
        setCritEligible(true);
      } else if (isViewer || !isPomCoCasterNpc || !isPlaybackDriver) {
        critRef.current = { effectiveCrit, winFaces: turn.critWinFaces ?? [], isCrit: false, critRoll: 0 };
        setCritEligible(true);
      } else {
        const critC = checkCritical(effectiveCrit, winFacesCo);
        critRef.current = { effectiveCrit, winFaces: winFacesCo, isCrit: critC.isCrit, critRoll: critC.critRoll };
        if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { isCrit: critC.isCrit, critRoll: critC.critRoll, critWinFaces: winFacesCo });
        setCritRollResult(critC.critRoll);
        setCritEligible(true);
      }
      return;
    }

    const isSkipDice = turn.action === TURN_ACTION.POWER && !turn.attackRoll;
    const isKeraunos = turn.usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE;
    if (isSkipDice && !isKeraunos) {
      setCritReady(true);
      return;
    }
    // Keraunos Voltage: D4 was already rolled before target selection; skip crit UI in RESOLVING
    if (isKeraunos) {
      const critBuffK = getStatModifier(battle.activeEffects || [], turn.attackerId, MOD_STAT.CRITICAL_RATE);
      const effectiveCritBase = Math.max(attacker?.criticalRate ?? 0, (attacker?.criticalRate ?? 0) + critBuffK);
      const effectiveCritK = Math.min(100, Math.max(0, effectiveCritBase + 25));
      const winFaces = turn.critWinFaces?.length ? turn.critWinFaces : getWinningFaces(effectiveCritK);
      if (turn.critRoll != null) {
        critRef.current = { effectiveCrit: effectiveCritK, winFaces, isCrit: !!turn.isCrit, critRoll: turn.critRoll };
        setCritRollResult(turn.critRoll);
        setCritEligible(true);
        setCritReady(true);
        return;
      }
      if (effectiveCritK >= 100) {
        critRef.current = { effectiveCrit: effectiveCritK, winFaces: [1, 2, 3, 4], isCrit: true, critRoll: 0 };
        if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { isCrit: true, critRoll: 0, critWinFaces: [1, 2, 3, 4] });
        setCritEligible(true);
        setCritReady(true);
        return;
      }
      if (isMyTurn) {
        critRef.current = { effectiveCrit: effectiveCritK, winFaces, isCrit: false, critRoll: 0 };
        if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { critWinFaces: winFaces });
        setCritEligible(true);
      } else if (turn.critRoll != null && turn.critRoll > 0) {
        critRef.current = { effectiveCrit: effectiveCritK, winFaces, isCrit: !!turn.isCrit, critRoll: turn.critRoll };
        setCritRollResult(turn.critRoll);
        setCritEligible(true);
      } else if (isViewer || !isAttackerNpc || !isPlaybackDriver) {
        // Viewer, PvP opponent, or ally (not roller): wait for roller's click / server result; never pre-roll or start animation
        critRef.current = { effectiveCrit: effectiveCritK, winFaces: turn.critWinFaces ?? [], isCrit: false, critRoll: 0 };
        setCritEligible(true);
      } else {
        // NPC attacker and I am playback driver: compute crit now so replay roller can run
        const crit = checkCritical(effectiveCritK, winFaces);
        critRef.current = { effectiveCrit: effectiveCritK, winFaces, isCrit: crit.isCrit, critRoll: crit.critRoll };
        if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { isCrit: crit.isCrit, critRoll: crit.critRoll, critWinFaces: winFaces });
        setCritRollResult(crit.critRoll);
        setCritEligible(true);
      }
      return;
    }
    // Self-buff powers (e.g. Beyond the Nimbus) still do normal attacks → allow crit
    const usedPowerDef = turn.action === TURN_ACTION.POWER && turn.usedPowerIndex != null
      ? attacker?.powers?.[turn.usedPowerIndex] : undefined;
    if (turn.action === TURN_ACTION.POWER && usedPowerDef?.target !== TARGET_TYPES.SELF) {
      setCritReady(true);
      return;
    }

    const ae = battle.activeEffects || [];
    const atkBuff = getStatModifier(ae, turn.attackerId, MOD_STAT.ATTACK_DICE_UP);
    const defBuff = getStatModifier(ae, turn.defenderId, MOD_STAT.DEFEND_DICE_UP);
    const atkRecovery = getStatModifier(ae, turn.attackerId, MOD_STAT.RECOVERY_DICE_UP);
    const defRecovery = getStatModifier(ae, turn.defenderId, MOD_STAT.RECOVERY_DICE_UP);
    const atkTotal = (turn.attackRoll ?? 0) + attacker.attackDiceUp + atkBuff + atkRecovery;
    const defTotal = (turn.defendRoll ?? 0) + defender.defendDiceUp + defBuff + defRecovery;

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
      // PvP/viewer: player already rolled
      critRef.current = { effectiveCrit, winFaces, isCrit: !!turn.isCrit, critRoll: turn.critRoll };
      setCritRollResult(turn.critRoll);
      setCritEligible(true);
    } else if (isViewer || !isAttackerNpc || !isPlaybackDriver) {
      // Viewer, PvP opponent, or ally (not roller): wait for roller's click / server result; never pre-roll
      critRef.current = { effectiveCrit, winFaces: turn.critWinFaces ?? [], isCrit: false, critRoll: 0 };
      setCritEligible(true);
    } else {
      // NPC attacker and I am playback driver: compute crit now, replay roller will trigger onCritReplayEnd when done
      const crit = checkCritical(effectiveCrit, winFaces);
      critRef.current = { effectiveCrit, winFaces, isCrit: crit.isCrit, critRoll: crit.critRoll };
      if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { isCrit: crit.isCrit, critRoll: crit.critRoll, critWinFaces: winFaces });
      setCritRollResult(crit.critRoll);
      setCritEligible(true);
    }
  }, [turn, resolveReady, dodgeReady, attacker, defender, battle.activeEffects, arenaId, isMyTurn, isViewer, isAttackerNpc, isPlaybackDriver, teamA, teamB, myId, devPlayAllFightersSelf, isPomCoCasterNpc]);

  // Player clicks → generate roll, write immediately so viewer sees dice start at same time; then show replay roller
  const handleCritRollStart = useCallback(() => {
    if (critSubmitted.current) return;
    critSubmitted.current = true;
    const roll = Math.ceil(Math.random() * 4);
    const cd = critRef.current;
    const isCrit = cd.winFaces.includes(roll);
    critRef.current = { ...cd, isCrit, critRoll: roll };
    if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { isCrit, critRoll: roll });
    setCritRollResult(roll);
  }, [arenaId]);

  // Legacy: if roll result arrives from die (e.g. no onRollStart), still accept it once
  const handleCritRollResult = useCallback((roll: number) => {
    if (critSubmitted.current) return;
    critSubmitted.current = true;
    const cd = critRef.current;
    const isCrit = cd.winFaces.includes(roll);
    critRef.current = { ...cd, isCrit, critRoll: roll };
    if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { isCrit, critRoll: roll });
    setCritRollResult(roll);
    setTimeout(() => setCritReady(true), 1500);
  }, [arenaId]);

  /* ── Keraunos Voltage: D4 crit before target selection ── */
  const handleKeraunosPreTargetCritRoll = useCallback((roll: number) => {
    const winFaces = turn?.critWinFaces?.length ? turn.critWinFaces : [];
    const isCrit = winFaces.length > 0 && winFaces.includes(roll);
    if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { isCrit, critRoll: roll, keraunosAwaitingCrit: false });
  }, [arenaId, turn?.critWinFaces]);

  const keraunosPreCritDoneRef = useRef(false);
  useEffect(() => {
    if (turn?.phase !== PHASE.SELECT_TARGET || turn?.usedPowerName !== POWER_NAMES.KERAUNOS_VOLTAGE || !turn.keraunosAwaitingCrit) {
      keraunosPreCritDoneRef.current = false;
      return;
    }
    if (isMyTurn || !isAttackerNpc || !isPlaybackDriver || !attacker) return;
    if (keraunosPreCritDoneRef.current) return;
    keraunosPreCritDoneRef.current = true;
    const critBuffK = getStatModifier(battle.activeEffects || [], turn.attackerId, MOD_STAT.CRITICAL_RATE);
    const effectiveCritBase = Math.max(attacker.criticalRate ?? 0, (attacker.criticalRate ?? 0) + critBuffK);
    const effectiveCritK = Math.min(100, Math.max(0, effectiveCritBase + 25));
    const winFaces = turn.critWinFaces?.length ? turn.critWinFaces : getWinningFaces(effectiveCritK);
    const crit = checkCritical(effectiveCritK, winFaces);
    if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { isCrit: crit.isCrit, critRoll: crit.critRoll, keraunosAwaitingCrit: false });
  }, [turn?.phase, turn?.usedPowerName, turn?.keraunosAwaitingCrit, turn?.critWinFaces, turn?.attackerId, isMyTurn, isAttackerNpc, isPlaybackDriver, attacker, arenaId, battle?.activeEffects]);

  // PvP watcher: opponent rolled D4 after we entered resolving
  useEffect(() => {
    if (turn?.phase !== PHASE.RESOLVING || !resolveReady || critReady || !critEligible) return;
    const awaitingPomW = !!(turn as { awaitingPomegranateCoAttack?: boolean }).awaitingPomegranateCoAttack;
    const pomCoCritSeg =
      awaitingPomW &&
      !!turn.coAttackerId &&
      turn.coAttackRoll != null &&
      turn.coAttackRoll > 0 &&
      turn.coDefendRoll != null &&
      turn.coDefendRoll >= 1;
    const iAmPomCoCritRoller =
      pomCoCritSeg &&
      (turn.coAttackerId === myId ||
        (!!devPlayAllFightersSelf && isPlaybackDriver && !isViewer));
    if (isMyTurn || iAmPomCoCritRoller) return;
    if (critRollResult > 0) return; // Already have result (NPC or early PvP)
    if (turn?.critRoll == null) return;
    critRef.current = { ...critRef.current, isCrit: !!turn.isCrit, critRoll: turn.critRoll };
    setCritRollResult(turn.critRoll);
  }, [turn?.phase, resolveReady, critReady, critEligible, isMyTurn, critRollResult, turn?.critRoll, turn?.isCrit, turn?.coAttackerId, turn?.coAttackRoll, turn?.coDefendRoll, myId, devPlayAllFightersSelf, isPlaybackDriver, isViewer]);

  /* ── Keraunos Voltage chain D4 check (legacy) ── */
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
    if (turn.usedPowerName !== POWER_NAMES.KERAUNOS_VOLTAGE) {
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
      // PvP/viewer: player already rolled
      chainRef.current = { winFaces, success: !!turn.chainSuccess, roll: turn.chainRoll };
      setChainRollResult(turn.chainRoll);
      setChainEligible(true);
    } else if (isViewer || !isAttackerNpc || !isPlaybackDriver) {
      // Viewer, PvP opponent, or ally (not roller): wait for player's roll — do not compute; show waiting until turn.chainRoll arrives
      setChainEligible(true);
    } else {
      // NPC attacker and I am playback driver: compute chain now, replay roller will trigger onChainReplayEnd when done
      const roll = Math.ceil(Math.random() * 4);
      const success = winFaces.includes(roll);
      chainRef.current = { winFaces, success, roll };
      if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { chainRoll: roll, chainSuccess: success });
      setChainRollResult(roll);
      setChainEligible(true);
    }
  }, [turn?.phase, resolveReady, critReady, turn?.usedPowerName, turn?.chainWinFaces, turn?.chainRoll, turn?.chainSuccess, arenaId, isMyTurn, isViewer, isAttackerNpc, isPlaybackDriver]);

  // Player clicks → generate roll, write immediately so viewer sees dice start at same time
  const handleChainRollStart = useCallback(() => {
    if (chainSubmitted.current) return;
    chainSubmitted.current = true;
    const roll = Math.ceil(Math.random() * 4);
    const cr = chainRef.current;
    const success = cr.winFaces.includes(roll);
    chainRef.current = { ...cr, success, roll };
    if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { chainRoll: roll, chainSuccess: success });
    setChainRollResult(roll);
  }, [arenaId]);

  const handleChainRollResult = useCallback((roll: number) => {
    if (chainSubmitted.current) return;
    chainSubmitted.current = true;
    const cr = chainRef.current;
    const success = cr.winFaces.includes(roll);
    chainRef.current = { ...cr, success, roll };
    if (arenaId) update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { chainRoll: roll, chainSuccess: success });
    setChainRollResult(roll);
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
  }, [turn?.phase, resolveReady, critReady, chainReady, chainEligible, isMyTurn, chainRollResult, turn?.chainRoll, turn?.chainSuccess]);

  const awaitingPomegranateCoAttack = !!(turn as { awaitingPomegranateCoAttack?: boolean })?.awaitingPomegranateCoAttack;

  const pomCoCasterFighter = turn?.coAttackerId ? find(teamA, teamB, turn.coAttackerId) : undefined;
  const pomCoAttackSubmitted = useRef(false);
  const pomCoDefendSubmitted = useRef(false);
  useEffect(() => {
    if (
      awaitingPomegranateCoAttack &&
      (turn?.phase === PHASE.ROLLING_ATTACK || turn?.phase === PHASE.ROLLING_DEFEND)
    ) {
      return;
    }
    pomCoAttackSubmitted.current = false;
    pomCoDefendSubmitted.current = false;
  }, [turn?.phase, awaitingPomegranateCoAttack]);
  useEffect(() => {
    if (turn?.phase !== PHASE.ROLLING_ATTACK || !arenaId || !awaitingPomegranateCoAttack) return;
    if (!isPomCoCasterNpc || !isPlaybackDriver || isViewer) return;
    if (turn.coAttackRoll != null && turn.coAttackRoll > 0) return;
    if (pomCoAttackSubmitted.current) return;
    pomCoAttackSubmitted.current = true;
    const roll = Math.ceil(Math.random() * 12);
    onSubmitAttackRoll(roll);
  }, [
    turn?.phase,
    turn?.coAttackRoll,
    arenaId,
    awaitingPomegranateCoAttack,
    isPomCoCasterNpc,
    isPlaybackDriver,
    isViewer,
    onSubmitAttackRoll,
  ]);
  useEffect(() => {
    if (turn?.phase !== PHASE.ROLLING_DEFEND || !arenaId || !awaitingPomegranateCoAttack) return;
    if (!isDefenderNpc || !isPlaybackDriver || isViewer) return;
    if (turn.coAttackRoll == null || turn.coAttackRoll <= 0) return;
    if (turn.coDefendRoll != null) return;
    if (pomCoDefendSubmitted.current) return;
    pomCoDefendSubmitted.current = true;
    const roll = Math.ceil(Math.random() * 12);
    onSubmitDefendRoll(roll);
  }, [
    turn?.phase,
    turn?.coAttackRoll,
    turn?.coDefendRoll,
    arenaId,
    awaitingPomegranateCoAttack,
    isDefenderNpc,
    isPlaybackDriver,
    isViewer,
    onSubmitDefendRoll,
  ]);

  /** When replay roller (viewer/NPC) finishes — delay then advance. Viewer uses shorter delay so dice don't overlap damage card. */
  const onDodgeReplayEnd = useCallback(() => {
    if (dodgeReplayDoneTimeoutRef.current) clearTimeout(dodgeReplayDoneTimeoutRef.current);
    const ms = replayResultViewMsRef.current;
    dodgeReplayDoneTimeoutRef.current = window.setTimeout(() => {
      dodgeReplayDoneTimeoutRef.current = null;
      setDodgeReady(true);
    }, ms);
  }, []);
  const onCritReplayEnd = useCallback(() => {
    if (critReplayDoneTimeoutRef.current) clearTimeout(critReplayDoneTimeoutRef.current);
    const ms = replayResultViewMsRef.current;
    critReplayDoneTimeoutRef.current = window.setTimeout(() => {
      critReplayDoneTimeoutRef.current = null;
      setCritReady(true);
    }, ms);
  }, []);
  const onChainReplayEnd = useCallback(() => {
    if (chainReplayDoneTimeoutRef.current) clearTimeout(chainReplayDoneTimeoutRef.current);
    const ms = replayResultViewMsRef.current;
    chainReplayDoneTimeoutRef.current = window.setTimeout(() => {
      chainReplayDoneTimeoutRef.current = null;
      setChainReady(true);
    }, ms);
  }, []);

  /* ── Heal crit (Floral / Spring) + Shadow Camouflage refill: local roll on click so viewer dice start at same time ── */
  const [floralHealRollLocal, setFloralHealRollLocal] = useState<number | null>(null);
  const [springHealRollLocal, setSpringHealRollLocal] = useState<number | null>(null);
  const [shadowCamouflageRefillRollLocal, setShadowCamouflageRefillRollLocal] = useState<number | null>(null);
  const [disorientedRollLocal, setDisorientedRollLocal] = useState<number | null>(null);
  const [rapidFireD4RollLocal, setRapidFireD4RollLocal] = useState<number | null>(null);
  useEffect(() => {
    if (turn?.phase !== PHASE.ROLLING_FLORAL_HEAL) setFloralHealRollLocal(null);
    if (turn?.phase !== PHASE.ROLLING_SPRING_HEAL) setSpringHealRollLocal(null);
    if (!(turn?.phase === PHASE.RESOLVING && (turn as any)?.shadowCamouflageRefillWinFaces?.length)) setShadowCamouflageRefillRollLocal(null);
    if (turn?.phase !== PHASE.ROLLING_DISORIENTED_NO_EFFECT) setDisorientedRollLocal(null);
    if (turn?.phase !== PHASE.ROLLING_RAPID_FIRE_EXTRA_SHOT) setRapidFireD4RollLocal(null);
    if (turn?.phase === PHASE.ROLLING_RAPID_FIRE_EXTRA_SHOT && (turn as any).rapidFireD4Roll == null) setRapidFireD4RollLocal(null);
    if (turn?.phase !== PHASE.RESOLVING_RAPID_FIRE_EXTRA_SHOT) lastPulsedRapidFireStepRef.current = null;
  }, [turn?.phase, turn?.shadowCamouflageRefillWinFaces, (turn as any)?.rapidFireD4Roll]);
  useEffect(() => {
    if (turn?.phase !== PHASE.RESOLVING_RAPID_FIRE_EXTRA_SHOT || !turn.attackerId || !turn.defenderId) return;
    const step = Number((turn as any).rapidFireStep) ?? 0;
    if (lastPulsedRapidFireStepRef.current === step) return;
    lastPulsedRapidFireStepRef.current = step;
    onMinionHitPulse?.(turn.attackerId, turn.defenderId);
  }, [turn?.phase, turn?.attackerId, turn?.defenderId, (turn as any)?.rapidFireStep, onMinionHitPulse]);

  /* ── Auto-resolve after showing result (only after all checks done) ── */
  // State-based count so the UI knows skeleton/minion playback is still running.
  const [pendingSkeletonCount, setPendingSkeletonCount] = useState(0);
  // Skeleton card lives in Arena so card + hit target update in one setState and start together
  const transientDamageActive = !!transientSkeletonCard || pendingSkeletonCount > 0;

  // Clear transient DamageCard and skip card state when turn/round changes (avoid overlap into next attacker).
  // Don't clear while skeleton chain is playing (would wipe card + VFX immediately).
  useEffect(() => {
    if (pendingSkeletonCount > 0) return;
    try { onSkeletonCardClear?.(); } catch (e) { }
    setPendingSkeletonCount(0);
    const logArr = battle?.log || [];
    const lastEntry = Array.isArray(logArr) && logArr.length > 0 ? logArr[logArr.length - 1] : null;
    if (lastEntry && (lastEntry as any).skippedNoValidTarget && lastEntry.attackerId !== turn?.attackerId) {
      return;
    }
    setSkipCard(null);
  }, [turn?.attackerId, turn?.defenderId, roundNumber, pendingSkeletonCount, onSkeletonCardClear, battle?.log]);

  const attackerTeamMinionsForPlayback = turn?.attackerTeam === BATTLE_TEAM.A ? teamMinionsA : teamMinionsB;
  const attackerSkeletonCountForPlayback = Array.isArray(attackerTeamMinionsForPlayback)
    ? (attackerTeamMinionsForPlayback as any[]).filter((m: any) => m?.masterId === turn?.attackerId).length
    : (attacker?.skeletonCount ?? 0);
  const masterHasSkeletonPlayback = attackerSkeletonCountForPlayback > 0;
  const SOUL_DEVOURER_MASTER_AND_HEAL_MS = 4500;
  const CHAINED_MASTER_RESOLVE_DISPLAY_MS = 2400;
  const MINION_RESOLVE_DISPLAY_MS = 3200;
  const WAITING_AFTER_SKELETON_DELAY_MS = 1000;
  const KERAUNOS_VOLTAGE_RESOLVE_MS = 10000;
  const masterResolveDisplayMs = (turn as any)?.soulDevourerDrain
    ? SOUL_DEVOURER_MASTER_AND_HEAL_MS
    : turn?.usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE
      ? KERAUNOS_VOLTAGE_RESOLVE_MS
      : (turn?.action === TURN_ACTION.ATTACK && masterHasSkeletonPlayback)
        ? CHAINED_MASTER_RESOLVE_DISPLAY_MS
        : 5000;
  const [showMasterDamageCard, setShowMasterDamageCard] = useState(false);
  /** Pomegranate co-attack: separate log line → own resolve bar + DamageCard (not merged into main hit). */
  const [pomegranateCoResolve, setPomegranateCoResolve] = useState<ResolveCacheRow | null>(null);
  /** Drop co card/bar when server leaves RESOLVING (race vs DamageCard timer) — stale pom blocked resolve bar + next ROLLING_ATTACK dice. */
  useEffect(() => {
    if (turn?.phase === PHASE.RESOLVING) return;
    setPomegranateCoResolve(null);
  }, [turn?.phase]);
  /** Battle turn key (`round|turnIndex`) for which the Pomegranate main-hit DamageCard was already dismissed — blocks a second auto-show on the same turn only. */
  const [pomMainMasterDamageCardDoneKey, setPomMainMasterDamageCardDoneKey] = useState<string | null>(null);
  /** Bump when we merge a main-attack log entry into resolveCache (re-render only — do not change DamageCard `key` or the card remounts and replays show → hide → show). */
  const [, bumpResolveCacheMerge] = useReducer((x: number) => x + 1, 0);
  const masterDamageCardTurnKeyRef = useRef<string | null>(null);
  /** Track which rapidFireStep we already pulsed for, so every extra shot gets hit VFX once. */
  const lastPulsedRapidFireStepRef = useRef<number | null>(null);
  const handleMasterDamageCardComplete = useCallback(() => {
    setShowMasterDamageCard(false);
    const aw = !!(turn as { awaitingPomegranateCoAttack?: boolean })?.awaitingPomegranateCoAttack;
    if (aw && turn?.phase === PHASE.RESOLVING) {
      setPomMainMasterDamageCardDoneKey(`${battle.roundNumber}|${battle.currentTurnIndex}`);
    }
    if (
      aw &&
      turn?.phase === PHASE.RESOLVING &&
      (turn.coAttackRoll == null || turn.coAttackRoll <= 0) &&
      onAdvancePomegranateCoAttackPhase
    ) {
      onAdvancePomegranateCoAttackPhase();
      return;
    }
    if (!isPlaybackDriver) return;
    if (turn?.phase !== PHASE.RESOLVING) return;
    const shadowCamouflageD4Wait = !!(turn as any)?.shadowCamouflageRefillWinFaces?.length && (turn as any).shadowCamouflageRefillRoll == null;
    if (shadowCamouflageD4Wait) return;
    onResolve();
  }, [isPlaybackDriver, turn, battle.roundNumber, battle.currentTurnIndex, onResolve, onAdvancePomegranateCoAttackPhase]);

  /* ── Floral Fragrance: target modal shows immediately for ally pick. A previous 3s hide (floralDelay) caused jitter: first paint had delay=false → modal flashed, then effect hid it. VFX still runs from TeamPanel / client visual. ── */

  /* ── Soul Devourer heal skipped: server sets soulDevourerHealSkipAwaitsAck so skeleton resolve does not start until Roger ── */
  const soulDevourerHealSkipAwaitsAck = !!(turn?.phase === PHASE.RESOLVING && (turn as any).soulDevourerHealSkipAwaitsAck);

  /* ── Fade transitions for resolve & waiting panels ── */
  const soulDevourerDrain = !!(turn as any)?.soulDevourerDrain;
  // Shadow Camouflaging D4: show roll-for-refill UI (no defender needed; phase + winFaces only)
  const shadowCamouflageD4 = turn?.phase === PHASE.RESOLVING && !!(turn as any)?.shadowCamouflageRefillWinFaces?.length;
  const playbackStep = (turn as any)?.playbackStep as any;
  const resolvingHitIndex = (turn as any)?.resolvingHitIndex as number | undefined;
  /** Main attack dice + dodge/crit/chain only — excludes Pomegranate co D12 so master card can show first */
  const mainResolveChecksDone =
    (resolvingHitIndex != null && resolvingHitIndex >= 1) ||
    soulDevourerDrain ||
    (resolveReady && dodgeReady && critReady && chainReady);
  /** Full chain: after deferred Pomegranate co, server needs co attack + co defend rolls, then RESOLVING + defRollDone replay before resolveTurn. */
  const allResolveChecksDone =
    mainResolveChecksDone &&
    (!awaitingPomegranateCoAttack ||
      (turn?.phase === PHASE.RESOLVING &&
        turn.coAttackRoll != null &&
        turn.coAttackRoll > 0 &&
        turn.coDefendRoll != null &&
        defRollDone));
  // Same for player and viewer: show damage card only when main resolve dice are done (co D12 runs after master card when Pomegranate defers).
  const resolveVisible = turn?.phase === PHASE.RESOLVING && (
    (!!attacker && !!defender && mainResolveChecksDone) ||
    (shadowCamouflageD4 && !!attacker)
  );
  const playbackRequestKeyRef = useRef<string | null>(null);
  const [activePlaybackStep, setActivePlaybackStep] = useState<any | null>(null);
  const activePlaybackStepKeyRef = useRef<string | null>(null);
  const completedPlaybackStepKeyRef = useRef<string | null>(null);
  const [playbackPendingAck, setPlaybackPendingAck] = useState(false);
  const playbackAckTimerRef = useRef<number | null>(null);
  const playbackFlowReady = !!(
    turn?.phase === PHASE.RESOLVING &&
    !shadowCamouflageD4 &&
    !!attacker &&
    !!defender &&
    (mainResolveChecksDone || playbackStep || activePlaybackStep || playbackPendingAck)
  );
  useEffect(() => {
    if (!playbackStep) {
      completedPlaybackStepKeyRef.current = null;
      setPlaybackPendingAck(false);
      if (turn?.phase !== PHASE.RESOLVING) {
        activePlaybackStepKeyRef.current = null;
        setActivePlaybackStep(null);
      }
      return;
    }
    // Minion/skeleton hit: never show card from playbackStep (that path has no hit VFX = "card only"). Only buffer path shows card+hit together.
    if (playbackStep.isMinionHit) return;
    // Viewer: don't show damage card until dice are hidden (resolveVisible) so they never overlap
    if (isViewer && !resolveVisible) return;
    const stepKey = buildBattlePlaybackEventKey(battle.roundNumber, battle.currentTurnIndex, playbackStep);
    if (completedPlaybackStepKeyRef.current === stepKey) return;
    if (activePlaybackStepKeyRef.current === stepKey) return;
    activePlaybackStepKeyRef.current = stepKey;
    setPlaybackPendingAck(false);
    const playbackSide = turn?.attackerTeam === BATTLE_TEAM.A ? PANEL_SIDE.RIGHT : PANEL_SIDE.LEFT;
    const playbackMs = playbackStep.isMinionHit ? MINION_RESOLVE_DISPLAY_MS : masterResolveDisplayMs;
    setActivePlaybackStep({
      ...playbackStep,
      __cardKey: stepKey,
      __side: playbackSide,
      __displayMs: playbackMs,
    });
  }, [playbackStep, turn?.phase, battle.roundNumber, battle.currentTurnIndex, isViewer, resolveVisible]);

  // Minion hit: we don't set activePlaybackStep (card+hit come from buffer only). If buffer never runs (no lastSkeletonHits), call onResolve() after display time so turn doesn't get stuck.
  const lastSkeletonHitsForFallback = (battle as any)?.lastSkeletonHits as any[] | undefined;
  useEffect(() => {
    if (!playbackStep?.isMinionHit || !isPlaybackDriver || turn?.phase !== PHASE.RESOLVING) return;
    if (Array.isArray(lastSkeletonHitsForFallback) && lastSkeletonHitsForFallback.length > 0) return; // buffer will run and call onResolve() when done
    const t = setTimeout(() => {
      if (turn?.phase !== PHASE.RESOLVING) return;
      onResolve();
    }, MINION_RESOLVE_DISPLAY_MS + 100);
    return () => clearTimeout(t);
  }, [playbackStep?.isMinionHit, isPlaybackDriver, turn?.phase, onResolve, lastSkeletonHitsForFallback]);

  // Don't advance to SELECT_ACTION while skeleton resolve is pending or playing — treat skeleton as part of resolve phase.
  const skeletonBufferPending = Array.isArray((battle as any)?.lastSkeletonHits) && (battle as any).lastSkeletonHits.length > 0;
  useEffect(() => {
    if (!isPlaybackDriver || turn?.phase !== PHASE.RESOLVING || shadowCamouflageD4) return;
    if (activePlaybackStep || playbackPendingAck) return;
    if (playbackStep) return;
    if (transientDamageActive || pendingSkeletonCount > 0 || skeletonBufferPending) return;
    if (!allResolveChecksDone) return;
    const logArrAuto = battle.log || [];
    const prevShownAuto = resolveCache.current.shownLogIndex ?? 0;
    const pomCoCardOrLogPending =
      !!pomegranateCoResolve ||
      (prevShownAuto < logArrAuto.length &&
        logArrAuto.slice(prevShownAuto).some((e) => (e as BattleLogEntry & { isPomegranateCoAttack?: boolean }).isPomegranateCoAttack));
    if (pomCoCardOrLogPending) return;
    const requestKey = `${battle.roundNumber}|${battle.currentTurnIndex}|${turn.attackerId}|${turn.defenderId ?? ''}|${resolvingHitIndex ?? 0}|${awaitingPomegranateCoAttack ? 'pom-wait' : 'pom-clear'}`;
    if (playbackRequestKeyRef.current === requestKey) return;
    playbackRequestKeyRef.current = requestKey;
    onResolve();
  }, [
    isPlaybackDriver,
    turn,
    activePlaybackStep,
    playbackPendingAck,
    playbackStep,
    shadowCamouflageD4,
    allResolveChecksDone,
    battle.roundNumber,
    battle.currentTurnIndex,
    battle.log,
    onResolve,
    resolvingHitIndex,
    transientDamageActive,
    pendingSkeletonCount,
    skeletonBufferPending,
    awaitingPomegranateCoAttack,
    pomegranateCoResolve,
  ]);
  useEffect(() => {
    if (turn?.phase !== PHASE.RESOLVING) playbackRequestKeyRef.current = null;
  }, [turn?.phase]);
  useEffect(() => {
    return () => {
      if (playbackAckTimerRef.current != null) {
        clearTimeout(playbackAckTimerRef.current);
        playbackAckTimerRef.current = null;
      }
    };
  }, []);
  useEffect(() => {
    /* Only hide master when a *playback* card owns resolve (Keraunos/Jolt step, etc.). Do not use playbackFlowReady here — it tracks mainResolveChecksDone and was forcing hide/show/hide on every normal attack. */
    if (playbackStep || activePlaybackStep || playbackPendingAck) {
      masterDamageCardTurnKeyRef.current = null;
      setShowMasterDamageCard(false);
      return;
    }
    const inSkeletonFollowup = resolvingHitIndex != null && resolvingHitIndex >= 1;
    const isSkipDicePower = turn?.action === TURN_ACTION.POWER && (turn?.attackRoll == null || turn?.attackRoll === 0);
    const lastLog = (battle.log || []).at(-1);
    const hasLogForThisTurn = !!(lastLog?.attackerId === turn?.attackerId && lastLog?.defenderId === turn?.defenderId);
    // Keraunos / Jolt Arc: card uses turn state (damage known before resolve), show immediately. Other skipDice: wait for log.
    const skipDiceReady = !isSkipDicePower || hasLogForThisTurn || turn?.usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE || turn?.usedPowerName === POWER_NAMES.JOLT_ARC;
    const combatTurnKey = `${battle.roundNumber}|${battle.currentTurnIndex}`;
    const pomMainMasterAlreadyDismissed =
      pomMainMasterDamageCardDoneKey != null && pomMainMasterDamageCardDoneKey === combatTurnKey;
    const shouldShowMasterCard = !!(
      turn?.phase === PHASE.RESOLVING &&
      resolveVisible &&
      !shadowCamouflageD4 &&
      !transientDamageActive &&
      !hadSkeletonHitsThisTurnRef.current &&
      !inSkeletonFollowup &&
      skipDiceReady &&
      !pomMainMasterAlreadyDismissed
    );
    const turnKey = shouldShowMasterCard
      ? `${battle.roundNumber}|${battle.currentTurnIndex}|${turn?.attackerId ?? ''}|${turn?.defenderId ?? ''}`
      : null;
    if (turnKey && masterDamageCardTurnKeyRef.current !== turnKey) {
      masterDamageCardTurnKeyRef.current = turnKey;
      setShowMasterDamageCard(true);
    }
    if (turn?.phase !== PHASE.RESOLVING) {
      masterDamageCardTurnKeyRef.current = null;
      setShowMasterDamageCard(false);
    }
  }, [battle.roundNumber, battle.currentTurnIndex, battle.log, turn, resolveVisible, shadowCamouflageD4, transientDamageActive, playbackStep, activePlaybackStep, playbackPendingAck, resolvingHitIndex, pomMainMasterDamageCardDoneKey]);
  // When targets.length === 0 we show no-target modal (with "Waiting for X") in dice-zone; don't also show generic waiting banner
  const baseWaitingVisible = !!(!isMyTurn && turn?.phase === PHASE.SELECT_TARGET && targets.length > 0);
  // Signal parent when resolve becomes visible (for hit effects). Only call when value changes to avoid update loops.
  // Pomegranate co log often lands as phase flips to SELECT_ACTION — still drive hit VFX while co card is up.
  const lastResolveVisibleRef = useRef<boolean | null>(null);
  const hitEffectsResolveVisible = resolveVisible || !!pomegranateCoResolve;
  useEffect(() => {
    if (lastResolveVisibleRef.current === hitEffectsResolveVisible) return;
    lastResolveVisibleRef.current = hitEffectsResolveVisible;
    onResolveVisible?.(hitEffectsResolveVisible);
  }, [hitEffectsResolveVisible, onResolveVisible]);

  // Soul Devourer: soul floats 2.8s, lands and explodes 0.5s, then heal shows. Heal ready at 3.8s (after explode).
  useEffect(() => {
    if (turn?.phase !== PHASE.RESOLVING || !(turn as any)?.soulDevourerDrain) {
      onSoulDevourerHealReady?.(false);
      return;
    }
    const t = setTimeout(() => onSoulDevourerHealReady?.(true), 3800);
    return () => {
      clearTimeout(t);
      onSoulDevourerHealReady?.(false);
    };
  }, [turn?.phase, (turn as any)?.soulDevourerDrain, onSoulDevourerHealReady]);

  // Keep resolve panel visible while a transient DamageCard (minion hit) is showing or skeleton chain is still playing.
  // Exclude Shadow Camouflage refill dice phase so .bhud__resolve is never shown during refill roll.
  // Exclude ROLLING_RAPID_FIRE_EXTRA_SHOT so Rapid Fire D4 modal is not covered; extra-shot DamageCard renders in that phase (arrow VFX is separate in Arena).
  // When turn has passed to NPC (SELECT_ACTION && !isMyTurn), hide immediately to avoid jitter of resolve/dice modal on player side.
  const resolveBarVisible =
    !(turn?.phase === PHASE.SELECT_ACTION && !isMyTurn) &&
    turn?.phase !== PHASE.ROLLING_RAPID_FIRE_EXTRA_SHOT &&
    ((resolveVisible && !shadowCamouflageD4) ||
      !!activePlaybackStep ||
      transientDamageActive ||
      pendingSkeletonCount > 0 ||
      (turn?.phase === PHASE.RESOLVING && !!pomegranateCoResolve));
  const [showResolve, resolveExiting] = useFadeTransition(resolveBarVisible, 250);
  /* Pomegranate co: no useFadeTransition — initial show=false caused a 1-frame flash; co bar+DamageCard gate on data only (same as main master card). */
  // Prevent re-processing the same `lastSkeletonHits` buffer repeatedly
  // (Firebase may update unrelated fields, causing `battle` to change refs).
  const lastSkeletonHitsKeyRef = useRef<string | null>(null);
  // Timeouts for the skeleton-hit chain; cleared only when starting a new chain or on unmount (not when effect re-runs with same buffer).
  const skeletonChainTimeoutsRef = useRef<number[]>([]);
  // After we play from buffer we clear lastSkeletonHits; log effect would then replay. Skip log minion hits for this turn.
  const lastSkeletonPlaybackTurnKeyRef = useRef<string | null>(null);
  // When true, this turn had skeleton/minion hits — never show main (caster) DamageCard to avoid flash before turn change.
  const hadSkeletonHitsThisTurnRef = useRef(false);
  const [waitingAfterSkeletonDelayElapsed, setWaitingAfterSkeletonDelayElapsed] = useState(true);
  useEffect(() => {
    if (turn?.phase !== PHASE.SELECT_TARGET) {
      setWaitingAfterSkeletonDelayElapsed(true);
      return;
    }
    if (!baseWaitingVisible || !hadSkeletonHitsThisTurnRef.current) return;
    setWaitingAfterSkeletonDelayElapsed(false);
    const t = setTimeout(() => setWaitingAfterSkeletonDelayElapsed(true), WAITING_AFTER_SKELETON_DELAY_MS);
    return () => clearTimeout(t);
  }, [turn?.phase, baseWaitingVisible]);
  const waitingVisible = baseWaitingVisible && (waitingAfterSkeletonDelayElapsed || !hadSkeletonHitsThisTurnRef.current);
  const [showWaiting, waitingExiting] = useFadeTransition(waitingVisible, 250);
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
      try { update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE}`), p).catch(() => { }); } catch (e) { }
    }, WRITE_THROTTLE_MS) as unknown as number;
  };

  useEffect(() => {
    return () => {
      if (lastHitWriteTimerRef.current) clearTimeout(lastHitWriteTimerRef.current);
      pendingLastHitPayloadRef.current = null;
    };
  }, []);

  // On unmount, stop any running skeleton-hit chain so we don't setState after unmount.
  useEffect(() => {
    return () => {
      skeletonChainTimeoutsRef.current.forEach((id) => clearTimeout(id));
      skeletonChainTimeoutsRef.current = [];
    };
  }, []);

  // Skeleton chain: card complete callback (same as player hit — card's onDisplayComplete drives next)
  const skeletonCardCompleteRef = useRef<() => void>(() => { });

  // Also render DamageCards directly from transient server buffer `lastSkeletonHits`
  const lastSkeletonHits = (battle as any)?.lastSkeletonHits as any[] | undefined;
  useEffect(() => {
    const skHits = lastSkeletonHits;
    if (!Array.isArray(skHits) || skHits.length === 0) {
      lastSkeletonHitsKeyRef.current = null;
      skeletonChainTimeoutsRef.current.forEach((id) => clearTimeout(id));
      skeletonChainTimeoutsRef.current = [];
      return;
    }
    const turnKey = `${(battle as any).roundNumber}-${(battle as any).currentTurnIndex}`;
    if (lastSkeletonPlaybackTurnKeyRef.current !== null && lastSkeletonPlaybackTurnKeyRef.current !== turnKey) {
      lastSkeletonHitsKeyRef.current = null;
    }
    lastSkeletonPlaybackTurnKeyRef.current = turnKey;

    const skKey = skHits.map((e: any) => `${String(e.attackerId)}|${String(e.defenderId)}|${String(e.isMinionHit)}|${String(e.damage ?? 0)}`).join(',');
    if (lastSkeletonHitsKeyRef.current === skKey) return;

    skeletonChainTimeoutsRef.current.forEach((id) => clearTimeout(id));
    skeletonChainTimeoutsRef.current = [];
    lastSkeletonHitsKeyRef.current = skKey;
    const HIT_DISPLAY_MS = MINION_RESOLVE_DISPLAY_MS;
    setPendingSkeletonCount((c) => c + skHits.length);

    const timeoutsRef = skeletonChainTimeoutsRef;
    let index = 0;
    const showNext = () => {
      if (index >= skHits.length) {
        try { update(ref(db, `arenas/${arenaId}`), { [ARENA_PATH.BATTLE_LAST_SKELETON_HITS]: null }); } catch (e) { }
        return;
      }
      if (index === 0) hadSkeletonHitsThisTurnRef.current = true;
      const entry = skHits[index];
      const atk = find(teamA, teamB, entry.attackerId);
      const def = find(teamA, teamB, entry.defenderId);
      let transientMinion: any | undefined;
      if (!atk && (teamMinionsA || teamMinionsB)) {
        const allMinions = [...(teamMinionsA || []), ...(teamMinionsB || [])];
        transientMinion = allMinions.find((mn: any) => mn && mn.characterId === entry.attackerId);
      }
      const isMinionAttacker = !atk && (transientMinion || /skeleton|_skeleton_/i.test(String(entry.attackerId)));
      const attackerDisplayName = isMinionAttacker
        ? (transientMinion?.nicknameEng?.toLowerCase() || 'skeleton')
        : (atk?.nicknameEng || entry.attackerId);
      const attackerDisplayTheme = (transientMinion?.theme?.[0] ?? atk?.theme?.[0]) || '#666';
      const defenderSideForMinion = turn?.attackerTeam === BATTLE_TEAM.A ? PANEL_SIDE.RIGHT : PANEL_SIDE.LEFT;
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
        attackerName: attackerDisplayName,
        attackerTheme: attackerDisplayTheme,
        defenderName: def?.nicknameEng || entry.defenderId,
        defenderTheme: def?.theme?.[0] || '#666',
        side: defenderSideForMinion,
      } as any;

      const hitTargetIdRaw = (entry as any).hitTargetId ?? entry.defenderId ?? turn?.defenderId;
      const hitTargetId = hitTargetIdRaw != null ? String(hitTargetIdRaw) : undefined;

      // One setState in Arena: card + hit target so they paint together (same as player hit)
      onResolveVisible?.(true);
      if (onSkeletonCardShow) {
        try {
          onSkeletonCardShow({
            cardData: rc as Record<string, unknown>,
            key: `skeleton-${index}-${entry.attackerId}-${entry.damage ?? 0}`,
            hitTargetId: hitTargetId ?? String(entry.defenderId ?? ''),
          });
        } catch (e) { }
      }
      if (hitTargetId) try { onMinionHitPulse?.(String(entry.attackerId), hitTargetId); } catch (e) { }
      try { scheduleLastHitUpdate({ lastHitMinionId: entry.attackerId, lastHitTargetId: hitTargetId ?? hitTargetIdRaw }); } catch (e) { }

      skeletonCardCompleteRef.current = () => {
        setPendingSkeletonCount((c) => Math.max(0, c - 1));
        index++;
        const finishedBuffer = index >= skHits.length;
        if (finishedBuffer && isPlaybackDriver) {
          try { onSkeletonCardClear?.(); } catch (e) { }
          onResolveVisible?.(false);
          try { scheduleLastHitUpdate({ lastHitMinionId: null, lastHitTargetId: null }); } catch (e) { }
          onResolve();
        } else if (!finishedBuffer) {
          showNext();
        }
      };
    };

    showNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scheduleLastHitUpdate is ref-stable; including it retriggers every render
  }, [playbackFlowReady, playbackStep, activePlaybackStep, playbackPendingAck, lastSkeletonHits, battle, arenaId, teamA, teamB, teamMinionsA, teamMinionsB, onResolveVisible, onSkeletonCardShow, onSkeletonCardClear, onMinionHitPulse, turn, isPlaybackDriver, onResolve]);

  // Notify parent when transient effects (transientDamageActive or skeleton buffer) are active.
  // Use primitive deps and only call when value changes to avoid update loops from parent re-renders.
  const skBufferLength = Array.isArray((battle as any)?.lastSkeletonHits) ? (battle as any).lastSkeletonHits.length : 0;
  const lastTransientActiveRef = useRef<boolean | null>(null);
  useEffect(() => {
    const hasPendingPlayback = transientDamageActive || skBufferLength > 0 || pendingSkeletonCount > 0;
    if (lastTransientActiveRef.current === hasPendingPlayback) return;
    lastTransientActiveRef.current = hasPendingPlayback;
    onTransientEffectsActive?.(hasPendingPlayback);
  }, [transientDamageActive, skBufferLength, pendingSkeletonCount, onTransientEffectsActive]);

  // When phase advances and no skeleton cards left, clear "had skeleton hits" (card lives in Arena)
  const prevPhaseRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = turn?.phase;
    const phaseJustAdvanced = prev === PHASE.RESOLVING && turn?.phase === PHASE.SELECT_ACTION;
    const skeletonChainDone = turn?.phase === PHASE.SELECT_ACTION && pendingSkeletonCount === 0;
    if ((phaseJustAdvanced || skeletonChainDone) && pendingSkeletonCount === 0) {
      hadSkeletonHitsThisTurnRef.current = false;
      try { onSkeletonCardClear?.(); } catch (e) { }
    }
  }, [turn?.phase, pendingSkeletonCount, onSkeletonCardClear]);

  // Delay action modal until DamageCard exit animation finishes + 750ms pause
  const [actionReady, setActionReady] = useState(true);
  const [showResurrecting, setShowResurrecting] = useState(false);
  const resurrectOverlayShownKey = useRef('');

  useEffect(() => {
    if (turn?.phase === PHASE.SELECT_ACTION && showResolve) {
      setActionReady(false);
    } else if (turn?.phase === PHASE.SELECT_ACTION && !showResolve && !actionReady && !showResurrecting) {
      // Soul Devourer: delay next phase so +{n} HP heal wave can show on caster (log may end with minion hits)
      const logArr = battle?.log || [];
      const lastSoulDevourer = (logArr as any[]).slice().reverse().find((e: any) => e.soulDevourerDrain);
      const needHealWaveDelay = lastSoulDevourer && lastSoulDevourer.attackerId === turn?.attackerId;
      const delayMs = needHealWaveDelay ? 3500 : 750;
      const timer = setTimeout(() => setActionReady(true), delayMs);
      return () => clearTimeout(timer);
    }
  }, [turn?.phase, turn?.attackerId, showResolve, actionReady, showResurrecting, battle?.log]);

  // Death Keeper (self or ally) / queue resurrect: brief overlay; ally wake uses resurrectTargetId !== attackerId
  useEffect(() => {
    if (turn?.phase === PHASE.SELECT_ACTION && turn.resurrectTargetId && !showResolve) {
      const key = `${turn.resurrectTargetId}:${battle.roundNumber}`;
      if (resurrectOverlayShownKey.current !== key) {
        resurrectOverlayShownKey.current = key;
        setActionReady(false);
        setShowResurrecting(true);
      }
    }
  }, [turn?.phase, turn?.resurrectTargetId, battle.roundNumber, showResolve]);

  // Resurrect overlay: timer to dismiss (separate effect so cleanup works with Strict Mode)
  useEffect(() => {
    if (!showResurrecting) return;
    const timer = setTimeout(() => { setShowResurrecting(false); setActionReady(true); }, 1000);
    return () => clearTimeout(timer);
  }, [showResurrecting]);

  // Cache resolve data so content doesn't flicker during exit animation
  const resolveCache = useRef<ResolveCacheRow>({
    atkRoll: 0, defRoll: 0, atkBonus: 0, defBonus: 0, atkTotal: 0, defTotal: 0,
    isHit: false, damage: 0, baseDmg: 0, shockBonus: 0,
    isPower: false, powerName: '', critEligible: false, isCrit: false, critRoll: 0,
    isDodged: false, coAttackHit: false, coAttackDamage: 0,
    attackerName: '', attackerTheme: '', defenderName: '', defenderTheme: '',
    side: PANEL_SIDE.RIGHT,
  });
  const joltResolveKey =
    turn?.usedPowerName === POWER_NAMES.JOLT_ARC
      ? `${(turn as any).joltArcResolveIndex ?? 0}|${(turn as any).joltArcTargetIds?.join(',') ?? ''}`
      : '';
  const keraunosResolveKey =
    turn?.usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE
      ? `${(turn as any).keraunosResolveIndex ?? 0}|${(turn as any).keraunosResolveTargetIds?.join(',') ?? ''}`
      : '';
  /** Stable per hit: same as above — do not include attackRoll/defendRoll (Firebase can echo in waves); cache ref holds live numbers. */
  const masterDamageCardKey = [
    battle.roundNumber,
    battle.currentTurnIndex,
    turn?.attackerId ?? '',
    turn?.defenderId ?? '',
    joltResolveKey,
    keraunosResolveKey,
  ].join('|');
  // Don't fill resolve cache for Shadow Camouflage D4 (no damage/HP to show — only D4 roll for refill)
  // Don't fill when turn has passed to NPC (SELECT_ACTION && !isMyTurn): avoid overwriting cache with next turn's data before bar hides (stops jitter at end + D4: auto flipping to D4: -)
  const isKeraunosTurn = turn?.action === TURN_ACTION.POWER && turn?.usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE;
  const isJoltArcTurn = turn?.action === TURN_ACTION.POWER && turn?.usedPowerName === POWER_NAMES.JOLT_ARC;
  const canFillCache = resolveVisible && turn && attacker && !shadowCamouflageD4 && !(turn.phase === PHASE.SELECT_ACTION && !isMyTurn) && (isKeraunosTurn || isJoltArcTurn || defender);
  if (canFillCache) {
    const isSkipDicePower = turn.action === TURN_ACTION.POWER && !turn.attackRoll;
    const soulDevourerDrainTurn = !!(turn as any).soulDevourerDrain;
    if (isSkipDicePower) {
      if (turn.usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE) {
        const isCritK = !!(turn as any).isCrit;
        const multK = isCritK ? 2 : 1;
        const kIds = (turn as any).keraunosResolveTargetIds as string[] | undefined;
        const kIdx = (turn as any).keraunosResolveIndex ?? 0;
        const kMap = (turn as any).keraunosAoeDamageMap as Record<string, number> | undefined;
        const mainTargetId = (turn as any).keraunosMainTargetId ?? turn.defenderId;
        const kDefId = kIds?.[kIdx] ?? mainTargetId ?? turn.defenderId;
        const defenderForKeraunos = kDefId ? find(teamA, teamB, kDefId) : defender;
        const secIds = (turn as any).keraunosSecondaryTargetIds as string[] | undefined;
        const tier =
          mainTargetId && kDefId
            ? kDefId === mainTargetId
              ? 0
              : (() => {
                  const si = secIds?.indexOf(kDefId) ?? -1;
                  if (si < 0) return 2;
                  return si < 2 ? 1 : 2;
                })()
            : 0;
        const bases = [3, 2, 1] as const;
        const baseBolt = bases[tier] * multK;
        const dmgCard = kDefId && kMap ? kMap[kDefId] ?? baseBolt : baseBolt;
        resolveCache.current = {
          atkRoll: 0, defRoll: 0, atkBonus: 0, defBonus: 0, atkTotal: 0, defTotal: 0,
          isHit: true, damage: dmgCard, baseDmg: bases[tier], shockBonus: Math.max(0, dmgCard - baseBolt),
          isPower: true, powerName: POWER_NAMES.KERAUNOS_VOLTAGE,
          critEligible: false, isCrit: isCritK, isCritForKeraunos: isCritK, critRoll: (turn as any).critRoll ?? 0,
          keraunosDamageTier: tier as 0 | 1 | 2,
          isDodged: false, coAttackHit: false, coAttackDamage: 0,
          attackerName: attacker.nicknameEng, attackerTheme: attacker.theme[0],
          defenderName: defenderForKeraunos?.nicknameEng ?? defender?.nicknameEng ?? '',
          defenderTheme: defenderForKeraunos?.theme?.[0] ?? defender?.theme?.[0] ?? '',
          side: turn.attackerTeam === BATTLE_TEAM.A ? PANEL_SIDE.RIGHT : PANEL_SIDE.LEFT,
        };
      } else if (turn.usedPowerName === POWER_NAMES.JOLT_ARC && attacker) {
        // Jolt Arc: one card per shocked enemy — defender follows joltArcResolveIndex / defenderId
        const joltIds = (turn as any).joltArcTargetIds as string[] | undefined;
        const joltIdx = (turn as any).joltArcResolveIndex ?? 0;
        const joltDefId = joltIds?.[joltIdx] ?? turn.defenderId;
        const def = (joltDefId ? find(teamA, teamB, joltDefId) : undefined) ?? defender ?? (turn.defenderId ? find(teamA, teamB, turn.defenderId) : undefined);
        const activeEffects = battle.activeEffects || [];
        const dmgBuff = getStatModifier(activeEffects, turn.attackerId, MOD_STAT.DAMAGE);
        const baseDmg = Math.max(0, attacker.damage + dmgBuff);
        resolveCache.current = {
          atkRoll: 0, defRoll: 0, atkBonus: 0, defBonus: 0, atkTotal: 0, defTotal: 0,
          isHit: true, damage: 0, baseDmg, shockBonus: 0,
          isPower: true, powerName: POWER_NAMES.JOLT_ARC,
          critEligible: false, isCrit: false, critRoll: 0,
          isDodged: false, coAttackHit: false, coAttackDamage: 0,
          attackerName: attacker.nicknameEng, attackerTheme: attacker.theme[0],
          defenderName: def?.nicknameEng ?? turn.defenderId ?? '', defenderTheme: def?.theme?.[0] ?? '#666',
          side: turn.attackerTeam === BATTLE_TEAM.A ? PANEL_SIDE.RIGHT : PANEL_SIDE.LEFT,
        };
      } else if (defender) {
        const lastLog = (battle.log || []).at(-1);
        const logMatchesTurn = lastLog?.attackerId === turn.attackerId && lastLog?.defenderId === turn.defenderId;
        if (logMatchesTurn) {
          const logDmg = (lastLog.damage ?? 0);
          resolveCache.current = {
            atkRoll: 0, defRoll: 0, atkBonus: 0, defBonus: 0, atkTotal: 0, defTotal: 0,
            isHit: true, damage: logDmg, baseDmg: 0, shockBonus: 0,
            isPower: true, powerName: turn.usedPowerName ?? TURN_ACTION.POWER,
            critEligible: false, isCrit: false, critRoll: 0,
            isDodged: false, coAttackHit: false, coAttackDamage: 0,
            attackerName: attacker.nicknameEng, attackerTheme: attacker.theme[0],
            defenderName: defender.nicknameEng, defenderTheme: defender.theme[0],
            side: turn.attackerTeam === BATTLE_TEAM.A ? PANEL_SIDE.RIGHT : PANEL_SIDE.LEFT,
          };
        }
      }
    } else if (soulDevourerDrainTurn && defender) {
      const activeEffects = battle.activeEffects || [];
      const dmgBuff = getStatModifier(activeEffects, turn.attackerId, 'damage');
      const drainDmg = Math.max(0, attacker.damage + dmgBuff);
      resolveCache.current = {
        atkRoll: 0, defRoll: 0, atkBonus: 0, defBonus: 0, atkTotal: 0, defTotal: 0,
        isHit: true, damage: drainDmg, baseDmg: drainDmg, shockBonus: 0,
        isPower: turn.action === TURN_ACTION.POWER && turn.usedPowerName !== POWER_NAMES.BEYOND_THE_NIMBUS, powerName: turn.usedPowerName === POWER_NAMES.BEYOND_THE_NIMBUS ? '' : (turn.usedPowerName ?? (turn.action === TURN_ACTION.POWER ? POWER_NAMES.SOUL_DEVOURER : TURN_ACTION.POWER)),
        critEligible: false, isCrit: false, critRoll: 0,
        isDodged: false, coAttackHit: false, coAttackDamage: 0,
        attackerName: attacker.nicknameEng, attackerTheme: attacker.theme[0],
        defenderName: defender.nicknameEng, defenderTheme: defender.theme[0],
        side: turn.attackerTeam === BATTLE_TEAM.A ? PANEL_SIDE.RIGHT : PANEL_SIDE.LEFT,
        soulDevourerDrain: true,
      };
    } else if (defender) {
      const activeEffects = battle.activeEffects || [];
      const atkBuff = getStatModifier(activeEffects, turn.attackerId, MOD_STAT.ATTACK_DICE_UP);
      const defBuff = getStatModifier(activeEffects, turn.defenderId!, MOD_STAT.DEFEND_DICE_UP);
      const atkRecovery = getStatModifier(activeEffects, turn.attackerId, MOD_STAT.RECOVERY_DICE_UP);
      const defRecovery = getStatModifier(activeEffects, turn.defenderId!, MOD_STAT.RECOVERY_DICE_UP);
      const at = (turn.attackRoll ?? 0) + attacker.attackDiceUp + atkBuff + atkRecovery;
      const dt = (turn.defendRoll ?? 0) + defender.defendDiceUp + defBuff + defRecovery;
      const dmgBuff = getStatModifier(activeEffects, turn.attackerId, MOD_STAT.DAMAGE);
      const baseDmg = Math.max(0, attacker.damage + dmgBuff);
      let damage = baseDmg;

      // Prefer server authority for breakdown when log already has this turn's attack result
      // (avoids overwriting isCrit/baseDmg/shockBonus with stale client refs e.g. defender never rolled D4)
      const logArrForFill = battle.log || [];
      const lastEntryForTurn = [...logArrForFill].reverse().find(
        (e: any) => e.attackerId === turn.attackerId && e.defenderId === turn.defenderId && !e.beyondTheNimbus && (e.attackRoll != null || (e.damage != null && e.damage > 0))
      ) as { baseDmg?: number; isCrit?: boolean; shockDamage?: number; damage?: number } | undefined;
      const useLogBreakdown = lastEntryForTurn && (
        lastEntryForTurn.baseDmg != null ||
        lastEntryForTurn.isCrit === true ||
        (lastEntryForTurn.shockDamage != null && lastEntryForTurn.shockDamage > 0)
      );

      // Read crit result from critRef (already determined by D4 roll)
      const cd = critRef.current;
      if (cd.isCrit) damage *= 2;

      // Shock detonation bonus: compute client-side (log isn't written until resolveTurn)
      // Lightning Reflex passive: if attacker has it + defender has shock DOTs → bonus = baseDmg
      let shockBonus = 0;
      if (at > dt && turn.action !== TURN_ACTION.POWER) {
        const hasLR = attacker.passiveSkillPoint === SKILL_UNLOCK &&
          attacker.powers?.some(p => p.type === POWER_TYPES.PASSIVE && p.name === POWER_NAMES.LIGHTNING_SPARK);
        const defShocks = hasLR && activeEffects.some(
          e => e.targetId === turn.defenderId && e.tag === EFFECT_TAGS.SHOCK,
        );
        if (defShocks) shockBonus = baseDmg;
      }
      damage += shockBonus;

      const dgd = dodgeRef.current.isDodged;

      const baseDmgFinal = useLogBreakdown && lastEntryForTurn?.baseDmg != null ? lastEntryForTurn.baseDmg : baseDmg;
      const isCritFinal = useLogBreakdown && lastEntryForTurn?.isCrit === true ? true : cd.isCrit;
      // If log has server baseDmg, prefer authoritative shock (incl. 0). Missing shockDamage on old
      // rows would re-use client `shockBonus` derived from effects — wrong after first-shock apply.
      const le = lastEntryForTurn;
      const shockBonusFinal =
        useLogBreakdown && le?.baseDmg != null
          ? (le.shockDamage ?? 0)
          : useLogBreakdown && le?.shockDamage != null
            ? le.shockDamage
            : shockBonus;
      const damageFinal = useLogBreakdown && lastEntryForTurn?.damage != null ? lastEntryForTurn.damage : (dgd ? 0 : damage);
      // Self-buff + attack (e.g. Beyond the Nimbus): show damage card as normal attack so breakdown (base + crit + shock) displays
      const isPowerForCard = turn.action === TURN_ACTION.POWER && turn.usedPowerName !== POWER_NAMES.BEYOND_THE_NIMBUS;

      // Store stable crit roll label so it doesn't flip to "D4: -" when turn changes (e.g. at end of resolving after Beyond the Nimbus)
      const critBuffForLabel = getStatModifier(activeEffects, turn.attackerId, MOD_STAT.CRITICAL_RATE);
      const effectiveCritForLabel = Math.max(attacker.criticalRate ?? 0, (attacker.criticalRate ?? 0) + critBuffForLabel);
      const critRollLabel = !dgd && critEligible
        ? (effectiveCritForLabel >= 100 ? 'D4: auto' : (cd.critRoll > 0 ? `D4: ${cd.critRoll}` : 'D4: -'))
        : undefined;

      resolveCache.current = {
        atkRoll: turn.attackRoll ?? 0, defRoll: turn.defendRoll ?? 0,
        atkBonus: attacker.attackDiceUp + atkBuff + atkRecovery,
        defBonus: defender.defendDiceUp + defBuff + defRecovery,
        atkTotal: at, defTotal: dt, isHit: at > dt && !dgd, damage: dgd ? 0 : damageFinal, baseDmg: baseDmgFinal, shockBonus: shockBonusFinal,
        isPower: isPowerForCard, powerName: turn.usedPowerName === POWER_NAMES.BEYOND_THE_NIMBUS ? '' : (turn.usedPowerName ?? ''),
        critEligible: !dgd && critEligible, isCrit: isCritFinal, critRoll: cd.critRoll, critRollLabel,
        isDodged: dgd, coAttackHit: false, coAttackDamage: 0,
        attackerName: attacker.nicknameEng, attackerTheme: attacker.theme[0],
        defenderName: defender.nicknameEng, defenderTheme: defender.theme[0],
        side: turn.attackerTeam === BATTLE_TEAM.A ? PANEL_SIDE.RIGHT : PANEL_SIDE.LEFT,
      };
    }
  }

  // Play back new entries in the persistent battle.log so every hit (master + minions)
  // shows a DamageCard and triggers hit visuals. We track which log entries we've
  // already rendered using `shownLogIndex` to only play new entries.
  // When we have Keraunos playback step, sync that turn's log entry into resolveCache once so bar/card use it (no log parsing in bar/card).
  // Pomegranate defer: playbackFlowReady is true while still in RESOLVING — if we skip the whole effect, the main-hit log
  // never merges into resolveCache and co D12 waits on an empty bar/card until refresh.
  // Also: when co attack is already rolled, skip becomes true and we must NOT bump shownLogIndex past an unplayed
  // isPomegranateCoAttack line — that swallowed the co card + left resolveTurn never ACK'd from the co timer path.
  const logForSkipIdle = battle.log || [];
  const prevShownForSkip = resolveCache.current.shownLogIndex ?? 0;
  const hasUnplayedPomegranateCoLog =
    prevShownForSkip < logForSkipIdle.length &&
    logForSkipIdle.slice(prevShownForSkip).some((e) => (e as BattleLogEntry & { isPomegranateCoAttack?: boolean }).isPomegranateCoAttack);
  const skipLogPlaybackWhileIdle =
    !hasUnplayedPomegranateCoLog &&
    ((playbackFlowReady &&
      !(awaitingPomegranateCoAttack && turn?.phase === PHASE.RESOLVING && (turn.coAttackRoll == null || turn.coAttackRoll <= 0))) ||
      playbackStep ||
      activePlaybackStep ||
      playbackPendingAck);
  useEffect(() => {
    if (skipLogPlaybackWhileIdle) {
      resolveCache.current.shownLogIndex = battle.log?.length || 0;
      return;
    }
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

    // If the new batch includes a skip entry, set skipCard immediately so the choose-action modal
    // for the next attacker doesn't flash before the skip card is shown.
    for (let j = prevIndex; j < total; j++) {
      const e = logArr[j];
      if ((e as any).skippedNoValidTarget) {
        const atk = find(teamA, teamB, e.attackerId);
        const attackerIsTeamA = !!(teamA || []).find((f: any) => f.characterId === e.attackerId);
        const side = attackerIsTeamA ? PANEL_SIDE.LEFT : PANEL_SIDE.RIGHT;
        setSkipCard({
          attackerName: atk?.nicknameEng ?? e.attackerId,
          attackerTheme: atk?.theme?.[0] ?? '#666',
          side,
        });
        break;
      }
    }

    // If lastSkeletonHits is present, minion hits are played from that buffer. After we clear it,
    // log would replay them unless we skip: use turn key so we skip minion hits for the turn we already played from buffer.
    const skBuffer = (battle as any)?.lastSkeletonHits as any[] | undefined;
    const currentTurnKey = `${(battle as any).roundNumber}-${(battle as any).currentTurnIndex}`;
    if (lastSkeletonPlaybackTurnKeyRef.current !== null && lastSkeletonPlaybackTurnKeyRef.current !== currentTurnKey) {
      lastSkeletonPlaybackTurnKeyRef.current = null;
    }
    const minionHitsPlayedElsewhere =
      (Array.isArray(skBuffer) && skBuffer.length > 0) || lastSkeletonPlaybackTurnKeyRef.current === currentTurnKey;

    const STAGGER_MS = 400;
    const HIT_DISPLAY_MS = MINION_RESOLVE_DISPLAY_MS;
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
        // Skip Shadow Camouflaging log entry — no damage card, no HP; we show D4 roll UI only
        if (entry.powerUsed === POWER_NAMES.SHADOW_CAMOUFLAGING && entry.defenderId === entry.attackerId && (entry.damage ?? 0) === 0) {
          return;
        }
        // Pomegranate co-attack: its own resolve bar + DamageCard (do not merge into main hit cache)
        if ((entry as any).isPomegranateCoAttack) {
          const ae = battle.activeEffects || [];
          const atkCo = find(teamA, teamB, entry.attackerId);
          const defCo = find(teamA, teamB, entry.defenderId);
          const atkBuffCo = getStatModifier(ae, entry.attackerId, MOD_STAT.ATTACK_DICE_UP);
          const defBuffCo = getStatModifier(ae, entry.defenderId!, MOD_STAT.DEFEND_DICE_UP);
          const atkRecoveryCo = getStatModifier(ae, entry.attackerId, MOD_STAT.RECOVERY_DICE_UP);
          const defRecoveryCo = getStatModifier(ae, entry.defenderId!, MOD_STAT.RECOVERY_DICE_UP);
          const atkTotalFromLog =
            (entry as any).coAtkTotal ??
            (entry.attackRoll ?? 0) + (atkCo?.attackDiceUp ?? 0) + atkBuffCo + atkRecoveryCo;
          const defTotalFromLog =
            (entry as any).coDefTotal ??
            (entry.defendRoll ?? 0) + (defCo?.defendDiceUp ?? 0) + defBuffCo + defRecoveryCo;
          const dmgBuffCo = getStatModifier(ae, entry.attackerId, MOD_STAT.DAMAGE);
          const baseDmgCo = Math.max(0, (atkCo?.damage ?? 0) + dmgBuffCo);
          const attackerIsTeamACo = !!(teamA || []).find((f: any) => f.characterId === entry.attackerId);
          const coRc: ResolveCacheRow = {
            attackerId: entry.attackerId,
            defenderId: entry.defenderId,
            atkRoll: entry.attackRoll ?? 0,
            defRoll: entry.defendRoll ?? 0,
            atkBonus: atkTotalFromLog - (entry.attackRoll ?? 0),
            defBonus: defTotalFromLog - (entry.defendRoll ?? 0),
            atkTotal: atkTotalFromLog,
            defTotal: defTotalFromLog,
            isHit: !entry.missed,
            damage: (entry.damage as number) || 0,
            baseDmg: baseDmgCo,
            shockBonus: 0,
            isPower: true,
            powerName: String(entry.powerUsed || ''),
            critEligible: false,
            isCrit: false,
            critRoll: 0,
            isDodged: false,
            coAttackHit: false,
            coAttackDamage: 0,
            attackerName: atkCo?.nicknameEng ?? entry.attackerId,
            attackerTheme: atkCo?.theme?.[0] ?? '#666',
            defenderName: defCo?.nicknameEng ?? entry.defenderId,
            defenderTheme: defCo?.theme?.[0] ?? '#666',
            side: attackerIsTeamACo ? PANEL_SIDE.RIGHT : PANEL_SIDE.LEFT,
          };
          setPomegranateCoResolve(coRc);
          onResolveVisible?.(true);
          const hitTargetIdLog = (entry as any).hitTargetId ?? (battle as any)?.lastHitTargetId ?? entry.defenderId;
          try {
            scheduleLastHitUpdate({ lastHitMinionId: null, lastHitTargetId: hitTargetIdLog });
          } catch (_) { }
          if (!entry.missed && hitTargetIdLog) {
            try {
              onMinionHitPulse?.(String(entry.attackerId), String(hitTargetIdLog));
            } catch (_) { }
          }
          return;
        }
        // Turn skipped (no valid target): show card on attacker side, same style as DamageCard
        if ((entry as any).skippedNoValidTarget) {
          const atk = find(teamA, teamB, entry.attackerId);
          const attackerIsTeamA = !!(teamA || []).find((f: any) => f.characterId === entry.attackerId);
          const side = attackerIsTeamA ? PANEL_SIDE.LEFT : PANEL_SIDE.RIGHT;
          setSkipCard({
            attackerName: atk?.nicknameEng ?? entry.attackerId,
            attackerTheme: atk?.theme?.[0] ?? '#666',
            side,
          });
          setTimeout(() => setSkipCard(null), HIT_DISPLAY_MS);
          return;
        }
        // Map attacker/defender to fighter/minion display names
        const atk = find(teamA, teamB, entry.attackerId);
        const def = find(teamA, teamB, entry.defenderId);
        // fallback to teamMinions arrays
        let minionFromTeams: any | undefined;
        if (!atk && (teamMinionsA || teamMinionsB)) {
          const allMinions = [...(teamMinionsA || []), ...(teamMinionsB || [])];
          minionFromTeams = allMinions.find((mn: any) => mn && mn.characterId === entry.attackerId);
        }

        // Determine whether the attacker belongs to teamA (used for deciding DamageCard side for main attack)
        const attackerIsTeamA = !!(teamA || []).find((f: any) => f.characterId === entry.attackerId);
        // Minion hit: show card on defender side (opposite of master). Use turn.attackerTeam.
        const defenderSideForMinion = turn?.attackerTeam === BATTLE_TEAM.A ? PANEL_SIDE.RIGHT : PANEL_SIDE.LEFT;

        const isKeraunosEntry = (entry as any).powerUsed === POWER_NAMES.KERAUNOS_VOLTAGE;
        const isJoltArcEntry = (entry as any).powerUsed === POWER_NAMES.JOLT_ARC;
        const mainIdK = turn?.usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE ? (turn as any).keraunosMainTargetId : null;
        const secondaryIdsK = (turn as any).keraunosSecondaryTargetIds as string[] | undefined;
        const keraunosTierFromDefender =
          isKeraunosEntry
            ? ((entry as { keraunosDamageTier?: number }).keraunosDamageTier != null
                ? ((entry as { keraunosDamageTier?: number }).keraunosDamageTier as 0 | 1 | 2)
                : mainIdK
                  ? (() => {
                      if (entry.defenderId === mainIdK) return 0 as const;
                      const idx = secondaryIdsK?.indexOf(entry.defenderId) ?? -1;
                      if (idx < 0) return 2 as const;
                      return (idx < 2 ? 1 : 2) as 0 | 1 | 2;
                    })()
                  : (0 as 0 | 1 | 2))
            : undefined;
        const aePlayback = battle.activeEffects || [];
        const atkBuffP = getStatModifier(aePlayback, entry.attackerId, MOD_STAT.ATTACK_DICE_UP);
        const defBuffP = getStatModifier(aePlayback, entry.defenderId!, MOD_STAT.DEFEND_DICE_UP);
        const atkRecP = getStatModifier(aePlayback, entry.attackerId, MOD_STAT.RECOVERY_DICE_UP);
        const defRecP = getStatModifier(aePlayback, entry.defenderId!, MOD_STAT.RECOVERY_DICE_UP);
        const atkRollNum = (entry.attackRoll as number) || 0;
        const defRollNum = (entry.defendRoll as number) || 0;
        const atkDiceUpF = atk?.attackDiceUp ?? 0;
        const defDiceUpF = def?.defendDiceUp ?? 0;
        const atkTotalLog = (entry as BattleLogEntry).atkTotal ?? atkRollNum + atkDiceUpF + atkBuffP + atkRecP;
        const defTotalLog = (entry as BattleLogEntry).defTotal ?? defRollNum + defDiceUpF + defBuffP + defRecP;
        const rc = {
          isHit: !entry.missed,
          // Beyond the Nimbus attack (after confirm): show in resolve bar as normal attack (ATK vs DEF, damage)
          isPower: (entry as any).powerUsed === POWER_NAMES.BEYOND_THE_NIMBUS ? false : !!entry.powerUsed,
          powerName: (entry as any).powerUsed === POWER_NAMES.BEYOND_THE_NIMBUS ? '' : (entry.powerUsed || ''),
          isCrit: !!(entry.isCrit),
          ...(isKeraunosEntry ? { isCritForKeraunos: !!(entry.isCrit), ...(keraunosTierFromDefender != null ? { keraunosDamageTier: keraunosTierFromDefender as 0 | 1 | 2 } : { keraunosDamageTier: 0 }) } : {}),
          baseDmg: (Number((entry as any).baseDmg) || 0) as number,
          damage: (entry.damage as number) || 0,
          shockBonus: (entry.shockDamage as number) || 0,
          atkRoll: atkRollNum,
          defRoll: defRollNum,
          atkBonus: atkTotalLog - atkRollNum,
          defBonus: defTotalLog - defRollNum,
          atkTotal: atkTotalLog,
          defTotal: defTotalLog,
          isDodged: !!entry.isDodged,
          coAttackHit: !!entry.coAttackDamage,
          coAttackDamage: (entry.coAttackDamage as number) || 0,
          soulDevourerDrain: !!(entry as any).soulDevourerDrain,
          critRoll: (entry as any).critRoll ?? 0,
          // Stable crit label so bar doesn't flip to "D4: -" when turn changes at end of resolving
          critRollLabel: (() => {
            const aeForCrit = battle.activeEffects || [];
            const critBuffMerge = getStatModifier(aeForCrit, entry.attackerId, MOD_STAT.CRITICAL_RATE);
            const effectiveCritMerge = atk ? Math.max(atk.criticalRate ?? 0, (atk.criticalRate ?? 0) + critBuffMerge) : 0;
            const entryCritRoll = (entry as any).critRoll ?? 0;
            return effectiveCritMerge >= 100 ? 'D4: auto' : (entryCritRoll > 0 ? `D4: ${entryCritRoll}` : 'D4: -');
          })(),
          // Use lowercase minion nickname for minion attacker when available
          attackerName: (entry as any).isMinionHit
            ? (minionFromTeams?.nicknameEng?.toLowerCase().slice(0, 11) + "..." || atk?.nicknameEng || entry.attackerId)
            : (atk?.nicknameEng || minionFromTeams?.nicknameEng || entry.attackerId),
          attackerTheme: atk?.theme?.[0] || (minionFromTeams?.theme ? minionFromTeams.theme[0] : '#666'),
          defenderName: def?.nicknameEng || entry.defenderId,
          defenderTheme: def?.theme?.[0] || '#666',
          // For minion hits: show on defender side (opposite of master). Main attack: show on attacker side.
          side: (entry as any).isMinionHit ? defenderSideForMinion : (attackerIsTeamA ? PANEL_SIDE.LEFT : PANEL_SIDE.RIGHT),
        } as any;

        // Only merge main-attack entries into resolveCache to avoid jitter and wrong card after minion hits
        // Skip "Beyond the Nimbus" placeholder entry (no dice/damage) so we don't overwrite with zeros before the real attack result
        if (!(entry as any).isMinionHit && !(entry as any).beyondTheNimbus && !(entry as any).isPomegranateCoAttack) {
          // Jolt Arc: log ไม่มี baseDmg — ใช้ค่าที่ canFillCache เติมไว้ (ไม่เขียนทับ); ถ้ายังไม่มีให้คำนวณจาก caster
          if (isJoltArcEntry) {
            delete (rc as any).baseDmg;
          }
          resolveCache.current = { ...resolveCache.current, ...rc } as any;
          if (isJoltArcEntry && !resolveCache.current.baseDmg && atk) {
            resolveCache.current.baseDmg = Math.max(0, atk.damage + getStatModifier(battle.activeEffects || [], entry.attackerId, MOD_STAT.DAMAGE));
          }
          // Resolve bar must never show power name for Beyond the Nimbus (treat as normal attack); once resolveVisible goes false the fill stops, so force it here
          if (turn?.usedPowerName === POWER_NAMES.BEYOND_THE_NIMBUS) {
            resolveCache.current.isPower = false;
            resolveCache.current.powerName = '';
          }
          bumpResolveCacheMerge();
        }
        onResolveVisible?.(true);
        const hitTargetIdLog = (entry as any).hitTargetId ?? (battle as any)?.lastHitTargetId ?? entry.defenderId;
        if ((entry as any).isMinionHit && onSkeletonCardShow && turn?.phase === PHASE.RESOLVING) {
          hadSkeletonHitsThisTurnRef.current = true;
          setPendingSkeletonCount((c) => c + 1);
          try {
            onSkeletonCardShow({
              cardData: rc as Record<string, unknown>,
              key: `log-minion-${entry.attackerId}-${entry.defenderId}-${entry.damage ?? 0}`,
              hitTargetId: String(hitTargetIdLog ?? ''),
            });
          } catch (_) { }
          onMinionHitPulse?.(entry.attackerId, hitTargetIdLog);
          setTimeout(() => {
            try { onSkeletonCardClear?.(); } catch (_) { }
            setPendingSkeletonCount((c) => Math.max(0, c - 1));
          }, HIT_DISPLAY_MS + 50);
        }

        try {
          const lastHitPayload: Record<string, unknown> = {};
          if ((entry as any).isMinionHit) {
            lastHitPayload.lastHitMinionId = entry.attackerId;
            lastHitPayload.lastHitTargetId = hitTargetIdLog;
          } else {
            lastHitPayload.lastHitMinionId = null;
            lastHitPayload.lastHitTargetId = hitTargetIdLog;
          }
          scheduleLastHitUpdate(lastHitPayload);
        } catch (e) { }

        /* Do not call onResolveVisible(false) here: resolveShown is driven by hitEffectsResolveVisible (resolveVisible || pom).
         * Forcing false after HIT_DISPLAY_MS cut TeamPanel hit VFX early while master DamageCard could still be up — felt like VFX end then card “remount”. */
      }, delay);
    }

    // After all cards, clear last-hit markers once (throttled) and advance shown index
    setTimeout(() => {
      resolveCache.current.shownLogIndex = total;
      try {
        scheduleLastHitUpdate({ lastHitMinionId: null, lastHitTargetId: null });
        update(ref(db, `arenas/${arenaId}`), { [ARENA_PATH.BATTLE_LAST_SKELETON_HITS]: null }).catch(() => { });
      } catch (e) { }
    }, delayAcc + HIT_DISPLAY_MS + 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scheduleLastHitUpdate ref-stable; battle included
  }, [skipLogPlaybackWhileIdle, playbackFlowReady, awaitingPomegranateCoAttack, playbackStep, activePlaybackStep, playbackPendingAck, battle?.log, battle, arenaId, teamA, teamB, teamMinionsA, teamMinionsB, onResolveVisible, onSkeletonCardShow, onSkeletonCardClear, onMinionHitPulse, turn]);

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

  // Compute conditionally disabled powers (e.g. Jolt Arc when no enemy has shock) and Thai reasons for tooltip footer
  const ae = battle.activeEffects || [];
  const myTeamMembers = turn.attackerTeam === BATTLE_TEAM.A ? teamA : teamB;
  const deadTeammateIds = new Set(
    (myTeamMembers || []).filter(m => m.currentHp <= 0).map(m => m.characterId),
  );
  const attackerTeamMinions = (turn?.attackerTeam === BATTLE_TEAM.A ? teamMinionsA : teamMinionsB) ?? [];
  const skeletonCountFromMinions = Array.isArray(attackerTeamMinions)
    ? attackerTeamMinions.filter((m: any) => m?.masterId === turn?.attackerId).length
    : 0;
  const attackerSkeletonCount = Array.isArray(attackerTeamMinions)
    ? skeletonCountFromMinions
    : (attacker ? (attacker.skeletonCount ?? 0) : 0);
  const attackerAllyIds = (myTeamMembers || []).filter((m) => m.currentHp > 0).map((m) => m.characterId);
  const { disabledPowerNames, disabledPowerReasons, infoReasons } = getDisabledPowersAndReasons({
    activeEffects: ae,
    opposingTeam: opposingTeam ?? undefined,
    attackerId: turn?.attackerId,
    attackerTeam: turn?.attackerTeam,
    teamMinionsA,
    teamMinionsB,
    attackerSkeletonCount,
    deadTeammateCount: deadTeammateIds.size,
    attackerAllyIds,
  });

  const isDefenderDodgeInteractive =
    !!isMyDefend ||
    (!!devPlayAllFightersSelf &&
      isPlaybackDriver &&
      !isViewer &&
      !!turn.defenderId &&
      turn.phase === PHASE.RESOLVING &&
      resolveReady &&
      !dodgeReady &&
      dodgeEligible);

  /** battleUiMyId follows attacker in RESOLVING — keep defender D12 mounted until defRollDone (showMyDefendReplay). */
  const embodyDefenderForDefReplay =
    !!devUiActAsAttacker &&
    isPlaybackDriver &&
    !isViewer &&
    turn?.phase === PHASE.RESOLVING &&
    (turn.defendRoll != null || preRolledDefend != null) &&
    !defRollDone &&
    !!turn?.defenderId &&
    !(awaitingPomegranateCoAttack && turn.coDefendRoll != null);

  /** RESOLVING after ROLLING_POMEGRANATE_CO_DEFEND — same idea as embodyDefenderForDefReplay but for co D12 only (not main defendRoll). */
  const embodyDefenderForPomCoDefReplay =
    !!devUiActAsAttacker &&
    isPlaybackDriver &&
    !isViewer &&
    turn?.phase === PHASE.RESOLVING &&
    awaitingPomegranateCoAttack &&
    turn.coDefendRoll != null &&
    !defRollDone &&
    !!turn?.defenderId;

  /** Play-all: myId follows defender in ROLLING_DEFEND — keep atk-my-roll until atkRollDone (showMyAttackReplay). */
  const embodyAttackerForAttackReplay =
    !!devUiActAsAttacker &&
    isPlaybackDriver &&
    !isViewer &&
    turn?.phase === PHASE.ROLLING_DEFEND &&
    !atkRollDone &&
    (awaitingPomegranateCoAttack ? !!turn?.coAttackerId : !!turn?.attackerId);

  /** Play-all host already sees attack in atk-my-roll — hide duplicate atk-defend-phase auto replay. */
  const playbackHostHideEchoAttackReplay = !!devUiActAsAttacker && isPlaybackDriver && !isViewer;

  const isMyPomegranateCoAttack =
    !!pomCoCasterFighter &&
    (pomCoCasterFighter.characterId === myId ||
      (!!devPlayAllFightersSelf && isPlaybackDriver && !isViewer));

  return (
    <div className="bhud">
      {/* Round & turn indicator */}
      <div className="bhud__bar">
        <span className="bhud__round">Round {roundNumber}</span>
        <div className="bhud__turn-info">
          {attacker && (
            <>
              <span className="bhud__attacker-name">{attacker.nicknameEng}</span>
              <span
                className={`bhud__phase-label${turn.phase === PHASE.ROLLING_DISORIENTED_NO_EFFECT || turn.phase === PHASE.ROLLING_FLORAL_HEAL || turn.phase === PHASE.ROLLING_SPRING_HEAL ? ' bhud__phase-label--dice-phase' : ''}`}
                data-phase={turn.phase ?? undefined}
              >
                {turn.phase && getPhaseLabel(turn.phase, { defenderName: defender?.nicknameEng, usedPowerName: turn.usedPowerName, action: turn.action, treatAsNormalAttack: turn?.usedPowerName === POWER_NAMES.BEYOND_THE_NIMBUS })}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Target selection (attacker only). Keraunos: show D4 crit roll first, then target modal. Disoriented: no manual target — server picks at random. */}
      {turn.phase === PHASE.SELECT_TARGET && (turn.usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE && turn.keraunosAwaitingCrit || hasDisoriented || (targets.length > 0 && isMyTurn) || targets.length === 0) && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          {turn.usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE && turn.keraunosAwaitingCrit ? (
            <div className="bhud__dice-modal" style={{ '--modal-primary': attacker?.theme?.[0], '--modal-dark': attacker?.theme?.[18] } as React.CSSProperties}>
              <span className="bhud__dice-label">Critical check</span>
              <span className="bhud__dice-sub">{attacker?.nicknameEng} — D4 (Keraunos)</span>
              {isMyTurn ? (
                <DiceRoller
                  key="keraunos-pretarget-crit"
                  className="bhud__dice-roller"
                  lockedDie={4}
                  hidePrompt
                  themeColors={{ primary: attacker?.theme?.[0] ?? '#333', primaryDark: attacker?.theme?.[18] ?? '#111' }}
                  onRollResult={handleKeraunosPreTargetCritRoll}
                />
              ) : (
                <div className="bhud__dice-roller bhud__dice-roller--waiting">
                  <div className="bhud__roll-waiting-spinner" />
                </div>
              )}
              <span className="bhud__dice-bonus">critical: {turn.critWinFaces?.slice().sort((a, b) => a - b).join(', ') || '—'}</span>
            </div>
          ) : hasDisoriented && !turn.defenderId && targets.length > 0 && isMyTurn ? (
            <TargetSelectModal
              attackerName={attacker?.nicknameEng ?? ''}
              targets={targets}
              themeColor={attacker?.theme[0]}
              themeColorDark={attacker?.theme[18]}
              onSelect={(id) => {
                const commit = onConfirmDisorientedTarget ?? onSelectTarget;
                if (commit) setTimeout(() => commit(id), 0);
              }}
              onBack={onCancelTarget ? () => setTimeout(() => onCancelTarget(), 0) : undefined}
              backDisabled={false}
              randomMode={true}
              confirmLabel="Random"
              subtitle="Click Random to pick target"
            />
          ) : hasDisoriented && !turn.defenderId && targets.length > 0 && !isMyTurn ? (
            <TargetSelectModal
              attackerName={attacker?.nicknameEng ?? ''}
              targets={targets}
              themeColor={attacker?.theme[0]}
              themeColorDark={attacker?.theme[18]}
              onSelect={() => { }}
              randomMode={true}
              subtitle="Disoriented"
              waitingForLabel={isAttackerNpc ? 'Choosing target at random...' : `Waiting for ${attacker?.nicknameEng ?? 'attacker'} to pick target...`}
            />
          ) : hasDisoriented && !turn.defenderId ? (
            <div className="bhud__dice-modal bhud__targets-modal bhud__targets-modal--disoriented-wait" style={{ '--modal-primary': attacker?.theme?.[0], '--modal-dark': attacker?.theme?.[18] } as React.CSSProperties}>
              <span className="bhud__dice-label">Disoriented</span>
              <p className="bhud__no-target-reason">
                {isAttackerNpc ? 'Choosing target at random...' : `Waiting for ${attacker?.nicknameEng ?? 'attacker'} to pick target...`}
              </p>
              <div className="bhud__dice-roller bhud__dice-roller--waiting">
                <div className="bhud__roll-waiting-spinner" />
              </div>
            </div>
          ) : hasDisoriented && turn.defenderId && !isMyTurn ? (
            <div className="bhud__dice-modal bhud__targets-modal bhud__targets-modal--disoriented-wait" style={{ '--modal-primary': attacker?.theme?.[0], '--modal-dark': attacker?.theme?.[18] } as React.CSSProperties}>
              <span className="bhud__dice-label">Disoriented</span>
              <p className="bhud__no-target-reason">Target chosen at random.</p>
              <div className="bhud__dice-roller bhud__dice-roller--waiting">
                <div className="bhud__roll-waiting-spinner" />
              </div>
            </div>
          ) : targets.length > 0 ? (
            (() => {
              const isAllyHealTargetSelect = !!(turn?.usedPowerIndex != null && attacker && !turn?.allyTargetId && attacker.powers[turn.usedPowerIndex]?.target === TARGET_TYPES.ALLY && attacker.powers[turn.usedPowerIndex]?.name !== POWER_NAMES.DEATH_KEEPER);
              const selectedPoem = (turn as { selectedPoem?: string }).selectedPoem;
              const afflictionVerseTag =
                turn?.usedPowerName === POWER_NAMES.IMPRECATED_POEM &&
                selectedPoem &&
                (IMPRECATED_POEM_VERSE_TAGS as readonly string[]).includes(selectedPoem)
                  ? selectedPoem
                  : null;
              const isKeraunosPick =
                turn?.usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE && !turn.keraunosAwaitingCrit;
              const aliveOppCountK = (opposingTeam ?? []).filter((f) => f.currentHp > 0).length;
              const keraunosSecsK = turn?.keraunosSecondaryTargetIds ?? [];
              const keraunosStepK = turn ? effectiveKeraunosStep(turn) : 0;
              const keraunosTier2Multi = !!(isKeraunosPick && turn && aliveOppCountK >= 3 && keraunosStepK === 1 && keraunosSecsK.length === 0 && onSelectKeraunosTier2Batch);
              const keraunosModalTargets =
                isKeraunosPick && turn
                  ? (() => {
                      const step = effectiveKeraunosStep(turn);
                      const mainId = turn.keraunosMainTargetId;
                      const secs = turn.keraunosSecondaryTargetIds ?? [];
                      if (step === 0) return targets;
                      let pool = targets.filter((t) => t.characterId !== mainId);
                      if (aliveOppCountK >= 3 && secs.length >= 1 && !keraunosTier2Multi) {
                        pool = pool.filter((t) => !secs.includes(t.characterId));
                      }
                      return pool;
                    })()
                  : targets;
              const keraunosSubtitle = (() => {
                if (!isKeraunosPick || !turn) return undefined;
                const step = effectiveKeraunosStep(turn);
                const secs = turn.keraunosSecondaryTargetIds ?? [];
                if (step === 0) return 'Keraunos Voltage — Tier 1: 3 damage';
                if (keraunosTier2Multi) return 'Keraunos Voltage — Tier 2: 2 damage (2 targets)';
                if (aliveOppCountK >= 3 && secs.length === 1) {
                  return 'Keraunos Voltage — Tier 2: 2 damage (1 target)';
                }
                return 'Keraunos Voltage — Tier 2: 1 damage (rest)';
              })();
              return (
                <TargetSelectModal
                  attackerName={attacker?.nicknameEng ?? ''}
                  targets={keraunosModalTargets}
                  themeColor={attacker?.theme[0]}
                  themeColorDark={attacker?.theme[18]}
                  onSelect={(id) => setTimeout(() => (isAllyHealTargetSelect && onSelectAllyTarget ? onSelectAllyTarget(id) : onSelectTarget(id)), 0)}
                  multiSelectRequired={keraunosTier2Multi ? 2 : undefined}
                  onSelectMulti={keraunosTier2Multi ? onSelectKeraunosTier2Batch : undefined}
                  onBack={() => setTimeout(() => onCancelTarget?.(), 0)}
                  backDisabled={backDisabled}
                  subtitle={
                    keraunosSubtitle
                    ?? (turn.usedPowerName === POWER_NAMES.IMPRECATED_POEM && turn.selectedPoem ? 'Choose target' : undefined)
                  }
                  eternalAgonySelected={turn?.usedPowerName === POWER_NAMES.IMPRECATED_POEM && (turn as { selectedPoem?: string }).selectedPoem === EFFECT_TAGS.ETERNAL_AGONY}
                  activeEffects={battle?.activeEffects ?? []}
                  healTargetSelect={isAllyHealTargetSelect}
                  afflictionVerseTag={afflictionVerseTag}
                />
              );
            })()
          ) : targets.length === 0 ? (
            <div className="bhud__targets-modal bhud__targets-modal--no-target" style={{ '--modal-primary': attacker?.theme?.[0], '--modal-dark': attacker?.theme?.[18] } as React.CSSProperties}>
              <span className="bhud__dice-label">No valid target</span>
              <p className="bhud__no-target-reason">
                All enemies are under Shadow Camouflage. Only area attacks can target them. {isMyTurn ? 'Your turn will be skipped unless you have a self-buff (use Back to choose another action).' : ''}
              </p>
              {isMyTurn && onSkipTurnNoTarget ? (
                <div className="bhud__target-actions">
                  {onCancelTarget && (
                    <button type="button" className="bhud__target-back" onClick={() => setTimeout(() => onCancelTarget(), 0)}>
                      Back
                    </button>
                  )}
                  <button
                    type="button"
                    className="bhud__target-confirm"
                    onClick={() => {
                      const shownAt = noTargetShownAtRef.current ?? Date.now();
                      const elapsed = Date.now() - shownAt;
                      if (elapsed >= noTargetMinShowMs) {
                        onSkipTurnNoTarget();
                      } else {
                        setTimeout(() => onSkipTurnNoTarget(), noTargetMinShowMs - elapsed);
                      }
                    }}
                  >
                    Roger that
                  </button>
                </div>
              ) : (
                <p className="bhud__no-target-waiting">Waiting for {attacker?.nicknameEng ?? 'attacker'}...</p>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Death Keeper / self-resurrect queue: brief overlay (name = resurrected fighter) */}
      {showResurrecting && !showResolve && turn?.resurrectTargetId && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <ResurrectingModal name={find(teamA, teamB, turn.resurrectTargetId)?.nicknameEng ?? attacker?.nicknameEng} />
        </div>
      )}

      {/* Action selection (attack or power) — delayed until DamageCard exits. Hide when power just confirmed (avoids jitter before target modal). Hide when skip card is showing (card before next attacker turn). */}
      {isMyTurn && turn.phase === PHASE.SELECT_ACTION && actionReady && !showResolve && attacker && !transientDamageActive && pendingSkeletonCount === 0 && !confirmedPowerName && !skipCard && (
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
            disabledPowerReasons={disabledPowerReasons}
            infoReasons={infoReasons}
            teammates={turn.attackerTeam === BATTLE_TEAM.A ? teamA : teamB}
            deadTeammateIds={deadTeammateIds}
            onSelectAction={onSelectAction}
            initialShowPowers={initialShowPowers}
          />
        </div>
      )}

      {/* When turn passed to NPC (SELECT_ACTION): show stable placeholder in dice zone to avoid jitter from DiceModal unmounting */}
      {turn.phase === PHASE.SELECT_ACTION && !isMyTurn && attacker && !showResolve && !skipCard && !showResurrecting && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <div className="bhud__dice-modal" style={{ '--modal-primary': attacker.theme?.[0], '--modal-dark': attacker.theme?.[18] } as React.CSSProperties}>
            <span className="bhud__dice-label">Choosing Action</span>
            <span className="bhud__dice-sub">{attacker.nicknameEng} is deciding...</span>
            <div className="bhud__dice-roller bhud__dice-roller--waiting">
              <div className="bhud__roll-waiting-spinner" />
            </div>
          </div>
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
            currentSeason={(battle.activeEffects || []).find(e => isSeasonTag(e.tag ?? ''))?.tag?.replace(SEASON_TAG_PREFIX, '') as SeasonKey | undefined}
            onSelectSeason={(s) => setTimeout(() => onSelectSeason(s), 0)}
            onPreviewSeason={onPreviewSeason}
            onBack={() => setTimeout(() => onCancelSeason?.(), 0)}
          />
        </div>
      )}

      {/* Poem selection (Apollo's Imprecated Poem) */}
      {turn.phase === PHASE.SELECT_POEM && attacker && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
          <PoemSelectModal
            attacker={attacker}
            isMyTurn={!!isMyTurn}
            phase={turn.phase}
            themeColor={attacker?.theme[0]}
            themeColorDark={attacker?.theme[18]}
            side={atkSide}
            onSelectPoem={(tag) => setTimeout(() => onSelectPoem?.(tag), 0)}
            onBack={() => setTimeout(() => onCancelPoem?.(), 0)}
          />
        </div>
      )}

      {/* Disoriented (Imprecated Poem): D4 roll for 25% action has no effect. Click = start dice on every screen; same flow as other D4. */}
      {turn?.phase === PHASE.ROLLING_DISORIENTED_NO_EFFECT && (turn as any)?.disorientedWinFaces?.length > 0 && (() => {
        const winFaces = (turn as any).disorientedWinFaces ?? [];
        const critPct = winFaces.length * 25;
        return (
          <RefillSPDiceModal
            attacker={attacker}
            isMyTurn={!!isMyTurn}
            winFaces={winFaces}
            roll={(turn as any).disorientedRoll ?? disorientedRollLocal}
            atkSide={atkSide}
            diceViewMs={REFILL_DICE_VIEW_MS}
            resultViewMs={PLAYER_ROLL_RESULT_VIEW_MS}
            title="Disoriented"
            subTitle={attacker ? `${attacker.nicknameEng} — D4 (${critPct}%)` : `D4 (${critPct}%)`}
            wonText="No effect"
            lostText="Proceed"
            bonusLabel={`no effect: ${[...winFaces].sort((a, b) => a - b).join(', ') || '—'}`}
            onRollStart={arenaId && isMyTurn ? () => {
              const roll = Math.ceil(Math.random() * 4);
              update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { disorientedRoll: roll }).catch(() => { });
              setDisorientedRollLocal(roll);
            } : undefined}
            onRoll={async (roll: number) => {
              if (!arenaId) return;
              try {
                await update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { disorientedRoll: roll });
                await new Promise((r) => setTimeout(r, REFILL_DICE_VIEW_MS + REFILL_CARD_VIEW_MS));
                await advanceAfterDisorientedD4(arenaId);
              } catch (e) { }
            }}
            onResultCardVisible={arenaId ? () => {
              window.setTimeout(() => advanceAfterDisorientedD4(arenaId).catch(() => { }), REFILL_CARD_VIEW_MS);
            } : undefined}
          />
        );
      })()}

      {/* Volley Arrow Rapid Fire: caster rolls D4 for each extra shot. Click = roll on every screen; others see waiting until caster clicks; no replay/remount. */}
      {turn?.phase === PHASE.ROLLING_RAPID_FIRE_EXTRA_SHOT && (() => {
        const rawWinFaces = (turn as any).rapidFireWinFaces;
        const winFaces = Array.isArray(rawWinFaces) && rawWinFaces.length > 0
          ? rawWinFaces
          : (() => { const step = Number((turn as any).rapidFireStep) ?? 0; return step === 0 ? [2, 3, 4] : step === 1 ? [3, 4] : [4]; })();
        if (winFaces.length === 0) return null;
        return (() => {
        const pct = winFaces.length * 25;
        const isCaster = turn.attackerId === myId;
        return (
          <RefillSPDiceModal
            attacker={attacker}
            isMyTurn={!!isCaster}
            winFaces={winFaces}
            roll={(turn as any).rapidFireD4Roll ?? rapidFireD4RollLocal ?? undefined}
            atkSide={atkSide}
            diceViewMs={REFILL_DICE_VIEW_MS}
            resultViewMs={PLAYER_ROLL_RESULT_VIEW_MS}
            title="Rapid Fire"
            subTitle={attacker ? `${attacker.nicknameEng} — D4 (${pct}% extra shot)` : `D4 (${pct}%)`}
            wonText="Extra shot"
            lostText="End"
            bonusLabel={`extra shot: ${[...winFaces].sort((a, b) => a - b).join(', ') || '—'}`}
            onRollStart={arenaId && isCaster ? () => {
              const roll = Math.ceil(Math.random() * 4);
              update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { rapidFireD4Roll: roll }).catch(() => { });
              setRapidFireD4RollLocal(roll);
            } : undefined}
            onRoll={async () => { }}
            onResultCardVisible={arenaId ? () => {
              const r = (turn as any).rapidFireD4Roll ?? rapidFireD4RollLocal;
              if (r != null) window.setTimeout(() => onSubmitRapidFireD4Roll?.(r), REFILL_CARD_VIEW_MS);
            } : undefined}
          />
        );
        })();
      })()}

      {/* Shadow Camouflaging: D4 roll for 25% refill SP (quota). Same flow as crit/Floral: click → write roll → dice → result card → advance. */}
      {turn?.phase === PHASE.RESOLVING && shadowCamouflageD4 && (
        <RefillSPDiceModal
          attacker={attacker}
          isMyTurn={!!isMyTurn}
          winFaces={(turn as any).shadowCamouflageRefillWinFaces ?? []}
          roll={(turn as any).shadowCamouflageRefillRoll ?? shadowCamouflageRefillRollLocal}
          atkSide={atkSide}
          diceViewMs={REFILL_DICE_VIEW_MS}
          resultViewMs={PLAYER_ROLL_RESULT_VIEW_MS}
          onRollStart={arenaId && isMyTurn ? () => {
            const roll = Math.ceil(Math.random() * 4);
            update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { shadowCamouflageRefillRoll: roll }).catch(() => { });
            setShadowCamouflageRefillRollLocal(roll);
          } : undefined}
          onRoll={async (roll: number) => {
            if (!arenaId) return;
            try {
              await update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { shadowCamouflageRefillRoll: roll });
              await new Promise((r) => setTimeout(r, REFILL_DICE_VIEW_MS + REFILL_CARD_VIEW_MS));
              await advanceAfterShadowCamouflageD4(arenaId);
            } catch (e) { }
          }}
          onResultCardVisible={arenaId ? () => {
            window.setTimeout(() => advanceAfterShadowCamouflageD4(arenaId).catch(() => { }), REFILL_CARD_VIEW_MS);
          } : undefined}
        />
      )}

      {/* Floral Fragrance: heal skipped (e.g. Healing Nullified) — only heal receiver (ally target) sees "Roger that"; others see waiting. */}
      {turn?.phase === PHASE.ROLLING_FLORAL_HEAL && (turn as any).floralHealSkipped && (() => {
        const floralHealReceiverId = (turn as any).allyTargetId;
        const floralHealReceiver = floralHealReceiverId ? find(teamA, teamB, floralHealReceiverId) : undefined;
        const isFloralHealReceiver = myId === floralHealReceiverId;
        return (
          <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
            <div className="bhud__targets-modal bhud__targets-modal--no-target" style={{ '--modal-primary': attacker?.theme?.[0], '--modal-dark': attacker?.theme?.[18] } as React.CSSProperties}>
              <span className="bhud__dice-label">Heal skipped</span>
              <p className="bhud__no-target-reason">
                {(turn as any).healSkipReason === EFFECT_TAGS.HEALING_NULLIFIED ? (
                  <>
                    HP recovery has no effect
                    <br />
                    because the target has Healing Nullified.
                  </>
                ) : 'HP recovery has no effect.'}
              </p>
              {isFloralHealReceiver && onHealSkippedAck ? (
                <div className="bhud__target-actions">
                  <button
                    type="button"
                    className="bhud__target-confirm"
                    onClick={() => onHealSkippedAck()}
                  >
                    Roger that
                  </button>
                </div>
              ) : (
                <p className="bhud__no-target-waiting">Waiting for {floralHealReceiver?.nicknameEng ?? 'heal receiver'}...</p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Spring (Ephemeral Season): heal skipped (e.g. Healing Nullified) — caster clicks Roger that then D4 roll for heal2. */}
      {turn?.phase === PHASE.ROLLING_SPRING_HEAL && (turn as any).springHealSkipAwaitsAck && (() => {
        return (
          <div className={`bhud__dice-zone bhud__dice-zone--${atkSide}`}>
            <div className="bhud__targets-modal bhud__targets-modal--no-target" style={{ '--modal-primary': attacker?.theme?.[0], '--modal-dark': attacker?.theme?.[18] } as React.CSSProperties}>
              <span className="bhud__dice-label">Heal skipped</span>
              <p className="bhud__no-target-reason">
                {(turn as any).healSkipReason === EFFECT_TAGS.HEALING_NULLIFIED ? (
                  <>
                    HP recovery has no effect
                    <br />
                    because the caster has Healing Nullified.
                  </>
                ) : 'HP recovery has no effect.'}
              </p>
              {isMyTurn && onSpringHealSkippedAck ? (
                <div className="bhud__target-actions">
                  <button
                    type="button"
                    className="bhud__target-confirm"
                    onClick={() => onSpringHealSkippedAck()}
                  >
                    Roger that
                  </button>
                </div>
              ) : (
                <p className="bhud__no-target-waiting">Waiting for {attacker?.nicknameEng ?? 'caster'}...</p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Soul Devourer: heal skipped — block skeleton resolve until heal receiver (caster) clicks Roger that. Others see waiting. */}
      {soulDevourerHealSkipAwaitsAck && (
        <div className={`bhud__dice-zone bhud__dice-zone--${atkSide} bhud__dice-zone--overlay`}>
          <div className="bhud__targets-modal bhud__targets-modal--no-target" style={{ '--modal-primary': attacker?.theme?.[0], '--modal-dark': attacker?.theme?.[18] } as React.CSSProperties}>
            <span className="bhud__dice-label">Heal skipped</span>
            <p className="bhud__no-target-reason">
              HP recovery has no effect
              <br />
              because the caster has Healing Nullified.
            </p>
            {isMyTurn ? (
              <div className="bhud__target-actions">
                <button
                  type="button"
                  className="bhud__target-confirm"
                  onClick={() => onSoulDevourerHealSkippedAck?.()}
                >
                  Roger that
                </button>
              </div>
            ) : (
              <p className="bhud__no-target-waiting">Waiting for {attacker?.nicknameEng ?? 'heal receiver'}...</p>
            )}
          </div>
        </div>
      )}

      {/* Floral Fragrance + Efflorescence Muse: D4 roll for heal crit. Only show when not heal-skipped AND server set winFaces (so everyone sees heal-skip modal when applicable). */}
      {turn?.phase === PHASE.ROLLING_FLORAL_HEAL && !(turn as any).floralHealSkipped && (turn as any).floralHealWinFaces?.length > 0 && (() => {
        const floralWinFaces = (turn as any).floralHealWinFaces ?? [];
        const floralRoll = (turn as any).floralHealRoll;
        const floralRollDisplay = floralRoll ?? floralHealRollLocal;
        const critPct = floralWinFaces.length * 25;
        return (
          <RefillSPDiceModal
            attacker={attacker}
            isMyTurn={!!isMyTurn}
            winFaces={floralWinFaces}
            roll={floralRollDisplay}
            atkSide={atkSide}
            diceViewMs={REFILL_DICE_VIEW_MS}
            resultViewMs={PLAYER_ROLL_RESULT_VIEW_MS}
            title="Heal Crit"
            subTitle={attacker ? `${attacker.nicknameEng} — D4 (${critPct}%)` : `D4 (${critPct}%)`}
            wonText="HEAL x2!"
            lostText="Normal Heal"
            bonusLabel={`crit: ${[...floralWinFaces].sort((a, b) => a - b).join(', ') || '—'}`}
            onRollStart={arenaId && isMyTurn ? () => {
              const roll = Math.ceil(Math.random() * 4);
              update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { floralHealRoll: roll }).catch(() => { });
              setFloralHealRollLocal(roll);
            } : undefined}
            onRoll={async (roll: number) => {
              if (!arenaId) return;
              try {
                await update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { floralHealRoll: roll });
                await new Promise((r) => setTimeout(r, REFILL_DICE_VIEW_MS + REFILL_CARD_VIEW_MS));
                onFloralHealResultCardHidden?.();
                await advanceAfterFloralHealD4(arenaId);
              } catch (e) { }
            }}
            onResultCardVisible={arenaId ? () => {
              onFloralHealResultCardVisible?.();
              window.setTimeout(() => {
                onFloralHealResultCardHidden?.();
                advanceAfterFloralHealD4(arenaId).catch(() => { });
              }, REFILL_CARD_VIEW_MS);
            } : onFloralHealResultCardVisible}
          />
        );
      })()}

      {/* Ephemeral Season Spring: show D4 when phase is ROLLING_SPRING_HEAL and not showing heal-skip modal. */}
      {turn?.phase === PHASE.ROLLING_SPRING_HEAL && !(turn as any).springHealSkipAwaitsAck && turn?.attackerId === (battle as { springCasterId?: string })?.springCasterId && ((turn as any).springHealWinFaces?.length ?? 0) > 0 && ((battle as { springHealRollActive?: boolean | null })?.springHealRollActive === true || (turn as any).springRound === 1 || (turn as any).springRound === 2) && (() => {
        const springWinFaces = (turn as any).springHealWinFaces ?? [];
        const springRoll = (turn as any).springHealRoll;
        const springRollDisplay = springRoll ?? springHealRollLocal;
        const critPct = springWinFaces.length * 25;
        return (
          <RefillSPDiceModal
            attacker={attacker}
            isMyTurn={!!isMyTurn}
            winFaces={springWinFaces}
            roll={springRollDisplay}
            atkSide={atkSide}
            diceViewMs={REFILL_DICE_VIEW_MS}
            resultViewMs={PLAYER_ROLL_RESULT_VIEW_MS}
            title="Spring Heal"
            subTitle={attacker ? `${attacker.nicknameEng} — D4 (${critPct}%)` : `D4 (${critPct}%)`}
            wonText="+2 HP"
            lostText="+1 HP"
            bonusLabel={`crit: ${[...springWinFaces].sort((a, b) => a - b).join(', ') || '—'}`}
            onRollStart={arenaId && isMyTurn ? () => {
              const roll = Math.ceil(Math.random() * 4);
              update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { springHealRoll: roll }).catch(() => { });
              setSpringHealRollLocal(roll);
            } : undefined}
            onRoll={async (roll: number) => {
              if (!arenaId) return;
              try {
                await update(ref(db, `arenas/${arenaId}/${ARENA_PATH.BATTLE_TURN}`), { springHealRoll: roll });
                await new Promise((r) => setTimeout(r, REFILL_DICE_VIEW_MS + REFILL_CARD_VIEW_MS));
                await advanceAfterSpringHealD4(arenaId);
              } catch (e) { }
            }}
            onResultCardVisible={arenaId ? () => {
              window.setTimeout(() => advanceAfterSpringHealD4(arenaId).catch(() => { }), REFILL_CARD_VIEW_MS);
            } : undefined}
          />
        );
      })()}

      {/* Dice rolling (attack, defend, resolving replay). In viewer mode hide when damage card is showing so blocked/hit card doesn't overlap dice. */}
      {turn && (turn.phase === PHASE.ROLLING_ATTACK || turn.phase === PHASE.ROLLING_DEFEND || turn.phase === PHASE.RESOLVING) && !shadowCamouflageD4 && !(isViewer && resolveVisible) && (
        <DiceModal
          turn={turn}
          attacker={attacker}
          defender={defender}
          isMyTurn={!!isMyTurn}
          isMyDefend={!!isMyDefend}
          isDefenderDodgeInteractive={isDefenderDodgeInteractive}
          embodyDefenderForDefReplay={embodyDefenderForDefReplay}
          embodyDefenderForPomCoDefReplay={embodyDefenderForPomCoDefReplay}
          embodyAttackerForAttackReplay={embodyAttackerForAttackReplay}
          playbackHostHideEchoAttackReplay={playbackHostHideEchoAttackReplay}
          atkSide={atkSide}
          defSide={defSide}
          preRolledAttack={preRolledAttack}
          preRolledDefend={preRolledDefend}
          onAttackRoll={handleAttackRollResult}
          onDefendRoll={handleDefendRollResult}
          onAttackRollStart={handleAttackRollStart}
          onDefendRollStart={handleDefendRollStart}
          onAtkRollDone={() => {
            if (arenaId) ackAttackDiceShown(arenaId).catch(() => { });
            if (atkRollDoneTimeoutRef.current) clearTimeout(atkRollDoneTimeoutRef.current);
            const delayMs = isViewer ? 0 : PLAYER_ROLL_RESULT_VIEW_MS;
            atkRollDoneTimeoutRef.current = setTimeout(() => {
              atkRollDoneTimeoutRef.current = null;
              setAtkRollDone(true);
            }, delayMs);
          }}
          onDefRollDone={() => {
            if (arenaId) ackDefendDiceShown(arenaId).catch(() => { });
            if (defRollDoneTimeoutRef.current) clearTimeout(defRollDoneTimeoutRef.current);
            const delayMs = isViewer ? 0 : PLAYER_ROLL_RESULT_VIEW_MS;
            defRollDoneTimeoutRef.current = setTimeout(() => {
              defRollDoneTimeoutRef.current = null;
              setDefRollDone(true);
            }, delayMs);
          }}
          atkRollDone={atkRollDone}
          defRollDone={defRollDone}
          defendReady={defendReady}
          resolveReady={resolveReady}
          isViewer={isViewer}
          critEligible={critEligible}
          critReady={critReady}
          critWinFaces={turn?.critWinFaces?.length ? turn.critWinFaces : critRef.current.winFaces}
          critRollResult={critRollResult}
          onCritRollResult={handleCritRollResult}
          onCritRollStart={handleCritRollStart}
          onCritReplayEnd={onCritReplayEnd}
          chainEligible={chainEligible}
          chainReady={chainReady}
          chainWinFaces={chainRef.current.winFaces}
          chainRollResult={chainRollResult}
          onChainRollResult={handleChainRollResult}
          onChainRollStart={handleChainRollStart}
          onChainReplayEnd={onChainReplayEnd}
          dodgeEligible={dodgeEligible}
          dodgeReady={dodgeReady}
          dodgeWinFaces={dodgeRef.current.winFaces}
          dodgeRollResult={dodgeRollResult}
          onDodgeRollResult={handleDodgeRollResult}
          onDodgeRollStart={handleDodgeRollStart}
          onDodgeReplayEnd={onDodgeReplayEnd}
          coAttackCaster={pomCoCasterFighter}
          isMyPomegranateCoAttack={isMyPomegranateCoAttack}
          pomCoAtkBuffMod={
            turn?.coAttackerId
              ? getStatModifier(battle.activeEffects || [], turn.coAttackerId, MOD_STAT.ATTACK_DICE_UP)
              : 0
          }
          atkBuffMod={getStatModifier(battle.activeEffects || [], turn.attackerId, MOD_STAT.ATTACK_DICE_UP)}
          defBuffMod={turn.defenderId ? getStatModifier(battle.activeEffects || [], turn.defenderId, MOD_STAT.DEFEND_DICE_UP) : 0}
          skeletonHitActive={!!(transientSkeletonCard || activePlaybackStep?.isMinionHit)}
        />
      )}

      {/* Resolve bar (hidden for Shadow Camouflage D4 — we show D4 roll only) */}
      {showResolve && !shadowCamouflageD4 && (() => {
        if (transientSkeletonCard && !activePlaybackStep) {
          const sk = transientSkeletonCard as { attackerName?: string; damage?: number };
          return (
            <div className={`bhud__resolve bhud__resolve--power ${resolveExiting ? 'bhud__resolve--exit' : ''}`}>
              <div className="bhud__resolve-info">
                <span className="bhud__resolve-power-name">{sk.attackerName ?? 'Skeleton'}</span>
                <span className="bhud__resolve-dmg">-{sk.damage ?? 0} DMG</span>
              </div>
            </div>
          );
        }
        const rc = activePlaybackStep
          ? { ...resolveCache.current, ...activePlaybackStep }
          : resolveCache.current;
        // Beyond the Nimbus: never show power name in resolve bar (treat as normal attack)
        const hidePowerNameForNimbus = turn?.usedPowerName === POWER_NAMES.BEYOND_THE_NIMBUS;
        const showPowerName = rc.isPower && rc.powerName && !hidePowerNameForNimbus;
        if (activePlaybackStep?.isMinionHit) {
          return (
            <div className={`bhud__resolve bhud__resolve--power ${resolveExiting ? 'bhud__resolve--exit' : ''}`}>
              <div className="bhud__resolve-info">
                <span className="bhud__resolve-power-name">{activePlaybackStep.attackerName}</span>
                <span className="bhud__resolve-dmg">-{activePlaybackStep.damage} DMG</span>
              </div>
            </div>
          );
        }
        if (rc.isPower && rc.atkRoll === 0 && !hidePowerNameForNimbus) {
          return (
            <div className={`bhud__resolve bhud__resolve--power ${resolveExiting ? 'bhud__resolve--exit' : ''}`}>
              <div className="bhud__resolve-info">
                <span className="bhud__resolve-power-name">{rc.powerName}</span>
              </div>
            </div>
          );
        }
        // No defendable (e.g. Soul Devourer drain): resolve bar without dice
        if (rc.soulDevourerDrain) {
          return (
            <div className={`bhud__resolve bhud__resolve--power ${resolveExiting ? 'bhud__resolve--exit' : ''}`}>
              <div className="bhud__resolve-info">
                {rc.powerName && <span className="bhud__resolve-power-name">{rc.powerName}</span>}
                <span className="bhud__resolve-dmg">-{rc.damage} DMG</span>
              </div>
            </div>
          );
        }
        return (
          <div className={`bhud__resolve ${rc.isHit ? '' : 'bhud__resolve--miss'} ${showPowerName ? 'bhud__resolve--power' : ''} ${resolveExiting ? 'bhud__resolve--exit' : ''}`}>
            <div className="bhud__resolve-info">
              {showPowerName && (
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
                      <span className="bhud__resolve-crit-roll">
                        {rc.critRollLabel ?? (() => {
                          const ae = battle.activeEffects || [];
                          const critBuff = getStatModifier(ae, turn?.attackerId ?? '', MOD_STAT.CRITICAL_RATE);
                          const effectiveCrit = Math.max(attacker?.criticalRate ?? 0, (attacker?.criticalRate ?? 0) + critBuff);
                          if (effectiveCrit >= 100) return 'D4: auto';
                          return rc.critRoll > 0 ? `D4: ${rc.critRoll}` : 'D4: -';
                        })()}
                      </span>
                      <span className="bhud__resolve-crit-sep">-</span>
                      <span className="bhud__resolve-crit-text">{rc.isCrit ? 'CRIT!' : 'NO CRIT'}</span>
                    </span>
                  )}
                  <span className="bhud__resolve-dmg">{showPowerName ? 'INVOKED!' : `-${rc.damage} DMG`}</span>
                </>
              ) : (
                <span className="bhud__resolve-miss">{showPowerName ? 'RESISTED!' : 'BLOCKED!'}</span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Pomegranate co-attack: separate ATK vs DEF bar (own log line) */}
      {pomegranateCoResolve && turn?.phase === PHASE.RESOLVING && !shadowCamouflageD4 && (() => {
        const rc = pomegranateCoResolve;
        const showPowerNameCo = rc.isPower && !!rc.powerName;
        return (
          <div className={`bhud__resolve ${rc.isHit ? '' : 'bhud__resolve--miss'} ${showPowerNameCo ? 'bhud__resolve--power' : ''}`}>
            <div className="bhud__resolve-info">
              {showPowerNameCo && (
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
                <span className="bhud__resolve-dmg">-{rc.damage} DMG</span>
              ) : (
                <span className="bhud__resolve-miss">{showPowerNameCo ? 'RESISTED!' : 'BLOCKED!'}</span>
              )}
            </div>
          </div>
        );
      })()}

      {activePlaybackStep && (() => {
        const cardData = { ...resolveCache.current, ...activePlaybackStep, side: activePlaybackStep.__side } as any;
        if (cardData.powerName === POWER_NAMES.KERAUNOS_VOLTAGE) {
          cardData.isCritForKeraunos = !!cardData.isCrit;
          if (cardData.keraunosDamageTier == null) cardData.keraunosDamageTier = 0;
        }
        if (cardData.powerName === POWER_NAMES.JOLT_ARC && !cardData.baseDmg && attacker) {
          cardData.baseDmg = Math.max(0, attacker.damage + getStatModifier(battle.activeEffects || [], turn?.attackerId ?? '', MOD_STAT.DAMAGE));
        }
        return (
          <DamageCard
            key={activePlaybackStep.__cardKey}
            data={cardData}
            exiting={false}
            side={activePlaybackStep.__side}
            displayMs={activePlaybackStep.__displayMs}
            onDisplayComplete={() => {
              if (turn?.phase !== PHASE.RESOLVING) return;
              completedPlaybackStepKeyRef.current = activePlaybackStep.__cardKey;
              setActivePlaybackStep(null);
              activePlaybackStepKeyRef.current = null;
              if (!isPlaybackDriver) return;
              setPlaybackPendingAck(true);
              if (playbackAckTimerRef.current != null) clearTimeout(playbackAckTimerRef.current);
              playbackAckTimerRef.current = window.setTimeout(() => {
                playbackAckTimerRef.current = null;
                if (turn?.phase !== PHASE.RESOLVING) return;
                onResolve();
              }, 60);
            }}
          />
        );
      })()}

      {/* Damage breakdown card — on defender side. Volley arrow VFX uses volleyArrowHitActive in Arena only; do not unmount this card when the arrow ends or it flashes off then on for the full displayMs. */}
      {!activePlaybackStep &&
        !playbackStep &&
        !playbackPendingAck &&
        showMasterDamageCard &&
        turn?.phase === PHASE.RESOLVING &&
        (() => {
        const masterCardData = { ...resolveCache.current };
        if (masterCardData.powerName === POWER_NAMES.JOLT_ARC && !masterCardData.baseDmg && attacker) {
          masterCardData.baseDmg = Math.max(0, attacker.damage + getStatModifier(battle.activeEffects || [], turn?.attackerId ?? '', MOD_STAT.DAMAGE));
        }
        return (
          <DamageCard
            key={masterDamageCardKey}
            data={masterCardData}
            exiting={false}
            side={resolveCache.current.side}
            displayMs={masterResolveDisplayMs}
            onDisplayComplete={handleMasterDamageCardComplete}
          />
        );
      })()}

      {pomegranateCoResolve && turn?.phase === PHASE.RESOLVING && !activePlaybackStep && (
        <DamageCard
          key={`pom-co-${battle.roundNumber}-${battle.currentTurnIndex}-${String((pomegranateCoResolve as ResolveCacheRow).attackerId ?? '')}-${String((pomegranateCoResolve as ResolveCacheRow).defenderId ?? '')}`}
          data={pomegranateCoResolve as any}
          exiting={false}
          side={pomegranateCoResolve.side}
          displayMs={MINION_RESOLVE_DISPLAY_MS}
          onDisplayComplete={() => {
            setPomegranateCoResolve(null);
            if (!isPlaybackDriver) return;
            const rkTail = `${battle.roundNumber}|${battle.currentTurnIndex}|${turn.attackerId}|${turn.defenderId ?? ''}|${(turn as any)?.resolvingHitIndex ?? 0}|pom-clear`;
            void Promise.resolve(onResolve())
              .catch(() => {})
              .finally(() => {
                playbackRequestKeyRef.current = rkTail;
              });
          }}
        />
      )}

      {/* Transient DamageCard for minion/skeleton hits — show whenever we have skeleton card data during resolve (buffer drives card+hit) */}
      {transientSkeletonCard && turn?.phase === PHASE.RESOLVING && !activePlaybackStep && (
        <DamageCard
          key={transientSkeletonCardKey || 'transient-minion-card'}
          data={transientSkeletonCard as any}
          exiting={false}
          side={(transientSkeletonCard as any).side}
          displayMs={MINION_RESOLVE_DISPLAY_MS}
          onDisplayComplete={() => skeletonCardCompleteRef.current?.()}
        />
      )}

      {/* Rapid Fire extra shot: arrow VFX is separate; card stays mounted for full displayMs then onDisplayComplete advances. */}
      {turn?.phase === PHASE.RESOLVING_RAPID_FIRE_EXTRA_SHOT && (() => {
        const dmg = Number((turn as any).rapidFireExtraShotDamage) ?? 0;
        const baseDmg = Number((turn as any).rapidFireExtraShotBaseDmg) ?? 0;
        const isCrit = !!(turn as any).rapidFireExtraShotIsCrit;
        const rapidFireAtk = attacker ?? find(teamA, teamB, turn.attackerId);
        const rapidFireDef = defender ?? find(teamA, teamB, turn.defenderId ?? '');
        const casterSide = turn.attackerTeam === BATTLE_TEAM.A ? PANEL_SIDE.RIGHT : PANEL_SIDE.LEFT;
        const cardData = {
          isHit: true,
          isPower: true,
          powerName: POWER_NAMES.VOLLEY_ARROW,
          isCrit,
          baseDmg,
          damage: dmg,
          shockBonus: 0,
          atkRoll: 0,
          isDodged: false,
          coAttackHit: false,
          coAttackDamage: 0,
          attackerName: rapidFireAtk?.nicknameEng ?? '',
          attackerTheme: rapidFireAtk?.theme?.[0] ?? '#666',
          defenderName: rapidFireDef?.nicknameEng ?? '',
          defenderTheme: rapidFireDef?.theme?.[0] ?? '#666',
        };
        return (
          <DamageCard
            key="rapid-fire-extra-shot-dmg"
            data={cardData}
            exiting={false}
            side={casterSide}
            displayMs={MINION_RESOLVE_DISPLAY_MS}
            onDisplayComplete={onRapidFireDamageCardComplete}
          />
        );
      })()}

      {/* Turn skipped (no valid target) — same style as DamageCard, on attacker side */}
      {skipCard && (
        <div className={`bhud__dice-zone bhud__dice-zone--${skipCard.side}`}>
          <div className="dmg-card dmg-card--power" style={{ '--card-atk': skipCard.attackerTheme, '--card-def': '#666' } as React.CSSProperties}>
            <div className="dmg-card__header">
              <span className="dmg-card__atkname" style={{ color: skipCard.attackerTheme }}>{skipCard.attackerName}</span>
            </div>
            <span className="dmg-card__power">No valid target</span>
            <span className="dmg-card__invoked">Turn skipped</span>
          </div>
        </div>
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
          const atkName = atkFighter?.nicknameEng ?? (entry as any).attackerName ?? '???';
          const defName = defFighter?.nicknameEng ?? (entry as any).defenderName ?? '???';
          const atkColor = atkFighter?.theme[0] ?? (entry as any).attackerTheme;
          const defColor = defFighter?.theme[0] ?? (entry as any).defenderTheme;

          if ((entry as any).skippedNoValidTarget) {
            return (
              <div className="bhud__log-entry bhud__log-entry--skip" key={i}>
                <span className="bhud__log-round">R{entry.round}</span>
                <span className="bhud__log-name" style={atkColor ? { color: atkColor } : undefined}>{atkName}</span>
                <span className="bhud__log-sep">—</span>
                <span className="bhud__log-skip">Skip turn</span>
                {(entry as any).skipReason === POWER_NAMES.SHADOW_CAMOUFLAGING && (
                  <span className="bhud__log-skip-reason">(no valid target)</span>
                )}
              </div>
            );
          }

          if ((entry as any).beyondTheNimbus) {
            return (
              <div className="bhud__log-entry bhud__log-entry--nimbus" key={i}>
                <span className="bhud__log-round">R{entry.round}</span>
                <span className="bhud__log-name" style={atkColor ? { color: atkColor } : undefined}>{atkName}</span>
                <span className="bhud__log-power">Beyond the Nimbus</span>
              </div>
            );
          }

          if (entry.powerUsed === POWER_NAMES.FLORAL_FRAGRANCE && entry.heal === 0 && (entry as any).healSkipReason) {
            const skipReasonLabel = (entry as any).healSkipReason === EFFECT_TAGS.HEALING_NULLIFIED ? 'Healing Nullified' : (entry as any).healSkipReason;
            return (
              <div className="bhud__log-entry bhud__log-entry--skip" key={i}>
                <span className="bhud__log-round">R{entry.round}</span>
                <span className="bhud__log-name" style={atkColor ? { color: atkColor } : undefined}>{atkName}</span>
                <span className="bhud__log-power">{entry.powerUsed}</span>
                <span className="bhud__log-sep">→</span>
                <span className="bhud__log-name" style={defColor ? { color: defColor } : undefined}>{defName}</span>
                <span className="bhud__log-skip">Heal skipped</span>
                <span className="bhud__log-skip-reason">({skipReasonLabel})</span>
              </div>
            );
          }

          if (entry.powerUsed === 'Ephemeral Season: Spring' && entry.heal === 0 && (entry as any).healSkipReason) {
            const skipReasonLabel = (entry as any).healSkipReason === EFFECT_TAGS.HEALING_NULLIFIED ? 'Healing Nullified' : (entry as any).healSkipReason;
            return (
              <div className="bhud__log-entry bhud__log-entry--skip" key={i}>
                <span className="bhud__log-round">R{entry.round}</span>
                <span className="bhud__log-name" style={atkColor ? { color: atkColor } : undefined}>{atkName}</span>
                <span className="bhud__log-power">{entry.powerUsed}</span>
                <span className="bhud__log-sep">→</span>
                <span className="bhud__log-name" style={defColor ? { color: defColor } : undefined}>{defName}</span>
                <span className="bhud__log-skip">Heal skipped</span>
                <span className="bhud__log-skip-reason">({skipReasonLabel})</span>
              </div>
            );
          }

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
                  <span>
                    {atkName} hit {defName}
                    {(entry.damage ?? 0) > 0 ? (
                      <> for <span className="bhud__log-hit">{entry.damage} dmg</span></>
                    ) : null}
                  </span>
                )}
                {entry.eliminated && <span className="bhud__log-ko">KO!</span>}
              </div>
            );
          }

          if (entry.powerUsed) {
            const power = atkFighter ? getPowers(atkFighter.deityBlood).find((p: { name: string }) => p.name === entry.powerUsed) : undefined;
            const isSelfTarget = power?.target === TARGET_TYPES.SELF;
            const isSeasonPower = entry.powerUsed === POWER_NAMES.EPHEMERAL_SEASON || entry.powerUsed?.startsWith?.('Ephemeral Season:');
            const pendingTarget = !!(entry as any).pendingTarget;
            const logSelfTarget = entry.attackerId === entry.defenderId;
            const noTarget = isSelfTarget || isSeasonPower || pendingTarget || logSelfTarget;
            return (
              <div className="bhud__log-entry bhud__log-entry--power" key={i}>
                <span className="bhud__log-round">R{entry.round}</span>
                <span className="bhud__log-name" style={atkColor ? { color: atkColor } : undefined}>{atkName}</span>
                <span className="bhud__log-power">{entry.powerUsed}</span>
                {!noTarget && (
                  <>
                    <span className="bhud__log-sep">→</span>
                    <span className="bhud__log-name" style={defColor ? { color: defColor } : undefined}>{defName}</span>
                  </>
                )}
                {entry.heal != null && entry.heal > 0 ? (
                  <>
                    <span className="bhud__log-sep">—</span>
                    <span className="bhud__log-heal">
                      +{entry.heal} heal{entry.floralHealCrit ? ' · CRIT' : ''}
                    </span>
                  </>
                ) : entry.damage > 0 ? (
                  <span className="bhud__log-hit">{entry.damage} dmg</span>
                ) : entry.isDodged && !noTarget ? (
                  <>
                    <span className="bhud__log-sep">—</span>
                    <span>Dodged</span>
                  </>
                ) : entry.missed && !noTarget ? (
                  <>
                    <span className="bhud__log-sep">—</span>
                    <span>{defName} blocked {atkName}</span>
                  </>
                ) : !noTarget && (entry.damage ?? 0) > 0 ? (
                  <>
                    <span className="bhud__log-sep">—</span>
                    <span className="bhud__log-hit">{entry.damage} dmg</span>
                  </>
                ) : !noTarget &&
                  !(entry.damage ?? 0) &&
                  !entry.isDodged &&
                  !entry.missed &&
                  power?.skipDice ? (
                  <>
                    <span className="bhud__log-sep">—</span>
                    <span className="bhud__log-applied">Applied</span>
                  </>
                ) : null}
                {entry.eliminated && <span className="bhud__log-ko">KO!</span>}
              </div>
            );
          }

          // No defendable (e.g. Soul Devourer drain): log without dice
          if ((entry as any).soulDevourerDrain) {
            return (
              <div className="bhud__log-entry bhud__log-entry--no-dice" key={i}>
                <span className="bhud__log-round">R{entry.round}</span>
                <span className="bhud__log-name" style={atkColor ? { color: atkColor } : undefined}>{atkName}</span>
                <span className="bhud__log-sep">→</span>
                <span className="bhud__log-name" style={defColor ? { color: defColor } : undefined}>{defName}</span>
                <span className="bhud__log-sep">—</span>
                {entry.isDodged ? (
                  <span>Dodged</span>
                ) : entry.missed ? (
                  <span>{defName} blocked {atkName}</span>
                ) : (
                  <span>
                    {atkName} hit {defName}
                    {(entry.damage ?? 0) > 0 ? (
                      <> for <span className="bhud__log-hit">{entry.damage} dmg</span></>
                    ) : null}
                  </span>
                )}
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
              {entry.isDodged ? (
                <span>Dodged</span>
              ) : entry.missed ? (
                <span>{defName} blocked {atkName}</span>
              ) : (
                <span>
                  {atkName} hit {defName}
                  {(entry.damage ?? 0) > 0 ? (
                    <> for <span className="bhud__log-hit">{entry.damage} dmg</span></>
                  ) : null}
                </span>
              )}
              {entry.eliminated && <span className="bhud__log-ko">KO!</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
