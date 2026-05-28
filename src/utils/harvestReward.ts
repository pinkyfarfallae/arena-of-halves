/**
 * Parse drachma reward from harvest submission
 * Handles both legacy number format and new JSON map format
 */
export function parseDrachmaReward(
  drachmaReward: number | string | undefined,
  isSolo: boolean,
  charCount?: number,
  participantCount?: number
): { display: number; label: string } {
  const groupLabel = (count?: number) => {
    if (!count || count < 2) {
      return 'total (group)';
    }
    return `total (${count} people)`;
  };

  if (!drachmaReward) {
    // Fallback: estimate from charCount when drachmaReward was never stored
    if (charCount && charCount > 0) {
      const baseRate = 10;
      const base = (charCount / 200) * baseRate;
      const estimated = Math.ceil(isSolo ? base * 1.5 : base);
      return {
        display: estimated,
        label: isSolo ? 'est. total' : `est. ${groupLabel(participantCount)}`
      };
    }
    return { display: 0, label: 'total' };
  }

  // Legacy format: plain number
  if (typeof drachmaReward === 'number') {
    return {
      display: drachmaReward,
      label: isSolo ? 'total' : groupLabel(participantCount)
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
        // Group: show shared total with participant count breakdown
        return { display: total, label: groupLabel(amounts.length) };
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
      label: isSolo ? 'total' : groupLabel(participantCount)
    };
  }

  return { display: 0, label: 'total' };
}
