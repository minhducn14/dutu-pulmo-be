import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import {
  addMinutes as addMins,
  addHours as addHrs,
  addDays as addDys,
} from 'date-fns';

export const VN_TZ = 'Asia/Ho_Chi_Minh';

// "Now" for business logic in VN zone, returned as a UTC Date (safe to store as timestamptz)
export function vnNow(): Date {
  // Take current instant, view in VN, then convert back to UTC instant for storage
  const now = new Date();
  const vnView = toZonedTime(now, VN_TZ);
  return fromZonedTime(vnView, VN_TZ);
}

// Returns the start of the day in VN time (00:00:00.000), converted to UTC Date
export function startOfDayVN(date: Date): Date {
  // 1. Convert input date (UTC) to VN time (Date object representing local time components)
  const vnView = toZonedTime(date, VN_TZ);
  // 2. Set time to 00:00:00
  vnView.setHours(0, 0, 0, 0);
  // 3. Convert back to UTC considering VN_TZ
  return fromZonedTime(vnView, VN_TZ);
}

// Returns the end of the day in VN time (23:59:59.999), converted to UTC Date
export function endOfDayVN(date: Date): Date {
  const vnView = toZonedTime(date, VN_TZ);
  vnView.setHours(23, 59, 59, 999);
  return fromZonedTime(vnView, VN_TZ);
}

// Wrapper for differenceInMinutes to be explicit
import { differenceInMinutes, isBefore, isAfter } from 'date-fns';

export function diffMinutes(dateLeft: Date, dateRight: Date): number {
  return differenceInMinutes(dateLeft, dateRight);
}

export function isBeforeVN(date: Date, dateToCompare: Date): boolean {
  return isBefore(date, dateToCompare);
}

export function isAfterVN(date: Date, dateToCompare: Date): boolean {
  return isAfter(date, dateToCompare);
}

// Add helpers that do arithmetic in VN zone then return UTC Date for storage/compare
export function addMinutesVN(base: Date, minutes: number): Date {
  const vn = toZonedTime(base, VN_TZ);
  const vnPlus = addMins(vn, minutes);
  return fromZonedTime(vnPlus, VN_TZ);
}
export function addHoursVN(base: Date, hours: number): Date {
  const vn = toZonedTime(base, VN_TZ);
  const vnPlus = addHrs(vn, hours);
  return fromZonedTime(vnPlus, VN_TZ);
}
export function addDaysVN(base: Date, days: number): Date {
  const vn = toZonedTime(base, VN_TZ);
  const vnPlus = addDys(vn, days);
  return fromZonedTime(vnPlus, VN_TZ);
}


// Get day of week (0-6) in VN timezone
export function getDayVN(date: Date): number {
  const vn = toZonedTime(date, VN_TZ);
  return vn.getDay();
}

