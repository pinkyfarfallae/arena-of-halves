/**
 * Apollo - Imprecated Poem (debuff verses power)
 * Three verses: HEALING_NULLIFIED (no heals), DISORIENTED (ATK/DEF at disadvantage), ETERNAL_AGONY (extend afflictions by 2 rounds).
 */

import type { BattleRoom, BattleState } from '../../../types/battle';
import type { ActiveEffect } from '../../../types/power';
import { POWER_NAMES } from '../../../constants/powers';
import { ARENA_PATH } from '../../../constants/battle';
import { EFFECT_TAGS } from '../../../constants/effectTags';
import { EFFECT_TYPES } from '../../../constants/effectTypes';
import { isAffliction } from '../../../data/statusCategory';
import { targetHasEfflorescenceMuse, makeEffectId } from '../powerEngine';

/**
 * Imprecated Poem: apply chosen verse to enemy for 2 rounds, or ETERNAL_AGONY extends all afflictions by 2 then ends.
 * Efflorescence Muse: all Imprecated Poem verses are afflictions (see data/afflictions.ts), so Muse can deny and is consumed.
 * Returns Firebase update paths relative to arenas/{arenaId}.
 */
export function applyImprecatedPoem(
  room: BattleRoom,
  attackerId: string,
  defenderId: string,
  poemTag: string,
  battle: BattleState,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  const effects: ActiveEffect[] = [...(battle.activeEffects || [])];
  const queueLen = battle.turnQueue?.length || 1;
  const duration = 2 * queueLen; // 2 rounds

  // Efflorescence Muse: block afflictions (all Imprecated Poem verses are in AFFLICTIONS_TAGS); consume Muse
  if (isAffliction({ tag: poemTag }) && targetHasEfflorescenceMuse(effects, defenderId)) {
    const withoutEfflorescenceMuse = effects.filter(
      e => !(e.targetId === defenderId && e.tag === EFFECT_TAGS.EFFLORESCENCE_MUSE),
    );
    updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = withoutEfflorescenceMuse;
    return updates; // blocked; Efflorescence Muse consumed; no poem effect applied
  }

  if (poemTag === EFFECT_TAGS.ETERNAL_AGONY) {
    // Eternal Agony: extend afflictions that still have turns left by 2 rounds (2 * queueLen). If effect has 0 rounds remaining (expired) don't extend
    const extendBy = 2 * queueLen;
    for (const e of effects) {
      const remaining = e.turnsRemaining ?? 0;
      if (e.targetId === defenderId && isAffliction(e) && remaining > 0) {
        e.turnsRemaining = remaining + extendBy;
      }
    }
    // Eternal Agony put in for 3 seconds then remove — don't push here because tickEffects will remove effect when turnsRemaining === 0; battleRoom will add after tick and set 3s timer to remove
  } else {
    // HEALING_NULLIFIED or DISORIENTED: add effect for 2 rounds
    const existing = effects.find(e => e.targetId === defenderId && e.tag === poemTag);
    if (existing) {
      existing.turnsRemaining = duration;
    } else {
      effects.push({
        id: makeEffectId(attackerId, POWER_NAMES.IMPRECATED_POEM),
        powerName: POWER_NAMES.IMPRECATED_POEM,
        effectType: EFFECT_TYPES.DEBUFF,
        sourceId: attackerId,
        targetId: defenderId,
        value: 0,
        turnsRemaining: duration,
        tag: poemTag,
        tag2: EFFECT_TAGS.IMPRECATED_POEM,
      });
    }
  }

  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effects;
  return updates;
}
