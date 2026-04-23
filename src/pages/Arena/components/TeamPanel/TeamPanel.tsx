import type { RefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BattlePlaybackStep, BattleState, FighterState } from '../../../../types/battle';
import { buildBattlePlaybackEventKey } from '../../../../types/battle';
import { Minion } from '../../../../types/minions';
import { getStatModifier } from '../../../../services/powerEngine/powerEngine';
import { getTagBasedChipProps, getEffectDisplayNameForTag } from '../../../../data/powerVfxRegistry';
import MemberChip from './MemberChip/MemberChip';
import type { EffectPip } from './MemberChip/MemberChip';
import { EFFECT_TAGS, IMPRECATED_POEM_VERSE_TAGS } from '../../../../constants/effectTags';
import { POWER_NAMES, POWER_TYPES } from '../../../../constants/powers';
import { BATTLE_TEAM, effectivePomCoAttackerId, PANEL_SIDE, PHASE, TURN_ACTION, type PanelSide } from '../../../../constants/battle';
import { MOD_STAT, TARGET_TYPES } from '../../../../constants/effectTypes';
import './TeamPanel.scss';
import { SKILL_UNLOCKED } from '../../../../constants/character';
import { CHARACTER } from '../../../../constants/characters';

interface Props {
  isPracticeRoom?: boolean;
  members: FighterState[];
  allMembers?: FighterState[];
  side: PanelSide;
  battle?: BattleState;
  myId?: string;
  teamMinions?: Minion[];
  /** True when BattleHUD's resolve panel is visible (after crit/chain checks) */
  resolveShown?: boolean;
  /** True while transient damage/skeleton playback is active — used to suppress chained visuals */
  transientEffectsActive?: boolean;
  /** True 2.5s after RESOLVING with Soul Devourer drain so heal shows after master damage card */
  soulDevourerHealReady?: boolean;
  /** Ref to attach to caster's frame so soul float can target its center (Soul Devourer) */
  casterFrameRef?: RefObject<HTMLDivElement | null>;
  /** Ref to attach to defender's frame so soul float starts from target center (Soul Devourer) */
  defenderFrameRef?: RefObject<HTMLDivElement | null>;
  /** Optional map of transient minion pulse ids keyed by defenderId (from Arena) — used for log playback (main/co-attack hit) */
  minionPulseMap?: Record<string, number>;
  /** Skeleton buffer (pre-demo): current hit target from skeleton card; drives master hit VFX without pulse map */
  currentSkeletonHitTargetId?: string | null;
  currentSkeletonPulseKey?: number;
  onSelectTarget?: (defenderId: string) => void;
  /** Optional client-side visual override for NPC target selection */
  clientVisualDefenderId?: string | null;
  clientVisualPowerName?: string | null;
  /** True briefly when user clicks Back from target modal — prevents opposite mchip__frame shake */
  suppressHitAfterBack?: boolean;
  /** True when Floral Heal D4 result card is visible (so healing VFX shows in sync with "Normal Heal" / "Heal x2") */
  floralHealResultCardVisible?: boolean;
  /** True while Volley Arrow hit VFX (arrow + impact) is active. */
  volleyArrowHitActive?: boolean;
  /** CharacterId of the Volley Arrow hit defender (target). When set, TeamPanel passes isVolleyArrowHitDefender to the matching chip. */
  volleyArrowHitDefenderId?: string | null;
  /** CharacterId of the Volley Arrow hit attacker (caster). When set, TeamPanel passes isVolleyArrowHitAttacker to the matching chip. */
  volleyArrowHitAttackerId?: string | null;
  /** True while pomegranate co-attack resolve card is showing (even if phase changed) — allows transient hit effects */
  pomegranateCoResolveActive?: boolean;
  /** When true, Nemesis reattack VFX is active. TeamPanel passes derived props to chips. */
  nemesisReattackActive?: boolean;
}

function buildPanelBg(members: FighterState[]): React.CSSProperties | undefined {
  if (!members.length) return undefined;

  const colors = members.map((m) => m.theme[0]);
  const stops = colors.map(
    (c) => `color-mix(in srgb, ${c} 12%, transparent)`,
  );
  const gradient =
    stops.length === 1
      ? `linear-gradient(var(--tp-dir, 180deg), ${stops[0]} 0%, transparent 100%)`
      : `linear-gradient(var(--tp-dir, 90deg), ${stops.join(', ')})`;

  return {
    background: `${gradient}`,
  };
}

