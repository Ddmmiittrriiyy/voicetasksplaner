// sw.js — VoiceTasks service worker.
//
// Rules from spec section 6, enforced deliberately in this file:
//  - caches the app shell only (never task data, which lives in localStorage
//    and is never touched by this file);
//  - never calls clients.navigate() or forces a reload;
//  - new versions are cached in the background under a new cache name and
//    only take over on the NEXT natural load (next app start / manual
//    refresh), not the current session;
//  - old caches are cleaned up on activate, but nothing about user data.
//
// Bump CACHE_VERSION whenever any shell file changes.
const CACHE_VERSION = 'voicetasks-shell-v1';

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './styles/style.css',
  './src/app.js',
  './src/ui.js',
  './src/i18n.js',
  './src/storage.js',
  './src/taskModel.js',
  './src/parser.js',
  './src/parserShared.js',
  './src/parser.ru.js',
  './src/parser.uk.js',
  './src/parser.en.js',
  './src/speech.js',
  './src/importExport.js',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_FILES))
  );
  // Do NOT call self.skipWaiting() here: the new service worker should wait
  // until the current session ends naturally, per the "no force reload"
  // rule. It activates on the next app start / browser refresh.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      )
    )
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          // Refresh the cache in the background for next time; never blocks
          // or replaces what's currently on screen.
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached); // offline: fall back to whatever we had cached

      // Cache-first for the shell so the text interface stays instant and
      // fully usable offline; network is used to keep the cache fresh.
      return cached || network;
    })
  );
});

// If a future version adds a user-facing "update available" prompt, it
// must go through an explicit user confirmation message here, e.g.:
//   self.addEventListener('message', (event) => {
//     if (event.data === 'SKIP_WAITING') self.skipWaiting();
//   });
// No such auto-reload path exists yet, by design.
