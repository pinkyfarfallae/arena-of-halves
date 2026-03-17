import { EffectTag } from '../constants/effectTags';
import { POWER_TYPES } from '../constants/powers';

/** Effect type for powers; aligned with constants/effectTypes EFFECT_TYPES. */
export type EffectType = import('../constants/effectTypes').EffectTypeValue;

/** Target type for effects; aligned with constants/effectTypes TARGET_TYPES. */
export type TargetType = import('../constants/effectTypes').TargetTypeValue;

/** ModStat for effect modifiers; aligned with constants/effectTypes MOD_STAT. */
export type ModStat = import('../constants/effectTypes').ModStatValue;

/** A single mechanical effect entry (used inside the effects[] array). */
export interface PowerEffect {
  effect: EffectType;
  target: TargetType;
  value: number;
  duration: number; // 0 = instant, 999 = permanent (passive)
  modStat?: ModStat;
}

/** Power with mechanical effect data from the spreadsheet */
export interface PowerDefinition {
  deity: string;
  type: string; // 'Passive' | '1st Skill' | '2nd Skill' | 'Ultimate'
  name: string;
  description: string;
  available: boolean;

  /* Primary effect columns (single-effect shorthand) */
  effect: EffectType;
  target: TargetType;
  value: number;
  duration: number; // 0 = instant, 999 = permanent (passive)
  modStat?: ModStat;

  /** Full effect list for multi-effect powers. When present, the engine
   *  should iterate this array instead of the single-effect fields above. */
  effects?: PowerEffect[];

  /** If true, power bypasses dice rolling (e.g. "ป้องกันไม่ได้", "ไม่ต้องทอยเต๋า") */
  skipDice?: boolean;

  /** If true, power requires season selection before targeting (e.g. Persephone's Ephemeral Season) */
  requiresSeasonSelection?: boolean;

  /** If true, power requires poem verse selection before targeting (e.g. Apollo's Imprecated Poem) */
  requiresPoemSelection?: boolean;

  /** If set, only targets with this effect tag can be selected (e.g., 'shock' for Jolt Arc) */
  requiresTargetHasEffect?: string;

  /** If set, the power will afflict the target with the given afflictions. */
  afflictions?: EffectTag[];

  /** If set, the power grants the given blessings (for data/statusCategory and strip mechanics). */
  blessings?: EffectTag[];
}

/** An active effect applied to a fighter during battle */
export interface ActiveEffect {
  id: string;
  powerName: string;
  effectType: EffectType;
  sourceId: string;
  targetId: string;
  value: number;
  modStat?: ModStat;
  turnsRemaining: number;
  /** Semantic tag for special mechanics (e.g. 'shock' for Lightning Reflex). For Imprecated Poem: verse tag (HEALING_NULLIFIED, etc.). */
  tag?: string;
  /** Second tag (e.g. IMPRECATED_POEM for any verse effect). */
  tag2?: string;
}

/** Quota cost by power type */
export function getQuotaCost(powerType: string): number {
  if (powerType === POWER_TYPES.ULTIMATE) return 3;
  if (powerType === POWER_TYPES.PASSIVE) return 0;
  return 1; // '1st Skill' | '2nd Skill'
}
