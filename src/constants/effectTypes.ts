/**
 * Effect type strings (must match EffectType in types/power.ts).
 * Use for power.effect and ActiveEffect.effectType comparisons.
 */
export const EFFECT_TYPES = {
  DAMAGE: 'damage',
  HEAL: 'heal',
  BUFF: 'buff',
  DEBUFF: 'debuff',
  SHIELD: 'shield',
  DOT: 'dot',
  STUN: 'stun',
  LIFESTEAL: 'lifesteal',
  REFLECT: 'reflect',
  CLEANSE: 'cleanse',
  REROLL_GRANT: 'reroll_grant',
} as const;

export type EffectTypeValue = (typeof EFFECT_TYPES)[keyof typeof EFFECT_TYPES];

/**
 * Target type strings (must match TargetType in types/power.ts).
 */
export const TARGET_TYPES = {
  AREA: 'area',
  ENEMY: 'enemy',
  SELF: 'self',
  ALLY: 'ally',
} as const;

export type TargetTypeValue = (typeof TARGET_TYPES)[keyof typeof TARGET_TYPES];

/**
 * ModStat strings (must match ModStat in types/power.ts).
 * Use for power.modStat and ActiveEffect.modStat comparisons.
 */
export const MOD_STAT = {
  ATTACK_DICE_UP: 'attackDiceUp',
  DEFEND_DICE_UP: 'defendDiceUp',
  RECOVERY_DICE_UP: 'recoveryDiceUp',
  DAMAGE: 'damage',
  SPEED: 'speed',
  CRITICAL_RATE: 'criticalRate',
  MAX_HP: 'maxHp',
  SHADOW_CAMOUFLAGED: 'shadowCamouflaged',
  SKELETON_COUNT: 'skeletonCount',
} as const;

export type ModStatValue = (typeof MOD_STAT)[keyof typeof MOD_STAT];
