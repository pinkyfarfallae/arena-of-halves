import { splitCSVRows, parseCSVLine } from '../utils/csv';
import type { Theme25, Power, WishEntry, ItemInfo, BagEntry, Character } from '../types/character';
import type { PowerDefinition } from '../types/power';
import { THEME_LABELS, DEFAULT_THEME, DEITY_THEMES } from '../constants/theme';
import { GID, csvUrl, APPS_SCRIPT_URL } from '../constants/sheets';
import { Deity } from '../constants/deities';
import { ACTIONS } from '../constants/action';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../firebase';
import { FIRESTORE_COLLECTIONS } from '../constants/fireStoreCollections';
import type { BagData } from '../types/character';

export type { Theme25, Power, WishEntry, ItemInfo, BagEntry, Character };
export type { PowerDefinition };
export { THEME_LABELS, DEFAULT_THEME, DEITY_THEMES };

const characterCsvUrl = () => csvUrl(GID.CHARACTER);

function parseTheme(raw: string, deity?: string): Theme25 {
  const cleaned = raw.replace(/"/g, '').trim();
  const colors = cleaned.split(',').map((c) => c.trim()).filter(Boolean);
  const fallback = deity
    ? (DEITY_THEMES[deity.toLowerCase().trim()] || DEFAULT_THEME)
    : DEFAULT_THEME;

  if (colors.length === 0) return fallback;

  return [
    colors[0] || fallback[0],
    colors[1] || fallback[1],
    colors[2] || fallback[2],
    colors[3] || fallback[3],
    colors[4] || fallback[4],
    colors[5] || fallback[5],
    colors[6] || fallback[6],
    colors[7] || fallback[7],
    colors[8] || fallback[8],
    colors[9] || fallback[9],
    colors[10] || fallback[10],
    colors[11] || fallback[11],
    colors[12] || fallback[12],
    colors[13] || fallback[13],
    colors[14] || fallback[14],
    colors[15] || fallback[15],
    colors[16] || fallback[16],
    colors[17] || fallback[17],
    colors[18] || fallback[18],
    colors[19] || fallback[19],
    colors[20] || fallback[20],
    colors[21] || fallback[21],
    colors[22] || fallback[22],
    colors[23] || fallback[23],
    colors[24] || fallback[24],
  ];
}

/** Convert Google Drive share links to direct embed URLs */
function toDirectImageUrl(raw?: string): string | undefined {
  if (!raw) return undefined;

  // If already a usable image URL, return as-is
  if (raw.includes("drive.google.com/thumbnail") || raw.includes("uc?id=")) {
    return raw;
  }

  let fileId: string | undefined;

  // Format: /file/d/FILE_ID/view
  let match = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) fileId = match[1];

  // Format: open?id=FILE_ID
  if (!fileId) {
    match = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match) fileId = match[1];
  }

  if (!fileId) return raw; // fallback

  // Best for <img src="">
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
}

function rowToCharacter(headers: string[], cols: string[]): Character {
  const get = (name: string) => {
    const idx = headers.indexOf(name);
    return idx !== -1 ? (cols[idx] ?? '').replace(/\\n/g, '\n') : '';
  };
  const num = (name: string) => parseInt(get(name), 10) || 0;

  const id = get('characterid');

  return {
    characterId: id,
    nicknameThai: get('nickname (thai)'),
    nicknameEng: get('nickname (eng)'),
    nameThai: get('name (thai)'),
    nameEng: get('name (eng)'),
    sex: get('sex'),
    deityBlood: get('deity blood') as Deity,
    cabin: num('cabin'),
    hp: num('hp'),
    damage: num('damage'),
    defendDiceUp: num('defend dice up'),
    attackDiceUp: num('attack dice up'),
    speed: num('speed'),
    passiveSkillPoint: get('passive skill point'),
    skillPoint: get('skill point'),
    ultimateSkillPoint: get('ultimate skill point'),
    reroll: num('reroll'),
    currency: num('currency'),
    theme: parseTheme(get('theme'), get('deity blood')),
    image: toDirectImageUrl(get('image url')),

    humanParent: get('human parent') || get('mortal parent'),
    eyeColor: get('eye color'),
    hairColor: get('hair color'),
    appearance: get('appearance'),
    species: get('species'),
    aliases: get('aliases'),
    age: get('age'),
    birthdate: get('birthdate'),
    beads: get('beads') || '0',
    weight: get('weight'),
    height: get('height'),
    genderIdentity: get('gender identity'),
    ethnicity: get('ethnicity'),
    nationality: get('nationality'),
    residence: get('residence'),
    religion: get('religion'),
    personality: get('personality'),
    background: get('background'),
    strengths: get('strengths'),
    weaknesses: get('weaknesses'),
    abilities: get('abilities'),
    powers: get('powers'),
    twitter: get('twitter') || undefined,
    document: get('document') || undefined,

    strength: num('strength'),
    mobility: num('mobility'),
    intelligence: num('intelligence'),
    technique: num('technique'),
    experience: num('experience'),
    fortune: num('fortune'),

    trainingPoints: num('trainingpoints'),
  };
}

