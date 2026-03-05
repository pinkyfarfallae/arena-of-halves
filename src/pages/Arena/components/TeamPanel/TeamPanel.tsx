import { useMemo } from 'react';
import type { BattleState, FighterState } from '../../../../types/battle';
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
  /** True when BattleHUD's resolve panel is visible (after crit/chain checks) */
  resolveShown?: boolean;
  onSelectTarget?: (defenderId: string) => void;
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

export default function TeamPanel({ members, allMembers, side, battle, myId, resolveShown, onSelectTarget }: Props) {
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
        const isAttacker = turn?.attackerId === m.characterId;
        const isDefender = turn?.defenderId === m.characterId;
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
        const isHit = !!(
          (attackLanded && turn?.phase === 'resolving' && turn.defenderId === m.characterId) ||
          isAoeHit
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

        // Floral Scented: brief trigger when just applied
        const isScentWaved = !!(
          turn?.allyTargetId === m.characterId &&
          turn?.usedPowerName === 'Floral Scented' &&
          (turn?.phase === 'select-target' || turn?.phase === 'rolling-attack' || turn?.phase === 'rolling-defend')
        );

        // Stat modifiers from active buffs/debuffs
        const statMods: Record<string, number> = {
          damage: getStatModifier(activeEffects, m.characterId, 'damage'),
          attackDiceUp: getStatModifier(activeEffects, m.characterId, 'attackDiceUp'),
          defendDiceUp: getStatModifier(activeEffects, m.characterId, 'defendDiceUp'),
          speed: getStatModifier(activeEffects, m.characterId, 'speed'),
          criticalRate: getStatModifier(activeEffects, m.characterId, 'criticalRate'),
          maxHp: getStatModifier(activeEffects, m.characterId, 'maxHp'),
        };

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
          />
        );
      })}
    </div>
  );
}
