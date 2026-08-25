// app.js — application entry point.
import { parse } from './parser.js';
import { createTask, editTask as editTaskModel, completeTask, restoreTask } from './taskModel.js';
import { loadTasks, saveTasks } from './storage.js';
import { isSpeechSupported, startVoiceCapture } from './speech.js';
import { exportTasksToFile, readImportFile, applyImport } from './importExport.js';
import { SUPPORTED_LANGS, t } from './i18n.js';
import * as ui from './ui.js';

const LANG_KEY = 'voiceTasks_lang_v1';

const state = {
  lang: loadInitialLang(),
  tasks: loadTasks(),
  tab: 'active',
  editingId: null,
  deletingId: null,
  voiceController: null
};

function loadInitialLang() {
  try {
    const saved = window.localStorage.getItem(LANG_KEY);
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
  } catch (e) { /* storage unavailable */ }
  // Optional first-run default only — never the ongoing source of truth.
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  if (SUPPORTED_LANGS.includes(nav)) return nav;
  return 'en';
}

function persistLang(lang) {
  try { window.localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignore */ }
}

function persistTasks() {
  const result = saveTasks(state.tasks);
  if (!result.ok) {
    ui.showToast(`${t(state.lang, 'storageErrorTitle')} ${t(state.lang, 'storageErrorBody')}`, 5000);
  }
  return result.ok;
}

function render() {
  ui.applyStaticStrings(state.lang);
  ui.setLangButtons(state.lang);
  ui.switchTab(state.tab);
  ui.renderLists(state.tasks, state.lang, {
    onToggle: handleToggle,
    onEdit: openEditModal,
    onDelete: openDeleteModal
  });
}

// ---- Task creation ----------------------------------------------------

function handleAddTask() {
  const input = document.getElementById('taskInput');
  const raw = input.value;
  if (!raw.trim()) {
    ui.showToast(t(state.lang, 'emptyInputWarning'));
    return;
  }
  addTaskFromText(raw, 'text');
  input.value = '';
  ui.setParsePreview(state.lang, null);
}

function addTaskFromText(raw, source) {
  const parsed = parse(raw, state.lang);
  const result = createTask({
    text: parsed.text || raw.trim(),
    date: parsed.date,
    time: parsed.time,
    source,
    lang: state.lang
  });
  if (!result.ok) {
    // Should not happen given the guard above, but never silently drop input.
    ui.showToast(t(state.lang, 'emptyInputWarning'));
    return;
  }
  state.tasks.push(result.task);
  persistTasks();
  render();
}

function handlePreviewParse() {
  const input = document.getElementById('taskInput');
  const raw = input.value;
  if (!raw.trim()) { ui.setParsePreview(state.lang, null); return; }
  const parsed = parse(raw, state.lang);
  ui.setParsePreview(state.lang, parsed);
}

// ---- Task lifecycle -----------------------------------------------------

function handleToggle(id) {
  const idx = state.tasks.findIndex(x => x.id === id);
  if (idx === -1) return;
  const task = state.tasks[idx];
  state.tasks[idx] = task.done ? restoreTask(task) : completeTask(task);
  persistTasks();
  render();
}

function openEditModal(id) {
  const task = state.tasks.find(x => x.id === id);
  if (!task) return;
  state.editingId = id;
  document.getElementById('editText').value = task.text;
  document.getElementById('editDate').value = task.date || '';
  document.getElementById('editTime').value = task.time || '';
  document.getElementById('editModal').showModal();
}

function saveEdit() {
  if (!state.editingId) return;
  const idx = state.tasks.findIndex(x => x.id === state.editingId);
  if (idx === -1) return;
  const text = document.getElementById('editText').value;
  const date = document.getElementById('editDate').value || null;
  const time = document.getElementById('editTime').value || null;
  const result = editTaskModel(state.tasks[idx], { text, date, time });
  if (!result.ok) {
    ui.showToast(t(state.lang, 'emptyInputWarning'));
    return;
  }
  state.tasks[idx] = result.task;
  persistTasks();
  state.editingId = null;
  document.getElementById('editModal').close();
  render();
}

function openDeleteModal(id) {
  state.deletingId = id;
  document.getElementById('deleteModal').showModal();
}

function confirmDelete() {
  if (!state.deletingId) return;
  state.tasks = state.tasks.filter(x => x.id !== state.deletingId);
  persistTasks();
  state.deletingId = null;
  document.getElementById('deleteModal').close();
  render();
}

// ---- Voice input ----------------------------------------------------------

