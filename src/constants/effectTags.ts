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

  // Hades
  RESURRECTED: 'resurrected',
  DEATH_KEEPER: 'death-keeper',
  SOUL_DEVOURER: 'soul-devourer',

  // Persephone
  PETAL_SHIELD: 'petal-shield',
  SEASON_SPRING: 'season-spring',
  SEASON_AUTUMN: 'season-autumn',
  SEASON_WINTER: 'season-winter',
  SEASON_SUMMER: 'season-summer',
  POMEGRANATE_SPIRIT: 'pomegranate-spirit',
} as const;

export type EffectTag = (typeof EFFECT_TAGS)[keyof typeof EFFECT_TAGS];

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