const BUILD_META_SELECTOR = 'meta[name="build-time"]';
const VERSION_CHECK_PARAM = '__aoh_version_check';

function parseBuildTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getCurrentBuildTime(): number | null {
  const meta = document.querySelector<HTMLMetaElement>(BUILD_META_SELECTOR);
  return parseBuildTime(meta?.content);
}

async function fetchLatestBuildTime(): Promise<number | null> {
  const url = new URL(window.location.href);
  url.searchParams.set(VERSION_CHECK_PARAM, Date.now().toString());

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url.toString(), {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const match = html.match(/<meta[^>]*name=["']build-time["'][^>]*content=["']([^"']+)["']/i);
    return parseBuildTime(match?.[1]);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function checkForNewBuildVersion(): Promise<number | null> {
  const currentBuildTime = getCurrentBuildTime();
  if (!currentBuildTime) {
    return null;
  }

  const latestBuildTime = await fetchLatestBuildTime();
  if (!latestBuildTime) {
    return null;
  }

  return latestBuildTime > currentBuildTime ? latestBuildTime : null;
}

export function reloadWithCacheBust(version: number): void {
  const url = new URL(window.location.href);
  url.searchParams.set('v', version.toString());
  window.location.replace(url.toString());
}
