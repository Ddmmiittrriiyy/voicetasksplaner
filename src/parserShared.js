// parserShared.js
// Number-word / weekday / month lookup tables shared by parser.ru.js,
// parser.uk.js and parser.en.js. Not part of the original file list in the
// spec's architecture section, but split out to avoid duplicating these
// tables three times (parser.js still delegates per language as required).

import { toISODate, addDays, nextWeekday, WEEKDAY_INDEX } from './parser.js';

// ---- Hour resolution -------------------------------------------------
// periodType: 'am' (morning/night) or 'pm' (day/afternoon/evening)
// h is a 1-12 human-spoken hour. Returns 0-23.
export function resolveHour(h, periodType) {
  let hh = h % 12;
  if (periodType === 'pm') hh += 12;
  return hh;
}

// Documented default for ambiguous bare numbers ("at 2", "в 2") with no
// am/pm/period word attached: 1-7 default to afternoon/evening (PM),
// 8-11 default to morning (AM), 12 -> noon, 0 -> midnight.
// Rationale: matches everyday planning speech ("at 2" almost always means
// 2pm; "at 9" almost always means 9am) more often than a fixed rule.
export function resolveAmbiguousHour(h) {
  if (h === 0) return 0;
  if (h === 12) return 12;
  if (h >= 1 && h <= 7) return h + 12;
  return h; // 8-11
}

// Fallback clock time used when only a period word is present with no
// explicit number ("Friday evening", "вечером").
export const PERIOD_DEFAULT_HOUR = {
  morning: 9,
  day: 13,
  evening: 18,
  night: 21
};

// ---- Date helpers ------------------------------------------------------

export function dateForToday(now) {
  return { date: toISODate(now), matched: true };
}

export function dateForTomorrow(now) {
  return { date: toISODate(addDays(now, 1)), matched: true };
}

export function dateForDayAfterTomorrow(now) {
  return { date: toISODate(addDays(now, 2)), matched: true };
}

export function dateForWeekday(now, dowKey) {
  const idx = WEEKDAY_INDEX[dowKey];
  return { date: toISODate(nextWeekday(now, idx)), matched: true };
}

/** Numeric date like 5.03, 05/03, 5.03.2026 -> YYYY-MM-DD (day.month[.year]) */
export function dateFromNumeric(dayStr, monthStr, yearStr, now) {
  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10);
  if (!day || !month || month < 1 || month > 12 || day < 1 || day > 31) return null;
  let year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();
  if (yearStr && yearStr.length === 2) year += 2000;
  const d = new Date(year, month - 1, day);
  if (!yearStr && d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    // Bare "5.03" that already passed this year most likely means next year.
    d.setFullYear(year + 1);
  }
  return toISODate(d);
}

export function dateFromMonthName(dayStr, monthIdx, now) {
  const day = parseInt(dayStr, 10);
  if (!day || monthIdx == null) return null;
  let year = now.getFullYear();
  let d = new Date(year, monthIdx, day);
  if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    d = new Date(year + 1, monthIdx, day);
  }
  return toISODate(d);
}

// Remove a set of matched substrings from the source text and collapse
// whitespace/punctuation left behind.
export function stripMatches(text, matches) {
  let out = text;
  for (const m of matches) {
    if (!m) continue;
    out = out.replace(m, ' ');
  }
  return out
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
    .trim();
}
