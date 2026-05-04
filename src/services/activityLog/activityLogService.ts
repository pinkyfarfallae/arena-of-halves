import { firestore } from '../../firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { FIRESTORE_COLLECTIONS } from '../../constants/fireStoreCollections';
import { ActivityLog } from '../../types/activityLog';
import { isInQuotaEmergency, canExecuteNonCriticalRead } from '../quotaEmergency';

const col = () => collection(firestore, FIRESTORE_COLLECTIONS.ACTIVITY_LOGS);

// Cache for activity logs (quota emergency)
let cachedActivityLogs: ActivityLog[] | null = null;
let cachedActivityLogsTimestamp = 0;
const activityLogsCacheDuration = 10 * 60 * 1000; // 10 minutes

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
