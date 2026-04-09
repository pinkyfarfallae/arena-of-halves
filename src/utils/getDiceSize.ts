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
