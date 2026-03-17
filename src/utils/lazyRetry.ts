const RETRY_KEY = 'lazy-chunk-retry';

/**
 * Wraps a dynamic import for use with React.lazy. On ChunkLoadError (e.g. stale
 * cache or wrong base path), reloads the page once so the browser fetches
 * fresh chunks. Prevents infinite reload loops via sessionStorage.
 */
export function lazyRetry<T extends { default: unknown }>(
  componentImport: () => Promise<T>
): () => Promise<T> {
  return () =>
    componentImport()
      .then((mod) => {
        sessionStorage.removeItem(RETRY_KEY);
        return mod;
      })
      .catch((error) => {
        const isChunkError =
          error?.name === 'ChunkLoadError' ||
          (error?.message && /loading chunk .* failed/i.test(String(error.message)));
        const alreadyRetried = sessionStorage.getItem(RETRY_KEY) === '1';
        if (isChunkError && !alreadyRetried) {
          sessionStorage.setItem(RETRY_KEY, '1');
          window.location.reload();
        }
        throw error;
      });
}
