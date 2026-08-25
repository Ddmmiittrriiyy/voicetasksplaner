# VoiceTasks

A simple, offline-first task planner. Type your tasks, or say them out loud
where your browser supports it. VoiceTasks never plans your day, prioritizes,
or moves tasks for you — it only stores what you tell it to.

Interface, speech recognition, and date/time parsing all work in **Russian,
Ukrainian, and English**.

## Why this exists

Most task apps either need an account and a server, or quietly make
decisions on your behalf ("smart" scheduling, auto-prioritization, nudges).
VoiceTasks does neither: it's a private, local list you fully control, that
happens to understand a few natural ways of saying "tomorrow at 2pm."

## Features

- **Works fully offline** after the first visit, once installed as a PWA.
- **Text-first**: every feature works by typing; voice is optional and never
  required.
- **Voice input** (where the browser supports it) in RU/UK/EN, with one
  strict rule: **one recording can never create more than one task**, and a
  task is only created after you confirm it.
- **Natural date/time phrases** — "tomorrow at 2pm", "завтра в два часа дня",
  "завтра о четвертій вечора" — parsed deterministically, with a documented
  fallback for ambiguous phrasing (see [Parser rules](#parser-rules) below).
- **Import/export** your tasks as a JSON file, for backup or moving devices.
- **Nothing leaves your device.** No account, no server, no analytics.

## Privacy

- Tasks are stored only in this browser's local storage, on your own device.
- Clearing your browser's site data for this app deletes your tasks —
  export first if you want a backup.
- If you use voice input, the audio is processed by your browser or
  operating system's speech recognition service (this varies by
  browser/device); VoiceTasks itself never sees or stores audio, and does
  not run a backend server at all.

## Getting started

No build step is required — this is a set of plain ES modules.

```bash
git clone <this-repo-url>
cd voice-task-planner
python3 -m http.server 8080   # or any static file server
```

Then open `http://localhost:8080` in your browser. To try the installed PWA
experience, use a server over `http`/`https` (not `file://`, since service
workers require a proper origin) and use your browser's "Install app" option.

### Running the tests

```bash
npm test
```

This runs the parser, storage, task-model, and speech-module test suites
(39 tests total, zero external dependencies — plain Node `assert`-style
checks). See [Section 13 examples](#parser-rules) below for what's covered.

## Project structure

```text
index.html          App shell
manifest.json        PWA manifest
sw.js                 Service worker (app-shell caching only, see below)
assets/               Icons
src/
  app.js              Wires state + storage + parser + speech + UI together
  ui.js                DOM rendering only — no state, no storage
  taskModel.js         Task creation/validation/lifecycle (pure functions)
  storage.js            localStorage persistence + import validation
  parser.js              Language dispatch + shared date/number helpers
  parserShared.js        Number/hour-resolution helpers shared by RU/UK/EN
  parser.ru.js            Russian phrase parsing
  parser.uk.js             Ukrainian phrase parsing
  parser.en.js              English phrase parsing
  speech.js                  SpeechRecognition wrapper, isolated from the UI
  i18n.js                    RU/UK/EN interface strings
  importExport.js            JSON export/import + file handling
styles/style.css      All styling (single file, no build step)
tests/                 Zero-dependency test suites, one per module
```

`parserShared.js` isn't in the original architecture sketch — it holds the
number-word tables and hour-resolution logic common to all three parsers, so
they aren't triplicated. `parser.js` still owns per-language dispatch.

## Parser rules

The date/time parser is deterministic and unit-tested (`tests/parser.test.js`
covers every example below). A few rules worth knowing:

- **Explicit 24-hour times are never changed.** `14:30` always means 14:30,
  regardless of any "morning/evening" word nearby.
- **A spoken hour 1–12 with a period word** (morning/day/evening/night, or
  their RU/UK equivalents) resolves the way you'd expect: "2pm" → 14:00,
  "2am" → 02:00.
- **A bare ambiguous hour** with no am/pm and no period word (e.g. "at 2",
  "в 2") uses a documented default: hours 1–7 default to PM, hours 8–11
  default to AM, 12 is noon, 0 is midnight. This is a guess, so the parser
  marks it `confidence: "inferred"` rather than `"exact"`.
- **A period word alone with no number** ("Friday evening", "вечером") gets a
  reasonable default clock time (morning→09:00, day→13:00, evening→18:00,
  night→21:00), also marked `"inferred"`.
- **Unrecognized date/time phrasing never blocks task creation.** The task
  is still created with the full original text; date/time are just left
  empty for you to set manually.

## What VoiceTasks intentionally does not do

- No accounts, cloud sync, or server backend.
- No automatic planning, prioritization, or scheduling suggestions.
- No auto-completing, auto-deleting, or auto-moving tasks — overdue tasks
  stay active (optionally marked overdue in the UI) until you act on them.
- No alarms or calendar writes (a native mobile app could add this later,
  but this PWA does not).

## Browser support notes

- Core features (create/edit/delete/complete/restore/import/export) target
  Chrome, Edge, and Safari on both desktop and mobile, plus Samsung
  Internet, without relying on Chrome-only APIs.
- Voice input depends on each browser's `SpeechRecognition` implementation
  and, on some platforms, an internet connection or installed language
  pack. When it's unavailable, denied, or fails, VoiceTasks shows a clear
  message and you can keep typing — nothing breaks.

## Release strategy

As recommended in the product spec, keep a stable branch/repo separate from
an experimental one:

- `voice-task-planner` — stable, only tested changes.
- `voice-task-planner-lab` — for trying things before they reach the stable
  link.
