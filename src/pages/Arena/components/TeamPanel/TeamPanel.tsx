import type { RefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BattlePlaybackStep, BattleState, FighterState } from '../../../../types/battle';
import { buildBattlePlaybackEventKey } from '../../../../types/battle';
import { Minion } from '../../../../types/minions';
import { getStatModifier } from '../../../../services/powerEngine';
import { getTagBasedChipProps, getEffectDisplayNameForTag } from '../../../../data/powerVfxRegistry';
import MemberChip from './MemberChip/MemberChip';
import type { EffectPip } from './MemberChip/MemberChip';
import { EFFECT_TAGS } from '../../../../constants/effectTags';
import { POWER_NAMES, POWER_TYPES } from '../../../../constants/powers';
import { BATTLE_TEAM, PANEL_SIDE, PHASE, TURN_ACTION, type PanelSide } from '../../../../constants/battle';
import { MOD_STAT, TARGET_TYPES } from '../../../../constants/effectTypes';
import { REFILL_DICE_VIEW_MS } from '../BattleHUD/components/RefillSPDiceModal/RefillSPDiceModal';
import './TeamPanel.scss';
import { SKILL_UNLOCK } from '../../../../constants/character';

interface Props {
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
  /** Optional map of transient minion pulse ids keyed by defenderId (from Arena) */
  minionPulseMap?: Record<string, number>;
  onSelectTarget?: (defenderId: string) => void;
  /** Optional client-side visual override for NPC target selection */
  clientVisualDefenderId?: string | null;
  clientVisualPowerName?: string | null;
  /** True briefly when user clicks Back from target modal — prevents opposite mchip__frame shake */
  suppressHitAfterBack?: boolean;
  /** True when Floral Heal D4 result card is visible (so healing VFX shows in sync with "Normal Heal" / "Heal x2") */
  floralHealResultCardVisible?: boolean;
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

export default function TeamPanel({ members, allMembers, side, battle, myId, teamMinions, resolveShown, transientEffectsActive, soulDevourerHealReady, casterFrameRef, defenderFrameRef, minionPulseMap, onSelectTarget, clientVisualDefenderId, clientVisualPowerName, suppressHitAfterBack, floralHealResultCardVisible }: Props) {
  const turn = battle?.turn;
  const activeEffects = useMemo(() => battle?.activeEffects || [], [battle?.activeEffects]);

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
  const canSelectTarget = turn?.phase === PHASE.SELECT_TARGET && turn.attackerId === myId && isOpposingTeam;

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

  // Pre-compute whether the current attack actually landed (atkTotal > defTotal)
  const attackLanded = useMemo(() => {
    if (!turn || turn.phase !== PHASE.RESOLVING || !resolveShown) return false;
    // skipDice powers always hit
    if (turn.action === TURN_ACTION.POWER && !turn.attackRoll) return true;
    const atk = turn.attackerId ? fighterMap.get(turn.attackerId) : undefined;
    const def = turn.defenderId ? fighterMap.get(turn.defenderId) : undefined;
    if (!atk || !def) return false;
    const atkBuff = getStatModifier(activeEffects, turn.attackerId, MOD_STAT.ATTACK_DICE_UP);
    const defBuff = getStatModifier(activeEffects, turn.defenderId!, MOD_STAT.DEFEND_DICE_UP);
    const atkTotal = (turn.attackRoll ?? 0) + atk.attackDiceUp + atkBuff;
    const defTotal = (turn.defendRoll ?? 0) + def.defendDiceUp + defBuff;
    return atkTotal > defTotal;
  }, [turn, resolveShown, fighterMap, activeEffects]);

  return (
    <div
      className={`team-panel team-panel--${side} ${members.length >= 3 ? 'team-panel--full' : ''}`}
      data-count={members.length}
      style={buildPanelBg(members)}
    >
      {members.map((m) => {
        // Who is shown as "target" (defender): the one actually targeted, not the skeleton that dealt the hit.
        // Prefer turn-level visualDefenderId (selection), then client NPC override, then during RESOLVING
        // use lastHitTargetId (the defender who was hit) — never lastHitMinionId (skeleton/attacker).
        const visualDefenderId = (turn as any)?.visualDefenderId ?? (clientVisualDefenderId ?? ((turn?.phase === PHASE.RESOLVING || resolveShown) ? (battle as any)?.lastHitTargetId : undefined));
        const isAttacker = turn?.attackerId === m.characterId;
        
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
        const isTargetable = !!(canSelectTarget && !isEliminated && (!isShadowCamouflaged || isAreaAttack));
        const isSpotlight =
          (isAttacker && (turn?.phase === PHASE.SELECT_TARGET || turn?.phase === PHASE.ROLLING_ATTACK)) ||
          (isDefender && turn?.phase === PHASE.ROLLING_DEFEND);

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
        const lastHitEntry = !!(
          lastEntry &&
          lastEntry.defenderId === m.characterId &&
          lastEntry.missed !== true &&
          ((lastEntry.damage as number) > 0 || (lastEntry as any).isMinionHit)
        );
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
          turn?.phase !== PHASE.ROLLING_DEFEND
        ) && !suppressHitAfterSelect && !suppressHitAfterBack;
        const playbackHit = !!playbackStepActive && playbackStep?.defenderId === m.characterId;
        const playbackHitEventKey = (playbackHit && !playbackStep?.isMinionHit && playbackStep?.isHit !== false)
          ? buildBattlePlaybackEventKey(battle?.roundNumber ?? 0, battle?.currentTurnIndex ?? 0, playbackStep)
          : undefined;
        const playbackMainHit = !!playbackStepActive && !playbackStep?.isMinionHit && playbackStep?.defenderId === m.characterId && playbackStep?.isHit !== false;
        const shouldAllowLegacyMinionPulse = !!(
          minionPulseMap &&
          minionPulseMap[m.characterId] != null &&
          turn?.defenderId === m.characterId &&
          (
            (playbackStepActive && !!playbackStep?.isMinionHit) ||
            hasBufferedMinionPlayback
          )
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
        // Merge tag-based (e.g. demo-only hit VFX) so demo selection shows hit/shock/resurrecting etc.
        const isHit = isHitFromTurn || !!tagBasedProps.isHit;

        // Shock hit: attacker has Lightning Reflex passive → electric zap on defender
        const attacker = turn?.attackerId ? fighterMap.get(turn.attackerId) : undefined;
        const hasLightningReflex = !!(
          attacker?.passiveSkillPoint === SKILL_UNLOCK &&
          attacker.powers?.some(p => p.type === POWER_TYPES.PASSIVE && p.name === POWER_NAMES.LIGHTNING_SPARK)
        );
        const isShockHit = !!((isHit || playbackMainHit) && hasLightningReflex && turn?.defenderId === m.characterId)
          || !!tagBasedProps.isShockHit;

        // Keraunos Voltage hit: massive lightning strike effect
        const isKeraunosVoltageHit = !!(
          (isHit || playbackMainHit) && turn?.usedPowerName === POWER_NAMES.KERAUNOS_VOLTAGE
        ) || !!tagBasedProps.isKeraunosVoltageHit;

        // Jolt Arc hit: blue/white arc effect on targets when Jolt Arc is confirmed (not deceleration)
        const isJoltArcAttackHit = !!(
          (isHit && lastEntry?.powerUsed === POWER_NAMES.JOLT_ARC) ||
          (playbackMainHit && playbackStep?.powerName === POWER_NAMES.JOLT_ARC)
        ) || !!tagBasedProps.isJoltArcAttackHit;

        const isShocked = tagBasedProps.isShocked;
        const hasJoltArcDeceleration = tagBasedProps.hasJoltArcDeceleration;
        const isEfflorescenceMuse = tagBasedProps.isEfflorescenceMuse;
        const hasPomegranateEffect = tagBasedProps.hasPomegranateEffect;
        const isSpiritForm = tagBasedProps.isSpiritForm;
        const hasSoulDevourer = tagBasedProps.hasSoulDevourer;
        const hasBeyondNimbus = tagBasedProps.hasBeyondNimbus;
        const hasDeathKeeper = tagBasedProps.hasDeathKeeper;
        const isResurrected = tagBasedProps.isResurrected;

        // Active effect pips (deduplicate same power from same source; group by tag so Jolt Arc vs Jolt Arc Deceleration are separate)
        const effectPips: EffectPip[] = (() => {
          const raw = activeEffects.filter(e => e.targetId === m.characterId && e.turnsRemaining > 0);
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
              ? 'Self'
              : isDemo && oppositeMemberIds.has(g.sourceId)
                ? (side === PANEL_SIDE.LEFT ? 'Right' : 'Left')
                : (source?.nicknameEng || '?');
            return {
              powerName: g.powerName,
              ...(displayName && { displayName }),
              sourceName,
              ...(source?.deityBlood != null && { sourceDeity: source.deityBlood }),
              sourceTheme: source ? [source.theme[0], source.theme[1]] as [string, string] : ['#666', '#999'] as [string, string],
              turnsLeft: Math.ceil(g.maxTurns / queueLen),
              count: g.count,
            };
          });
        })();

        // Resurrecting: mid-resurrection visual (self-resurrect overlay active), or from demo tag-based
        const isResurrecting = !!(
          turn?.resurrectTargetId === m.characterId &&
          turn?.phase === PHASE.SELECT_ACTION
        ) || !!tagBasedProps.isResurrecting;

        // Floral Fragrance: brief trigger when just applied (real battle + demo)
        // Trigger from: (1) turn state when this member is the ally target, or (2) recent log entry.
        const rawRecent = Array.isArray(battle?.log) ? (battle!.log as any[]).slice(-8) : [];
        const recentLog = rawRecent.filter((le) => le.round === battle?.roundNumber);
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
        const logHasFloral = floralLogIndex !== -1;

        // Soul Devourer lifesteal: show +{n} HP on caster once after master damage card (soulDevourerHealReady), before skeleton hits.
        const soulDevourerHealFromLog = (() => {
          const turnDrain = (turn as any)?.soulDevourerDrain && turn?.phase === PHASE.RESOLVING && turn?.attackerId === m.characterId;
          if (!turnDrain || !soulDevourerHealReady) return null;
          const dmgBuff = getStatModifier(activeEffects, m.characterId, MOD_STAT.DAMAGE);
          const mainDmg = Math.max(0, (m.damage ?? 0) + dmgBuff);
          const amount = Math.ceil(mainDmg * 0.5);
          if (amount <= 0) return null;
          const r = (battle as any)?.roundNumber ?? 0;
          const ti = (battle as any)?.currentTurnIndex ?? 0;
          return { amount, key: `soul_devourer_heal_turn_${r}_${ti}_${m.characterId}` };
        })();

        const phaseOk = turn?.phase != null && ([PHASE.SELECT_TARGET, PHASE.SELECT_ACTION, PHASE.ROLLING_ATTACK, PHASE.ROLLING_DEFEND] as readonly string[]).includes(turn.phase);
        const clientFragrance = clientVisualDefenderId === m.characterId && typeof clientVisualPowerName === 'string' && clientVisualPowerName === POWER_NAMES.FLORAL_FRAGRANCE;
        const isFloralPowerInUse = typeof turn?.usedPowerName === 'string' && (turn.usedPowerName as string).trim() === (POWER_NAMES.FLORAL_FRAGRANCE as string).trim();
        const serverFragranceOnTarget = turn?.allyTargetId != null && String(turn.allyTargetId) === String(m.characterId) && isFloralPowerInUse;
        // Floral Heal D4: show fragrance only after dice roll result is in (animation ended), not during roll
        const floralHealRollDone = turn?.phase === PHASE.ROLLING_FLORAL_HEAL && serverFragranceOnTarget && (turn as { floralHealRoll?: number }).floralHealRoll != null;
        // Never use client state for Floral Fragrance — avoids jitter (flash before D4). Show only from server: roll result or log.
        const clientFragranceOk = !!clientFragrance && clientVisualPowerName !== POWER_NAMES.FLORAL_FRAGRANCE;
        // Post-heal phase: SELECT_TARGET + allyTargetId = picking enemy for follow-up attack; heal is done, hide fragrance wave
        const postHealFollowUp = !!(turn?.phase === PHASE.SELECT_TARGET && turn?.allyTargetId);
        // Show fragrance: (1) client selected ally (non–Floral only), (2) server turn (phaseOk) but not after heal, (3) after D4 roll result, (4) log but not after heal, (5) demo/tag
        const isFragranceWaved =
          (!!clientFragranceOk && turn?.phase !== PHASE.ROLLING_FLORAL_HEAL)
          || (!!serverFragranceOnTarget && phaseOk && !postHealFollowUp)
          || !!floralHealRollDone
          || (!!logHasFloral && !postHealFollowUp)
          || !!tagBasedProps.isFragranceWaved;

        // Stat modifiers from active buffs/debuffs
        const statMods: Record<string, number> = {
          damage: getStatModifier(activeEffects, m.characterId, MOD_STAT.DAMAGE),
          attackDiceUp: getStatModifier(activeEffects, m.characterId, MOD_STAT.ATTACK_DICE_UP),
          defendDiceUp: getStatModifier(activeEffects, m.characterId, MOD_STAT.DEFEND_DICE_UP),
          speed: getStatModifier(activeEffects, m.characterId, MOD_STAT.SPEED),
          criticalRate: getStatModifier(activeEffects, m.characterId, MOD_STAT.CRITICAL_RATE),
          maxHp: getStatModifier(activeEffects, m.characterId, MOD_STAT.MAX_HP),
        };

        const minions = minionsMap.get(m.characterId) || [];

        return (
          <MemberChip
            key={m.characterId}
            fighter={m}
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
            isResurrected={isResurrected}
            isResurrecting={isResurrecting}
            isFragranceWaved={isFragranceWaved}
            turnOrder={turnOrderMap.get(m.characterId)}
            effectPips={effectPips}
            statMods={statMods}
            battleLive={!!battle && !battle.winner}
            onSelect={isTargetable && onSelectTarget ? () => onSelectTarget(m.characterId) : undefined}
            minions={minions}
            // Allow pulses when hit visuals allowed, or during RESOLVING with skeleton playback (n hits → n shakes), or in demo (VFX/replay keys)
            allowTransientHits={allowHitVisuals || (turn?.phase === PHASE.RESOLVING && !!transientEffectsActive) || !!(battle as { _demoVfxKey?: string })?._demoVfxKey || typeof (battle as { _demoReplayTargetKey?: number })?._demoReplayTargetKey === 'number' || typeof (battle as { _demoShockHitReplayKey?: number })?._demoShockHitReplayKey === 'number'}
            visualDefenderId={visualDefenderId}
            hitEventKey={
              (() => {
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
                ? Number(minionPulseMap[m.characterId])
                : undefined
            }
            minionPulseMap={minionPulseMap}
            floralLogKey={
              logHasFloral && battle?.roundNumber != null && floralLogIndex >= 0
                ? `floral_shown_${battle.roundNumber}_${floralLogIndex}_${m.characterId}`
                : undefined
            }
            floralFragranceDelayMs={floralHealResultCardVisible ? 0 : (floralHealRollDone ? REFILL_DICE_VIEW_MS : undefined)}
            floralHealResultCardVisible={floralHealResultCardVisible}
            isFloralHealTarget={!!serverFragranceOnTarget}
            demoFragranceSessionKey={isDemo ? (battle as { _demoVfxKey?: string })?._demoVfxKey ?? '' : undefined}
            floralFragranceHeal={
              floralLogIndex >= 0
                ? (floralSearchLog[floralLogIndex] as { heal?: number })?.heal
                : isDemo && isFragranceWaved
                  ? 2
                  : (clientFragrance || floralHealRollDone) && turn?.attackerId && allMembers?.length
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
            casterFrameRef={turn?.attackerId === m.characterId ? casterFrameRef : undefined}
            defenderFrameRef={turn?.defenderId === m.characterId ? defenderFrameRef : undefined}
          />
        );
      })}
    </div>
  );
}
