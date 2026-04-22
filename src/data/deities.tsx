import React from 'react';
import { Deity, DEITY } from '../constants/deities';
import Zeus from './icons/deities/Zeus';
import Poseidon from './icons/deities/Poseidon';
import Demeter from './icons/deities/Demeter';
import Ares from './icons/deities/Ares';
import Athena from './icons/deities/Athena';
import Apollo from './icons/deities/Apollo';
import Hephaestus from './icons/deities/Hephaestus';
import Aphrodite from './icons/deities/Aphrodite';
import Hermes from './icons/deities/Hermes';
import Dionysus from './icons/deities/Dionysus';
import Hades from './icons/deities/Hades';
import Persephone from './icons/deities/Persephone';
import Hypnos from './icons/deities/Hypnos';
import Nemesis from './icons/deities/Nemesis';
import Hecate from './icons/deities/Hecate';
import Hera from './icons/deities/Hera';
import Artemis from './icons/deities/Artemis';
import Iris from './icons/deities/Iris';
import Nike from './icons/deities/Nike';
import Hebe from './icons/deities/Hebe';
import Tyche from './icons/deities/Tyche';
import Morpheus from './icons/deities/Morpheus';
import { DEITY_HADES_AND_PERSEPHONE } from '../pages/AdminManager/pages/PowerVfxDemo/utils/constants';

export const DEITY_SVG: Record<Deity, React.ReactNode> = {
  [DEITY.ZEUS]: <Zeus />,
  [DEITY.POSEIDON]: <Poseidon />,
  [DEITY.DEMETER]: <Demeter />,
  [DEITY.ARES]: <Ares />,
  [DEITY.ATHENA]: <Athena />,
  [DEITY.APOLLO]: <Apollo />,
  [DEITY.HEPHAESTUS]: <Hephaestus />,
  [DEITY.APHRODITE]: <Aphrodite />,
  [DEITY.HERMES]: <Hermes />,
  [DEITY.DIONYSUS]: <Dionysus />,
  [DEITY.HADES]: <Hades />,
  [DEITY.PERSEPHONE]: <Persephone />,
  [DEITY.HYPNOS]: <Hypnos />,
  [DEITY.NEMESIS]: <Nemesis />,
  [DEITY.HECATE]: <Hecate />,
  [DEITY.HERA]: <Hera />,
  [DEITY.ARTEMIS]: <Artemis />,
  [DEITY.IRIS]: <Iris />,
  [DEITY.NIKE]: <Nike />,
  [DEITY.HEBE]: <Hebe />,
  [DEITY.TYCHE]: <Tyche />,
  [DEITY.MORPHEUS]: <Morpheus />,
  [DEITY_HADES_AND_PERSEPHONE]: <Persephone />
};

export const DEITY_ALIASES: Record<string, Deity> = {
  persaphone: DEITY.PERSEPHONE,
};

/** Resolve deity string (any case) to DEITY key for DEITY_SVG lookup. */
export function toDeityKey(name: string): Deity | undefined {
  const key = name.trim();
  if (key in DEITY_SVG) return key as Deity;
  const clean = key.toLowerCase().replace(/[^a-z]/g, '');
  const fromAlias = DEITY_ALIASES[clean];
  if (fromAlias) return fromAlias;
  for (const k of Object.keys(DEITY_SVG) as (keyof typeof DEITY_SVG)[]) {
    if (k.toLowerCase().replace(/[^a-z]/g, '').startsWith(clean) || clean.startsWith(k.toLowerCase().replace(/[^a-z]/g, '')))
      return k as Deity;
  }
  return undefined;
}

export function parseDeityNames(raw: string): string[] {
  return raw.toLowerCase().trim()
    .split(/\s+and\s+/)
    .map(n => {
      const clean = n.replace(/[^a-z]/g, '');
      if (DEITY_ALIASES[clean]) return DEITY_ALIASES[clean];
      for (const key of Object.keys(DEITY_SVG) as (keyof typeof DEITY_SVG)[]) {
        const keyLc = key.toLowerCase().replace(/[^a-z]/g, '');
        if (keyLc.startsWith(clean) || clean.startsWith(keyLc)) return key;
      }
      return n.trim();
    });
}
