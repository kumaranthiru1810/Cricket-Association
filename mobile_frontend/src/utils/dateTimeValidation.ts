/**
 * mobile_frontend/src/utils/dateTimeValidation.ts
 * Date and Time validation utilities for Cricket Federation match scheduling.
 *
 * Strict validation rules:
 * 1. Timezone: Asia/Kolkata (IST, UTC+05:30)
 * 2. Prevent Past Dates: Match date cannot be before today's date in Asia/Kolkata.
 * 3. Prevent Past Times: If match date is today, match time must be later than current local time in Asia/Kolkata.
 *    If match date is a future date, any valid match time is permitted.
 * 4. Empty or invalid date / time formats are strictly rejected.
 */

export const SCHEDULE_TIMEZONE = 'Asia/Kolkata';

export interface KolkataNowInfo {
  dateStr: string; // YYYY-MM-DD
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMinutes: number;
  timeFormatted12: string; // e.g. "09:30 AM"
  timeFormatted24: string; // e.g. "09:30"
}

export interface ParsedTimeInfo {
  hours: number;
  minutes: number;
  totalMinutes: number;
  formatted12: string;
  formatted24: string;
}

export interface DateValidationResult {
  isValid: boolean;
  error?: string | null;
  code: string;
  isPastDate: boolean;
  isToday: boolean;
  isFuture: boolean;
  todayStr: string;
  cleanDate: string;
}

export interface TimeValidationResult {
  isValid: boolean;
  error?: string | null;
  code: string;
  isPastTime: boolean;
  isToday: boolean;
  parsedTime?: ParsedTimeInfo;
  currentTimeIST: string;
}

export interface ScheduleDateTimeValidationResult {
  isValid: boolean;
  error?: string | null;
  code: string;
  dateError?: string | null;
  timeError?: string | null;
  isPastDate: boolean;
  isPastTime: boolean;
  isToday: boolean;
  cleanDate: string;
  parsedTime?: ParsedTimeInfo;
  todayStr: string;
  currentTimeIST: string;
}

/**
 * Returns current timestamp details strictly in Asia/Kolkata (IST) timezone.
 */
export function getKolkataNow(): KolkataNowInfo {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: SCHEDULE_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const p: Record<string, string> = {};
    for (const part of parts) {
      p[part.type] = part.value;
    }
    const year = parseInt(p.year, 10);
    const month = parseInt(p.month, 10);
    const day = parseInt(p.day, 10);
    const hours = parseInt(p.hour, 10);
    const minutes = parseInt(p.minute, 10);
    const seconds = parseInt(p.second || '0', 10);
    const dateStr = `${p.year}-${p.month}-${p.day}`;

    return {
      dateStr,
      year,
      month,
      day,
      hours,
      minutes,
      seconds,
      totalMinutes: hours * 60 + minutes,
      timeFormatted12: formatTime12(hours, minutes),
      timeFormatted24: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    };
  } catch (_err) {
    // Fallback: UTC + 5h30m
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const kolkataMs = utcMs + 5.5 * 3600000;
    const kd = new Date(kolkataMs);
    const y = kd.getFullYear();
    const m = String(kd.getMonth() + 1).padStart(2, '0');
    const d = String(kd.getDate()).padStart(2, '0');
    const hours = kd.getHours();
    const minutes = kd.getMinutes();
    const seconds = kd.getSeconds();
    const dateStr = `${y}-${m}-${d}`;

    return {
      dateStr,
      year: y,
      month: kd.getMonth() + 1,
      day: kd.getDate(),
      hours,
      minutes,
      seconds,
      totalMinutes: hours * 60 + minutes,
      timeFormatted12: formatTime12(hours, minutes),
      timeFormatted24: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    };
  }
}

/**
 * Returns today's date in Asia/Kolkata timezone as YYYY-MM-DD.
 */
export function getTodayKolkata(): string {
  return getKolkataNow().dateStr;
}

