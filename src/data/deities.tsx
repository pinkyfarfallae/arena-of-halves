import React from 'react';
import { DEITY } from '../constants/deities';
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

export const DEITY_SVG: Record<string, React.ReactNode> = {
  zeus: <Zeus />,
  poseidon: <Poseidon />,
  demeter: <Demeter />,
  ares: <Ares />,
  athena: <Athena />,
  apollo: <Apollo />,
  hephaestus: <Hephaestus />,
  aphrodite: <Aphrodite />,
  hermes: <Hermes />,
  dionysus: <Dionysus />,
  hades: <Hades />,
  persephone: <Persephone />,
  hypnos: <Hypnos />,
  nemesis: <Nemesis />,
  hecate: <Hecate />,
  hera: <Hera />,
  artemis: <Artemis />,
  iris: <Iris />,
  nike: <Nike />,
  hebe: <Hebe />,
  tyche: <Tyche />,
};

export const DEITY_ALIASES: Record<string, string> = {
  persaphone: DEITY.PERSEPHONE.toLowerCase(),
};

export function parseDeityNames(raw: string): string[] {
  return raw.toLowerCase().trim()
    .split(/\s+and\s+/)
    .map(n => {
      const clean = n.replace(/[^a-z]/g, '');
      if (DEITY_ALIASES[clean]) return DEITY_ALIASES[clean];
      for (const key of Object.keys(DEITY_SVG)) {
        if (key.startsWith(clean) || clean.startsWith(key)) return key;
      }
      return clean;
    });
}
