import { parse, toISODate, addDays } from '../src/parser.js';
import { describe, test, assertEqual, assertTrue, summarize } from './testRunner.js';

// Fixed reference "now" so date-relative tests are deterministic:
// Monday 2026-08-24 10:00 local time.
const NOW = new Date(2026, 7, 24, 10, 0, 0);
const TOMORROW = toISODate(addDays(NOW, 1));
const TODAY = toISODate(NOW);

function nextFriday() {
  // NOW is a Monday; the next Friday is 4 days later.
  return toISODate(addDays(NOW, 4));
}

describe('Russian parser — spec section 13 examples', () => {
  test('завтра в два часа дня еду в Корк -> tomorrow 14:00', () => {
    const r = parse('завтра в два часа дня еду в Корк', 'ru', NOW);
    assertEqual(r.date, TOMORROW);
    assertEqual(r.time, '14:00');
    assertEqual(r.text, 'еду в Корк');
  });

  test('завтра в два часа ночи еду в Корк -> tomorrow 02:00', () => {
    const r = parse('завтра в два часа ночи еду в Корк', 'ru', NOW);
    assertEqual(r.date, TOMORROW);
    assertEqual(r.time, '02:00');
  });

  test('завтра в 4:30 вечера звонок -> tomorrow 16:30', () => {
    const r = parse('завтра в 4:30 вечера звонок', 'ru', NOW);
    assertEqual(r.date, TOMORROW);
    assertEqual(r.time, '16:30');
  });

  test('сегодня в 10 утра врач -> today 10:00', () => {
    const r = parse('сегодня в 10 утра врач', 'ru', NOW);
    assertEqual(r.date, TODAY);
    assertEqual(r.time, '10:00');
  });

  test('в пятницу вечером встреча -> next Friday, evening default', () => {
    const r = parse('в пятницу вечером встреча', 'ru', NOW);
    assertEqual(r.date, nextFriday());
    assertEqual(r.time, '18:00');
    assertEqual(r.confidence, 'inferred');
  });
});

describe('Ukrainian parser — spec section 13 examples', () => {
  test('завтра о другій дня зустріч -> tomorrow 14:00', () => {
    const r = parse('завтра о другій дня зустріч', 'uk', NOW);
    assertEqual(r.date, TOMORROW);
    assertEqual(r.time, '14:00');
  });

  test('завтра о другій ночі таксі -> tomorrow 02:00', () => {
    const r = parse('завтра о другій ночі таксі', 'uk', NOW);
    assertEqual(r.date, TOMORROW);
    assertEqual(r.time, '02:00');
  });

  test('завтра о четвертій вечора дзвінок -> tomorrow 16:00', () => {
    const r = parse('завтра о четвертій вечора дзвінок', 'uk', NOW);
    assertEqual(r.date, TOMORROW);
    assertEqual(r.time, '16:00');
  });

  test('сьогодні о десятій ранку лікар -> today 10:00', () => {
    const r = parse('сьогодні о десятій ранку лікар', 'uk', NOW);
    assertEqual(r.date, TODAY);
    assertEqual(r.time, '10:00');
  });
});

describe('English parser — spec section 13 examples', () => {
  test('tomorrow at 2 pm meeting -> tomorrow 14:00', () => {
    const r = parse('tomorrow at 2 pm meeting', 'en', NOW);
    assertEqual(r.date, TOMORROW);
    assertEqual(r.time, '14:00');
    assertEqual(r.text, 'meeting');
  });

  test('tomorrow at 2 am taxi -> tomorrow 02:00', () => {
    const r = parse('tomorrow at 2 am taxi', 'en', NOW);
    assertEqual(r.date, TOMORROW);
    assertEqual(r.time, '02:00');
  });

  test('today at 10 in the morning doctor -> today 10:00', () => {
    const r = parse('today at 10 in the morning doctor', 'en', NOW);
    assertEqual(r.date, TODAY);
    assertEqual(r.time, '10:00');
  });

  test('Friday evening call -> next Friday, evening default', () => {
    const r = parse('Friday evening call', 'en', NOW);
    assertEqual(r.date, nextFriday());
    assertEqual(r.time, '18:00');
    assertEqual(r.confidence, 'inferred');
  });
});

describe('Explicit 24h times are never changed', () => {
  test('RU: в 14:30 stays 14:30 regardless of period word', () => {
    const r = parse('завтра в 14:30 встреча', 'ru', NOW);
    assertEqual(r.time, '14:30');
  });
  test('EN: at 14:30 stays 14:30', () => {
    const r = parse('tomorrow at 14:30 meeting', 'en', NOW);
    assertEqual(r.time, '14:30');
  });
});

describe('Ambiguous bare numbers use the documented default', () => {
  test('RU: в 2 with no period word -> inferred, hour 14 (1-7 => PM)', () => {
    const r = parse('в 2 позвонить', 'ru', NOW);
    assertEqual(r.time, '14:00');
    assertEqual(r.confidence, 'inferred');
  });
  test('EN: at 9 with no period word -> inferred, hour 9 (8-11 => AM)', () => {
    const r = parse('call mom at 9', 'en', NOW);
    assertEqual(r.time, '09:00');
    assertEqual(r.confidence, 'inferred');
  });
});

describe('Empty and unparseable input never crashes and never discards text', () => {
  test('empty string returns confidence none with warning', () => {
    const r = parse('', 'en', NOW);
    assertEqual(r.confidence, 'none');
    assertTrue(r.warnings.includes('empty_input'));
  });
  test('plain text with no date/time phrase is preserved verbatim', () => {
    const r = parse('buy milk', 'en', NOW);
    assertEqual(r.date, null);
    assertEqual(r.time, null);
    assertEqual(r.text, 'buy milk');
    assertEqual(r.confidence, 'none');
  });
});

const ok = summarize();
if (!ok) process.exit(1);
