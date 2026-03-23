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
    th: 'เนินฮาล์ฟบลัด',
  },
  [CAMP_LOCATION.BIG_HOUSE]: {
    en: 'The Big House',
    th: 'บ้านใหญ่',
  },
  [CAMP_LOCATION.WOODS]: {
    en: 'The Woods',
    th: 'ป่า',
  },
  [CAMP_LOCATION.CANOE_LAKE]: {
    en: 'Canoe Lake',
    th: 'ทะเลสาบเรือแคนู',
  },
  [CAMP_LOCATION.DINING_PAVILION]: {
    en: 'Dining Pavilion',
    th: 'ศาลาอาหาร',
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
    th: 'โรงหลอม',
  },
  [CAMP_LOCATION.CLIMBING_WALL]: {
    en: 'Climbing Wall',
    th: 'กำแพงปีนหินลาวา',
  },
  [CAMP_LOCATION.ARCHERY_RANGE]: {
    en: 'Archery Range',
    th: 'สนามฝึกยิงธนู',
  },
  [CAMP_LOCATION.STRAWBERRY_FIELDS]: {
    en: 'Strawberry Fields',
    th: 'ไร่สตรอเบอร์รี่',
  },
  [CAMP_LOCATION.CABINS]: {
    en: 'Cabins',
    th: 'กระท่อม',
  },
  [CAMP_LOCATION.STABLES]: {
    en: 'Stables',
    th: 'คอกม้า',
  },
  [CAMP_LOCATION.CAMPFIRE]: {
    en: 'Campfire',
    th: 'กองไฟ',
  },
  [CAMP_LOCATION.IRIS_FOUNTAIN]: {
    en: 'Iris Fountain',
    th: 'น้ำพุไอริส',
  },
  [CAMP_LOCATION.CAMP_STORE]: {
    en: 'Camp Store',
    th: 'ร้านค้าแคมป์',
  },
};