export default function TeamPanel({ isPracticeRoom, members, allMembers, side, battle, myId, teamMinions, resolveShown, transientEffectsActive, soulDevourerHealReady, casterFrameRef, defenderFrameRef, minionPulseMap, currentSkeletonHitTargetId, currentSkeletonPulseKey, onSelectTarget, clientVisualDefenderId, clientVisualPowerName, suppressHitAfterBack, floralHealResultCardVisible, volleyArrowHitActive, volleyArrowHitDefenderId, volleyArrowHitAttackerId, pomegranateCoResolveActive, nemesisReattackActive }: Props) {
  const turn = battle?.turn;
  const activeEffects = useMemo(() => battle?.activeEffects || [], [battle?.activeEffects]);
  const suppressPracticeVfx = !!isPracticeRoom;

  // Suppress hit visuals for a short window after leaving the select-target
  // phase to avoid accidental frame shakes when the player cancels/back out
  // of the target modal (race between UI and transient markers).
  const prevPhaseRef = useRef<string | undefined>(undefined);
  const [suppressHitAfterSelect, setSuppressHitAfterSelect] = useState(false);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    const curr = turn?.phase;
    if (prev === PHASE.SELECT_TARGET && curr !== PHASE.SELECT_TARGET) {
      setSuppressHitAfterSelect(true);
      const t = setTimeout(() => setSuppressHitAfterSelect(false), 400);
      return () => clearTimeout(t);
    }
    prevPhaseRef.current = curr;
  }, [turn?.phase]);

  // This panel's team is the opposite side's target pool
  const isOpposingTeam = turn && (
    (side === PANEL_SIDE.LEFT && turn.attackerTeam === BATTLE_TEAM.B) ||
    (side === PANEL_SIDE.RIGHT && turn.attackerTeam === BATTLE_TEAM.A)
  );
  // Disoriented: player must use modal (Random → Confirm); do not allow picking target by clicking panel
  const hasDisorientedOnAttacker = !!(turn?.attackerId && activeEffects.some((e: { targetId?: string; tag?: string }) => e.targetId === turn.attackerId && e.tag === EFFECT_TAGS.DISORIENTED));
  const canSelectTarget = turn?.phase === PHASE.SELECT_TARGET && turn.attackerId === myId && isOpposingTeam && !hasDisorientedOnAttacker;

  // Build a lookup map: characterId → FighterState (for effect pip source themes)
  const fighterMap = useMemo(() => {
    const map = new Map<string, FighterState>();
    for (const f of (allMembers || members)) map.set(f.characterId, f);
    return map;
  }, [allMembers, members]);

  // Demo mode: effect pip source on the opposite panel shows as "Left" or "Right" (panel side), not fighter name
  const isDemo = !!(battle as { _demoVfxKey?: string })?._demoVfxKey;
  const oppositeMemberIds = useMemo(() => {
    if (!isDemo || !allMembers?.length || !members?.length) return new Set<string>();
    const memberIds = new Set(members.map((m) => m.characterId));
    return new Set(allMembers.filter((f) => !memberIds.has(f.characterId)).map((f) => f.characterId));
  }, [isDemo, allMembers, members]);

  // Build minions list: for each main fighter, if they have any minions in allMembers, include them right after the main fighter
  const minionsMap = useMemo(() => {
    const map = new Map<string, Minion[]>();
    // Find the correct team (side)
    const teamKey = side === PANEL_SIDE.LEFT ? BATTLE_TEAM.A : BATTLE_TEAM.B;
    // Prefer explicit room/team-level minions (passed via `teamMinions`), fall back to legacy battle-level storage
    // @ts-ignore: minions may be undefined in some legacy battles or formats
    const minions = (teamMinions || (battle && (battle as any)[teamKey]?.minions) || []) as any[];
    for (const minion of minions) {
      // Only process if minion has masterId (i.e., is a minion, not a main fighter)
      if (typeof minion === 'object' && 'masterId' in minion && minion.masterId) {
        if (!map.has(minion.masterId)) map.set(minion.masterId, []);
        map.get(minion.masterId)!.push(minion);
      }
    }
    return map;
  }, [battle, side, teamMinions]);

  // Build turn order map: characterId → 1-based position in turn queue
  const turnOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!battle?.turnQueue) return map;
    let order = 1;
    for (const entry of battle.turnQueue) {
      const f = fighterMap.get(entry.characterId);
      if (f && f.currentHp > 0) {
        map.set(entry.characterId, order++);
      }
    }
    return map;
  }, [battle?.turnQueue, fighterMap]);

  // (attack landed computation removed — currently unused)

  // Apply 'team-panel--full' when either team has 3+ members
  const thisTeamCount = members.length;
  const otherTeamCount = (allMembers?.length ?? members.length) - members.length;
  const shouldUseFull = thisTeamCount >= 3 || otherTeamCount >= 3;

  return (
    <div
      className={`team-panel team-panel--${side} ${shouldUseFull ? 'team-panel--full' : ''}`}
      data-count={members.length}
      style={{
        ...buildPanelBg(members),
        '--member-count': members.length,
      } as React.CSSProperties}
    >
      {members.map((m) => {
        // Who is shown as "target" (defender): the one actually targeted, not the skeleton that dealt the hit.
        // Prefer turn-level visualDefenderId (selection), then client NPC override, then during RESOLVING
        // use lastHitTargetId (the defender who was hit) — never lastHitMinionId (skeleton/attacker).
        const visualDefenderId = (turn as any)?.visualDefenderId ?? (clientVisualDefenderId ?? ((turn?.phase === PHASE.RESOLVING || resolveShown) ? (battle as any)?.lastHitTargetId : undefined));
        const isAttacker = turn?.attackerId === m.characterId;
        const pomCoAtkSpotlight = turn ? effectivePomCoAttackerId(turn) : undefined;
        const isPomCoCaster = pomCoAtkSpotlight != null && pomCoAtkSpotlight === m.characterId;

        // Check if this master has any minions (skeletons)
        const masterMinions = minionsMap.get(m.characterId) || [];
        const hasMasterMinions = masterMinions.length > 0;

        // Show defender badge on the master ONLY if they don't have minions (otherwise minion shows it)
        const isDefender = !hasMasterMinions && (turn?.defenderId === m.characterId);
        // Defer eliminated state for current defender while minion/skeleton hit effects are still playing
        const isEliminated = m.currentHp <= 0 && !(transientEffectsActive && turn?.defenderId === m.characterId);
        // Shadow Camouflaging: immune to single-target actions; area attacks bypass (no target selection for area)
        const isShadowCamouflaged = activeEffects.some(
          e => e.targetId === m.characterId && e.modStat === MOD_STAT.SHADOW_CAMOUFLAGED,
        );
        const isAreaAttack = !!(turn?.phase === PHASE.SELECT_TARGET && turn?.action === TURN_ACTION.POWER && turn?.usedPowerIndex != null && (() => {
          const atk = fighterMap.get(turn.attackerId!);
          const p = atk?.powers?.[turn.usedPowerIndex!];
          return p?.target === TARGET_TYPES.AREA;
        })());
        const isTargetable = !suppressPracticeVfx && !!(canSelectTarget && !isEliminated && (!isShadowCamouflaged || isAreaAttack));
        const isSpotlight =
          (isAttacker &&
            (turn?.phase === PHASE.SELECT_TARGET || turn?.phase === PHASE.ROLLING_ATTACK)) ||
          (isPomCoCaster && turn?.phase === PHASE.ROLLING_POMEGRANATE_CO_ATTACK) ||
          (isDefender &&
            (turn?.phase === PHASE.ROLLING_DEFEND || turn?.phase === PHASE.ROLLING_POMEGRANATE_CO_DEFEND));

        const log = battle?.log;
        const lastEntry = log && log.length > 0 ? log[log.length - 1] : undefined;
        const isCrit = !!(lastEntry?.isCrit && lastEntry.attackerId === m.characterId);

        // Hit effect: only when attack actually landed (not blocked)
        // AoE path: only for skipDice powers whose log was already written (check attackerId matches)
        const isAoeHit = !!(
          resolveShown && turn?.phase === PHASE.RESOLVING &&
          lastEntry?.attackerId === turn?.attackerId &&
          lastEntry?.aoeDamageMap?.[m.characterId]
        );
        // Master should NOT show hit effect if they have minions (skeleton shows hit instead)
        // Ignore transient lastHitTargetId while selecting a target (prevents false hit flash)
        // Only consider a transient hit if the persistent log's last entry
        // indicates this defender was hit (not missed). This prevents false
        // hit flashes caused by transient markers that may be set earlier.
        // Only consider a persistent log entry a "hit" if it's not flagged as missed
        // and either has positive damage or is a minion hit marker. This avoids
        // treating blocked (0 damage) entries as hits that trigger visuals.
        
        const playbackStep = (turn as any)?.playbackStep as BattlePlaybackStep | undefined;
        const playbackStepActive = !!playbackStep && turn?.phase === PHASE.RESOLVING;
        const playbackDrivenResolve = turn?.phase === PHASE.RESOLVING;
        const hasBufferedMinionPlayback = Array.isArray((battle as any)?.lastSkeletonHits) && (battle as any).lastSkeletonHits.length > 0;
        // Block hit visuals while selecting target and briefly when user clicks Back (no opposite frame shake).
        const allowHitVisuals = (
          turn?.phase !== PHASE.SELECT_TARGET &&
          turn?.phase !== PHASE.SELECT_SEASON &&
          turn?.phase !== PHASE.SELECT_ACTION &&
          turn?.phase !== PHASE.ROLLING_ATTACK &&
          turn?.phase !== PHASE.ROLLING_DEFEND &&
          turn?.phase !== PHASE.ROLLING_POMEGRANATE_CO_ATTACK &&
          turn?.phase !== PHASE.ROLLING_POMEGRANATE_CO_DEFEND
        ) && (m.skeletonCount ?? 0) <= 0
          && !suppressHitAfterSelect && !suppressHitAfterBack;
        const playbackHit = !!playbackStepActive && playbackStep?.defenderId === m.characterId;
        const playbackHitEventKey = (playbackHit && !playbackStep?.isMinionHit && playbackStep?.isHit !== false)
          ? buildBattlePlaybackEventKey(battle?.roundNumber ?? 0, battle?.currentTurnIndex ?? 0, playbackStep)
          : undefined;
        const playbackMainHit = !!playbackStepActive && !playbackStep?.isMinionHit && playbackStep?.defenderId === m.characterId && playbackStep?.isHit !== false;
        // Skeleton buffer: hit target from card drives defender hit VFX. Allow when resolving, buffer playing, or still in transient window (so phase change doesn't cut VFX — same as player hit).
        const isSkeletonCardHitTarget = currentSkeletonHitTargetId != null && String(currentSkeletonHitTargetId) === String(m.characterId) && (turn?.phase === PHASE.RESOLVING || hasBufferedMinionPlayback || !!transientEffectsActive);
        // Log playback (main/co-attack): pulse map drives hit VFX. Use string key so we match BattleHUD/Arena keys.
        const hasMinionHitPulse = minionPulseMap && minionPulseMap[String(m.characterId)] != null;
        const minionsForMember = minionsMap.get(m.characterId) || [];
        const hasMinionPulseInChip = !!(minionPulseMap && minionsForMember.some((min: { characterId: string }) => minionPulseMap[String(min.characterId)] != null));
        const shouldAllowLegacyMinionPulse = !!(
          (hasMinionHitPulse || isSkeletonCardHitTarget) &&
          (turn?.phase === PHASE.RESOLVING || turn?.phase === PHASE.RESOLVING_RAPID_FIRE_EXTRA_SHOT || (playbackStepActive && !!playbackStep?.isMinionHit) || hasBufferedMinionPlayback || !!transientEffectsActive || !!resolveShown)
        );
        // Only show hit effects on the opposing team (normal hits). For the
        // attacker's own side, only show hit effects for AoE/co-attack cases
        // where allies actually take damage.
        const isOpposing = !!(turn && ((side === PANEL_SIDE.LEFT && turn.attackerTeam === BATTLE_TEAM.B) || (side === PANEL_SIDE.RIGHT && turn.attackerTeam === BATTLE_TEAM.A)));
        const isHitFromTurn = !!(
          (isOpposing && (
            (allowHitVisuals && !playbackDrivenResolve && !playbackStepActive && !hasMasterMinions && isAoeHit)
          )) ||
          (!isOpposing && isAoeHit)
        );

        // Tag-based chip props from shared registry (single source of truth for effect → props)
        const tagBasedProps = getTagBasedChipProps(activeEffects, m.characterId);
        // Volley Arrow attacker = chip that has the Rapid Fire effect pip (caster of Volley Arrow)
        const hasRapidFireEffect = activeEffects.some((e: { targetId?: string; tag?: string }) => String(e.targetId) === String(m.characterId) && e.tag === EFFECT_TAGS.RAPID_FIRE);
        // When skeleton blocked: lastHitTargetId is the blocker (minion), so master must NOT show hit VFX
        const lastHitTargetId = (battle as any)?.lastHitTargetId;
        const hitLandedOnMyMinion = turn?.defenderId === m.characterId && lastHitTargetId &&
          masterMinions.some((min: { characterId: string }) => min.characterId === lastHitTargetId);
        // Only show hit when this chip is the current turn's defender (or AoE in RESOLVING). After extra-shot chain ends (RESOLVING_AFTER_RAPID_FIRE) or when turn advances, previous defender must not show hit shake/VFX.
        const isCurrentDefenderOrAoeResolving = turn?.defenderId == null || turn?.defenderId === m.characterId || (!!isAoeHit && turn?.phase === PHASE.RESOLVING);
        const suppressHitAfterRapidFire = turn?.phase === PHASE.RESOLVING_AFTER_RAPID_FIRE && (turn?.defenderId === m.characterId || turn?.attackerId === m.characterId);
        // Last log line can be the rapid-fire extra shot; once we're past that (RESOLVING_AFTER_RAPID_FIRE or next turn), don't show hit on the defender of that entry so they don't keep shaking.
        const lastEntryIsRapidFireHitOnMe = !!(lastEntry && (lastEntry as { rapidFire?: boolean }).rapidFire === true && lastEntry.defenderId === m.characterId);
        const pastRapidFireChain = turn?.phase === PHASE.RESOLVING_AFTER_RAPID_FIRE || (turn?.phase !== PHASE.RESOLVING && turn?.phase !== PHASE.RESOLVING_RAPID_FIRE_EXTRA_SHOT);
        const suppressHitFromRapidFireLog = lastEntryIsRapidFireHitOnMe && pastRapidFireChain;
        const isHit = (isHitFromTurn || !!tagBasedProps.isHit) && !hitLandedOnMyMinion && isCurrentDefenderOrAoeResolving && !suppressHitAfterRapidFire && !suppressHitFromRapidFireLog && !isEliminated;

        // Shock hit: attacker has Lightning Reflex passive → electric zap on defender
        const attacker = turn?.attackerId ? fighterMap.get(turn.attackerId) : undefined;
        const hasLightningReflex = !suppressPracticeVfx && !!(
          attacker?.passiveSkillPoint === SKILL_UNLOCKED &&
          attacker.powers?.some(p => p.type === POWER_TYPES.PASSIVE && p.name === POWER_NAMES.LIGHTNING_SPARK)
        );
        const isShockHit = !suppressPracticeVfx && !isEliminated && (!!((isHit || playbackMainHit) && hasLightningReflex && turn?.defenderId === m.characterId)
          || !!tagBasedProps.isShockHit);

        // Keraunos Voltage hit: massive lightning strike effect
        const isKeraunosVoltageHit = !suppressPracticeVfx && !isEliminated && (!!(
          (isHit || playbackMainHit) && turn?.usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE
        ) || !!tagBasedProps.isKeraunosVoltageHit);

        // Jolt Arc hit: blue/white arc effect on targets when Jolt Arc is confirmed (not deceleration).
        // During effect phase (before log): show arc on shocked enemies so effect plays before skeleton destroy / damage.
        const isJoltArcAttackHit = !suppressPracticeVfx && !isEliminated && (!!( 
          (isHit && lastEntry?.powerUsed === POWER_NAMES.JOLT_ARC) ||
          (playbackMainHit && playbackStep?.powerName === POWER_NAMES.JOLT_ARC) ||
          (turn?.phase === PHASE.RESOLVING && turn?.usedPowerName === POWER_NAMES.JOLT_ARC && isOpposing && tagBasedProps.isShocked)
        ) || !!tagBasedProps.isJoltArcAttackHit);

        const isShocked = !suppressPracticeVfx && !isEliminated && tagBasedProps.isShocked;
        const hasJoltArcDeceleration = !suppressPracticeVfx && !isEliminated && tagBasedProps.hasJoltArcDeceleration;
        const isEfflorescenceMuse = !suppressPracticeVfx && !isEliminated && tagBasedProps.isEfflorescenceMuse;
        const hasPomegranateEffect = !suppressPracticeVfx && !isEliminated && tagBasedProps.hasPomegranateEffect;
        const isSpiritForm = !suppressPracticeVfx && !isEliminated && tagBasedProps.isSpiritForm;
        const hasSoulDevourer = !suppressPracticeVfx && !isEliminated && tagBasedProps.hasSoulDevourer;
        const hasBeyondNimbus = !suppressPracticeVfx && !isEliminated && tagBasedProps.hasBeyondNimbus;
        const hasResurrectedSelf = activeEffects.some(
          (e) =>
            String(e.targetId) === String(m.characterId) &&
            e.tag === EFFECT_TAGS.RESURRECTED &&
            (e.turnsRemaining == null || e.turnsRemaining > 0),
        );
        const hasResurrectedAlly = activeEffects.some(
          (e) =>
            String(e.sourceId) === String(m.characterId) &&
            e.tag === EFFECT_TAGS.RESURRECTED &&
            String(e.targetId) !== String(m.characterId) &&
            (e.turnsRemaining == null || e.turnsRemaining > 0),
        );
        const hasDeathKeeper = !suppressPracticeVfx && !!tagBasedProps.hasDeathKeeper && !hasResurrectedSelf && !hasResurrectedAlly;
        const hasSunbornSovereign = !suppressPracticeVfx && ((m.powers ?? []).some((p: { name?: string }) => p.name === POWER_NAMES.SUNBORN_SOVEREIGN) || !!tagBasedProps.hasSunbornSovereign);
        const isResurrected = !suppressPracticeVfx && tagBasedProps.isResurrected;
        const isImprecatedPoemHealingNullified = !suppressPracticeVfx && !isEliminated && tagBasedProps.isImprecatedPoemHealingNullified;
        const isImprecatedPoemCursed = !suppressPracticeVfx && !isEliminated && tagBasedProps.isImprecatedPoemCursed;
        const imprecatedPoemVerseTags = isEliminated ? [] : (() => {
          const tags: string[] = [];
          const seen = new Set<string>();
          const charId = String(m.characterId);
          for (const e of activeEffects) {
            if (String(e.targetId) !== charId) continue;
            const verseTag =
              e.tag2 === EFFECT_TAGS.IMPRECATED_POEM
                ? e.tag
                : e.tag != null && IMPRECATED_POEM_VERSE_TAGS.includes(e.tag as (typeof IMPRECATED_POEM_VERSE_TAGS)[number])
                  ? e.tag
                  : undefined;
            if (verseTag != null && !seen.has(verseTag)) {
              seen.add(verseTag);
              tags.push(verseTag);
            }
          }
          return tags;
        })();

        // Active effect pips (deduplicate same power from same source; group by tag). Show ETERNAL_AGONY even when turnsRemaining is 0 (display-only, removed after 3s).
        // Hide effect pips on eliminated characters except for resurrection-related effects.
        const effectPips: EffectPip[] = (() => {
          if (suppressPracticeVfx) return [];
          if (isEliminated && !hasResurrectedSelf && !tagBasedProps.isResurrecting && !tagBasedProps.hasDeathKeeper) {
            return [];
          }
          const charId = String(m.characterId);
          const raw = activeEffects.filter(e => String(e.targetId) === charId && (e.turnsRemaining > 0 || e.tag === EFFECT_TAGS.ETERNAL_AGONY));
          const grouped = new Map<string, { count: number; maxTurns: number; sourceId: string; powerName: string; tag?: string }>();
          for (const e of raw) {
            const key = `${e.sourceId}:${e.powerName}:${e.tag ?? ''}`;
            const existing = grouped.get(key);
            if (existing) {
              existing.count++;
              existing.maxTurns = Math.max(existing.maxTurns, e.turnsRemaining);
            } else {
              grouped.set(key, { count: 1, maxTurns: e.turnsRemaining, sourceId: e.sourceId, powerName: e.powerName, tag: e.tag });
            }
          }
          const queueLen = battle?.turnQueue?.length || 1;
          return Array.from(grouped.values()).map(g => {
            const source = fighterMap.get(g.sourceId);
            const displayName = getEffectDisplayNameForTag(g.tag);
            const isSelfTarget = g.sourceId === m.characterId;
            const sourceName = isSelfTarget
              ? TARGET_TYPES.SELF
              : isDemo && oppositeMemberIds.has(g.sourceId)
                ? (side === PANEL_SIDE.LEFT ? PANEL_SIDE.RIGHT : PANEL_SIDE.LEFT)
                : (source?.nicknameEng || '?');
            const sourceNameTh = isSelfTarget
              ? TARGET_TYPES.SELF
              : isDemo && oppositeMemberIds.has(g.sourceId)
                ? (side === PANEL_SIDE.LEFT ? PANEL_SIDE.RIGHT : PANEL_SIDE.LEFT)
                : (source?.nicknameThai || undefined);
            const turnsLeft = g.tag === EFFECT_TAGS.ETERNAL_AGONY && g.maxTurns === 0
              ? 1
              : Math.ceil(g.maxTurns / queueLen);
            return {
              powerName: g.powerName,
              ...(displayName && { displayName }),
              sourceName,
              ...(sourceNameTh && { sourceNameTh }),
              ...(source?.deityBlood != null && { sourceDeity: source.deityBlood }),
              sourceTheme: source ? [source.theme[0], source.theme[1]] as [string, string] : ['#666', '#999'] as [string, string],
              turnsLeft,
              count: g.count,
              ...(g.tag && { tag: g.tag }),
            };
          });
        })().filter(
          (pip) => {
            if (
              pip.powerName === POWER_NAMES.UNDEAD_ARMY &&
              !hasMasterMinions &&
              (m.skeletonCount ?? 0) <= 0
            ) {
              return false;
            }
            // Death Keeper pip should disappear once resurrection has already happened
            // (self-resurrected, or this member already resurrected an ally).
            if (pip.powerName === POWER_NAMES.DEATH_KEEPER) {
              if (hasResurrectedSelf || hasResurrectedAlly) return false;
            }
            return true;
          },
        );

        // Resurrecting: mid-resurrection visual (self-resurrect overlay active), or from demo tag-based
        const isResurrecting = !suppressPracticeVfx && (
          !!(
            turn?.resurrectTargetId === m.characterId &&
            turn?.phase === PHASE.SELECT_ACTION
          ) || !!tagBasedProps.isResurrecting
        );

        // Floral Fragrance: brief trigger when just applied (real battle + demo)
        // Trigger from: (1) turn state when this member is the ally target, or (2) recent log entry.
        const rawRecent = Array.isArray(battle?.log) ? (battle!.log as any[]).slice(-24) : [];
        const floralSearchLog = rawRecent;
        const floralLogIndex = (() => {
          const powerName = (POWER_NAMES.FLORAL_FRAGRANCE as string).trim();
          const charId = String(m.characterId);
          for (let idx = floralSearchLog.length - 1; idx >= 0; idx--) {
            const le = floralSearchLog[idx];
            const pu = typeof le.powerUsed === 'string' ? le.powerUsed.trim() : '';
            if (pu !== powerName) continue;
            if (String(le.defenderId) !== charId) continue;
            return idx;
          }
          return -1;
        })();
        const floralHealFromLog = floralLogIndex >= 0 ? (floralSearchLog[floralLogIndex] as { heal?: number })?.heal ?? 0 : 0;
        /** Floral Fragrance: show VFX if entry is within the last 5 log entries to handle NPC auto-select + other logs */
        const floralIsRecentEntry = floralLogIndex >= 0 && floralLogIndex >= floralSearchLog.length - 5;

        // Ephemeral Season Spring: heal — same VFX as Floral Fragrance. Trigger from (1) log entry or (2) turn phase (caster in ROLLING_SPRING_HEAL just got heal1).
        const springLogIndex = (() => {
          const charId = String(m.characterId);
          for (let idx = floralSearchLog.length - 1; idx >= 0; idx--) {
            const le = floralSearchLog[idx] as { defenderId?: string; springHeal?: number; heal?: number; powerUsed?: string };
            if (String(le.defenderId) !== charId) continue;
            const isSpringEntry = le.springHeal != null || (typeof le.powerUsed === 'string' && le.powerUsed.includes('Spring') && (le.heal != null || le.springHeal != null));
            if (!isSpringEntry && le.springHeal == null && (le.heal == null || !String(le.powerUsed || '').includes('Spring'))) continue;
            return idx;
          }
          return -1;
        })();
        const springHealFromLog = springLogIndex >= 0 ? (floralSearchLog[springLogIndex] as { springHeal?: number; heal?: number })?.springHeal ?? (floralSearchLog[springLogIndex] as { heal?: number })?.heal ?? 0 : 0;
        const logHasSpring = springLogIndex >= 0 && springHealFromLog > 0;
        const battleSpringHeal1 = battle != null ? (battle as { springHeal1?: number }).springHeal1 : undefined;
        const isSpringCasterInPhase = turn?.phase === PHASE.ROLLING_SPRING_HEAL && String(turn.attackerId) === String(m.characterId);
        const springRound = (turn as any)?.springRound as number | undefined;
        const springCasterId = (battle as { springCasterId?: string })?.springCasterId;
        const battleSpringHeal2 = battle != null ? (battle as { springHeal2?: number | null }).springHeal2 : undefined;
        const springHealSkipAwaitsAck = !!(turn as any)?.springHealSkipAwaitsAck;
        // Round 2 = D4 roll for heal2 only; no heal applied this turn — do not show heal VFX for caster.
        const isSpringRound2Caster = springRound === 2 && String(m.characterId) === String(springCasterId);
        // Heal2 stored but not yet applied (we advanced after roll heal crit 2) — do not show heal VFX for caster until heal2 is applied in resolveTurn.
        const isSpringHeal2PendingCaster = battleSpringHeal2 != null && String(m.characterId) === String(springCasterId);
        // Skipped-heal modal is showing (e.g. Healing Nullified) — do not show heal VFX for caster until they ack.
        const isSpringHealSkipModalCaster = turn?.phase === PHASE.ROLLING_SPRING_HEAL && springHealSkipAwaitsAck && String(m.characterId) === String(springCasterId);
        const springFromPhase = isSpringCasterInPhase && battleSpringHeal1 != null && springRound !== 2 && !springHealSkipAwaitsAck;
        // Spring: show only when heal is the latest entry in log or in D4 phase — don't show again when starting next turn (last turn before Spring expires)
        const springHealIsLatestEntry = springLogIndex >= 0 && springLogIndex === floralSearchLog.length - 1;
        const useSpringForThisMember = !suppressPracticeVfx && logHasSpring && (springFromPhase || springHealIsLatestEntry) && (floralLogIndex < 0 || springLogIndex > floralLogIndex) && !isSpringRound2Caster && !isSpringHeal2PendingCaster && !isSpringHealSkipModalCaster;
        // Floral Fragrance: show VFX when entry is within last 3 logs (handles NPC auto-select) AND heal > 0
        const useFloralForThisMember = !suppressPracticeVfx && floralIsRecentEntry && floralHealFromLog > 0 && (springLogIndex < 0 || floralLogIndex > springLogIndex);

        // Apollo's Hymn: heal VFX on the healed target only (log defenderId); crit buff applies to caster too but no second heal VFX
        const hymnLogIndex = (() => {
          const powerName = (POWER_NAMES.APOLLO_S_HYMN as string).trim();
          const charId = String(m.characterId);
          for (let idx = floralSearchLog.length - 1; idx >= 0; idx--) {
            const le = floralSearchLog[idx] as { powerUsed?: string; defenderId?: string };
            const pu = typeof le.powerUsed === 'string' ? le.powerUsed.trim() : '';
            const isApolloHymn = pu === powerName || (pu.includes('Apollo') && pu.includes('Hymn'));
            if (!isApolloHymn) continue;
            if (String(le.defenderId) !== charId) continue;
            return idx;
          }
          return -1;
        })();
        // Only show hymn VFX when this entry is the most recent log entry (hymn just happened)
        const hymnIsLatestEntry = hymnLogIndex >= 0 && hymnLogIndex === floralSearchLog.length - 1;
        const logHasHymn = !suppressPracticeVfx && hymnIsLatestEntry;

        // Soul Devourer lifesteal: show +{n} HP on caster once after master damage card (soulDevourerHealReady), before skeleton hits.
        // Healing Nullified (Healing Loss): do not show heal VFX when receiver has the effect — actual heal is already 0 server-side.
        const soulDevourerHealFromLog = (() => {
          if (isEliminated) return null;
          const turnDrain = (turn as any)?.soulDevourerDrain && turn?.phase === PHASE.RESOLVING && turn?.attackerId === m.characterId;
          if (!turnDrain || !soulDevourerHealReady) return null;
          if (isImprecatedPoemHealingNullified) return null;
          const dmgBuff = getStatModifier(activeEffects, m.characterId, MOD_STAT.DAMAGE);
          const mainDmg = Math.max(0, (m.damage ?? 0) + dmgBuff);
          const amount = Math.ceil(mainDmg * 0.5);
          if (amount <= 0) return null;
          const r = (battle as any)?.roundNumber ?? 0;
          const ti = (battle as any)?.currentTurnIndex ?? 0;
          return { amount, key: `soul_devourer_heal_turn_${r}_${ti}_${m.characterId}` };
        })();

        const isFloralPowerInUse = typeof turn?.usedPowerName === 'string' && (turn.usedPowerName as string).trim() === (POWER_NAMES.FLORAL_FRAGRANCE as string).trim();
        const serverFragranceOnTarget = turn?.allyTargetId != null && String(turn.allyTargetId) === String(m.characterId) && isFloralPowerInUse;
        // Floral Heal D4: show fragrance only after dice roll result is in (animation ended), not during roll
        const floralHealRollDone = turn?.phase === PHASE.ROLLING_FLORAL_HEAL && serverFragranceOnTarget && (turn as { floralHealRoll?: number }).floralHealRoll != null;
        // isFloralHealTarget: only true while still in D4 phase (prevents hiding VFX after phase advances)
        const isFloralHealTarget = Boolean(serverFragranceOnTarget && turn?.phase === PHASE.ROLLING_FLORAL_HEAL);

        const isFragranceWaved = !suppressPracticeVfx && !isEliminated && (
          // Floral Fragrance: log-based (latest entry)
          (!!useFloralForThisMember && !isImprecatedPoemHealingNullified)
          // Floral Fragrance: live phase (D4 roll done AND result card visible so VFX shows with card)
          || (!!floralHealRollDone && floralHealResultCardVisible && !isImprecatedPoemHealingNullified)
          // Spring heal: same VFX as Floral Fragrance; requires latest entry or phase condition
          || (!!(springHealIsLatestEntry || springFromPhase) && !isSpringRound2Caster && !isSpringHeal2PendingCaster && !isSpringHealSkipModalCaster && !isImprecatedPoemHealingNullified && (springHealFromLog > 0 || (battleSpringHeal1 ?? 0) > 0))
        );

        const isHymnWaved = !suppressPracticeVfx && !isEliminated && (!!logHasHymn || !!tagBasedProps.isHymnWaved) && !isImprecatedPoemHealingNullified;

        // Stat modifiers from active buffs/debuffs
        const statMods: Record<string, number> = {
          damage: getStatModifier(activeEffects, m.characterId, MOD_STAT.DAMAGE),
          attackDiceUp: getStatModifier(activeEffects, m.characterId, MOD_STAT.ATTACK_DICE_UP),
          defendDiceUp: getStatModifier(activeEffects, m.characterId, MOD_STAT.DEFEND_DICE_UP),
          speed: getStatModifier(activeEffects, m.characterId, MOD_STAT.SPEED),
          criticalRate: getStatModifier(activeEffects, m.characterId, MOD_STAT.CRITICAL_RATE),
          maxHp: getStatModifier(activeEffects, m.characterId, MOD_STAT.MAX_HP),
        };

        // Keraunos: crit bar shows caster's current crit + 25%
        const displayCriticalRate =
          turn?.attackerId === m.characterId && turn?.usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE
            ? Math.min(100, Math.max(0, Math.max(m.criticalRate ?? 0, (m.criticalRate ?? 0) + (statMods.criticalRate ?? 0)) + 25))
            : undefined;

        const minions = minionsMap.get(m.characterId) || [];

        return (
          <MemberChip
            key={m.characterId}
            fighter={m}
            isPracticeRoom={isPracticeRoom}
            isAttacker={isAttacker}
            isDefender={isDefender}
            isEliminated={isEliminated}
            isTargetable={isTargetable}
            isSpotlight={!!isSpotlight}
            isCrit={isCrit}
            isHit={isHit}
            isShockHit={isShockHit}
            isKeraunosVoltageHit={isKeraunosVoltageHit}
            isJoltArcAttackHit={isJoltArcAttackHit}
            isShocked={isShocked}
            hasJoltArcDeceleration={hasJoltArcDeceleration}
            isEfflorescenceMuse={isEfflorescenceMuse}
            hasPomegranateEffect={hasPomegranateEffect}
            isSpiritForm={isSpiritForm}
            isShadowCamouflaged={isShadowCamouflaged}
            hasBeyondNimbus={hasBeyondNimbus}
            hasSoulDevourer={hasSoulDevourer}
            hasDeathKeeper={hasDeathKeeper}
            hasSunbornSovereign={hasSunbornSovereign}
            isResurrected={isResurrected}
            isResurrecting={isResurrecting}
            isFragranceWaved={isFragranceWaved}
            isHymnWaved={isHymnWaved}
            isImprecatedPoemHealingNullified={isImprecatedPoemHealingNullified}
            isImprecatedPoemCursed={isImprecatedPoemCursed}
            imprecatedPoemVerseTags={imprecatedPoemVerseTags}
            hymnLogKey={battle != null && logHasHymn ? `hymn_${battle.roundNumber ?? 'r'}_${hymnLogIndex}_${m.characterId}` : undefined}
            hymnHeal={isHymnWaved && !isImprecatedPoemHealingNullified ? 2 : undefined}
            turnOrder={turnOrderMap.get(m.characterId)}
            effectPips={effectPips}
            statMods={statMods}
            displayCriticalRate={displayCriticalRate}
            battleLive={!!battle && !battle.winner}
            onSelect={isTargetable && onSelectTarget ? () => onSelectTarget(m.characterId) : undefined}
            minions={minions}
            allowTransientHits={
              (turn?.phase !== PHASE.ROLLING_DEFEND &&
                turn?.phase !== PHASE.ROLLING_ATTACK &&
                turn?.phase !== PHASE.ROLLING_POMEGRANATE_CO_ATTACK &&
                turn?.phase !== PHASE.ROLLING_POMEGRANATE_CO_DEFEND) &&
              (allowHitVisuals ||
                (turn?.phase === PHASE.RESOLVING && !!transientEffectsActive) ||
                isSkeletonCardHitTarget ||
                (hasMinionHitPulse &&
                  (turn?.phase === PHASE.RESOLVING ||
                    turn?.phase === PHASE.RESOLVING_RAPID_FIRE_EXTRA_SHOT ||
                    !!resolveShown ||
                    !!pomegranateCoResolveActive)) ||
                (hasMinionPulseInChip &&
                  (turn?.phase === PHASE.RESOLVING ||
                    turn?.phase === PHASE.RESOLVING_RAPID_FIRE_EXTRA_SHOT ||
                    !!resolveShown ||
                    !!pomegranateCoResolveActive)) ||
                !!(battle as { _demoVfxKey?: string })?._demoVfxKey ||
                typeof (battle as { _demoReplayTargetKey?: number })?._demoReplayTargetKey === 'number' ||
                typeof (battle as { _demoShockHitReplayKey?: number })?._demoShockHitReplayKey === 'number')
            }
            visualDefenderId={visualDefenderId}
            hitEventKey={
              (() => {
                if (!battle) return playbackHitEventKey ?? undefined;
                const b = battle as { _demoVfxKey?: string; _demoReplayTargetKey?: number; _demoShockHitReplayKey?: number };
                const hasDemoReplayKeys = b._demoReplayTargetKey != null || b._demoShockHitReplayKey != null || b._demoVfxKey != null;
                const tagBasedHit = tagBasedProps.isHit || tagBasedProps.isShockHit || tagBasedProps.isKeraunosVoltageHit || tagBasedProps.isJoltArcAttackHit;
                if (hasDemoReplayKeys && tagBasedHit) {
                  // Prefer replay key so Replay button works for Hit, Shock Hit, or both (otherwise _demoVfxKey doesn't change on click)
                  if (b._demoReplayTargetKey != null) return String(b._demoReplayTargetKey);
                  return b._demoVfxKey ?? undefined;
                }
                return playbackHitEventKey ?? (tagBasedHit ? (tagBasedProps.isHit && b._demoReplayTargetKey != null ? String(b._demoReplayTargetKey) : b._demoVfxKey) : undefined);
              })()
            }
            shockHitEventKey={
              (tagBasedProps.isShockHit && (battle as { _demoShockHitReplayKey?: number })?._demoShockHitReplayKey != null)
                ? String((battle as { _demoShockHitReplayKey?: number })._demoShockHitReplayKey)
                : undefined
            }
            playbackHitTargetId={playbackStepActive ? playbackStep?.defenderId : undefined}
            playbackHitEventKey={playbackStepActive ? buildBattlePlaybackEventKey(battle?.roundNumber ?? 0, battle?.currentTurnIndex ?? 0, playbackStep) : undefined}
            minionHitPulseId={
              shouldAllowLegacyMinionPulse
                ? (isSkeletonCardHitTarget && currentSkeletonPulseKey != null
                  ? currentSkeletonPulseKey
                  : (minionPulseMap && minionPulseMap[String(m.characterId)] != null ? Number(minionPulseMap[String(m.characterId)]) : undefined))
                : undefined
            }
            minionHitPulseDurationMs={isSkeletonCardHitTarget ? 2500 : 1500}
            minionPulseMap={minionPulseMap}
            floralLogKey={
              battle != null && battle.roundNumber != null && battle.log != null
                ? (useFloralForThisMember && floralLogIndex >= 0)
                  ? `floral_shown_${battle.roundNumber}_${battle.log.length - rawRecent.length + floralLogIndex}_${m.characterId}`
                  : (floralHealRollDone && battle.currentTurnIndex != null)
                    ? `floral_live_${battle.roundNumber}_${battle.currentTurnIndex}_${m.characterId}`
                  : (useSpringForThisMember && springLogIndex >= 0)
                    ? `spring_shown_${battle.roundNumber}_${springLogIndex}_${m.characterId}`
                    : (springFromPhase ? `spring_phase_${battle.roundNumber}_caster_${m.characterId}` : undefined)
                : undefined
            }
            floralFragranceDelayMs={0}
            floralHealResultCardVisible={floralHealResultCardVisible}
            isFloralHealTarget={isFloralHealTarget}
            floralFragranceCasterIsRosabella={
              (typeof turn?.usedPowerName === 'string' && (turn.usedPowerName as string).trim() === (POWER_NAMES.FLORAL_FRAGRANCE as string).trim() &&
                turn?.attackerId
                ? (fighterMap.get(turn.attackerId)?.characterId?.toLowerCase() === CHARACTER.ROSABELLA)
                : (useSpringForThisMember && springLogIndex >= 0) || (useFloralForThisMember && floralLogIndex >= 0)
                  ? (() => {
                    const useSpring = springLogIndex > floralLogIndex;
                    const entry = floralSearchLog[useSpring ? springLogIndex : floralLogIndex] as { attackerId?: string };
                    const casterId = entry?.attackerId;
                    return casterId
                      ? (fighterMap.get(casterId)?.characterId?.toLowerCase() === CHARACTER.ROSABELLA)
                      : undefined;
                  })()
                  : isDemo && isFragranceWaved
                    ? (() => {
                      const floralEffect = activeEffects.find(
                        (e) => (e as { tag?: string }).tag === EFFECT_TAGS.FLORAL_FRAGRANCE && e.targetId === m.characterId
                      );
                      const casterId = floralEffect?.sourceId;
                      return casterId
                        ? (fighterMap.get(casterId)?.characterId?.toLowerCase() === CHARACTER.ROSABELLA)
                        : undefined;
                    })()
                    : undefined)
            }
            demoFragranceSessionKey={isDemo ? (battle as { _demoVfxKey?: string })?._demoVfxKey ?? '' : undefined}
            floralFragranceHeal={
              springFromPhase
                ? battleSpringHeal1
                : useSpringForThisMember && springLogIndex >= 0
                  ? (floralSearchLog[springLogIndex] as { springHeal?: number; heal?: number })?.springHeal ?? (floralSearchLog[springLogIndex] as { heal?: number })?.heal
                  : useFloralForThisMember && floralLogIndex >= 0
                    ? floralHealFromLog || (floralSearchLog[floralLogIndex] as { heal?: number })?.heal
                    : isDemo && isFragranceWaved
                      ? 2
                      : floralHealRollDone && turn?.attackerId && allMembers?.length
                        ? (() => {
                          const caster = allMembers.find((a) => a.characterId === turn.attackerId);
                          if (!caster) return undefined;
                          const baseHeal = Math.ceil(0.2 * caster.maxHp);
                          if (floralHealRollDone) {
                            const t = turn as { floralHealRoll?: number; floralHealWinFaces?: number[] };
                            const roll = t.floralHealRoll;
                            const winFaces = t.floralHealWinFaces ?? [];
                            const isCrit = typeof roll === 'number' && winFaces.includes(roll);
                            return isCrit ? baseHeal * 2 : baseHeal;
                          }
                          return baseHeal;
                        })()
                        : undefined
            }
            soulDevourerHealAmount={soulDevourerHealFromLog?.amount}
            soulDevourerHealKey={soulDevourerHealFromLog?.key}
            suppressSpringHealVfx={isSpringHeal2PendingCaster || isSpringHealSkipModalCaster}
            casterFrameRef={turn?.attackerId === m.characterId ? casterFrameRef : undefined}
            defenderFrameRef={turn?.defenderId === m.characterId ? defenderFrameRef : undefined}
            volleyArrowHitActive={volleyArrowHitActive}
            isVolleyArrowHitDefender={!isEliminated && (volleyArrowHitDefenderId === m.characterId || !!tagBasedProps.isVolleyArrowHitDefender)}
            isVolleyArrowHitAttacker={!isEliminated && (hasRapidFireEffect || !!tagBasedProps.isVolleyArrowHitAttacker)}
            isNemesisReattackHitDefender={!isEliminated && nemesisReattackActive && (turn as any)?.nemesisReattackTargetId === m.characterId}
            isNemesisReattackHitAttacker={!isEliminated && nemesisReattackActive && (turn as any)?.nemesisReattackSourceId === m.characterId}
          />
        );
      })}
    </div>
  );
}
