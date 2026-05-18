import { firestore } from '../../firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  where,
  limit,
} from 'firebase/firestore';
import { FIRESTORE_COLLECTIONS } from '../../constants/fireStoreCollections';
import { ActivityLog } from '../../types/activityLog';
import { isInQuotaEmergency, canExecuteNonCriticalRead } from '../quotaEmergency';

const col = () => collection(firestore, FIRESTORE_COLLECTIONS.ACTIVITY_LOGS);

// Cache for activity logs (admin full view)
let cachedActivityLogs: ActivityLog[] | null = null;
let cachedActivityLogsTimestamp = 0;
const activityLogsCacheDuration = 10 * 60 * 1000; // 10 minutes

// Cache for per-character activity logs (Statement page)
const cachedCharacterLogs = new Map<string, { logs: ActivityLog[]; timestamp: number }>();
const characterLogsCacheDuration = 5 * 60 * 1000; // 5 minutes

export async function logActivity(
  entry: Omit<ActivityLog, 'id' | 'createdAt'>
): Promise<void> {
  try {
    // QUOTA EMERGENCY: Skip logging in emergency mode to preserve quota
    if (isInQuotaEmergency()) {
      console.warn('[QUOTA EMERGENCY] Activity logging disabled');
      return;
    }
    
    await addDoc(col(), {
      ...entry,
      createdAt: new Date().toISOString(),
    });

    // Mark caches as stale so the next normal read re-fetches fresh data,
    // but keep the data itself so quota-emergency fallbacks still work.
    cachedActivityLogsTimestamp = 0;
    const existingCharCache = cachedCharacterLogs.get(entry.characterId);
    if (existingCharCache) {
      cachedCharacterLogs.set(entry.characterId, { logs: existingCharCache.logs, timestamp: 0 });
    }
  } catch {
    // Silent — logging must never interrupt the main flow
  }
}

export async function fetchActivityLogs(limitCount = 300): Promise<ActivityLog[]> {
  // QUOTA EMERGENCY: Block activity log reads in emergency
  if (!canExecuteNonCriticalRead()) {
    console.warn('[QUOTA EMERGENCY] Activity log fetch blocked');
    return cachedActivityLogs || [];
  }
  
  // Use cache if available
  const now = Date.now();
  if (cachedActivityLogs && (now - cachedActivityLogsTimestamp) < activityLogsCacheDuration) {
    console.log('[Quota Cache] Using cached activity logs');
    return cachedActivityLogs;
  }
  
  const q = query(col(), orderBy('createdAt', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  
  cachedActivityLogs = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ActivityLog, 'id'>) }));
  cachedActivityLogsTimestamp = now;
  
  return cachedActivityLogs;
}

/**
 * Fetch activity logs for a specific character only.
 * Much cheaper than fetchActivityLogs — reads only that character's entries.
 * Cached per character for 5 minutes.
 */
export async function fetchActivityLogsForCharacter(
  characterId: string,
  limitCount = 200
): Promise<ActivityLog[]> {
  if (!canExecuteNonCriticalRead()) {
    const cached = cachedCharacterLogs.get(characterId);
    console.warn('[QUOTA EMERGENCY] Character activity log fetch blocked');
    return cached?.logs || [];
  }

  const now = Date.now();
  const cached = cachedCharacterLogs.get(characterId);
  if (cached && (now - cached.timestamp) < characterLogsCacheDuration) {
    console.log(`[Quota Cache] Using cached activity logs for ${characterId}`);
    return cached.logs;
  }

  // Order by createdAt desc so limit(N) returns the MOST RECENT entries.
  // Requires the composite index: ActivityLogs [ characterId ASC, createdAt DESC ]
  // defined in firestore.indexes.json.
  const q = query(
    col(),
    where('characterId', '==', characterId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  try {
    const snap = await getDocs(q);
    const logs = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ActivityLog, 'id'>) }));
    cachedCharacterLogs.set(characterId, { logs, timestamp: now });
    return logs;
  } catch (err: any) {
    // The composite index may still be building right after deployment.
    // Fall back to the unordered query so the Statement isn't blank.
    console.warn('[ActivityLog] Ordered query failed (index building?), falling back', err?.message);
    const fallbackQ = query(
      col(),
      where('characterId', '==', characterId),
      limit(limitCount)
    );
    const snap = await getDocs(fallbackQ);
    const logs = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ActivityLog, 'id'>) }));
    cachedCharacterLogs.set(characterId, { logs, timestamp: now });
    return logs;
  }
}

export type EditableLogFields = Pick<
  ActivityLog,
  'category' | 'action' | 'characterId' | 'performedBy' | 'amount' | 'note'
>;

export async function editActivityLog(
  id: string,
  fields: Partial<EditableLogFields>,
  editedBy: string
): Promise<void> {
  await updateDoc(doc(firestore, FIRESTORE_COLLECTIONS.ACTIVITY_LOGS, id), {
    ...fields,
    editedAt: new Date().toISOString(),
    editedBy,
  });
}

export async function deleteActivityLog(id: string): Promise<void> {
  const { deleteDoc, doc: fsDoc } = await import('firebase/firestore');
  await deleteDoc(fsDoc(firestore, FIRESTORE_COLLECTIONS.ACTIVITY_LOGS, id));
}
