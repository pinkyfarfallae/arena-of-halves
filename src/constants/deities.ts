import { DEITY_HADES_AND_PERSEPHONE } from "../pages/AdminManager/pages/PowerVfxDemo/utils/constants";

export const DEITY = {
  ZEUS: 'Zeus',
  POSEIDON: 'Poseidon',
  DEMETER: 'Demeter',
  ARES: 'Ares',
  ATHENA: 'Athena',
  APOLLO: 'Apollo',
  HEPHAESTUS: 'Hephaestus',
  APHRODITE: 'Aphrodite',
  HERMES: 'Hermes',
  DIONYSUS: 'Dionysus',
  HADES: 'Hades',
  PERSEPHONE: 'Persephone',
  HYPNOS: 'Hypnos',
  NEMESIS: 'Nemesis',
  HECATE: 'Hecate',
  HERA: 'Hera',
  ARTEMIS: 'Artemis',
  IRIS: 'Iris',
  NIKE: 'Nike',
  HEBE: 'Hebe',
  TYCHE: 'Tyche',
  MORPHEUS: 'Morpheus',
} as const;

/** Deity display name (PascalCase) — use for labels, DEITY_POWERS, and DEITY_SVG keys. */
export type Deity = (typeof DEITY)[keyof typeof DEITY] | typeof DEITY_HADES_AND_PERSEPHONE;

/** Standard Camp Half-Blood cabin numbers by deity */
export const DEITY_CABIN: Record<string, number> = {
  [DEITY.ZEUS]: 1,
  [DEITY.HERA]: 2,
  [DEITY.POSEIDON]: 3,
  [DEITY.DEMETER]: 4,
  [DEITY.ARES]: 5,
  [DEITY.ATHENA]: 6,
  [DEITY.APOLLO]: 7,
  [DEITY.ARTEMIS]: 8,
  [DEITY.HEPHAESTUS]: 9,
  [DEITY.APHRODITE]: 10,
  [DEITY.HERMES]: 11,
  [DEITY.DIONYSUS]: 12,
  [DEITY.HADES]: 13,
  [DEITY.IRIS]: 14,
  [DEITY.HYPNOS]: 15,
  [DEITY.NEMESIS]: 16,
  [DEITY.NIKE]: 17,
  [DEITY.HEBE]: 18,
  [DEITY.TYCHE]: 19,
  [DEITY.HECATE]: 20,

  // Addition
  [DEITY.MORPHEUS]: 23,
};

/** Cabin map to deity */
export const CABIN_DEITY: Record<number, string> = Object.fromEntries(
  Object.entries(DEITY_CABIN).map(([deity, cabin]) => [cabin, deity])
);