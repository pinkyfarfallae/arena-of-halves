import { splitCSVRows, parseCSVLine } from '../utils/csv';
import { DEITY_THEMES, DEFAULT_THEME, fetchPowers } from './characters';
import { POWER_OVERRIDES } from '../pages/CharacterInfo/constants/overrides';
import { csvUrl } from '../constants/sheets';
import type { Theme25, Power } from '../types/character';
import type { FighterState } from '../types/battle';

const NPC_GID = '1431163652';

/** Convert Google Drive share links to direct thumbnail URLs */
function toDirectImageUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  if (raw.includes('drive.google.com/thumbnail') || raw.includes('uc?id=')) return raw;

  let fileId: string | undefined;
  const m1 = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) fileId = m1[1];
  if (!fileId) {
    const m2 = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m2) fileId = m2[1];
  }
  if (!fileId) return raw;

  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
}

function parseTheme(raw: string, deity?: string): Theme25 {
  const cleaned = raw.replace(/"/g, '').trim();
  const colors = cleaned.split(',').map((c) => c.trim()).filter(Boolean);
  const fallback = deity
    ? (DEITY_THEMES[deity.toLowerCase().trim()] || DEFAULT_THEME)
    : DEFAULT_THEME;
  if (colors.length === 0) return fallback;
  return Array.from({ length: 25 }, (_, i) => colors[i] || fallback[i]) as Theme25;
}

function rowToFighter(headers: string[], cols: string[]): Omit<FighterState, 'powers'> {
  const get = (name: string) => {
    const idx = headers.indexOf(name);
    return idx !== -1 ? (cols[idx] ?? '').trim() : '';
  };
  const num = (name: string) => parseInt(get(name), 10) || 0;

  const hp = num('hp');
  return {
    characterId: get('npcid'),
    nicknameEng: get('nickname (eng)'),
    nicknameThai: get('nickname (thai)'),
    sex: get('sex'),
    deityBlood: get('deity blood'),
    image: toDirectImageUrl(get('image url')),
    theme: parseTheme(get('theme'), get('deity blood')),
    maxHp: hp,
    currentHp: hp,
    damage: num('damage'),
    attackDiceUp: num('attack dice up'),
    defendDiceUp: num('defend dice up'),
    speed: num('speed'),
    rerollsLeft: num('reroll'),
    passiveSkillPoint: get('passive skill point'),
    skillPoint: get('skill point'),
    ultimateSkillPoint: get('ultimate skill point'),
  };
}

/** Fetch all NPCs from the spreadsheet and return as FighterState[] ready for battle. */
export async function fetchNPCs(): Promise<FighterState[]> {
  const res = await fetch(csvUrl(NPC_GID));
  const text = await res.text();
  const lines = splitCSVRows(text);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
  const fighters: FighterState[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const base = rowToFighter(headers, cols);
    if (!base.characterId) continue;

    const powerDeity = POWER_OVERRIDES[base.characterId] ?? base.deityBlood;
    let powers: Power[] = [];
    try {
      powers = await fetchPowers(powerDeity);
    } catch { /* use empty */ }

    fighters.push({ ...base, powers });
  }

  return fighters;
}

/** Pick a random NPC from the list. */
export function pickRandomNPC(npcs: FighterState[]): FighterState | undefined {
  if (!npcs.length) return undefined;
  return npcs[Math.floor(Math.random() * npcs.length)];
}
