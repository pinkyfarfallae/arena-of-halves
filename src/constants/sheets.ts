export const SHEET_ID = '1P3gaozLPryFY8itFVx7YzBTrFfdSn2tllTKJIMXVWOA';

const DEPLOYMENT_ID = 'AKfycbzLNGoDviTk_MZEEqBkKk45WaQbP4dzzXn-ONZP4FzuGeqnOtPuRKfgo8fOB-BPH-NE';
export const APPS_SCRIPT_URL = `https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec`;

export const SECRET_SHEET_ID = '1aIzkjzkP6WaW-CgLbckPEqV4xYdJbITZOJwFPUkdUHw';
export const SECRET_GID = {
  USER: '0',
  CHARACTER: '927608720',
} as const;

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

export const secretCsvUrl = (gid: string) =>
  `https://docs.google.com/spreadsheets/d/${SECRET_SHEET_ID}/export?format=csv&gid=${gid}&_t=${Date.now()}&r=${Math.random()}`;