export async function fetchCharacter(characterId: string): Promise<Character | null> {
  const res = await fetch(characterCsvUrl());
  const text = await res.text();
  const lines = splitCSVRows(text);
  if (lines.length < 2) return null;

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());

  const idIdx = headers.indexOf('characterid');
  if (idIdx === -1) return null;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols[idIdx]?.trim().toLowerCase() === characterId.toLowerCase()) {
      return rowToCharacter(headers, cols);
    }
  }

  return null;
}

export async function fetchAllCharacters(): Promise<Character[]> {
  const res = await fetch(characterCsvUrl());
  const text = await res.text();
  const lines = splitCSVRows(text);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
  const idIdx = headers.indexOf('characterid');
  if (idIdx === -1) return [];

  const chars: Character[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const id = cols[idIdx]?.trim();
    if (id) chars.push(rowToCharacter(headers, cols));
  }
  return chars;
}

export async function fetchWishes(characterId: string): Promise<WishEntry[]> {
  const url = csvUrl(GID.WISHES);
  const res = await fetch(url);
  const text = await res.text();
  const lines = splitCSVRows(text);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
  const colIdx = headers.indexOf(characterId.toLowerCase());
  if (colIdx === -1) return [];

  const deityIdx = headers.indexOf('deity');
  if (deityIdx === -1) return [];

  const wishes: WishEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const deity = cols[deityIdx] ?? '';
    const count = parseInt(cols[colIdx] ?? '0', 10) || 0;
    if (deity) wishes.push({ deity, count });
  }
  return wishes;
}

export async function fetchItemInfo(): Promise<ItemInfo[]> {
  const url = csvUrl(GID.ITEM_INFO);
  const res = await fetch(url);
  const text = await res.text();
  const lines = splitCSVRows(text);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());

  const items: ItemInfo[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const get = (name: string) => {
      const idx = headers.indexOf(name);
      return idx !== -1 ? cols[idx] ?? '' : '';
    };
    const itemId = get('itemid');
    if (itemId) {
      const piece = get('piece');
      items.push({
        itemId,
        labelEng: get('labeleng'),
        labelThai: get('labelthai'),
        imageUrl: toDirectImageUrl(get('imageurl')) || '',
        // Items don't have tier
        description: get('description'),
        price: parseFloat(get('price')) || undefined,
        piece: piece === 'infinity' ? 'infinity' : (parseInt(piece) || undefined),
        available: get('available').toLowerCase() === 'true',
      });
    }
  }
  return items;
}

export async function fetchWeaponInfo(): Promise<ItemInfo[]> {
  const url = csvUrl(GID.WEAPON_INFO);
  const res = await fetch(url);
  const text = await res.text();
  const lines = splitCSVRows(text);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());

  const items: ItemInfo[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const get = (name: string) => {
      const idx = headers.indexOf(name);
      return idx !== -1 ? cols[idx] ?? '' : '';
    };
    const itemId = get('itemid');
    if (itemId) {
      const piece = get('piece');
      items.push({
        itemId,
        labelEng: get('label (eng)'),
        labelThai: get('label (thai)'),
        imageUrl: toDirectImageUrl(get('image url')) || '',
        tier: get('tier'), // Weapons have tier
        description: get('description'),
        price: parseFloat(get('price')) || undefined,
        piece: piece === 'infinity' ? 'infinity' : (parseInt(piece) || undefined),
        available: get('available').toLowerCase() === 'true',
      });
    }
  }
  return items;
}

