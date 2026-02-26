export const SHEET_ID = '1P3gaozLPryFY8itFVx7YzBTrFfdSn2tllTKJIMXVWOA';

export const GID = {
  CHARACTER: '0',
  USER: '1495840634',
  POWERS: '979138238',
  WISHES: '198616624',
  ITEM_INFO: '403375390',
  WEAPON_INFO: '1866887317',
  PLAYER_BAG: '927684470',
  SHOP: '819284917',
} as const;

export const csvUrl = (gid: string) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
