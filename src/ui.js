// ui.js
// Rendering helpers only. app.js owns state and wires events; this file
// turns state into DOM. Keeping this split makes it possible to unit-test
// state changes (taskModel.js, storage.js, parser.js) without a browser.

import { t } from './i18n.js';
import { isOverdue } from './taskModel.js';

const CHECK_SVG = `<svg class="stroke" viewBox="0 0 22 22" width="22" height="22"><path d="M5 11.5l4 4 8-9" stroke="#F4FBF9" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function applyStaticStrings(lang) {
  const set = (id, key) => { const el = document.getElementById(id); if (el) el.textContent = t(lang, key); };
  document.title = t(lang, 'appName');
  document.getElementById('taskInput').placeholder = t(lang, 'inputPlaceholder');
  document.getElementById('micBtn').title = t(lang, 'micTitle');
  document.querySelector('#tabActiveBtn .tab-label').textContent = t(lang, 'tabActive');
  document.querySelector('#tabCompletedBtn .tab-label').textContent = t(lang, 'tabCompleted');
  document.getElementById('footerNote').textContent = t(lang, 'appName') + ' · ' + (STORAGE_NOTE[lang] || STORAGE_NOTE.en);

  set('editModalTitle', 'editTitle');
  document.querySelector('label[for="editText"]').textContent = t(lang, 'editTextLabel');
  document.querySelector('label[for="editDate"]').textContent = t(lang, 'editDateLabel');
  document.querySelector('label[for="editTime"]').textContent = t(lang, 'editTimeLabel');
  set('editClearDateTime', 'clearDateTime');
  set('editCancelBtn', 'cancelButton');
  set('editSaveBtn', 'saveButton');

  set('deleteModalTitle', 'confirmDeleteTitle');
  set('deleteModalBody', 'confirmDeleteBody');
  set('deleteCancelBtn', 'cancelButton');
  set('deleteConfirmBtn', 'confirmDeleteYes');

  set('ieModalTitle', 'importExportTitle');
  set('exportBtn', 'exportButton');
  document.querySelector('label[for="importFile"]').textContent = t(lang, 'importButton');
  set('importModeMergeLabel', 'importModeMerge');
  set('importModeReplaceLabel', 'importModeReplace');
  set('ieCancelBtn', 'cancelButton');
}

const STORAGE_NOTE = {
  en: 'stored only on this device',
  ru: 'хранится только на этом устройстве',
  uk: 'зберігається лише на цьому пристрої'
};

export function setLangButtons(lang) {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.lang === lang);
  });
}

export function renderCounts(activeCount, completedCount) {
  document.getElementById('activeCount').textContent = String(activeCount);
  document.getElementById('completedCount').textContent = String(completedCount);
}

export function switchTab(which) {
  const isActive = which === 'active';
  document.getElementById('tabActiveBtn').classList.toggle('is-active', isActive);
  document.getElementById('tabActiveBtn').setAttribute('aria-selected', String(isActive));
  document.getElementById('tabCompletedBtn').classList.toggle('is-active', !isActive);
  document.getElementById('tabCompletedBtn').setAttribute('aria-selected', String(!isActive));
  document.getElementById('listActive').hidden = !isActive;
  document.getElementById('listCompleted').hidden = isActive;
}

function formatChip(task, lang) {
  const parts = [];
  if (task.date) parts.push(task.date);
  if (task.time) parts.push(task.time);
  if (parts.length === 0) return null;
  return parts.join(' · ');
}

function taskRowEl(task, lang, { onToggle, onEdit, onDelete }) {
  const row = document.createElement('div');
  row.className = 'task-row' + (task.done ? ' is-done' : '') + (isOverdue(task) ? ' is-overdue' : '');
  row.dataset.id = task.id;

  const check = document.createElement('button');
  check.type = 'button';
  check.className = 'check-btn';
  check.setAttribute('aria-label', task.done ? t(lang, 'restoreButton') : t(lang, 'completeButton'));
  check.innerHTML = CHECK_SVG;
  check.addEventListener('click', () => onToggle(task.id));

  const body = document.createElement('div');
  body.className = 'task-body';

  const textEl = document.createElement('div');
  textEl.className = 'task-text';
  textEl.textContent = task.text;

  const meta = document.createElement('div');
  meta.className = 'task-meta';
  const chipText = formatChip(task, lang);
  if (chipText) {
    const chip = document.createElement('span');
    chip.className = 'task-chip' + (isOverdue(task) ? ' is-overdue' : '');
    chip.textContent = (isOverdue(task) ? '⚠ ' : '') + chipText;
    meta.appendChild(chip);
  }
  if (task.source === 'voice') {
    const src = document.createElement('span');
    src.className = 'source-chip';
    src.textContent = '🎙';
    meta.appendChild(src);
  }

  body.appendChild(textEl);
  if (meta.childElementCount > 0) body.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.setAttribute('aria-label', t(lang, 'editButton'));
  editBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24"><path d="M16.5 3.5l4 4L8 20H4v-4L16.5 3.5z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/></svg>`;
  editBtn.addEventListener('click', () => onEdit(task.id));

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'danger';
  delBtn.setAttribute('aria-label', t(lang, 'deleteButton'));
  delBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24"><path d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 13h8l1-13" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  delBtn.addEventListener('click', () => onDelete(task.id));

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  row.appendChild(check);
  row.appendChild(body);
  row.appendChild(actions);
  return row;
}

