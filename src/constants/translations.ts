/**
 * Comprehensive translations for the entire website.
 * Power names and character names remain as proper nouns (no translation).
 * Affliction/blessing names, UI labels, descriptions are translated.
 */

import { EFFECT_TAGS } from '../constants/effectTags';
import type { Language } from '../contexts/LanguageContext';

export const AFFLICTION_NAMES = {
  // Zeus
  [EFFECT_TAGS.SHOCK]: {
    en: 'Shocked',
    th: 'ช็อต',
  },
  [EFFECT_TAGS.JOLT_ARC_DECELERATION]: {
    en: 'Deceleration',
    th: 'ชะลอความเร็ว',
  },
  // Poseidon
  [EFFECT_TAGS.STUN]: {
    en: 'Stunned',
    th: 'สตั๊น',
  },
  // Apollo (Imprecated Poem)
  [EFFECT_TAGS.HEALING_NULLIFIED]: {
    en: 'Healing Nullified',
    th: 'สูญสิ้นเยียวยา',
  },
  [EFFECT_TAGS.DISORIENTED]: {
    en: 'Disoriented',
    th: 'ดวงเนตรเลือนพร่า',
  },
  [EFFECT_TAGS.ETERNAL_AGONY]: {
    en: 'Eternal Agony',
    th: 'ทุกขานิรันดร์',
  },
} as const;

export const BLESSING_NAMES = {
  // Zeus
  [EFFECT_TAGS.BEYOND_THE_NIMBUS]: {
    en: 'Beyond the Nimbus',
    th: 'เหนือเมฆครึ้ม',
  },
  // Apollo
  [EFFECT_TAGS.APOLLO_S_HYMN]: {
    en: "Apollo's Hymn",
    th: 'คีตาสมานแห่งเทพสุริยัน',
  },
  [EFFECT_TAGS.RAPID_FIRE]: {
    en: 'Rapid Fire',
    th: 'กระหน่ำยิง',
  },
  [EFFECT_TAGS.SUNBORN_SOVEREIGN]: {
    en: 'Sunborn Sovereign',
    th: 'ผู้ปกครองแห่งดวงอาทิตย์',
  },
  // Hades
  [EFFECT_TAGS.SHADOW_CAMOUFLAGING]: {
    en: 'Shadow Camouflaging',
    th: 'เงาพรางตัว',
  },
  [EFFECT_TAGS.SOUL_DEVOURER]: {
    en: 'Soul Devourer',
    th: 'ผู้กลืนวิญญาณ',
  },
  [EFFECT_TAGS.DEATH_KEEPER]: {
    en: 'Death Keeper',
    th: 'ผู้รั้งความตาย',
  },
  [EFFECT_TAGS.RESURRECTED]: {
    en: 'Resurrected',
    th: 'ผู้ฟื้นคืนชีพ',
  },
  // Persephone
  [EFFECT_TAGS.EFFLORESCENCE_MUSE]: {
    en: 'Efflorescence Muse',
    th: 'เกราะพฤกษชาติแห่งนางบุปผา',
  },
  [EFFECT_TAGS.FLORAL_FRAGRANCE]: {
    en: 'Floral Fragrance',
    th: 'สุคนธ์บุษบาแห่งการเยียวยา',
  },
  [EFFECT_TAGS.POMEGRANATE_OATH_SPIRIT]: {
    en: "Pomegranate's Oath Spirit",
    th: 'จิตวิญญาณ์แห่งผลทับทิม',
  },
  // Seasons
  [EFFECT_TAGS.SEASON_SPRING]: {
    en: 'Spring',
    th: 'สารทฤดู',
  },
  [EFFECT_TAGS.SEASON_SUMMER]: {
    en: 'Summer',
    th: 'คิมหันตฤดู',
  },
  [EFFECT_TAGS.SEASON_AUTUMN]: {
    en: 'Autumn',
    th: 'วสันตฤดู',
  },
  [EFFECT_TAGS.SEASON_WINTER]: {
    en: 'Winter',
    th: 'เหมันตฤดู',
  },
} as const;

