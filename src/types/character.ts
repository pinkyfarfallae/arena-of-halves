export type Theme25 = [string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string];
// [primary, dark, light, accent, bg, fg, surface, muted, border, primaryHover, accentSoft, surfaceHover, bgAlt, shadow, highlight, overlay, navIcon, overlayText, primaryDark, accentDark, leftGrad1, leftGrad2, rightGrad1, rightGrad2, tagColor]

export interface Power {
  deity: string;
  type: string;       // Passive | Skill
  name: string;
  description: string;
  status: string;      // Passive | 1st Skill | 2nd Skill | Ultimate
  available: boolean;
}

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
  deityBlood: string;
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