/**
 * Returns a future date in Asia/Kolkata timezone offset by given number of days.
 */
export function getFutureDateKolkata(daysAhead: number): string {
  const now = getKolkataNow();
  const d = new Date(Date.UTC(now.year, now.month - 1, now.day + daysAhead));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Formats hours (0-23) and minutes (0-59) to 12-hour string (e.g. "09:30 AM").
 */
export function formatTime12(hours: number, minutes: number): string {
  const period = hours >= 12 ? 'PM' : 'AM';
  let h12 = hours % 12;
  if (h12 === 0) h12 = 12;
  return `${String(h12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Parses time string in either 12-hour or 24-hour format into structured components.
 */
export function parseTimeString(timeStr?: string): ParsedTimeInfo | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const modifier = match[4] ? match[4].toUpperCase() : null;

  if (isNaN(hours) || isNaN(minutes) || minutes < 0 || minutes > 59) {
    return null;
  }

  if (modifier) {
    if (hours < 1 || hours > 12) return null;
    if (modifier === 'AM') {
      if (hours === 12) hours = 0;
    } else if (modifier === 'PM') {
      if (hours !== 12) hours += 12;
    }
  } else {
    if (hours < 0 || hours > 23) return null;
  }

  return {
    hours,
    minutes,
    totalMinutes: hours * 60 + minutes,
    formatted12: formatTime12(hours, minutes),
    formatted24: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  };
}

/**
 * Parses a date string into { year, month, day, cleanDate } where cleanDate is YYYY-MM-DD.
 * Supports:
 * - YYYY-MM-DD, YYYY/MM/DD
 * - DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY, D-M-YYYY
 */
export function parseScheduleDate(dateStr?: string): { year: number; month: number; day: number; cleanDate: string } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.split('T')[0].trim();
  if (!clean) return null;

  // Format 1: YYYY-MM-DD or YYYY/MM/DD
  let match = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    return {
      year,
      month,
      day,
      cleanDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    };
  }

  // Format 2: DD/MM/YYYY or DD-MM-YYYY or D/M/YYYY
  match = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    return {
      year,
      month,
      day,
      cleanDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    };
  }

  return null;
}

/**
 * Returns a guaranteed initial schedule date and time for when the user opens the modal.
 * Uses current date and current time in Asia/Kolkata so user can freely adjust as needed.
 */
export function getDefaultScheduleDateTime(): { date: string; time: string } {
  const now = getKolkataNow();
  return {
    date: now.dateStr,
    time: now.timeFormatted12
  };
}

/**
 * Real-time validator for match date alone.
 */
export function validateScheduleDate(matchDate?: string): DateValidationResult {
  const now = getKolkataNow();
  const todayStr = now.dateStr;

  if (!matchDate || !String(matchDate).trim()) {
    return {
      isValid: false,
      error: 'Match date is required.',
      code: 'MISSING_DATE',
      isPastDate: false,
      isToday: false,
      isFuture: false,
      todayStr,
      cleanDate: ''
    };
  }

  const parsed = parseScheduleDate(matchDate);
  if (!parsed) {
    return {
      isValid: false,
      error: 'Invalid match date format. Expected YYYY-MM-DD or DD/MM/YYYY.',
      code: 'INVALID_DATE_FORMAT',
      isPastDate: false,
      isToday: false,
      isFuture: false,
      todayStr,
      cleanDate: String(matchDate).trim()
    };
  }

  const { year, month, day, cleanDate } = parsed;

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return {
      isValid: false,
      error: 'Invalid calendar date specified.',
      code: 'INVALID_DATE_VALUE',
      isPastDate: false,
      isToday: false,
      isFuture: false,
      todayStr,
      cleanDate
    };
  }

  const testDate = new Date(Date.UTC(year, month - 1, day));
  if (testDate.getUTCMonth() !== month - 1 || testDate.getUTCDate() !== day) {
    return {
      isValid: false,
      error: 'Invalid calendar date specified.',
      code: 'INVALID_DATE_VALUE',
      isPastDate: false,
      isToday: false,
      isFuture: false,
      todayStr,
      cleanDate
    };
  }

  if (cleanDate < todayStr) {
    return {
      isValid: false,
      error: `Match date cannot be in the past (${cleanDate}). Matches must be scheduled for today (${todayStr}) or a future date.`,
      code: 'PAST_DATE',
      isPastDate: true,
      isToday: false,
      isFuture: false,
      todayStr,
      cleanDate
    };
  }

  const isToday = cleanDate === todayStr;
  const isFuture = cleanDate > todayStr;

  return {
    isValid: true,
    error: null,
    code: 'VALID_DATE',
    isPastDate: false,
    isToday,
    isFuture,
    todayStr,
    cleanDate
  };
}

/**
 * Real-time validator for match time alone given a date.
 */
export function validateScheduleTime(matchDate?: string, matchTime?: string): TimeValidationResult {
  const now = getKolkataNow();
  const parsedDate = parseScheduleDate(matchDate);
  const cleanDate = parsedDate ? parsedDate.cleanDate : (matchDate ? String(matchDate).split('T')[0].trim() : '');
  const isToday = cleanDate === now.dateStr;

  if (!matchTime || !String(matchTime).trim()) {
    return {
      isValid: false,
      error: 'Match start time is required.',
      code: 'MISSING_TIME',
      isPastTime: false,
      isToday,
      currentTimeIST: now.timeFormatted12
    };
  }

  const parsed = parseTimeString(matchTime);
  if (!parsed) {
    return {
      isValid: false,
      error: 'Invalid time format. Please enter e.g. "09:30 AM" or "14:30".',
      code: 'INVALID_TIME_FORMAT',
      isPastTime: false,
      isToday,
      currentTimeIST: now.timeFormatted12
    };
  }

  if (isToday) {
    if (parsed.totalMinutes < now.totalMinutes) {
      return {
        isValid: false,
        error: `Match time (${parsed.formatted12}) has already passed for today. Please select a time later than current time (${now.timeFormatted12} IST).`,
        code: 'PAST_TIME',
        isPastTime: true,
        isToday: true,
        parsedTime: parsed,
        currentTimeIST: now.timeFormatted12
      };
    }
  }

  return {
    isValid: true,
    error: null,
    code: 'VALID_TIME',
    isPastTime: false,
    isToday,
    parsedTime: parsed,
    currentTimeIST: now.timeFormatted12
  };
}

/**
 * Complete real-time validator for date and time combination.
 */
export function validateScheduleDateTime(matchDate?: string, matchTime?: string): ScheduleDateTimeValidationResult {
  const now = getKolkataNow();
  const dateResult = validateScheduleDate(matchDate);
  const timeResult = validateScheduleTime(matchDate, matchTime);

  let primaryError: string | null = null;
  let code = 'VALID';

  if (!dateResult.isValid && !timeResult.isValid) {
    primaryError = `${dateResult.error} ${timeResult.error}`;
    code = 'INVALID_DATE_AND_TIME';
  } else if (!dateResult.isValid) {
    primaryError = dateResult.error || 'Invalid match date.';
    code = dateResult.code;
  } else if (!timeResult.isValid) {
    primaryError = timeResult.error || 'Invalid match time.';
    code = timeResult.code;
  }

  return {
    isValid: dateResult.isValid && timeResult.isValid,
    error: primaryError,
    code,
    dateError: dateResult.error || null,
    timeError: timeResult.error || null,
    isPastDate: dateResult.isPastDate,
    isPastTime: timeResult.isPastTime,
    isToday: dateResult.isToday,
    cleanDate: dateResult.cleanDate,
    parsedTime: timeResult.parsedTime,
    todayStr: now.dateStr,
    currentTimeIST: now.timeFormatted12
  };
}

