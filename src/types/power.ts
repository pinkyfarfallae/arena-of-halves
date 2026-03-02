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

export type TargetType = 'enemy' | 'self';

export type ModStat = 'attackDiceUp' | 'defendDiceUp' | 'damage' | 'speed';

/** Power with mechanical effect data from the spreadsheet */
export interface PowerDefinition {
  deity: string;
  type: string; // 'Passive' | '1st Skill' | '2nd Skill' | 'Ultimate'
  name: string;
  description: string;
  available: boolean;

  /* Effect columns */
  effect: EffectType;
  target: TargetType;
  value: number;
  duration: number; // 0 = instant, 999 = permanent (passive)
  modStat?: ModStat;

  /** If true, power bypasses dice rolling (e.g. "ป้องกันไม่ได้", "ไม่ต้องทอยเต๋า") */
  skipDice?: boolean;
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
}

/** Quota cost by power type */
export function getQuotaCost(powerType: string): number {
  if (powerType === 'Ultimate') return 3;
  if (powerType === 'Passive') return 0;
  return 1; // '1st Skill' | '2nd Skill'
}