export async function fetchPlayerBag(characterId: string): Promise<BagEntry[]> {
  try {
    const docRef = doc(firestore, FIRESTORE_COLLECTIONS.PLAYER_BAGS, characterId);
    const snapshot = await getDoc(docRef);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    const bagData = snapshot.data() as BagData;
    
    // Convert BagData object to BagEntry array
    const entries: BagEntry[] = Object.entries(bagData).map(([itemId, data]) => ({
      itemId,
      amount: data.amount,
      type: data.type,
    }));
    
    return entries;
  } catch (error) {
    // console.error('Error fetching player bag from Firestore:', error);
    return [];
  }
}

/* ══════════════════════════════════════
   WRITE THEME BACK TO GOOGLE SHEET
   Uses a deployed Google Apps Script web app
   ══════════════════════════════════════ */
export async function patchCharacter(
  characterId: string,
  fields: Record<string, string>,
): Promise<boolean> {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: ACTIONS.PATCH, characterId, fields }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function updateTheme(characterId: string, theme: string[]): Promise<boolean> {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: ACTIONS.UPDATE_THEME, characterId, theme: theme.join(',') }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

/* ══════════════════════════════════════
   ADMIN — Fetch all users from User tab
   ══════════════════════════════════════ */
export interface UserRecord {
  characterId: string;
  password: string;
  role: string;
}

export async function fetchAllUsers(): Promise<UserRecord[]> {
  const url = csvUrl(GID.USER);
  const res = await fetch(url);
  const text = await res.text();
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const idIdx = headers.indexOf('characterid');
  const pwIdx = headers.indexOf('password');
  const roleIdx = headers.indexOf('role');
  if (idIdx === -1 || pwIdx === -1) return [];

  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim());
    return {
      characterId: cols[idIdx] ?? '',
      password: cols[pwIdx] ?? '',
      role: roleIdx !== -1 ? (cols[roleIdx] ?? 'player') : 'player',
    };
  }).filter(u => u.characterId);
}

export interface CreateUserPayload {
  characterId: string;
  password: string;
  nameThai: string;
  nameEng: string;
  nicknameThai: string;
  nicknameEng: string;
  deityBlood: string;
  sex: string;
  cabin: string;
}

export async function createUser(payload: CreateUserPayload): Promise<boolean> {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: ACTIONS.CREATE_USER, ...payload }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function editUser(
  characterId: string,
  fields: Record<string, string>,
): Promise<boolean> {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: ACTIONS.EDIT_USER, characterId, fields }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function deleteUser(characterId: string): Promise<boolean> {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: ACTIONS.DELETE_USER, characterId }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

/* ══════════════════════════════════════
   ITEM MANAGEMENT
   ══════════════════════════════════════ */
export interface CreateItemPayload {
  itemId: string;
  labelEng: string;
  labelThai: string;
  imageUrl: string;
  tier?: string; // Only for weapons
  description: string;
  price: number;
  piece: number | 'infinity';
  available: boolean;
}

export async function createItem(payload: CreateItemPayload): Promise<boolean> {
  // console.log('Creating item with payload:', payload);
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: ACTIONS.CREATE_ITEM, ...payload }),
    });
    // console.log('Create item response:', res);
    return res.ok;
  } catch (e) {
    // console.error('Error creating item:', e);
    return false;
  }
}

export async function editItem(
  itemId: string,
  fields: Record<string, any>,
): Promise<boolean> {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: ACTIONS.EDIT_ITEM, itemId, fields }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function deleteItem(itemId: string): Promise<boolean> {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: ACTIONS.DELETE_ITEM, itemId }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}