/**
 * Common UI labels across all pages.
 */
export const UI_TEXT = {
  // Navigation
  HOME: {
    en: 'Home',
    th: 'หน้าแรก'
  },
  ARENA: {
    en: 'Arena',
    th: 'สนามประลอง'
  },
  LIFE_IN_CAMP: {
    en: 'Life in Camp',
    th: 'ชีวิตในแคมป์'
  },
  CAMP_MEMBERS: {
    en: 'Camp Members',
    th: 'สมาชิกแคมป์'
  },
  REPORT_HARVEST: {
    en: 'Report Harvest',
    th: 'รายงานการเก็บเกี่ยว'
  },
  STRAWBERRY_FIELDS: {
    en: 'Strawberry Fields',
    th: 'ไร่สตรอว์เบอร์รี่'
  },
  RECENT_HARVESTS: {
    en: 'Recent Harvests',
    th: 'การเก็บเกี่ยวล่าสุด'
  },
  PERSONAL_NO_HARVESTS: {
    en: 'You have not reported any harvests yet.',
    th: 'คุณยังไม่ได้รายงานการเก็บเกี่ยวใด ๆ เลย'
  },
  NO_HARVESTS_YET: {
    en: 'No harvests yet—go gather some!',
    th: 'ทุ่งแห่งค่ายยังเงียบงัน—เจ้าจะเป็นผู้เริ่มหรือไม่?'
  },
  SUCCESSFUL_HARVEST_TITLE: {
    en: 'Submission Received!',
    th: 'การเก็บเกี่ยวสำเร็จ!'
  },
  SUCCESSFUL_HARVEST_MESSAGE: {
    en: "Your harvest has been submitted. Pan will review and evaluate your submission as soon as possible. Please wait patiently and prepare to receive your reward!",
    th: 'ขอบคุณที่ส่งการเก็บเกี่ยวเข้ามา แพนจะทำการตรวจสอบและประเมินค่าตอบแทนให้เร็วที่สุดเท่าที่จะทำได้ โปรดอดใจรอและเตรียมรับรางวัลของคุณ!'
  },
  HARVEST_SUBMISSION_NOTE: {
    en: 'After submitting your harvest report, please wait for Pan review before receiving the reward.',
    th: 'เมื่อส่งเอกสารประเมินราคาแล้ว กรุณารอการตรวจสอบจากแพนก่อนที่จะได้รับผลตอบแทนดังกล่าว'
  },
  HARVEST_SUBMISSION_NOTE_WITH_DEMETER_BONUS: {
    en: "You got Demeter's blessing today! Your harvest will receive double the reward, but don't forget to wait for Pan's review before receiving it.",
    th: 'คุณได้รับพรจากเทพีดีมิเทอร์วันนี้! การเก็บเกี่ยวของคุณจะได้รับรางวัลเป็นสองเท่า แต่โปรดอย่าลืมรอการตรวจสอบจากแพนก่อนที่จะได้รับผลตอบแทน'
  },
  SUBMIT: {
    en: 'Submit Harvest',
    th: 'นำส่งผลการเก็บเกี่ยว'
  },
  SUBMITTING: {
    en: 'Submitting...',
    th: 'กำลังนำส่งผลการเก็บเกี่ยว...'
  },
  HARVEST_REPORT_FOR: {
    en: 'Harvest Report for',
    th: 'รายงานการเก็บเกี่ยวประจำวันที่'
  },
  HARVEST_RECORD_BOOK: {
    en: 'Harvest Record Book',
    th: 'สมุดบันทึกการเก็บเกี่ยว'
  },
  TOP_HARVESTOR: {
    en: 'Top Harvestor',
    th: 'นักเก็บเกี่ยวชั้นนำ'
  },
  HARVEST_WAITING_REVIEW: {
    en: 'Waiting for review...',
    th: 'กำลังรอการตรวจสอบ...'
  },
  ROLEPLAYERS: {
    en: 'Roleplayers',
    th: 'ผู้เล่น'
  },
  HARVEST_RULES: {
    en: 'Harvest Conditions\nand Rewards',
    th: 'เงื่อนไขการเก็บเกี่ยว\nและค่าตอบแทน'
  },
  INVALID_TWITTER_URL: {
    en: 'Invalid Twitter URL',
    th: 'URL Twitter ไม่ถูกต้อง'
  },
  BACK_TO_CAMP: {
    en: 'Back to Camp',
    th: 'กลับไปที่แคมป์'
  },
  SHOP: {
    en: 'Shop',
    th: 'ร้านค้า'
  },
  CHARACTER: {
    en: 'Character',
    th: 'ตัวละคร'
  },
  CHARACTER_INFO: {
    en: 'Character Info',
    th: 'ข้อมูลตัวละคร'
  },
  FORGE: {
    en: 'Forge',
    th: 'โรงหลอม'
  },
  ADMIN: {
    en: 'Admin',
    th: 'ผู้ดูแลระบบ'
  },
  ADMIN_MANAGER: {
    en: 'Admin Manager',
    th: 'จัดการระบบ'
  },
  THEME_COLORS: {
    en: 'Theme Colors',
    th: 'สีธีม'
  },
  SETTINGS: {
    en: 'Settings',
    th: 'ตั้งค่า'
  },
  LOGOUT: {
    en: 'Logout',
    th: 'ออกจากระบบ'
  },

  // Battle phases
  SELECT_TARGET: {
    en: 'Selecting target...',
    th: 'เลือกเป้าหมาย...'
  },
  SELECT_ACTION: {
    en: 'Choosing action...',
    th: 'เลือกการกระทำ...'
  },
  SELECT_SEASON: {
    en: 'Choosing season...',
    th: 'เลือกฤดูกาล...'
  },
  SELECT_POEM: {
    en: 'Choosing verse...',
    th: 'เลือกบทกลอน...'
  },
  ROLLING: {
    en: 'Rolling...',
    th: 'กำลังทอยลูกเต๋า...'
  },
  DEFENDING: {
    en: 'Defending...',
    th: 'กำลังป้องกัน...'
  },
  RESOLVING: {
    en: 'Resolving...',
    th: 'กำลังคำนวณผล...'
  },
  DONE: {
    en: 'Done',
    th: 'เสร็จสิ้น'
  },

  // Stats
  HP: {
    en: 'HP',
    th: 'พลังชีวิต'
  },
  MAX_HP: {
    en: 'Max HP',
    th: 'พลังชีวิตสูงสุด'
  },
  DAMAGE: {
    en: 'Damage',
    th: 'ความเสียหาย'
  },
  SPEED: {
    en: 'Speed',
    th: 'ความเร็ว'
  },
  CRITICAL_RATE: {
    en: 'Crit Rate',
    th: 'โอกาสคริติคอล'
  },
  ATTACK_DICE: {
    en: 'Attack Dice',
    th: 'ลูกเต๋าโจมตี'
  },
  DEFEND_DICE: {
    en: 'Defend Dice',
    th: 'ลูกเต๋าป้องกัน'
  },
  TECHNIQUE: {
    en: 'Technique',
    th: 'เทคนิค'
  },
  REROLL: {
    en: 'Reroll',
    th: 'ทอยใหม่'
  },
  QUOTA: {
    en: 'Quota',
    th: 'โควตา'
  },

  // Actions
  ATTACK: {
    en: 'Attack',
    th: 'โจมตี'
  },
  DEFEND: {
    en: 'Defend',
    th: 'ป้องกัน'
  },
  POWER: {
    en: 'Power',
    th: 'พลัง'
  },
  USE_POWER: {
    en: 'Use Power',
    th: 'ใช้พลัง'
  },
  BASIC_ATTACK: {
    en: 'Basic Attack',
    th: 'โจมตีปกติ'
  },
  CONFIRM: {
    en: 'Confirm',
    th: 'ยืนยัน'
  },
  CANCEL: {
    en: 'Cancel',
    th: 'ยกเลิก'
  },
  BACK: {
    en: 'Back',
    th: 'ย้อนกลับ'
  },
  CLOSE: {
    en: 'Close',
    th: 'ปิด'
  },
  CONTINUE: {
    en: 'Continue',
    th: 'ดำเนินการต่อ'
  },
  UNDO: {
    en: 'Undo',
    th: 'ย้อนกลับ'
  },
  UNDO_ALL: {
    en: 'Undo All',
    th: 'ย้อนกลับทั้งหมด'
  },
  UNDO_ALL_CHANGES: {
    en: 'Undo all changes',
    th: 'ย้อนกลับการเปลี่ยนแปลงทั้งหมด'
  },
  RESET: {
    en: 'Reset',
    th: 'รีเซ็ต'
  },
  RESET_TO_DEITY_THEME: {
    en: 'Reset to deity theme',
    th: 'รีเซ็ตเป็นธีมของเทพผู้อุปถัมภ์'
  },
  SAVE_THEME: {
    en: 'Save Theme',
    th: 'บันทึกธีม'
  },
  SAVING: {
    en: 'Saving...',
    th: 'กำลังบันทึก...'
  },
  LANGUAGE: {
    en: 'Language',
    th: 'ภาษา'
  },

  // Status
  ELIMINATED: {
    en: 'Eliminated',
    th: 'ตาย'
  },
  MISSED: {
    en: 'Missed',
    th: 'พลาด'
  },
  DODGED: {
    en: 'Dodged',
    th: 'หลบ'
  },
  BLOCKED: {
    en: 'Blocked',
    th: 'บล็อก'
  },
  HIT: {
    en: 'Hit',
    th: 'โดน'
  },
  CRITICAL_HIT: {
    en: 'Critical Hit!',
    th: 'คริติคอล!'
  },

  // Effect pip tooltips
  BY: {
    en: 'by',
    th: 'โดย'
  },
  SELF: {
    en: 'self',
    th: 'ตนเอง'
  },
  STACKS: {
    en: 'stacks',
    th: 'สแต็ก'
  },
  CONDITIONAL: {
    en: 'conditional',
    th: 'มีเงื่อนไข'
  },
  ROUND: {
    en: 'round',
    th: 'รอบ'
  },
  ROUNDS: {
    en: 'rounds',
    th: 'รอบ'
  },

  // Roger that modals
  ROGER_THAT: {
    en: 'Roger that',
    th: 'รับทราบ'
  },
  WAITING_FOR: {
    en: 'Waiting for',
    th: 'รอ'
  },
  HEAL_SKIPPED: {
    en: 'Heal skipped',
    th: 'การรักษาถูกข้าม'
  },
  CO_ATTACK_SKIPPED: {
    en: 'Co-attack skipped',
    th: 'การโจมตีร่วมถูกข้าม'
  },
  POMEGRANATE_OATH_CO_ATTACK_SKIPPED: {
    en: "Pomegranate's Oath\n caster's co-attack skipped",
    th: 'การโจมตีร่วม\nของผู้ร่ายคำสัตย์แห่งผลทับทิมถูกข้าม'
  },
  EXTRA_SHOTS_SKIPPED: {
    en: 'Extra shots skipped',
    th: 'การยิงโจมตีเพิ่มเติมถูกข้าม'
  },
  HP_RECOVERY_NO_EFFECT: {
    en: 'HP recovery has no effect',
    th: 'การฟื้นฟู HP ไม่มีผล'
  },
  BECAUSE_HEALING_NULLIFIED_TARGET: {
    en: 'because the target has Healing Nullified.',
    th: 'เพราะเป้าหมายมีสถานะสูญสิ้นเยียวยา'
  },
  BECAUSE_HEALING_NULLIFIED_CASTER: {
    en: 'because the caster has Healing Nullified.',
    th: 'เพราะผู้กระทำมีสถานะสูญสิ้นเยียวยา'
  },
  DEFENDER_ELIMINATED_POMEGRANATE: {
    en: "The defender was eliminated by your ally's strike. Pomegranate's Oath co-attack does not resolve.",
    th: 'ผู้ป้องกันถูกกำจัดโดยการโจมตีของพันธมิตร\nการโจมตีร่วมของคำสัตย์ทับทิมไม่เกิดผล'
  },
  DEFENDER_ELIMINATED_VOLLEY: {
    en: 'The defender was eliminated. Volley Arrow extra shots do not resolve.',
    th: 'ผู้ป้องกันถูกกำจัดแล้ว การโจมตีแบบกระหน่ำยิงไม่เกิดผล'
  },
  HEAL_RECEIVER: {
    en: 'heal receiver',
    th: 'ผู้รับการรักษา'
  },
  ATTACKER: {
    en: 'attacker',
    th: 'ผู้โจมตี'
  },
  CASTER: {
    en: 'caster',
    th: 'ผู้กระทำ'
  },
  OATH_CASTER: {
    en: 'oath caster',
    th: 'ผู้ให้คำสัตย์'
  },

  // Battle info
  BATTLE_ROUND: {
    en: 'Round',
    th: 'รอบที่'
  },
  TURN: {
    en: 'Turn',
    th: 'เทิร์น'
  },
  WINNER: {
    en: 'Winner',
    th: 'ผู้ชนะ'
  },
  TEAM_A: {
    en: 'Team A',
    th: 'ทีม A'
  },
  TEAM_B: {
    en: 'Team B',
    th: 'ทีม B'
  },
  VIEWERS: {
    en: 'Viewers',
    th: 'ผู้ชม'
  },

  // Shop
  SHOP_TITLE: {
    en: 'Camp Half-Blood Shop',
    th: 'ร้านค้าแคมป์ฮาล์ฟบลัด'
  },
  HERMES_SUPPLY: {
    en: "Hermes' Supply",
    th: 'ร้านของเฮอร์มีส'
  },
  CAMP: {
    en: 'Camp',
    th: 'แคมป์'
  },
  CART: {
    en: 'Cart',
    th: 'ตะกร้า'
  },
  YOUR_BASKET: {
    en: 'Your Basket',
    th: 'ตะกร้าของคุณ'
  },
  PRICE: {
    en: 'Price',
    th: 'ราคา'
  },
  STOCK: {
    en: 'Stock',
    th: 'สต็อก'
  },
  UNLIMITED: {
    en: 'Unlimited',
    th: 'ไม่จำกัด'
  },
  ADD_TO_CART: {
    en: 'Add to Cart',
    th: 'เพิ่มลงตะกร้า'
  },
  CHECKOUT: {
    en: 'Checkout',
    th: 'ชำระเงิน'
  },
  TOTAL: {
    en: 'Total',
    th: 'รวม'
  },
  QUANTITY: {
    en: 'Quantity',
    th: 'จำนวน'
  },
  DRACHMA: {
    en: 'Drachma',
    th: 'ดรัคมา'
  },
  YOUR_BALANCE: {
    en: 'Your Balance',
    th: 'ยอดเงินของคุณ'
  },
  OUT_OF_STOCK: {
    en: 'Out of Stock',
    th: 'สินค้าหมด'
  },
  SOLD_OUT: {
    en: 'Sold Out',
    th: 'ขายหมด'
  },
  PURCHASE_SUCCESS: {
    en: 'Purchase Successful!',
    th: 'ซื้อสำเร็จ!'
  },
  INSUFFICIENT_FUNDS: {
    en: 'Insufficient Funds',
    th: 'เงินไม่พอ'
  },
  SEARCH_ITEMS: {
    en: 'Search items',
    th: 'ค้นหาสินค้า'
  },
  LIMITED_EDITION: {
    en: 'Limited Edition',
    th: 'สินค้าจำนวนจำกัด'
  },
  ALWAYS_AVAILABLE: {
    en: 'Always Available',
    th: 'สินค้าพร้อมจำหน่าย'
  },
  ITEMS: {
    en: 'items',
    th: 'รายการ'
  },
  LEFT: {
    en: 'left',
    th: 'เหลือ'
  },
  LOADING_WARES: {
    en: 'Loading wares',
    th: 'กำลังโหลดสินค้า'
  },
  CLEAR_BASKET: {
    en: 'Clear basket',
    th: 'ล้างตะกร้า'
  },
  EMPTY_CART: {
    en: 'Your basket is empty',
    th: 'ตะกร้าว่างเปล่า'
  },
  APPLY_COUPON: {
    en: 'Apply Coupon',
    th: 'ใช้คูปอง'
  },

  // Life in Camp / Locations
  LOCATIONS: {
    en: 'Locations',
    th: 'สถานที่'
  },
  EXPLORE: {
    en: 'Explore',
    th: 'สำรวจ'
  },
  VISIT: {
    en: 'Visit',
    th: 'เยี่ยมชม'
  },
  CAMP_MAP: {
    en: 'Camp Map',
    th: 'แผนที่แคมป์'
  },

  // Character Info
  SKILLS: {
    en: 'Skills',
    th: 'ทักษะ'
  },
  PASSIVE: {
    en: 'Passive',
    th: 'แบบพาสซีฟ'
  },
  SKILL: {
    en: 'Skill',
    th: 'ทักษะ'
  },
  ULTIMATE: {
    en: 'Ultimate',
    th: 'ท่าไม้ตาย'
  },
  POWERS: {
    en: 'Powers',
    th: 'พลัง'
  },
  AVAILABLE: {
    en: 'Available',
    th: 'พร้อมใช้'
  },
  LOCKED: {
    en: 'Locked',
    th: 'ล็อค'
  },
  DESCRIPTION: {
    en: 'Description',
    th: 'คำอธิบาย'
  },

  // Lobby
  CREATE_ROOM: {
    en: 'Create Room',
    th: 'สร้างห้อง'
  },
  JOIN_ROOM: {
    en: 'Join Room',
    th: 'เข้าร่วมห้อง'
  },
  ROOM_NAME: {
    en: 'Room Name',
    th: 'ชื่อห้อง'
  },
  TEAM_SIZE: {
    en: 'Team Size',
    th: 'ขนาดทีม'
  },
  WAITING_FOR_PLAYERS: {
    en: 'Waiting for Players',
    th: 'รอผู้เล่น'
  },
  READY: {
    en: 'Ready',
    th: 'พร้อม'
  },
  START_BATTLE: {
    en: 'Start Battle',
    th: 'เริ่มการต่อสู้'
  },

  // Common
  LOADING: {
    en: 'Loading...',
    th: 'กำลังโหลด...'
  },
  ERROR: {
    en: 'Error',
    th: 'ข้อผิดพลาด'
  },
  SUCCESS: {
    en: 'Success',
    th: 'สำเร็จ'
  },
  SAVE: {
    en: 'Save',
    th: 'บันทึก'
  },
  DELETE: {
    en: 'Delete',
    th: 'ลบ'
  },
  EDIT: {
    en: 'Edit',
    th: 'แก้ไข'
  },
  VIEW: {
    en: 'View',
    th: 'ดู'
  },
  SEARCH: {
    en: 'Search',
    th: 'ค้นหา'
  },
  SEARCH_LOCATIONS: {
    en: 'Search locations',
    th: 'ค้นหาสถานที่'
  },
  FILTER: {
    en: 'Filter',
    th: 'กรอง'
  },
  SORT: {
    en: 'Sort',
    th: 'เรียง'
  },
  ALL: {
    en: 'All',
    th: 'ทั้งหมด'
  },
  NONE: {
    en: 'None',
    th: 'ไม่มี'
  },
  YES: {
    en: 'Yes',
    th: 'ใช่'
  },
  NO: {
    en: 'No',
    th: 'ไม่'
  },
  // Training Grounds
  STRENGTH: {
    en: 'Strength',
    th: 'พละกำลัง'
  },
  AGILITY: {
    en: 'Agility',
    th: 'ความคล่องแคล่ว'
  },
  INTELLIGENCE: {
    en: 'Intelligence',
    th: 'สติปัญญา'
  },
  // TeCHNIQUE: {
  //     en: 'Technique',
  //     th: 'เทคนิค'
  //   },
  EXPERIENCE: {
    en: 'Experience',
    th: 'ประสบการณ์'
  },
  FORTUNE: {
    en: 'Fortune',
    th: 'โชคชะตา'
  },
  STRENGTH_DESC: {
    en: 'Power, physical prowess and endurance',
    th: 'พละกำลัง ความแข็งแรงและความถึกทน'
  },
  AGILITY_DESC: {
    en: 'Mobility, nimbleness and reflexes',
    th: 'การเคลื่อนไหวและความคล่องแคล่วว่องไว'
  },
  INTELLIGENCE_DESC: {
    en: 'Intelligence, wisdom and wit',
    th: 'สติปัญญา ความฉลาดและไหวพริบปฏิภาณ'
  },
  EXPERIENCE_DESC: {
    en: 'Experience, combat proficiency and mastery of powers',
    th: 'ประสบการณ์ ความชำนาญในการต่อสู้และความเชี่ยวชาญในพลัง'
  },
  FORTUNE_DESC: {
    en: 'Fortune, luck and serendipity',
    th: 'โชคลาภ ดวงและการเสี่ยงทาย'
  },
  // Training Roleplay Submission
  ROLEPLAY_SUBMISSION_DESC: {
    en: "Complete the training task by posting a roleplay thread on Twitter (X), then submit the thread URL here to earn a Training Point (TP).Each valid submission will be reviewed by an administrator, who will award points accordingly. If no submission is made, or if the submission is rejected, you must resubmit. Failure to do so will prevent you from proceeding to the next training session.",
    th: 'ทำภารกิจการฝึกให้เสร็จโดยการโพสต์เธรดโรลเพลย์บน Twitter (X) จากนั้นส่งลิงก์เธรดที่นี่เพื่อรับ Training Point (TP) การส่งแต่ละครั้งจะถูกตรวจสอบโดยผู้ดูแลระบบ และจะมีการให้คะแนนตามความเหมาะสม หากคุณไม่ส่งผลงาน หรือผลงานถูกปฏิเสธ คุณจะต้องส่งใหม่ มิฉะนั้นจะไม่สามารถทำการฝึกในครั้งถัดไปได้'
  },
  SUBMIT_TRAINING_TASK: {
    en: 'Submit Training Task',
    th: 'ส่งผลงานการฝึกฝน'
  },
  SUBMITTING_TRAINING_TASK: { 
    en: 'Submitting Training Task...',
    th: 'กำลังส่งผลงานการฝึกฝน...'
  },
  TRAINING_REPORT_FOR: {
    en: 'Training Report for',
    th: 'รายงานการฝึกฝนประจำวันที่'
  },
} as const;

/**))
 * Translation keys as constants to avoid hardcoded strings.
 * Usage: t(TRANSLATION_KEYS.SHOP_TITLE, language)
 */
export const TRANSLATION_KEYS = Object.keys(UI_TEXT).reduce((acc, key) => {
  (acc as any)[key] = key;
  return acc;
}, {} as Record<string, string>) as { [K in keyof typeof UI_TEXT]: K };

/**
 * Translation helper function.
 * Usage: t('SHOP_TITLE', language) => returns translated text
 */
export function t(key: keyof typeof UI_TEXT, language: Language): string {
  return UI_TEXT[key][language];
}

/**
 * Translate affliction/blessing name by tag.
 */
export function getEffectName(tag: string, language: Language): string {
  const affliction = AFFLICTION_NAMES[tag as keyof typeof AFFLICTION_NAMES];
  if (affliction) return affliction[language];

  const blessing = BLESSING_NAMES[tag as keyof typeof BLESSING_NAMES];
  if (blessing) return blessing[language];

  return tag; // fallback to tag if not found
}
