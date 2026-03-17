import { EFFECT_TAGS, EffectTag } from "../constants/effectTags";

/**
 * Afflictions (negative status). Powers that "ลบ Affliction" remove effects with these tags.
 */
export const AFFLICTIONS_TAGS: readonly EffectTag[] = [
  // Zeus
  EFFECT_TAGS.SHOCK,
  EFFECT_TAGS.JOLT_ARC_DECELERATION,
  // Poseidon
  EFFECT_TAGS.STUN,
  // Apollo (Imprecated Poem)
  EFFECT_TAGS.HEALING_NULLIFIED,
  EFFECT_TAGS.DISORIENTED,
  EFFECT_TAGS.ETERNAL_AGONY,
];