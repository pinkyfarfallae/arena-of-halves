/**
 * QUOTA EMERGENCY SERVICE
 * 
 * Implements aggressive quota conservation measures when Firestore/RTDB quota is critical.
 * Disables non-essential reads while keeping core functionality alive.
 */

// Emergency mode flag - set to true to activate quota conservation
let isQuotaEmergencyMode = false;

// Track when emergency was activated
let emergencyActivatedAt = 0;

/**
 * Activate quota emergency mode
 * Disables non-critical queries for specified duration
 */
export function activateQuotaEmergency(durationMs: number = 24 * 60 * 60 * 1000) {
  if (isQuotaEmergencyMode) return;
  
  isQuotaEmergencyMode = true;
  emergencyActivatedAt = Date.now();
  
  console.error('[QUOTA EMERGENCY] Mode activated - non-critical reads disabled');
  console.error(`Duration: ${Math.round(durationMs / 1000 / 60)} minutes`);
  
  // Reset after duration
  setTimeout(() => {
    isQuotaEmergencyMode = false;
    console.log('[QUOTA EMERGENCY] Mode deactivated');
  }, durationMs);
}

/**
 * Deactivate quota emergency mode manually
 */
export function deactivateQuotaEmergency() {
  isQuotaEmergencyMode = false;
  console.log('[QUOTA EMERGENCY] Mode manually deactivated');
}

/**
 * Check if emergency mode is active
 */
export function isInQuotaEmergency(): boolean {
  return isQuotaEmergencyMode;
}

/**
 * Guard for optional queries - skip them during emergency
 * Use to wrap non-critical reads
 * 
 * @example
 * if (canExecuteNonCriticalRead()) {
 *   const data = await fetchOptionalData();
 * }
 */
export function canExecuteNonCriticalRead(): boolean {
  if (!isQuotaEmergencyMode) return true;
  
  console.warn('[QUOTA EMERGENCY] Non-critical read blocked');
  return false;
}

/**
 * Guard for critical queries - always allowed
 * Use to wrap essential reads that must work
 * 
 * @example
 * if (canExecuteCriticalRead()) {
 *   const data = await fetchEssentialData();
 * }
 */
export function canExecuteCriticalRead(): boolean {
  return true; // Always allow critical reads
}

/**
 * List of read operations that should be disabled in emergency:
 * - Analytics queries
 * - Admin dashboards
 * - Historical data loads
 * - Background data sync
 */
export const NON_CRITICAL_READS = {
  ACTIVITY_LOG_FULL: 'Full activity log queries',
  HISTORICAL_WISHES: 'Historical iris wishes',
  ADMIN_ANALYTICS: 'Admin dashboard analytics',
  LEADERBOARDS: 'Non-essential leaderboards',
  BACKGROUND_SYNC: 'Background data sync',
} as const;

/**
 * Critical reads that should ALWAYS work:
 * - User data (bag, stats, equipment)
 * - Battle/Arena data
 * - Active wishes of the day
 * - Current turn data
 */
export const CRITICAL_READS = {
  USER_BAG: 'Player bag/inventory',
  USER_STATS: 'Player statistics',
  BATTLE_STATE: 'Battle/Arena state',
  CURRENT_WISHES: 'Today\'s iris wishes',
  TURN_DATA: 'Current turn data',
} as const;

export default {
  activateQuotaEmergency,
  deactivateQuotaEmergency,
  isInQuotaEmergency,
  canExecuteNonCriticalRead,
  canExecuteCriticalRead,
  NON_CRITICAL_READS,
  CRITICAL_READS,
};
