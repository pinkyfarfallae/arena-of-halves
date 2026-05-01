import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { Deity, DEITY } from '../constants/deities';
import { GID, csvUrl } from '../constants/sheets';
import { firestore } from '../firebase';
import type { Wish } from '../types/wish';
import { FIRESTORE_COLLECTIONS } from '../constants/fireStoreCollections';
import type { WishEntry } from '../types/character';
import { getTodayDate } from '../utils/date';
import { updateCharacterDrachma } from '../services/character/currencyService';

const wishesCsvUrl = () => csvUrl(GID.WISHES);

export interface IrisWishDoc {
  userId: string;
  date: string;
  deity: string;
  canceled?: boolean;
  tossedAt?: string;
  nikeBonus100DCount?: number;
}

function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let cells: string[] = [];
  let cell = '';
  let inQuote = false;
  let i = 0;

  while (i < csv.length) {
    const ch = csv[i];
    if (inQuote) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else {
          inQuote = false;
          i++;
        }
      } else {
        cell += ch;
        i++;
      }
    } else if (ch === '"') {
      inQuote = true;
      i++;
    } else if (ch === ',') {
      cells.push(cell.trim());
      cell = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      cells.push(cell.trim());
      cell = '';
      if (ch === '\r' && csv[i + 1] === '\n') i++;
      i++;
      if (cells.some(c => c)) rows.push(cells);
      cells = [];
    } else {
      cell += ch;
      i++;
    }
  }

  if (cell || cells.length) {
    cells.push(cell.trim());
    if (cells.some(c => c)) rows.push(cells);
  }

  return rows;
}

export const saveIrisWish = async (userId: string, deity: string) => {
  const date = getTodayDate();
  const docId = `${userId}_${date}`;

  const ref = doc(firestore, FIRESTORE_COLLECTIONS.PLAYER_WISHES_OF_IRIS, docId);

  await setDoc(ref, {
    userId,
    date,
    deity,
    canceled: false,
    tossedAt: new Date().toISOString(),
  });
};

export const cancelTodayIrisWish = async (characterId: string) => {
  const date = getTodayDate();
  const docId = `${characterId}_${date}`;

  const ref = doc(firestore, FIRESTORE_COLLECTIONS.PLAYER_WISHES_OF_IRIS, docId);

  await setDoc(ref, {
    userId: characterId,
    date,
    canceled: true,
  }, { merge: true });
};

export async function fetchWishes(): Promise<Wish[]> {
  const res = await fetch(wishesCsvUrl());
  const csv = await res.text();
  const rows = parseCSV(csv);
  // Skip header row, map columns: deity, wish (name), description
  // Sheet deity column matches DEITY (PascalCase); keep as-is.
  return rows.slice(1)
    .filter(r => r[0] && r[1])
    .map(r => ({
      deity: r[0].trim(),
      name: r[1],
      description: r[2] || '',
    }));
}

