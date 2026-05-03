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
        'เมื่อทายาทแห่งซุสโจมตีศัตรูสำเร็จด้วยจากแอคชันใดก็ตาม จะมีผลดังนี้\
        \n\* ทายาทแห่งซุสจะใช้ประจุสายฟ้าและติด "ช็อต" ไว้ที่ศัตรูผู้นั้นโดยไม่มีระยะเวลาจำกัด\
        \n\* เมื่อศัตรูที่มีช็อตอยู่ได้รับช็อตซ้ำอีกครั้ง ศัตรูผู้นั้นจะได้รับดาเมจเพิ่มเติม 100% ของดาเมจโจมตีปกติของทายาทแห่งซุสและจะลบล้างช็อตทั้งหมดบนศัตรูผู้นั้นยออกทันที\
        \n\* สถานะช็อตนับเป็นสถานะผิดปกติ',
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
        'ทายาทแห่งซุสจะเข้าสู่สถานะ "เหนือเมฆครึ้ม" เป็นเวลา 2 รอบ นั่นคือ\
        \n\* ทายาทแห่งซุสจะมีความเร็วเพิ่มขึ้น 2 หน่วยและอัตราติดคริติคอลเพิ่มขึ้น 25% จากนั้นทำการโจมตีทันที\
        \n\* ขณะที่ทายาทแห่งซุสอยู่ในสถานะเหนือเมฆครึ้ม  หากทายาทแห่งซุสทำการโจมตีศัตรูเป้าหมายได้สำเร็จ\
        ศัตรูทั้งสนามจะเข้าสู่สถานะติดช็อตโดยพร้อมเพรียง\
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
        'ทายาทแห่งซุสร่ายประจุสายฟ้าขึ้นและทำการระเบิดช็อตที่อยู่บนตัวศัตรูทุกเป้าหมายให้ทำดาเมจทันที\
        ซึ่งจะเป็นการลบล้าสถานะช็อตบนเป้าหมายทั้งหมดจากนั้นทำให้ศัตรูทุกคนที่โดนระเบิดจากช็อตถูกลดความเร็วลง 7 หน่วยเป็นเวลา 2 รอบจากนั้นจบเทิร์น\
        ทั้งนี้ การถูกลดความเร็วจากการใช้พลังดังกล่าวของทายาทแห่งซุสนับเป็นสถานะผิดปกติ',
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
        'ทายาทแห่งซุสเรียกอัสนีบาตผ่าศัตรู 1 คนทำดาเมจ 3 หน่วยทันทีรวมถึงทำดาเมจโดนศัตรูคนอื่นรอบข้าง 2 คน\
        ทำดาเมจ 2 หน่วยโดยไม่ต้องทอยเต๋าอีกทั้งศัตรูจะไม่มีโอกาสในการป้องกัน \
        ทั้งนี้ ศัตรูทั้งหมดที่ได้รับดาเมจจากการใช้พลังนี้จะติดสถานะช็อตเช่นกัน ทั้งนี้ การใช้พลังดังกล่าวของทายาทแห่งซุสสามารถติดคริติคอลได้\
        และจะเพิ่มเติมอัตราคริติคอลของทายาทแห่งซุสในการใช้พลังนี้ขึ้นอีก 25%',
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
        '\* เมื่อทายาทแห่งโพไซดอนใช้ทักษะประจำกาย ห้วงมหรรณพจะเยียว HP ของเขา โดยฟื้นฟู HP 1 หน่วย\
        \n\* หากบนสนามมี "ห้วงธารา" การฟื้นฟู HP จะเพิ่มขึ้นอีก +2 หน่วย',
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
        'ทายาทแห่งโพไซดอนกักขังศัตรู 1 เป้าหมายโดยสร้าง "กรงสินธุ" พันธนาการเป้าหมายเป็นเวลา 2 รอบจากนั้นโจมตีปกติทันที\
        \n\* กรงสินธุจะทำให้การโจมตีปกติของผู้ถูกคุมขังถูกบังคับใช้แต้มสกิล 1 แต้ม หากไม่มีแต้มให้หักจะบังคับข้ามเทิร์นทันที ซึ่งนับเป็นสถานะผิดปกติ\
        \n\* หากบนสนามมี "ห้วงธารา" ผู้ถูกคุมขังในกรงสินธุจะทำดาเมจลดลง 1 หน่วย',
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
        'ทายาทแห่งโพไซดอนควบคุมมวลน้ำเป็นกระสุนน้ำวนและยิงใส่ศัตรู 1 เป้าหมายซึ่งจะทำดาเมจ 2 หน่วยและมอบสถานะ "จมดิ่ง" ให้กับเป้าหมายเป็นระยเวลา 2 รอบจากนั้นจบเทิร์น\
        \n\* ศัตรูผู้อยู่ในสถานะจมดิ่งจะไม่สามารถร่ายสกิลได้ ซึ่งนับเป็นสถานะผิดปกติ\
        \n\* พลังดังกล่าวของทายาทแห่งโพไซดอนจะมีผลต่อเป้าหมายทันทีโดยไม่ต้องทอยลูกเต๋าและเป้าหมายไม่สามารถทอยลูกเต๋าป้องกันได้\
        \n\* หากบนสนามมี "ห้วงธารา" พลังดังกล่าวของทายาทแห่งโพไซดอนจะเพิ่มค่าร่ายอีก 1 แต้มสกิลเป็น 2 แต้มสกิล\
        แต่จะสร้างดาเมจเพิ่มเติมอีก 2 หน่วยและเพิ่มระยะเวลาของห้วงธาราที่อยู่บนสนามขึ้นเป็นระยะเวลาอีก 1 รอบ',
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
        'ทายาทแห่งโพไซดอนสร้างคลื่นยักษ์โจมตีศัตรูทุกคนทำดาเมจ 2 หน่วยจากนั้นสร้าง "ห้วงธารา" ขึ้นบนสนาม ซึ่งห้วงธาราจะคงอยู่เป็นเวลา 3 รอบและจบเทิร์นลง\
        \n\* เมื่อมีห้วงธารา ศัตรูได้รับดาเมจจากทายาทแห่งโพไซดอนสเพิ่มขึ้น 1 หน่วย และแต้มเต๋าป้องกันจะลดลง 3 แต้ม ซึ่งนับเป็นนับเป็นสถานะเกื้อกูลที่ไม่สามารถลบล้างได้\
        \n\* พลังดังกล่าวของทายาทแห่งโพไซดอนจะมีผลต่อเป้าหมายทันทีโดยไม่ต้องทอยลูกเต๋าและเป้าหมายไม่สามารถทอยลูกเต๋าป้องกันได้\
        \n\* หากบนสนามมี "ห้วงธารา" อยู่ก่อน พลังดังกล่าวของทายาทแห่งโพไซดอนจะทำดาเมจอย่างเดียวเท่านั้น โดยไม่สร้างห้วงธาราเพิ่มและไม่ขยายหรือรีเซทระยะเวลาของห้วงธาราที่มี',
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
        'ทายาทแห่งแอรีสเริ่มการต่อสู้มาพร้อมกับสถานะ "กระหายโลหิต" \
        ซึ่งทำให้เมื่อทายาทแห่งแอรีสโจมตีศัตรูที่มี HP มากกว่าจะทำดาเมจเพิ่มขึ้น 1 หน่วยและหากโจมตีศัตรูที่มี HP น้อยกว่าแต้มเต๋าโจมตีจะเพิ่มขึ้น 2 แต้ม\
        ทั้งนี้ สถานะกระหายโลหิตนับเป็นสถานะเกื้อกูลที่ไม่สามารถลบล้างได้',
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
        'ทายาทแห่งแอรีสเลือกมอบสถานะ "พิโรธ" ให้กับตนเองและพันธมิตร 1 คน เป็นเวลา 1 รอบจากนั้นโจมตีปกติทันที\
        \n\* ผู้อยู่ในสถานะพิโรธจะได้รับแต้มต๋าโจมตีเพิ่ม 1 แต้มและสามารถทำดาเมจได้แรงขึ้น 1 หน่วย\
        \n\* สถานะพิโรธนับเป็นสถานะเกื้อกูล',
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
        'ทายาทแห่งแอรีส "สาปอาวุธ" ของศัตรู 1 เป้าหมายเป็นระยะเวลา 2 รอบจากนั้นจบเทิร์น\
        ซึ่งจะทำให้การร่ายการโจมตีปกติ สกิล อัลติเมท หรือสถานะผิดปกติที่ผู้ถูกสาปกระทำจะทำดาเมจเป็น 0\
        ทั้งนี้ การถูกสาปอาวุธนับเป็นสถานะผิดปกติ',
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
        'ทายาทแห่งแอรีสปลุกพลังแห่งความบ้าคลั่งในจิตใจ เสริมพลังให้กับการโจมตีปกติครั้งถัดไปจากนั้นทำการโจมตีปกติทันที\
        \n\* หากทำการโจมตีได้สำเร็จ ทายาทแห่งแอรีสจะสร้างดาเมจเพิ่มขึ้น 3 หน่วย\
        \n\* หากโจมตีไม่สำเร็จ ทายาทแห่งแอรีสจะได้รับแต้มสกิลคืน 1 แต้ม\
        \n\* ดาเมจที่กระทำจากการใช้พลังนี้ของทายาทแห่งแอรีสยังสามารถติดคริตอคอลได้อีกด้วย',
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
        ซึ่งทำให้เมื่อทายาทแห่งอาธีนาโจมตีหรือป้องกันสำเร็จ แต้มเต๋าทุกประเภทจะเพิ่มขึ้น 1 แต้มและสะสมได้สูงสุด 3 แต้ม\
        แต่หากทายาทแห่งอาธีนาโจมตีหรือป้องกันไม่สำเร็จ โบนัสแต้มเต๋าที่สะสมได้จากความฉลาดเฉลียวจะหายไปทั้งหมด\
        ทั้งนี้ สถานะฉลาดเฉลียวเป็นสถานะเกื้อกูลที่ไม่สามารถลบล้างได้',
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
        'ทายาทแห่งอาธีนาวางกลยุทธ์อย่างชาญฉลาด ทำลายแผนการของศัตรูโดยบังคับผลลัพธ์การทอยเต๋าครั้งล่าสุดของศัตรูให้เป็นโมฆะเพื่อให้ศัตรูจำเป็นต้องทอยผลลูกเต๋าอีกครั้ง\
        \n\* หากศัตรูทำการทอยใหม่และได้แต้มมากกว่าหรือเท่ากับแต้มเดิม ทายาทแห่งอาธีนาจะได้รับแต้มร่ายสกิลคืน 1 แต้ม\
        \n\* ทายาทแห่งอาธีนาสามารถใช้พลังดังกล่าวได้เพียง 1 รอบต่อการโจมตีหรือป้องกันของศัตรู 1 ครั้งเท่านั้น\
        \n\* ทายาทแห่งอาธีนาจะสามารถใช้สกิลนี้ได้เมื่อศัตรูทอยเต๋าไปแล้วเท่านั้นไม่ว่าจะเป็นเต๋าโจมตีหรือเต๋าป้องกันก็ตาม\
        \n\* ทายาทแห่งอาธีนาสามารถใช้สกิลนี้ในเทิร์นป้องกันได้',
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
        'ทายาทแห่งอาธีนาสร้างความเสียเปรียบให้กับศัตรูโดยลบล้างสถานะเกื้อกูลทุกอย่างของศัตรู 1 เป้าหมายพร้อมมอบสถานะ "ปลดอาวุธ" ใส่เป้าหมายเดียวกันนั้นเป็นระยะเวลา 2 รอบจากนั้นโจมตีปกติทันที\
        \n\* สถานะปลดอาวุธจะทำให้ศัตรูทำให้ศัตรูไม่สามารถได้รับสถานะเกื้อกูล โบนัสบวกเต๋า โล่ป้องกันดาเมจและเอฟเฟคของอุปกรณ์สวมใส่ รวมถึงไม่สามารถใช้ไอเทมประเภทโพชั่นและอาหารได้ ซึ่งนับเป็นสถานะผิดปกติ\
        \n\* การใช้พลังนี้ของทายาทแห่งอาธีนาจะส่งผลให้ทายาทแห่งอาธีนาถูกข้ามเทิร์นในรอบถัดไปด้วย\
        \n\* ทายาทแห่งอาธีนาสามารถใช้สกิลนี้ในเทิร์นป้องกันได้',
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
        'ทายาทแห่งอาธีนาวางแผนเพื่อเสริมกองกำลังของฝ่ายพันธมิตร โดยเสริมแต้มเต๋าป้องกัน 3 แต้มและเพิ่มดาเมจที่ทำได้ให้กับตนเองและพันธมิตรทุกคนในทีม 1 หน่วย\
        จากนั้นทายาทแห่งอาธีนาจะเข้าสู่สถานะ "ตื่นตัว" เป็นระยะเวลา 3 รอบและทำการโจมตีปกติทันที\
        \n\* การใช้พลังนี้ของทายาทแห่งอาธีนาจะส่งผลให้ทายาทแห่งอาธีนาถูกข้ามเทิร์นในรอบถัดไปด้วย\
        \n\* ทายาทแห่งอาธีนาสามารถใช้สกิลนี้ในเทิร์นป้องกันได้',
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
        '\*ผลของการฟื้นฟู HP ที่ทายาทแห่งเทพอพอลโลได้รับเพิ่มเติม 1 หน่วยเสมอ\
        \n\* เมื่อทายาทแห่งเทพอพอลโลสร้างหรือได้รับการฟื้นฟู จะเพิ่มแต้มเต๋าทุกประเภทถาวร 1 แต้ม โดยสามารถสะสมแต้มเต๋าได้สูงสุด +2',
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
        'ทายาทแห่งเทพอพอลโลเสียสละโอกาสในการโจมตีเพื่อขับขานบทเพลงรักษา\
        โดยเลือกเพื่อนร่วมทีม 1 คนเพื่อฟื้นฟู HP 2 หน่วย หนึ่งครั้ง และมอบอัตราคริติคอล 25% ให้กับตนเองและเป้าหมายผู้นั้นเป็นระยะเวลา 2 รอบ',
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
        'ทายาทแห่งเทพอพอลโลเสียสละโอกาสในการโจมตีเพื่อเลือกกล่าว "กลอนคำสาป" ซึ่งนับเป็นสถานะผิดปกติ 1 บท ใส่ศัตรู 1 เป้าหมาย เป็นเวลา 2 รอบ โดยมีบทกลอนดังนี้\
        \n\* สูญสิ้นเยียวยา: ผลการฟื้นฟู HP ที่ผู้ต้องสาปได้รับจะไม่มีผลใด ๆ\
        \n\* ดวงเนตรเลือนพร่า: ผู้ต้องสาปจะไม่สามารถเลือกเป้าหมายในการโจมตีหรือใช้พลังใด ๆ ได้ รวมทั้งยังทำให้โอกาสที่การกระทำของผู้ต้องสาปจะไร้ผลในอัตรา 25%\
        \n\* ทุกขาอนันต์: ระยะเวลาของสถานะผิดปกติที่ต้องสาปมีทั้งหมดจะขยายออกไปอีก 2 รอบ จากนั้นฤทธิ์ของบทกลอนจะสิ้นลงทันที',
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
        'ทายาทแห่งอพอลโลจะเข้าสู่สถานะ "กระหน่ำยิง" เป็นระยะเวลา3 รอบ จากนั้นทำการโจมตีปกติทันที\
        \n\* การโจมตีปกติในสถานะกระหน่ำยิงนี้ ทายาทแห่งอพอลโลจะมีความแม่นยำมากขึ้น โดยจะเป็นการเสริมแต้มเต๋าโจมตี 3 แต้ม\
        \n\* หากทายาทแห่งอพอลโลทำการโจมตีสำเร็จด้วยการทอยเต๋า ทายาทแห่งอพอลโลจะมีโอกาส 75% ที่จะโจมตีเสริม 1 ครั้ง โดยจะเกิดขึ้นเรื่อยๆ และโอกาสจะลดลง 25% ต่อการโจมตีเสริมที่เกิดขึ้น 1 ครั้ง แต่จะไม่ลดลงต่ำไปกว่า 25% จนกว่าจะสุ่มไม่ติด\
        \n\* การโจมตีเสริมจะทำดาเมจ 50% ของการโจมตีปกติและการโจมตีปกติในสถานะกระหน่ำยิงนี้สามารถติดคริติคอลได้ โดยจะคิดจากการโจมตีหลักในครั้งแรก หากการโจมตีหลักติดคริติคอล การโจมตีเสริมก็จะติดคริติคอลไปด้วย',
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
        'ทายาทแห่งฮาเดสจะเริ่มการต่อสู้มาพร้อมกับสถานะ "ผู้รั้งความตาย" ซึ่งเมื่อมีการตายเกิดขึ้นภายในทีม ในเทิร์นโจมตีของตนเอง\
        ผู้รั้งความตายจะได้รับแอคชันพิเศษเพื่อร่ายการชุบชีวิตโดยไม่เสียเทิร์น ผู้ที่ถูกชุบขึ้นมาจะฟื้นฟู HP ขึ้นมา 50% จาก Max HP ของผู้ถูกชุบชีวิต\
        สถานะนี้สามารถใช้ชุบตัวเองได้หากตัวเองตาย โดยสถานะนี้ไม่สามารถลบล้างได้และจะสามารถชุบชีวิตได้เพียงครั้งเดียวในการต่อสู้หนึ่งครั้งเท่านั้น',
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
        'เสียสละโอกาสในการโจมตีเพื่อเข้าสู่สถานะ "เงาพรางตัว" เป็นเวลา 2 รอบ\
        นั่นคือ ไม่ตกเป็นเป้าหมายของแอคชั่นใดๆ ยกเว้นในการโจมตีหมู่อันหมายถึงทุกคนในทีมตกเป็นเป้าหมายของศัตรู\
        ทั้งนี้ ในเทิร์นที่ร่ายพลัง ทายาทแห่งฮาเดสจะได้รับสิทธิ์ในการทอยเต๋า D4 เพื่อรับโอกาสเติมแต้มสกิล 1 ครั้งด้วยโอกาส 25%',
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
        'เสียสละโอกาสในการโจมตีเพื่อเรียกโครงกระดูก 1 ตัวขึ้นบนมาสนาม\
        \n\* เมื่อทำการโจมตี โครงกระดูกจะทำการโจมตีสมทบ ทำดาเมจ 50% ของดาเมจโจมตีปกติของผู้ร่ายและหากผู้ร่ายโดนโจมตี\
        \n\* โครงกระดูกจะเข้ารับดาเมจแทนทั้งหมด จากนั้นจะหายไปทันที\
        \n\* ดาเมจสมทบจากโครงกระดูกติดคริติคอลได้ โดยนับการโจมตีหลักของผู้ร่ายว่าติดคริติคอลหรือไม่\
        \n\* บนสนามสามารถมีโครงกระดูกได้มากสุด 2 ตัวในเวลาเดียวกันเท่านั้น',
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
        '\*ทายาทแห่งฮาเดสจะเข้าสถานะ "ผู้กลืนวิญญาณ" เป็นเวลา 3 รอบ โดยใน 3 รอบนั้นการโจมตีปกติของทายาทแห่งฮาเดสจะเปลี่ยนเป็นการดูดกลืน HP ของเป้าหมายแทน\
        โดยจะดูดกลืน 50% ของดาเมจที่สามารถทำได้มาฟื้นฟูเป็น HP ให้กับตนเอง ซึ่งเป้าหมายไม่สามารถใช้พลังใด ๆ ลดความเสียหายได้และไม่สามารถป้องกันได้\
        \n\* เมื่อร่าย "Soul Devourer" จะเป็นการร่าย "Undead Army" โดยทันที',
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
        'หากทายาทแห่งฮิปนอสได้ถูกสังหารลงเป็นครั้งแรก ทายาทแห่งฮิปนอสจะไม่ตาย และเข้าสู่สถานะ "นิทรารมณ์" เป็นเวลา 1 เทิร์น\
        \n\* สถานะนิทรารมณ์นั้นส่งผลให้ HP ของทายาทแห่งฮิปนอสจะไม่ลดต่ำลงไปกว่า 1 หน่วยและจะไม่ตกเป็นเป้าหมายของแอคชันจากศัตรู\
        \n\* สถานะนิทรารมณ์ทำให้เมื่อถึงเทิร์นโจมตีของทายาทแห่งฮิปนอสผู้ใช้พลัง ทายาทแห่งฮิปนอสจะถูกข้ามเทิร์น จากนั้นจะฟื้นฟูพลังชีวิต 50% ของ Max HP ของทายาทแห่งฮิปนอสผู้ใช้พลังหลังจบเทิร์น\
        \n\* สถานะนิทรารมณ์นับเป็นสถานะเกื้อกูลที่ไม่สามารถลบล้างได้',
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
        'ทายาทแห่งฮิปนอสสร้างห้วงแห่งการหลับไหล มอบสถานะ "ง่วงงุน" ให้กับศัตรู 1 เป้าหมายเป็นระยเวลา 1 รอบจากนั้นโจมตีปกติทันที ซึ่งจะทำให้เมื่อเริ่มต้นเทิร์นของ "ผู้ง่วงงุน" ผู้ง่วงงุ่นจะถูกบังคับข้ามเทิร์นและสูญเสียเทิร์นนั้นไป ซึ่งสถานะง่วงงุนนี้นับเป็นสถานะผิดปกติ',
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
        'ทายาทแห่งฮิปนอสบิดเบือดสติและความทรงจำของศัตรู มอบสถานะ "ความทรงจำบิดเบี้ยว"ให้กับศัตรู 1 เป้าหมายเป็นระยะเวลา 2 รอบจากนั้นจบเทิร์น ซึ่งสถานะความทรงจำบิดเบี้ยวนี้จะทำให้แต้มบวกเต๋าทั้งหมดของผู้ความทรงจำบิดเบี้ยวจะไม่แสดงผล และลดหน้าเต๋าที่ใช้ทอยลงเป็น D10 ซึ่งสถานะความทรงจำบิดเบี้ยวนี้นับเป็นสถานะผิดปกติ',
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
        'ทายาทแห่งฮิปนอสจะลดความเร็วของตนเองลง 2 หน่วย จากนั้นเลือกมอบสถานะ 1 อย่างเป็นระยะเวลา 1 เทิร์นให้กับป้าหมายจากนั้นจบเทิร์น โดยสถานะที่สามารถเลือกมอบให้กับเป้าหมายได้มีดังนี้\
        \n\* สุขในฝัน: ใช้กับเป้าหมายที่เป็นทีมเดียวกันเท่านั้น ทำให้เมื่อเริ่มต้นเทิร์นของผู้สุขในฝัน จะฟื้นฟู HP 5 หน่วย และฟื้นฟูแต้มสกิล 3 แต้ม แต่จะโดนข้ามเทิร์นทันทีและหากผู้สุขในฝันโดนโจมตีผู้ร่ายสกิลจะเข้ามารับดาเมจแทน\
        \n\* ร้ายมิลืมตื่น: นับเป็นสถานะผิดปกติที่สามารถเลือกมอบให้กับศัตรูได้เท่านั้น ทำให้เมื่อผู้อยู่ในสถานะนี้โดนดาเมจจากการโจมตีจะสูญเสีย HP เพิ่มเติมอีก 1 หน่วย และเมื่อเริ่มต้นเทิร์นมีโอกาส 25% ที่จะโดนข้ามเทิร์น',
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
        'ทายาทแห่งเนเมซิสเริ่มการต่อสู้มาพร้อมกับสถานะ "จิตพยาบาท" และในการต่อสู้ เมื่อได้รับดาเมจจะได้รับ "ความแค้น" 1 แต้ม (สูงสุด 6 แต้ม)\
        \n\* จิตพยาบาท: หากทายาทแห่งเนเมซิสป้องกันการโจมตีไม่สำเร็จ ทายาทแห่งเนเมซิสจะมีโอกาส 50% ในการโจมตีสวนกลับไปยังผู้โจมตีทันที\
        ซึ่งจิตพยาบาทนับเป็นสถานะเกื้อกูลที่ไม่สามารถลบล้างได้ ทั้งนี้การโจมตีสวนจากจิตพยาบาทจะทำดาเมจ 50% ของการโจมตีปกติแต่ยังสามารถติดคริติคอลได้\
        โดยเมื่อโจมตีสวนกลับจะบังคับให้เกิดการทอยคริติคอลทันที\
        \n\* ความแค้น: ลดดาเมจที่ทายาทแห่งเนเมซิสได้รับลง 1 หน่วยต่อความแค้น 2 แต้ม โดยดาเมจที่โดนจะไม่ลดต่ำลงไปกว่า 1 หน่วย',
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
        'ทายาทแห่งเนเมซิสสะสมความคั่งแค้นโดยเสริมการโจมตีปกติครั้งถัดไปและทำการใช้โจมตีปกติทันที\
        \n\* หากทอยเต๋าและโจมตีสำเร็จ: จะใช้แต้มความแค้นทั้งหมด เพิ่มดาเมจที่ทำได้ 1 หน่วยต่อความแค้น 2 แต้มที่มีจากนั้นฟื้นฟู HP 50% ของดาเมจที่ทำได้จาก Repay ให้กับทายาทแห่งเนเมซิสและลบความแค้นทั้งหมดทิ้ง\
        \n\* การโจมตีปกติจากการที่ทายาทแห่งเนเมซิสใช้สกิลนี้สามารถติดคริติคอลได้',
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
        'ทายาทแห่งเนเมซิสทำการเพ่งเล็งจิตอาฆาตและ​ "ลงทัณฑ์อาฆาต" ศัตรู 1 เป้าหมายเป็นเวลา 3 รอบ และได้รับแต้มความแค้น 2 แต้มทันทีจากนั้นจบเทิร์น ซึ่งสถานะลงทัณฑ์อาฆาตนับเป็นสถานะผิดปกติ\
        ที่จะทำให้การกระทำทุกอย่างของ "ศัตรูผู้ถูกลงทัณฑ์อาฆาต" จะล็อคเป้าหมายเป็นทายาทแห่งเนเมซิสผู้ร่ายสกิลนี้เสมอและเมื่อศัตรูที่ถูกลงทัณฑ์อาฆาตจบเทิร์นก็จะเพิ่มแต้มความแค้นให้ทายาทแห่งเนเมซิสเพิ่มเติมอีก 1 แต้ม',
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
        'ทายาทแห่งเนเมซิสเข้าสู่สถานะ "พันธะแห่งกรรม" เป็นระยะเวลา 3 รอบ\
        \n\* พันธะแห่งกรรม: ความแค้นที่มีจะไม่หายไปและได้รับอัตราคริติคอล 100% ซึ่งนับเป็นสถานะเกื้อกูล\
        \n\* เมื่อร่าย "Bound of Karma" จะเป็นการร่าย "Repay Tenfold" โดยทันที',
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
        'จำนวนแต้มสกิลสูงสุดที่สะสมได้ของทายาทแห่งเฮคาทีและพันธมิตรร่วมทีมจะเพิ่มเป็นสูงสุด 1 แต้ม และเมื่อเพื่อนหรือศัตรูใช้แต้มสกิล ทอยเต๋า D4 โดยแสดงผลดังนี้\
        \n\* 1 แต้ม : ไร้ผล ไม่เกิดสิ่งใดขึ้น\
        \n\* 2-3 แต้ม : ทายาทแห่งเฮคาทีได้รับแต้มสกิล 1 แต้ม\
        \n\* 4 แต้ม : ทายาทแห่งเฮคาทีและพันธมิตรทั้งทีมได้รับแต้มสกิล 1 แต้ม',
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
        'ทายาทแห่งเฮคาทีดึงอำนาจจากห้วงความมืด เพื่อร่ายมนต์ดำใส่ศัตรู 1 เป้าหมาย กัดกินศัตรูเป็นเวลา 2 รอบ จากนั้นจบเทิร์น\
        \n\* ผู้มัวหมองด้วยมนตร์ดำ : เมื่อผู้มัวหมองด้วยมนตร์ดำทำการร่ายสกิลหรือได้รับแต้มสกิล ผู้นั้นจะได้รับดาเมจ 1 หน่วย ซึ่งนับเป็นสถานะผิดปกติ\
        \n\* หากทายาทแห่งเฮคาทีอยู่ในสถานะ "ร่ายคาถา" ระยะเวลาของมนต์ดำที่ร่ายจะมีผลต่อผู้มัวหมองด้วยมนตร์ดำเพิ่มขึ้นเป็น 3 รอบ',
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
        'ทายาทแห่งเฮคาทีเข้าสู่สถานะ "ร่ายคาถา" เพื่อดึงพลังแห่งเวทมนตร์มาใช้บริกรรมอามคมเป็นเวลา 3 รอบจากนั้นโจมตีปกติทันที\
        ซึ่งขณะมีสถานะร่ายคาถา การโจมตีปกติของทายาทแห่งเฮคาทีจะใช้แต้มสกิล 1 แต้มและถูกเปลี่ยนเป็นคาถาต่าง ๆ โดยเมื่อใช้เทิร์นโจมตีจะเลือกร่ายได้ 1 คาถา ดังนี้โดยมีคาถา ดังนี้\
        \n\* เวทอัคคี : โจมตีศัตรูทุกคน ทำดาเมจ 100% ของดาเมจโจมตีปกติ\
        \n\* เวทปกปักษ์ : มอบโล่  2 หน่วยให้กับตนเองและพันธมิตร 1 คน โดยโล่จะคงอยู่เป็นเวลา 2 รอบ โล่นับเป็นสถานะเกื้อกูล\
        \n\* เวทย์ราตรี : โจมตีศัตรู 1 เป้าหมาย ทำดาเมจ 100% ของดาเมจโจมตีปกติและขโมยแต้มสกิลของเป้าหมายมาให้ตนเอง 1 แต้ม\
        \n\* คาถาแห่งดิน : ลบสถานะผิดปกติทั้งหมดให้กับตนเองและเพื่อน 1 คน\
        \nทั้งนี้ สถานะร่ายคาถานับเป็นสถานะเกื้อกูลที่ไม่สามารถลบล้างได้ และหากทายาทแห่งเฮคาทีอยู่ในสถานะ "ร่ายคาถา" แต่แต้มสกิลไม่เพียงพอใช้การโจมตีปกติ จะโจมตีปกติแบบธรรมดาแทน',
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
        'ทายาทแห่งเฮคาทีร่ายม่านหมอกบังตาคลุมศัตรูทั้งหมดเป็นระยะเวลา 2 รอบ\
        \n\* สถานะม่านหมอกบังตานับเป็นสถานะผิดปกติ ทำให้ผู้ถูกม่านหมอกบังตาถูกติดลบเต๋าทุกประเภท 5 แต้ม\
        \n\* หากทายาทแห่งเฮคาทีอยู่ในสถานะ "ร่ายคาถา" การร่าย Mist Evasion จะเพิ่มระยะเวลาคงอยู่ของสถานะ "ร่ายคาถา" ขึ้นอีก 1 รอบ',
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
        'เมื่อเริ่มต้นเทิร์นโจมตีของตนเอง ทายาทแห่งเพอร์เซโฟนีจะเข้าสู่สถานะ "นางบุปผา" ซึ่งมีอภิสิทธิ์ในการปฏิเสธสถานะผิดปกติที่ได้รับมาโดยสิ้นเชิง\
        \n\* เมื่อทำการปฏิเสธสถานะผิดปกติใด ๆ แล้วนั้น สถานะความเป็นนางบุปผาจะหายไปทันทีและทายาทแห่งเพอร์เซโฟนีจะคืนสู่สถานะปกติ\
        \n\* อย่างไรก็ตาม การฟื้นฟู HP ของนางบุปผาจะสามารถติดคริติคอลได้\
        \n\* เมื่อทายาทแห่งเพอร์เซโฟนีอยู่ในสถานะนางบุปผา ทายาทแห่งเพอร์เซโฟนีจะได้รับอัตราคริติคอลเพิ่มเติม 25%',
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
        'ทายาทแห่งเพอร์เซโฟนีเลือกประทิน "สุคนธ์บุษบาแห่งการเยียวยา" ให้กับตนเองหรือเพื่อนร่วมทีม 1 คน เพื่อทำการฟื้นฟู HP จำนวนทั้งสิ้น 20% ของ HP สูงสุดของตนให้กับผู้รับการฟื้นฟูคนดังกล่าว จากนั้นทำการโจมตีตามปกติ',
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
        'ทายาทแห่งเพอร์เซโฟนีเสียสละโอกาสในการโจมตีเพื่อผลัดฤดูกาลในพื้นต่อสู้ให้กลายเป็นฤดูกาลที่ต้องการ แต่ละฤดูกาลที่ผันเปลี่ยนนั้นจะคงอยู่ได้เป็นระยะเวลา 2 รอบ โดยมีรายละเอียดของแต่ละฤดูกาล ดังนี้\
        \n\* คิมหันตฤดู : เสริมแต้มเต๋าโจมตีให้กับทุกคนในทีมและตัวเอง 2 แต้ม\
        \n\* วสันตฤดู : เพิ่ม HP สูงสุดให้กับทุกคนในทีม 2 หน่วย\
        \n\* เหมันตฤดู : เสริมแต้มเต๋าป้องกันให้กับทุกคนในทีมและตัวเอง 2 แต้ม\
        \n\* สารทฤดู : ฮีล HP ให้กับทุกคนในทีมและตนเอง 1 หน่วยเมื่อจบเทิร์นการโจมตีของแต่ละคน\
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
        'ทายาทแห่งเพอร์เซโฟนีเลือกมอบ "เมล็ดทับทิมแห่งปรโลก" เมล็ดทับทิมให้กับเพื่อนร่วมทีม 1 คน ทำให้เป้าหมายกลายเป็น "ร่างวิญญาณ์" \
        \n\* ร่างวิญญาณ์จะได้รับโอกาส 50% ที่จะปฏิเสธดาเมจที่ตนได้รับ โดยสถานะ "ร่างวิญญาณ์" จะคงอยู่ได้เป็นระยะเวลา 3 รอบ\
        \n\* เมื่อร่างวิญญาณ์ผู้นั้นสามารถโจมตีเป้าหมายของตนได้สำเร็จ ทายาทแห่งเพอร์เซโฟนีจะสามารถทำการโจมตีร่วมด้วยได้\
        \n\* อย่างไรก็ตาม ทายาทแห่งเพอร์เซโฟนีจะสามารถมอบเมล็ดทับทิมให้ตัวเองเพื่อกลายเป็นร่างวิญญาณ์ได้ต่อเมื่อไม่มีพันธมิตรเหลือในพื้นที่ต่อสู้อีกต่อไปแล้วเท่านั้น แต่ทายาทแห่งเพอร์เซโฟนีผู้กลายเป็นร่างวิญญาณ์จะไม่สามารถใช้สิทธิ์โจมตีร่วมได้',
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
        'เมื่อทายาทแห่งมอร์ฟีอุสใช้แต้มสกิลครบ 3 แต้ม ทายาทแห่งมอร์ฟีอุสจะเข้าสู่สถานะ "เงามายา" เป็นระยะเวลา 2 รอบ\
        \n\*เมื่อพันธมิตรคนใดก็ตามใช้แต้มสกิลในขณะที่ทายาทแห่งมอร์ฟีอุสมีสถานะ "เงามายา" ทายาทแห่งมอร์ฟีอุสจะเพิ่มระยะเวลาของสถานะ "เงามายา" 1 รอบ โดยมีระยะเวลาคงอยู่ได้สูงสุด 3 รอบ\
        \n\*สถานะเงามายานับเป็นสถานะเกื้อกูลที่ทำให้เมื่อทายาทแห่งมอร์ฟีอุสหรือพันธิมตรคนใดได้รับแต้มสกิล ไม่ว่ากี่หน่วยก็ตาม จะเป็นฟื้นฟู HP ให้กับตนเองหรือพันธมิตรคนนั้น ๆ ด้วย 1 หน่วย',
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
        'ทายาทแห่งมอร์ฟีอุสสร้าง "ห้วงฝันหวาน" ให้กับพันธมิตร 1 คน โดยสร้างแต้มสกิล 2 หน่วยให้เป้าหมาย จากนั้นใช้เทิร์นโจมตีปกติทันที',
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
        'ทายาทแห่งมอร์ฟีอุสมอบ "นิมิตเสมือนจริง" ให้กับพันธมิตร 1 เป้าหมายซึ่งจะเป็นการมอบเทิร์นพิเศษให้กับเป้าหมายด้วย จากนั้นใช้เทิร์นโจมตีปกติทันที\
        \n\* เมื่อเป้าหมายได้รับเทิร์นพิเศษ จะใช้เทิร์นพิเศษได้หลังจากทายาทแห่งมอร์เฟียสจบเทิร์นปัจจุบัน\
        \n\* โดยในเทิร์นพิเศษนี้ เป้าหมายสามารถร่ายสกิลโดยไม่เสียแต้มสกิลได้ 1 ครั้ง และทำดาเมจเพิ่มขึ้น 1 หน่วย ซึ่งนับเป็นสถานะเกื้อกูล',
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
        'ทายาทแห่งมอร์ฟีอุสบันดาล "ภวังค์แห่งฝัน" ให้กับตนเองและพันธิมตรทุกเป้าหมายเป็นเวลา 2 รอบ จากนั้นใช้เทิร์นโจมตีปกติทันที\
        \n\* ผู้อยู่ในภวังค์แห่งฝันจะถูกหยุดการนับเวลาของสถานะเกื้อกูลและสถานะผิดปกติที่เป้าหมายครอบครอง ยกเว้นเวลาของภวังค์แห่งฝันเอง\
        \n\* เมื่อถึงเทิร์นการโจมตีของผู้อยู่ในภวังค์แห่งฝัน คนผู้นั้นจะได้รับ 2 แต้มสกิลทันที\
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
        '\*ทายาทแห่งไทคีเริ่มการต่อสู้ด้วยสถานะ "ชะตาอับแสง" และเมื่อทายาทแห่งไทคีร่ายสกิลหรือใช้สกิลอัลติเมท ทายาทแห่งไทคีจะสลับไปเข้าสู่สถานะ "วาสนาเจิดจรัส" แทนโดยทั้งสองสถานะนั้นสามารถสลับไปมาได้\
        \n\* ชะตาอับแสง: เสริมแต้มเต๋าทุกประเภท 2 แต้ม\
        \n\* วาสนาเจิดจรัส: ได้รับโอกาสติดคริติคอล 25%\
        \nทั้งนี้ สถานะทั้งสองนับเป็นสถานะเกื้อกูลที่ไม่สามารถลบล้างได้',
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
        'ทายาทแห่งไทคีเริ่มแบ่งปันชะตาดวงให้กับเพื่อนร่วมทีมด้วยการมอบโบนัสแต้มเต๋าโจมตี 3 แต้มให้กับตนเองและพันธมิตร 1 คนเป็นเวลา 1 รอบ จากนั้นโจมตีปกติทันที',
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
        'ทายาทแห่งไทคีท้าดวลศัตรู 1 เป้าหมาย ให้ทอยเต๋า D6 แข่งขันกันโดยไม่นับแต้มบวกเต๋าใด ๆ\
        \n\* หากทายาทแห่งไทคีทอยได้แต้มสูงกว่า: ทายาทแห่งไทคีซึ่งเป็นฝ่ายชนะจะสร้างดาเมจ 1 หน่วยและเพิ่มอีก 1 หน่วยทุก ๆ 2 แต้มเต๋าที่มากกว่าศัตรู โดยคำนวณจากผลที่ทอย D6 แข่งกัน\
        โดยดาเมจในครั้งนี้สามารถติดคริติคอลได้และจากนั้นทายาทแห่งไทคียังโจมตีปกติต่อได้ทันทีอีกด้วย\
        \n\* หากทายาทแห่งไทคีทอยได้แต้มต่ำกว่าหรือเท่ากับคู่ดวล: ทายาทแห่งไทคีจะเสริมแต้มเต๋าทุกประเภทให้กับตนเอง 3 แต้มเป็นระยะเวลา 1 รอบจากนั้นโจมตีีต่อตามปกติท',
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
        'ทายาทแห่งไทคีหมุนวงล้อแห่งโชคลาภเสี่ยงทายชะตาของตนด้วยการทอยเต๋า D6 เพื่อเลือกแอคชัน จากนั้นทอยเต๋า D4 อีกครั้งเพื่อกำหนดค่าของแอคชั่นที่สุ่มได้ จากนั้นจบเทิร์น\
        โดยแอคชันที่สุ่มได้จากการทอย D6 มีดังนี้\
         \n\* 1-3 : โจมตีศัตรูทั้งสนามทันทีโดยไม่สามารถป้องกันได้ ทำดาเมจตามผลของเต๋า D4 และการโจมตีนี้สามารถติดคริติคอลได้\
         \n\* 4 : ฟื้นฟู HP ให้ตนเองและเพื่อนทุกคนตามตามผลของเต๋า D4 ทันที\
         \n\* 5: 5 : มอบโบนัสบวกแต้มเต๋าทุกประเภทให้ตนเองและเพื่อนทุกคนเป็นจำนวนตามผลของเต๋า D4 ทันทีเป็นระยะเวลา 2 รอบ\
         \n\* 6: มอบโอกาสทอยใหม่ 2 ครั้งให้กับคนเองและพันธมิตรทุกคน เป็นจำนวนครั้งตามผลของเต๋า D4',
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
        'ทายาทแห่งนิกซ์เริ่มการต่อสู้มาพร้อมกับสถานะ "ม่านสนธยา" ซึ่งนับเป็นสถานะเกื้อกูลที่ไม่สามารถลบล้างได้\
       ที่จะทำให้เมื่อทายาทแห่งนิกซ์โจมตีเป้าหมายที่มีเปอร์เซนต์ HP ปัจจุบันมากกว่าตนเอง จะทำการติดลบเต๋าป้องกันของเป้าหมายเป็นจำนวน 2 แต้ม',
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
        'ทายาทแห่งนิกซ์ดึงพลังแห่งความมืดมิดเข้าสู่ร่างกาย สละ HP 1 หน่วย และเพิ่มโอกาสคริติคอลในการโจมตีครั้งถัดไป 25%\
        และหากในตอนนั้นทายาทแห่งนิกซ์มี HP ต่ำกว่า 50% จะทำดาเมจเพิ่มขึ้นอีก 1 หน่วย จากนั้นใช้เทิร์นโจมตีปกติทันที',
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
        'ทายาทแห่งนิกซ์สละร่างกายให้อวตารราตรีสิงสู่ สละ HP 2 หน่วย และเข้าสู่สถานะ "สถิตเงา" 3 รอบจากนั้นใช้เทิร์นโจมตีปกติทันที\
        \n\* เมื่ออยู่ในสถานะสถิตเงาซึ่งนับเป็นสถานะเกื้อกูล ทายาทแห่งนิกซ์จะได้รับโบนัสเพิ่มเติม 1 ดาเมจที่ทำได้ต่อ HP ที่หายไปจาก Max HP  3 หน่วยและสามารถสูงสุด 4 หน่วย แต่ทั้งนี้ หาก HP หายไปไม่ครบ 3 หน่วยสิทธิ์ดังกล่าวจากสถานะนี้จะไม่แสดงผล\
        \n\* นอกจากนี้ เมื่อทายาทแห่งนิกซ์สามารถสังหารศัตรูได้ขณะที่ตนเองอยู่ในสถานะสถิตเงา  จะเป็นการต่อระยะเวลาของสถานะสถิตเงาเพิ่มขึ้นไปอีก 1 รอบ',
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
        'ทายาทแห่งนิกซ์สละ HP ของตน 3 หน่วย เพื่อชโลมผืนนภาบนสนามต่อสู้ด้วย "ราตรีนิรันดร์" เป็นระยะเวลา 3 เทิร์น จากนั้นจบเทิร์นทันที\
        ซึ่งขณะที่สนามต่อสู้ถูกชโลมด้วยราตรีนิรันดร์ เมื่อตัวละครบนสนามเริ่มต้นเทิร์น ลด HP ของเป้าหมายทันที 1 หน่วย และมีผลพิเศษอื่นที่ต่างกันไปแล้วแต่ตัวละคร ดังนี้\
        \n\* ทายาทแห่งนิกซ์: หากทอยเต๋าป้องกันไม่สำเร็จจะหลบหลีกการโจมตีที่เข้ามา โดยแสดงผลได้ 2 ครั้งต่อราตรีนิรันดร์ 1 ครั้ง และเมื่อราตรีนิรันดร์จบลง ฟื้นฟู HP ตนเอง 3 หน่วยรวมถึงคืนแต้มสกิล 1 หน่วย\
        \n\* พันธิมตรร่วมทีม : เพิ่มแต้มเต๋าป้องกัน 3 หน่วย\
        \n\* ศัตรู : ดาเมจที่ทำได้จะลดลง 2 หน่วย\
         \nทั้งนี้ ราตรีนิรันดร์นับเป็นสถานะผิดปกติที่ส่งผลกับทุกตัวละครบนสนามต่อสู้ อย่างไรก็ตาม เมื่อร่าย "Everlasting Night" ในขณะที่ยังไม่อยู่ในสถานะ "สถิตเงา" จะเป็นการร่าย "Nightshade Requiem" ทันทีโดยไม่เสียแต้มสกิล',
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
        'เมื่อในทีมมีพันธมิตรที่ครอบครองโล่ใด ๆ อย่างน้อย 1 คน ทายาทแห่งฮีเมราจะทอแสงชี้นำพันธมิตรทุกเป้าหมาย\
        มอบโบนัสแต้มเต๋าทุกประเภท 1 แต้มให้กับพันธมิตรในทีมทุกคน และหากโล่นั้นเป็นโล่แห่งแสง พันธมิตรในทีมทุกคนจะโจมตีแรงขึ้นอีก 1 หน่วย',
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
        'ทายาทแห่งฮีเมราห่อหุ้มร่างกายของตนเองหรือพันธมิตร 1 คนด้วย "อาภรณ์แห่งแสง"\
        โดยมอบโล่ให้กับเป้าหมาย 1 หน่วย โดยโล่นั้นจะมี HP เท่ากับ 10% ของ Max HP ของทายาทแห่งฮีเมรา\
        โดยโล่นี้คงอยู่จนกว่าจะถูกทำลายและสามารถร่ายทับซ้อนได้สูงสุด 5 หน่วยต่อผู้เล่น 1 คนจากนั้นจบเทิร์น',
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
        'ทายาทแห่งฮีเมราหักเหไรแสงสร้างเป็นภาพมายา มอบสถานะ "ลวงตา" ให้กับตนเองและพันธมิตรอีก 1 คนเป็นระยะเวลา 2 รอบจากนั้นจบเทิร์น\
        \n\* ผู้อยู่ในสถานะลวงตาจะปฏิเสธสถานะผิดปกติที่ได้รับมาเสมอ ซึ่งสถานะลวงตานับเป็นสถานะเกื้อกูล\
        \n\* เมื่อสถานะลวงตาหมดลงจะมอบโล่ให้กับทั้งคู่ 1 หน่วย โดยโล่นี้คงอยู่จนกว่าจะถูกทำลายและสามารถร่ายทับซ้อนได้สูงสุด 5 หน่วยต่อผู้เล่น 1 คน',
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
        '\* ทายาทแห่งฮีเมราทอแสงเรืองรองเพื่อเปลี่ยนโล่ในสนามทั้งหมดที่ฝ่ายพันธมิตรให้กลายเป็น "โล่แห่งแสง" ซึ่งนับเป็นสถานะเกื้อกูล\
        โดยจะทำการรีเซท ระยะเวลาคงอยู่ของโล่ทั้งหมดที่เปลี่ยนมาเป็นโล่แห่งแสงและกำหนดให้โล่แห่งแสงบนสนามมีระยะเวลาคงเหลือ 2 รอบ จากนั้นจบเทิร์น\
        \n\* ผู้ที่ครอบครองโล่แห่งแสงจะได้รับแต้มบวกเต๋าโจมตี 3 หน่วยและเมื่อโล่แห่งแสงหมดเวลาหรือถูกทำลายลง โล่แห่งแสงจะระเบิดแผดเผาทำดาเมจ 1 หน่วยให้กับศัตรูทุกคนบนสนาม\
        และฟื้นฟู HP 2 หน่วยให้กับพันธมิตรที่ครอบครองโล่แห่งแสงที่พึ่งหมดเวลาไป',
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
        'ทายาทแห่งแอมฟิไทรท์เริ่มการต่อสู้มาพร้อมกับ "อวตารสมุทร" 1 ตนซึ่งจะคงอยู่เป็นระยะเวลา 3 รอบ โดยอวตารสมุทรตัวแรกนี้จะสถิตอยู่กับทายาทแห่งแอมฟิไทรทีก่อนเสมอ\
        \n\* อวตารสมุทร : เสริมแต้มเต๋าทุกประเภท 2 แต้มและเพิ่มโอกาสติดคริติคอล 25% ให้กับเป้าหมายที่สถิตอยู่ด้วยและเมื่อเป้าหมายที่สถิตอยู่ด้วยทำการโจมตีสำเร็จ อวตารสมุทรจะช่วยโจมตีด้วย ทำดาเมจ 1 หน่วย\
        \n\* เมื่ออวตารสมุทรสลายไปตามระยะเวลาคงอยู่ ฟื้นฟู HP ให้กับเป้าหมายที่เคยสถิตอยู่ 3 หน่วย อวตารสมุทรจึงนับเป็นสถานะเกื้อกูล\
        \n\* บนสนามสามารถมีอวตารสมุทรได้สูงสุด 2 ตนในเวลาเดียวกัน\
        \n\* สถิต คือ อวตารสมุทรยืนเคียงข้างผู้เล่น เพื่อทำให้ผลของอวตารสมุทรแสดงผลกับผู้เล่นที่สถิตอยู่ด้วย',
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
        'ทายาทแห่งแอมฟิไทรท์เรียกสายธารไหลวนผ่านฝ่ามือ เยียวยาร่างกายของพัตนเองหรือพันธมิตร 1 เป้าหมาย\
        โดยฟื้นฟู HP 2 หน่วยและทำการย้าย "อวตารสมุทร" ทั้งหมดบนสนามให้ไปสถิตกับเป้าหมายนั้นที่ได้รับการรักษาจากนั้นใช้เทิร์นโจมตีปกติทันที',
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
        'ทายาทแห่งแอมฟิไทรท์ควบรวมมวลนทีสงัดให้คุกรุ่นก่อร่างสร้างตัวตนเป็น "อวตารสมุทร" ขึ้นบนสนาม 1 ตนและเลือกให้สถิตอยู่กับตนเองหรือพันธมิตร 1 เป้าหมายจากนั้นใช้เทิร์นโจมตีปกติทันที',
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
        'ทายาทแห่งแอมฟิไทรท์สร้าง "อวตารสมุทร" ขึ้นบนสนาม 1 ตนทันที โดยอวตารสมุทรจะสถิตอยู่กับทายาทแห่งแอมฟิไทรทีก่อน\
        จากนั้นปลุกพลังแห่งท้องทะเล เพื่อเข้าสู่สถานะ "เกลียวคลื่นสั่นพ้อง" เป็นเวลา 2 รอบ จากนั้นจบเทิร์น\
        \n\* เมื่อทายาทแห่งแอมฟิไทรท์อยู่ในสถานะเกลียวคลื่นสั่นพ้อง อวตารสมุทรทุกตนบนสนามจะหยุดการนับระยะเวลาคงอยู่ลง\
        \n\* เมื่อทายาทแห่งแอมฟิไทรท์อยู่ในสถานะเกลียวคลื่นสั่นพ้อง ดาเมจเสริมจากอวตารสมุทรจะเพิ่มขึ้นจาก 1 หน่วยเป็น 2 หน่วย',
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
