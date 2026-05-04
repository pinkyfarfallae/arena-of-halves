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
  LIGHTNING_SPARK: 'Voltage Tempest-Bound',
  BEYOND_THE_NIMBUS: 'Beyond the Nimbus',
  JOLT_ARC: 'Arc of Jolt Ruination',
  KERAUNOS_VOLTAGE: 'Apotheosis of Keraunos',

  // Poseidon
  OCEAN_BLESSING: 'Thalassic Dominion',
  AQUA_PRISON: 'Abyssal Enchainment',
  WHIRLPOOL_SPLASH: 'Ravenous Undertow',
  GIGANTIC_WAVE: 'Infinite Deluge',

  // Demeter
  SUSTAINABILITY: 'Sustainability',
  ROOTING: 'Rooting',
  LIVING_VINE: 'Living Vine',
  WILD_BLOOM: 'Wild Bloom',

  // Ares
  BLOODLUST: 'Bloodbound Frenzy',
  WAR_CRY: 'Wrathful War Cry',
  WEAPON_CURSING: 'Curse of Nullsteel',
  INSANITY: "Berserker's Cataclysm",

  // Athena
  INTELLIGENCE: 'Clairvoyant Grace',
  WISE_TACTIC: 'Insightful Tactic',
  PARRY: 'Disarm',
  DISARM: 'Reliable Plan',

  // Apollo
  SUNBORN_SOVEREIGN: "Sunborn Sovereign",
  APOLLO_S_HYMN: "Apollo's Hymn",
  IMPRECATED_POEM: 'Imprecated Poem',
  VOLLEY_ARROW: 'Volley Arrow',

  // Hephaestus
  THE_BLACKSMITH: 'The Blacksmith',
  UPGRADED_ARMORY: 'Upgraded Armory',
  STEEL_GAUNTLET: 'Steel Gauntlet',
  PROTECTIVE_AEGIS: 'Protective Aegis',

  // Aphrodite
  IN_THE_NAME_OF_LOVE: 'In the Name of Love',
  PASSIONATE_ALLURING: 'Passionate Alluring',
  FASHIONISTA_QUEEN: 'Fashionista Queen',
  CHARMSPEAK: 'Euphonic Charmspeak',

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
  LULLABYS_RESPIRITE: 'Lullaby\'s Respirite',
  DORMANT_LETHARGY: 'Dormant Lethargy',
  FALSE_MEMORY: 'False Memory',
  DREAMFUL_AMBIVALENCE: 'Dreamful Ambivalence',

  // Nemesis
  UNPAID_VENGEANCE: 'Unpaid Vengeance',
  REPAY_TENFOLD: 'Repay Tenfold',
  PURSUE_A_VENDETTA: 'Pursue a Vendetta',
  BOUND_OF_KARMA: 'Bound of Karma',

  // Hecate
  THE_ARTIFICERS_TOLL: 'The Artificer\'s Toll',
  UMBRAL_MALICE: 'Umbral Malice',
  ARCANE_INVOCATION: 'Arcane Invocation',
  MIST_EVASION: 'Mist Evasion',

  // Persephone
  THE_APORRETA_OF_NYMPHAION: 'The Aporrēta of Nymphaion',
  SERENITY_BLOSSOM_REVERIE: 'Serenity Blossom Reverie',
  EPHEMERA_SOLSTICE: 'Ephemera Solstice',
  POMEGRANATES_IRREVOCABLE_OATH: "Pomegranate's Irrevocable Oath",

  // Morpheus
  VISIONS_OF_PHANTASMAGORIA: 'Visions of Phantasmagoria',
  EPITAPH_OF_SOMNUS: 'Epitaph of Somnus',
  LUCID_DREAMING: 'Lucid Dreaming',
  ONEIRONAUTS_REALM_OF_SLUMBER: 'Oneironaut’s Realm of Slumber',

  // Tyche
  BLESSED_FORTUNE_CURSED_FATE: 'Blessed Fortune & Cursed Fate',
  FORTUNA_ENTWINED: 'Fortuna Entwined',
  RISK_THE_FATES: 'Risk the Fates',
  JACKPOT: 'Jackpot !',

  // Nyx
  VEIL_OF_DUSK: 'Veil of Dusk',
  GLOOMY_STRIKE: 'Gloomy Strike',
  NIGHTSHADES_REQUIEM: 'Nightshade\'s Requiem',
  EVERLASTING_NIGHT: 'Everlasting Night',

  // Hemera
  AURA_OF_DAWN: 'Aura of Dawn',
  RADIANCE_SHIELD: 'Radiance Shield',
  LUMINOUS_MIRAGE: 'Luminous Mirage',
  LUMINESCENT_EPIPHANY: 'Luminescent Epiphany',

  // Amphitrite
  ALLEGIANCE_OF_THE_MARINA: 'Allegiance of the Marina',
  TIDAL_TRANSFLUENCE: 'Tidal Transfluence',
  AQUATIC_SIMULACRUM: 'Aquatic Simulacrum',
  OCEANIC_HARMONIC: 'Oceanic Harmonic',
} as const;

export type PowerName = (typeof POWER_NAMES)[keyof typeof POWER_NAMES];

/** Powers where defender cannot defend — skip ROLLING_DEFEND and go straight to RESOLVING with defendRoll: 0 (no defend modal). */
export const POWERS_DEFENDER_CANNOT_DEFEND: readonly PowerName[] = [
  // Zeus
  POWER_NAMES.KERAUNOS_VOLTAGE,
  // Hades
  POWER_NAMES.SOUL_DEVOURER,
];
