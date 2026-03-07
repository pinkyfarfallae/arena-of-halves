/**
 * Power type strings (must match data/powers.ts and types/power.ts).
 */
export const POWER_TYPES = {
  PASSIVE: 'Passive',
  FIRST_SKILL: '1st Skill',
  SECOND_SKILL: '2nd Skill',
  ULTIMATE: 'Ultimate',
} as const;

export type PowerType = (typeof POWER_TYPES)[keyof typeof POWER_TYPES];

/**
 * Canonical power names — use for comparisons (usedPowerName, power.name, disabled set).
 * Add new entries when new powers need special handling in battleRoom, BattleHUD, etc.
 */
export const POWER_NAMES = {
  DEATH_KEEPER: 'Death Keeper',
  FLORAL_FRAGRANCE: 'Floral Fragrance',
  LIGHTNING_REFLEX: 'Lightning Reflex',
  JOLT_ARC: 'Jolt Arc',
  THUNDERBOLT: 'Thunderbolt',
  SECRET_OF_DRYAD: 'Secret of Dryad',
  EPHEMERAL_SEASON: 'Ephemeral Season',
  UNDEAD_ARMY: 'Undead Army',
  POMEGRANATES_OATH: "Pomegranate's Oath",
} as const;

export type PowerName = (typeof POWER_NAMES)[keyof typeof POWER_NAMES];
