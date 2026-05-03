import { splitCSVRows, parseCSVLine } from '../utils/csv';
import { DEITY_THEMES, DEFAULT_THEME } from './characters';
import { getPowers } from './powers';
import { POWER_OVERRIDES } from '../pages/CharacterInfo/constants/overrides';
import { csvUrl, GID } from '../constants/sheets';
import type { Character, Theme25 } from '../types/character';
import type { FighterState } from '../types/battle';
import { Deity } from '../types/deity';
import { DEITY_CABIN } from '../constants/deities';

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
  const strength = num('strength');

  // Calculate critical rate based on strength
  let criticalRate = 25; // default 25%
  if (strength >= 5) {
    criticalRate = 75; // 75% if strength >= 5
  } else if (strength >= 3) {
    criticalRate = 50; // 50% if 3 <= strength < 5
  }

  return {
    characterId: get('npcid'),
    nicknameEng: get('nickname (eng)'),
    nicknameThai: get('nickname (thai)'),
    sex: get('sex'),
    deityBlood: get('deity blood') as Deity,
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
    maxQuota: num('technique') < 3 ? 2 : 3,
    quota: num('technique') < 3 ? 2 : 3,
    criticalRate,

    strength: num('strength'),
    mobility: num('mobility'),
    intelligence: num('intelligence'),
    technique: num('technique'),
    experience: num('experience'),
    fortune: num('fortune'),
  };
}

/** Fetch all NPCs */
export async function fetchAllNPCs(): Promise<Character[]> {
  const res = await fetch(csvUrl(GID.NPC));
  const text = await res.text();
  const lines = splitCSVRows(text);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
  const npcs: Character[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const base = rowToFighter(headers, cols);
    if (!base.characterId) continue;

    npcs.push({
      characterId: base.characterId,
      nicknameThai: base.nicknameThai,
      nicknameEng: base.nicknameEng,
      nameThai: base.nicknameThai,
      nameEng: base.nicknameEng,
      sex: base.sex,
      deityBlood: base.deityBlood,
      cabin: DEITY_CABIN[base.deityBlood as Deity] || 0,
      hp: base.maxHp,
      damage: base.damage,
      defendDiceUp: base.defendDiceUp,
      attackDiceUp: base.attackDiceUp,
      speed: base.speed,
      passiveSkillPoint: base.passiveSkillPoint,
      skillPoint: base.skillPoint,
      ultimateSkillPoint: base.ultimateSkillPoint,
      reroll: base.rerollsLeft,
      currency: 0,
      theme: base.theme || DEITY_THEMES[base.deityBlood.toLowerCase().trim()] || DEFAULT_THEME,
      image: base.image,
      humanParent: '',
      eyeColor: '',
      hairColor: '',
      appearance: '',
      species: '',
      aliases: '',
      age: '',
      birthdate: '',
      beads: '',
      weight: '',
      height: '',
      genderIdentity: '',
      ethnicity: '',
      nationality: '',
      residence: '',
      religion: '',
      personality: '',
      background: '',
      strengths: '',
      weaknesses: '',
      abilities: '',
      powers: '',
      strength: 0,
      mobility: 0,
      intelligence: 0,
      technique: 0,
      experience: 0,
      fortune: 0,
      trainingPoints: 0
    });
  }

  return npcs;
}

/** Fetch all NPCs from the spreadsheet and return as FighterState[] ready for battle. */
export async function fetchNPCs(): Promise<FighterState[]> {
  const res = await fetch(csvUrl(GID.NPC));
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
    const powers = getPowers(powerDeity);
    fighters.push({ ...base, powers });
  }

  return fighters;
}

/** Pick a random NPC from the list. */
export function pickRandomNPC(npcs: FighterState[]): FighterState | undefined {
  if (!npcs.length) return undefined;
  return npcs[Math.floor(Math.random() * npcs.length)];
}
