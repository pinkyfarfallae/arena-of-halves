export const SHEET_ID = '1P3gaozLPryFY8itFVx7YzBTrFfdSn2tllTKJIMXVWOA';

const DEPLOYMENT_ID = 'AKfycbweva1V7MiIFC-QXXT6kR2B1ecXBJXohO-iW-ELrenemYaeDpyH6sVcffMIEbQcWj1ufQ';
export const APPS_SCRIPT_URL = `https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec`;

export const GID = {
  CHARACTER: '0',
  USER: '1495840634',
  POWERS: '979138238',
  WISHES: '198616624',
  ITEM_INFO: '403375390',
  CUSTOM_EQUIPMENT: '1866887317',
  SHOP: '819284917',
  HARVEST: '390673925',
  NPC: '1431163652',
  DAILY_TRAINING_DICE: '383013042',
  BIG_HOUSE_ROLEPLAY_SUBMISSION: '284757298',
} as const;

export type SheetKey = keyof typeof GID;

export const csvUrl = (gid: string) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}&_t=${Date.now()}&r=${Math.random()}`;
