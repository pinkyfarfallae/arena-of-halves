/**
 * Effect tags used in ActiveEffect.tag for special mechanics.
 * Use these constants instead of string literals everywhere.
 */
export const EFFECT_TAGS = {
  // Zeus
  SHOCK: 'shock',
  BEYOND_THE_NIMBUS: 'beyond-the-nimbus',
  JOLT_ARC_DECELERATION: 'jolt-arc-deceleration',

  // Poseidon
  STUN: 'stun',

  // Apollo
  SUNBORN_SOVEREIGN: 'sunborn-sovereign',
  APOLLO_S_HYMN: 'apollo-s-hymn',
  RAPID_FIRE: 'rapid-fire',
  IMPRECATED_POEM: 'imprecated-poem',
  HEALING_NULLIFIED: 'healing-nullified',
  DISORIENTED: 'disoriented',
  ETERNAL_AGONY: 'eternal-agony',

  // Hades
  RESURRECTING: 'resurrecting',
  RESURRECTED: 'resurrected',
  DEATH_KEEPER: 'death-keeper',
  SHADOW_CAMOUFLAGING: 'shadow-camouflaging',
  SOUL_DEVOURER: 'soul-devourer',

  // Persephone
  EFFLORESCENCE_MUSE: 'efflorescence-muse',
  FLORAL_FRAGRANCE: 'floral-fragrance',
  SEASON_SPRING: 'season-spring',
  SEASON_AUTUMN: 'season-autumn',
  SEASON_WINTER: 'season-winter',
  SEASON_SUMMER: 'season-summer',
  POMEGRANATE_OATH_SPIRIT: 'pomegranate-oath-spirit',
} as const;

export type EffectTag = (typeof EFFECT_TAGS)[keyof typeof EFFECT_TAGS];

/** Status category for cleanse/strip mechanics (e.g. "ลบ Affliction" / "ลบ Blessing"). */
export const STATUS_CATEGORY = {
  AFFLICTION: 'affliction',
  BLESSING: 'blessing',
} as const;

export type StatusCategory = (typeof STATUS_CATEGORY)[keyof typeof STATUS_CATEGORY];

/** Tag lists live in data/afflictions.ts and data/blessings.ts. Use getEffectStatusCategory from data/statusCategory.ts. */

/**
 * Map effect tag to MemberChip modifier class.
 * Convention: tag "x-y" → class "mchip--x-y" (used in MemberChip for effect styling).
 */
export function effectTagToClass(tag: EffectTag | string): string {
  return `mchip--${tag}`;
}

export const SEASON_TAG_PREFIX = 'season-';

export function isSeasonTag(tag: EffectTag | string): boolean {
  return typeof tag === 'string' && tag.startsWith(SEASON_TAG_PREFIX);
}

/** Imprecated Poem verse tags (choose one to apply to enemy). */
export const IMPRECATED_POEM_VERSE_TAGS: readonly EffectTag[] = [
  EFFECT_TAGS.HEALING_NULLIFIED,
  EFFECT_TAGS.DISORIENTED,
  EFFECT_TAGS.ETERNAL_AGONY,
] as const;