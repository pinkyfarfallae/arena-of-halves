import { splitCSVRows, parseCSVLine } from '../utils/csv';

export interface Power {
  deity: string;
  type: string;       // Passive | Skill
  name: string;
  description: string;
  status: string;      // Passive | 1st Skill | 2nd Skill | Ultimate
  available: boolean;
}

const POWERS_GID = '979138238';
const WISH_GID = '198616624';
const ITEM_INFO_GID = '403375390';
const WEAPON_INFO_GID = '1866887317';
const PLAYER_BAG_GID = '927684470';

export interface WishEntry {
  deity: string;
  count: number;
}

export interface ItemInfo {
  itemId: string;
  labelEng: string;
  labelThai: string;
  imageUrl: string;
  tier: string;
}

export interface BagEntry {
  itemId: string;
  quantity: number;
}

export interface Character {
  characterId: string;
  nicknameThai: string;
  nicknameEng: string;
  nameThai: string;
  nameEng: string;
  sex: string;
  dietyBlood: string;
  cabin: number;
  hp: number;
  damage: number;
  defendDiceUp: number;
  attackDiceUp: number;
  speed: number;
  passiveSkillPoint: string;
  skillPoint: string;
  ultimateSkillPoint: string;
  reroll: number;
  currency: number;
  theme: Theme25;
  image?: string;

  /* Extended fields */
  humanParent: string;
  eyeColor: string;
  hairColor: string;
  appearance: string;
  species: string;
  aliases: string;
  age: string;
  birthdate: string;
  beads: string;
  weight: string;
  height: string;
  genderIdentity: string;
  ethnicity: string;
  nationality: string;
  residence: string;
  religion: string;
  personality: string;
  background: string;
  powers: string;
  weapons: string;
  items: string;
  strengths: string;
  weaknesses: string;
  abilities: string;
  divineRelationship: string;
  relationships: string;
  goals: string;
  hobbies: string;
  twitter?: string;
  document?: string;

  /* Practice stats (0-5) */
  strength: number;
  mobility: number;
  intelligence: number;
  technique: number;
  experience: number;
  fortune: number;
}

