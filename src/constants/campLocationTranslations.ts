/**
 * Bilingual camp location names and descriptions.
 * Location IDs remain the same, but names and descriptions are translated.
 */

import { CAMP_LOCATION } from '../constants/campLocations';
import type { Language } from '../contexts/LanguageContext';

interface BilingualText {
  en: string;
  th: string;
}

export const CAMP_LOCATION_NAMES: Record<string, BilingualText> = {
  [CAMP_LOCATION.HALF_BLOOD_HILL]: {
    en: 'Half-Blood Hill',
    th: 'เนินเขาแห่งค่ายเลือดผสม',
  },
  [CAMP_LOCATION.BIG_HOUSE]: {
    en: 'The Big House',
    th: 'บ้านใหญ่',
  },
  [CAMP_LOCATION.WOODS]: {
    en: 'The Woods',
    th: 'ป่ารอบค่าย',
  },
  [CAMP_LOCATION.CANOE_LAKE]: {
    en: 'Canoe Lake',
    th: 'ทะเลสาบเรือแคนู',
  },
  [CAMP_LOCATION.DINING_PAVILION]: {
    en: 'Dining Pavilion',
    th: 'ห้องอาหาร',
  },
  [CAMP_LOCATION.AMPHITHEATER]: {
    en: 'Amphitheater',
    th: 'โรงละครกลางแจ้ง',
  },
  [CAMP_LOCATION.ARENA]: {
    en: 'Arena',
    th: 'สนามประลอง',
  },
  [CAMP_LOCATION.ARMORY]: {
    en: 'Armory',
    th: 'คลังอาวุธ',
  },
  [CAMP_LOCATION.FORGE]: {
    en: 'Forge',
    th: 'ทั่งแห่งเฮเฟสตัส',
  },
  [CAMP_LOCATION.CLIMBING_WALL]: {
    en: 'Climbing Wall',
    th: 'กำแพงหินลาวา',
  },
  [CAMP_LOCATION.ARCHERY_RANGE]: {
    en: 'Archery Range',
    th: 'สนามฝึกยิงธนู',
  },
  [CAMP_LOCATION.STRAWBERRY_FIELDS]: {
    en: 'Strawberry Fields',
    th: 'ไร่สตรอว์เบอร์รี่',
  },
  [CAMP_LOCATION.CABINS]: {
    en: 'Cabins',
    th: 'บ้านพักสมาชิกค่าย',
  },
  [CAMP_LOCATION.STABLES]: {
    en: 'Stables',
    th: 'คอกเพกาซัส',
  },
  [CAMP_LOCATION.CAMPFIRE]: {
    en: 'Campfire',
    th: 'กองไฟ',
  },
  [CAMP_LOCATION.IRIS_FOUNTAIN]: {
    en: 'Iris Fountain',
    th: 'น้ำพุแห่งไอริส',
  },
  [CAMP_LOCATION.CAMP_STORE]: {
    en: 'Camp Store',
    th: 'ร้านค้าสรรพภัณฑ์',
  },
  [CAMP_LOCATION.TRAINING_GROUNDS]: {
    en: 'Training Grounds',
    th: 'สนามฝึกซ้อม',
  },
};