export const CAMP_LOCATION_DESCRIPTIONS: Record<string, BilingualText> = {
  [CAMP_LOCATION.HALF_BLOOD_HILL]: {
    en: "The camp boundary protected by Thalia's pine and the Golden Fleece. Peleus the dragon guards the entrance.",
    th: 'ขอบเขตแคมป์ที่ได้รับการปกป้องโดยต้นสนของธาเลียและขนแกะทองคำ โดยมีเพเลอุสเป็นมังกรเฝ้าทางเข้า',
  },
  [CAMP_LOCATION.BIG_HOUSE]: {
    en: 'Camp headquarters where Mr. D and Chiron hold council. War meetings, orientation, and the oracle reside here.',
    th: 'สำนักงานใหญ่ของแคมป์ ซึ่งมีมิสเตอร์ดีและไครอนถือสภา การประชุมสงคราม การปฐมนิเทศ และนางทำนายอยู่ที่นี่',
  },
  [CAMP_LOCATION.WOODS]: {
    en: 'Dense forest where Capture the Flag is played. Monsters roam freely — enter at your own risk after dark.',
    th: 'ป่าทึบที่เล่นเกมยึดธง มอนสเตอร์ร่อนเร่อยู่ — เข้าไปเสี่ยงด้วยตัวเองหลังมืด',
  },
  [CAMP_LOCATION.CANOE_LAKE]: {
    en: 'A serene lake with naiads. Canoe races, swimming lessons, and the occasional underwater quest begin here.',
    th: 'ทะเลสาบอันเงียบสงบพร้อมนางไนแอด การแข่งเรือแคนู บทเรียนว่ายน้ำ และภารกิจใต้น้ำเริ่มต้นที่นี่',
  },
  [CAMP_LOCATION.DINING_PAVILION]: {
    en: 'Open-air pavilion with marble columns. Each cabin has its own table. Offerings are burned at the bronze brazier.',
    th: 'ศาลากลางแจ้งที่มีเสาหินอ่อน กระท่อมแต่ละหลังมีโต๊ะของตัวเอง เครื่องบูชาถูกเผาที่เตาไฟทองสัมฤทธิ์',
  },
  [CAMP_LOCATION.AMPHITHEATER]: {
    en: 'Greek-style amphitheater for campfire sing-alongs, theater performances, and camp council meetings.',
    th: 'โรงละครกลางแจ้งสไตล์กรีกสำหรับร้องเพลงรอบกองไฟ การแสดงละคร และการประชุมสภาแคมป์',
  },
  [CAMP_LOCATION.ARENA]: {
    en: 'Colosseum-style training ground for combat practice, sparring matches, and gladiator-style challenges.',
    th: 'สนามฝึกสไตล์โคลอสเซียมสำหรับฝึกการต่อสู้ การประลองยุทธ และความท้าทายสไตล์นักรบโรมัน',
  },
  [CAMP_LOCATION.ARMORY]: {
    en: 'Arsenal of celestial bronze weapons, armor, and shields. Each demigod selects their gear here.',
    th: 'คลังอาวุธทองสัมฤทธิ์สวรรค์ เกราะ และโล่ กึ่งเทพภาคแต่ละคนเลือกอุปกรณ์ที่นี่',
  },
  [CAMP_LOCATION.FORGE]: {
    en: "Hephaestus cabin's underground workshop. Master smiths craft weapons and enchanted items using lava forges.",
    th: 'โรงงานใต้ดินของกระท่อมเฮเฟสตัส ช่างโลหะระดับปรมาจารย์สร้างอาวุธและไอเท็มเวทมนตร์โดยใช้เตาหลอมลาวา',
  },
  [CAMP_LOCATION.CLIMBING_WALL]: {
    en: 'Lava-spewing wall that changes routes. Reach the top before the lava catches you. Safety harness required.',
    th: 'กำแพงพุลาวาที่เปลี่ยนเส้นทาง ไปถึงยอดก่อนที่ลาวาจะทันคุณ ต้องใช้สายรัดนิรภัย',
  },
  [CAMP_LOCATION.ARCHERY_RANGE]: {
    en: "Apollo cabin's domain. Archery training with moving targets, mounted shooting, and long-distance competitions.",
    th: 'อาณาเขตของกระท่อมอพอลโล การฝึกยิงธนูกับเป้าเคลื่อนที่ การยิงบนม้า และการแข่งขันระยะไกล',
  },
  [CAMP_LOCATION.STRAWBERRY_FIELDS]: {
    en: "Camp's main source of income. Strawberries grown here taste like ambrosia and never spoil.",
    th: 'แหล่งรายได้หลักของแคมป์ สตรอเบอร์รี่ที่ปลูกที่นี่มีรสชาติเหมือนเทวาหารและไม่เน่าเสียเลย',
  },
  [CAMP_LOCATION.CABINS]: {
    en: 'Twenty cabins arranged in a U-shape, one for each Olympian god. Each cabin reflects its patron deity.',
    th: 'กระท่อมยี่สิบหลังเรียงรูปตัวยู หนึ่งหลังสำหรับเทพโอลิมปัสแต่ละองค์ กระท่อมแต่ละหลังสะท้อนเทพเจ้าผู้อุปถัมภ์',
  },
  [CAMP_LOCATION.STABLES]: {
    en: 'Home to pegasi and other magical mounts. Riding lessons and aerial combat training take place here.',
    th: 'บ้านของม้าปีกาซัสและพาหนะวิเศษอื่นๆ บทเรียนการขี่และการฝึกต่อสู้ทางอากาศเกิดขึ้นที่นี่',
  },
  [CAMP_LOCATION.CAMPFIRE]: {
    en: 'Sacred fire blessed by Hestia. Evening gatherings, sing-alongs, and important announcements happen here.',
    th: 'ไฟศักดิ์สิทธิ์ที่ได้รับพรจากเฮสเทีย การชุมนุมยามเย็น การร้องเพลง และประกาศสำคัญเกิดขึ้นที่นี่',
  },
  [CAMP_LOCATION.IRIS_FOUNTAIN]: {
    en: 'Rainbow fountain for Iris messages. Toss a drachma and speak to distant friends or family.',
    th: 'น้ำพุรุ้งสำหรับข้อความไอริส โยนดรัคมาและพูดคุยกับเพื่อนหรือครอบครัวที่ห่างไกล',
  },
  [CAMP_LOCATION.CAMP_STORE]: {
    en: 'General store stocked with camp supplies, souvenirs, and essentials. Exchange drachmas for gear.',
    th: 'ร้านสรรพสินค้าที่มีอุปกรณ์แคมป์ ของที่ระลึก และสิ่งจำเป็น แลกดรัคมากับอุปกรณ์',
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
