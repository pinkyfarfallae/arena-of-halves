import { doc, getDoc, setDoc, runTransaction, FirestoreError } from 'firebase/firestore';
import { firestore } from '../../firebase';
import { FIRESTORE_COLLECTIONS } from '../../constants/fireStoreCollections';
import { getTodayDate } from '../../utils/date';
import { isInQuotaEmergency } from '../quotaEmergency';
import { LOCAL_STORAGE_KEYS } from '../../constants/localStorage';

// Document shape: collection USER_DAILY_CLAIMS, doc id = YYYY-MM-DD
// { [characterId]: { accepted: boolean, amount: number } }

export type UserDailyClaim = { accepted: boolean; amount: number };

// Cache for daily claims (quota emergency)
const dailyClaimsCache = new Map<string, UserDailyClaim>();
const claimedTodayCache = new Set<string>();

function getCacheKey(characterId: string, date: string = getTodayDate()): string {
  return `${date}:${characterId}`;
}

function getStorageKey(characterId: string, date: string = getTodayDate()): string {
  return `${LOCAL_STORAGE_KEYS.DAILY_CLAIM_PREFIX}${date}_${characterId}`;
}

function hasLocalClaimLock(characterId: string, date: string = getTodayDate()): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(getStorageKey(characterId, date)) === '1';
  } catch {
    return false;
  }
}

function setLocalClaimLock(characterId: string, claimed: boolean, date: string = getTodayDate()): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const key = getStorageKey(characterId, date);
    if (claimed) {
      window.localStorage.setItem(key, '1');
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage failures; Firestore remains the source of truth.
  }
}

/**
 * Ensure there's an entry for today's date and the character.
 * If an amount doesn't exist yet, a random amount is generated, persisted,
 * and returned so subsequent reads return the same value.
 * 
 * QUOTA EMERGENCY: Uses local cache during quota exceeded to avoid more reads.
 */
export async function getUserDailyClaim(characterId: string): Promise<UserDailyClaim> {
  try {
    const date = getTodayDate();
    const cacheKey = getCacheKey(characterId, date);

    // Check cache first
    if (dailyClaimsCache.has(cacheKey)) {
      return dailyClaimsCache.get(cacheKey)!;
    }

    // QUOTA EMERGENCY: Skip read if in emergency, use cached value or fallback
    if (isInQuotaEmergency()) {
      const fallback = {
        accepted: hasLocalClaimLock(characterId, date),
        amount: (Math.floor(Math.random() * 5) + 1) * 10,
      };
      dailyClaimsCache.set(cacheKey, fallback);
      return fallback;
    }

    const ref = doc(firestore, FIRESTORE_COLLECTIONS.USER_DAILY_CLAIMS, date);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};

    const entry = data?.[characterId];
    if (entry && typeof entry.amount === 'number') {
      // Preserve local lock: if the user claimed optimistically (e.g. due to a
      // transient Firestore error), the local lock may be set even though
      // Firestore still shows accepted:false. Trust the local lock so we don't
      // clear it and re-show the modal.
      const localClaimed = hasLocalClaimLock(characterId, date);
      const accepted = !!entry.accepted || localClaimed;
      const cachedEntry = { accepted, amount: entry.amount };
      dailyClaimsCache.set(cacheKey, cachedEntry);
      setLocalClaimLock(characterId, accepted, date);
      return cachedEntry;
    }

    // No entry or no amount yet - generate a stable random amount and persist
    const amount = (Math.floor(Math.random() * 5) + 1) * 10;
    const newEntry = { accepted: false, amount };
    
    try {
      await setDoc(ref, { [characterId]: newEntry }, { merge: true });
    } catch (err) {
      console.warn('[Daily Claim] setDoc failed, using local cache', err);
    }
    
    dailyClaimsCache.set(cacheKey, newEntry);
    setLocalClaimLock(characterId, false, date);
    return newEntry;
  } catch (err) {
    console.error('[Daily Claim] getUserDailyClaim failed', err);
    // Fallback: return not accepted with a reasonable local random amount
    return {
      accepted: hasLocalClaimLock(characterId),
      amount: (Math.floor(Math.random() * 5) + 1) * 10,
    };
  }
}

/**
 * Mark the user's daily claim as accepted=true while preserving any assigned amount.
 * QUOTA EMERGENCY: Uses local cache during quota exceeded.
 */
