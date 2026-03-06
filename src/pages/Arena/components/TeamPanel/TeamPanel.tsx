import { useMemo } from 'react';
import type { BattleState, FighterState } from '../../../../types/battle';
import { Minion } from '../../../../types/minions';
import { getStatModifier } from '../../../../services/powerEngine';
import MemberChip from './MemberChip/MemberChip';
import type { EffectPip } from './MemberChip/MemberChip';
import './TeamPanel.scss';

interface Props {
  members: FighterState[];
  allMembers?: FighterState[];
  side: 'left' | 'right';
  battle?: BattleState;
  myId?: string;
  teamMinions?: Minion[];
  /** True when BattleHUD's resolve panel is visible (after crit/chain checks) */
  resolveShown?: boolean;
  onSelectTarget?: (defenderId: string) => void;
  /** Optional client-side visual override for NPC target selection */
  clientVisualDefenderId?: string | null;
  clientVisualPowerName?: string | null;
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

export default function TeamPanel({ members, allMembers, side, battle, myId, teamMinions, resolveShown, onSelectTarget, clientVisualDefenderId, clientVisualPowerName }: Props) {
  const turn = battle?.turn;
  const activeEffects = battle?.activeEffects || [];

  // This panel's team is the opposite side's target pool
  const isOpposingTeam = turn && (
    (side === 'left' && turn.attackerTeam === 'teamB') ||
    (side === 'right' && turn.attackerTeam === 'teamA')
  );
  const canSelectTarget = turn?.phase === 'select-target' && turn.attackerId === myId && isOpposingTeam;

  // Build a lookup map: characterId → FighterState (for effect pip source themes)
  const fighterMap = useMemo(() => {
    const map = new Map<string, FighterState>();
    for (const f of (allMembers || members)) map.set(f.characterId, f);
    return map;
  }, [allMembers, members]);

  // Build minions list: for each main fighter, if they have any minions in allMembers, include them right after the main fighter
  const minionsMap = useMemo(() => {
    const map = new Map<string, Minion[]>();
    // Find the correct team (side)
    const teamKey = side === 'left' ? 'teamA' : 'teamB';
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
    if (!turn || turn.phase !== 'resolving' || !resolveShown) return false;
    // skipDice powers always hit
    if (turn.action === 'power' && !turn.attackRoll) return true;
    const atk = turn.attackerId ? fighterMap.get(turn.attackerId) : undefined;
    const def = turn.defenderId ? fighterMap.get(turn.defenderId) : undefined;
    if (!atk || !def) return false;
    const atkBuff = getStatModifier(activeEffects, turn.attackerId, 'attackDiceUp');
    const defBuff = getStatModifier(activeEffects, turn.defenderId!, 'defendDiceUp');
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
        // Allow a visual override so attacks can be visually retargeted to minions.
        // Prefer the turn-level `visualDefenderId` (set during selection) so selection
        // highlights a minion (e.g. skeleton #1). Do NOT fall back to room-level
        // `lastHitMinionId` while in `select-target` phase to avoid showing a hit
        // flash when the player is merely choosing a target.
        // Only honor room-level transient hit markers when we are actively resolving
        // a hit (prevents stale `lastHitMinionId` from causing a frame shake on new turns).
        // Priority: explicit turn visual override (selection), then client-side NPC visual override,
        // then transient server `lastHitMinionId` during resolving.
        const visualDefenderId = (turn as any)?.visualDefenderId ?? (clientVisualDefenderId ?? ((turn?.phase === 'resolving' || resolveShown) ? (battle as any)?.lastHitMinionId : undefined));
        const isAttacker = turn?.attackerId === m.characterId;
        
        // Check if this master has any minions (skeletons)
        const masterMinions = minionsMap.get(m.characterId) || [];
        const hasMasterMinions = masterMinions.length > 0;
        
        // Show defender badge on the master ONLY if they don't have minions (otherwise minion shows it)
        const isDefender = !hasMasterMinions && (turn?.defenderId === m.characterId);
        const isEliminated = m.currentHp <= 0;
        const isTargetable = !!(canSelectTarget && !isEliminated);
        const isSpotlight =
          (isAttacker && (turn?.phase === 'select-target' || turn?.phase === 'rolling-attack')) ||
          (isDefender && turn?.phase === 'rolling-defend');

        const log = battle?.log;
        const lastEntry = log && log.length > 0 ? log[log.length - 1] : undefined;
        const isCrit = !!(lastEntry?.isCrit && lastEntry.attackerId === m.characterId);

        // Hit effect: only when attack actually landed (not blocked)
        // AoE path: only for skipDice powers whose log was already written (check attackerId matches)
        const isAoeHit = !!(
          resolveShown && turn?.phase === 'resolving' &&
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
        const transientTargetHit = (turn?.phase === 'resolving' || resolveShown) && !!lastHitEntry;
        // Only show hit effects on the opposing team (normal hits). For the
        // attacker's own side, only show hit effects for AoE/co-attack cases
        // where allies actually take damage.
        const isOpposing = !!(turn && ((side === 'left' && turn.attackerTeam === 'teamB') || (side === 'right' && turn.attackerTeam === 'teamA')));
        const isHit = !!(
          (isOpposing && (
            transientTargetHit ||
            (!hasMasterMinions && ((attackLanded && turn?.phase === 'resolving' && (turn?.defenderId === m.characterId)) || isAoeHit))
          )) ||
          (!isOpposing && isAoeHit)
        );

        // Shock hit: attacker has Lightning Reflex passive → electric zap on defender
        const attacker = turn?.attackerId ? fighterMap.get(turn.attackerId) : undefined;
        const hasLightningReflex = !!(
          attacker?.passiveSkillPoint === 'unlock' &&
          attacker.powers?.some(p => p.type === 'Passive' && p.name === 'Lightning Reflex')
        );
        const isShockHit = !!(isHit && hasLightningReflex && turn?.defenderId === m.characterId);

        // Thunderbolt hit: massive lightning strike effect
        const isThunderboltHit = !!(
          isHit && turn?.usedPowerName === 'Thunderbolt'
        );

        // Shock visual: has any active shock DOT
        const isShocked = activeEffects.some(
          e => e.targetId === m.characterId && e.tag === 'shock',
        );

        // Active effect pips (deduplicate same power from same source)
        const effectPips: EffectPip[] = (() => {
          const raw = activeEffects.filter(e => e.targetId === m.characterId && e.turnsRemaining > 0);
          const grouped = new Map<string, { count: number; maxTurns: number; sourceId: string; powerName: string }>();
          for (const e of raw) {
            const key = `${e.sourceId}:${e.powerName}`;
            const existing = grouped.get(key);
            if (existing) {
              existing.count++;
              existing.maxTurns = Math.max(existing.maxTurns, e.turnsRemaining);
            } else {
              grouped.set(key, { count: 1, maxTurns: e.turnsRemaining, sourceId: e.sourceId, powerName: e.powerName });
            }
          }
          const queueLen = battle?.turnQueue?.length || 1;
          return Array.from(grouped.values()).map(g => {
            const source = fighterMap.get(g.sourceId);
            return {
              powerName: g.powerName,
              sourceName: source?.nicknameEng || '?',
              sourceTheme: source ? [source.theme[0], source.theme[1]] as [string, string] : ['#666', '#999'] as [string, string],
              turnsLeft: Math.ceil(g.maxTurns / queueLen),
              count: g.count,
            };
          });
        })();

        // Petal-shield (Secret of Dryad) status immunity
        const isPetalShielded = activeEffects.some(
          e => e.targetId === m.characterId && e.tag === 'petal-shield',
        );

        // Pomegranate's Oath: ruby seed effect on both caster and target
        const hasPomegranateEffect = activeEffects.some(
          e => e.tag === 'pomegranate-spirit' && (e.targetId === m.characterId || e.sourceId === m.characterId),
        );

        // Spirit form: ethereal ghost effect on target only (includes self-target)
        const isSpiritForm = activeEffects.some(
          e => e.tag === 'pomegranate-spirit' && e.targetId === m.characterId,
        );

        // Shadow Camouflaging: dark wisps + shadow particles effect
        const isShadowCamouflaged = activeEffects.some(
          e => e.targetId === m.characterId && e.modStat === 'shadowCamouflaged',
        );

        // Death Keeper: subtle frame on caster, dark mist on resurrected target
        const hasDeathKeeper = activeEffects.some(
          e => e.targetId === m.characterId && e.tag === 'death-keeper',
        );
        const isResurrected = activeEffects.some(
          e => e.targetId === m.characterId && e.tag === 'resurrected',
        );

        // Resurrecting: mid-resurrection visual (self-resurrect overlay active)
        const isResurrecting = !!(
          turn?.resurrectTargetId === m.characterId &&
          turn?.phase === 'select-action'
        );

        // Floral Fragrance: brief trigger when just applied
        // Also watch recent persistent log entries so we show the scent VFX even
        // when the server wrote a log entry but the turn fields aren't present
        // on the client yet. Only show the scent for the exact 'Floral Fragrance' power.
        // Only consider recent persistent log entries from the current round
        const recentLog = Array.isArray(battle?.log)
          ? (battle!.log as any[]).slice(-8).filter((le) => le.round === battle?.roundNumber)
          : [];
        const logHasFloral = recentLog.some((le) => typeof le.powerUsed === 'string' && le.powerUsed === 'Floral Fragrance' && le.defenderId === m.characterId);
        const phaseOk = ['select-target', 'select-action', 'rolling-attack', 'rolling-defend'].includes(turn?.phase as string);
        const clientScent = clientVisualDefenderId === m.characterId && typeof clientVisualPowerName === 'string' && clientVisualPowerName === 'Floral Fragrance';
        const isScentWaved = !!(
          (
            // server-driven case
            turn?.allyTargetId === m.characterId &&
            typeof turn?.usedPowerName === 'string' && turn.usedPowerName === 'Floral Fragrance'
          ) || clientScent || logHasFloral
        ) && phaseOk;

        // Stat modifiers from active buffs/debuffs
        const statMods: Record<string, number> = {
          damage: getStatModifier(activeEffects, m.characterId, 'damage'),
          attackDiceUp: getStatModifier(activeEffects, m.characterId, 'attackDiceUp'),
          defendDiceUp: getStatModifier(activeEffects, m.characterId, 'defendDiceUp'),
          speed: getStatModifier(activeEffects, m.characterId, 'speed'),
          criticalRate: getStatModifier(activeEffects, m.characterId, 'criticalRate'),
          maxHp: getStatModifier(activeEffects, m.characterId, 'maxHp'),
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
            isThunderboltHit={isThunderboltHit}
            isShocked={isShocked}
            isPetalShielded={isPetalShielded}
            hasPomegranateEffect={hasPomegranateEffect}
            isSpiritForm={isSpiritForm}
            isShadowCamouflaged={isShadowCamouflaged}
            hasDeathKeeper={hasDeathKeeper}
            isResurrected={isResurrected}
            isResurrecting={isResurrecting}
            isScentWaved={isScentWaved}
            turnOrder={turnOrderMap.get(m.characterId)}
            effectPips={effectPips}
            statMods={statMods}
            battleLive={!!battle && !battle.winner}
            onSelect={isTargetable && onSelectTarget ? () => onSelectTarget(m.characterId) : undefined}
            minions={minions}
            visualDefenderId={visualDefenderId}
          />
        );
      })}
    </div>
  );
}
