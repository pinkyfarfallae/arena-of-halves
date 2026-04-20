import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from '../../firebase';
import { FIRESTORE_COLLECTIONS } from '../../constants/fireStoreCollections';
import { getTodayDate } from '../../utils/date';

// Document shape: collection USER_DAILY_CLAIMS, doc id = YYYY-MM-DD
// { [characterId]: { accepted: boolean, amount: number } }

export type UserDailyClaim = { accepted: boolean; amount: number };

/**
 * Ensure there's an entry for today's date and the character.
 * If an amount doesn't exist yet, a random amount is generated, persisted,
 * and returned so subsequent reads return the same value.
 */
export async function getUserDailyClaim(characterId: string): Promise<UserDailyClaim> {
  try {
    const date = getTodayDate();
    const ref = doc(firestore, FIRESTORE_COLLECTIONS.USER_DAILY_CLAIMS, date);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};

    const entry = data?.[characterId];
    if (entry && typeof entry.amount === 'number') {
      return { accepted: !!entry.accepted, amount: entry.amount };
    }

    // No entry or no amount yet - generate a stable random amount and persist
    const amount = (Math.floor(Math.random() * 5) + 1) * 10;
    const newEntry = { accepted: false, amount };
    await setDoc(ref, { [characterId]: newEntry }, { merge: true });
    return newEntry;
  } catch (err) {
    console.error('getUserDailyClaim failed', err);
    // Fallback: return not accepted with a reasonable local random amount
    return { accepted: false, amount: (Math.floor(Math.random() * 5) + 1) * 10 };
  }
}

/**
 * Mark the user's daily claim as accepted=true while preserving any assigned amount.
 */
export async function markUserClaimedToday(characterId: string): Promise<void> {
  try {
    const date = getTodayDate();
    const ref = doc(firestore, FIRESTORE_COLLECTIONS.USER_DAILY_CLAIMS, date);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    const existing = data?.[characterId];

    const updated = {
      accepted: true,
      amount: (existing && typeof existing.amount === 'number') ? existing.amount : (Math.floor(Math.random() * 5) + 1) * 10,
    };

    await setDoc(ref, { [characterId]: updated }, { merge: true });
  } catch (err) {
    console.error('markUserClaimedToday failed', err);
    throw err;
  }
}
