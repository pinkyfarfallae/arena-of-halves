/**
 * Effect tags used in ActiveEffect.tag for special mechanics.
 * Use these constants instead of string literals everywhere.
 */
export const EFFECT_TAGS = {
  DEATH_KEEPER: 'death-keeper',
  SHOCK: 'shock',
  POMEGRANATE_SPIRIT: 'pomegranate-spirit',
  PETAL_SHIELD: 'petal-shield',
  RESURRECTED: 'resurrected',
  STUN: 'stun',
  SEASON_SPRING: 'season-spring',
  SEASON_AUTUMN: 'season-autumn',
} as const;

export type EffectTag = (typeof EFFECT_TAGS)[keyof typeof EFFECT_TAGS];

/**
 * Map effect tag to MemberChip modifier class.
 * Convention: tag "x-y" → class "mchip--x-y" (used in MemberChip for effect styling).
 */
export function effectTagToClass(tag: EffectTag | string): string {
  return `mchip--${tag}`;
}