const SHEET_ID = '1P3gaozLPryFY8itFVx7YzBTrFfdSn2tllTKJIMXVWOA';
const CHARACTER_GID = '0';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${CHARACTER_GID}`;

type Theme25 = [string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string];
// [primary, dark, light, accent, bg, fg, surface, muted, border, primaryHover, accentSoft, surfaceHover, bgAlt, shadow, highlight, overlay, navIcon, overlayText, primaryDark, accentDark, leftGrad1, leftGrad2, rightGrad1, rightGrad2, tagColor]

export const THEME_LABELS: string[] = [
  'Primary', 'Dark', 'Light', 'Accent',
  'Background', 'Foreground', 'Surface', 'Muted', 'Border',
  'Primary Hover', 'Accent Soft', 'Surface Hover', 'Bg Alt', 'Shadow', 'Highlight',
  'Overlay', 'Nav Icon', 'Overlay Text', 'Primary Dark', 'Accent Dark',
  'Left Grad 1', 'Left Grad 2', 'Right Grad 1', 'Right Grad 2', 'Tag Color',
];

const DEFAULT_THEME: Theme25 = [
  '#c0a062', '#1a1a2e', '#f2eee8', '#9dad71',
  '#f2eee8', '#1a1a2e', '#f5f1ea', '#8a8a9a', '#d4c9a8',
  '#a8884a', '#c8d4a8', '#ede8e0', '#eae4da', '#3a3a4e', '#f5ecd0',
  '#1a1a2e', '#c0a062', '#ffffff', '#8a7038', '#6e8a4a',
  '#c0a062', '#c8d4a8', '#c0a062', '#c8d4a8', '#8a7038',
];

const DEITY_THEMES: Record<string, Theme25> = {
  //                primary    dark       light      accent     bg         fg         surface    muted      border     primHover  accSoft    surfHover  bgAlt      shadow     highlight  overlay    navIcon    ovrlyText  primDark   accDark    lGrad1     lGrad2     rGrad1     rGrad2     tagColor
  zeus:        ['#f5d547', '#1a1833', '#f5f0e0', '#7eb8da', '#f5f0e0', '#1a1833', '#f7f2e2', '#8a889a', '#d9cd6e', '#d4b530', '#b8d8ea', '#f0eada', '#ede8d4', '#2a2843', '#faf0a0', '#1a1833', '#f5d547', '#ffffff', '#b8a020', '#4a8ab0', '#f5d547', '#b8d8ea', '#f5d547', '#b8d8ea', '#b8a020'],
  poseidon:    ['#2e8bc0', '#0c1929', '#e8f1f5', '#5dbea3', '#e8f1f5', '#0c1929', '#e5f0f6', '#6e7a88', '#7bb3d0', '#1e6fa0', '#a0dcc8', '#dde9f0', '#e0eaf0', '#1c2939', '#c8e8f8', '#0c1929', '#2e8bc0', '#ffffff', '#185a88', '#388a70', '#2e8bc0', '#a0dcc8', '#2e8bc0', '#a0dcc8', '#185a88'],
  demeter:     ['#8db255', '#1a2210', '#f2f5e8', '#d4a040', '#f2f5e8', '#1a2210', '#f2f5ea', '#7a8468', '#b3c88a', '#729840', '#e8cc88', '#eaf0e0', '#eaf0dc', '#2a3220', '#e8f5b0', '#1a2210', '#8db255', '#ffffff', '#5a7830', '#a07020', '#8db255', '#e8cc88', '#8db255', '#e8cc88', '#5a7830'],
  ares:        ['#c43c3c', '#2a0f0f', '#f5e8e8', '#8b4513', '#f5e8e8', '#2a0f0f', '#f6e9e9', '#94686a', '#d07070', '#a82828', '#c8885a', '#f0e0e0', '#f0dcd8', '#3a1f1f', '#f5c8c8', '#2a0f0f', '#c43c3c', '#ffffff', '#8a1818', '#5a2a08', '#c43c3c', '#c8885a', '#c43c3c', '#c8885a', '#8a1818'],
  athena:      ['#8b8b8b', '#1a1a22', '#f0f0f2', '#c9a84c', '#f0f0f2', '#1a1a22', '#f0f0f2', '#8a8a92', '#acacac', '#707070', '#e0d090', '#e8e8ea', '#e8e8ec', '#2a2a32', '#e8e8d0', '#1a1a22', '#8b8b8b', '#ffffff', '#585860', '#907830', '#8b8b8b', '#e0d090', '#8b8b8b', '#e0d090', '#585860'],
  apollo:      ['#f0a830', '#291a05', '#faf3e0', '#e86833', '#faf3e0', '#291a05', '#faf4e2', '#96886a', '#d9be60', '#d09018', '#f0a870', '#f4ecda', '#f2ecd4', '#392a15', '#fae8a0', '#291a05', '#f0a830', '#ffffff', '#b07810', '#b04018', '#f0a830', '#f0a870', '#f0a830', '#f0a870', '#b07810'],
  hephaestus:  ['#d4672a', '#1f1008', '#f5ece0', '#a0522d', '#f5ece0', '#1f1008', '#f5ece1', '#8e7a62', '#d99058', '#b85018', '#c88868', '#f0e4d8', '#eee4d4', '#2f2018', '#f5d4a0', '#1f1008', '#d4672a', '#ffffff', '#984818', '#703818', '#d4672a', '#c88868', '#d4672a', '#c88868', '#984818'],
  aphrodite:   ['#e8789a', '#2a1020', '#f9eff2', '#d4a0c0', '#f9eff2', '#2a1020', '#f9eff3', '#94707e', '#e8a0b4', '#d06080', '#e8c8d8', '#f4e8ec', '#f4e6ec', '#3a2030', '#fad8e8', '#2a1020', '#e8789a', '#ffffff', '#b84870', '#a06888', '#e8789a', '#e8c8d8', '#e8789a', '#e8c8d8', '#b84870'],
  hermes:      ['#d4a030', '#1a1810', '#f5f0e0', '#6b9e8a', '#f5f0e0', '#1a1810', '#f5f1e2', '#8a886a', '#d9c260', '#b88818', '#a8c8b8', '#f0eada', '#eee8d4', '#2a2820', '#f5e8a0', '#1a1810', '#d4a030', '#ffffff', '#a07818', '#487058', '#d4a030', '#a8c8b8', '#d4a030', '#a8c8b8', '#a07818'],
  dionysus:    ['#8e44ad', '#1a0d22', '#f2e8f5', '#c9a84c', '#f2e8f5', '#1a0d22', '#f2e9f5', '#7e6e8a', '#a878c0', '#743090', '#e0d090', '#ece0f0', '#eae0f0', '#2a1d32', '#e8d0f5', '#1a0d22', '#8e44ad', '#ffffff', '#602880', '#907830', '#8e44ad', '#e0d090', '#8e44ad', '#e0d090', '#602880'],
  hades:       ['#5a5a6e', '#0d0d15', '#e8e8ee', '#4a9a7a', '#e8e8ee', '#0d0d15', '#e8e8ee', '#6e6e7a', '#8a8a9a', '#444458', '#88c4a8', '#e0e0e8', '#e0e0e6', '#1d1d25', '#d0d0e8', '#0d0d15', '#5a5a6e', '#ffffff', '#383848', '#2a7050', '#5a5a6e', '#88c4a8', '#5a5a6e', '#88c4a8', '#383848'],
  persephone:  ['#b05080', '#1f0d18', '#f5e8f0', '#7db85a', '#f5e8f0', '#1f0d18', '#f5e9f0', '#8a6e7e', '#c07898', '#983868', '#b0d898', '#f0e0ea', '#eee0e8', '#2f1d28', '#f5d0e0', '#1f0d18', '#b05080', '#ffffff', '#803058', '#508838', '#b05080', '#b0d898', '#b05080', '#b0d898', '#803058'],
  hypnos:      ['#6a5acd', '#0f0d22', '#eee8f5', '#b8a9d4', '#eee8f5', '#0f0d22', '#eee9f5', '#6e6a8a', '#9088ca', '#5240b0', '#d4c8e8', '#e8e0f0', '#e6e0f0', '#1f1d32', '#dcd0f5', '#0f0d22', '#6a5acd', '#ffffff', '#483898', '#8070a8', '#6a5acd', '#d4c8e8', '#6a5acd', '#d4c8e8', '#483898'],
  nemesis:     ['#a0522d', '#1a1010', '#f2ece8', '#c43c3c', '#f2ece8', '#1a1010', '#f3ece9', '#8a7468', '#b8805a', '#883c18', '#e07070', '#ece4e0', '#ece2dc', '#2a2020', '#f0d0b0', '#1a1010', '#a0522d', '#ffffff', '#703818', '#8a1818', '#a0522d', '#e07070', '#a0522d', '#e07070', '#703818'],
  hecate:      ['#6b3fa0', '#100d1a', '#eee8f5', '#2ecc71', '#eee8f5', '#100d1a', '#eee9f5', '#6e688a', '#9070b8', '#522888', '#78e8a8', '#e8e0f0', '#e6e0f0', '#201d2a', '#d8c8f5', '#100d1a', '#6b3fa0', '#ffffff', '#482870', '#1a9848', '#6b3fa0', '#78e8a8', '#6b3fa0', '#78e8a8', '#482870'],
  hera:        ['#c9a84c', '#1a1810', '#f5f2e0', '#4682b4', '#f5f2e0', '#1a1810', '#f5f2e2', '#8a886a', '#d4c070', '#b09038', '#88b0d4', '#f0eada', '#eeeaD4', '#2a2820', '#f5eaa0', '#1a1810', '#c9a84c', '#ffffff', '#907830', '#285a88', '#c9a84c', '#88b0d4', '#c9a84c', '#88b0d4', '#907830'],
  artemis:     ['#6eaa78', '#0d1a12', '#e8f5ec', '#c0c0c0', '#e8f5ec', '#0d1a12', '#e9f5ec', '#6e8a72', '#98c4a0', '#589060', '#d8d8d8', '#e0f0e4', '#e0ede4', '#1d2a22', '#d0f0d8', '#0d1a12', '#6eaa78', '#ffffff', '#487850', '#888888', '#6eaa78', '#d8d8d8', '#6eaa78', '#d8d8d8', '#487850'],
  iris:        ['#da70d6', '#1a0d1a', '#f5e8f5', '#87ceeb', '#f5e8f5', '#1a0d1a', '#f5e9f5', '#8a6e8a', '#e098dc', '#c058b8', '#b8e0f0', '#f0e0f0', '#eee0f0', '#2a1d2a', '#f0d0f5', '#1a0d1a', '#da70d6', '#ffffff', '#a848a0', '#5898b8', '#da70d6', '#b8e0f0', '#da70d6', '#b8e0f0', '#a848a0'],
  nike:        ['#daa520', '#1a1508', '#f5f0d8', '#cd853f', '#f5f0d8', '#1a1508', '#f5f0da', '#8a8460', '#d8be50', '#c08d10', '#e0b878', '#f0ead0', '#eee8cc', '#2a2518', '#f5e898', '#1a1508', '#daa520', '#ffffff', '#a07810', '#985a28', '#daa520', '#e0b878', '#daa520', '#e0b878', '#a07810'],
  hebe:        ['#f0a0b0', '#1f1018', '#faf0f2', '#90d0a0', '#faf0f2', '#1f1018', '#faf0f3', '#946e78', '#f0b8c4', '#d88898', '#b8e8c0', '#f4e8ec', '#f4e6ec', '#2f2028', '#fad8e0', '#1f1018', '#f0a0b0', '#ffffff', '#c07080', '#589868', '#f0a0b0', '#b8e8c0', '#f0a0b0', '#b8e8c0', '#c07080'],
  tyche:       ['#50c878', '#0d1a12', '#e8f5ed', '#daa520', '#e8f5ed', '#0d1a12', '#e9f5ed', '#6e8a72', '#80d498', '#38b060', '#e8cc68', '#e0f0e6', '#e0ede4', '#1d2a22', '#c8f5d8', '#0d1a12', '#50c878', '#ffffff', '#309050', '#a07810', '#50c878', '#e8cc68', '#50c878', '#e8cc68', '#309050'],
};

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
    return idx !== -1 ? cols[idx] ?? '' : '';
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
    dietyBlood: get('diety blood'),
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
    theme: parseTheme(get('theme'), get('diety blood')),
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
    genderIdentity: get('gender identity') || get('gender'),
    ethnicity: get('ethnicity'),
    nationality: get('nationality'),
    residence: get('residence'),
    religion: get('religion'),
    personality: get('personality'),
    background: get('background'),
    powers: get('powers') || get('special powers'),
    weapons: get('weapons') || get('weapons/items'),
    items: get('items'),
    strengths: get('strengths'),
    weaknesses: get('weaknesses'),
    abilities: get('abilities'),
    divineRelationship: get('divine relationship'),
    relationships: get('relationships'),
    goals: get('goals'),
    hobbies: get('hobbies') || get('preferences'),
    twitter: get('twitter') || get('x') || undefined,
    document: get('document') || get('document link') || get('doc') || undefined,

    strength: num('strength'),
    mobility: num('mobility'),
    intelligence: num('intelligence'),
    technique: num('technique'),
    experience: num('experience'),
    fortune: num('fortune'),
  };
}

export async function fetchCharacter(characterId: string): Promise<Character | null> {
  const res = await fetch(CSV_URL);
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
  const res = await fetch(CSV_URL);
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

export async function fetchPowers(deity: string): Promise<Power[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${POWERS_GID}`;
  const res = await fetch(url);
  const text = await res.text();
  const lines = splitCSVRows(text);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());

  const powers: Power[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const get = (name: string) => {
      const idx = headers.indexOf(name);
      return idx !== -1 ? cols[idx] ?? '' : '';
    };
    if (get('diety').toLowerCase() === deity.toLowerCase()) {
      powers.push({
        deity: get('diety'),
        type: get('type'),
        name: get('name'),
        description: get('description'),
        status: get('status'),
        available: get('available').toUpperCase() === 'TRUE',
      });
    }
  }
  return powers;
}

