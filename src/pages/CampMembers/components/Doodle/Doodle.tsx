import type { FC, SVGProps } from 'react';
import './Doodle.scss';

import Star from './icons/Star';
import Bolt from './icons/Bolt';
import Arrow from './icons/Arrow';
import Heart from './icons/Heart';
import Swirl from './icons/Swirl';
import Sparkle from './icons/Sparkle';
import Circle from './icons/Circle';
import Wave from './icons/Wave';
import Skull from './icons/Skull';
import Gem from './icons/Gem';
import Crown from './icons/Crown';
import Flame from './icons/Flame';
import Cerberus from './icons/Cerberus';
import Leaf from './icons/Leaf';
import Wheat from './icons/Wheat';
import Flower from './icons/Flower';
import Vine from './icons/Vine';
import Rose from './icons/Rose';
import Dove from './icons/Dove';
import Mirror from './icons/Mirror';
import Trident from './icons/Trident';
import Shell from './icons/Shell';
import Fish from './icons/Fish';
import Sword from './icons/Sword';
import Shield from './icons/Shield';
import Spear from './icons/Spear';
import Owl from './icons/Owl';
import Scroll from './icons/Scroll';
import Olive from './icons/Olive';
import Lyre from './icons/Lyre';
import Sun from './icons/Sun';
import Laurel from './icons/Laurel';
import Hammer from './icons/Hammer';
import Gear from './icons/Gear';
import Anvil from './icons/Anvil';
import Wing from './icons/Wing';
import Coin from './icons/Coin';
import Caduceus from './icons/Caduceus';
import Grape from './icons/Grape';
import Cup from './icons/Cup';
import Ivy from './icons/Ivy';
import Moon from './icons/Moon';
import Cloud from './icons/Cloud';
import Zzz from './icons/Zzz';
import Scales from './icons/Scales';
import Eye from './icons/Eye';
import Torch from './icons/Torch';
import Key from './icons/Key';
import Peacock from './icons/Peacock';
import Scepter from './icons/Scepter';
import Bow from './icons/Bow';
import Deer from './icons/Deer';
import Rainbow from './icons/Rainbow';
import Prism from './icons/Prism';
import Wreath from './icons/Wreath';
import Trophy from './icons/Trophy';
import Goblet from './icons/Goblet';
import Youth from './icons/Youth';
import Wheel from './icons/Wheel';
import Clover from './icons/Clover';
import Dice from './icons/Dice';
import Pomegranate from './icons/Pomegranate';

/* ── Doodle types & deity mapping ── */
export type DoodleType =
  | 'star' | 'bolt' | 'arrow' | 'heart' | 'swirl' | 'sparkle' | 'circle' | 'wave'
  | 'skull' | 'gem' | 'crown' | 'flame'
  | 'leaf' | 'wheat' | 'flower' | 'vine'
  | 'rose' | 'dove' | 'mirror'
  | 'trident' | 'shell' | 'fish'
  | 'sword' | 'shield' | 'spear'
  | 'owl' | 'scroll' | 'olive'
  | 'lyre' | 'sun' | 'laurel'
  | 'hammer' | 'gear' | 'anvil'
  | 'wing' | 'coin' | 'caduceus'
  | 'grape' | 'cup' | 'ivy'
  | 'moon' | 'cloud' | 'zzz'
  | 'scales' | 'eye'
  | 'torch' | 'key'
  | 'peacock' | 'scepter'
  | 'bow' | 'deer'
  | 'rainbow' | 'prism'
  | 'wreath' | 'trophy'
  | 'goblet' | 'youth'
  | 'wheel' | 'clover' | 'dice'
  | 'pomegranate'
  | 'cerberus';

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
export type DoodlePos = 'tl' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br' | 'itl' | 'itr' | 'ibl' | 'ibr' | 'ml2' | 'mr2' | 'bl2' | 'br2';
export const DOODLE_POSITIONS: DoodlePos[] = ['tl', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br', 'itl', 'itr', 'ibl', 'ibr', 'ml2', 'mr2', 'bl2', 'br2'];

const DOODLE_MAP: Record<string, FC<SVGProps<SVGSVGElement>>> = {
  star: Star, bolt: Bolt, arrow: Arrow, heart: Heart,
  swirl: Swirl, sparkle: Sparkle, circle: Circle, wave: Wave,
  skull: Skull, gem: Gem, crown: Crown, flame: Flame, cerberus: Cerberus,
  leaf: Leaf, wheat: Wheat, flower: Flower, vine: Vine,
  rose: Rose, dove: Dove, mirror: Mirror,
  trident: Trident, shell: Shell, fish: Fish,
  sword: Sword, shield: Shield, spear: Spear,
  owl: Owl, scroll: Scroll, olive: Olive,
  lyre: Lyre, sun: Sun, laurel: Laurel,
  hammer: Hammer, gear: Gear, anvil: Anvil,
  wing: Wing, coin: Coin, caduceus: Caduceus,
  grape: Grape, cup: Cup, ivy: Ivy,
  moon: Moon, cloud: Cloud, zzz: Zzz,
  scales: Scales, eye: Eye,
  torch: Torch, key: Key,
  peacock: Peacock, scepter: Scepter,
  bow: Bow, deer: Deer,
  rainbow: Rainbow, prism: Prism,
  wreath: Wreath, trophy: Trophy,
  goblet: Goblet, youth: Youth,
  wheel: Wheel, clover: Clover, dice: Dice,
  pomegranate: Pomegranate,
};

function Doodle({ type, pos }: { type: DoodleType; pos: DoodlePos }) {
  const cls = `camp__doodle camp__doodle--${pos}`;
  const svgProps = { className: cls, viewBox: '0 0 32 32', fill: 'none' as const, 'aria-hidden': true as const };
  const Icon = DOODLE_MAP[type] ?? Star;
  return <Icon {...svgProps} />;
}

export default Doodle;