export const CAMP_LOCATION_DESCRIPTIONS: Record<string, BilingualText> = {
  [CAMP_LOCATION.HALF_BLOOD_HILL]: {
    en: "The sacred boundary of camp, guarded by Thalia's pine and the Golden Fleece. At its threshold, Peleus the dragon keeps eternal watch.",
    th: "เขตแดนศักดิ์สิทธิ์ของแคมป์ อันได้รับการพิทักษ์โดยต้นสนของธาเลียและขนแกะทองคำ ณ ปากทาง เพเลอุส มังกรผู้เฝ้ายามยืนหยัดอย่างนิรันดร์",
  },
  [CAMP_LOCATION.BIG_HOUSE]: {
    en: "The heart of the camp, where Mr. D and Chiron convene. Councils are held, destinies assigned, and the Oracle’s presence lingers within.",
    th: "ศูนย์กลางแห่งแคมป์ ที่ซึ่งมิสเตอร์ดีและไครอนประชุมสภา การตัดสินชะตา การปฐมนิเทศ และเสียงกระซิบของนางพยากรณ์ยังคงสถิตอยู่ภายใน",
  },
  [CAMP_LOCATION.WOODS]: {
    en: "A shadowed forest where Capture the Flag unfolds. Monsters roam beneath its canopy—step within at your own peril after dusk.",
    th: "ป่าลึกที่ถูกโอบคลุมด้วยเงา สถานที่ของเกมยึดธง และการเคลื่อนไหวของอสูรกายใต้เรือนยอด — จงก้าวเข้าไปด้วยความระวังยามอาทิตย์ลับฟ้า",
  },
  [CAMP_LOCATION.CANOE_LAKE]: {
    en: "A tranquil lake watched over by naiads. From gentle paddling to perilous underwater quests, many journeys begin upon its waters.",
    th: "ทะเลสาบสงบที่มีนางไนแอดเฝ้ามอง จากการพายเรืออันแผ่วเบาไปจนถึงภารกิจใต้น้ำอันเสี่ยงภัย หลายการเดินทางเริ่มต้นที่ผืนน้ำแห่งนี้",
  },
  [CAMP_LOCATION.DINING_PAVILION]: {
    en: "An open-air pavilion of marble columns, where the demigods gather. Offerings rise as flame at the bronze brazier in quiet reverence.",
    th: "ศาลาเปิดโล่งที่ตั้งตระหง่านด้วยเสาหินอ่อน เหล่ามนุษย์สายเลือดเทพเจ้าจะมารวมตัวกัน ณ ที่นี้ เครื่องบูชาถูกส่งผ่านเปลวไฟแห่งเตาทองสัมฤทธิ์ด้วยความเคารพสงบ",
  },
  [CAMP_LOCATION.AMPHITHEATER]: {
    en: "A grand Greek amphitheater echoing with song and story—where flames, voices, and legends intertwine beneath the open sky.",
    th: "อัฒจันทร์สไตล์กรีกที่สะท้อนเสียงบทเพลงและเรื่องเล่า เปลวไฟ เสียงร้อง และตำนานถักทอกันใต้ท้องฟ้าเปิดกว้าง",
  },
  [CAMP_LOCATION.ARENA]: {
    en: "A colosseum of trial and triumph, where blades clash and warriors are forged through battle and resolve.",
    th: "สนามประลองแห่งบททดสอบและชัยชนะที่ซึ่งคมดาบปะทะกันและเหล่านักรบถูกหล่อหลอมผ่านการต่อสู้และเจตจำนงอันแรงกล้า",
  },
  [CAMP_LOCATION.ARMORY]: {
    en: "An arsenal of celestial bronze—blades, shields, and armor await the hands of demigods destined for battle.",
    th: "คลังแห่งทองสัมฤทธิ์วิเศษ อาวุธ โล่ และเกราะ รอคอยผู้ครอบครองซึ่งถูกลิขิตให้ก้าวสู่สนามรบ",
  },
  [CAMP_LOCATION.FORGE]: {
    en: "Deep beneath the Hephaestus cabin, molten fire breathes life into steel as master smiths shape weapons of legend.",
    th: "ลึกลงใต้กระท่อมเฮเฟสตัส เปลวลาวาหล่อเลี้ยงเหล็กกล้า ช่างหลอมระดับปรมาจารย์รังสรรค์อาวุธแห่งตำนาน",
  },
  [CAMP_LOCATION.CLIMBING_WALL]: {
    en: "A shifting wall of stone and fire—routes twist and lava surges. Only the swift and daring reach the summit.",
    th: "กำแพงแห่งหินและเพลิงที่แปรเปลี่ยน เส้นทางบิดเบี้ยว ลาวาปะทุ ผู้ที่รวดเร็วและกล้าหาญเท่านั้นจะพิชิตยอดได้",
  },
  [CAMP_LOCATION.TRAINING_GROUNDS]: {
    en: "A place where demigods hone their skills, pushing their limits and preparing for the challenges ahead.",
    th: "สถานที่ที่เหล่ามนุษย์สายเลือดเทพเจ้าฝึกฝนทักษะของตน ผลักดันขีดจำกัดและเตรียมพร้อมสำหรับความท้าทายที่รออยู่",
  },
  [CAMP_LOCATION.ARCHERY_RANGE]: {
    en: "The domain of Apollo's children—where arrows fly true through moving targets, wind, and distance alike.",
    th: "อาณาเขตของบุตรแห่งอพอลโล ที่ซึ่งลูกศรพุ่งตรงผ่านเป้าเคลื่อนไหว สายลม และระยะทาง",
  },
  [CAMP_LOCATION.STRAWBERRY_FIELDS]: {
    en: "Fields of crimson harvest, where strawberries grow sweet as ambrosia—never fading, never spoiling.",
    th: "ไร่สตรอว์เบอร์รีที่ให้ผลรสหวานดุจเทวาหาร ไม่มีวันร่วงโรย ไม่มีวันเน่าเสีย",
  },
  [CAMP_LOCATION.CABINS]: {
    en: "Twenty cabins in a sacred arc, each a reflection of its Olympian patron and the legacy they bestow.",
    th: "บ้านพักยี่สิบหลังเรียงเป็นแนวศักดิ์สิทธิ์ แต่ละหลังสะท้อนอำนาจและมรดกของเทพโอลิมปัสผู้อุปถัมภ์คุ้มครอง",
  },
  [CAMP_LOCATION.STABLES]: {
    en: "Home of pegasi and enchanted steeds, where sky and earth alike become the battlefield of mounted warriors.",
    th: "ที่พำนักของม้าเพกาซัส ที่ซึ่งทั้งฟ้าและพื้นดินกลายเป็นสนามรบของนักรบผู้ขี่พาหนะ",
  },
  [CAMP_LOCATION.CAMPFIRE]: {
    en: "A sacred flame blessed by Hestia—where stories are shared, songs are sung, and bonds are quietly forged.",
    th: "เปลวไฟศักดิ์สิทธิ์แห่งพรของเฮสเทีย สถานที่แห่งเรื่องเล่า บทเพลง และสายสัมพันธ์ที่ค่อย ๆ ถูกถักทอ",
  },
  [CAMP_LOCATION.IRIS_FOUNTAIN]: {
    en: "A fountain of rainbow light—offer a drachma, and your voice will travel across distance through Iris' grace.",
    th: "น้ำพุสายรุ้งแห่งเทพีไอริส เพียงมอบเหรียญดรัคมา เสียงของคุณจะถูกส่งข้ามระยะทางด้วยพรของไอริส",
  },
  [CAMP_LOCATION.CAMP_STORE]: {
    en: "A humble store of necessities and keepsakes, where drachmas are traded for tools of both survival and memory.",
    th: "ร้านค้าที่มีทุกสิ่งของที่จำเป็นจัดเตรียมไว้ให้เลือกสรร ที่ซึ่งดรัคมาถูกแลกเปลี่ยนเป็นทั้งเครื่องมือเอาตัวรอดและความทรงจำ",
  },
};

/**
 * Get translated camp location name.
 */
export function getCampLocationName(locationId: string, language: Language): string {
  return CAMP_LOCATION_NAMES[locationId]?.[language] || locationId;
}

/**
 * Get translated camp location description.
 */
export function getCampLocationDescription(locationId: string, language: Language): string {
  return CAMP_LOCATION_DESCRIPTIONS[locationId]?.[language] || '';
}
