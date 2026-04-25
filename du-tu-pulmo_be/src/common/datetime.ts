import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import {
  addMinutes as addMins,
  addHours as addHrs,
  addDays as addDys,
  differenceInMinutes,
  isBefore,
  isAfter,
} from 'date-fns';

export const VN_TZ = 'Asia/Ho_Chi_Minh';

// 🔥 bật/tắt log tại đây
const ENABLE_TZ_LOG = true;

// 🔥 helper log chuẩn
function logTZ(label: string, date: Date) {
  if (!ENABLE_TZ_LOG) return;

  console.log(`🧪 [${label}]`);
  console.log('  Raw:', date);
  console.log('  ISO:', date.toISOString());
  console.log('  VN:', formatInTimeZone(date, VN_TZ, 'yyyy-MM-dd HH:mm:ss'));
  console.log('----------------------');
}

/**
 * 🔥 FIX CORE
 */
function normalizeDateInput(date: Date): Date {
  const isUTCMidnight =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0;

  if (isUTCMidnight) {
    const iso = date.toISOString().slice(0, 10);

    if (ENABLE_TZ_LOG) {
      console.log('⚠️ [TZ FIX DETECTED]');
      logTZ('Raw Input', date);
      console.log('  Convert →', iso + 'T00:00:00+07:00');
    }

    const fixed = new Date(iso + 'T00:00:00+07:00');

    logTZ('Fixed Date', fixed);

    return fixed;
  }

  return date;
}

// ------------------------

export function vnNow(): Date {
  const now = new Date();
  const vnView = toZonedTime(now, VN_TZ);
  const result = fromZonedTime(vnView, VN_TZ);

  logTZ('vnNow', result);
  return result;
}

// ------------------------

export function startOfDayVN(date: Date): Date {
  const safeDate = normalizeDateInput(date);

  logTZ('startOfDayVN - input', safeDate);

  const vnView = toZonedTime(safeDate, VN_TZ);
  vnView.setHours(0, 0, 0, 0);

  const result = fromZonedTime(vnView, VN_TZ);

  logTZ('startOfDayVN - result', result);

  return result;
}

export function endOfDayVN(date: Date): Date {
  const safeDate = normalizeDateInput(date);

  const vnView = toZonedTime(safeDate, VN_TZ);
  vnView.setHours(23, 59, 59, 999);

  const result = fromZonedTime(vnView, VN_TZ);

  logTZ('endOfDayVN', result);

  return result;
}

// ------------------------

export function diffMinutes(dateLeft: Date, dateRight: Date): number {
  return differenceInMinutes(dateLeft, dateRight);
}

export function isBeforeVN(date: Date, dateToCompare: Date): boolean {
  return isBefore(date, dateToCompare);
}

export function isAfterVN(date: Date, dateToCompare: Date): boolean {
  return isAfter(date, dateToCompare);
}

// ------------------------

export function addMinutesVN(base: Date, minutes: number): Date {
  const safeBase = normalizeDateInput(base);

  const vn = toZonedTime(safeBase, VN_TZ);
  const vnPlus = addMins(vn, minutes);

  const result = fromZonedTime(vnPlus, VN_TZ);

  logTZ('addMinutesVN', result);

  return result;
}

export function addHoursVN(base: Date, hours: number): Date {
  const safeBase = normalizeDateInput(base);

  const vn = toZonedTime(safeBase, VN_TZ);
  const vnPlus = addHrs(vn, hours);

  const result = fromZonedTime(vnPlus, VN_TZ);

  logTZ('addHoursVN', result);

  return result;
}

export function addDaysVN(base: Date, days: number): Date {
  const safeBase = normalizeDateInput(base);

  const vn = toZonedTime(safeBase, VN_TZ);
  const vnPlus = addDys(vn, days);

  const result = fromZonedTime(vnPlus, VN_TZ);

  logTZ('addDaysVN', result);

  return result;
}

// ------------------------

export function getDayVN(date: Date): number {
  const safeDate = normalizeDateInput(date);

  const vn = toZonedTime(safeDate, VN_TZ);

  logTZ('getDayVN', safeDate);

  return vn.getDay();
}

// ------------------------

export function isSameDayVN(date1: Date, date2: Date): boolean {
  const vn1 = toZonedTime(normalizeDateInput(date1), VN_TZ);
  const vn2 = toZonedTime(normalizeDateInput(date2), VN_TZ);

  return (
    vn1.getFullYear() === vn2.getFullYear() &&
    vn1.getMonth() === vn2.getMonth() &&
    vn1.getDate() === vn2.getDate()
  );
}

// ------------------------

export function formatDateVN(
  date: Date,
  formatStr: string = 'yyyy-MM-dd',
): string {
  return formatInTimeZone(normalizeDateInput(date), VN_TZ, formatStr);
}

// ------------------------

export function getTimeMinutesVN(date: Date): number {
  const vn = toZonedTime(normalizeDateInput(date), VN_TZ);
  return vn.getHours() * 60 + vn.getMinutes();
}

// ------------------------

export function startOfNextMonthVN(base: Date = vnNow()): Date {
  const safeBase = normalizeDateInput(base);

  const vn = toZonedTime(safeBase, VN_TZ);
  vn.setMonth(vn.getMonth() + 1);
  vn.setDate(1);
  vn.setHours(0, 0, 0, 0);

  const result = fromZonedTime(vn, VN_TZ);

  logTZ('startOfNextMonthVN', result);

  return result;
}

export function endOfNextMonthVN(base: Date = vnNow()): Date {
  const startNext = toZonedTime(startOfNextMonthVN(base), VN_TZ);

  const startAfterNext = new Date(startNext);
  startAfterNext.setMonth(startAfterNext.getMonth() + 1);

  const endNext = new Date(startAfterNext.getTime() - 1);

  const result = fromZonedTime(endNext, VN_TZ);

  logTZ('endOfNextMonthVN', result);

  return result;
}
