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
  APOLLO_S_HYMN: 'apollo-s-hymn',

  // Hades
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
  POMEGRANATE_SPIRIT: 'pomegranate-spirit',
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