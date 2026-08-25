// storage.js
// Local persistence. Uses localStorage for now (spec section 7); the public
// API (load/saveAll/exportData/importData) is written so a future migration
// to IndexedDB only requires changes inside this file.

export const STORAGE_KEY = 'voiceTasks_v1';
export const SCHEMA_VERSION = 1;
export const APP_NAME = 'VoiceTasks';

function isStorageAvailable() {
  try {
    const testKey = '__voiceTasks_probe__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

export const storageAvailable = isStorageAvailable();

/** Load all tasks. Never throws; returns [] and logs a warning on corruption. */
export function loadTasks() {
  if (!storageAvailable) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    console.warn('VoiceTasks: failed to read stored tasks, starting empty.', e);
    return [];
  }
}

/**
 * Persist the full task list. Returns {ok: boolean, error?: string}.
 * Never deletes data implicitly: the caller always passes the complete,
 * already-merged array it wants stored.
 */
export function saveTasks(tasks) {
  if (!storageAvailable) {
    return { ok: false, error: 'storage_unavailable' };
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return { ok: true };
  } catch (e) {
    console.warn('VoiceTasks: failed to save tasks.', e);
    return { ok: false, error: 'storage_write_failed' };
  }
}

export function buildExport(tasks) {
  return {
    app: APP_NAME,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tasks
  };
}

/**
 * Validate an imported object. Returns {ok, tasks, error}.
 * Never mutates stored data itself — the caller decides replace vs merge.
 */
export function validateImport(data) {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'invalid_json' };
  }
  if (!Array.isArray(data.tasks)) {
    return { ok: false, error: 'missing_tasks_array' };
  }
  const cleaned = [];
  for (const t of data.tasks) {
    if (!t || typeof t !== 'object') continue;
    if (typeof t.id !== 'string' || !t.id) continue;
    if (typeof t.text !== 'string' || !t.text.trim()) continue;
    cleaned.push({
      id: t.id,
      text: t.text,
      date: typeof t.date === 'string' ? t.date : null,
      time: typeof t.time === 'string' ? t.time : null,
      done: !!t.done,
      createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
      updatedAt: typeof t.updatedAt === 'string' ? t.updatedAt : new Date().toISOString(),
      completedAt: typeof t.completedAt === 'string' ? t.completedAt : null,
      source: ['text', 'voice', 'import'].includes(t.source) ? t.source : 'import',
      lang: ['ru', 'uk', 'en'].includes(t.lang) ? t.lang : 'en'
    });
  }
  if (cleaned.length === 0 && data.tasks.length > 0) {
    return { ok: false, error: 'no_valid_tasks' };
  }
  return { ok: true, tasks: cleaned };
}

/** Merge imported tasks into existing ones by id; imported wins on conflict. */
export function mergeTasks(existing, incoming) {
  const byId = new Map(existing.map(t => [t.id, t]));
  for (const t of incoming) byId.set(t.id, t);
  return Array.from(byId.values());
}
