import type { PowerDefinition } from '../types/power';
import { EFFECT_TAGS } from '../constants/effectTags';
import { EFFECT_TYPES, TARGET_TYPES, MOD_STAT } from '../constants/effectTypes';
import { POWER_NAMES, POWER_TYPES } from '../constants/powers';
import { DEITY } from '../constants/deities';

/**
 * Power name constants for use in DEITY_POWERS.
 * Use these for the `name` field so battle logic (battleRoom, powerEngine, etc.) can match by symbol.
 */
export const DEITY_POWER_NAMES = POWER_NAMES;

/**
 * All deity power definitions — single source of truth for battle logic.
 * Keyed by deity name (case-sensitive, matching DEITY constants).
 *
 * Mechanical values (effect/target/value/duration/modStat) are the best
 * single-effect approximation. Powers with complex/multi-effect logic
 * will need custom handlers in powerEngine.ts.
 */
export const DEITY_POWERS: Record<string, PowerDefinition[]> = {
  /* ────────────────────────── Zeus ────────────────────────── */
  [DEITY.ZEUS]: [
    {
      deity: DEITY.ZEUS,
      type: POWER_TYPES.PASSIVE,
      name: DEITY_POWER_NAMES.LIGHTNING_SPARK,
      description:
        'เมื่อทายาทแห่งซุสโจมตีศัตรูสำเร็จ ศัตรูผู้ถูกโจมตีจะติดสถานะถูกช็อต และหากศัตรูที่มีช็อตอยู่ได้รับช็อตซ้ำอีกครั้ง จะได้รับดาเมจเพิ่มเติม 100% ของดาเมจโจมตีปกติจากนั้นสถานะช็อตทั้งหมดบนตัวเป้าหมายจึงจะถูกลบล้าง',
      available: true,
      effect: EFFECT_TYPES.DOT,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 999,
      afflictions: [EFFECT_TAGS.SHOCK],
    },
    {
      deity: DEITY.ZEUS,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.BEYOND_THE_NIMBUS,
      description:
        'ทายาทแห่งซุสจะเข้าสู่สถานะ "เหนือเมฆครึ้ม" เป็นเวลา 2 รอบ นั่นคือ ทายาทแห่งซุสจะมีความเร็วเพิ่มขึ้น 2 หน่วยและอัตราติดคริติคอลเพิ่มขึ้น 25% จากนั้นทำการโจมตีต่อทันที  ทั้งนี้ ขณะที่ทายาทแห่งซุสอยู่ในสถานะเหนือเมฆครึ้ม  หากทายาทแห่งซุสทำการโจมตีศัตรูเป้าหมายได้สำเร็จ ศัตรูทั้งสนามจะเข้าสู่สถานะติดช็อตโดยพร้อมเพรียง',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 2,
      duration: 2,
      modStat: MOD_STAT.SPEED,
      effects: [
        { effect: EFFECT_TYPES.BUFF, target: TARGET_TYPES.SELF, value: 2, duration: 2, modStat: MOD_STAT.SPEED },
        { effect: EFFECT_TYPES.BUFF, target: TARGET_TYPES.SELF, value: 25, duration: 2, modStat: MOD_STAT.CRITICAL_RATE },
      ],
      afflictions: [EFFECT_TAGS.SHOCK],
    },
    {
      deity: DEITY.ZEUS,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.JOLT_ARC,
      description:
        'ทายาทแห่งซุสเสียสละโอกาสในการโจมตีเพื่อใช้พลังนี้ทำให้ศัตรูทุกเป้าหมายที่อยู่ในสถานะช็อตถูกระเบิดซึ่งทำให้เกิดการทำดาเมจทันทีทั้งหมด ซึ่งศัตรูทุกตัวที่ได้รับดาเมจจากพลังนี้จะโดนลดความเร็วลง 7 หน่วยเป็นระยะเวลา 2 รอบ ',
      available: true,
      effect: EFFECT_TYPES.DAMAGE,
      target: TARGET_TYPES.AREA,
      value: 0,
      duration: 0,
      skipDice: true,
      requiresTargetHasEffect: EFFECT_TAGS.SHOCK,
      afflictions: [EFFECT_TAGS.JOLT_ARC_DECELERATION],
    },
    {
      deity: DEITY.ZEUS,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.KERAUNOS_VOLTAGE,
      description:
        'ทายาทแห่งซุสเสียสละโอกาสในการโจมตีเพื่อเรียกอัสนีบาตผ่าศัตรู 1 ตัว ทำดาเมจ 3 หน่วยทันทีรวมถึงทำดาเมจโดนศัตรูคนอื่นรอบข้าง 2 คน ทำดาเมจ 2 หน่วยโดยไม่ต้องทอยเต๋าอีกทั้งศัตรูจะไม่มีโอกาสในการป้องกัน ทั้งนี้ ศักตรูทั้งหมดที่ได้รับดาเมจจากการใช้พลังนี้จะติดสถานะช็อตเช่นกัน ทั้งนี้ เครานอส โวลเทจสามารถติดคริติคอลได้และจะเพิ่มเติมอัตราคริติคอลของทายาทแห่งซุสในการใช้พลังนี้ขึ้นอีก 25%',
      available: true,
      effect: EFFECT_TYPES.DAMAGE,
      target: TARGET_TYPES.ENEMY,
      value: 3,
      duration: 0,
      skipDice: true,
      afflictions: [EFFECT_TAGS.SHOCK],
    },
  ],

  /* ────────────────────────── Poseidon ────────────────────── */
  [DEITY.POSEIDON]: [
    {
      deity: DEITY.POSEIDON,
      type: POWER_TYPES.PASSIVE,
      name: DEITY_POWER_NAMES.OCEAN_BLESSING,
      description:
        'ทุกครั้งที่ใช้สกิล จะรักษาตนเองโดยฟื้นฟู HP 1 หน่วย',
      available: true,
      effect: EFFECT_TYPES.HEAL,
      target: TARGET_TYPES.SELF,
      value: 1,
      duration: 999,
    },
    {
      deity: DEITY.POSEIDON,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.AQUA_PRISON,
      description:
        'ใช้น้ำพันธนาการศัตรู 1 ตัว ในเทิร์นต่อไปของเป้าหมายใช้สกิลไม่ได้',
      available: true,
      effect: EFFECT_TYPES.STUN,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 1,
    },
    {
      deity: DEITY.POSEIDON,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.WHIRLPOOL_SPLASH,
      description:
        'ยิงกระสุนน้ำวนใส่ศัตรู 1 ตัว +2 แต้มเต๋าโจมตีให้กับตนเอง จากนั้นทอยโจมตีตามปกติ เมื่อโจมตีสำเร็จศัตรูจะเสียแต้มสกิล 2 แต้ม',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 2,
      duration: 0,
      modStat: MOD_STAT.ATTACK_DICE_UP,
    },
    {
      deity: DEITY.POSEIDON,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.GIGANTIC_WAVE,
      description:
        'สร้างคลื่นยักษ์โจมตีศัตรูทุกตัว สร้างความเสียหาย 2 หน่วย และ -2 แต้มเต๋าทุกประเภทของศัตรูเป็นเวลา 2 รอบ',
      available: true,
      effect: EFFECT_TYPES.DAMAGE,
      target: TARGET_TYPES.ENEMY,
      value: 2,
      duration: 0,
    },
  ],

  /* ────────────────────────── Demeter ────────────────────── */
  [DEITY.DEMETER]: [
    {
      deity: DEITY.DEMETER,
      type: POWER_TYPES.PASSIVE,
      name: DEITY_POWER_NAMES.SUSTAINABILITY,
      description:
        'เมื่อใช้สกิล ทอยเต๋า d4 หากทอยได้ 4 จะได้รับแต้มสกิลคืน 1 หน่วย',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 1,
      duration: 999,
    },
    {
      deity: DEITY.DEMETER,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.ROOTING,
      description:
        'เสกรากไม้รัดศัตรู 1 ตัว ทำให้ถูกข้ามเทิร์นในรอบนั้น',
      available: true,
      effect: EFFECT_TYPES.STUN,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 1,
    },
    {
      deity: DEITY.DEMETER,
      type: POWER_TYPES.SECOND_SKILL,
      name: 'Living Vine',
      description:
        'เสกเถาวัลย์ขึ้นบนสนาม 1 เส้น เมื่อเราโจมตี เถาวัลย์จะทำดาเมจเพิ่ม 1 หน่วย และเมื่อเราโดนโจมตี เถาวัลย์จะรับดาเมจแทนและหายไปทันที โดยบนสนามมีเถาวัลย์ได้มากสุด 2 เส้นในเวลาเดียวกัน',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 1,
      duration: 999,
      modStat: MOD_STAT.DAMAGE,
    },
    {
      deity: DEITY.DEMETER,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.WILD_BLOOM,
      description:
        'ใช้สกิลแบบเสริมพลัง / * Rooting: เลือกเป้าหมายเพิ่มได้เป็น 2 ตัว / * Living Vine: เถาวัลย์จะรับดาเมจแทนได้อีก 1 ครั้ง และเมื่อร่ายแล้ว แสดงผลกับเถาวัลย์ที่มีอยู่แล้วบนสนามด้วยเช่นกัน',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 0,
      duration: 0,
    },
  ],

  /* ────────────────────────── Ares ────────────────────────── */
  [DEITY.ARES]: [
    {
      deity: DEITY.ARES,
      type: POWER_TYPES.PASSIVE,
      name: DEITY_POWER_NAMES.BLOODLUST,
      description:
        '/ * เมื่อโจมตีศัตรูที่มี HP มากกว่าตนเอง จะตีแรงขึ้น 1 หน่วย / * เมื่อโจมตีศัตรูที่มี HP น้อยกว่าตนเอง จะ +2 แต้มเต๋าโจมตี',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 1,
      duration: 999,
      modStat: MOD_STAT.DAMAGE,
    },
    {
      deity: DEITY.ARES,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.WAR_CRY,
      description:
        'มอบความโกรธเกรี้ยวให้กับตนเองและเพื่อน 1 คน ทำให้การโจมตีครั้งถัดไปจะทำดาเมจแรงขึ้น 1 หน่วย จากนั้นใช้เทิร์นโจมตีปกติทันที',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 1,
      duration: 0,
      modStat: MOD_STAT.DAMAGE,
    },
    {
      deity: DEITY.ARES,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.WEAPON_CURSING,
      description:
        'แต้มเต๋า +3 โจมตีให้กับตนเอง 3 รอบ จากนั้นใช้เทิร์นโจมตีปกติทันที',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 3,
      duration: 3,
      modStat: MOD_STAT.ATTACK_DICE_UP,
    },
    {
      deity: DEITY.ARES,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.INSANITY,
      description:
        'สาปอาวุธของศัตรู 1 คน ทำให้การโจมตีครั้งถัดไปไม่ว่าจากโจมตีปกติ สกิล หรืออัลติเมท การโจมตีนั้นจะไม่สามารถสร้างความเสียหายได้',
      available: true,
      effect: EFFECT_TYPES.DEBUFF,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 1,
    },
  ],

  /* ────────────────────────── Athena ────────────────────────── */
  [DEITY.ATHENA]: [
    {
      deity: DEITY.ATHENA,
      type: POWER_TYPES.PASSIVE,
      name: DEITY_POWER_NAMES.INTELLIGENCE,
      description:
        'เมื่อโจมตีหรือป้องกันสำเร็จ แต้มเต๋าประเภทนั้น ๆ จะ +1 ทับซ้อนได้ถึง +3 และเมื่อโจมตีหรือป้องกันไม่สำเร็จ แต้มที่เพิ่มมาจะหายไป',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 1,
      duration: 999,
      modStat: MOD_STAT.ATTACK_DICE_UP,
    },
    {
      deity: DEITY.ATHENA,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.WISE_TACTIC,
      description:
        'ทำให้แต้มเต๋าที่ศัตรูทอยไปเป็นโมฆะ แล้วสั่งทอยใหม่ (สามารถใช้สกิลนี้ได้เมื่อศัตรูทอยเต๋าไปแล้วเท่านั้น แทรกเทิร์นใช้ได้ตลอด)',
      available: true,
      effect: EFFECT_TYPES.DEBUFF,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 0,
    },
    {
      deity: DEITY.ATHENA,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.PARRY,
      description:
        'ปลดอาวุธของศัตรู ทำให้ศัตรูไม่ได้รับโบนัสและเอฟเฟคของอุปกรณ์สวมใส่หรือไอเทมประเภทโพชั่นเป็นเวลา 2 รอบ',
      available: true,
      effect: EFFECT_TYPES.DEBUFF,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 2,
    },
    {
      deity: DEITY.ATHENA,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.DISARM,
      description:
        'ทำ +2 แต้มเต๋าป้องกันและ +1 ดาเมจให้กับทุกคนในทีม เป็นเวลา 3 รอบ',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 2,
      duration: 3,
      modStat: MOD_STAT.DEFEND_DICE_UP,
    },
  ],

  /* ────────────────────────── Apollo ────────────────────────── */
  [DEITY.APOLLO]: [
    {
      deity: DEITY.APOLLO,
      type: POWER_TYPES.PASSIVE,
      name: DEITY_POWER_NAMES.SUNBORN_SOVEREIGN,
      description:
        'ผลของการฟื้นฟู HP ที่ทายาทแห่งเทพอพอลโลได้รับ +1 เสมอ และเมื่อทายาทแห่งเทพอพอลโลสร้างหรือได้รับการฟื้นฟู จะ +1 แต้มเต๋าทุกประเภทถาวร โดยสามารถสะสมแต้มเต๋าได้สูงสุด +2',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 1,
      duration: 999,
    },
    {
      deity: DEITY.APOLLO,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.APOLLO_S_HYMN,
      description:
        'ทายาทแห่งเทพอพอลโลเสียสละโอกาสในการโจมตีเพื่อขับขานบทเพลงรักษา เลือกเพื่อนร่วมทีม 1 คนเพื่อฟื้นฟู HP 2 หน่วย (หนึ่งครั้ง) และมอบอัตราคริติคอล 25% ให้กับตนเองและเป้าหมายเป็นระยะเวลา 2 รอบ',
      available: true,
      effect: EFFECT_TYPES.HEAL,
      target: TARGET_TYPES.ALLY,
      value: 2,
      duration: 2,
      skipDice: true,
      blessings: [EFFECT_TAGS.APOLLO_S_HYMN],
    },
    {
      deity: DEITY.APOLLO,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.IMPRECATED_POEM,
      description:
        'ทายาทแห่งเทพอพอลโลเสียสละโอกาสในการโจมตีเพื่อเลือกกล่าว "กลอนคำสาป" 1 บท ใส่ศัตรู 1 เป้าหมาย เป็นเวลา 2 รอบ โดยมีบทกลอนดังนี้ /* สูญสิ้นเยียวยา: ผลการฟื้นฟู HP ที่ผู้ต้องสาปได้รับจะไม่มีผลใด ๆ /* ดวงเนตรเลือนพร่า: ผู้ต้องสาปจะไม่สามารถเลือกเป้าหมายในการโจมตีหรือใช้พลังใด ๆ ได้ รวมทั้งยังทำให้โอกาสที่การกระทำของผู้ต้องสาปจะไร้ผลในอัตรา 25% /* ทุกขาอนันต์: ระยะเวลาของสถานะผิดปกติที่ต้องสาปมีทั้งหมดจะขยายออกไปอีก 2 รอบ จากนั้นฤทธิ์ของบทกลอนจะสิ้นลงทันที',
      available: true,
      effect: EFFECT_TYPES.DEBUFF,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 2,
      skipDice: true,
      requiresPoemSelection: true,
      afflictions: [EFFECT_TAGS.HEALING_NULLIFIED, EFFECT_TAGS.DISORIENTED, EFFECT_TAGS.ETERNAL_AGONY],
    },
    {
      deity: DEITY.APOLLO,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.VOLLEY_ARROW,
      description:
        'ทายาทแห่งอพอลโลจะเข้าสู่สถานะ "กระหน่ำยิง" เป็นระยะเวลา3 รอบ จากนั้นทำการโจมตีปกติทันที ในสถานะกระหน่ำยิงนี้ ทายาทแห่งอพอลโลจะมีความแม่นยำมากขึ้น โดยจะเป็นการ +3 แต้มเต๋าโจมตีและหากทำการโจมตีสำเร็จด้วยการทอยเต๋า ทายาทแห่งอพอลโลจะมีโอกาส 75% ที่จะโจมตีเสริม 1 ครั้ง โดยจะเกิดขึ้นเรื่อยๆ และโอกาสจะลดลง 25% ต่อการโจมตีเสริมที่เกิดขึ้น 1 ครั้ง (ลดลงไม่ต่ำไปกว่า 25%) จนกว่าจะสุ่มไม่ติด ทั้งนี้ การโจมตีเสริมจะทำดาเมจ 50% ของการโจมตีปกติและการโจมตีปกติในสถานะกระหน่ำยิงนี้สามารถติดคริติคอลได้ โดยจะคิดจากการโจมตีหลักในครั้งแรก หากการโจมตีหลักติดคริติคอล การโจมตีเสริมก็จะติดคริติคอลไปด้วย',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 3,
      duration: 3,
      modStat: MOD_STAT.ATTACK_DICE_UP,
    },
  ],

  /* ────────────────────────── Hephaestus ────────────────────── */
  [DEITY.HEPHAESTUS]: [
    {
      deity: DEITY.HEPHAESTUS,
      type: POWER_TYPES.PASSIVE,
      name: DEITY_POWER_NAMES.IRON_SKIN,
      description:
        'เมื่อสร้างอุปกรณ์ใด ๆ +1 แต้มเต๋าป้องถาวรให้กับตนเอง (สูงสุด +3)',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 1,
      duration: 999,
      modStat: MOD_STAT.DEFEND_DICE_UP,
    },
    {
      deity: DEITY.HEPHAESTUS,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.THE_BLACKSMITH,
      description:
        'ตีบวกชุดเกราะให้ตนเองหรือเพื่อน 1 คน +3 แต้มเต๋าทุกประเภท (3 รอบ) หากโจมตี/ป้องกันไม่สำเร็จ ชุดเกราะจะถูกทำลายหายไปทันที',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 3,
      duration: 3,
    },
    {
      deity: DEITY.HEPHAESTUS,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.OVERHEAT,
      description:
        'สร้างเกราะมือเหล็ก ให้ตนเองหรือเพื่อน 1 คนใส่ (2 รอบ) โดยจะเปลี่ยนแต้มบวกเต๋าป้องกันที่มีทั้งหมดเป็นแต้มบวกเต๋าโจมตี และการโจมตีครั้งถัดไปทำดาเมจแรงขึ้น 100% จากนั้นใช้เทิร์นโจมตีปกติทันที',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 0,
      duration: 2,
      modStat: MOD_STAT.ATTACK_DICE_UP,
    },
    {
      deity: DEITY.HEPHAESTUS,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.PROTECTIVE_AEGIS,
      description:
        'สร้างโล่สัมฤทธิ์ขึ้นปกป้องทั้งทีม ป้องกันดาเมจได้ 5 หน่วย ศัตรูจะถูกบังคับเล็งไปที่โล่สัมฤทธิ์ก่อนเสมอ โดยผู้ใช้สกิลจะเป็นคนทอยป้องการโจมตีที่เข้ามาและโล่สัมฤทธิ์จะไม่หายไปจนกว่าจะถูกทำลาย',
      available: true,
      effect: EFFECT_TYPES.SHIELD,
      target: TARGET_TYPES.SELF,
      value: 5,
      duration: 999,
    },
  ],

  /* ────────────────────────── Aphrodite ────────────────────── */
  [DEITY.APHRODITE]: [
    {
      deity: DEITY.APHRODITE,
      type: POWER_TYPES.PASSIVE,
      name: DEITY_POWER_NAMES.IN_THE_NAME_OF_LOVE,
      description:
        'เมื่อทอยป้องกันไม่สำเร็จจะสามารถเลือกไม่รับดาเมจได้ โดยพื้นฐานจะมีโควต้าในการเลือกไม่รับดาเมจเริ่มต้น 0 ครั้ง และจะได้รับโควต้าเพิ่ม 1 ครั้ง เมื่อทอยป้องกันสำเร็จ (สะสมโควต้าได้สูงสุด 1 ครั้ง)',
      available: true,
      effect: EFFECT_TYPES.SHIELD,
      target: TARGET_TYPES.SELF,
      value: 0,
      duration: 999,
    },
    {
      deity: DEITY.APHRODITE,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.FASHION_QUEEN,
      description:
        'เปลี่ยนลุคของตนเองและเพื่อน 1 คน เสริมความมั่นใจ +1 เต๋าทุกประเภท เป็นเวลา 3 รอบ',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 1,
      duration: 3,
    },
    {
      deity: DEITY.APHRODITE,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.OVERFIT_OUTFIT,
      description:
        'ใช้พลังทำให้เสื้อผ้าของศัตรู 1 คนคับลง ลดความเร็วถาวร 1 หน่วย และ -2 เต๋าทุกประเภท เป็นเวลา 2 รอบ',
      available: true,
      effect: EFFECT_TYPES.DEBUFF,
      target: TARGET_TYPES.ENEMY,
      value: 2,
      duration: 2,
    },
    {
      deity: DEITY.APHRODITE,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.CHARMSPEAK,
      description:
        'ใช้มนตร์มหาเสน่ห์ใส่ศัตรู 1 เป้าหมายทำให้หลงใหล ใช้ได้ 2 แบบ / * ในเทิร์นที่เราเป็นฝ่ายป้องกัน: เมื่อศัตรูทอยเต๋าโจมตีได้มากกว่าหรือเท่ากับ 10 หน่วยและโจมตีสำเร็จ ดาเมจจะย้อนเข้าตัวศัตรูเอง / * ในเทิร์นที่เราเป็นฝ่ายโจมตี: เมื่อศัตรูทอยเต๋าป้องกันได้มากกว่าหรือเท่ากับ 10 หน่วย การป้องกันจะเป็นโมฆะ และได้รับดาเมจ 100%',
      available: true,
      effect: EFFECT_TYPES.REFLECT,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 0,
    },
  ],

  /* ────────────────────────── Hermes ────────────────────────── */
  [DEITY.HERMES]: [
    {
      deity: DEITY.HERMES,
      type: POWER_TYPES.PASSIVE,
      name: DEITY_POWER_NAMES.ALWAYS_FASTER,
      description:
        'ได้รับ +1 แต้มเต๋าทุกประเภทต่อความเร็ว 3 หน่วยที่มากกว่าศัตรู หากศัตรูมีหลายตัวจะรับจากศัตรูตัวที่ความเร็วต่ำที่สุดเสมอ และเริ่มการต่อสู้พร้อมกับโควต้าทอยเต๋าใหม่ 2 ครั้ง',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 1,
      duration: 999,
    },
    {
      deity: DEITY.HERMES,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.OPPORTUNITY,
      description:
        'มอบโอกาสทอยเต๋าใหม่ 1 ครั้งและเพิ่มความเร็ว 1 หน่วยถาวรให้กับตนเองหรือเพื่อน 1 คน จากนั้นใช้เทิร์นโจมตีปกติทันที',
      available: true,
      effect: EFFECT_TYPES.REROLL_GRANT,
      target: TARGET_TYPES.SELF,
      value: 1,
      duration: 0,
    },
    {
      deity: DEITY.HERMES,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.RUSH_MOMENT,
      description:
        'มอบเทิร์นเสริมให้กับตนเองหรือเพื่อน 1 คนให้ได้รับเทิร์นพิเศษต่อจากเขาทันที โดยเทิร์นเสริมที่ได้รับมานี้จะไม่นับอยู่ในตารางเทิร์นและจะไม่ลดจำนวนรอบของบัพหรือดีบัพต่างๆ จากนั้นใช้เทิร์นโจมตีปกติทันที',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 0,
      duration: 0,
    },
    {
      deity: DEITY.HERMES,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.TIME_TO_BE_THIEF,
      description:
        'ขโมยแต้มสกิลทั้งหมดของศัตรู 1 ตัว โดยทอยเต๋า d4 แสดงผลดังนี้ / * 1 แต้ม : ขโมยไม่สำเร็จ ไม่ได้รับแต้มสกิล และศัตรูไม่เสียแต้ม / * 2-3 แต้ม : ศัตรูถูกขโมยแต้มสกิล 1 แต้ม เพิ่มให้กับผู้ร่าย / * 4 แต้ม : ศัตรูถูกขโมยแต้มสกิลทั้งหมด เพิ่มให้กับผู้ร่าย หากเป้าหมายไม่หลงเหลือแต้มสกิลให้ขโมย จะได้รับแต้มสกิลคืน',
      available: true,
      effect: EFFECT_TYPES.DEBUFF,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 0,
    },
  ],

  /* ────────────────────────── Dionysus ────────────────────── */
  [DEITY.DIONYSUS]: [
    {
      deity: DEITY.DIONYSUS,
      type: POWER_TYPES.PASSIVE,
      name: DEITY_POWER_NAMES.UNCONTROLLABLE,
      description:
        'เมื่อได้รับแต้มบวกหรือลบเต๋าโจมตี จะบวกหรือลบเต๋าป้องกันเช่นกัน เมื่อได้รับแต้มบวกหรือลบเต๋าป้องกัน จะบวกหรือลบเต๋าโจมตีเช่นกัน',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 0,
      duration: 999,
    },
    {
      deity: DEITY.DIONYSUS,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.GRAPE_JUICE_POTION,
      description:
        'มอบโพชั่นน้ำองุ่นให้กับเพื่อน 1 คนหรือกินเอง ฟื้นฟู HP 2 หน่วย จากนั้นทอยโจมตีตามปกติ',
      available: true,
      effect: EFFECT_TYPES.HEAL,
      target: TARGET_TYPES.SELF,
      value: 2,
      duration: 0,
    },
    {
      deity: DEITY.DIONYSUS,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.INTO_THE_MADNESS,
      description:
        'ทำให้ศัตรูคุ้มคลั่ง เป็นเวลา 2 รอบ ส่งผลให้ในเทิร์นโจมตีของศัตรูที่คุ้มคลั่งจะไม่สามารถเลือกเป้าหมายในการแอคชั่นได้ โดยเมื่อใช้แอคชั่นใด ๆ มันจะแสดงผลกับเป้าหมายแบบสุ่ม / * ในการต่อสู่ 1-1 จะเปลี่ยนการแสดงผลเป็น ในเทิร์นโจมตีของศัตรูที่คุ้มคลั่งจะไม่สามารถเลือกแอคชั่นที่จะใช้ได้ จะใช้แอคชั่นแบบสุ่ม',
      available: true,
      effect: EFFECT_TYPES.DEBUFF,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 2,
    },
    {
      deity: DEITY.DIONYSUS,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.PACIFY_TO_PEACE,
      description:
        'ทำให้ตนเองและเพื่อนทุกคนให้สงบลง โดยลบล้างสถานะผิดปกติที่ส่งผลด้านลบและแต้มลบเต๋าทั้งหมดที่มีทิ้งไป',
      available: true,
      effect: EFFECT_TYPES.CLEANSE,
      target: TARGET_TYPES.SELF,
      value: 0,
      duration: 0,
    },
  ],

  /* ────────────────────────── Hades ────────────────────────── */
  [DEITY.HADES]: [
    {
      deity: DEITY.HADES,
      type: POWER_TYPES.PASSIVE,
      name: DEITY_POWER_NAMES.DEATH_KEEPER,
      description:
        'ทายาทแห่งฮาเดสจะเริ่มการต่อสู้มาพร้อมกับสถานะ "ผู้รั้งความตาย" ซึ่งเมื่อมีการตายเกิดขึ้นภายในทีม ในเทิร์นโจมตีของตนเอง ผู้รั้งความตายจะได้รับแอคชันพิเศษเพื่อร่ายการชุบชีวิตโดยไม่เสียเทิร์น ผู้ที่ถูกชุบขึ้นมาจะฟื้นฟู HP ขึ้นมา 50% จาก Max HP ของผู้ถูกชุบชีวิต สถานะนี้สามารถใช้ชุบตัวเองได้หากตัวเองตาย โดยสถานะนี้ไม่สามารถลบล้างได้และจะสามารถชุบชีวิตได้เพียงครั้งเดียวในการต่อสู้หนึ่งครั้งเท่านั้น',
      available: true,
      effect: EFFECT_TYPES.HEAL,
      target: TARGET_TYPES.ALLY,
      skipDice: true,
      value: 0,
      duration: 999,
    },
    {
      deity: DEITY.HADES,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.SHADOW_CAMOUFLAGING,
      description:
        'เสียสละโอกาสในการโจมตีเพื่อเข้าสู่สถานะ "เงาพรางตัว" เป็นเวลา 2 รอบ นั่นคือ ไม่ตกเป็นเป้าหมายของแอคชั่นใดๆ ยกเว้นในการโจมตีหมู่อันหมายถึงทุกคนในทีมตกเป็นเป้าหมายของศัตรู ทั้งนี้ ในเทิร์นที่ร่ายพลัง ทายาทแห่งฮาเดสจะได้รับสิทธิ์ในการทอยเต๋า D4 เพื่อรับโอกาสเติม Skill Point 1 ครั้งด้วยโอกาส 25%',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 0,
      duration: 2,
      modStat: MOD_STAT.SHADOW_CAMOUFLAGED,
      skipDice: true,
      blessings: [EFFECT_TAGS.SHADOW_CAMOUFLAGING],
    },
    {
      deity: DEITY.HADES,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.UNDEAD_ARMY,
      description:
        'เสียสละโอกาสในการโจมตีเพื่อเรียกโครงกระดูก 1 ตัวขึ้นบนมาสนาม  โดยเมื่อทำการโจมตี โครงกระดูกจะทำการโจมตีสมทบ ทำดาเมจ 50% ของดาเมจโจมตีปกติของผู้ร่าย และหากผู้ร่ายโดนโจมตี โครงกระดูกจะเข้ารับดาเมจแทนทั้งหมด จากนั้นจะหายไปทันที ทั้งนี้ ดาเมจสมทบจากโครงกระดูกติดคริติคอลได้ โดยนับการโจมตีหลักของผู้ร่ายว่าติดคริติคอลหรือไม่ อย่างไรก็ตาม  บนสนามสามารถมีโครงกระดูกได้มากสุด 2 ตัวในเวลาเดียวกันเท่านั้น',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 1,
      duration: 999,
      modStat: MOD_STAT.SKELETON_COUNT,
      skipDice: true,
    },
    {
      deity: DEITY.HADES,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.SOUL_DEVOURER,
      description:
        '/ * ทายาทแห่งฮาเดสจะเข้าสถานะ "ผู้กลืนวิญญาณ" เป็นเวลา 3 รอบ โดยใน 3 รอบนั้นการโจมตีปกติของทายาทแห่งฮาเดสจะเปลี่ยนเป็นการดูดกลืน HP ของเป้าหมายแทน โดยจะดูดกลืน 50% ของดาเมจที่สามารถทำได้มาฟื้นฟูเป็น HP ให้กับตนเอง ซึ่งเป้าหมายไม่สามารถใช้พลังใด ๆ ลดความเสียหายได้และไม่สามารถป้องกันได้ / * เมื่อร่าย "Soul Devourer" จะเป็นการร่าย "Undead Army" โดยทันที',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 0,
      duration: 3,
      skipDice: true,
    },
  ],

  /* ────────────────────────── Hypnos ────────────────────────── */
  [DEITY.HYPNOS]: [
    {
      deity: DEITY.HYPNOS,
      type: POWER_TYPES.PASSIVE,
      name: DEITY_POWER_NAMES.COZY_VIBE,
      description:
        'หากมีความเร็วต่ำกว่าผู้ที่โจมตีเข้ามาหา จะได้รับดาเมจลดลง 1 หน่วย',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 1,
      duration: 999,
    },
    {
      deity: DEITY.HYPNOS,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.SLEEPY_HEAD,
      description:
        'ทำให้ศัตรู 1 คนง่วงงุน ทำให้ถูกข้ามเทิร์นในรอบนั้น',
      available: true,
      effect: EFFECT_TYPES.STUN,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 1,
    },
    {
      deity: DEITY.HYPNOS,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.MEMORY_ALTERATION,
      description:
        'ดัดแปลงความทรงจำของศัตรู 1 เป้าหมาย เป็นเวลา 3 รอบ ทำให้หลงลืมและไม่มีสติ โดยแต้มบวกเต๋าทั้งหมดของศัตรูจะไม่แสดงผล และลดหน้าเต๋าสูงสุดที่ศัตรูใช้ทอยลงเป็น d10 แทน',
      available: true,
      effect: EFFECT_TYPES.DEBUFF,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 3,
    },
    {
      deity: DEITY.HYPNOS,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.SWEET_DREAM,
      description:
        'มอบฝันดีให้กับตนเองหรือเพื่อน 1 คน โดยลดความเร็วของตนเองและเพื่อนลงถาวร 2 หน่วยและฟื้นฟู HP ให้กับเป้าหมาย 5 หน่วย',
      available: true,
      effect: EFFECT_TYPES.HEAL,
      target: TARGET_TYPES.SELF,
      value: 5,
      duration: 0,
    },
  ],

  /* ────────────────────────── Nemesis ────────────────────────── */
  [DEITY.NEMESIS]: [
    {
      deity: DEITY.NEMESIS,
      type: POWER_TYPES.PASSIVE,
      name: DEITY_POWER_NAMES.REPAY,
      description:
        'หากป้องกันสำเร็จจะโจมตีสวนกลับทันที ทำดาเมจ 50% ของการโจมตีปกติ (ป้องกันไม่ได้) และเมื่อถูกโจมตี +3 แต้มเต๋าป้องกันครั้งถัดไป',
      available: true,
      effect: EFFECT_TYPES.REFLECT,
      target: TARGET_TYPES.SELF,
      value: 50,
      duration: 999,
    },
    {
      deity: DEITY.NEMESIS,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.SWEETEST_VENGEANCE,
      description:
        'เข้าสู่สถานะ "อาฆาต" 3 รอบ ในสถานะนี้ เมื่อผู้ร่ายถูกโจมตี จะเพ่งเล็งศัตรูที่โจมตีเธอเอาไว้ เมื่อผู้ร่ายโจมตีศัตรูที่เพ่งเล็งไว้จะทำดาเมจเพิ่มขึ้น 100% และมีโอกาสติดคริติคอล 25%',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 0,
      duration: 3,
      modStat: MOD_STAT.DAMAGE,
    },
    {
      deity: DEITY.NEMESIS,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.PURSUE_A_VENDETTA,
      description:
        'มอบความพยาบาทให้กับเพื่อน 1 คนเป็นเวลา 2 รอบ โดยเพื่อนคนดังกล่าวจะสามารถใช้และแสดงผลของสกิล Repay ได้ / * หากร่ายใส่ตนเอง ดาเมจตีสวนจะเพิ่มขึ้นเป็น 100%',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 0,
      duration: 2,
    },
    {
      deity: DEITY.NEMESIS,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.JUSTICE_TO_ALL,
      description:
        'คัดลอกสถานะผิดปกติที่ส่งผลด้านลบและแต้มลบเต๋าทั้งหมดที่ตัวเองมี จากนั้นลบมันทิ้งไปจากตนเอง และมอบสถานนะทั้งหมดที่คัดลอกไว้ให้กับศัตรู 1 เป้าหมายในระยะเวลาคงเหลือที่เท่ากัน',
      available: true,
      effect: EFFECT_TYPES.DEBUFF,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 0,
    },
  ],

  /* ────────────────────────── Hecate ────────────────────────── */
  [DEITY.HECATE]: [
    {
      deity: DEITY.HECATE,
      type: POWER_TYPES.PASSIVE,
      name: DEITY_POWER_NAMES.COST_OF_THE_CAST,
      description:
        'เมื่อศัตรูคนใดร่ายสกิล ทอยเต๋า d4 โดยแสดงผลดังนี้ / * 1-2 แต้ม : ไม่เกิดอะไรขึ้น / * 3-4 แต้ม : ได้รับแต้มสกิล 1 แต้ม',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 1,
      duration: 999,
    },
    {
      deity: DEITY.HECATE,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.BLACK_MAGIC,
      description:
        'ร่ายมนตร์มืดใส่ศัตรู 1 คนเป็นเวลา 2 รอบ ทำให้เมื่อศัตรูร่ายสกิลจะใช้แต้มสกิลเพิ่มขึ้นเป็น 2 เท่า รวมถึงสกิล POWER_TYPES.ULTIMATE ด้วย',
      available: true,
      effect: EFFECT_TYPES.DEBUFF,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 2,
    },
    {
      deity: DEITY.HECATE,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.SPELL_INCANTATION,
      description:
        'ร่าย 1 ในมนตร์ที่เคยเล่าเรียนมา และสามารถใช้แต้มสกิลเพิ่ม 1 แต้มเสริมเพิ่มพลังให้กับแต่ละมนตร์ตามเงื่อนไข / * ร่ายเวทย์ไฟโจมตีศัตรู 1 ตัว ทำดาเมจ 2 หน่วย (ทอยเต๋าโจมตีปกติ) / * เสริมเพิ่มพลัง: เวทย์ไฟจะทำดาเมจเพิ่มเป็น 4 หน่วย / * ร่ายเวทย์ป้องกัน ได้รับโล่ 2 หน่วย เป็นเวลา 2 รอบ / * เสริมเพิ่มพลัง: เวทย์ป้องกันจะเพิ่มโล่ขึ้นเป็น 3 หน่วย / * ร่ายเวทย์ชำระล้าง ลบล้างสถานะผิดปกติที่ส่งผลด้านลบ 1 อย่างหรือแต้มลบเต๋าที่มีทิ้งไป (เลือกได้ว่าจะลบอะไร) เสริมเพิ่มพลังไม่ได้',
      available: true,
      effect: EFFECT_TYPES.DAMAGE,
      target: TARGET_TYPES.ENEMY,
      value: 2,
      duration: 0,
    },
    {
      deity: DEITY.HECATE,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.THE_MIST,
      description:
        'คัดลอกสถานะผิดปกติที่ส่งผลด้านลบและแต้มลบเต๋าทั้งหมดที่ตัวเองมี จากนั้นลบมันทิ้งไปจากตนเอง และมอบสถานนะทั้งหมดที่คัดลอกไว้ให้กับศัตรู 1 เป้าหมายในระยะเวลาคงเหลือที่เท่ากัน',
      available: true,
      effect: EFFECT_TYPES.DEBUFF,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 0,
    },
  ],

  /* ────────────────────────── Persephone ────────────────────── */
  [DEITY.PERSEPHONE]: [
    {
      deity: DEITY.PERSEPHONE,
      type: POWER_TYPES.PASSIVE,
      name: DEITY_POWER_NAMES.THE_APORRETA_OF_NYMPHAION,
      description:
        'เมื่อเริ่มต้นเทิร์นโจมตีของตนเอง ทายาทแห่งเพอร์เซโฟนีจะเข้าสู่สถานะ "นางบุปผา" ซึ่งมีอภิสิทธิ์ในการปฏิเสธสถานะผิดปกติที่ได้รับมาโดยสิ้นเชิง ทั้งนี้ เมื่อทำการปฏิเสธสถานะผิดปกติใด ๆ แล้วนั้น สถานะความเป็นนางบุปผาจะหายไปทันที อย่างไรก็ตาม การฟื้นฟู HP ของนางบุปผาจะสามารถติดคริติคอลได้ และเมื่อทายาทแห่งเพอร์เซโฟนีอยู่ในสถานะนางบุปผา ทายาทแห่งเพอร์เซโฟนีจะได้รับอัตราคริติคอลเพิ่มเติม 25%',
      available: true,
      effect: EFFECT_TYPES.SHIELD,
      target: TARGET_TYPES.SELF,
      value: 0,
      duration: 1,
    },
    {
      deity: DEITY.PERSEPHONE,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.BLOSSOM_SCENTRA,
      description:
        'ทายาทแห่งเพอร์เซโฟนีเลือกชโลมสุคนธ์บุษบาแห่งการเยียวยาให้กับตนเองหรือเพื่อนร่วมทีม 1 คน เพื่อทำการฟื้นฟู HP จำนวนทั้งสิ้น 20% ของ HP สูงสุดของตนให้ผู้รับการฟื้นฟูคนดังกล่าว จากนั้นทำการโจมตีตามปกติ',
      available: true,
      effect: EFFECT_TYPES.HEAL,
      target: TARGET_TYPES.ALLY,
      value: 20,
      duration: 0,
    },
    {
      deity: DEITY.PERSEPHONE,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.EPHEMERAL_SEASON,
      description:
        'ทายาทแห่งเพอร์เซโฟนีเสียสละโอกาสในการโจมตีเพื่อผลัดฤดูกาลในพื้นต่อสู้ให้กลายเป็นฤดูที่ต้องการ 2 รอบ / * คิมหันตฤดู : +2 แต้มเต๋าโจมตีให้กับทุกคนในทีมและตัวเอง / * วสันตฤดู : เพิ่ม HP สูงสุดให้กับทุกคนในทีม +2 / * เหมันตฤดู : +2 แต้มเต๋าป้องกันให้กับทุกคนในทีมและตัวเอง / * สารทฤดู : ฮีลทุกคนในทีมและตนเอง 1 หน่วยเมื่อจบเทิร์นของแต่ละคน',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 2,
      duration: 2,
      requiresSeasonSelection: true,
      skipDice: true,
    },
    {
      deity: DEITY.PERSEPHONE,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.POMEGRANATES_OATH,
      description:
        'ทายาทแห่งเพอร์เซโฟนีเลือกมอบเมล็ดทับทิมให้กับเพื่อนร่วมทีม 1 คน ทำให้เป้าหมายกลายเป็น "ร่างวิญญาณ" ซึ่งมีโอกาส 50% ที่จะปฏิเสธดาเมจเป็นระยะเวลา 3 รอบ และเมื่อร่างวิญญาณผู้นั้นเป้าหมายโจมตีสำเร็จ ทายาทแห่งเพอร์เซโฟนีจะสามารถทำการโจมตีร่วมด้วยได้ อย่างไรก็ตาม หากไม่มีเพื่อนรวมทีมเหลือในสนามทายาทแห่งเพอร์เซโฟนีถึงจะสามารถมอบเมล็ดทับทิมให้ตัวเองเพื่อกลายเป็นร่างวิญญาณได้เช่นกัน แต่จะไม่สามารถโจมตีร่วมได้',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.ALLY,
      value: 50,
      duration: 3,
      skipDice: true,
    },
  ],

  /* ────────────────────────── Morpheus ────────────────────── */
  // [DEITY.MORPHEUS]: [
  //   {
  //     deity: DEITY.MORPHEUS,
  //     type: POWER_TYPES.PASSIVE,
  //     name: DEITY_POWER_NAMES.DREAM_WEAVER,
  //     description:
  //       'ทายาทแห่งมอร์ฟีอัสมีโอกาส 25% ที่จะทำให้ศัตรูที่โจมตีเข้าสู่สถานะ "หลับใฝ่ฝัน" เมื่อโจมตีสำเร็จ ศัตรูที่หลับใฝ่ฝันจะข้ามเทิร์นการโจมตีครั้งถัดไปและฟื้นฟู HP 1 หน่วย',
  //     available: true,
  //     effect: EFFECT_TYPES.DEBUFF,
  //     target: TARGET_TYPES.ENEMY,
  //     value: 0,
  //     duration: 1,
  //   },
  //   {
  //     deity: DEITY.MORPHEUS,
  //     type: POWER_TYPES.FIRST_SKILL,
  //     name: DEITY_POWER_NAMES.NIGHTMARE_VEIL,
  //     description:
  //       'ทายาทแห่งมอร์ฟีอัสห่อหุ้มศัตรู 1 ตัวด้วยฝันร้าย ทำให้เป้าหมายเข้าสู่สถานะ "ฝันร้าย" เป็นเวลา 2 รอบ ศัตรูที่อยู่ในสถานะฝันร้ายจะมีความเร็วลดลง 3 หน่วยและมีโอกาสติดคริติคอลลดลง 25% จากนั้นทำการโจมตีตามปกติ',
  //     available: true,
  //     effect: EFFECT_TYPES.DEBUFF,
  //     target: TARGET_TYPES.ENEMY,
  //     value: 3,
  //     duration: 2,
  //     modStat: MOD_STAT.SPEED,
  //     effects: [
  //       { effect: EFFECT_TYPES.DEBUFF, target: TARGET_TYPES.ENEMY, value: 3, duration: 2, modStat: MOD_STAT.SPEED },
  //       { effect: EFFECT_TYPES.DEBUFF, target: TARGET_TYPES.ENEMY, value: 25, duration: 2, modStat: MOD_STAT.CRITICAL_RATE },
  //     ],
  //   },
  //   {
  //     deity: DEITY.MORPHEUS,
  //     type: POWER_TYPES.SECOND_SKILL,
  //     name: DEITY_POWER_NAMES.LUCID_DREAM,
  //     description:
  //       'ทายาทแห่งมอร์ฟีอัสเสียสละโอกาสในการโจมตีเพื่อเข้าสู่สถานะ "ฝันรู้ตัว" เป็นเวลา 3 รอบ ในขณะที่อยู่ในสถานะฝันรู้ตัว ทายาทแห่งมอร์ฟีอัสจะมีความเร็วเพิ่มขึ้น 4 หน่วยและมีโอกาสหลบหลีกการโจมตี 30%',
  //     available: true,
  //     effect: EFFECT_TYPES.BUFF,
  //     target: TARGET_TYPES.SELF,
  //     value: 4,
  //     duration: 3,
  //     modStat: MOD_STAT.SPEED,
  //     skipDice: true,
  //   },
  //   {
  //     deity: DEITY.MORPHEUS,
  //     type: POWER_TYPES.ULTIMATE,
  //     name: DEITY_POWER_NAMES.ETERNAL_SLUMBER,
  //     description:
  //       'ทายาทแห่งมอร์ฟีอัสเสียสละโอกาสในการโจมตีเพื่อปล่อยพลังการนอนหลับนิรันดร์ ทำให้ศัตรูทุกตัวเข้าสู่สถานะ "หลับลึก" เป็นเวลา 1 รอบ ศัตรูที่หลับลึกจะข้ามเทิร์นถัดไปทั้งหมดและฟื้นฟู HP 2 หน่วย อย่างไรก็ตาม หากศัตรูที่หลับลึกถูกโจมตี พวกเขาจะตื่นขึ้นทันทีและได้รับดาเมจเพิ่มเติม 50%',
  //     available: true,
  //     effect: EFFECT_TYPES.DEBUFF,
  //     target: TARGET_TYPES.AREA,
  //     value: 0,
  //     duration: 1,
  //     skipDice: true,
  //   },
  // ],
};

/** Powers that do not stack — re-cast resets duration. Don't show "stack" in pip tooltip. */
export const NO_STACK_POWER_NAMES: Set<string> = new Set([
  // Zeus
  POWER_NAMES.BEYOND_THE_NIMBUS,
  // Hades
  POWER_NAMES.SHADOW_CAMOUFLAGING,
  POWER_NAMES.SOUL_DEVOURER,
  // Persephone
  POWER_NAMES.THE_APORRETA_OF_NYMPHAION,
]);

/** Synchronous power lookup by deity name (case-insensitive). */
export function getPowers(deity: string): PowerDefinition[] {
  // Try exact match first, then case-insensitive
  if (DEITY_POWERS[deity]) return DEITY_POWERS[deity];
  const key = Object.keys(DEITY_POWERS).find(
    (k) => k.toLowerCase() === deity.toLowerCase(),
  );
  return key ? DEITY_POWERS[key] : [];
}
