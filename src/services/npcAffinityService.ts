import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from '../firebase';

export type AffinityMap = Record<string, number>;

const COLLECTION = 'npcAffinity';

export async function getAffinityForCharacter(characterId: string): Promise<AffinityMap> {
  if (!characterId) return {};
  const ref = doc(firestore, COLLECTION, String(characterId));
  const snap = await getDoc(ref);
  if (!snap.exists()) return {};
  const data = snap.data();
  return (data as AffinityMap) || {};
}

export async function saveAffinityForCharacter(characterId: string, affinities: AffinityMap): Promise<void> {
  if (!characterId) return;
  const ref = doc(firestore, COLLECTION, String(characterId));
  await setDoc(ref, affinities || {});
}

export default {
  getAffinityForCharacter,
  saveAffinityForCharacter,
};
