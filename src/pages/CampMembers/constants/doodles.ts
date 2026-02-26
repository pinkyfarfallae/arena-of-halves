import type { DoodleType, DoodlePos } from '../../../types/doodle';
export type { DoodleType, DoodlePos };

export const GENERIC_DOODLES: DoodleType[] = ['star', 'bolt', 'arrow', 'heart', 'swirl', 'sparkle', 'circle', 'wave'];

export const DEITY_DOODLES: Record<string, DoodleType[]> = {
  zeus:       ['bolt', 'star', 'cloud', 'crown', 'sparkle', 'flame'],
  poseidon:   ['trident', 'wave', 'shell', 'fish', 'swirl', 'circle'],
  demeter:    ['leaf', 'wheat', 'flower', 'vine', 'circle', 'swirl'],
  ares:       ['sword', 'shield', 'spear', 'flame', 'star', 'bolt'],
  athena:     ['owl', 'scroll', 'shield', 'olive', 'star', 'sparkle'],
  apollo:     ['lyre', 'sun', 'laurel', 'arrow', 'star', 'sparkle'],
  hephaestus: ['hammer', 'gear', 'anvil', 'flame', 'sparkle', 'bolt'],
  aphrodite:  ['heart', 'rose', 'dove', 'mirror', 'sparkle', 'swirl'],
  hermes:     ['wing', 'coin', 'caduceus', 'arrow', 'star', 'swirl'],
  dionysus:   ['grape', 'cup', 'ivy', 'vine', 'swirl', 'circle'],
  hades:      ['skull', 'gem', 'crown', 'flame', 'cerberus', 'star'],
  persephone: ['flower', 'pomegranate', 'leaf', 'rose', 'swirl', 'heart'],
  hypnos:     ['moon', 'cloud', 'zzz', 'star', 'swirl', 'circle'],
  nemesis:    ['scales', 'sword', 'eye', 'wing', 'star', 'circle'],
  hecate:     ['torch', 'moon', 'key', 'star', 'sparkle', 'circle'],
  hera:       ['crown', 'peacock', 'scepter', 'flower', 'star', 'sparkle'],
  artemis:    ['moon', 'bow', 'deer', 'arrow', 'star', 'sparkle'],
  iris:       ['rainbow', 'prism', 'wing', 'cloud', 'sparkle', 'star'],
  nike:       ['wing', 'wreath', 'trophy', 'star', 'sparkle', 'bolt'],
  hebe:       ['goblet', 'youth', 'flower', 'cup', 'sparkle', 'star'],
  tyche:      ['wheel', 'coin', 'clover', 'dice', 'star', 'sparkle'],
};

/* 16 position slots scattered around the photo */
export const DOODLE_POSITIONS: DoodlePos[] = ['tl', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br', 'itl', 'itr', 'ibl', 'ibr', 'ml2', 'mr2', 'bl2', 'br2'];