/** Fetch today's Iris wish for a specific character */
export const fetchTodayIrisWish = async (characterId: string) => {
  const date = getTodayDate();
  const docId = `${characterId}_${date}`;

  const ref = doc(firestore, FIRESTORE_COLLECTIONS.PLAYER_WISHES_OF_IRIS, docId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return snap.data() as IrisWishDoc;
};

/** Fetch today's Iris wish only if it is still active */
export const fetchActiveTodayIrisWish = async (characterId: string) => {
  const wish = await fetchTodayIrisWish(characterId);
  if (!wish || wish.canceled || !wish.deity) return null;
  return wish;
};

/** Fetch all Iris wishes for a specific character */
export const fetchAllIrisWishes = async (characterId: string) => {
  const ref = collection(firestore, FIRESTORE_COLLECTIONS.PLAYER_WISHES_OF_IRIS);
  const q = query(ref, where('userId', '==', characterId));
  const snap = await getDocs(q);

  return snap.docs.map(doc => doc.data() as IrisWishDoc);
};

/** Aggregate all Iris wishes for a specific character by deity */
export const fetchIrisWishCountsForCharacter = async (characterId: string): Promise<WishEntry[]> => {
  const wishes = await fetchAllIrisWishes(characterId);
  const counts = new Map<string, number>();

  wishes.forEach((wish) => {
    if (!wish.deity) return;
    counts.set(wish.deity, (counts.get(wish.deity) || 0) + 1);
  });

  return Array.from(counts.entries()).map(([deity, count]) => ({ deity, count }));
};

/** Fetch today's Iris wish of every character */
export const fetchTodayIrisWishes = async () => {
  const date = getTodayDate();
  const ref = collection(firestore, FIRESTORE_COLLECTIONS.PLAYER_WISHES_OF_IRIS);
  const q = query(ref, where('date', '==', date));
  const snap = await getDocs(q);

  return snap.docs.map(doc => doc.data() as IrisWishDoc);
};

/** Fetch all Iris wishes for specific date */
export const fetchIrisWishesByDate = async (date: string) => {
  const ref = collection(firestore, FIRESTORE_COLLECTIONS.PLAYER_WISHES_OF_IRIS);
  const q = query(ref, where('date', '==', date));
  const snap = await getDocs(q);

  return snap.docs.map(doc => doc.data() as IrisWishDoc);
};

/** Check if user has Nike wish and award 100 drachma (max 2 times). Returns true if awarded. */
export const tryAwardNikeBonusDrachma = async (userId: string): Promise<boolean> => {
  const date = getTodayDate();
  const docId = `${userId}_${date}`;
  const ref = doc(firestore, FIRESTORE_COLLECTIONS.PLAYER_WISHES_OF_IRIS, docId);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;

    const wish = snap.data() as IrisWishDoc;

    // Check if it's a Nike wish and not canceled
    if (wish.deity !== DEITY.NIKE || wish.canceled) return false;

    // Get current bonus count (default 0)
    const currentCount = wish.nikeBonus100DCount ?? 0;

    // Check if already awarded 2 times
    if (currentCount >= 2) return false;

    // Award drachma and increment counter
    await updateCharacterDrachma(userId, 100);
    await setDoc(ref, {
      nikeBonus100DCount: currentCount + 1,
    }, { merge: true });

    return true;
  } catch (error) {
    console.error('Error awarding Nike bonus:', error);
    return false;
  }
};

