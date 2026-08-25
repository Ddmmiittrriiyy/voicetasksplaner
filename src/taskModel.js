// taskModel.js
// Pure task creation/validation/lifecycle helpers. No DOM access, no
// storage access — keeps this file trivially unit-testable and keeps the
// "never silently discard input" / "never auto-complete/move/delete" rules
// (spec sections 1, 8, 9) enforced in one place.

/** Generates a stable unique id without relying on any external library. */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older WebViews without crypto.randomUUID.
  return 'tsk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

export const SOURCES = ['text', 'voice', 'import'];
export const LANGS = ['ru', 'uk', 'en'];

/**
 * Creates a new task object. Returns {ok, task} or {ok:false, error}.
 * Refuses only on empty text (spec 8: "must not create a task with empty text").
 */
export function createTask({ text, date = null, time = null, source = 'text', lang = 'en' }) {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    return { ok: false, error: 'empty_text' };
  }
  const now = new Date().toISOString();
  return {
    ok: true,
    task: {
      id: generateId(),
      text: trimmed,
      date: date || null,
      time: time || null,
      done: false,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      source: SOURCES.includes(source) ? source : 'text',
      lang: LANGS.includes(lang) ? lang : 'en'
    }
  };
}

/** Returns a new task object with edits applied (does not mutate input). */
export function editTask(task, { text, date, time }) {
  const next = { ...task };
  if (text !== undefined) {
    const trimmed = (text || '').trim();
    if (!trimmed) return { ok: false, error: 'empty_text' };
    next.text = trimmed;
  }
  if (date !== undefined) next.date = date || null;
  if (time !== undefined) next.time = time || null;
  next.updatedAt = new Date().toISOString();
  return { ok: true, task: next };
}

export function completeTask(task) {
  const now = new Date().toISOString();
  return { ...task, done: true, completedAt: now, updatedAt: now };
}

export function restoreTask(task) {
  const now = new Date().toISOString();
  return { ...task, done: false, completedAt: null, updatedAt: now };
}

/** True if the task has a date in the past and is still active (not done). */
export function isOverdue(task, now = new Date()) {
  if (task.done || !task.date) return false;
  const todayStr = toISODateLocal(now);
  if (task.date < todayStr) return true;
  if (task.date > todayStr) return false;
  if (!task.time) return false;
  const nowHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return task.time < nowHHmm;
}

function toISODateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
