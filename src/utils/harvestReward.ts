/**
 * Parse drachma reward from harvest submission
 * Handles both legacy number format and new JSON map format
 */
export function parseDrachmaReward(
  drachmaReward: number | string | undefined,
  isSolo: boolean
): { display: number; label: string } {
  if (!drachmaReward) {
    return { display: 0, label: 'total' };
  }

  // Legacy format: plain number
  if (typeof drachmaReward === 'number') {
    return {
      display: drachmaReward,
      label: isSolo ? 'total' : 'per person'
    };
  }

  // New format: JSON string map { "characterId": amount }
  const rewardStr = drachmaReward.toString().trim();
  
  // Check if it's a JSON object
  if (rewardStr.startsWith('{')) {
    try {
      const rewardMap = JSON.parse(rewardStr) as Record<string, number>;
      const amounts = Object.values(rewardMap).filter(v => typeof v === 'number');
      
      if (amounts.length === 0) {
        return { display: 0, label: 'total' };
      }

      const total = amounts.reduce((sum, amount) => sum + amount, 0);
      
      if (isSolo) {
        // Solo: show the single participant's reward
        return { display: total, label: 'total' };
      } else {
        // Group: show average per person
        const average = Math.floor(total / amounts.length);
        return { display: average, label: 'avg per person' };
      }
    } catch (e) {
      // Invalid JSON, treat as 0
      return { display: 0, label: 'total' };
    }
  }

  // Fallback: try to parse as number
  const numValue = parseFloat(rewardStr);
  if (!isNaN(numValue)) {
    return {
      display: numValue,
      label: isSolo ? 'total' : 'per person'
    };
  }

  return { display: 0, label: 'total' };
}
