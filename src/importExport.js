// importExport.js
import { buildExport, validateImport, mergeTasks } from './storage.js';

/** Triggers a browser download of the current tasks as a JSON file. */
export function exportTasksToFile(tasks) {
  const payload = buildExport(tasks);
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `voicetasks-export-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Reads a File object, validates it, and returns the tasks it contains
 * without touching stored data. Caller decides replace vs merge.
 * Returns a Promise<{ok, tasks?, error?}>.
 */
export function readImportFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve({ ok: false, error: 'read_failed' });
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (e) {
        resolve({ ok: false, error: 'invalid_json' });
        return;
      }
      resolve(validateImport(parsed));
    };
    reader.readAsText(file);
  });
}

export function applyImport(existingTasks, incomingTasks, mode) {
  if (mode === 'merge') {
    return mergeTasks(existingTasks, incomingTasks);
  }
  return incomingTasks; // replace
}