/** Fallback data if fetch fails */
export const WISHES_FALLBACK: Wish[] = [
  { deity: DEITY.ZEUS, name: 'ราชันย์เหนือนภา', description: 'ในการฝึกฝนและการต่อสู้ในวันนี้ ผลลัพธ์การทอยเต๋าทุกประเภทติดลบ 2' },
  { deity: DEITY.HERA, name: 'มาตาแห่งนารี', description: 'ไม่สามารถเข้าร่วมการฝึกแบบตัวต่อตัวและการต่อสู้ในวันนี้ได้' },
  { deity: DEITY.POSEIDON, name: 'เขย่าโลกา', description: 'ในห้องทอยเต๋าฝึกฝน การฝึกแบบตัวต่อตัวและการต่อสู้ในวันนี้\nหากผลลัพธ์การทอยเต๋าน้อยกว่า 6 จะถูกนับเป็น 6 เสมอ' },
  { deity: DEITY.DEMETER, name: 'สตรีสี่ฤดู', description: 'การทำไร่สตรอเบอร์รี่วันนี้ ผลตอบแทนสุดท้ายที่ได้รับจะเพิ่มเป็น 2 เท่า' },
  { deity: DEITY.ARES, name: 'อสูรสงคราม', description: 'การฝึกแบบตัวต่อตัวและการต่อสู้ในวันนี้จะสามารถทำดาเมจได้แรงขึ้น 1 หน่วย' },
  { deity: DEITY.ATHENA, name: 'เนตรเทาเชาว์ปัญญา', description: 'เมื่อส่งผลการฝึกฝนในวันนี้สำเร็จ จะได้รับ Training Point เพิ่มเติมอีก 1 คะแนน\nโดยหากฝึกโดยการทอยเต๋ากับสต๊าฟ จะต้องอยู่ในเงื่อนไขที่ทอยชนะสต๊าฟ' },
  { deity: DEITY.APOLLO, name: 'ลำนำพิณสุริยัน', description: 'เงินรางวัลจากเควสบอร์ดที่ส่งและได้รับผลตอบแทนในวันนี้จะเพิ่มเป็น 2 เท่า\nโดยมีผลแค่ 3 เควสแรกที่ส่งเท่านั้น\n(กรุณาแคปเจอร์รูปพรส่งไดเรคแมสเมจให้สตาฟ)' },
  { deity: DEITY.ARTEMIS, name: 'คันศรจันทรา', description: 'การฝึกแบบตัวต่อตัวและการต่อสู้ในวันนี้\nจะมี 𝐒𝐩𝐞𝐞𝐝 เพิ่มขึ้น 3 หน่วย' },
  { deity: DEITY.HEPHAESTUS, name: 'หัตถ์ผู้รังสรรค์', description: 'ในวันนี้ อุปกรณ์สวมใส่ที่ใส่ในระบบต่อสู้ จะนับว่าเป็นขั้นที่สูงกว่า 1 ขั้น' },
  { deity: DEITY.APHRODITE, name: 'พิราบเลอโฉม', description: 'เอ็นพีซีจะโควทพูดถึงผู้เล่นแบบสุ่ม\n(กรุณาแคปเจอร์รูปพรส่งไดเรคแมสเมจให้สตาฟ)' },
  { deity: DEITY.HERMES, name: 'นาคาเพทุบาย', description: 'ได้รับตั๋วลดราคา 30% สำหรับใช้ในร้านค้า 1 ใบ' },
  { deity: DEITY.DIONYSUS, name: 'รัญจวนเมรัย', description: 'วันนี้รับเควสบอร์ดได้แค่ 1 เควส\n(กรุณาแคปเจอร์รูปพรส่งไดเรคแมสเมจให้สตาฟ)' },
  { deity: DEITY.HADES, name: 'เงาพิภพนิฬกาล', description: 'การการฝึกแบบตัวต่อตัวและการต่อสู้ในวันนี้\nหากตายจะฟื้นคืนชีพขึ้นมาด้วยเลือดเต็มจำนวนได้ 1 ครั้ง' },
  { deity: DEITY.IRIS, name: 'สาส์นผ่านสายรุ้ง', description: 'ได้รับข้อความไอริสปริศนาแบบสุ่ม 1 คำ\n(กรุณาแคปเจอร์รูปพรส่งไดเรคแมสเมจให้สตาฟ)' },
  { deity: DEITY.HYPNOS, name: 'นิทราเงียบงัน', description: 'ในห้องทอยเต๋าฝึกฝน การฝึกแบบตัวต่อตัวและการต่อสู้ในวันนี้\nแต้มเต๋าหน้าสูงสุดลดลง จาก D12 เหลือ D10\nแต่ยังสามารถได้รับผลจากแต้มบวกเต๋าได้อยู่' },
  { deity: DEITY.NEMESIS, name: 'ตราชั่งแห่งกรรม', description: 'การฝึกแบบตัวต่อตัวและการต่อสู้ในวันนี้ เมื่อป้องกันการโจมตีได้\nจะโจมตีสวนกลับไป ทำดาเมจ 1 หน่วย' },
  { deity: DEITY.NIKE, name: 'ปีกนำชัยชนะ', description: 'การฝึกแบบตัวต่อตัวและการต่อสู้ในวันนี้ ชนะในวันนี้\nจะได้รับเงิน 100 ดรัคมาโดยพรนี้จะแสดงแค่ 2 รอบเท่านั้น' },
  { deity: DEITY.HEBE, name: 'ธาราอมฤต', description: 'ได้รับโพชั่นไซส์ S 1 ขวด' },
  { deity: DEITY.TYCHE, name: 'วงล้อโชคลาภ', description: 'ในห้องทอยเต๋าฝึกฝน การฝึกแบบตัวต่อตัวและการต่อสู้ในวันนี้ แต้มเต๋าหน้าสูงสุดเพิ่มขึ้นจาก D12 เป็น D20 และยังสามารถได้รับผลจากแต้มบวกเต๋าได้อยู่' },
  { deity: DEITY.HECATE, name: 'ม่านหมอกมนตรา', description: 'ได้รับ Training Point ทันที 1 คะแนน' },
];

/** Wishes associated with battle */
export const WISHES_ASSOCIATED_WITH_BATTLE: Deity[] = [
  DEITY.ZEUS,
  DEITY.POSEIDON,
  DEITY.ARES,
  DEITY.ARTEMIS,
  DEITY.HADES,
  DEITY.HYPNOS,
  DEITY.NEMESIS,
  DEITY.NIKE,
  DEITY.TYCHE,
];

/** Wish's Priority */
export const BLESSING_WISHES = [
  DEITY.POSEIDON,
  DEITY.DEMETER,
  DEITY.ARES,
  DEITY.ATHENA,
  DEITY.APOLLO,
  DEITY.ARTEMIS,
  DEITY.HEPHAESTUS,
  DEITY.HERMES,
  DEITY.HADES,
  DEITY.NEMESIS,
  DEITY.HECATE,
  DEITY.NIKE,
  DEITY.HEBE,
  DEITY.TYCHE,
];

export const NORMAL_WISHES = [
  DEITY.APHRODITE,
  DEITY.IRIS,
];

export const CURSED_WISHES = [
  DEITY.ZEUS,
  DEITY.HERA,
  DEITY.DIONYSUS,
  DEITY.HYPNOS,
];