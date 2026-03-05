import { Theme25 } from "./character";
import { PowerDefinition } from "./power";

/** Minion summon (e.g., Hades' skeleton from Undead Army)
 *  Minions have all character fields but are tied to a master.
 *  When master is attacked, minion takes damage instead and dies immediately.
 *  Minions also deal bonus damage (e.g., 50% of master's damage) when master attacks.
 */
export interface Minion {
  // ── Identity ──
  characterId: string;
  masterId: string; // The fighter who summoned this minion
  
  // ── Display info ──
  nicknameEng: string;
  nicknameThai: string;
  sex: string;
  deityBlood: string;
  image?: string;
  theme: Theme25;

  // ── Combat stats ──
  maxHp: number;
  currentHp: number;
  damage: number; // e.g., 50% of master's damage
  attackDiceUp: number;
  defendDiceUp: number;
  speed: number;
  rerollsLeft: number;

  // ── Skill points (inherited from master or default) ──
  passiveSkillPoint: string;
  skillPoint: string;
  ultimateSkillPoint: string;

  // ── Power quota ──
  technique: number;
  quota: number;
  maxQuota: number;

  // ── Critical hit rate ──
  criticalRate: number;

  // ── Powers (usually empty or inherited) ──
  powers: PowerDefinition[];

  // ── Description ──
  description?: string;

  // ── Creation timestamp for spawn animations (ms since epoch)
  createdAt?: number;

  // ── Type identifier for rendering/logic purposes ──
  type: string;
}