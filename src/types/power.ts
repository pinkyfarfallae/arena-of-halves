export type EffectType =
  | 'damage'
  | 'heal'
  | 'buff'
  | 'debuff'
  | 'shield'
  | 'dot'
  | 'stun'
  | 'lifesteal'
  | 'reflect'
  | 'cleanse'
  | 'reroll_grant';

export type TargetType = 'enemy' | 'self' | 'ally';

export type ModStat =
  | 'attackDiceUp'
  | 'defendDiceUp'
  | 'damage'
  | 'speed'
  | 'criticalRate'
  | 'maxHp';

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

  /** If true, power requires season selection before targeting (e.g. Persephone's Borrowed Season) */
  requiresSeasonSelection?: boolean;
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
  /** Semantic tag for special mechanics (e.g. 'shock' for Lightning Reflex) */
  tag?: string;
}

/** Quota cost by power type */
export function getQuotaCost(powerType: string): number {
  if (powerType === 'Ultimate') return 3;
  if (powerType === 'Passive') return 0;
  return 1; // '1st Skill' | '2nd Skill'
}