export function renderLists(tasks, lang, handlers) {
  const active = tasks.filter(t => !t.done).sort(sortActive);
  const completed = tasks.filter(t => t.done).sort(sortCompleted);

  const activeEl = document.getElementById('listActive');
  const completedEl = document.getElementById('listCompleted');
  activeEl.innerHTML = '';
  completedEl.innerHTML = '';

  if (active.length === 0) {
    activeEl.appendChild(emptyState(t(lang, 'emptyActive')));
  } else {
    for (const task of active) activeEl.appendChild(taskRowEl(task, lang, handlers));
  }

  if (completed.length === 0) {
    completedEl.appendChild(emptyState(t(lang, 'emptyCompleted')));
  } else {
    for (const task of completed) completedEl.appendChild(taskRowEl(task, lang, handlers));
  }

  renderCounts(active.length, completed.length);
}

function sortActive(a, b) {
  // Tasks with date/time first (earliest first), undated tasks after, newest-created first within undated.
  const aKey = a.date ? a.date + (a.time || '00:00') : null;
  const bKey = b.date ? b.date + (b.time || '00:00') : null;
  if (aKey && bKey) return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  if (aKey && !bKey) return -1;
  if (!aKey && bKey) return 1;
  return b.createdAt < a.createdAt ? -1 : b.createdAt > a.createdAt ? 1 : 0;
}

function sortCompleted(a, b) {
  const aT = a.completedAt || a.updatedAt;
  const bT = b.completedAt || b.updatedAt;
  return aT < bT ? 1 : aT > bT ? -1 : 0;
}

function emptyState(message) {
  const el = document.createElement('div');
  el.className = 'empty-state';
  el.textContent = message;
  return el;
}

export function showToast(message, ms = 3200) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { el.hidden = true; }, ms);
}

export function setOfflineBanner(visible, lang) {
  const el = document.getElementById('offlineBanner');
  el.hidden = !visible;
  if (visible) el.textContent = t(lang, 'offlineNotice');
}

export function setSpeechBanner(message) {
  const el = document.getElementById('speechBanner');
  if (!message) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = message;
}

export function setParsePreview(lang, parsed) {
  const el = document.getElementById('parsePreview');
  if (!parsed || (!parsed.date && !parsed.time)) { el.hidden = true; return; }
  el.hidden = false;
  const dateStr = parsed.date || t(lang, 'noDate');
  const timeStr = parsed.time || t(lang, 'noTime');
  el.textContent = `${t(lang, 'parsedPreview')}: ${dateStr} ${timeStr}`;
}

export function setMicState(listening, disabled) {
  const btn = document.getElementById('micBtn');
  btn.setAttribute('aria-pressed', String(listening));
  btn.disabled = !!disabled;
}
