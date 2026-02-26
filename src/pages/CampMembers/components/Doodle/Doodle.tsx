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
import type { DoodleType, DoodlePos } from '../../constants/doodles';

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
