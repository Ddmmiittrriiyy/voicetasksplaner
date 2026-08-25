// parser.ru.js — Russian date/time phrase parsing.
//
// Note: plain \b word boundaries in JS regex only recognize ASCII
// [A-Za-z0-9_] as "word" characters, so \bзавтра\b silently fails to match
// at the start of a Cyrillic word. B/A below are Unicode-aware boundary
// lookarounds (require the 'u' flag on every regex that uses them).
import {
  resolveHour, resolveAmbiguousHour, PERIOD_DEFAULT_HOUR,
  dateForToday, dateForTomorrow, dateForDayAfterTomorrow, dateForWeekday,
  dateFromNumeric, dateFromMonthName, stripMatches
} from './parserShared.js';
import { toHHmm } from './parser.js';

const B = '(?<![\\p{L}\\p{N}_])';
const A = '(?![\\p{L}\\p{N}_])';

const NUMBER_WORDS = {
  'один': 1, 'одна': 1, 'два': 2, 'две': 2, 'три': 3, 'четыре': 4,
  'пять': 5, 'шесть': 6, 'семь': 7, 'восемь': 8, 'девять': 9,
  'десять': 10, 'одиннадцать': 11, 'двенадцать': 12
};
const NUMBER_WORD_ALT = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join('|');

// -> am/pm bucket
const PERIOD_WORDS = {
  'утра': 'am', 'ночи': 'am',
  'дня': 'pm', 'после обеда': 'pm', 'вечера': 'pm', 'вечером': 'pm'
};
const PERIOD_WORD_ALT = Object.keys(PERIOD_WORDS).sort((a, b) => b.length - a.length).join('|');
const PERIOD_TO_DEFAULT = { 'утра': 'morning', 'ночи': 'night', 'дня': 'day', 'после обеда': 'day', 'вечера': 'evening', 'вечером': 'evening' };

const WEEKDAYS = {
  'понедельник': 'monday',
  'вторник': 'tuesday',
  'среду': 'wednesday', 'среда': 'wednesday',
  'четверг': 'thursday',
  'пятницу': 'friday', 'пятница': 'friday',
  'субботу': 'saturday', 'суббота': 'saturday',
  'воскресенье': 'sunday'
};
const WEEKDAY_ALT = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join('|');

const MONTHS = {
  'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3, 'мая': 4, 'июня': 5,
  'июля': 6, 'августа': 7, 'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11
};
const MONTH_ALT = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

export function parseRu(text, now) {
  const matches = [];
  const warnings = [];
  let date = null;
  let time = null;
  let dateConfidence = null;
  let timeConfidence = null;

  // ---- DATE -------------------------------------------------------
  let m;
  if ((m = text.match(new RegExp(`${B}послезавтра${A}`, 'iu')))) {
    date = dateForDayAfterTomorrow(now).date; dateConfidence = 'exact'; matches.push(m[0]);
  } else if ((m = text.match(new RegExp(`${B}завтра${A}`, 'iu')))) {
    date = dateForTomorrow(now).date; dateConfidence = 'exact'; matches.push(m[0]);
  } else if ((m = text.match(new RegExp(`${B}сегодня${A}`, 'iu')))) {
    date = dateForToday(now).date; dateConfidence = 'exact'; matches.push(m[0]);
  } else if ((m = text.match(new RegExp(`${B}(\\d{1,2})\\s+(${MONTH_ALT})${A}`, 'iu')))) {
    date = dateFromMonthName(m[1], MONTHS[m[2].toLowerCase()], now); dateConfidence = 'exact'; matches.push(m[0]);
  } else if ((m = text.match(new RegExp(`${B}(\\d{1,2})[.\\/](\\d{1,2})(?:[.\\/](\\d{2,4}))?${A}`, 'u')))) {
    date = dateFromNumeric(m[1], m[2], m[3], now); dateConfidence = 'exact'; matches.push(m[0]);
  } else if ((m = text.match(new RegExp(`${B}в\\s+(${WEEKDAY_ALT})${A}`, 'iu')))) {
    date = dateForWeekday(now, WEEKDAYS[m[1].toLowerCase()]).date; dateConfidence = 'exact'; matches.push(m[0]);
  }

  // ---- TIME ---------------------------------------------------------
  // 1) explicit HH:MM with optional period word
  if ((m = text.match(new RegExp(`${B}в\\s+(\\d{1,2})[:.](\\d{2})(?:\\s+(${PERIOD_WORD_ALT}))?${A}`, 'iu')))) {
    const h = parseInt(m[1], 10);
    const mins = parseInt(m[2], 10);
    if (h >= 13) {
      time = toHHmm(h, mins); timeConfidence = 'exact';
    } else if (m[3]) {
      const bucket = PERIOD_WORDS[m[3].toLowerCase()];
      time = toHHmm(resolveHour(h, bucket), mins); timeConfidence = 'exact';
    } else {
      time = toHHmm(resolveAmbiguousHour(h), mins); timeConfidence = 'inferred';
      warnings.push('ambiguous_time_default');
    }
    matches.push(m[0]);
  }
  // 2) word-number "два часа дня" / digit-number "2 часа дня"
  else if ((m = text.match(new RegExp(`${B}в\\s+(${NUMBER_WORD_ALT}|\\d{1,2})\\s+час(?:а|ов)?\\s+(${PERIOD_WORD_ALT})${A}`, 'iu')))) {
    const raw = m[1].toLowerCase();
    const h = NUMBER_WORDS[raw] ?? parseInt(raw, 10);
    const bucket = PERIOD_WORDS[m[2].toLowerCase()];
    time = toHHmm(resolveHour(h, bucket), 0); timeConfidence = 'exact';
    matches.push(m[0]);
  }
  // 3) digit/word number directly followed by period word, no "час"
  else if ((m = text.match(new RegExp(`${B}в\\s+(${NUMBER_WORD_ALT}|\\d{1,2})\\s+(${PERIOD_WORD_ALT})${A}`, 'iu')))) {
    const raw = m[1].toLowerCase();
    const h = NUMBER_WORDS[raw] ?? parseInt(raw, 10);
    const bucket = PERIOD_WORDS[m[2].toLowerCase()];
    time = toHHmm(resolveHour(h, bucket), 0); timeConfidence = 'exact';
    matches.push(m[0]);
  }
  // 4) period word alone, no number ("вечером встреча")
  else if ((m = text.match(new RegExp(`${B}(${PERIOD_WORD_ALT})${A}`, 'iu')))) {
    const key = PERIOD_TO_DEFAULT[m[1].toLowerCase()];
    time = toHHmm(PERIOD_DEFAULT_HOUR[key], 0); timeConfidence = 'inferred';
    warnings.push('period_word_default_time');
    matches.push(m[0]);
  }
  // 5) bare ambiguous number "в 2"
  else if ((m = text.match(new RegExp(`${B}в\\s+(\\d{1,2})${A}`, 'u')))) {
    const h = parseInt(m[1], 10);
    time = toHHmm(resolveAmbiguousHour(h), 0); timeConfidence = 'inferred';
    warnings.push('ambiguous_time_default');
    matches.push(m[0]);
  }

  const cleanedText = stripMatches(text, matches);
  // Overall confidence is only 'exact' if every field we found was exact;
  // any inferred field (e.g. a bare period word, an ambiguous bare hour)
  // downgrades the whole result so the UI can flag it for the user.
  let confidence = 'none';
  if (dateConfidence || timeConfidence) confidence = 'exact';
  if (dateConfidence === 'inferred' || timeConfidence === 'inferred') confidence = 'inferred';

  return { text: cleanedText, date, time, confidence, warnings };
}
