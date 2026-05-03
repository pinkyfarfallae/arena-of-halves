/**
 * Version check utility to force refresh when app is updated
 * Stores the build timestamp and forces reload if server has a newer version
 */

const VERSION_STORAGE_KEY = 'app_build_timestamp';
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

let lastCheckTime = 0;
let versionCheckTimeout: NodeJS.Timeout | null = null;

/**
 * Get build timestamp from meta tag
 * Set during build by adding: <meta name="build-time" content="{timestamp}">
 * Falls back to current time if not set
 */
export const getBuildTime = (): string => {
  const meta = document.querySelector('meta[name="build-time"]');
  if (meta?.getAttribute('content')) {
    return meta.getAttribute('content') || new Date().getTime().toString();
  }
  return new Date().getTime().toString();
};

/**
 * Check if app has been updated on server
 * If updated, show notification and reload after delay
 */
export const checkForUpdate = async (): Promise<void> => {
  const now = Date.now();
  
  // Don't check too frequently
  if (now - lastCheckTime < VERSION_CHECK_INTERVAL) {
    return;
  }
  
  lastCheckTime = now;
  
  try {
    // Fetch the HTML with no-cache to get latest version
    const response = await fetch('/', {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
    
    const html = await response.text();
    
    // Extract build timestamp from fetched HTML
    const match = html.match(/<meta\s+name="build-time"\s+content="([^"]+)"/);
    const serverBuildTime = match ? match[1] : null;
    
    if (!serverBuildTime) {
      return;
    }
    
    // Get locally stored build time
    const localBuildTime = localStorage.getItem(VERSION_STORAGE_KEY);
    
    // First time - just store the version
    if (!localBuildTime) {
      localStorage.setItem(VERSION_STORAGE_KEY, serverBuildTime);
      return;
    }
    
    // If server has newer version, reload
    if (serverBuildTime !== localBuildTime) {
      console.warn('[VersionCheck] Newer version detected. Reloading...', {
        local: localBuildTime,
        server: serverBuildTime,
      });
      
      // Update localStorage BEFORE reload to prevent infinite loop
      // (Next check after reload will see matching timestamps)
      localStorage.setItem(VERSION_STORAGE_KEY, serverBuildTime);
      
      // Show notification for 2 seconds then reload
      const message = 'App updated. Refreshing...';
      console.info(message);
      
      // Use alert as fallback if no notification system
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  } catch (error) {
    console.warn('[VersionCheck] Failed to check for update:', error);
    // Silently fail - don't disrupt user experience
  }
};

/**
 * Start periodic version check
 */
export const startVersionCheck = (): void => {
  // Initial check after a delay to not block app startup
  setTimeout(() => {
    checkForUpdate();
  }, 10000);
  
  // Then check periodically
  if (versionCheckTimeout) {
    clearInterval(versionCheckTimeout);
  }
  
  versionCheckTimeout = setInterval(() => {
    checkForUpdate();
  }, VERSION_CHECK_INTERVAL);
};

/**
 * Stop periodic version check
 */
export const stopVersionCheck = (): void => {
  if (versionCheckTimeout) {
    clearInterval(versionCheckTimeout);
    versionCheckTimeout = null;
  }
};

/**
 * Unregister service workers and force full refresh
 */
export const clearServiceWorkers = async (): Promise<void> => {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
      console.info('[VersionCheck] Service workers cleared');
    }
  } catch (error) {
    console.warn('[VersionCheck] Failed to clear service workers:', error);
  }
};

/**
 * Get current app version for display in UI
 */
export const getAppVersion = (): {
  buildTime: string;
  displayTime: string;
} => {
  const buildTime = getBuildTime();
  const date = new Date(parseInt(buildTime, 10));
  const displayTime = date.toLocaleString();
  
  return {
    buildTime,
    displayTime,
  };
};
