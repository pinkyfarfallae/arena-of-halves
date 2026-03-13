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
 * Single source of truth; use in data/powers.ts DEITY_POWERS and in battleRoom, powerEngine, etc.
 */
export const POWER_NAMES = {
  // Zeus
  LIGHTNING_SPARK: 'Lightning Spark',
  BEYOND_THE_NIMBUS: 'Beyond the Nimbus',
  JOLT_ARC: 'Jolt Arc',
  KERAUNOS_VOLTAGE: 'Keraunos Voltage',

  // Poseidon
  OCEAN_BLESSING: 'Ocean Blessing',
  AQUA_PRISON: 'Aqua Prison',
  WHIRLPOOL_SPLASH: 'Whirlpool Splash',
  GIGANTIC_WAVE: 'Gigantic Wave',

  // Demeter
  SUSTAINABILITY: 'Sustainability',
  ROOTING: 'Rooting',
  LIVING_VINE: 'Living Vine',
  WILD_BLOOM: 'Wild Bloom',

  // Ares
  BLOODLUST: 'Bloodlust',
  WAR_CRY: 'War Cry',
  WEAPON_CURSING: 'Weapon Cursing',
  INSANITY: 'Insanity',

  // Athena
  INTELLIGENCE: 'Intelligence',
  WISE_TACTIC: 'Wise Tactic',
  PARRY: 'Parry',
  DISARM: 'Disarm',

  // Apollo
  CHILD_OF_THE_SUN: 'Child of the Sun',
  HEALING_HYMN: 'Healing Hymn',
  ARCHERY_MASTER: 'Archery Master',
  VOLLEY_ARROW: 'Volley Arrow',

  // Hephaestus
  IRON_SKIN: 'Iron Skin',
  THE_BLACKSMITH: 'The Blacksmith',
  OVERHEAT: 'Overheat',
  PROTECTIVE_AEGIS: 'Protective Aegis',

  // Aphrodite
  IN_THE_NAME_OF_LOVE: 'In the Name of Love',
  FASHION_QUEEN: 'Fashion Queen',
  OVERFIT_OUTFIT: 'Overfit Outfit',
  CHARMSPEAK: 'Charmspeak',

  // Hermes
  ALWAYS_FASTER: 'Always Faster',
  OPPORTUNITY: 'Opportunity',
  RUSH_MOMENT: 'Rush Moment',
  TIME_TO_BE_THIEF: 'Time to be Thief',

  // Dionysus
  UNCONTROLLABLE: 'Uncontrollable',
  GRAPE_JUICE_POTION: 'Grape Juice Potion',
  INTO_THE_MADNESS: 'Into the Madness',
  PACIFY_TO_PEACE: 'Pacify to Peace',

  // Hades
  DEATH_KEEPER: 'Death Keeper',
  SHADOW_CAMOUFLAGING: 'Shadow Camouflaging',
  UNDEAD_ARMY: 'Undead Army',
  SOUL_DEVOURER: 'Soul Devourer',

  // Hypnos
  COZY_VIBE: 'Cozy Vibe',
  SLEEPY_HEAD: 'Sleepy Head',
  MEMORY_ALTERATION: 'Memory Alteration',
  SWEET_DREAM: 'Sweet Dream',

  // Nemesis
  REPAY: 'Repay',
  SWEETEST_VENGEANCE: 'Sweetest Vengeance',
  PURSUE_A_VENDETTA: 'Pursue a Vendetta',
  JUSTICE_TO_ALL: 'Justice to All',

  // Hecate
  COST_OF_THE_CAST: 'Cost of the Cast',
  BLACK_MAGIC: 'Black Magic',
  SPELL_INCANTATION: 'Spell Incantation',
  THE_MIST: 'The Mist',

  // Persephone
  SECRET_OF_DRYAD: 'Floral Maiden',
  FLORAL_FRAGRANCE: 'Floral Fragrance',
  EPHEMERAL_SEASON: 'Ephemeral Season',
  POMEGRANATES_OATH: "Pomegranate's Oath",
} as const;

export type PowerName = (typeof POWER_NAMES)[keyof typeof POWER_NAMES];
