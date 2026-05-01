import { DEITY } from '../constants/deities';

/**
 * Get the dice size for attack/defend rolls based on Iris wish.
 * - Hypnos: D10 (lower variance, more consistent)
 * - Tyche: D20 (higher variance, more luck-based)
 * - Default: D12 (standard)
 */
export function getDiceSize(wishOfIris: string | null | undefined): 10 | 12 | 20 {
  if (wishOfIris === DEITY.HYPNOS) return 10;
  if (wishOfIris === DEITY.TYCHE) return 20;
  return 12;
}

/**
 * Tyche advantage: roll a second D20 and return the higher of the two.
 * Raises probability of getting 13+ from 40% → 64%.
 */
export function tycheAdvantageRoll(roll: number): number {
  const second = Math.floor(Math.random() * 20) + 1;
  return Math.max(roll, second);
}
