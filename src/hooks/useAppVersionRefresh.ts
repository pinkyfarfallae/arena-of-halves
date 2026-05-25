import { useEffect } from 'react';
import { checkForNewBuildVersion, reloadWithCacheBust } from '../utils/appVersion';

const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function useAppVersionRefresh(): void {
  useEffect(() => {
    let cancelled = false;
    let checking = false;

    const runCheck = async () => {
      if (checking || cancelled) return;
      checking = true;

      try {
        const latestBuildTime = await checkForNewBuildVersion();
        if (!cancelled && latestBuildTime) {
          reloadWithCacheBust(latestBuildTime);
        }
      } finally {
        checking = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runCheck();
      }
    };

    void runCheck();

    const intervalId = window.setInterval(() => {
      void runCheck();
    }, VERSION_CHECK_INTERVAL_MS);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}
