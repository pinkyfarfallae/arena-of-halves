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
        'ทายาทแห่งซุสเริ่มการต่อสู้มาพร้อมกับสถานะ "จ้าวนภา"\
        \n\* เมื่อทายาทแห่งซุสโจมตีศัตรูสำเร็จ จะใช้ประจุสายฟ้ามอบสถานะ "ช็อต" ให้กับศัตรูเป้าหมายนั้น\
        \n\* ทุกครั้งที่ทายาทแห่งซุสโจมตี หากศัตรูเป้าหมายมี Speed ต่ำกว่าทายาทแห่งซุส จะสร้างดาเมจเพิ่มขึ้น 15% ของ Speed ของทายาทแห่งซุส\
        \n\* เมื่อศัตรูที่มีช็อตอยู่แล้วได้รับช็อตซ้ำอีกครั้ง ช็อตจะเปลี่ยนเป็นสถานะ "โอเวอร์ช็อค" จากนั้นจะลบล้างช็อตทั้งหมดบนเป้าหมายทิ้งไป\
        \n\* เมื่อศัตรูได้รับสถานะโอเวอร์ช็อค จะขโมย Speed 1 หน่วยจากศัตรูเป้าหมายและเพิ่มให้ทายาทแห่งซุสแบบถาวร จากนั้นลบล้างช็อตทั้งหมดบนตัวเป้าหมายทิ้งไป\
        \n\* เมื่อศัตรูได้รับสถานะโอเวอร์ช็อค ทายาทแห่งซุสจะแทรกเทิร์นเพื่อโจมตีปกติใส่ศัตรูตัวนั้นทันที\
        \n\* สถานะช็อตนับเป็นสถานะผิดปกติ และสถานะโอเวอร์ช็อคนับเป็นสถานะผิดปกติ',
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
        'ทายาทแห่งซุสเข้าสู่สถานะ "เหนือเมฆครึ้ม" เป็นเวลา 2 เทิร์น จากนั้นโจมตีปกติทันที\
        \n\* ขณะที่อยู่ในสถานะเหนือเมฆครึ้ม ทายาทแห่งซุสจะได้รับ Speed เพิ่มขึ้น 30% ของ Speed ปัจจุบัน\
        \n\* การโจมตีปกติขณะอยู่ในสถานะเหนือเมฆครึ้มสามารถเลือกเป้าหมายได้ 2 เป้าหมาย และหากเป้าหมายที่เลือกมี Speed ต่ำกว่า จะได้รับอัตราคริติคอลเพิ่มขึ้นอีก 25%\
        \n\* สถานะเหนือเมฆครึ้มนับเป็นสถานะเกื้อกูล',
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
        'ทายาทแห่งซุสเรียกสายฟ้าสาดซัดไปยังศัตรู มอบสถานะ "ช็อต" ให้กับศัตรูทุกเป้าหมายทันที จากนั้นจบเทิร์น\
        \n\* หาก Arch of Jolt Ruination ทำให้เกิดสถานะ "โอเวอร์ช็อค" จะได้รับแต้มสกิลคืน 1 แต้ม\
        \n\* สถานะช็อตนับเป็นสถานะผิดปกติ และสถานะโอเวอร์ช็อคนับเป็นสถานะผิดปกติ',
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
        'ทายาทแห่งซุสเรียกอัสนีบาตผ่าศัตรูทุกเป้าหมาย ทำดาเมจ 100% ของ ATK ปัจจุบัน จากนั้นมอบสถานะ "อัมพาต" ให้กับศัตรูทุกเป้าหมายเป็นเวลา 2 เทิร์น จากนั้นจบเทิร์น\
        \n\* อัมพาตจะลด Speed ลง 5 หน่วย และทำให้ได้รับดาเมจจากตัวละครที่มี Speed มากกว่าขึ้นไปอีก 10%\
        \n\* การโจมตีจาก Apotheosis of Keraunos นับเป็นการโจมตีจากสกิล และไม่สามารถป้องกันได้ รวมถึงไม่ต้องทอยเต๋า\
        \n\* การโจมตีจาก Apotheosis of Keraunos สามารถติดคริได้ โดยเมื่อโจมตีจะบังคับให้เกิดการทอยคริติคอลทันที และมีอัตราคริพื้นฐาน 25%\
        \n\* สถานะอัมพาตนับเป็นสถานะผิดปกติ',
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
        'ทายาทแห่งโพไซดอนใช้สกิลหรืออัลติเมตจะทำให้สายน้ำเยียวยาพลังชีวิตของเขา ฟื้นฟู HP ของตนเอง 1 หน่วย\
        \n\* หากทายาทแห่งโพไซดอนมีสถานะห้วงธารา การฟื้นฟู HP เพิ่มเติมอีก 2 หน่วย',
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
        'ทายาทแห่งโพไซดอนกักขังศัตรู 1 เป้าหมายด้วยคุกน้ำเป็นเวลา 2 เทิร์น จากนั้นโจมตีปกติทันที\
        \n\* คุกน้ำ : การโจมตีปกติจะจ่ายแต้มสกิล 1 แต้ม หากไม่มีแต้มสกิลเพียงพอ บังคับให้ข้ามเทิร์นทันที\
        \n\* คุกน้ำนับเป็นสถานะผิดปกติ\
        \n\* หากทายาทแห่งโพไซดอนมีสถานะห้วงธารา กรงสินธุจะทำให้เป้าหมายโจมตีปกติเบาลง 1 หน่วย',
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
        'ทายาทแห่งโพไซดอนควบมวลน้ำเป็นกระสุนน้ำวนและยิงมันใส่ศัตรู 1 เป้าหมาย ทำดาเมจ 100% ของ ATK และมอบสถานะจมดิ่งให้กับเป้าหมาย 2 เทิร์น จากนั้นจบเทิร์น\
        \n\* จมดิ่ง : ไม่สามารถร่ายสกิลได้\
        \n\* จมดิ่งนับเป็นสถานะผิดปกติ\
        \n\* การโจมตีจาก Into the Deep นับเป็นการโจมตีจากสกิล ไม่สามารถป้องกันได้ และไม่ต้องทอยเต๋า\
        \n\* การโจมตีจาก Into the Deep จะสามารถติดคริได้ โดยเมื่อโจมตีจะบังคับให้เกิดการทอยคริติคอลทันที และคิดคริติคอลตามอัตราพื้นฐานที่ทายาทแห่งโพไซดอนมี\
        \n\* หากทายาทแห่งโพไซดอนมีสถานะห้วงธารา เมื่อร่าย Into the Deep จะเพิ่มค่าร่าย 1 แต้มสกิล จะสร้างดาเมจเพิ่มอีก 2 หน่วย และเพิ่มระยะเวลาของห้วงธาราที่อยู่บนสนามขึ้นเป็น 1 เทิร์น',
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
        'ทายาทแห่งโพไซดอนสร้างคลื่นยักษ์โจมตีศัตรูทุกตัวบนสนาม ทำดาเมจ 100% ของ ATK และสร้างพื้นที่ห้วงธาราขึ้นบนสนาม เป็นเวลา 3 เทิร์น จากนั้นจบเทิร์น\
        \n\* ห้วงธารา : โจมตีแรงขึ้น 30% ของ ATK และเพิ่มโบนัสแต้มเต๋าโจมตี +3\
        \n\* ห้วงธารานับเป็นสถานะเกื้อกูล\
        \n\* การโจมตีจาก Infinite Deluge นับเป็นการโจมตีจากสกิล ไม่สามารถป้องกันได้ และไม่ต้องทอยเต๋า\
        \n\* การโจมตีจาก Infinite Deluge จะสามารถติดคริได้ โดยเมื่อโจมตีจะบังคับให้เกิดการทอยคริติคอลทันที และคิดคริติคอลตามอัตราพื้นฐานที่ทายาทแห่งโพไซดอนมี',
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
        'ทายาทแห่งแอรีสเริ่มการต่อสู้มาพร้อมกับสถานะ "อสูรสงคราม"\
        \n\* เมื่อโจมตีศัตรูที่มี HP มากกว่าจะเพิ่ม ATK ของตนเองขึ้น 30%\
        \n\* หรือเมื่อโจมตีศัตรูที่มี HP ต่ำกว่าหรือเท่ากับตน จะเพิ่มโบนัสแต้มเต๋าโจมตี +3\
        \n\* อสูรสงครามนับเป็นสถานะเกื้อกูลที่ไม่สามารถลบล้างได้',
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
        'ทายาทแห่งแอรีสเลือกมอบสถานะ "พิโรธ" ให้กับตนเองและพันธมิตร 1 คน เป็นเวลา 2 เทิร์น จากนั้นโจมตีปกติทันที\
        \n\* พิโรธ : ได้รับโบนัสแต้มเต๋าโจมตี +2 และเพิ่ม ATK ของเป้าหมาย 30%\
        \n\* พิโรธนับเป็นสถานะเกื้อกูล',
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
        'ทายาทแห่งแอรีสสาปอาวุธของศัตรู 1 เป้าหมาย เป็นเวลา 1 เทิร์น จากนั้นโจมตีปกติทันที\
        \n\* สาปอาวุธ : การทำดาเมจด้วยการโจมตีปกติ/สกิล/อัลติเมทและสถานะจากเป้าหมาย จะเป็นโมฆะ\
        \n\* สาปอาวุธนับเป็นสถานะผิดปกติ',
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
        'ทายาทแห่งแอรีสโจมตีศัตรู 1 เป้าหมายด้วยท่วงท่าจู่โจมอันบ้าคลั่ง ทำดาเมจ 200% ของ ATK จากนั้นจบเทิร์น\
        \n\* การโจมตีจาก Berserker\'s Cataclysm นับเป็นการโจมตีจากสกิล\
        \n\* การโจมตีจาก Berserker\'s Cataclysm ต้องทอยเต๋าโจมตีตามปกติ\
        \n\* การโจมตีจาก Berserker\'s Cataclysm จะสามารถติดคริได้ โดยเมื่อโจมตีจะบังคับให้เกิดการทอยคริติคอลทันที และคิดคริติคอลตามอัตราพื้นฐานที่ทายาทแห่งแอรีสมี\
        \n\* หากทอยโจมตีด้วย Berserker\'s Cataclysm ไม่สำเร็จจะได้รับแต้มสกิลคืน 1 แต้ม',
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
        'ทายาทแห่งอาธีนาเริ่มการต่อสู้มาพร้อมกับสถานะ "ฉลาดเฉลียว"\
        \n\* ฉลาดเฉลียว : เมื่อโจมตีหรือป้องกันสำเร็จ ได้รับโบนัสแต้มเต๋าทุกประเภท +1 สะสมได้สูงสุด +3 และเมื่อโจมตีหรือป้องกันไม่สำเร็จ โบนัสแต้มเต๋าที่ได้รับมาจะหายไปทั้งหมด\
        \n\* ฉลาดเฉลียวนับเป็นสถานะเกื้อกูลที่ไม่สามารถลบล้างได้',
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
        'ทายาทแห่งอาธีนาใช้กลยุทธ์ทำลายแผนการของศัตรู เข้าแทรกเทิร์นและลบล้างผลลัพธ์แต้มเต๋าครั้งล่าสุดของศัตรูให้เป็นโมฆะ และบังคับศัตรูให้ต้องทอยผลลูกเต๋าอีกครั้งทันที\
        \n\* หากศัตรูทำการทอยใหม่และได้แต้มมากกว่าหรือเท่ากับแต้มเดิม จะได้รับแต้มสกิลคืน 1 แต้ม\
        \n\* สามารถใช้ Insightful Tactic ได้เพียง 1 รอบต่อการโจมตีหรือป้องกันของศัตรู 1 ครั้ง\
        \n\* สามารถใช้ Insightful Tactic ได้เมื่อศัตรูทอยเต๋าไปแล้วเท่านั้น\
        \n\* สามารถใช้ Insightful Tactic แทรกเทิร์นได้ทั้งในเทิร์นโจมตี และป้องกันของตนเอง',
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
        'ทายาทแห่งอาธีนาสร้างความเสียเปรียบให้กับศัตรู ลบล้างสถานะเกื้อกูลทุกอย่างของศัตรู 1 เป้าหมายทันที พร้อมมอบสถานะปลดอาวุธให้เป้าหมายเดียวกันนั้น เป็นเวลา 2 เทิร์น จากนั้นโจมตีปกติทันที\
        \n\* ปลดอาวุธ : Passive ของตัวละครจะถูกปิดการใช้งาน\
        \n\* ปลดอาวุธนับเป็นสถานะผิดปกติ\
        \n\* สามารถใช้ Disarm แทรกเทิร์นได้ทั้งในเทิร์นโจมตี และป้องกันของตนเอง\
        \n\* หากใช้ Disarm ในเทิร์นป้องกัน จะไม่ได้รับสิทธิ์ในการโจมตีปกติ',
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
        'ทายาทแห่งอาธีนาวางแผนเพื่อเสริมกองกำลังของฝ่ายตนเอง มอบสถานะตื่นตัวให้กับตนเองและพันธมิตรทุกคน เป็นเวลา 3 เทิร์น จากนั้นโจมตีปกติทันที\
        \n\* ตื่นตัว : ได้รับโบนัสแต้มเต๋าป้องกัน +3 และเพิ่ม ATK ขึ้น 1 หน่วย และสำหรับทายาทแห่งอาธีนา เมื่อป้องกันการโจมตีจากศัตรูสำเร็จ โจมตีสวนกลับทันที ทำดาเมจ 100% ของ ATK\
        \n\* ตื่นตัวนับเป็นสถานะเกื้อกูล\
        \n\* การโจมตีสวนสามารถติดคริติคอลได้ โดยเมื่อโจมตีจะบังคับให้เกิดการทอยคริติคอลทันที และคิดคริติคอลตามอัตราพื้นฐานที่ทายาทแห่งอาธีนามี\
        \n\* สามารถใช้ Reliable Plan แทรกเทิร์นได้ทั้งในเทิร์นโจมตี และป้องกันของตนเอง\
        \n\* หากใช้ Reliable Plan ในเทิร์นป้องกัน จะไม่ได้รับสิทธิ์ในการโจมตีปกติ',
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
        'ทายาทแห่งอะพอลโลเริ่มการต่อสู้มาพร้อมกับสถานะเจิดจ้า\
        \n\* เจิดจ้า : ผลของการฟื้นฟู HP ที่ได้รับจะเพิ่มขึ้น 1 หน่วยเสมอ และเมื่อตนเองเป็นผู้สร้างหรือได้รับการฟื้นฟู HP จะได้รับโบนัสแต้มเต๋าทุกประเภท +1 สะสมได้สูงสุด +3\
        \n\* เจิดจ้านับเป็นสถานะเกื้อกูลที่ไม่สามารถลบล้างได้',
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
        'ทายาทแห่งอะพอลโลขับขานบทเพลงรักษาให้กับตนเองและพันธมิตร 1 คน โดยทำการฟื้นฟู HP 30% ของ ATK และมอบสถานะบทเพลงเยียวยาให้กับตนเองและพันธมิตรเป้าหมายเป็นเวลา 2 เทิร์น จากนั้นจบเทิร์น\
        \n\* บทเพลงเยียวยา : อัตราคริเพิ่มขึ้น 25%\
        \n\* บทเพลงเยียวยานับเป็นสถานะเกื้อกูล',
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
        'ทายาทแห่งอะพอลโลเลือกกล่าวกลอนคำสาป 1 บท ใส่ศัตรู 1 เป้าหมาย เป็นเวลา 2 เทิร์น จากนั้นจบเทิร์น\
        \n\* สูญสิ้นเยียวยา : ผลการฟื้นฟู HP ที่ได้รับมาจะเป็นโมฆะ\
        \n\* ดวงเนตรเลือนพร่า : ในเทิร์นโจมตี เมื่อเลือกแอคชั่นใด ๆ ก็ตามจะไม่สามารถเลือกเป้าหมายได้ โดยจะสุ่มเต๋า d(n) ตามจำนวนตัวละครทั้งสนาม หากผลของเต๋าออกเรียงตามลำดับเทิร์น\
        \n\* ทุกขาอนันต์ : ระยะเวลาของสถานะผิดปกติที่มีทั้งหมดจะเพิ่มขึ้นทันที 2 เทิร์น\
        \n\* กลอนคำสาปทุกบทนับเป็นสถานะผิดปกติ สามารถเลือกร่ายได้',
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
        'ทายาทแห่งอะพอลโลขึงศรบนคันธนู และเข้าสู่สถานะกระหน่ำยิง เป็นเวลา 3 เทิร์น จากนั้นโจมตีปกติทันที\
        \n\* กระหน่ำยิง : ได้รับโบนัสแต้มเต๋าโจมตี +3 และเมื่อโจมตีปกติสำเร็จ จะมีโอกาส 75% ในการโจมตีเสริม 1 ครั้ง โดยโอกาสในการโจมตีเสริมจะลดลงเรื่อยๆ ครั้งละ 25% และลดลงได้น้อยสุดที่ 25% สามารถเกิดการโจมตีเสริมได้เรื่อยๆ จนกว่าจะสุ่มไม่ติด\
        \n\* การโจมตีเสริมจะทำดาเมจ 50% ของการโจมตีปกติ\
        \n\* การโจมตีเสริมสามารถติดคริติคอลได้ โดยหากการโจมตีปกติครั้งแรกติดคริติคอล การโจมตีเสริมทุกครั้งจะติดคริติคอลแน่นอน 100%\
        \n\* กระหน่ำยิงนับเป็นสถานะเกื้อกูล',
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
      name: DEITY_POWER_NAMES.THE_BLACKSMITH,
      description:
        'เมื่อทายาทแห่งเฮเฟตัสสร้างอุปกรณ์ชิ้นใด ๆ จะได้รับแต้มเต๋าป้องกันถาวรให้กับตนเอง 1 หน่วยเสมอ และสามารถสะสมได้สูงสุด 3 หน่วย',
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
      name: DEITY_POWER_NAMES.UPGRADED_ARMORY,
      description:
        'ทายาทแห่งเฮเฟตัสเสียสละโอกาสในการโจมตีปกติเพื่อตีบวก "ชุดเกราะ" ให้กับตนเองหรือเพื่อนร่วมทีม 1 คน\
        ซึ่งจะคงอยู่ตลอดการต่อสู้จนกว่าจะถูกลบล้างทำลาย ซึ่ง "ชุดเกราะ" นับเป็นสถานะเกื้อกูลที่จะเสริมแต้มเต๋าป้องกัน 2 หน่วยให้กับผู้ครอบครองตลอดเวลาที่ครอบครอง\
        อย่างไรก็ตาม หากผู้ครอบครองทอยเต๋าป้องกันไม่สำเร็จชุดเกราะจะถูกทำลายลงทันที',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 3,
      duration: 3,
    },
    {
      deity: DEITY.HEPHAESTUS,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.STEEL_GAUNTLET,
      description:
        'ทายาทแห่งเฮเฟตัสสร้างถุงมือเหล็กให้ตนเองสวมใส่เป็นระยะเวลา 2 รอบ\
        ซึ่งถุงมือเหล็กนับเป็นสถานะเกื้อกูลที่จะเปลี่ยนโบนัสแต้มบวกเต๋าป้องกันที่มีทั้งหมดที่ผู้สวมใส่มีให้กลายเป็นโบนัสแต้มบวกเต๋าโจมตีในจำนวนเท่ากัน\
        และการทำให้โจมตีปกติทำดาเมจแรงขึ้น 100% โดยยังสามารถโจมตีปกติต่อไปได้',
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
        'ทายาทแห่งเฮเฟตัสสร้าง "โล่สัมฤทธิ์" ขึ้นปกป้องทั้งทีมจากนั้นจบเทิร์น\
        \n\* โล่สัมฤทธิ์นับเป็นยูนิตพิเศษที่มีผลกับทุกคนในทีม\
        \n\* โล่สัมฤทธิ์มี HP 5 หน่วย โดยเมื่อมีโล่สัมฤทธิ์บนสนาม ทุกการกระทำของฝ่ายศัตรูจะถูกบังคับเล็งไปที่โล่สัมฤทธิ์ก่อนเสมอ\
        \n\* เมื่อถูกเพ่งเล็งจากการโจมตี ทายาทแห่งเฮเฟตัสจะเป็นผู้ทอยป้องการโจมตีที่เข้ามา และโล่สัมฤทธิ์จะไม่หายไปจนกว่าจะถูกทำลาย',
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
        'เมื่อทายาทแห่งอะโฟรไดท์ทอยป้องกันไม่สำเร็จ จะสามารถเลือกไม่รับดาเมจนั้นได้ โดยพื้นฐานจะมีโควตาในการเลือกไม่รับดาเมจเริ่มต้นที่ 0 ครั้ง และจะได้รับโควตาเพิ่ม 1 ครั้ง เมื่อทอยป้องกันสำเร็จ ทั้งนี้ โควตาการปฏิเสธดาเมจสะสมได้สูงสุด 1 ครั้งเท่านั้น',
      available: true,
      effect: EFFECT_TYPES.SHIELD,
      target: TARGET_TYPES.SELF,
      value: 0,
      duration: 999,
    },
    {
      deity: DEITY.APHRODITE,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.FASHIONISTA_QUEEN,
      description:
        'ทายาทแห่งอะโฟรไดท์แต่งเติมความงามของตนเองและพันธมิตร 1 คน เพื่อเสริมความมั่นใจ โดยทั้งตนเองและพันธมิตรจะได้รับโบนัสเต๋าทุกประเภท 1 แต้มเป็นระยะเวลา 3 รอบและใช้ซ้อนได้สูงสุด 3 ครั้งจากนั้นโจมตีปกติทันที\
        \n\* โบนัสบวกแต้มเต๋าจากพลังดังกล่าวนี้นับเป็นสถานะเกื้อกูล\
        \n\* เมื่อร่ายพลังดังกล่าวนี้ซ้ำใส่เป้าหมายเดิม จะเป็นการรีเซทระยะเวลาคงเหลือของผลโบนัสบวกแต้มเต๋าด้วย',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 1,
      duration: 3,
    },
    {
      deity: DEITY.APHRODITE,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.PASSIONATE_ALLURING,
      description:
        'ทายาทแห่งอะโฟรไดท์ล่อลวงศัตรู 1 เป้าหมาย "ลุ่มหลง" ตนเป็นเวลา 2 รอบจากนั้นจบเทิร์น\
        \n\* ผู้ลุ่มหลงจะไม่สามารถข้ามเทิร์นจนเองได้ ยกเว้นว่าโดนข้ามเทิร์นจากสถานะอื่น\
        \n\* ดาเมจที่ผู้ลุ่มหลงสร้างจะถูกเปลี่ยนเป็นการฟื้นฟู HP ในจำนวน 50% ของดาเมจนั้นแทน\
        \n\* การลุ่มหลงนับเป็นสถานะผิดปกติ',
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
        'ทายาทแห่งอะโฟรไดท์ร่ายมนตร์มหาเสน่ห์ใส่ศัตรู 1 เป้าหมาย\
        โดยหากมีสถานะเกื้อกูลจากพลัง "Fashionista Queen" อย่างน้อย 1 แต้มทายาทแห่งอะโฟรไดท์จะได้รับแต้มสกิลคืน 1 หน่วยอีกด้วย ทั้งนี้สามารถเลือกใช้มนตร์มหาเสน่ห์ได้ 2 แบบ\
        \n\*ในเทิร์นที่เป็นฝ่ายป้องกัน : เมื่อศัตรูทอยเต๋าโจมตีได้มากกว่าหรือเท่ากับ 10 หน่วยและโจมตีสำเร็จ ดาเมจทั้งหมดจะย้อนเข้าตัวศัตรูเอง\
        \n\*ในเทิร์นที่เป็นฝ่ายโจมตี : เมื่อศัตรูทอยเต๋าป้องกันได้มากกว่าหรือเท่ากับ 10 หน่วย การป้องกันจะเป็นโมฆะและผู้ป้องกันผู้นั้นจะได้รับดาเมจ 100%',
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
        'ได้รับ +1 แต้มเต๋าทุกประเภทต่อความเร็ว 3 หน่วยที่มากกว่าศัตรู หากศัตรูมีหลายตัวจะรับจากศัตรูตัวที่ความเร็วต่ำที่สุดเสมอ และเริ่มการต่อสู้พร้อมกับโควตาทอยเต๋าใหม่ 2 ครั้ง',
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
        'ทายาทแห่งฮาเดสเริ่มการต่อสู้มาพร้อมกับสถานะผู้รั้งความตาย\
        \n\* ผู้รั้งความตาย : ทุกครั้งที่ตนเองหรือพันธมิตรตายลงบนสนาม จะได้รับเทิร์นพิเศษทันที โดยในเทิร์นพิเศษนี้จะได้รับแอคชั่นเพิ่มเติมคือสามารถเลือกชุบชีวิตตนเองหรือพันธมิตรเป้าหมายนั้นได้\
        \n\* ผู้รั้งความตายนับเป็นสถานะเกื้อกูลที่ไม่สามารถลบล้างได้\
        \n\* ในเทิร์นพิเศษนี้ สามารถเลือกใช้แอคชั่นทุกอย่างได้ตามปกติ ไม่จำเป็นต้องเลือกชุบชีวิตเสมอไป\
        \n\* ชุบชีวิต : ทำให้ตัวละครที่ตายไปแล้วกลับเข้าสู่การต่อสู้บนสนามได้อีกครั้ง พร้อมทั้งฟื้นฟู HP ให้กับเป้าหมาย 50% ของ HP Max ของเป้าหมายนั้น และลบล้างสถานะผู้รั้งความตายทิ้งไปทันที',
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
        'ทายาทแห่งฮาเดสคลุมตนเองด้วยเงานิฬกาล เข้าสู่สถานะเงาพรางตัว เป็นเวลา 2 รอบ จากนั้นจบเทิร์น\
        \n\* เงาพรางตัว : ไม่สามารถตกเป็นเป้าหมายของแอคชั่นใดๆ (ยกเว้นการโจมตีหมู่)\
        \n\* เงาพรางตัวนับเป็นสถานะเกื้อกูล',
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
        'ทายาทแห่งฮาเดสเรียกโครงกระดูก 1 ตัวขึ้นบนสนาม จากนั้นจบเทิร์น\
        \n\* โครงกระดูก : เมื่อทายาทแห่งฮาเดสโจมตี มันจะโจมตีเสริม ทำดาเมจ 30% ของ ATK ของทายาทแห่งฮาเดส และหากทายาทแห่งฮาเดสทอยเต๋าป้องกันไม่สำเร็จและโดนโจมตี โครงกระดูกจะรับดาเมจนั้นแทนทั้งหมด จากนั้นโครงกระดูกจะหายไปทันที\
        \n\* โครงกระดูกนับเป็นยูนิตอัญเชิญ\
        \n\* โครงกระดูกคงอยู่ตลอดไปจนกว่าจะรับดาเมจแทนทายาทแห่งฮาเดสและหายไป\
        \n\* บนสนามสามารถมีโครงกระดูกได้สูงสุด 2 ตนในเวลาเดียวกัน',
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
        'ทายาทแห่งฮาเดสเข้าสู่สถานะดูดกลืนวิญญาณ เป็นเวลา 3 รอบ จากนั้นโจมตีปกติทันที\
        \n\* ดูดกลืนวิญญาณ : เมื่อทำการโจมตีปกติ ศัตรูเป้าหมายจะไม่สามารถป้องกันได้ โดยทำดาเมจ 100% ของ ATK โดยไม่ต้องทอยเต๋า และฟื้นฟู HP ของตนเอง 30% ของดาเมจที่ทำได้ และทำให้การโจมตีของโครงกระดูกติดคริติคอลได้ โดยเมื่อโครงกระดูกโจมตีเสริมจะบังคับให้เกิดการทอยคริติคอลทันที และคิดคริติคอลตามอัตราพื้นฐานที่ทายาทแห่งแอรีสมี\
        \n\* ดูดกลืนวิญญาณนับเป็นสถานะเกื้อกูล\
        \n\* เมื่อร่าย Soul Devourer จะร่าย Undead Army ต่อทันทีโดยไม่เสียแต้มสกิล',
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
      name: DEITY_POWER_NAMES.LULLABYS_RESPIRITE,
      description:
        'ทายาทแห่งฮิปนอสเริ่มการต่อสู้มาพร้อมกับสถานะนิทรารมณ์\
        \n\* นิทรารมณ์ : เมื่อถูกสังหารลงเป็นครั้งแรกจะไม่ตาย โดยแช่แข็ง HP ให้ไม่ลดต่ำลงไปกว่า 1 หน่วย และจะไม่ตกเป็นเป้าหมายของแอคชั่นใด ๆ จากศัตรู โดยเมื่อถึงเทิร์นโจมตีของทายาทแห่งฮิปนอสจะถูกข้ามเทิร์น จากนั้นจะฟื้นฟูพลังชีวิต 50% ของ Max HP ของตนหลังจบเทิร์น\
        \n\* นิทรารมณ์นับเป็นสถานะเกื้อกูลที่ไม่สามารถลบล้างได้\
        \n\* สถานะนิทรารมณ์แสดงผลเพียงครั้งเดียว และจะหายไปทันทีเมื่อถูกสังหารลงเป็นครั้งแรก',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 1,
      duration: 999,
    },
    {
      deity: DEITY.HYPNOS,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.DORMANT_LETHARGY,
      description:
        'ทายาทแห่งฮิปนอสทำให้ศัตรู 1 เป้าหมายง่วงงุนเป็นเวลา 1 เทิร์น จากนั้นโจมตีปกติทันที\
        \n\* ง่วงงุน : เมื่อเริ่มต้นเทิร์น ถูกบังคับข้ามเทิร์นและสูญเสียเทิร์นนั้นไป\
        \n\* ง่วงงุนนับเป็นสถานะผิดปกติ',
      available: true,
      effect: EFFECT_TYPES.STUN,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 1,
    },
    {
      deity: DEITY.HYPNOS,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.FALSE_MEMORY,
      description:
        'ทายาทแห่งฮิปนอสทำให้ศัตรู 1 เป้าหมายเข้าสู่สถานะความทรงจำบิดเบี้ยว 2 เทิร์น จากนั้นจบเทิร์น\
        \n\* ความทรงจำบิดเบี้ยว : ลดหน้าเต๋าที่ใช้ทอยเป็น d10 และโบนัสแต้มเต๋าทั้งหมดจะไม่แสดงผล\
        \n\* ความทรงจำบิดเบี้ยวนับเป็นสถานะผิดปกติ',
      available: true,
      effect: EFFECT_TYPES.DEBUFF,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 3,
    },
    {
      deity: DEITY.HYPNOS,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.DREAMFUL_AMBIVALENCE,
      description:
        'ทายาทแห่งฮิปนอสจะลดความเร็วของตนเองลง 2 หน่วย จากนั้นเลือกมอบสถานะ 1 อย่างระหว่างสุขในฝันหรือร้ายมิลืมตื่นเป็นเวลา 1 เทิร์น ให้กับพันธมิตรหรือศัตรู 1 เป้าหมาย จากนั้นจบเทิร์น\
        \n\* สุขในฝัน : เมื่อเริ่มต้นเทิร์นโดนข้ามเทิร์นทันที และฟื้นฟู HP 5 หน่วย และฟื้นฟูแต้มสกิล 3 แต้ม หากพันธมิตรที่สุขในฝันตกเป็นเป้าหมายของการโจมตี ทายาทแห่งฮิปนอสจะเข้ามารับดาเมจแทน ใช้ได้กับเป้าหมายที่เป็นพันธมิตรเท่านั้น\
        \n\* สุขในฝันนับเป็นสถานะเกื้อกูล\
        \n\* ร้ายมิลืมตื่น : เมื่อเริ่มต้นเทิร์นมีโอกาส 50% ถูกบังคับข้ามเทิร์น และได้รับดาเมจเพิ่มขึ้น 30% ใช้ได้กับเป้าหมายที่เป็นศัตรูเท่านั้น\
        \n\* ร้ายมิลืมตื่นนับเป็นสถานะผิดปกติ',
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
      name: DEITY_POWER_NAMES.UNPAID_VENGEANCE,
      description:
        'ทายาทแห่งเนเมซิสเริ่มการต่อสู้มาพร้อมกับสถานะพยาบาท และเมื่อใดก็ตามที่ HP ของตนเองลดลง สะสมแต้มความแค้น 1 แต้ม สะสมได้สูงสุด 6 แต้ม\
        \n\* พยาบาท : หากป้องกันไม่สำเร็จ โจมตีสวนทันที ทำดาเมจ 50% ของ ATK และเพิ่มขึ้นอีก 1 หน่วยต่อแต้มความแค้นปัจจุบันที่มี 2 แต้ม สูงสุด 3 หน่วย\
        \n\* การโจมตีสวนติดคริติคอลไม่ได้\
        \n\* พยาบาทนับเป็นสถานะเกื้อกูลที่ไม่สามารถลบล้างได้',
      available: true,
      effect: EFFECT_TYPES.REFLECT,
      target: TARGET_TYPES.SELF,
      value: 50,
      duration: 999,
    },
    {
      deity: DEITY.NEMESIS,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.REPAY_TENFOLD,
      description:
        'ทายาทแห่งเนเมซิสเข้าสู่สถานะทวงคืน เป็นเวลา 1 เทิร์น จากนั้นโจมตีปกติทันที\
        \n\* ทวงคืน : การโจมตีปกติจะสร้างความเสียหายเพิ่มขึ้น 1 หน่วยแต้มความแค้นปัจจุบันที่มี 1 แต้ม สูงสุด 5 แต้ม โดยเมื่อทอยเต๋าโจมตีและทำดาเมจสำเร็จ ลบล้างแต้มความแค้นตามจำนวนที่ใช้ไปทั้งหมด จากนั้นฟื้นฟู HP ให้กับตนเอง 3 หน่วย\
        \n\* ทวงคืนนับเป็นสถานะเกื้อกูล',
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
        'ทายาทแห่งเนเมซิสทายทวงแค้นศัตรู 1 เป้าหมาย และตนเองได้รับแต้มความแค้นทันที 3 แต้ม จากนั้นจบเทิร์น\
        \n\* จองแค้น : ทุกการกระทำของศัตรูจะถูกบังคับให้เลือกเป้าหมายเป็นทายาทแห่งเนเมซิส และหากการกระทำนั้นเป็นการโจมตีหรือทำดาเมจด้วยวิธีใด ลดดาเมจที่ทำได้ลง 50%\
        \n\* จองแค้นนับเป็นสถานะผิดปกติ',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 0,
      duration: 2,
    },
    {
      deity: DEITY.NEMESIS,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.BOUND_OF_KARMA,
      description:
        'ทายาทแห่งเนเมซิสเข้าสู่สถานะพันธะแห่งกรรม เป็นเวลา 3 เทิร์นและตนเองได้รับแต้มความแค้นทันที 3 แต้ม จากนั้นร่าย Repay ทันทีโดยไม่เสียแต้มสกิล\
        \n\* พันธะแห่งกรรม : ร่าย Repay ได้โดยไม่เสียแต้มสกิล และไม่ลบล้างแต้มความแค้น\
        \n\* พันธะแห่งกรรมนับเป็นสถานะเกื้อกูล',
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
      name: DEITY_POWER_NAMES.THE_ARTIFICERS_TOLL,
      description:
        'จำนวนแต้มสกิลสูงสุดที่สะสมได้ของทายาทแห่งเฮคาทีและพันธมิตรทุกคนเพิ่มขึ้น 1 แต้ม และทุกครั้งพันธมิตรใช้แต้มสกิลในการกระทำใดก็ตาม ทอยเต๋า d4 โดยแสดงผลดังนี้\
        \n\* 1 แต้ม : ไม่เกิดอะไรขึ้น\
        \n\* 2-3 แต้ม : ตนเองได้รับแต้มสกิล 1 แต้ม\
        \n\* 4 แต้ม : ตนเองและเพื่อนทั้งทีมได้รับแต้มสกิล 1 แต้ม',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 1,
      duration: 999,
    },
    {
      deity: DEITY.HECATE,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.UMBRAL_MALICE,
      description:
        'ทายาทแห่งเฮคาทีร่ายมนตร์ดำใส่ศัตรู 1 เป้าหมาย เป็นเวลา 2 เทิร์น จากนั้นจบเทิร์น\
        \n\* มนตร์ดำ : ทำให้แต้มสกิลที่ได้มาเป็นโมฆะ และเมื่อใช้แต้มสกิลในการกระทำใดๆ ทายาทแห่งเฮคาทีจะแทรกเทิร์นและโจมตีปกติใส่เป้าหมายทันที ผลนี้เกิดขึ้นได้ 1 รอบ และลบล้างสถานะมนตร์ดำทันที\
        \n\* มนตร์ดำนับเป็นสถานะผิดปกติ\
        \n\* หากทายาทแห่งเฮคาทีมีสถานะร่ายคาถา Umbral Magic จะเพิ่มเวลาของมนตร์ดำเป็น 3 เทิร์น',
      available: true,
      effect: EFFECT_TYPES.DEBUFF,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 2,
    },
    {
      deity: DEITY.HECATE,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.ARCANE_INVOCATION,
      description:
        'ทายาทแห่งเฮคาทีเข้าสู่สถานะร่ายคาถา เป็นเวลา 2 เทิร์น จากนั้นโจมตีปกติทันที\
        \n\* ร่ายคาถา : การโจมตีปกติจะสามารถเลือกคาถาได้ 1 คาถาจากคาถา 4 คาถา และใช้แต้มสกิล 1 แต้ม โดยหากแต้มสกิลไม่เพียงพอ จะโจมตีปกติแบบทั่วไป โดยมีคาถาที่เลือกได้ดังนี้\
        \n\* เวทอัคคี : โจมตีศัตรูทุกตัว ทำดาเมจ 100% ของ ATK\
        \n\* เวทปกปักษ์ : มอบโล่ 2 หน่วยให้กับตนเองและพันธมิตร 1 คน เป็นเวลา 2 รอบ\
        \n\* โล่นับเป็นสถานะเกื้อกูล\
        \n\* เวทราตรี : โจมตีศัตรู 1 เป้าหมาย ทำดาเมจ 100% ของ ATK โดยหากทอยโจมตีและทำดาเมจสำเร็จ ขโมยแต้มสกิลของเป้าหมายมาให้ตนเอง 1 แต้ม หากไม่มีแต้มสกิลให้ขโมย จะทำดาเมจซ้ำอีก 1 ครั้ง\
        \n\* เวทชำระ : ลบสถานะผิดปกติทั้งหมดให้ตนเองและเพื่อน 1 คน\
        \n\* ร่ายคาถานับเป็นสถานะเกื้อกูล',
      available: true,
      effect: EFFECT_TYPES.DAMAGE,
      target: TARGET_TYPES.ENEMY,
      value: 2,
      duration: 0,
    },
    {
      deity: DEITY.HECATE,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.MIST_EVASION,
      description:
        'ทายาทแห่งเฮคาทีร่ายหมอกมายาคลุมศัตรู 1 เป้าหมาย เป็นเวลา 2 รอบ จากนั้นจบเทิร์น\
        \n\* หมอกมายา : แต้มเต๋าทุกประเภท -3\
        \n\* หมอกมายาสามารถทับซ้อนได้ 4 ครั้ง\
        \n\* หมอกมายาสถานะผิดปกติ\
        \n\* เมื่อร่าย The Mist ซ้ำใส่เป้าหมายเดิม จะรีเซทระยะเวลาคงเหลือของสถานะหมอกมายาด้วย\
        \n\* หากทายาทแห่งเฮคาทีมีสถานะร่ายคาถา The Mist จะใช้แต้มสกิลในการร่ายลดลง 2 แต้ม และเมื่อร่าย The Mist จะเพิ่มเวลาของสถานะร่ายคาถาขึ้น 1 เทิร์น',
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
        'เมื่อเริ่มต้นเทิร์น ทายาทแห่งเพอร์เซโฟนีจะเข้าสู่สถานะนางบุปผา โดยไม่มีระยะเวลากำหนด\
        \n\* นางบุปผา : เมื่อสร้างการฟื้นฟู HP จะสามารถติดคริติคอลได้ และได้รับอัตราคริ 25% อีกทั้งยังปฏิเสธสถานะผิดปกติแรกที่ได้รับมาให้เป็นโมฆะ เมื่อแสดงผลปฏิเสธสถานะแล้วสถานะนางบุปผาจะหายไป\
        \n\* นางบุปผานับเป็นสถานะเกื้อกูลที่ไม่สามารถลบล้างได้',
      available: true,
      effect: EFFECT_TYPES.SHIELD,
      target: TARGET_TYPES.SELF,
      value: 0,
      duration: 1,
    },
    {
      deity: DEITY.PERSEPHONE,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.SERENITY_BLOSSOM_REVERIE,
      description:
        'ทายาทแห่งเพอร์เซโฟเนเลือกชโลม สุคนธ์บุษบาแห่งการเยียวยา ฟื้นฟู HP 20% ของ Max ให้กับตนเองหรือเพื่อนร่วมทีม 1 คน จากนั้นโจมตีปกติทันที',
      available: true,
      effect: EFFECT_TYPES.HEAL,
      target: TARGET_TYPES.ALLY,
      value: 20,
      duration: 0,
    },
    {
      deity: DEITY.PERSEPHONE,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.EPHEMERA_SOLSTICE,
      description:
        'ทายาทแห่งเพอร์เซโฟเนผลัดฤดูกาลในพื้นต่อสู้ให้กลายเป็นฤดูที่ต้องการ เป็นระยะเวลา 2 เทิร์น จากนั้นจบเทิร์น\
        \n\n\* คิมหันตฤดู : มอบโบนัสแต้มเต๋าโจมตี +2 ให้กับตนเองและพันธมิตรทุกเป้าหมาย\
        \n\* วสันตฤดู : เพิ่ม Max HP 2 หน่วยให้กับตนเองและพันธมิตรทุกเป้าหมาย\
        \n\* เหมันตฤดู : มอบโบนัสแต้มเต๋าป้องกัน +2 ให้กับตนเองและพันธมิตรทุกเป้าหมาย\
        \n\* สารทฤดู : เมื่อตนเองหรือพันธมิตรเป้าหมายใดจบเทิร์น ฟื้นฟู HP 1 หน่วยให้กับตัวละครนั้น\
        \n\* ฤดูกาลทุกชนิดนับเป็นสถานะเกื้อกูล คงอยู่แค่ที่ตัวละครทายาทแห่งเพอร์เซโฟเน\
        \nทั้งนี้ การผลัดฤดูนั้นไม่สามารถทับซ้อนกันได้ หากมีการผลัดฤดูใหม่เกิดขึ้น ฤดูเดิมจะถูกแทนที่และเริ่มต้นใหม่ทันที รวมถึงระยะเวลาของฤดูใหม่จะเริ่มนับตั้งแต่รอบที่ผลัดฤดูใหม่เกิดขึ้น ไม่สามารถใช้ระยะเวลาที่เหลือของฤดูเดิมมารวมกับฤดูใหม่ได้',
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
      name: DEITY_POWER_NAMES.POMEGRANATES_IRREVOCABLE_OATH,
      description:
        'ทายาทแห่งเพอร์เซโฟเนเลือกมอบ "เมล็ดทับทิมแห่งปรโลก" ให้กับเพื่อนร่วมทีม 1 คน สร้างพันธสัญญาทำให้เป้าหมายกลายเป็น "ร่างวิญญาณ์" เป็นระยะเวลา 3 เทิร์น จากนั้นจบเทิร์น\
        \n\* ร่างวิญญาณ์ : มีโอกาส 50% ในการปฏิเสธดาเมจที่ได้รับให้เป็นโมฆะ และหากเป้าหมายทำการโจมตีด้วยการกระทำใดๆ ทายาทแห่งเพอร์เซโฟเนจะเข้าแทรกเทิร์นเพื่อโจมตีปกติใส่เป้าหมายเดียวกัน\
        \n\* ร่างวิญญาณ์นับเป็นสถานะเกื้อกูล\
        \n\n\* การแทรกเทิร์นเพื่อโจมตีปกตินับเป็นการโจมตีปกติ\
        \n\* การแทรกเทิร์นเพื่อโจมตีปกติจะสามารถติดคริได้ โดยเมื่อโจมตีจะบังคับให้เกิดการทอยคริติคอลทันที และคิดคริติคอลตามอัตราพื้นฐานที่ทายาทแห่งเพอร์เซโฟเนมี\
        \n\* อย่างไรก็ตาม ทายาทแห่งเพอร์เซโฟนีจะสามารถมอบ "เมล็ดทับทิมแห่งปรโลก" ให้กับตัวเองเพื่อกลายเป็นร่างวิญญาณ์ได้ต่อเมื่อไม่มีพันธมิตรเหลือในพื้นที่ต่อสู้อีกต่อไปแล้วเท่านั้น แต่ทายาทแห่งเพอร์เซโฟนีผู้กลายเป็นร่างวิญญาณ์จะไม่สามารถใช้สิทธิ์โจมตีร่วมได้',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.ALLY,
      value: 50,
      duration: 3,
      skipDice: true,
    },
  ],

  /* ────────────────────────── Morpheus ────────────────────── */
  [DEITY.MORPHEUS]: [
    {
      deity: DEITY.MORPHEUS,
      type: POWER_TYPES.PASSIVE,
      name: DEITY_POWER_NAMES.VISIONS_OF_PHANTASMAGORIA,
      description:
        'เมื่อทายาทแห่งมอร์ฟีอุสใช้แต้มสกิลในการกระทำใดก็ตามครบ 3 แต้ม จะเข้าสู่สถานะเงามายา เป็นเวลา 2 รอบ และเมื่อพันธมิตรใช้แต้มสกิลในระหว่างนี้ จะเพิ่มระยะเวลาของสถานะสถานะเงามายา 1 รอบ สะสมสูงสุด 3 รอบ\
        \n\* เงามายา : เมื่อตนเองหรือพันธมิตรในทีมคนใดได้รับแต้มสกิล ฟื้นฟู HP ให้กับเป้าหมายทันที 1 หน่วย ต่อแต้มสกิล 1 แต้มที่เป้าหมายได้รับ\
        \n\* เงามายานับเป็นสถานะเกื้อกูลที่ไม่สามารถลบล้างได้',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 0,
      duration: 0,
    },
    {
      deity: DEITY.MORPHEUS,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.EPITAPH_OF_SOMNUS,
      description:
        'ทายาทแห่งมอร์ฟีอุสมอบ "ห้วงฝัน" โดยสร้างแต้มสกิล 2 หน่วยให้กับพันธมิตร 1 เป้าหมาย จากนั้นโจมตีปกติทันที',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.ALLY,
      value: 0,
      duration: 0,
    },
    {
      deity: DEITY.MORPHEUS,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.LUCID_DREAMING,
      description:
        'ทายาทแห่งมอร์ฟีอุสมอบนิมิตเสมือนให้กับพันธมิตร 1 เป้าหมาย สร้างเทิร์นพิเศษให้กับเป้าหมาย จากนั้นใช้เทิร์นโจมตีปกติทันที โดยเทิร์นพิเศษที่เป้าหมายได้รับ จะใช้ได้หลังจากทายาทแห่งมอร์ฟีอุสเทิร์นปัจจุบัน\
        \n\* เทิร์นพิเศษ : ได้รับ ATK เพิ่มขึ้น 2 หน่วย และหากในเทิร์นโจมตีเป้าหมายใช้แต้มสกิล จะทำให้ความเสียหายจากการกระทำใดๆ ที่เป้าหมายใช้เพิ่มขึ้น 30%\
        \n\* เทิร์นพิเศษนับเป็นสถานะเกื้อกูล',
      available: true,
      effect: EFFECT_TYPES.DEBUFF,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 0,
    },
    {
      deity: DEITY.MORPHEUS,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.ONEIRONAUTS_REALM_OF_SLUMBER,
      description:
        'ทายาทแห่งมอร์ฟีอุสบันดาลสถานะภวังค์แห่งฝันให้ตนเองและพันธมิตรทุกคน เป็นเวลา 2 รอบ จากนั้นจบเทิร์น\
        \n\* ภวังค์แห่งฝัน : ระยะเวลาของสถานะเกื้อกูลและสถานะผิดปกติที่เป้าหมายครอบครองจะถูกหยุดการนับเวลาลง ยกเว้นภวังค์แห่งฝันเอง และเมื่อเริ่มต้นเทิร์นจะได้รับ 1 แต้มสกิลทันที\
        \n\* ภวังค์แห่งฝันนับเป็นสถานะเกื้อกูล',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 0,
      duration: 0,
    },
  ],

  /* ────────────────────────── Tyche ────────────────────── */
  [DEITY.TYCHE]: [
    {
      deity: DEITY.TYCHE,
      type: POWER_TYPES.PASSIVE,
      name: DEITY_POWER_NAMES.BLESSED_FORTUNE_CURSED_FATE,
      description:
        'ทายาทแห่งไทคีเริ่มต่อสู้ด้วยสถานะชะตาอับแสง และเมื่อใช้สกิลหรืออัลติเมทจะสลับเป็นสถานะวาสนาเจิดจรัส\
        \n\* ชะตาอับแสง : ได้รับอัตราคริ 25%\
        \n\* วาสนาเจิดจรัส : ได้รับโบนัสแต้มเต๋าโจมตี +2\
        \n\* ชะตาอับแสงและวาสนาเจิดจรัสนับเป็นสถานะเกื้อกูลที่ไม่สามารถลบล้างได้',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 0,
      duration: 0,
    },
    {
      deity: DEITY.TYCHE,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.FORTUNA_ENTWINED,
      description:
        'ทายาทแห่งไทคีเสริมดวงให้กับตนเองและพันธมิตร 1 เป้าหมาย เป็นเวลา 1 เทิร์น จากนั้นโจมตีปกติทันที\
        \n\* เสริมโชคลาภ : ได้รับโบนัสแต้มเต๋าโจมตี +3\
        \n\* เสริมโชคลาภนับเป็นสถานะเกื้อกูล',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.ALLY,
      value: 0,
      duration: 0,
    },
    {
      deity: DEITY.TYCHE,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.RISK_THE_FATES,
      description:
        'ทายาทแห่งไทคีท้าดวลศัตรู 1 เป้าหมาย ทอยเต๋า d6 แข่งขันกันโดยไม่นับโบนัสแต้มเต๋า\
        \n\* หากทอยชนะ : ทายาทแห่งไทคีจะโจมตีศัตรูเป้าหมายนั้นทันที ทำดาเมจตามจำนวนแต้มเต๋าที่ทอยได้ โดยเมื่อโจมตีจะบังคับให้เกิดการทอยคริติคอลทันที และมีอัตราคริพื้นฐานที่ 25%\
        \n\* การโจมตีนี้ นับเป็นการโจมตีจากสกิล\
        \n\* หากทอยแพ้ : ทายาทแห่งไทคีได้รับโบนัสแต้มเต๋าโจมตี +4\
        \n\* หลังจากใช้ Risk the Fates แล้ว ไม่ว่าผลจะเป็นเช่นไร จากนั้นโจมตีปกติ',
      available: true,
      effect: EFFECT_TYPES.DEBUFF,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 0,
    },
    {
      deity: DEITY.TYCHE,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.JACKPOT,
      description:
        'ทายาทแห่งไทคีหมุนวงล้อแห่งโชคลาภ ทอยเต๋า d6 โดยไม่โบนัสแต้มเต๋า เพื่อเลือกแอคชั่น จากนั้นจบเทิร์น\
        \n\* 1 แต้ม : แต้มเต๋าเป็นโมฆะ ไม่เกิดสิ่งใดขึ้น\
        \n\* 2 แต้ม : โจมตีศัตรู 1 เป้าหมาย ทำดาเมจ 100% ของ ATK โดยไม่ต้องทอย และไม่สามารถป้องกันได้\
        \n\* 3 แต้ม : แสดงผลของแต้มก่อนหน้า และเลือกเป้าหมายในการโจมตีเพิ่มอีก 1 เป้าหมาย\
        \n\* 4 แต้ม : แสดงผลของแต้มก่อนหน้า และการโจมตีนั้นจะติดคริติคอลแน่นอน 100%\
        \n\* 5 แต้ม : แสดงผลของแต้มก่อนหน้า แต่เปลี่ยนเป็นโจมตีศัตรูทั้งสนาม\
        \n\* 6 แต้ม : แสดงผลของแต้มก่อนหน้า และใช้สกิล Fortuna Entwined ให้พันธมิตรทุกคนทันที\
        \n\* การโจมตีนี้ นับเป็นการโจมตีจากสกิล\
        \n\* หากทายได้แต้ม 1-2 จะได้รับแต้มสกิลคืน 1 หน่วย',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 0,
      duration: 0,
    },
  ],

  /* ────────────────────────── Nyx ────────────────────── */
  [DEITY.NYX]: [
    {
      deity: DEITY.NYX,
      type: POWER_TYPES.PASSIVE,
      name: DEITY_POWER_NAMES.VEIL_OF_DUSK,
      description:
        'ทายาทแห่งนิกซ์เริ่มการต่อสู้มาพร้อมกับสถานะม่านสนธยา\
        \n\* ม่านสนธยา : เมื่อทายาทแห่งนิกซ์โจมตีเป้าหมายที่มีเปอร์เซนต์ HP ปัจจุบันมากกว่าตนเอง เป้าหมายดังกล่าวจะถูกลดแต้มเต๋าทุกป้องกัน -2 ในการทอยป้องกันการโจมตีของทายาทแห่งนิกซ์\
        \n\* ม่านสนธยานับเป็นสถานะเกื้อกูลที่ไม่สามารถลบล้างได้',
      available: true,
      effect: EFFECT_TYPES.DEBUFF,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 999,
    },
    {
      deity: DEITY.NYX,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.GLOOMY_STRIKE,
      description:
        'ทายาทแห่งนิกซ์ใช้พลังแห่งความมืด สละ HP 1 หน่วย และเพิ่มอัตราคริ 25% ในการโจมตีปกติครั้งถัดไป และหากขณะนั้น ทายาทแห่งนิกซ์มี HP ต่ำกว่า 50% จะเพิ่ม ATK ขึ้นอีก 1 หน่วยด้วย จากนั้นโจมตีปกติทันที\
        \n\* การสละ HP จะไม่กลืนกิน HP ให้ต่ำลงไปกว่า 1 หน่วย\
        \n\* เมื่อร่ายสกิลและมี HP ไม่พอให้หัก จะนับว่าสกิลเป็นโมฆะ',
      available: true,
      effect: EFFECT_TYPES.SHIELD,
      target: TARGET_TYPES.ALLY,
      value: 0,
      duration: 2,
    },
    {
      deity: DEITY.NYX,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.NIGHTSHADES_REQUIEM,
      description:
        'ทายาทแห่งนิกซ์สละร่างกายให้อวตารราตรีสิงสู่ สละ HP 2 หน่วย และเข้าสู่สถานะสถิตเงา เป็นเวลา 2 เทิร์น จากนั้นโจมตีปกติทันที\
        \n\* สถิตเงา : ทายาทแห่งนิกซ์ได้รับ ATK 1 หน่วยต่อ HP ที่หายไปจาก Max HP 3 หน่วย สูงสุด +4 หน่วย หาก HP หายไปไม่ครบ 3 หน่วยจะไม่แสดงผล\
        \n\* สถิตเงานับเป็นสถานะเกื้อกูล\
        \n\* หากสังหารศัตรูได้ในขณะที่ยังอยู่ในสถานะสถิตเงา จะต่อระยะเวลาของสถานะเพิ่มขึ้นไป 1 รอบ\
        \n\* การสละ HP จะไม่กลืนกิน HP ให้ต่ำลงไปกว่า 1 หน่วย\
        \n\* เมื่อร่ายสกิลและมี HP ไม่พอให้หัก จะนับว่าสกิลเป็นโมฆะ',
      available: true,
      effect: EFFECT_TYPES.SHIELD,
      target: TARGET_TYPES.ALLY,
      value: 1,
      duration: 3,
    },
    {
      deity: DEITY.NYX,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.EVERLASTING_NIGHT,
      description:
        'ทายาทแห่งนิกซ์สละ HP ของตน 3 หน่วย เพื่อชะโลมผืนนภาด้วยราตรีนิรันดร์ เป็นเวลา 3 เทิร์น จากนั้นจบเทิร์น\
        \n\* ราตรีนิรันดร์ : เมื่อตัวละครบนสนามเริ่มต้นเทิร์น ลด HP ของเป้าหมายทันที 1 หน่วย โดยราตรีนิรันดร์จะส่งผลกับทุกตัวละครบนสนามและมีผลพิเศษอื่นที่ต่างกันไปแล้วแต่ตัวละคร ดังนี้\
        \n\* ทายาทแห่งนิกซ์ : หากทอยเต๋าป้องกันไม่สำเร็จ จะหลบหลีกการโจมตีที่เข้ามา โดยแสดงผลได้ 2 ครั้งต่อการเข้าสู่สถานะราตรีนิรันดร์ 1 ครั้ง\
        \n\* พันธมิตร : ได้รับโบนัสแต้มเต๋าทุกป้องกัน +3\
        \n\* ศัตรู : ถูกลด ATK ลง 2 หน่วย\
        \n\* ราตรีนิรันดร์นับเป็นสถานะผิดปกติที่ติดกับทายาทแห่งนิกซ์เท่านั้น\
        \n\* เมื่อราตรีนิรันดร์จบลง ฟื้นฟู HP ให้กับทายาทแห่งนิกซ์ 3 หน่วย และคืนแต้มสกิล 1 หน่วย\
        \n\* หากทายาทแห่งนิกซ์ไม่อยู่ในสถานะสถิตเงา เมื่อร่าย Evernight จะทำการร่าย Nightshade\'s Requiem ต่อทันทีโดยไม่เสียแต้มสกิล',
      available: true,
      effect: EFFECT_TYPES.REFLECT,
      target: TARGET_TYPES.SELF,
      value: 50,
      duration: 3,
    },
  ],

  /* ────────────────────────── Hemera ────────────────────── */
  [DEITY.HEMERA]: [
    {
      deity: DEITY.HEMERA,
      type: POWER_TYPES.PASSIVE,
      name: DEITY_POWER_NAMES.AURA_OF_DAWN,
      description:
        'เมื่อพันธมิตรมีโล่กี่หน่วยก็ตามจากแหล่งใดก็ได้อย่างน้อย 1 คน ทายาทแห่งฮีเมราจะเข้าสู่สถานะแสงย่ำรุ่ง จนกว่าโล่นั้นจะหายไปทั้งหมดจากสนาม และนอกจากนั้นยังมอบโบนัสแต้มเต๋าทุกประเภท +1 ให้กับทุกคนในทีม และหากโล่นั้นเป็นโล่แห่งแสง จะเพิ่ม ATK อีก 1 หน่วยให้กับพันธมิตรทุกคนเพิ่มเติม\
        \n\* แสงย่ำรุ่ง : ได้รับ ATK 1 หน่วย และอัตราคริ 25%\
        \n\* แสงย่ำรุ่งนับเป็นสถานะเกื้อกูลที่ไม่สามารถลบล้างได้',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 0,
      duration: 0,
    },
    {
      deity: DEITY.HEMERA,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.RADIANCE_SHIELD,
      description:
        'ทายาทแห่งฮีเมราห่อหุ้มร่างกายของตนเองหรือพันธมิตร 1 คนด้วยอาภรณ์แห่งแสง มอบโล่ 1 หน่วยและเพิ่มขึ้นอีก 20% ของ Max HP ของทายาทแห่งฮีเมรา โดยโล่นี้คงอยู่จนกว่าจะถูกทำลาย จากนั้นโจมตีปกติทันที\
        \n\* โล่นับเป็นสถานะเกื้อกูล\
        \n\* โล่ที่สร้างโดยทายาทแห่งฮีเมราจะไม่มีระยะเวลาหมดลง สลายไปต่อเมื่อถูกทำลายหรือถูกลบล้าง\
        \n\* โล่ที่สร้างโดยทายาทแห่งฮีเมราสามารถร่ายทับซ้อนได้สูงสุด 10 หน่วยต่อ 1 เป้าหมาย',
      available: true,
      effect: EFFECT_TYPES.DAMAGE,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 0,
    },
    {
      deity: DEITY.HEMERA,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.LUMINOUS_MIRAGE,
      description:
        'ทายาทแห่งฮีเมราหักเหไรแสงสร้างเป็นภาพมายา มอบสถานะลวงตาให้กับตนเองและพันธมิตร 1 เป้าหมาย เป็นเวลา 2 เทิร์น และมอบโล่ให้กับเป้าหมายทั้งคู่ 10% ของ Max HP ของทายาทแห่งฮีเมรา จากนั้นจบเทิร์น\
        \n\* ลวงตา : ปฏิเสธสถานะผิดปกติที่ได้รับมาให้เป็นโมฆะ\
        \n\* โล่นับเป็นสถานะเกื้อกูล\
        \n\* โล่ที่สร้างโดยทายาทแห่งฮีเมราจะไม่มีระยะเวลาหมดลง สลายไปต่อเมื่อถูกทำลายหรือถูกลบล้าง\
        \n\* โล่ที่สร้างโดยทายาทแห่งฮีเมราสามารถร่ายทับซ้อนได้สูงสุด 10 หน่วยต่อ 1 เป้าหมาย',
      available: true,
      effect: EFFECT_TYPES.HEAL,
      target: TARGET_TYPES.ALLY,
      value: 0,
      duration: 0,
    },
    {
      deity: DEITY.HEMERA,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.LUMINESCENT_EPIPHANY,
      description:
        'ทายาทแห่งฮีเมราเข้าสู่สถานะจรัสแสง เป็นเวลา 3 เทิร์น และทำการเปลี่ยนโล่ทั้งหมดที่ตนเองและพันธมิตรทุกคนมีอยู่ให้กลายเป็นโล่แห่งแสง ทันที โดยจะทำการรีเซทระยะเวลาคงอยู่ของโล่ทั้งหมดที่เปลี่ยนมาเป็นโล่แห่งแสง และกำหนดให้โล่แห่งแสงบนสนามมีระยะเวลาคงเหลือ 3 เทิร์น จากนั้นจบเทิร์น\
        \n\* จรัสแสง : โล่ที่สร้างโดยทายาทแห่งฮีเมราจะเปลี่ยนเป็นโล่แห่งแสง และแสงย่ำรุ่งแสดงผล 2 เท่า\
        \n\* โล่แห่งแสง : ผู้ที่ครอบครองจะได้รับโบนัสแต้มเต๋าโจมตี +3 หน่วย และเมื่อโล่แห่งแสงหมดเวลาหรือถูกทำลายลงมันจะทำดาเมจ 30% ของ ATK ของทายาทแห่งฮีเมรา ขั้นต่ำ 1 หน่วย ให้กับศัตรูทุกตัวบนสนาม จากนั้นฟื้นฟู HP 2 หน่วยให้กับตนเองหรือพันธมิตรที่มีโล่แห่งแสงที่พึ่งหมดเวลาไป\
        \n\* โล่แห่งแสงนับเป็นสถานะเกื้อกูล\
        \n\* หากตัวละครที่มีโล่แห่งแสงได้รับโล่แหล่งอื่นมา จะเปลี่ยนมันเป็นโล่แห่งแสงทั้งหมด และทำการรีเซทระยะเวลาคงอยู่ให้กลับไปเป็น 2 เทิร์นทุกครั้งที่ได้รับโล่แหล่งอื่น',
      available: true,
      effect: EFFECT_TYPES.DEBUFF,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 0,
    },
  ],

  /* ────────────────────────── Amphitrite ────────────────────── */
  [DEITY.AMPHITRITE]: [
    {
      deity: DEITY.AMPHITRITE,
      type: POWER_TYPES.PASSIVE,
      name: DEITY_POWER_NAMES.ALLEGIANCE_OF_THE_MARINA,
      description:
        'ทายาทแห่งแอมฟิไทรทีเริ่มการต่อสู้มาพร้อมกับอวตารสมุทร 1 ตน โดยจะคงอยู่เป็นระยะเวลา 3 เทิร์น โดยอวตารสมุทรตัวแรกนี้จะสถิตอยู่กับทายาทแห่งแอมฟิไทรทีก่อนเสมอ\
        \n\* อวตารสมุทร : โบนัสแต้มเต๋าทุกประเภท +1 และเพิ่ม ATK 1 หน่วย ให้กับเป้าหมายที่มันสถิตอยู่ และเมื่อเป้าหมายที่มันสถิตอยู่ด้วยโจมตี มันจะโจมตีเสริม ทำดาเมจ 1 หน่วย\
        \n\* อวตารสมุทรนับเป็นยูนิตอัญเชิญ\
        \n\* เมื่ออวตารสมุทรสลายไปตามระยะเวลาคงอยู่ ฟื้นฟู HP ให้กับเป้าหมายที่มันเคยสถิตอยู่ 2 หน่วย\
        \n\* บนสนามสามารถมีอวตารสมุทรได้สูงสุด 2 ตนในเวลาเดียวกัน\
        \n\* สถิตคือการที่อวตารสมุทรเกาะติดเป้าหมาย ผลของอวตารสมุทรจะแสดงกับเป้าหมายที่มันสถิตอยู่\
        \n\* อวตารสมุทรสามารถสถิตอยู่ที่ตัวละครเดียวกันได้มากกว่า 1 ตัวและสามารถแสดงผลทับซ้อนกันได้',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.SELF,
      value: 0,
      duration: 0,
    },
    {
      deity: DEITY.AMPHITRITE,
      type: POWER_TYPES.FIRST_SKILL,
      name: DEITY_POWER_NAMES.TIDAL_TRANSFLUENCE,
      description:
        'ทายาทแห่งแอมฟิไทรทีฟื้นฟู HP 30% ของ ATK ให้กับตนเองหรือพันธมิตร 1 เป้าหมายและย้ายอวตารสมุทรทั้งหมดบนสนามไปสถิตอยู่กับเป้าหมายที่ได้รับการรักษา จากนั้นโจมตีปกติทันที',
      available: true,
      effect: EFFECT_TYPES.BUFF,
      target: TARGET_TYPES.ALLY,
      value: 0,
      duration: 0,
    },
    {
      deity: DEITY.AMPHITRITE,
      type: POWER_TYPES.SECOND_SKILL,
      name: DEITY_POWER_NAMES.AQUATIC_SIMULACRUM,
      description:
        'ทายาทแห่งแอมฟิไทรทีควบรวมมวลนทีสงัดให้คุกรุ่น สร้างอวตารสมุทรขึ้นบนสนาม 1 ตน และเลือกให้พวกมันสถิตอยู่กับตนเองหรือพันธมิตร 1 เป้าหมาย จากนั้นโจมตีปกติทันที',
      available: true,
      effect: EFFECT_TYPES.DEBUFF,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 0,
    },
    {
      deity: DEITY.AMPHITRITE,
      type: POWER_TYPES.ULTIMATE,
      name: DEITY_POWER_NAMES.OCEANIC_HARMONIC,
      description:
        'ทายาทแห่งแอมฟิไทรทีสร้างอวตารสมุทรขึ้นบนสนาม 1 ตน โดยจะสถิตอยู่กับทายาทแห่งแอมฟิไทรทีก่อน จากนั้นปลุกพลังแห่งท้องทะเล เข้าสู่สถานะเกลียวคลื่นสั่นพ้อง เป็นเวลา 2 เทิร์น จากนั้นโจมตีปกติทันที\
        \n\* เกลียวคลื่นสั่นพ้อง : อวตารสมุทรทุกตัวบนสนามจะหยุดการนับระยะเวลาคงอยู่ลงและดาเมจเสริมจากอวตารสมุทรจะเพิ่มขึ้นจาก 1 หน่วยเป็น 2\
        \n\* เกลียวคลื่นสั่นพ้องนับเป็นสถานะเกื้อกูล',
      available: true,
      effect: EFFECT_TYPES.DAMAGE,
      target: TARGET_TYPES.ENEMY,
      value: 0,
      duration: 0,
    },
  ],
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
