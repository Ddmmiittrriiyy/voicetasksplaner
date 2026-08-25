// speech.js
// Wraps the browser SpeechRecognition API. Isolated from ui.js/storage.js so
// browser-specific speech behavior can never corrupt task data or rendering
// (spec section 18). Enforces the strict rule in section 11: one recording
// session produces at most one final transcript, ever — partial results are
// never used to create or append tasks.

import { SPEECH_LANG_TAG } from './i18n.js';

function getRecognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isSpeechSupported() {
  return !!getRecognitionCtor();
}

/**
 * Starts a single voice capture session.
 * callbacks: { onFinalResult(text), onError(code), onListeningChange(bool), onEnd() }
 * Returns a controller with .stop() to cancel manually.
 */
export function startVoiceCapture(lang, callbacks) {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    callbacks.onError('unsupported');
    return { stop() {} };
  }

  const recognition = new Ctor();
  recognition.lang = SPEECH_LANG_TAG[lang] || 'en-US';
  recognition.continuous = false;
  recognition.interimResults = false; // we never act on partials; belt & suspenders
  recognition.maxAlternatives = 1;

  // Guards against the "one recording -> multiple tasks" failure mode:
  // some browsers can fire multiple final `result` events, or fire `result`
  // after the caller already stopped. Both are ignored once we've consumed
  // the first final result or the session has been stopped.
  let consumed = false;
  let stopped = false;

  recognition.onstart = () => {
    callbacks.onListeningChange?.(true);
  };

  recognition.onresult = (event) => {
    if (consumed || stopped) return;
    // Only look at the latest result, and only if it is final.
    const last = event.results[event.results.length - 1];
    if (!last || !last.isFinal) return; // ignore interim/partial results entirely
    const transcript = (last[0]?.transcript || '').trim();
    consumed = true;
    if (transcript) {
      callbacks.onFinalResult(transcript);
    } else {
      callbacks.onError('no-speech');
    }
    safeStop();
  };

  recognition.onerror = (event) => {
    if (stopped) return;
    const code = ['network', 'not-allowed', 'no-speech', 'audio-capture'].includes(event.error)
      ? event.error
      : 'generic';
    callbacks.onError(code);
    safeStop();
  };

  recognition.onend = () => {
    callbacks.onListeningChange?.(false);
    callbacks.onEnd?.();
  };

  function safeStop() {
    if (stopped) return;
    stopped = true;
    try { recognition.stop(); } catch (e) { /* already stopped */ }
  }

  try {
    recognition.start();
  } catch (e) {
    callbacks.onError('generic');
    return { stop() {} };
  }

  return { stop: safeStop };
}
