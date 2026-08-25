// parser.uk.js — Ukrainian date/time phrase parsing.
// See the note in parser.ru.js about Unicode-aware boundaries (B/A) —
// plain \b does not work on Cyrillic text in JS regex.
import {
  resolveHour, resolveAmbiguousHour, PERIOD_DEFAULT_HOUR,
  dateForToday, dateForTomorrow, dateForDayAfterTomorrow, dateForWeekday,
  dateFromNumeric, dateFromMonthName, stripMatches
} from './parserShared.js';
import { toHHmm } from './parser.js';

const B = '(?<![\\p{L}\\p{N}_])';
const A = '(?![\\p{L}\\p{N}_])';

// Ordinal, locative-case hour words as used after "о"/"об".
const NUMBER_WORDS = {
  'першій': 1, 'другій': 2, 'третій': 3, 'четвертій': 4, "п'ятій": 5,
  'шостій': 6, 'сьомій': 7, 'восьмій': 8, "дев'ятій": 9, 'десятій': 10,
  'одинадцятій': 11, 'дванадцятій': 12
};
const NUMBER_WORD_ALT = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join('|');

const PERIOD_WORDS = {
  'ранку': 'am', 'ночі': 'am',
  'дня': 'pm', 'удень': 'pm', 'у день': 'pm', 'після обіду': 'pm',
  'вечора': 'pm', 'увечері': 'pm', 'у вечорі': 'pm'
};
const PERIOD_WORD_ALT = Object.keys(PERIOD_WORDS).sort((a, b) => b.length - a.length).join('|');
const PERIOD_TO_DEFAULT = {
  'ранку': 'morning', 'ночі': 'night', 'дня': 'day', 'удень': 'day', 'у день': 'day',
  'після обіду': 'day', 'вечора': 'evening', 'увечері': 'evening', 'у вечорі': 'evening'
};

const WEEKDAYS = {
  'понеділок': 'monday',
  'вівторок': 'tuesday',
  'середу': 'wednesday', 'середа': 'wednesday',
  'четвер': 'thursday',
  "п'ятницю": 'friday', "п'ятниця": 'friday',
  'суботу': 'saturday', 'субота': 'saturday',
  'неділю': 'sunday', 'неділя': 'sunday'
};
const WEEKDAY_ALT = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join('|');

const MONTHS = {
  'січня': 0, 'лютого': 1, 'березня': 2, 'квітня': 3, 'травня': 4, 'червня': 5,
  'липня': 6, 'серпня': 7, 'вересня': 8, 'жовтня': 9, 'листопада': 10, 'грудня': 11
};
const MONTH_ALT = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

export function parseUk(text, now) {
  const matches = [];
  const warnings = [];
  let date = null, time = null, dateConfidence = null, timeConfidence = null;

  let m;
  if ((m = text.match(new RegExp(`${B}післязавтра${A}`, 'iu')))) {
    date = dateForDayAfterTomorrow(now).date; dateConfidence = 'exact'; matches.push(m[0]);
  } else if ((m = text.match(new RegExp(`${B}завтра${A}`, 'iu')))) {
    date = dateForTomorrow(now).date; dateConfidence = 'exact'; matches.push(m[0]);
  } else if ((m = text.match(new RegExp(`${B}сьогодні${A}`, 'iu')))) {
    date = dateForToday(now).date; dateConfidence = 'exact'; matches.push(m[0]);
  } else if ((m = text.match(new RegExp(`${B}(\\d{1,2})\\s+(${MONTH_ALT})${A}`, 'iu')))) {
    date = dateFromMonthName(m[1], MONTHS[m[2].toLowerCase()], now); dateConfidence = 'exact'; matches.push(m[0]);
  } else if ((m = text.match(new RegExp(`${B}(\\d{1,2})[.\\/](\\d{1,2})(?:[.\\/](\\d{2,4}))?${A}`, 'u')))) {
    date = dateFromNumeric(m[1], m[2], m[3], now); dateConfidence = 'exact'; matches.push(m[0]);
  } else if ((m = text.match(new RegExp(`${B}(?:в|у)?\\s*(${WEEKDAY_ALT})${A}`, 'iu')))) {
    date = dateForWeekday(now, WEEKDAYS[m[1].toLowerCase()]).date; dateConfidence = 'exact'; matches.push(m[0]);
  }

  // 1) explicit HH:MM with optional "о"/"об" and period word
  if ((m = text.match(new RegExp(`${B}об?\\s+(\\d{1,2})[:.](\\d{2})(?:\\s+(${PERIOD_WORD_ALT}))?${A}`, 'iu')))) {
    const h = parseInt(m[1], 10);
    const mins = parseInt(m[2], 10);
    if (h >= 13) {
      time = toHHmm(h, mins); timeConfidence = 'exact';
    } else if (m[3]) {
      time = toHHmm(resolveHour(h, PERIOD_WORDS[m[3].toLowerCase()]), mins); timeConfidence = 'exact';
    } else {
      time = toHHmm(resolveAmbiguousHour(h), mins); timeConfidence = 'inferred';
      warnings.push('ambiguous_time_default');
    }
    matches.push(m[0]);
  }
  // 2) ordinal hour word ("о другій") + period word
  else if ((m = text.match(new RegExp(`${B}об?\\s+(${NUMBER_WORD_ALT})\\s+(${PERIOD_WORD_ALT})${A}`, 'iu')))) {
    const h = NUMBER_WORDS[m[1].toLowerCase()];
    time = toHHmm(resolveHour(h, PERIOD_WORDS[m[2].toLowerCase()]), 0); timeConfidence = 'exact';
    matches.push(m[0]);
  }
  // 3) digit hour directly + period word, no "о"
  else if ((m = text.match(new RegExp(`${B}(\\d{1,2})\\s+(${PERIOD_WORD_ALT})${A}`, 'iu')))) {
    const h = parseInt(m[1], 10);
    time = toHHmm(resolveHour(h, PERIOD_WORDS[m[2].toLowerCase()]), 0); timeConfidence = 'exact';
    matches.push(m[0]);
  }
  // 4) period word alone, no number
  else if ((m = text.match(new RegExp(`${B}(${PERIOD_WORD_ALT})${A}`, 'iu')))) {
    const key = PERIOD_TO_DEFAULT[m[1].toLowerCase()];
    time = toHHmm(PERIOD_DEFAULT_HOUR[key], 0); timeConfidence = 'inferred';
    warnings.push('period_word_default_time');
    matches.push(m[0]);
  }
  // 5) bare ambiguous number "о 2" / "в 2"
  else if ((m = text.match(new RegExp(`${B}об?\\s+(\\d{1,2})${A}`, 'iu')))) {
    const h = parseInt(m[1], 10);
    time = toHHmm(resolveAmbiguousHour(h), 0); timeConfidence = 'inferred';
    warnings.push('ambiguous_time_default');
    matches.push(m[0]);
  }

  const cleanedText = stripMatches(text, matches);
  let confidence = 'none';
  if (dateConfidence || timeConfidence) confidence = 'exact';
  if (dateConfidence === 'inferred' || timeConfidence === 'inferred') confidence = 'inferred';

  return { text: cleanedText, date, time, confidence, warnings };
}
