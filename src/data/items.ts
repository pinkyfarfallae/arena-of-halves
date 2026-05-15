import { ITEMS } from '../constants/items';

const appPath = (path: string) =>
  window.location.hostname === 'localhost'
    ? `/#${path}`
    : `/arena-of-halves/#${path}`;

const openAppPath = (path: string) => {
  window.open(appPath(path), '_blank', 'noopener,noreferrer');
};

export interface ItemActionDescriptor {
  label: string;
  action?: string;
  onClick?: () => void;
  variant?: 'primary' | 'dark';
}

export interface ItemActionSection {
  kind: 'todayWish' | 'incomeTracker' | 'trainingPoints' | 'wishesProgress';
  title: string;
}

export interface ItemActionInfo {
  usage: string;
  sections?: ItemActionSection[];
  actions?: ItemActionDescriptor[];
  note?: string;
}

export const ITEMS_ACTIONS: Record<string, ItemActionInfo> = {
  [ITEMS.SHOP_30_DISCOUNT_TICKET]: {
    usage:
      '\* หากคุณมีคูปองส่วนลดร้านค้า 30% ในกระเป๋า ร้านค้าจะนำเสนอส่วนลด 30% สำหรับไอเทมที่เลือกซื้ออัตโนมัติ อย่างไรก็ตาม โปรดทราบว่าคูปองส่วนลดจะต้องถูกใช้งานก่อนยืนยันการซื้อและจะไม่สามารถใช้ย้อนหลังเพื่อขอเงินคืนได้หลังจากที่การซื้อในครั้งดังกล่าวเสร็จสมบูรณ์\
      \n\* หากไม่ต้องการใช้คูปองส่วนลดสำหรับการซื้อครั้งใดครั้งหนึ่ง ให้แน่ใจว่าได้ยืนยันการซื้อโดยไม่เปิดใช้งานคูปองส่วนลดก่อนที่จะยืนยันการซื้อเพื่อหลีกเลี่ยงการใช้คูปองส่วนลดโดยไม่ได้ตั้งใจ โดยสามารถกดเครื่องหมายกากบาทเพื่อนำออกได้ที่จุดใช้งานคูปองส่วนลดในร้านค้าสรรพภัณฑ์',
    actions: [
      {
        label: 'Open Shop',
        onClick: () => {
          openAppPath('/shop');
        }
      },
    ],
  },
  [ITEMS.HEALTH_POTION_S]: {
    usage:
      '\* โพชันเพิ่มเลือดขนาดเล็ก (ไซส์ S) สามารถใช้ได้ระหว่างการต่อสู้เท่านั้น\
      \n\* ไม่สามารถใช้ในการฝึกฝนแบบตัวต่อตัวได้',
    actions: [
      {
        label: 'Buy More at the Shop',
        onClick: () => {
          openAppPath('/shop');
        }
      },
    ],
  },
  [ITEMS.HEALTH_POTION_M]: {
    usage:
      '\* โพชันเพิ่มเลือดขนาดกลาง (ไซส์ M) สามารถใช้ได้ระหว่างการต่อสู้เท่านั้น\
      \n\* ไม่สามารถใช้ในการฝึกฝนแบบตัวต่อตัวได้',
    actions: [
      {
        label: 'Buy More at the Shop',
        onClick: () => {
          openAppPath('/shop');
        }
      },
    ],
  },
  [ITEMS.HEALTH_POTION_L]: {
    usage:
      '\* โพชันเพิ่มเลือดขนาดใหญ่ (ไซส์ L) สามารถใช้ได้ระหว่างการต่อสู้เท่านั้น\
      \n\* ไม่สามารถใช้ในการฝึกฝนแบบตัวต่อตัวได้',
    actions: [
      {
        label: 'Buy More at the Shop',
        onClick: () => {
          openAppPath('/shop');
        }
      },
    ],
  },
  [ITEMS.WRAITH_POTION]: {
    usage:
      '\* ใช้ได้ 1 ขวดก่อนการต่อสู้แต่ละครั้งเท่านั้น\
      \n\* ไม่สามารถใช้เพิ่มระหว่างการต่อสู้ได้\
      \n\* ไม่สามารถใช้ในการฝึกฝนแบบตัวต่อตัวได้',
    actions: [
      {
        label: 'Buy More at the Shop',
        onClick: () => {
          openAppPath('/shop');

        }
      },
      // {
      //   label: 'Try In Battle Field',
      //   onClick: () => {
      //     window.open('/#/arena', '_blank', 'noopener,noreferrer');
      //   },
      //   variant: 'dark'
      // }
    ],
  },
  [ITEMS.LUCKY_POTION]: {
    usage:
      '\* ใช้ได้ 1 ขวดก่อนการต่อสู้แต่ละครั้งเท่านั้น\
      \n\* ไม่สามารถใช้เพิ่มระหว่างการต่อสู้ได้\
      \n\* ไม่สามารถใช้ในการฝึกฝนแบบตัวต่อตัวได้',
    actions: [
      {
        label: 'Buy More at the Shop',
        onClick: () => {
          openAppPath('/shop');

        }
      },
      // {
      //   label: 'Try In Battle Field',
      //   onClick: () => {
      //     window.open('/#/arena', '_blank', 'noopener,noreferrer');
      //   },
      //   variant: 'dark'
      // }
    ],
  },
  [ITEMS.SWIFTNESS_POTION]: {
    usage:
      '\* ใช้ก่อนการต่อสู้แต่ละครั้งเท่านั้น แต่ไม่จำกัดจำนวนการใช้\
      \n\* ไม่สามารถใช้เพิ่มระหว่างการต่อสู้ได้\
      \n\* ไม่สามารถใช้ในการฝึกฝนแบบตัวต่อตัวได้',
    actions: [
      {
        label: 'Buy More at the Shop',
        onClick: () => {
          openAppPath('/shop');

        }
      },
      // {
      //   label: 'Try In Battle Field',
      //   onClick: () => {
      //     window.open('/#/arena', '_blank', 'noopener,noreferrer');
      //   },
      //   variant: 'dark'
      // }
    ],
  },
  [ITEMS.AMBROSIA]: {
    usage:
      '\* สามารถใช้ได้ระหว่างการต่อสู้เท่านั้น\
      \n\* ไม่สามารถใช้ในการฝึกฝนแบบตัวต่อตัวได้',
    actions: [
      {
        label: 'Buy More at the Shop',
        onClick: () => {
          openAppPath('/shop');

        }
      },
      // {
      //   label: 'Try In Battle Field',
      //   onClick: () => {
      //     window.open('/#/arena', '_blank', 'noopener,noreferrer');
      //   },
      //   variant: 'dark'
      // }
    ],
  },
  [ITEMS.NECTAR]: {
    usage:
      '\* สามารถใช้ได้ระหว่างการต่อสู้เท่านั้น\
      \n\* ไม่สามารถใช้ในการฝึกฝนแบบตัวต่อตัวได้',
    actions: [
      {
        label: 'Buy More at the Shop',
        onClick: () => {
          openAppPath('/shop');

        }
      },
      // {
      //   label: 'Try In Battle Field',
      //   onClick: () => {
      //     window.open('/#/arena', '_blank', 'noopener,noreferrer');
      //   },
      //   variant: 'dark'
      // }
    ],
  },
  [ITEMS.NEMESIS_S_JUSTICE_COOKIE]: {
    usage:
      '\* หากไม่พอใจกับพรที่ได้รับ ใช้ไอเทมนี้เพื่อให้ตนหลุดพ้นจากคำของเหล่าทวยเทพ\
      \n\* เมื่อยืนยันการใช้ไอเทมแล้ว คุกกี้จะถูกใช้ 1 ชิ้นและไม่สามารถย้อนคืนได้',
    actions: [],
    sections: [
      {
        kind: 'todayWish',
        title: 'Today\'s Wish of Iris',
      }
    ],
  },
  [ITEMS.CAMP_TSHIRT]: {
    usage:
      '\* เสื้อยืดของเป็นไอเทมแบบ passive ส่งผลอัตโนมัติเมื่อมีอยู่ในกระเป๋า\
    \n\* สามารถใช้งานได้ในการฝึกฝนแบบทอยลูกเต๋าประจำวันกับสตาฟ ผลบวกจะถูกรวมเข้าผับผลลัพธ์การทิยเต๋าแต่ละครั้งอัตโนมัติ',
    actions: [
      {
        label: 'Training In Normal Training',
        onClick: () => {
          openAppPath('/training-grounds/guided');
        }
      },
    ],
  },
  [ITEMS.QUEST_KEEPER]: {
    usage:
      '\* แฟ้มเก็บประวัติภารกิจเป็นไอเทมแบบ passive ที่จะส่งผลโดยอัตโนมัติเมื่อมีอยู่ในกระเป๋า\
      \n\* หากมีแฟ้มเก็บประวัติภารกิจในกระเป๋า ผู้ครอบครองจะได้รับ 30 ดรัคมาทุกครั้งที่ทำเควสบอร์ดสำเร็จ\
      \n\* โบนัสจะถูกนำไปใช้โดยอัตโนมัติหลังจากการทำเควสบอร์ดลุล่วงแต่ละครั้ง',
    actions: [
      {
        label: 'Pick Up A Quest',
        onClick: () => {
          window.open('https://x.com/HBxCC_AUstaff?s=20', '_blank', 'noopener,noreferrer');
        }
      },
    ],
  },
  [ITEMS.NIKE_S_STATUE]: {
    usage:
      '\* รูปปั้นแห่งชัยชนะเป็นไอเทมแบบ passive ที่จะส่งผลโดยอัตโนมัติเมื่อมีอยู่ในกระเป๋า\
      \n\* หากคุณมีรูปปั้นแห่งชัยชนะในกระเป๋า คุณจะได้รับเงิน 30 ดรัคมาทุกครั้งที่อัพเกรดทักษะของตนในสนามฝึกซ้อม\
      \n\* โบนัสจะถูกนำไปใช้โดยอัตโนมัติหลังจากการอัพเกรดทักษะแต่ละครั้ง\
      \n\* ไม่จำกัดจำนวนโบนัสที่สามารถได้รับจากรูปปั้นแห่งชัยชนะ',
  },
  [ITEMS.HERMES_S_PURSE]: {
    usage:
      '\* กระเป๋าเงินเทพจรลีเป็นไอเทมแบบ passive ที่จะส่งผลโดยอัตโนมัติเมื่อมีอยู่ในกระเป๋า\
      \n\* หลังจากได้รับกระเป๋าเงินเทพจรลีและมีรายได้เข้ากระเป๋าครบ 1000 ดรัคมาโดยไม่หักค่าใช้จ่าย ผู้ครอบครองจะได้รับโบนัสดรัคมา 500 ดรัคมาในทันที\
      \n\* โบนัสจะถูกมอบให้ผู้ครอบครองโดยอัตโนมัติเมื่อเงื่อนไขครบถ้วนและจะไม่สามารถย้อนคืนได้',
    actions: [],
    sections: [
      {
        kind: 'incomeTracker',
        title: 'Your Income Count',
      }
    ],
  },
  [ITEMS.IRIS_KEYCHAIN]: {
    usage:
      '\* พวงกุญแจไอริสเป็นไอเทมแบบ passive ที่จะตรวจสอบความคืบหน้าของคำอธิษฐานที่ได้รับจากไอริส\
      \n\* เมื่อผู้ครอบครองได้รับคำอธิษฐานจากเทพทุกองค์ครบถ้วน จะได้รับเงิน 5000 ดรัคมาอัตโนมัติ\
      \n\* โบนัสนี้จะมอบให้เพียงครั้งเดียวเท่านั้น',
    actions: [],
    sections: [
      {
        kind: 'wishesProgress',
        title: 'Your Wishes Progress',
      }
    ],
  },
  [ITEMS.RAINBOW_DRACHMA]: {
    usage:
      '\* เหรียญดรัคมาสายรุ้งเป็นไอเทมแบบ passive ที่จะส่งผลโดยอัตโนมัติเมื่อมีอยู่ในกระเป๋า\
      \n\* หากมีเหรียญดรัคมาสายรุ้งในกระเป๋า ผู้ครอบครองจะได้รับ 30 ดรัคมาทุกครั้งที่สุ่มพรที่น้ำพุไอริส\
      \n\* โบนัสจะถูกนำไปใช้โดยอัตโนมัติหลังจากการสุ่มพรแต่ละครั้งที่น้ำพุไอริส โดยมีผล 1 ครั้งต่อวันเท่านั้น',
    actions: [
      {
        label: 'Toss a Coin at Iris Fountain',
        onClick: () => {
          openAppPath('/iris-message');
        }
      },
    ],
  },
  [ITEMS.SKIP_TICKET]: {
    usage:
      '\* ตั๋ว 1 ใบมีค่าเท่ากับ 200 ตัวอักษรในโรลเพลย์\
      \n\* เมื่อใช้แล้ว รางวัลที่จะได้รับต้องรอการอนุมัตืจากสตาฟก่อนเสมอ',
    actions: [
      {
        label: 'Submit Training Roleplay',
        onClick: () => {
          openAppPath('/training-roleplay-submission');
        }
      },
    ],
    note: 'สามารถใช้ได้หลายใบ ตามจำนวนตัวอักษรที่ต้องการข้าม',
  },
  [ITEMS.UPGRADE_GUARANTEE_TICKET]: {
    usage:
      '\* ตั๋วเพิ่มโอกาสการอัปเกรดสามารถใช้ได้กับการอัปเกรดอุปกรณ์พื้นฐานในทั่งแห่งเฮเฟตัส\
      \n\* เมื่อใช้ตั๋วนี้ก่อนการอัปเกรดอุปกรณ์พื้นฐาน จะทำให้การอัปเกรดนั้นมีโอกาสสำเร็จสูงขึ้น\
      \n\* จำนวนสูงสุดในการใช้ตั๋วนี้ได้ต่อการอัปเกรดอุปกรณ์พื้นฐานแต่ละครั้งคือจนกว่าโอกาสการอัปเกรดจะครบ 100% โดยจะต้องใช้ก่อนการอัปเกรดและไม่สามารถใช้ย้อนหลังได้หลังจากที่การอัปเกรดเสร็จสมบูรณ์',
    actions: [
      {
        label: 'Upgrade Equipment',
        onClick: () => {
          openAppPath('/forge');
        }
      },
    ],
  },
  [ITEMS.REFUND_SKILL_TICKET]: {
    usage:
      '\* ตั๋วคืนค่าทักษะสามารถใช้เพื่อขอคืนค่าทักษะทั้งหมดที่ใช้ไปในการฝึกซ้อมของตน\
      \n\* การใช้ตั๋วนี้จะย้อนคืนทักษะทั้งหมดเป็น 0 และคืนแต้มทักษะทั้งหมดแก่ผู้ใช้งาน',
    actions: [
      {
        label: 'See Your Training Stats',
        onClick: () => {
          openAppPath('/training-grounds');
        }
      },
    ],
  },
  [ITEMS.ATHENA_S_CODEX]: {
    usage:
      '\* ตำราทักษะแห่งปัญญาสามารถใช้ในในหน้าแสดงผลทักษะในสนามฝึกซ้อมหรือกดใช้ด้านล่าง\
      \n\* เมื่อใช้ตำราทักษะแห่งปัญญา ผู้เรียกใช้จะได้รับแต้มการฝึกซ้อม 3 แต้มทันที',
    sections: [
      {
        kind: 'trainingPoints',
        title: 'Your Training Points',
      }
    ],
    actions: [
      {
        label: 'See Your Training Stats',
        onClick: () => {
          openAppPath('/training-grounds');
        }
      },
    ],
  },
  [ITEMS.DEMETER_S_GARDENING_SET]: {
    usage: 
      '\* ชุดอุปกรณ์ทำสวนของเทพีดีมิเทอร์จะถูกใช้ 1 ชุดต่อผลงานการเก็บเกี่ยวที่ได้รับการอนุมัติ 1 ครั้ง\
      \n\* หากมีชุดอุปกรณ์ในกระเป๋า ผู้โรลเพลย์ทุกคนในผลงานนั้นจะได้รับโบนัสการเก็บเกี่ยวโดยอัตโนมัติเมื่อผลงานได้รับการอนุมัติ\
      \n\* ชุดอุปกรณ์จะถูกหักจากกระเป๋าโดยอัตโนมัติพร้อมกับการมอบโบนัสเมื่อสตาฟอนุมัติผลงานการเก็บเกี่ยว',
    actions: [
      {
        label: 'Join Harvesting',
        onClick: () => {
          openAppPath('/strawberry-fields');
        }
      },
    ],
  },
};
