export interface Wish {
  deity: string;
  name: string;
  description: string;
}

const SHEET_ID = '1P3gaozLPryFY8itFVx7YzBTrFfdSn2tllTKJIMXVWOA';
const GID = '198616624';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let cells: string[] = [];
  let cell = '';
  let inQuote = false;
  let i = 0;

  while (i < csv.length) {
    const ch = csv[i];
    if (inQuote) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else {
          inQuote = false;
          i++;
        }
      } else {
        cell += ch;
        i++;
      }
    } else if (ch === '"') {
      inQuote = true;
      i++;
    } else if (ch === ',') {
      cells.push(cell.trim());
      cell = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      cells.push(cell.trim());
      cell = '';
      if (ch === '\r' && csv[i + 1] === '\n') i++;
      i++;
      if (cells.some(c => c)) rows.push(cells);
      cells = [];
    } else {
      cell += ch;
      i++;
    }
  }

  if (cell || cells.length) {
    cells.push(cell.trim());
    if (cells.some(c => c)) rows.push(cells);
  }

  return rows;
}

export async function fetchWishes(): Promise<Wish[]> {
  const res = await fetch(CSV_URL);
  const csv = await res.text();
  const rows = parseCSV(csv);
  // Skip header row, map columns: deity, wish (name), description
  return rows.slice(1)
    .filter(r => r[0] && r[1])
    .map(r => ({
      deity: r[0].toLowerCase(),
      name: r[1],
      description: r[2] || '',
    }));
}

/** Fallback data if fetch fails */
export const WISHES_FALLBACK: Wish[] = [
  { deity: 'zeus', name: 'ราชันย์เหนือนภา', description: 'การต่อสู้/ฝึกฝนในวันนี้แต้มเต๋าทุกประเภท -2' },
  { deity: 'hera', name: 'มาตาแห่งนารี', description: 'ไม่สามารถร่วมกิจกรรมที่มีการต่อสู้ในวันนั้นได้' },
  { deity: 'poseidon', name: 'เขย่าโลกา', description: 'การทอยเต๋าในวันนี้ ถ้าน้อยกว่า 6 จะปัดเป็น 6' },
  { deity: 'demeter', name: 'สตรีสี่ฤดู', description: 'การทำไร่สตรอเบอร์รี่วันนี้จะได้รับเงินตอบแทน x2' },
  { deity: 'ares', name: 'อสูรสงคราม', description: 'การต่อสู้ในวันนี้ ดาเมจแรงขึ้น 1 หน่วย' },
  { deity: 'athena', name: 'เนตรเทาเชาว์ปัญญา', description: 'การฝึกฝนในวันนี้ เมื่อฝึกสำเร็จ 1 ครั้ง จะได้รับ โควตาอัพสเตตัส 2 พอยท์ (แค่การฝึกครั้งแรก)' },
  { deity: 'apollo', name: 'ลำนำพิณสุริยัน', description: 'เงินรางวัลจากเควสบอร์ดเพิ่มเป็น 2 เท่า (มีผลแค่ 3 เควสแรกที่ทำเท่านั้น)' },
  { deity: 'artemis', name: 'คันศรจันทรา', description: 'การต่อสู้ภายในวันนี้ ความเร็ว +3 หน่วย' },
  { deity: 'hephaestus', name: 'หัตถ์ผู้รังสรรค์', description: 'วันนี้ อุปกรณ์สวมใส่จะนับว่าเป็นขั้นที่สูงกว่า 1 ขั้น' },
  { deity: 'aphrodite', name: 'พิราบเลอโฉม', description: 'ได้รับเสน่ห์ ทำให้ NPC จะ Quote พูดถึงคุณแบบสุ่ม' },
  { deity: 'hermes', name: 'นาคาเพทุบาย', description: 'ได้รับตั๋วลดราคา 30% ในร้านค้า 1 ใบ' },
  { deity: 'dionysus', name: 'รัญจวนเมรัย', description: 'ภายในวันนี้จะสามารถรับเควสบอร์ดได้แค่ 1 เควส' },
  { deity: 'hades', name: 'เงาพิภพนิฬกาล', description: 'การต่อสู้ภายในวันนั้น หากตาย จะฟื้นคืนชีพขึ้นมาเลือดเต็ม 1 ครั้ง' },
  { deity: 'iris', name: 'สาส์นผ่านสายรุ้ง', description: 'ได้รับข้อความไอริสปริศนาแบบสุ่ม 1 คำ' },
  { deity: 'hypnos', name: 'นิทราเงียบงัน', description: 'แต้มเต๋าหน้าสูงสุดลดลง จาก (d12) เหลือ (d10)' },
  { deity: 'nemesis', name: 'ตราชั่งแห่งกรรม', description: 'การต่อสู้/ฝึกฝนในวันนี้ เมื่อป้องกันการโจมตีได้ จะโจมตีสวนกลับไป ทำดาเมจ 1 หน่วย' },
  { deity: 'nike', name: 'ปีกนำชัยชนะ', description: 'เมื่อต่อสู้ใด ๆ และชนะในวันนี้ จะได้รับเงิน 100$' },
  { deity: 'hebe', name: 'ธาราอมฤต', description: 'ได้รับโพชั่นไซส์ S 1 ขวด' },
  { deity: 'tyche', name: 'วงล้อโชคลาภ', description: 'แต้มเต๋าหน้าสูงสุดเพิ่มขึ้น จาก (d12) เป็น (d15)' },
  { deity: 'hecate', name: 'ม่านหมอกมนตรา', description: 'ได้รับแต้มอัพ ทักษะ 1 แต้ม' },
];
