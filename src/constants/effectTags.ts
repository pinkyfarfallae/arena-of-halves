/**
 * Effect tags used in ActiveEffect.tag for special mechanics.
 * Use these constants instead of string literals everywhere.
 */
export const EFFECT_TAGS = {
  // Zeus
  SHOCK: 'shock',

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
