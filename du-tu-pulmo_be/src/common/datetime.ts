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

// Format a Date for UI or gateways in VN local time
export function formatVN(date: Date, pattern: string): string {
  return formatInTimeZone(date, VN_TZ, pattern);
}

