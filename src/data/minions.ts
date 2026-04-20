import { Theme25 } from '../types/character';
// Import skeleton sprite so bundler provides a correct asset URL
import skeletonImg from '../images/minions/skeleton.png';
import { Minion } from '../types/minions';

/**
 * Create a skeleton minion for Hades' Undead Army.
 * @param master - The master fighter (FighterState)
 * @returns Minion object
 */
export function createSkeletonMinion(master: {
  characterId: string;
  nicknameEng: string;
  nicknameThai: string;
  sex: string;
  deityBlood: string;
  image?: string;
  theme: Theme25;
  damage: number;
}) : Minion {
  return {
    characterId: `${master.characterId}_skeleton_${Date.now()}`,
    masterId: master.characterId,
    nicknameEng: `${master.nicknameEng}'s Skeleton`,
    nicknameThai: `โครงกระดูกของ${master.nicknameThai}`,
    sex: 'none',
    deityBlood: master.deityBlood,
    image: skeletonImg,
    theme: master.theme,
    maxHp: 1,
    currentHp: 1,
    damage: Math.ceil(master.damage * 0.5),
    attackDiceUp: 0,
    defendDiceUp: 0,
    speed: 0,
    rerollsLeft: 0,
    passiveSkillPoint: '',
    skillPoint: '',
    ultimateSkillPoint: '',
    technique: 0,
    quota: 0,
    maxQuota: 0,
    criticalRate: 0,
    powers: [],
    description: "เมื่อทายาทแห่งฮาเดสทำการโจมตี โครงกระดูกจะทำการโจมตีสมทบ ทำดาเมจ 50% ของดาเมจโจมตีปกติของผู้ร่าย และหากผู้ร่ายโดนโจมตี โครงกระดูกจะเข้ารับดาเมจแทนทั้งหมด จากนั้นจะหายไปทันที ทั้งนี้ ดาเมจสมทบจากโครงกระดูกติดคริติคอลได้ โดยนับการโจมตีหลักของผู้ร่ายว่าติดคริติคอลหรือไม่",
    type: 'skeleton',
    createdAt: Date.now(),
  };
}
