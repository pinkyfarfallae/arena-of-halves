import { EFFECT_TAGS, EffectTag } from "../constants/effectTags";

/**
 * Blessings (positive status). Powers that "ลบ Blessing" remove effects with these tags.
 */
export const BLESSINGS_TAGS: readonly EffectTag[] = [
  // Zeus
  EFFECT_TAGS.BEYOND_THE_NIMBUS,
  // Apollo
  EFFECT_TAGS.APOLLO_S_HYMN,
  EFFECT_TAGS.RAPID_FIRE,
  // Hades
  EFFECT_TAGS.SHADOW_CAMOUFLAGING,
  EFFECT_TAGS.SOUL_DEVOURER,
  // Persephone
  EFFECT_TAGS.EFFLORESCENCE_MUSE,
];