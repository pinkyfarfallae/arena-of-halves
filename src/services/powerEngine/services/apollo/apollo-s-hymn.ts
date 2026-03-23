/**
 * Apollo - Apollo's Hymn (healing + crit buff power)
 * Heal chosen ally (2 HP, +1 for Sunborn Sovereign passive), apply +25% crit to caster and target for 2 rounds.
 */

import type { BattleRoom, BattleState } from '../../../../types/battle';
import type { ActiveEffect } from '../../../../types/power';
import { POWER_NAMES } from '../../../../constants/powers';
import { ARENA_PATH } from '../../../../constants/battle';
import { EFFECT_TAGS } from '../../../../constants/effectTags';
import { EFFECT_TYPES, MOD_STAT } from '../../../../constants/effectTypes';
import {
  findFighter,
  findFighterPath,
  getEffectiveHealForReceiver,
  makeEffectId,
} from '../../powerEngine';
import { addSunbornSovereignRecoveryStack } from './helpers';

/**
 * Apollo's Hymn: heal the chosen ally (once, 2 HP incl. Sunborn); +25% crit on caster and target for 2 rounds (no stack), then end turn.
 */
export function applyApolloHymn(
  room: BattleRoom,
  attackerId: string,
  allyTargetId: string,
  battle: BattleState,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  const attacker = findFighter(room, attackerId);
  const ally = findFighter(room, allyTargetId);
  if (!attacker || !ally) return updates;

  const effects: ActiveEffect[] = [...(battle.activeEffects || [])];
  const queueLen = battle.turnQueue?.length || 1;
  const hymnDuration = 2 * queueLen; // 2 rounds
  const HEAL_AMOUNT = 2;
  const CRIT_VALUE = 25;

  // Single heal: selected ally only (ally picker can be self)
  const targetPath = findFighterPath(room, allyTargetId);
  const healAmount = getEffectiveHealForReceiver(HEAL_AMOUNT, ally, allyTargetId, effects);
  if (targetPath) {
    const prevHp = (updates[`${targetPath}/currentHp`] as number | undefined) ?? ally.currentHp;
    updates[`${targetPath}/currentHp`] = Math.min(ally.maxHp, prevHp + healAmount);
  }
  addSunbornSovereignRecoveryStack(room, effects, attackerId);
  if (allyTargetId !== attackerId) {
    addSunbornSovereignRecoveryStack(room, effects, allyTargetId);
  }

  // Add or refresh +25% crit buff (no stack) on self and ally
  const critTargets = Array.from(new Set([attackerId, allyTargetId]));
  for (const targetId of critTargets) {
    const existing = effects.find(
      e => e.targetId === targetId && e.tag === EFFECT_TAGS.APOLLO_S_HYMN && e.modStat === MOD_STAT.CRITICAL_RATE,
    );
    if (existing) {
      existing.turnsRemaining = hymnDuration;
    } else {
      effects.push({
        id: makeEffectId(attackerId, POWER_NAMES.APOLLO_S_HYMN),
        powerName: POWER_NAMES.APOLLO_S_HYMN,
        effectType: EFFECT_TYPES.BUFF,
        sourceId: attackerId,
        targetId,
        value: CRIT_VALUE,
        turnsRemaining: hymnDuration,
        modStat: MOD_STAT.CRITICAL_RATE,
        tag: EFFECT_TAGS.APOLLO_S_HYMN,
      });
    }
  }

  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effects;
  return updates;
}
