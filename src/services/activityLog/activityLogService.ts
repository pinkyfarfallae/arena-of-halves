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

const col = () => collection(firestore, FIRESTORE_COLLECTIONS.ACTIVITY_LOGS);

export async function logActivity(
  entry: Omit<ActivityLog, 'id' | 'createdAt'>
): Promise<void> {
  try {
    await addDoc(col(), {
      ...entry,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // Silent — logging must never interrupt the main flow
  }
}

export async function fetchActivityLogs(limitCount = 300): Promise<ActivityLog[]> {
  const q = query(col(), orderBy('createdAt', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ActivityLog, 'id'>) }));
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