function handleMicClick() {
  if (state.voiceController) {
    state.voiceController.stop();
    state.voiceController = null;
    return;
  }
  if (!isSpeechSupported()) {
    ui.setSpeechBanner(t(state.lang, 'speechUnsupported'));
    return;
  }
  if (!navigator.onLine) {
    ui.setSpeechBanner(t(state.lang, 'speechUnavailableOffline'));
    return;
  }
  ui.setSpeechBanner(null);
  state.voiceController = startVoiceCapture(state.lang, {
    onListeningChange: (listening) => {
      ui.setMicState(listening);
      if (listening) document.getElementById('taskInput').placeholder = t(state.lang, 'micListening');
      else document.getElementById('taskInput').placeholder = t(state.lang, 'inputPlaceholder');
    },
    onFinalResult: (transcript) => {
      // Strict rule: one recording -> at most one task, and only after the
      // user explicitly confirms via the send button. We place the final
      // transcript in the input field rather than creating the task here.
      const input = document.getElementById('taskInput');
      input.value = transcript;
      handlePreviewParse();
      input.focus();
    },
    onError: (code) => {
      const map = {
        'network': 'speechErrorNetwork',
        'not-allowed': 'speechErrorNotAllowed',
        'no-speech': 'speechErrorNoSpeech',
        'audio-capture': 'speechErrorAudioCapture',
        'unsupported': 'speechUnsupported'
      };
      ui.setSpeechBanner(t(state.lang, map[code] || 'speechErrorGeneric'));
    },
    onEnd: () => {
      state.voiceController = null;
      ui.setMicState(false);
    }
  });
}

// ---- Import / Export --------------------------------------------------

function openImportExportModal() {
  document.getElementById('importStatus').hidden = true;
  document.getElementById('importFile').value = '';
  document.getElementById('ieModal').showModal();
}

function handleExport() {
  exportTasksToFile(state.tasks);
}

async function handleImportFile(file) {
  const statusEl = document.getElementById('importStatus');
  if (!file) return;
  const result = await readImportFile(file);
  if (!result.ok) {
    statusEl.hidden = false;
    statusEl.className = 'import-status err';
    statusEl.textContent = result.error === 'no_valid_tasks'
      ? t(state.lang, 'importErrorEmpty')
      : t(state.lang, 'importErrorInvalid');
    return;
  }
  const mode = document.querySelector('input[name="importMode"]:checked').value;
  state.tasks = applyImport(state.tasks, result.tasks, mode);
  persistTasks();
  statusEl.hidden = false;
  statusEl.className = 'import-status ok';
  statusEl.textContent = t(state.lang, 'importSuccess');
  render();
}

// ---- Wiring -------------------------------------------------------------

function wireEvents() {
  document.getElementById('taskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    handleAddTask();
  });
  document.getElementById('taskInput').addEventListener('input', debounce(handlePreviewParse, 250));

  document.getElementById('micBtn').addEventListener('click', handleMicClick);

  document.getElementById('tabActiveBtn').addEventListener('click', () => { state.tab = 'active'; ui.switchTab('active'); });
  document.getElementById('tabCompletedBtn').addEventListener('click', () => { state.tab = 'completed'; ui.switchTab('completed'); });

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.lang = btn.dataset.lang;
      persistLang(state.lang);
      render();
    });
  });

  // editForm's method="dialog" would auto-close on submit; we intercept so
  // an empty-text edit can be rejected without closing the modal.
  document.getElementById('editForm').addEventListener('submit', (e) => { e.preventDefault(); saveEdit(); });
  document.getElementById('editCancelBtn').addEventListener('click', () => { state.editingId = null; document.getElementById('editModal').close(); });
  document.getElementById('editClearDateTime').addEventListener('click', () => {
    document.getElementById('editDate').value = '';
    document.getElementById('editTime').value = '';
  });

  document.getElementById('deleteCancelBtn').addEventListener('click', () => { state.deletingId = null; document.getElementById('deleteModal').close(); });
  document.getElementById('deleteConfirmBtn').addEventListener('click', confirmDelete);

  document.getElementById('importExportBtn').addEventListener('click', openImportExportModal);
  document.getElementById('ieCancelBtn').addEventListener('click', () => document.getElementById('ieModal').close());
  document.getElementById('exportBtn').addEventListener('click', handleExport);
  document.getElementById('importFile').addEventListener('change', (e) => handleImportFile(e.target.files[0]));

  window.addEventListener('online', () => ui.setOfflineBanner(false, state.lang));
  window.addEventListener('offline', () => ui.setOfflineBanner(true, state.lang));
}

function debounce(fn, ms) {
  let h;
  return (...args) => { clearTimeout(h); h = setTimeout(() => fn(...args), ms); };
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((e) => {
        console.warn('VoiceTasks: service worker registration failed.', e);
      });
    });
  }
}

function init() {
  wireEvents();
  ui.setOfflineBanner(!navigator.onLine, state.lang);
  if (!isSpeechSupported()) {
    document.getElementById('micBtn').disabled = true;
  }
  render();
  registerServiceWorker();
}

init();
