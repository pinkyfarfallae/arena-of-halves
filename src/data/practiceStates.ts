import { PRACTICE_STATES } from "../constants/practiceStates";
import Ares from "../data/icons/deities/Ares";
import Hermes from "../data/icons/deities/Hermes";
import Athena from "../data/icons/deities/Athena";
import Apollo from "../data/icons/deities/Apollo";
import Demeter from "../data/icons/deities/Demeter";
import Tyche from "../data/icons/deities/Tyche";
import { Character } from "./characters";

export const CHARACTER_PRACTICE_STATES = (character: Character) => {
  return [
    ['Strength', character.strength],
    ['Mobility', character.mobility],
    ['Intelligence', character.intelligence],
    ['Technique', character.technique],
    ['Experience', character.experience],
    ['Fortune', character.fortune]
  ];
};

export const PRACTICE_STATES_DETAIL = [
  {
    id: PRACTICE_STATES.STRENGTH,
    name: 'Strength',
    color: '#c74b4b',
  },
  {
    id: PRACTICE_STATES.MOBILITY,
    name: 'Mobility',
    color: '#a64d79',
  },
  {
    id: PRACTICE_STATES.INTELLIGENCE,
    name: 'Intelligence',
    color: '#e47d53',
  },
  {
    id: PRACTICE_STATES.TECHNIQUE,
    name: 'Technique',
    color: '#3c78d8',
  },
  {
    id: PRACTICE_STATES.EXPERIENCE,
    name: 'Experience',
    color: '#68af62',
  },
  {
    id: PRACTICE_STATES.FORTUNE,
    name: 'Fortune',
    color: '#1a859c',
  },
];