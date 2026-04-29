export const APP_TIME_ZONE = 'Asia/Bangkok';

const APP_DATE_KEY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
});

export const getAppDateString = (date: Date | string | number): string => {
  return APP_DATE_KEY_FORMATTER.format(new Date(date));
};

export const formatAppDate = (
  date: Date | string | number,
  locale: string = 'en-US',
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
): string => {
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: APP_TIME_ZONE,
  }).format(new Date(date));
};

export const formatAppTime = (
  date: Date | string | number,
  locale?: string,
  options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  }
): string => {
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: APP_TIME_ZONE,
  }).format(new Date(date));
};

export const formatAppDateTime = (
  date: Date | string | number,
  locale?: string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }
): string => {
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: APP_TIME_ZONE,
  }).format(new Date(date));
};

// Get today's date in YYYY-MM-DD format
export const getTodayDate = (): string => {
  return getAppDateString(new Date());
};

// Get previous date in YYYY-MM-DD format
export function getPreviousDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return getAppDateString(date);
}