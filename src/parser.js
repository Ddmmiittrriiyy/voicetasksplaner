// parser.js
// Language-agnostic entry point for date/time parsing.
// Delegates to per-language modules (parser.ru.js, parser.uk.js, parser.en.js).
// Contract (see PRODUCT_SPEC section 12):
// parse(input, lang, now) => {
//   text: string,            // input with date/time phrase removed
//   date: 'YYYY-MM-DD'|null,
//   time: 'HH:mm'|null,
//   confidence: 'exact'|'inferred'|'none',
//   warnings: string[]
// }

import { parseRu } from './parser.ru.js';
import { parseUk } from './parser.uk.js';
import { parseEn } from './parser.en.js';

/**
 * Format a Date object as YYYY-MM-DD using LOCAL time fields (never UTC,
 * to avoid off-by-one day bugs near midnight / timezone boundaries).
 */
export function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toHHmm(hours, minutes) {
  const h = String(hours).padStart(2, '0');
  const m = String(minutes).padStart(2, '0');
  return `${h}:${m}`;
}

/** Returns a new Date offset by N days (local time), time-of-day zeroed. */
export function addDays(base, n) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + n);
  return d;
}

// 0 = Sunday ... 6 = Saturday, matches JS Date#getDay()
export const WEEKDAY_INDEX = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6
};

/**
 * Returns the date of the next occurrence of `targetDow` (0-6).
 * If today is that weekday, returns *next week's* occurrence (documented
 * default: "in Friday" said on a Friday means next Friday, not today),
 * matching the spec's "next Friday" examples.
 */
export function nextWeekday(base, targetDow) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const currentDow = d.getDay();
  let delta = targetDow - currentDow;
  if (delta <= 0) delta += 7;
  d.setDate(d.getDate() + delta);
  return d;
}

/**
 * Clamp an hour 0-23, wrapping safely. Used defensively; inputs are
 * expected to already be in range from the phrase tables.
 */
export function clampHour(h) {
  return Math.max(0, Math.min(23, h));
}

export function parse(input, lang, now = new Date()) {
  const text = (input || '').trim();
  if (!text) {
    return { text: '', date: null, time: null, confidence: 'none', warnings: ['empty_input'] };
  }
  switch (lang) {
    case 'ru':
      return parseRu(text, now);
    case 'uk':
      return parseUk(text, now);
    case 'en':
      return parseEn(text, now);
    default:
      return { text, date: null, time: null, confidence: 'none', warnings: ['unsupported_lang'] };
  }
}
