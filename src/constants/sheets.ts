export const SHEET_ID = '1P3gaozLPryFY8itFVx7YzBTrFfdSn2tllTKJIMXVWOA';

const DEPLOYMENT_ID = 'AKfycbyB99kDI68YsVgJg2qC5xXNEz1t6_rpdbhuUy5ZfICQHg3CK7ZiQjMR8NP1a8pbH5AdXw';
export const APPS_SCRIPT_URL = `https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec`;

export const SECRET_SHEET_ID = '1aIzkjzkP6WaW-CgLbckPEqV4xYdJbITZOJwFPUkdUHw';
export const SECRET_GID = {
  USER: '0',
  CHARACTER: '927608720',
} as const;

export const GID = {
  CHARACTER: '0',
  USER: '1495840634',
  POWERS: '979138238',
  WISHES: '198616624',
  ITEM_INFO: '403375390',
  CUSTOM_EQUIPMENT: '1866887317',
  SHOP: '819284917',
  HARVEST: '390673925',
  NPC: '1431163652',
  DAILY_TRAINING_DICE: '383013042',
  BIG_HOUSE_ROLEPLAY_SUBMISSION: '284757298',
} as const;

export type SheetKey = keyof typeof GID;

export const csvUrl = (gid: string) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}&_t=${Date.now()}&r=${Math.random()}`;

export const secretCsvUrl = (gid: string) =>
  `https://docs.google.com/spreadsheets/d/${SECRET_SHEET_ID}/export?format=csv&gid=${gid}&_t=${Date.now()}&r=${Math.random()}`;

/** Fetch a sheet as CSV via Apps Script POST proxy.
 *  Works in production (GitHub Pages). Local dev may be CORS-blocked — test on deployed site.
 *  If Apps Script doPost hasn't been redeployed with fetchSheet action, falls back gracefully. */

// Per-GID cache (5 min TTL) + in-flight deduplication so simultaneous callers share one request
const _csvCache = new Map<string, { text: string; expiresAt: number }>();
const _csvInflight = new Map<string, Promise<string>>();

export function clearSheetCache(gid: string): void {
  _csvCache.delete(gid);
  _csvInflight.delete(gid);
}

export async function fetchSheetCsv(gid: string): Promise<string> {
  const now = Date.now();
  const cached = _csvCache.get(gid);
  if (cached && now < cached.expiresAt) return cached.text;

  const existing = _csvInflight.get(gid);
  if (existing) return existing;

  const promise = fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'fetchSheet', gid }),
  }).then(async r => {
    const text = await r.text();
    if (text.trimStart().startsWith('{') || text.trimStart().startsWith('[')) {
      console.error('[fetchSheetCsv] Apps Script returned JSON for gid', gid, ':', text.slice(0, 200));
      throw new Error('fetchSheet not available — redeploy Apps Script (scripts.gs).');
    }
    _csvCache.set(gid, { text, expiresAt: Date.now() + 5 * 60_000 });
    return text;
  }).finally(() => {
    _csvInflight.delete(gid);
  });

  _csvInflight.set(gid, promise);
  return promise;
}
