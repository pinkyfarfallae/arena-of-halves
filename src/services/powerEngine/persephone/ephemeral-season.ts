/**
 * Ephemeral Season (2nd Skill)
 * Apply season effects to all alive teammates
 * Summer: +2 attack | Autumn: +2 maxHP & HP | Winter: +2 defense | Spring: heal-over-time
 */

import type { BattleRoom, BattleState } from '../../../types/battle';
import type { ActiveEffect } from '../../../types/power';
import { EFFECT_TAGS, isSeasonTag } from '../../../constants/effectTags';
import { POWER_NAMES } from '../../../constants/powers';
import { ARENA_PATH } from '../../../constants/battle';
import { EFFECT_TYPES, MOD_STAT } from '../../../constants/effectTypes';
import { SEASON_KEYS } from '../../../data/seasons';
import { findFighter, findFighterPath, makeEffectId } from '../powerEngine';

/**
 * Apply season-based effects to all alive teammates of the attacker.
 * Returns Firebase update paths relative to `arenas/{arenaId}`.
 *
 * Summer  → +2 attack dice (buff)
 * Autumn  → +2 maxHp AND +2 currentHp (immediate + tracking effect)
 * Winter  → +2 defense dice (buff)
 * Spring  → heal-over-time tag (1 HP per tick in tickEffects)
 */
export function applySeasonEffects(
  room: BattleRoom,
  attackerId: string,
  season: string,
  battle: BattleState,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  let effects: ActiveEffect[] = [...(battle.activeEffects || [])];

  // Identify attacker's team
  const isTeamA = (room.teamA?.members || []).some(m => m.characterId === attackerId);
  const teammates = isTeamA ? (room.teamA?.members || []) : (room.teamB?.members || []);

  // ── Remove existing season effects before applying new ones ──
  // Reverse autumn maxHp/currentHp changes first
  const oldAutumn = effects.filter(e => e.tag === EFFECT_TAGS.SEASON_AUTUMN);
  for (const e of oldAutumn) {
    const target = findFighter(room, e.targetId);
    if (target) {
      const path = findFighterPath(room, e.targetId);
      if (path) {
        const curMax = (updates[`${path}/maxHp`] as number | undefined) ?? target.maxHp;
        const curHp = (updates[`${path}/currentHp`] as number | undefined) ?? target.currentHp;
        updates[`${path}/maxHp`] = Math.max(1, curMax - e.value);
        updates[`${path}/currentHp`] = Math.max(1, Math.min(curHp - e.value, curMax - e.value));
      }
    }
  }
  // Strip all season effects
  effects = effects.filter(e => !isSeasonTag(e.tag ?? ''));

  // Duration: 2 full rounds (every fighter gets 2 action cycles)
  const queueLen = battle.turnQueue?.length || 1;
  const duration = queueLen * 2 + 1; // *2 for 2 rounds, +1 compensates for tick in confirmSeason

  for (const fighter of teammates) {
    if (fighter.currentHp <= 0) continue;

    const fighterId = fighter.characterId;

    switch (season) {
      case SEASON_KEYS.SUMMER: {
        effects.push({
          id: makeEffectId(attackerId, POWER_NAMES.EPHEMERAL_SEASON),
          powerName: POWER_NAMES.EPHEMERAL_SEASON,
          effectType: EFFECT_TYPES.BUFF,
          sourceId: attackerId,
          targetId: fighterId,
          value: 2,
          modStat: MOD_STAT.ATTACK_DICE_UP,
          turnsRemaining: duration,
          tag: EFFECT_TAGS.SEASON_SUMMER,
        });
        break;
      }

      case SEASON_KEYS.AUTUMN: {
        // Increase maxHp and currentHp immediately (read from updates in case old autumn was just reversed)
        const path = findFighterPath(room, fighterId);
        if (path) {
          const baseMax = (updates[`${path}/maxHp`] as number | undefined) ?? fighter.maxHp;
          const baseHp = (updates[`${path}/currentHp`] as number | undefined) ?? fighter.currentHp;
          updates[`${path}/maxHp`] = baseMax + 2;
          updates[`${path}/currentHp`] = baseHp + 2;
        }
        // Tracking effect for reversal on expiry
        effects.push({
          id: makeEffectId(attackerId, POWER_NAMES.EPHEMERAL_SEASON),
          powerName: POWER_NAMES.EPHEMERAL_SEASON,
          effectType: EFFECT_TYPES.BUFF,
          sourceId: attackerId,
          targetId: fighterId,
          value: 2,
          modStat: MOD_STAT.MAX_HP,
          turnsRemaining: duration,
          tag: EFFECT_TAGS.SEASON_AUTUMN,
        });
        break;
      }

      case SEASON_KEYS.WINTER: {
        effects.push({
          id: makeEffectId(attackerId, POWER_NAMES.EPHEMERAL_SEASON),
          powerName: POWER_NAMES.EPHEMERAL_SEASON,
          effectType: EFFECT_TYPES.BUFF,
          sourceId: attackerId,
          targetId: fighterId,
          value: 2,
          modStat: MOD_STAT.DEFEND_DICE_UP,
          turnsRemaining: duration,
          tag: EFFECT_TAGS.SEASON_WINTER,
        });
        break;
      }

      case SEASON_KEYS.SPRING: {
        // Spring heal is applied in resolveTurn; add effect so pip/SeasonalEffects show Spring
        effects.push({
          id: makeEffectId(attackerId, POWER_NAMES.EPHEMERAL_SEASON),
          powerName: POWER_NAMES.EPHEMERAL_SEASON,
          effectType: EFFECT_TYPES.BUFF,
          sourceId: attackerId,
          targetId: fighterId,
          value: 0,
          turnsRemaining: duration,
          tag: EFFECT_TAGS.SEASON_SPRING,
        });
        break;
      }
    }
  }

  updates[ARENA_PATH.BATTLE_ACTIVE_EFFECTS] = effects;
  return updates;
}
