import type { PowerDefinition } from '../types/power';

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
  Zeus: [
    {
      deity: 'Zeus',
      type: 'Passive',
      name: 'Lightning Reflex',
      description:
        'เมื่อโจมตีศัตรูสำเร็จ จะติดช็อตทิ้งเอาไว้และมันจะไม่หายไป หากศัตรูที่มีช็อตอยู่ได้รับช็อตซ้ำอีกครั้ง จะได้รับดาเมจเพิ่มเติม 100% ของดาเมจโจมตีปกติ และลบล้างช็อตทั้งหมดบนตัวเป้าหมายออก',
      available: true,
      effect: 'dot',
      target: 'enemy',
      value: 0,
      duration: 999,
    },
    {
      deity: 'Zeus',
      type: '1st Skill',
      name: 'Beyond the Cloud',
      description:
        'สำหรับเทิร์นปัจจุบันจะยังคงโจมตีได้ตามปกติ และจะมอบความเร็ว 2 หน่วย เป็นเวลา 2 นับตั้งแต่เทิร์นถัดไป รวมถึงจะเพิ่มโอกาสการใช้คริติคอลสำเร็จอีก 25% ให้กับตนเองเพื่อใช้พลังคริติคอลนั้นในเทิร์นถัดไปเช่นกัน',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 2,
      duration: 2,
      modStat: 'speed',
      effects: [
        { effect: 'buff', target: 'self', value: 2, duration: 2, modStat: 'speed' },
        { effect: 'buff', target: 'self', value: 25, duration: 2, modStat: 'criticalRate' },
      ],
    },
    {
      deity: 'Zeus',
      type: '2nd Skill',
      name: 'Jolt Arc',
      description:
        'ทำการระเบิดช็อตที่อยู่บนตัวศัตรูทุกเป้าหมายให้ทำดาเมจทันที',
      available: true,
      effect: 'damage',
      target: 'enemy',
      value: 0,
      duration: 0,
      skipDice: true,
      requiresTargetHasEffect: 'shock',
    },
    {
      deity: 'Zeus',
      type: 'Ultimate',
      name: 'Thunderbolt',
      description:
        'เรียกอัสนีบาตผ่าศัตรู 1 ตัว ทำดาเมจ 3 หน่วยทันที โดยไม่ต้องทอยเต๋า และมีโอกาส 50% ชิ่งไปโดนศัตรูตัวอื่นรอบข้าง ทำดาเมจ 1 หน่วย',
      available: true,
      effect: 'damage',
      target: 'enemy',
      value: 3,
      duration: 0,
      skipDice: true,
    },
  ],

  /* ────────────────────────── Poseidon ────────────────────── */
  Poseidon: [
    {
      deity: 'Poseidon',
      type: 'Passive',
      name: 'Ocean Blessing',
      description:
        'ทุกครั้งที่ใช้สกิล จะรักษาตนเองโดยฟื้นฟู HP 1 หน่วย',
      available: true,
      effect: 'heal',
      target: 'self',
      value: 1,
      duration: 999,
    },
    {
      deity: 'Poseidon',
      type: '1st Skill',
      name: 'Aqua Prison',
      description:
        'ใช้น้ำพันธนาการศัตรู 1 ตัว ในเทิร์นต่อไปของเป้าหมายใช้สกิลไม่ได้',
      available: true,
      effect: 'stun',
      target: 'enemy',
      value: 0,
      duration: 1,
    },
    {
      deity: 'Poseidon',
      type: '2nd Skill',
      name: 'Whirlpool Splash',
      description:
        'ยิงกระสุนน้ำวนใส่ศัตรู 1 ตัว +2 แต้มเต๋าโจมตีให้กับตนเอง จากนั้นทอยโจมตีตามปกติ เมื่อโจมตีสำเร็จศัตรูจะเสียแต้มสกิล 2 แต้ม',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 2,
      duration: 0,
      modStat: 'attackDiceUp',
    },
    {
      deity: 'Poseidon',
      type: 'Ultimate',
      name: 'Gigantic Wave',
      description:
        'สร้างคลื่นยักษ์โจมตีศัตรูทุกตัว สร้างความเสียหาย 2 หน่วย และ -2 แต้มเต๋าทุกประเภทของศัตรูเป็นเวลา 2 รอบ',
      available: true,
      effect: 'damage',
      target: 'enemy',
      value: 2,
      duration: 0,
    },
  ],

  /* ────────────────────────── Demeter ────────────────────── */
  Demeter: [
    {
      deity: 'Demeter',
      type: 'Passive',
      name: 'Sustainability',
      description:
        'เมื่อใช้สกิล ทอยเต๋า d4 หากทอยได้ 4 จะได้รับแต้มสกิลคืน 1 หน่วย',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 1,
      duration: 999,
    },
    {
      deity: 'Demeter',
      type: '1st Skill',
      name: 'Rooting',
      description:
        'เสกรากไม้รัดศัตรู 1 ตัว ทำให้ถูกข้ามเทิร์นในรอบนั้น',
      available: true,
      effect: 'stun',
      target: 'enemy',
      value: 0,
      duration: 1,
    },
    {
      deity: 'Demeter',
      type: '2nd Skill',
      name: 'Living Vine',
      description:
        'เสกเถาวัลย์ขึ้นบนสนาม 1 เส้น เมื่อเราโจมตี เถาวัลย์จะทำดาเมจเพิ่ม 1 หน่วย และเมื่อเราโดนโจมตี เถาวัลย์จะรับดาเมจแทนและหายไปทันที โดยบนสนามมีเถาวัลย์ได้มากสุด 2 เส้นในเวลาเดียวกัน',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 1,
      duration: 999,
      modStat: 'damage',
    },
    {
      deity: 'Demeter',
      type: 'Ultimate',
      name: 'Wild Bloom',
      description:
        'ใช้สกิลแบบเสริมพลัง / * Rooting: เลือกเป้าหมายเพิ่มได้เป็น 2 ตัว / * Living Vine: เถาวัลย์จะรับดาเมจแทนได้อีก 1 ครั้ง และเมื่อร่ายแล้ว แสดงผลกับเถาวัลย์ที่มีอยู่แล้วบนสนามด้วยเช่นกัน',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 0,
      duration: 0,
    },
  ],

  /* ────────────────────────── Ares ────────────────────────── */
  Ares: [
    {
      deity: 'Ares',
      type: 'Passive',
      name: 'Bloodlust',
      description:
        '/ * เมื่อโจมตีศัตรูที่มี HP มากกว่าตนเอง จะตีแรงขึ้น 1 หน่วย / * เมื่อโจมตีศัตรูที่มี HP น้อยกว่าตนเอง จะ +2 แต้มเต๋าโจมตี',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 1,
      duration: 999,
      modStat: 'damage',
    },
    {
      deity: 'Ares',
      type: '1st Skill',
      name: 'War Cry',
      description:
        'มอบความโกรธเกรี้ยวให้กับตนเองและเพื่อน 1 คน ทำให้การโจมตีครั้งถัดไปจะทำดาเมจแรงขึ้น 1 หน่วย จากนั้นใช้เทิร์นโจมตีปกติทันที',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 1,
      duration: 0,
      modStat: 'damage',
    },
    {
      deity: 'Ares',
      type: '2nd Skill',
      name: 'Weapon Cursing',
      description:
        'แต้มเต๋า +3 โจมตีให้กับตนเอง 3 รอบ จากนั้นใช้เทิร์นโจมตีปกติทันที',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 3,
      duration: 3,
      modStat: 'attackDiceUp',
    },
    {
      deity: 'Ares',
      type: 'Ultimate',
      name: 'Insanity',
      description:
        'สาปอาวุธของศัตรู 1 คน ทำให้การโจมตีครั้งถัดไปไม่ว่าจากโจมตีปกติ สกิล หรืออัลติเมท การโจมตีนั้นจะไม่สามารถสร้างความเสียหายได้',
      available: true,
      effect: 'debuff',
      target: 'enemy',
      value: 0,
      duration: 1,
    },
  ],

  /* ────────────────────────── Athena ────────────────────────── */
  Athena: [
    {
      deity: 'Athena',
      type: 'Passive',
      name: 'Intelligence',
      description:
        'เมื่อโจมตีหรือป้องกันสำเร็จ แต้มเต๋าประเภทนั้น ๆ จะ +1 ทับซ้อนได้ถึง +3 และเมื่อโจมตีหรือป้องกันไม่สำเร็จ แต้มที่เพิ่มมาจะหายไป',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 1,
      duration: 999,
      modStat: 'attackDiceUp',
    },
    {
      deity: 'Athena',
      type: '1st Skill',
      name: 'Wise Tactic',
      description:
        'ทำให้แต้มเต๋าที่ศัตรูทอยไปเป็นโมฆะ แล้วสั่งทอยใหม่ (สามารถใช้สกิลนี้ได้เมื่อศัตรูทอยเต๋าไปแล้วเท่านั้น แทรกเทิร์นใช้ได้ตลอด)',
      available: true,
      effect: 'debuff',
      target: 'enemy',
      value: 0,
      duration: 0,
    },
    {
      deity: 'Athena',
      type: '2nd Skill',
      name: 'Parry',
      description:
        'ปลดอาวุธของศัตรู ทำให้ศัตรูไม่ได้รับโบนัสและเอฟเฟคของอุปกรณ์สวมใส่หรือไอเทมประเภทโพชั่นเป็นเวลา 2 รอบ',
      available: true,
      effect: 'debuff',
      target: 'enemy',
      value: 0,
      duration: 2,
    },
    {
      deity: 'Athena',
      type: 'Ultimate',
      name: 'Disarm',
      description:
        'ทำ +2 แต้มเต๋าป้องกันและ +1 ดาเมจให้กับทุกคนในทีม เป็นเวลา 3 รอบ',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 2,
      duration: 3,
      modStat: 'defendDiceUp',
    },
  ],

  /* ────────────────────────── Apollo ────────────────────────── */
  Apollo: [
    {
      deity: 'Apollo',
      type: 'Passive',
      name: 'Child of the Sun',
      description:
        'เมื่อสร้างหรือได้รับการรักษา +1 แต้มเต๋าทุกประเภทถาวร (สูงสุด +3)',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 1,
      duration: 999,
    },
    {
      deity: 'Apollo',
      type: '1st Skill',
      name: 'Healing Hymn',
      description:
        'ขับขานบทเพลงรักษาให้กับเพื่อน 1 คน ฟื้นฟู HP 2 หน่วย หากตนเอง HP ลดอยู่ ตนเองก็จะฟื้นฟู HP ด้วย 2 หน่วยเช่นกัน และมอบอัตราคริคิคอลให้กับทั้งคู่อีก 25% เป็นเวลา 2 รอบ',
      available: true,
      effect: 'heal',
      target: 'self',
      value: 2,
      duration: 0,
    },
    {
      deity: 'Apollo',
      type: '2nd Skill',
      name: 'Archery Master',
      description:
        'เพิ่มความแม่นยำให้กับตนเอง +4 แต้มเต๋าโจมตี เป็นเวลา 2 รอบ จากนั้นทำการโจมตีปกติทันที',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 4,
      duration: 2,
      modStat: 'attackDiceUp',
    },
    {
      deity: 'Apollo',
      type: 'Ultimate',
      name: 'Volley Arrow',
      description:
        'เข้าสถานะ "กระหน่ำยิง" 3 รอบ โดยเมื่อทอยเต๋าโจมตีปกติสำเร็จ จะมีโอกาส 50% ที่จะโจมตีเสริม 1 ครั้ง การตีเสริมจะทำดาเมจ 50% ของการโจมตีกติ ซึ่งจะสามารถเกิดโจมตีเสริมได้ 2 ครั้งใน 1 การโจมตีปกติ',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 0,
      duration: 3,
    },
  ],

  /* ────────────────────────── Hephaestus ────────────────────── */
  Hephaestus: [
    {
      deity: 'Hephaestus',
      type: 'Passive',
      name: 'Iron Skin',
      description:
        'เมื่อสร้างอุปกรณ์ใด ๆ +1 แต้มเต๋าป้องถาวรให้กับตนเอง (สูงสุด +3)',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 1,
      duration: 999,
      modStat: 'defendDiceUp',
    },
    {
      deity: 'Hephaestus',
      type: '1st Skill',
      name: 'The Blacksmith',
      description:
        'ตีบวกชุดเกราะให้ตนเองหรือเพื่อน 1 คน +3 แต้มเต๋าทุกประเภท (3 รอบ) หากโจมตี/ป้องกันไม่สำเร็จ ชุดเกราะจะถูกทำลายหายไปทันที',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 3,
      duration: 3,
    },
    {
      deity: 'Hephaestus',
      type: '2nd Skill',
      name: 'Overheat',
      description:
        'สร้างเกราะมือเหล็ก ให้ตนเองหรือเพื่อน 1 คนใส่ (2 รอบ) โดยจะเปลี่ยนแต้มบวกเต๋าป้องกันที่มีทั้งหมดเป็นแต้มบวกเต๋าโจมตี และการโจมตีครั้งถัดไปทำดาเมจแรงขึ้น 100% จากนั้นใช้เทิร์นโจมตีปกติทันที',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 0,
      duration: 2,
      modStat: 'attackDiceUp',
    },
    {
      deity: 'Hephaestus',
      type: 'Ultimate',
      name: 'Protective Aegis',
      description:
        'สร้างโล่สัมฤทธิ์ขึ้นปกป้องทั้งทีม ป้องกันดาเมจได้ 5 หน่วย ศัตรูจะถูกบังคับเล็งไปที่โล่สัมฤทธิ์ก่อนเสมอ โดยผู้ใช้สกิลจะเป็นคนทอยป้องการโจมตีที่เข้ามาและโล่สัมฤทธิ์จะไม่หายไปจนกว่าจะถูกทำลาย',
      available: true,
      effect: 'shield',
      target: 'self',
      value: 5,
      duration: 999,
    },
  ],

  /* ────────────────────────── Aphrodite ────────────────────── */
  Aphrodite: [
    {
      deity: 'Aphrodite',
      type: 'Passive',
      name: 'In the Name of Love',
      description:
        'เมื่อทอยป้องกันไม่สำเร็จจะสามารถเลือกไม่รับดาเมจได้ โดยพื้นฐานจะมีโควต้าในการเลือกไม่รับดาเมจเริ่มต้น 0 ครั้ง และจะได้รับโควต้าเพิ่ม 1 ครั้ง เมื่อทอยป้องกันสำเร็จ (สะสมโควต้าได้สูงสุด 1 ครั้ง)',
      available: true,
      effect: 'shield',
      target: 'self',
      value: 0,
      duration: 999,
    },
    {
      deity: 'Aphrodite',
      type: '1st Skill',
      name: 'Fashion Queen',
      description:
        'เปลี่ยนลุคของตนเองและเพื่อน 1 คน เสริมความมั่นใจ +1 เต๋าทุกประเภท เป็นเวลา 3 รอบ',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 1,
      duration: 3,
    },
    {
      deity: 'Aphrodite',
      type: '2nd Skill',
      name: 'Overfit Outfit',
      description:
        'ใช้พลังทำให้เสื้อผ้าของศัตรู 1 คนคับลง ลดความเร็วถาวร 1 หน่วย และ -2 เต๋าทุกประเภท เป็นเวลา 2 รอบ',
      available: true,
      effect: 'debuff',
      target: 'enemy',
      value: 2,
      duration: 2,
    },
    {
      deity: 'Aphrodite',
      type: 'Ultimate',
      name: 'Charmspeak',
      description:
        'ใช้มนตร์มหาเสน่ห์ใส่ศัตรู 1 เป้าหมายทำให้หลงใหล ใช้ได้ 2 แบบ / * ในเทิร์นที่เราเป็นฝ่ายป้องกัน: เมื่อศัตรูทอยเต๋าโจมตีได้มากกว่าหรือเท่ากับ 10 หน่วยและโจมตีสำเร็จ ดาเมจจะย้อนเข้าตัวศัตรูเอง / * ในเทิร์นที่เราเป็นฝ่ายโจมตี: เมื่อศัตรูทอยเต๋าป้องกันได้มากกว่าหรือเท่ากับ 10 หน่วย การป้องกันจะเป็นโมฆะ และได้รับดาเมจ 100%',
      available: true,
      effect: 'reflect',
      target: 'enemy',
      value: 0,
      duration: 0,
    },
  ],

  /* ────────────────────────── Hermes ────────────────────────── */
  Hermes: [
    {
      deity: 'Hermes',
      type: 'Passive',
      name: 'Always Faster',
      description:
        'ได้รับ +1 แต้มเต๋าทุกประเภทต่อความเร็ว 3 หน่วยที่มากกว่าศัตรู หากศัตรูมีหลายตัวจะรับจากศัตรูตัวที่ความเร็วต่ำที่สุดเสมอ และเริ่มการต่อสู้พร้อมกับโควต้าทอยเต๋าใหม่ 2 ครั้ง',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 1,
      duration: 999,
    },
    {
      deity: 'Hermes',
      type: '1st Skill',
      name: 'Opportunity',
      description:
        'มอบโอกาสทอยเต๋าใหม่ 1 ครั้งและเพิ่มความเร็ว 1 หน่วยถาวรให้กับตนเองหรือเพื่อน 1 คน จากนั้นใช้เทิร์นโจมตีปกติทันที',
      available: true,
      effect: 'reroll_grant',
      target: 'self',
      value: 1,
      duration: 0,
    },
    {
      deity: 'Hermes',
      type: '2nd Skill',
      name: 'Rush Moment',
      description:
        'มอบเทิร์นเสริมให้กับตนเองหรือเพื่อน 1 คนให้ได้รับเทิร์นพิเศษต่อจากเขาทันที โดยเทิร์นเสริมที่ได้รับมานี้จะไม่นับอยู่ในตารางเทิร์นและจะไม่ลดจำนวนรอบของบัพหรือดีบัพต่างๆ จากนั้นใช้เทิร์นโจมตีปกติทันที',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 0,
      duration: 0,
    },
    {
      deity: 'Hermes',
      type: 'Ultimate',
      name: 'Time to be Thief',
      description:
        'ขโมยแต้มสกิลทั้งหมดของศัตรู 1 ตัว โดยทอยเต๋า d4 แสดงผลดังนี้ / * 1 แต้ม : ขโมยไม่สำเร็จ ไม่ได้รับแต้มสกิล และศัตรูไม่เสียแต้ม / * 2-3 แต้ม : ศัตรูถูกขโมยแต้มสกิล 1 แต้ม เพิ่มให้กับผู้ร่าย / * 4 แต้ม : ศัตรูถูกขโมยแต้มสกิลทั้งหมด เพิ่มให้กับผู้ร่าย หากเป้าหมายไม่หลงเหลือแต้มสกิลให้ขโมย จะได้รับแต้มสกิลคืน',
      available: true,
      effect: 'debuff',
      target: 'enemy',
      value: 0,
      duration: 0,
    },
  ],

  /* ────────────────────────── Dionysus ────────────────────── */
  Dionysus: [
    {
      deity: 'Dionysus',
      type: 'Passive',
      name: 'Uncontrollable',
      description:
        'เมื่อได้รับแต้มบวกหรือลบเต๋าโจมตี จะบวกหรือลบเต๋าป้องกันเช่นกัน เมื่อได้รับแต้มบวกหรือลบเต๋าป้องกัน จะบวกหรือลบเต๋าโจมตีเช่นกัน',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 0,
      duration: 999,
    },
    {
      deity: 'Dionysus',
      type: '1st Skill',
      name: 'Grape Juice Potion',
      description:
        'มอบโพชั่นน้ำองุ่นให้กับเพื่อน 1 คนหรือกินเอง ฟื้นฟู HP 2 หน่วย จากนั้นทอยโจมตีตามปกติ',
      available: true,
      effect: 'heal',
      target: 'self',
      value: 2,
      duration: 0,
    },
    {
      deity: 'Dionysus',
      type: '2nd Skill',
      name: 'Into the Madness',
      description:
        'ทำให้ศัตรูคุ้มคลั่ง เป็นเวลา 2 รอบ ส่งผลให้ในเทิร์นโจมตีของศัตรูที่คุ้มคลั่งจะไม่สามารถเลือกเป้าหมายในการแอคชั่นได้ โดยเมื่อใช้แอคชั่นใด ๆ มันจะแสดงผลกับเป้าหมายแบบสุ่ม / * ในการต่อสู่ 1-1 จะเปลี่ยนการแสดงผลเป็น ในเทิร์นโจมตีของศัตรูที่คุ้มคลั่งจะไม่สามารถเลือกแอคชั่นที่จะใช้ได้ จะใช้แอคชั่นแบบสุ่ม',
      available: true,
      effect: 'debuff',
      target: 'enemy',
      value: 0,
      duration: 2,
    },
    {
      deity: 'Dionysus',
      type: 'Ultimate',
      name: 'Pacify to Peace',
      description:
        'ทำให้ตนเองและเพื่อนทุกคนให้สงบลง โดยลบล้างสถานะผิดปกติที่ส่งผลด้านลบและแต้มลบเต๋าทั้งหมดที่มีทิ้งไป',
      available: true,
      effect: 'cleanse',
      target: 'self',
      value: 0,
      duration: 0,
    },
  ],

  /* ────────────────────────── Hades ────────────────────────── */
  Hades: [
    {
      deity: 'Hades',
      type: 'Passive',
      name: 'Death Keeper',
      description:
        'เริ่มการต่อสู้มาพร้อมกับสถานะ "ผู้รั้งความตาย" ซึ่งเมื่อมีการตายเกิดขึ้นภายในทีม ในเทิร์นโจมตีของตนเอง ผู้รั้งความตายจะได้รับแอคชันพิเศษเพื่อร่ายการชุบชีวิตโดยไม่เสียเทิร์น ผู้ที่ถูกชุบขึ้นมาจะฟื้นฟู HP ขึ้นมา 50% จาก Max HP ของผู้ถูกชุบชีวิต สถานะนี้สามารถใช้ชุบตัวเองได้หากตัวเองตาย โดยสถานะนี้ไม่สามารถลบล้างได้และจะสามารถชุบชีวิตได้เพียงครั้งเดียวในการต่อสู้หนึ่งครั้งเท่านั้น',
      available: true,
      effect: 'heal',
      target: 'ally',
      skipDice: true,
      value: 0,
      duration: 999,
    },
    {
      deity: 'Hades',
      type: '1st Skill',
      name: 'Shadow Camouflaging',
      description:
        'เข้าสู่สถานะ "เงาพรางตัว" เป็นเวลา 2 รอบ นั่นคือ ไม่ตกเป็นเป้าหมายของแอคชั่นใดๆ ยกเว้นในการโจมตีหมู่อันหมายถึงทุกคนในทีมตกเป็นเป้าหมายของศัตรู',
      available: true,
      effect: 'lifesteal',
      target: 'enemy',
      value: 1,
      duration: 0,
      skipDice: true,
    },
    {
      deity: 'Hades',
      type: '2nd Skill',
      name: 'Undead Army',
      description:
        'เรียกโครงกระดูก 1 ตัวขึ้นบนสนามโดยเมื่อเราโจมตี โครงกระดูกจะตีสมทบ ทำดาเมจ 50% ของดาเมจโจมตีปกติของผู้ร่าย และหากผู้ร่ายโดนโจมตี โครงกระดูกจะเข้ารับดาเมจแทนทั้งหมด จากนั้นจะหายไปทันที ทั้งนี้  ดาเมจสมทบจากโครงกระดูกติดคริติคอลได้ โดยนับการโจมตีหลักของผู้ร่ายว่าติดคริติคอลหรือไม่ ซึ่งโครงกระดูกนับเป็นยูนิตพิเศษ อย่างไรก็ตาม  บนสนามสามารถมีโครงกระดูกได้มากสุด 2 ตัวในเวลาเดียวกันเท่านั้น',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 1,
      duration: 999,
      modStat: 'damage',
    },
    {
      deity: 'Hades',
      type: 'Ultimate',
      name: 'Soul Eater',
      skipDice: true,
      description:
        '/ * เข้าสถานะ "ผู้กลืนวิญญาณ" เป็นเวลา 3 รอบ โดยการโจมตีปกติ ไม่ว่าจะทอยโจมตีสำเร็จหรือไม่สำเร็จก็ตาม จะดูดกลืน HP ของศัตรูอย่างแน่นอนแน่นอน 1 หน่วย และนำมาฟื้นฟู HP ให้กับตนเอง โดยจะไม่สามารถป้องกันได้และนับเป็นการโจมตี  ซึ่งโครงกระดูกช่วยตีได้ / * เมื่อร่าย "Soul Eater" เป็นการจะร่าย "Undead Army" โดยทันทีและเมื่อใช้พลังแล้วจะยังสามารถโจมตีตามปกติได้ในเทิร์นเดียวกันนั้นอีกด้วย',
      available: true,
      effect: 'lifesteal',
      target: 'enemy',
      value: 1,
      duration: 3,
    },
  ],

  /* ────────────────────────── Hypnos ────────────────────────── */
  Hypnos: [
    {
      deity: 'Hypnos',
      type: 'Passive',
      name: 'Cozy Vibe',
      description:
        'หากมีความเร็วต่ำกว่าผู้ที่โจมตีเข้ามาหา จะได้รับดาเมจลดลง 1 หน่วย',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 1,
      duration: 999,
    },
    {
      deity: 'Hypnos',
      type: '1st Skill',
      name: 'Sleepy Head',
      description:
        'ทำให้ศัตรู 1 คนง่วงงุน ทำให้ถูกข้ามเทิร์นในรอบนั้น',
      available: true,
      effect: 'stun',
      target: 'enemy',
      value: 0,
      duration: 1,
    },
    {
      deity: 'Hypnos',
      type: '2nd Skill',
      name: 'Memory Alteration',
      description:
        'ดัดแปลงความทรงจำของศัตรู 1 เป้าหมาย เป็นเวลา 3 รอบ ทำให้หลงลืมและไม่มีสติ โดยแต้มบวกเต๋าทั้งหมดของศัตรูจะไม่แสดงผล และลดหน้าเต๋าสูงสุดที่ศัตรูใช้ทอยลงเป็น d10 แทน',
      available: true,
      effect: 'debuff',
      target: 'enemy',
      value: 0,
      duration: 3,
    },
    {
      deity: 'Hypnos',
      type: 'Ultimate',
      name: 'Sweet Dream',
      description:
        'มอบฝันดีให้กับตนเองหรือเพื่อน 1 คน โดยลดความเร็วของตนเองและเพื่อนลงถาวร 2 หน่วยและฟื้นฟู HP ให้กับเป้าหมาย 5 หน่วย',
      available: true,
      effect: 'heal',
      target: 'self',
      value: 5,
      duration: 0,
    },
  ],

  /* ────────────────────────── Nemesis ────────────────────────── */
  Nemesis: [
    {
      deity: 'Nemesis',
      type: 'Passive',
      name: 'Repay',
      description:
        'หากป้องกันสำเร็จจะโจมตีสวนกลับทันที ทำดาเมจ 50% ของการโจมตีปกติ (ป้องกันไม่ได้) และเมื่อถูกโจมตี +3 แต้มเต๋าป้องกันครั้งถัดไป',
      available: true,
      effect: 'reflect',
      target: 'self',
      value: 50,
      duration: 999,
    },
    {
      deity: 'Nemesis',
      type: '1st Skill',
      name: 'Sweetest Vengeance',
      description:
        'เข้าสู่สถานะ "อาฆาต" 3 รอบ ในสถานะนี้ เมื่อผู้ร่ายถูกโจมตี จะเพ่งเล็งศัตรูที่โจมตีเธอเอาไว้ เมื่อผู้ร่ายโจมตีศัตรูที่เพ่งเล็งไว้จะทำดาเมจเพิ่มขึ้น 100% และมีโอกาสติดคริติคอล 25%',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 0,
      duration: 3,
      modStat: 'damage',
    },
    {
      deity: 'Nemesis',
      type: '2nd Skill',
      name: 'Pursue a Vendetta',
      description:
        'มอบความพยาบาทให้กับเพื่อน 1 คนเป็นเวลา 2 รอบ โดยเพื่อนคนดังกล่าวจะสามารถใช้และแสดงผลของสกิล Repay ได้ / * หากร่ายใส่ตนเอง ดาเมจตีสวนจะเพิ่มขึ้นเป็น 100%',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 0,
      duration: 2,
    },
    {
      deity: 'Nemesis',
      type: 'Ultimate',
      name: 'Justice to All',
      description:
        'คัดลอกสถานะผิดปกติที่ส่งผลด้านลบและแต้มลบเต๋าทั้งหมดที่ตัวเองมี จากนั้นลบมันทิ้งไปจากตนเอง และมอบสถานนะทั้งหมดที่คัดลอกไว้ให้กับศัตรู 1 เป้าหมายในระยะเวลาคงเหลือที่เท่ากัน',
      available: true,
      effect: 'debuff',
      target: 'enemy',
      value: 0,
      duration: 0,
    },
  ],

  /* ────────────────────────── Hecate ────────────────────────── */
  Hecate: [
    {
      deity: 'Hecate',
      type: 'Passive',
      name: 'Cost of the Cast',
      description:
        'เมื่อศัตรูคนใดร่ายสกิล ทอยเต๋า d4 โดยแสดงผลดังนี้ / * 1-2 แต้ม : ไม่เกิดอะไรขึ้น / * 3-4 แต้ม : ได้รับแต้มสกิล 1 แต้ม',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 1,
      duration: 999,
    },
    {
      deity: 'Hecate',
      type: '1st Skill',
      name: 'Black Magic',
      description:
        'ร่ายมนตร์มืดใส่ศัตรู 1 คนเป็นเวลา 2 รอบ ทำให้เมื่อศัตรูร่ายสกิลจะใช้แต้มสกิลเพิ่มขึ้นเป็น 2 เท่า รวมถึงสกิล Ultimate ด้วย',
      available: true,
      effect: 'debuff',
      target: 'enemy',
      value: 0,
      duration: 2,
    },
    {
      deity: 'Hecate',
      type: '2nd Skill',
      name: 'Spell Incantation',
      description:
        'ร่าย 1 ในมนตร์ที่เคยเล่าเรียนมา และสามารถใช้แต้มสกิลเพิ่ม 1 แต้มเสริมเพิ่มพลังให้กับแต่ละมนตร์ตามเงื่อนไข / * ร่ายเวทย์ไฟโจมตีศัตรู 1 ตัว ทำดาเมจ 2 หน่วย (ทอยเต๋าโจมตีปกติ) / * เสริมเพิ่มพลัง: เวทย์ไฟจะทำดาเมจเพิ่มเป็น 4 หน่วย / * ร่ายเวทย์ป้องกัน ได้รับโล่ 2 หน่วย เป็นเวลา 2 รอบ / * เสริมเพิ่มพลัง: เวทย์ป้องกันจะเพิ่มโล่ขึ้นเป็น 3 หน่วย / * ร่ายเวทย์ชำระล้าง ลบล้างสถานะผิดปกติที่ส่งผลด้านลบ 1 อย่างหรือแต้มลบเต๋าที่มีทิ้งไป (เลือกได้ว่าจะลบอะไร) เสริมเพิ่มพลังไม่ได้',
      available: true,
      effect: 'damage',
      target: 'enemy',
      value: 2,
      duration: 0,
    },
    {
      deity: 'Hecate',
      type: 'Ultimate',
      name: 'The Mist',
      description:
        'คัดลอกสถานะผิดปกติที่ส่งผลด้านลบและแต้มลบเต๋าทั้งหมดที่ตัวเองมี จากนั้นลบมันทิ้งไปจากตนเอง และมอบสถานนะทั้งหมดที่คัดลอกไว้ให้กับศัตรู 1 เป้าหมายในระยะเวลาคงเหลือที่เท่ากัน',
      available: true,
      effect: 'debuff',
      target: 'enemy',
      value: 0,
      duration: 0,
    },
  ],

  /* ────────────────────────── Persephone ────────────────────── */
  Persephone: [
    {
      deity: 'Persephone',
      type: 'Passive',
      name: 'Secret of Dryad',
      description:
        'ในเทิร์นโจมตี เมื่อได้แต้มจากการทอยเต๋ามากกว่า 10 ร่างกายของทายาทแห่งเพอร์เซโฟนีจะถูกปกคลุมด้วยกลีบดอกไม้โปรยปราบ ส่งผลให้จะไม่รับสถานะผิดปกติจากสกิลอื่น ๆ เป็นระยะเวลา 1 รอบ',
      available: true,
      effect: 'shield',
      target: 'self',
      value: 0,
      duration: 999,
    },
    {
      deity: 'Persephone',
      type: '1st Skill',
      name: 'Floral Fragrance',
      description:
        'ชโลมกลิ่นดอกไม้ให้กับตนเองหรือเพื่อนร่วมทีม 1 คน เพื่อฟื้นฟู HP 2 หน่วยจากนั้นทำการโจมตีตามปกติ',
      available: true,
      effect: 'heal',
      target: 'ally',
      value: 2,
      duration: 0,
      skipDice: true,
    },
    {
      deity: 'Persephone',
      type: '2nd Skill',
      name: 'Ephemeral Season',
      description:
        'เสียสละโอกาสในการโจมตีเพื่อผลัดฤดูกาลในพื้นต่อสู้ให้กลายเป็นฤดูที่ต้องการ 2 รอบ / * ฤดูร้อน : +2 แต้มเต๋าโจมตีให้กับทุกคนในทีมและตัวเอง / * ฤดูใบไม้ร่วง : เพิ่ม HP สูงสุดให้กับทุกคนในทีม +2 / * ฤดูหนาว : +2 แต้มเต๋าป้องกันให้กับทุกคนในทีมและตัวเอง / * ฤดูใบไม้ผลิ : ฮีลทุกคนในทีมและตนเอง 1 หน่วยเมื่อจบเทิร์นของแต่ละคน',
      available: true,
      effect: 'buff',
      target: 'self',
      value: 2,
      duration: 2,
      requiresSeasonSelection: true,
      skipDice: true,
    },
    {
      deity: 'Persephone',
      type: 'Ultimate',
      name: "Pomegranate's Oath",
      description:
        'มอบเมล็ดทับทิมให้กับเพื่อนร่วมทีม 1 คน ทำให้เป้าหมายกลายเป็น "ร่างวิญญาณ" ซึ่งมีโอกาส 50% ที่จะปฏิเสธดาเมจเป็นระยะเวลา 3 รอบ และเมื่อร่างวิญญาณผู้นั้นเป้าหมายโจมตีสำเร็จ ทายาทแห่งเพอร์เซโฟนีจะสามารถทำการโจมตีร่วมด้วยได้ อย่างไรก็ตาม หากไม่มีเพื่อนรวมทีมเหลือในสนามทายาทแห่งเพอร์เซโฟนีถึงจะสามารถมอบเมล็ดทับทิมให้ตัวเองเพื่อกลายเป็นร่างวิญญาณได้เช่นกัน แต่จะไม่สามารถโจมตีร่วมได้',
      available: true,
      effect: 'buff',
      target: 'ally',
      value: 0,
      duration: 3,
      skipDice: true,
    },
  ],
};

/** Synchronous power lookup by deity name (case-insensitive). */
export function getPowers(deity: string): PowerDefinition[] {
  // Try exact match first, then case-insensitive
  if (DEITY_POWERS[deity]) return DEITY_POWERS[deity];
  const key = Object.keys(DEITY_POWERS).find(
    (k) => k.toLowerCase() === deity.toLowerCase(),
  );
  return key ? DEITY_POWERS[key] : [];
}