export async function markUserClaimedToday(characterId: string): Promise<void> {
  try {
    const date = getTodayDate();
    const cacheKey = getCacheKey(characterId, date);

    // QUOTA EMERGENCY: Skip write if in emergency, just update cache
    if (isInQuotaEmergency()) {
      const existing = dailyClaimsCache.get(cacheKey) || { amount: (Math.floor(Math.random() * 5) + 1) * 10 };
      dailyClaimsCache.set(cacheKey, { ...existing, accepted: true });
      claimedTodayCache.add(cacheKey);
      setLocalClaimLock(characterId, true, date);
      console.warn('[Daily Claim] Emergency mode - not persisting to Firestore');
      return;
    }

    const ref = doc(firestore, FIRESTORE_COLLECTIONS.USER_DAILY_CLAIMS, date);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    const existing = data?.[characterId];

    const updated = {
      accepted: true,
      amount: (existing && typeof existing.amount === 'number') ? existing.amount : (Math.floor(Math.random() * 5) + 1) * 10,
    };

    await setDoc(ref, { [characterId]: updated }, { merge: true });
    dailyClaimsCache.set(cacheKey, updated);
    claimedTodayCache.add(cacheKey);
    setLocalClaimLock(characterId, true, date);
  } catch (err) {
    console.error('[Daily Claim] markUserClaimedToday failed', err);
    // Still update local cache even if persistence fails
    const date = getTodayDate();
    const cacheKey = getCacheKey(characterId, date);
    dailyClaimsCache.set(cacheKey, { accepted: true, amount: (Math.floor(Math.random() * 5) + 1) * 10 });
    claimedTodayCache.add(cacheKey);
    setLocalClaimLock(characterId, true, date);
  }
}

/**
 * Attempt to atomically claim today's gift for the character.
 * Returns true if this call successfully marked accepted=true (claim reserved),
 * or false if the character had already accepted today.
 * 
 * QUOTA EMERGENCY: Falls back to local cache to prevent transaction retries.
 */
export async function tryClaimToday(characterId: string): Promise<boolean> {
  const date = getTodayDate();
  const cacheKey = getCacheKey(characterId, date);

  // Check if already claimed (in cache)
  if (claimedTodayCache.has(cacheKey) || hasLocalClaimLock(characterId, date)) {
    claimedTodayCache.add(cacheKey);
    return false;
  }

  // QUOTA EMERGENCY: Skip transaction, use local cache
  if (isInQuotaEmergency()) {
    console.warn('[Daily Claim] Emergency mode - skipping transaction');
    await markUserClaimedToday(characterId);
    return true;
  }

  const ref = doc(firestore, FIRESTORE_COLLECTIONS.USER_DAILY_CLAIMS, date);

  try {
    const result = await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const existing = data?.[characterId];

      if (existing && existing.accepted) {
        return false; // already claimed
      }

      const amount = (existing && typeof existing.amount === 'number') ? existing.amount : (Math.floor(Math.random() * 5) + 1) * 10;
      const updated = { accepted: true, amount };
      tx.set(ref, { [characterId]: updated }, { merge: true });
      return true;
    });

    if (result) {
      claimedTodayCache.add(cacheKey);
      setLocalClaimLock(characterId, true, date);
    }
    return !!result;
  } catch (err) {
    const firebaseErr = err as FirestoreError;
    if (firebaseErr?.code === 'resource-exhausted') {
      console.error('[Daily Claim] QUOTA EXCEEDED - transaction blocked', err);
    } else {
      console.error('[Daily Claim] tryClaimToday transaction failed, proceeding optimistically', err);
    }
    // For any error, proceed optimistically. Firestore transactions that throw
    // do not commit, so it is safe to mark as claimed locally and still allow
    // drachma to be credited. Returning false here would cause the caller to
    // silently skip the credit entirely.
    claimedTodayCache.add(cacheKey);
    setLocalClaimLock(characterId, true, date);
    return true;
  }
}

/**
 * Best-effort rollback if awarding fails after reserving a claim.
 */
export async function unmarkUserClaimedToday(characterId: string): Promise<void> {
  try {
    const date = getTodayDate();
    const cacheKey = getCacheKey(characterId, date);
    const ref = doc(firestore, FIRESTORE_COLLECTIONS.USER_DAILY_CLAIMS, date);
    // set accepted back to false but preserve amount if present
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    const existing = data?.[characterId];
    const updated = { accepted: false, amount: existing && typeof existing.amount === 'number' ? existing.amount : (Math.floor(Math.random() * 5) + 1) * 10 };
    await setDoc(ref, { [characterId]: updated }, { merge: true });
    dailyClaimsCache.set(cacheKey, updated);
    claimedTodayCache.delete(cacheKey);
    setLocalClaimLock(characterId, false, date);
  } catch (err) {
    console.error('unmarkUserClaimedToday failed', err);
    // swallow - best-effort
  }
}