export async function fetchWishes(characterId: string): Promise<WishEntry[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${WISH_GID}`;
  const res = await fetch(url);
  const text = await res.text();
  const lines = splitCSVRows(text);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
  const colIdx = headers.indexOf(characterId.toLowerCase());
  if (colIdx === -1) return [];

  const deityIdx = headers.indexOf('diety');
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
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${ITEM_INFO_GID}`;
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
      items.push({
        itemId,
        labelEng: get('label (eng)'),
        labelThai: get('label (thai)'),
        imageUrl: toDirectImageUrl(get('image url')) || '',
        tier: get('teir') || get('tier'),
      });
    }
  }
  return items;
}

export async function fetchWeaponInfo(): Promise<ItemInfo[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${WEAPON_INFO_GID}`;
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
      items.push({
        itemId,
        labelEng: get('label (eng)'),
        labelThai: get('label (thai)'),
        imageUrl: toDirectImageUrl(get('image url')) || '',
        tier: get('teir') || get('tier'),
      });
    }
  }
  return items;
}

export async function fetchPlayerBag(characterId: string): Promise<BagEntry[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${PLAYER_BAG_GID}`;
  const res = await fetch(url);
  const text = await res.text();
  const lines = splitCSVRows(text);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
  const colIdx = headers.indexOf(characterId.toLowerCase());
  if (colIdx === -1) return [];

  const idIdx = headers.indexOf('itemid');
  if (idIdx === -1) return [];

  const entries: BagEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const itemId = cols[idIdx]?.trim();
    const quantity = parseInt(cols[colIdx] ?? '0', 10) || 0;
    if (itemId && quantity > 0) entries.push({ itemId, quantity });
  }
  return entries;
}

/* ══════════════════════════════════════
   WRITE THEME BACK TO GOOGLE SHEET
   Uses a deployed Google Apps Script web app
   ══════════════════════════════════════ */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyi9CJYVaUHBAg1MTxExKjND63yQnFrBsBMrE35buB5510AEhDqK8TVs9br9MwrNpc/exec';

export async function updateTheme(characterId: string, theme: string[]): Promise<boolean> {
  try {
    const params = new URLSearchParams({
      action: 'updateTheme',
      characterId,
      theme: theme.join(','),
    });
    await fetch(`${APPS_SCRIPT_URL}?${params}`, { mode: 'no-cors' });
    return true;
  } catch {
    return false;
  }
}

export async function updateCharacter(
  characterId: string,
  fields: Record<string, string>,
): Promise<boolean> {
  try {
    const params = new URLSearchParams({
      action: 'updateCharacter',
      characterId,
      ...fields,
    });
    await fetch(`${APPS_SCRIPT_URL}?${params}`, { mode: 'no-cors' });
    return true;
  } catch {
    return false;
  }
}
