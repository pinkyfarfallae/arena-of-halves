import React from 'react';
import { DEITY } from '../constants/deities';
import Zeus from './icons/Zeus';
import Poseidon from './icons/Poseidon';
import Demeter from './icons/Demeter';
import Ares from './icons/Ares';
import Athena from './icons/Athena';
import Apollo from './icons/Apollo';
import Hephaestus from './icons/Hephaestus';
import Aphrodite from './icons/Aphrodite';
import Hermes from './icons/Hermes';
import Dionysus from './icons/Dionysus';
import Hades from './icons/Hades';
import Persephone from './icons/Persephone';
import Hypnos from './icons/Hypnos';
import Nemesis from './icons/Nemesis';
import Hecate from './icons/Hecate';
import Hera from './icons/Hera';
import Artemis from './icons/Artemis';
import Iris from './icons/Iris';
import Nike from './icons/Nike';
import Hebe from './icons/Hebe';
import Tyche from './icons/Tyche';

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
