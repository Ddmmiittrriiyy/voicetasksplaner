import { createTask, editTask, completeTask, restoreTask, isOverdue } from '../src/taskModel.js';
import { describe, test, assertEqual, assertTrue, summarize } from './testRunner.js';

describe('taskModel: creation', () => {
  test('refuses empty text', () => {
    const r = createTask({ text: '   ', lang: 'en' });
    assertTrue(!r.ok);
    assertEqual(r.error, 'empty_text');
  });

  test('trims text and defaults optional fields', () => {
    const r = createTask({ text: '  buy milk  ', lang: 'en' });
    assertTrue(r.ok);
    assertEqual(r.task.text, 'buy milk');
    assertEqual(r.task.done, false);
    assertEqual(r.task.date, null);
    assertEqual(r.task.completedAt, null);
  });

  test('two tasks never share an id', () => {
    const a = createTask({ text: 'a', lang: 'en' }).task;
    const b = createTask({ text: 'b', lang: 'en' }).task;
    assertTrue(a.id !== b.id);
  });
});

describe('taskModel: lifecycle', () => {
  test('completeTask sets done + completedAt, restoreTask clears them', () => {
    const t = createTask({ text: 'x', lang: 'en' }).task;
    const done = completeTask(t);
    assertEqual(done.done, true);
    assertTrue(!!done.completedAt);
    const restored = restoreTask(done);
    assertEqual(restored.done, false);
    assertEqual(restored.completedAt, null);
  });

  test('editTask refuses to blank out the text', () => {
    const t = createTask({ text: 'x', lang: 'en' }).task;
    const r = editTask(t, { text: '   ' });
    assertTrue(!r.ok);
  });

  test('editTask can clear date/time by passing null', () => {
    const t = createTask({ text: 'x', date: '2026-01-01', time: '10:00', lang: 'en' }).task;
    const r = editTask(t, { date: null, time: null });
    assertTrue(r.ok);
    assertEqual(r.task.date, null);
    assertEqual(r.task.time, null);
  });
});

describe('taskModel: overdue is informational only, never mutates state', () => {
  const now = new Date(2026, 7, 24, 12, 0);

  test('past date, active task is overdue', () => {
    const t = { done: false, date: '2026-08-01', time: null };
    assertTrue(isOverdue(t, now));
  });

  test('future date is not overdue', () => {
    const t = { done: false, date: '2026-12-01', time: null };
    assertTrue(!isOverdue(t, now));
  });

  test('completed tasks are never overdue regardless of date', () => {
    const t = { done: true, date: '2020-01-01', time: null };
    assertTrue(!isOverdue(t, now));
  });

  test('today with an earlier time is overdue; later time is not', () => {
    const early = { done: false, date: '2026-08-24', time: '09:00' };
    const late = { done: false, date: '2026-08-24', time: '18:00' };
    assertTrue(isOverdue(early, now));
    assertTrue(!isOverdue(late, now));
  });
});

const ok = summarize();
if (!ok) process.exit(1);
