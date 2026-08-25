// storage.test.js — run with: node tests/storage.test.js
// Mocks a minimal `window.localStorage` before importing storage.js, since
// storage.js is written for the browser.

class MemoryStorage {
  constructor() { this.store = new Map(); }
  getItem(k) { return this.store.has(k) ? this.store.get(k) : null; }
  setItem(k, v) { this.store.set(k, String(v)); }
  removeItem(k) { this.store.delete(k); }
}

globalThis.window = { localStorage: new MemoryStorage() };

const { loadTasks, saveTasks, validateImport, mergeTasks, buildExport, STORAGE_KEY } = await import('../src/storage.js');
const { createTask } = await import('../src/taskModel.js');
const { describe, test, assertEqual, assertTrue, summarize } = await import('./testRunner.js');

describe('storage: persistence', () => {
  test('loadTasks returns [] when nothing stored', () => {
    assertEqual(loadTasks(), []);
  });

  test('saveTasks then loadTasks round-trips', () => {
    const { task } = createTask({ text: 'buy milk', source: 'text', lang: 'en' });
    const result = saveTasks([task]);
    assertTrue(result.ok);
    const loaded = loadTasks();
    assertEqual(loaded.length, 1);
    assertEqual(loaded[0].text, 'buy milk');
  });

  test('saveTasks never silently drops existing tasks — caller must pass full array', () => {
    const { task: t1 } = createTask({ text: 'a', lang: 'en' });
    const { task: t2 } = createTask({ text: 'b', lang: 'en' });
    saveTasks([t1, t2]);
    assertEqual(loadTasks().length, 2);
  });

  test('loadTasks recovers gracefully from corrupted JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not valid json');
    assertEqual(loadTasks(), []);
  });
});

describe('storage: import validation', () => {
  test('rejects non-object input', () => {
    const r = validateImport(null);
    assertTrue(!r.ok);
    assertEqual(r.error, 'invalid_json');
  });

  test('rejects object without a tasks array', () => {
    const r = validateImport({ app: 'VoiceTasks' });
    assertTrue(!r.ok);
    assertEqual(r.error, 'missing_tasks_array');
  });

  test('accepts a well-formed export and fills in missing optional fields', () => {
    const payload = buildExport([{ id: 'x1', text: 'call mom' }]);
    const r = validateImport(payload);
    assertTrue(r.ok);
    assertEqual(r.tasks.length, 1);
    assertEqual(r.tasks[0].done, false);
    assertEqual(r.tasks[0].source, 'import');
  });

  test('drops individually invalid entries but keeps valid ones', () => {
    const payload = { app: 'VoiceTasks', schemaVersion: 1, tasks: [{ id: 'a', text: 'ok' }, { id: '', text: 'bad-no-id' }, { id: 'b', text: '' }] };
    const r = validateImport(payload);
    assertTrue(r.ok);
    assertEqual(r.tasks.length, 1);
    assertEqual(r.tasks[0].id, 'a');
  });

  test('rejects a file whose tasks array is non-empty but entirely invalid', () => {
    const payload = { tasks: [{ id: '', text: '' }] };
    const r = validateImport(payload);
    assertTrue(!r.ok);
    assertEqual(r.error, 'no_valid_tasks');
  });
});

describe('storage: merge vs replace', () => {
  test('mergeTasks keeps existing tasks not present in the import', () => {
    const existing = [{ id: '1', text: 'old' }, { id: '2', text: 'keep-me' }];
    const incoming = [{ id: '1', text: 'updated' }];
    const merged = mergeTasks(existing, incoming);
    assertEqual(merged.length, 2);
    const byId = Object.fromEntries(merged.map(t => [t.id, t]));
    assertEqual(byId['1'].text, 'updated');
    assertEqual(byId['2'].text, 'keep-me');
  });
});

const ok = summarize();
if (!ok) process.exit(1);
