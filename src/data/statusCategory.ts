import { STATUS_CATEGORY, type StatusCategory } from '../constants/effectTags';
import { EFFECT_TYPES } from '../constants/effectTypes';
import { AFFLICTIONS_TAGS } from './afflictions';
import { BLESSINGS_TAGS } from './blessings';

const AFFLICTION_SET = new Set<string>(AFFLICTIONS_TAGS);
const BLESSING_SET = new Set<string>(BLESSINGS_TAGS);

/**
 * Returns the status category for an active effect (for cleanse/strip mechanics).
 * Uses tag lists from data/afflictions and data/blessings.
 * Effects without a tag fall back to effectType: DEBUFF/DOT/STUN → affliction, BUFF/SHIELD → blessing.
 */
export function getEffectStatusCategory(effect: {
  tag?: string;
  effectType?: string;
}): StatusCategory | null {
  if (effect.tag) {
    if (AFFLICTION_SET.has(effect.tag)) return STATUS_CATEGORY.AFFLICTION;
    if (BLESSING_SET.has(effect.tag)) return STATUS_CATEGORY.BLESSING;
  }
  switch (effect.effectType) {
    case EFFECT_TYPES.DEBUFF:
    case EFFECT_TYPES.DOT:
    case EFFECT_TYPES.STUN:
      return STATUS_CATEGORY.AFFLICTION;
    case EFFECT_TYPES.BUFF:
    case EFFECT_TYPES.SHIELD:
      return STATUS_CATEGORY.BLESSING;
    default:
      return null;
  }
}

export function isAffliction(effect: { tag?: string; effectType?: string }): boolean {
  return getEffectStatusCategory(effect) === STATUS_CATEGORY.AFFLICTION;
}

export function isBlessing(effect: { tag?: string; effectType?: string }): boolean {
  return getEffectStatusCategory(effect) === STATUS_CATEGORY.BLESSING;
}
