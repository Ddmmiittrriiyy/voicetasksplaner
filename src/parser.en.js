// parser.en.js — English date/time phrase parsing.
import {
  resolveHour, resolveAmbiguousHour, PERIOD_DEFAULT_HOUR,
  dateForToday, dateForTomorrow, dateForDayAfterTomorrow, dateForWeekday,
  dateFromNumeric, dateFromMonthName, stripMatches
} from './parserShared.js';
import { toHHmm } from './parser.js';

const WEEKDAYS = {
  monday: 'monday', tuesday: 'tuesday', wednesday: 'wednesday', thursday: 'thursday',
  friday: 'friday', saturday: 'saturday', sunday: 'sunday'
};
const WEEKDAY_ALT = Object.keys(WEEKDAYS).join('|');

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
};
const MONTH_ALT = Object.keys(MONTHS).join('|');

// Bare period words (no explicit am/pm) still bucket into am/pm.
const PERIOD_WORD_BUCKET = { morning: 'am', night: 'am', afternoon: 'pm', evening: 'pm' };
const PERIOD_WORD_ALT = Object.keys(PERIOD_WORD_BUCKET).join('|');

export function parseEn(text, now) {
  const matches = [];
  const warnings = [];
  let date = null, time = null, dateConfidence = null, timeConfidence = null;

  let m;
  if ((m = text.match(/\bday after tomorrow\b/i))) {
    date = dateForDayAfterTomorrow(now).date; dateConfidence = 'exact'; matches.push(m[0]);
  } else if ((m = text.match(/\btomorrow\b/i))) {
    date = dateForTomorrow(now).date; dateConfidence = 'exact'; matches.push(m[0]);
  } else if ((m = text.match(/\btoday\b/i))) {
    date = dateForToday(now).date; dateConfidence = 'exact'; matches.push(m[0]);
  } else if ((m = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_ALT})\\b`, 'i')))) {
    date = dateFromMonthName(m[1], MONTHS[m[2].toLowerCase()], now); dateConfidence = 'exact'; matches.push(m[0]);
  } else if ((m = text.match(new RegExp(`\\b(${MONTH_ALT})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i')))) {
    date = dateFromMonthName(m[2], MONTHS[m[1].toLowerCase()], now); dateConfidence = 'exact'; matches.push(m[0]);
  } else if ((m = text.match(/\b(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?\b/))) {
    date = dateFromNumeric(m[1], m[2], m[3], now); dateConfidence = 'exact'; matches.push(m[0]);
  } else if ((m = text.match(new RegExp(`\\b(?:on\\s+)?(${WEEKDAY_ALT})\\b`, 'i')))) {
    date = dateForWeekday(now, WEEKDAYS[m[1].toLowerCase()]).date; dateConfidence = 'exact'; matches.push(m[0]);
  }

  // 1) explicit am/pm, e.g. "at 2 pm", "2pm"
  if ((m = text.match(/\bat\s+(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/i)) ||
      (m = text.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/i))) {
    const h = parseInt(m[1], 10);
    const mins = m[2] ? parseInt(m[2], 10) : 0;
    const bucket = m[3].toLowerCase();
    time = toHHmm(resolveHour(h, bucket), mins); timeConfidence = 'exact';
    matches.push(m[0]);
  }
  // 2) explicit 24h/HH:MM without am/pm, e.g. "at 14:30"
  else if ((m = text.match(/\bat\s+(\d{1,2})[:.](\d{2})\b/i))) {
    const h = parseInt(m[1], 10);
    const mins = parseInt(m[2], 10);
    if (h >= 13) {
      time = toHHmm(h, mins); timeConfidence = 'exact';
    } else {
      time = toHHmm(resolveAmbiguousHour(h), mins); timeConfidence = 'inferred';
      warnings.push('ambiguous_time_default');
    }
    matches.push(m[0]);
  }
  // 3) "at 10 in the morning" / "10 in the morning"
  else if ((m = text.match(new RegExp(`\\b(?:at\\s+)?(\\d{1,2})\\s+in\\s+the\\s+(${PERIOD_WORD_ALT})\\b`, 'i')))) {
    const h = parseInt(m[1], 10);
    const bucket = PERIOD_WORD_BUCKET[m[2].toLowerCase()];
    time = toHHmm(resolveHour(h, bucket), 0); timeConfidence = 'exact';
    matches.push(m[0]);
  }
  // 4) "at 2" + period word directly, e.g. "at 6 evening" (less common but supported)
  else if ((m = text.match(new RegExp(`\\bat\\s+(\\d{1,2})\\s+(${PERIOD_WORD_ALT})\\b`, 'i')))) {
    const h = parseInt(m[1], 10);
    const bucket = PERIOD_WORD_BUCKET[m[2].toLowerCase()];
    time = toHHmm(resolveHour(h, bucket), 0); timeConfidence = 'exact';
    matches.push(m[0]);
  }
  // 5) bare "at 2" with no am/pm/period word
  else if ((m = text.match(/\bat\s+(\d{1,2})\b/i))) {
    const h = parseInt(m[1], 10);
    time = toHHmm(resolveAmbiguousHour(h), 0); timeConfidence = 'inferred';
    warnings.push('ambiguous_time_default');
    matches.push(m[0]);
  }
  // 6) period word alone, e.g. "Friday evening call"
  else if ((m = text.match(new RegExp(`\\b(${PERIOD_WORD_ALT})\\b`, 'i')))) {
    const word = m[1].toLowerCase();
    time = toHHmm(PERIOD_DEFAULT_HOUR[word === 'night' ? 'night' : (word === 'afternoon' ? 'day' : word)], 0);
    timeConfidence = 'inferred';
    warnings.push('period_word_default_time');
    matches.push(m[0]);
  }

  const cleanedText = stripMatches(text, matches);
  let confidence = 'none';
  if (dateConfidence || timeConfidence) confidence = 'exact';
  if (dateConfidence === 'inferred' || timeConfidence === 'inferred') confidence = 'inferred';

  return { text: cleanedText, date, time, confidence, warnings };
}
