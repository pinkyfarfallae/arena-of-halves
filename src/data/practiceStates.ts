import { PRACTICE_STATS } from "../constants/practice";
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
    id: PRACTICE_STATS.STRENGTH,
    name: 'Strength',
    color: '#c74b4b',
  },
  {
    id: PRACTICE_STATS.MOBILITY,
    name: 'Mobility',
    color: '#a64d79',
  },
  {
    id: PRACTICE_STATS.INTELLIGENCE,
    name: 'Intelligence',
    color: '#e47d53',
  },
  {
    id: PRACTICE_STATS.TECHNIQUE,
    name: 'Technique',
    color: '#3c78d8',
  },
  {
    id: PRACTICE_STATS.EXPERIENCE,
    name: 'Experience',
    color: '#68af62',
  },
  {
    id: PRACTICE_STATS.FORTUNE,
    name: 'Fortune',
    color: '#1a859c',
  },
];