// speech.test.js — run with: node tests/speech.test.js
// Mocks window.SpeechRecognition to verify speech.js's strict rules from
// spec section 11 without needing a real browser.

class MockRecognition {
  constructor() {
    this.lang = '';
    this.continuous = false;
    this.interimResults = false;
    this.maxAlternatives = 1;
    MockRecognition.instances.push(this);
  }
  start() { this.onstart?.(); }
  stop() { this._stopped = true; this.onend?.(); }
  // Test helpers to simulate browser events:
  fireResult(transcript, isFinal) {
    this.onresult?.({ results: [[{ transcript }]].map(r => Object.assign(r, { isFinal, 0: { transcript } })) });
  }
  fireError(error) {
    this.onerror?.({ error });
  }
}
MockRecognition.instances = [];

globalThis.window = { SpeechRecognition: MockRecognition };

const { isSpeechSupported, startVoiceCapture } = await import('../src/speech.js');
const { describe, test, assertEqual, assertTrue, summarize } = await import('./testRunner.js');

describe('speech: support detection', () => {
  test('reports supported when SpeechRecognition exists', () => {
    assertTrue(isSpeechSupported());
  });
});

describe('speech: one recording -> at most one final result', () => {
  test('a final result triggers onFinalResult exactly once', () => {
    MockRecognition.instances = [];
    let calls = 0;
    let lastText = null;
    startVoiceCapture('en', {
      onFinalResult: (text) => { calls++; lastText = text; },
      onError: () => {},
      onListeningChange: () => {},
      onEnd: () => {}
    });
    const rec = MockRecognition.instances[0];
    rec.fireResult('buy milk', true);
    // Simulate a duplicate/late final event firing again — must be ignored.
    rec.fireResult('buy milk again', true);
    assertEqual(calls, 1);
    assertEqual(lastText, 'buy milk');
  });

  test('non-final (interim) results never trigger onFinalResult', () => {
    MockRecognition.instances = [];
    let calls = 0;
    startVoiceCapture('en', {
      onFinalResult: () => { calls++; },
      onError: () => {},
      onListeningChange: () => {},
      onEnd: () => {}
    });
    const rec = MockRecognition.instances[0];
    rec.fireResult('buy', false);
    rec.fireResult('buy milk', false);
    assertEqual(calls, 0);
  });

  test('an empty final transcript reports no-speech, not a task', () => {
    MockRecognition.instances = [];
    let errorCode = null;
    let finalCalls = 0;
    startVoiceCapture('en', {
      onFinalResult: () => { finalCalls++; },
      onError: (code) => { errorCode = code; },
      onListeningChange: () => {},
      onEnd: () => {}
    });
    const rec = MockRecognition.instances[0];
    rec.fireResult('   ', true);
    assertEqual(finalCalls, 0);
    assertEqual(errorCode, 'no-speech');
  });
});

describe('speech: error mapping', () => {
  for (const code of ['network', 'not-allowed', 'no-speech', 'audio-capture']) {
    test(`propagates known error code "${code}" as-is`, () => {
      MockRecognition.instances = [];
      let seen = null;
      startVoiceCapture('en', { onFinalResult: () => {}, onError: (c) => { seen = c; }, onListeningChange: () => {}, onEnd: () => {} });
      MockRecognition.instances[0].fireError(code);
      assertEqual(seen, code);
    });
  }

  test('unknown error codes map to "generic" rather than throwing', () => {
    MockRecognition.instances = [];
    let seen = null;
    startVoiceCapture('en', { onFinalResult: () => {}, onError: (c) => { seen = c; }, onListeningChange: () => {}, onEnd: () => {} });
    MockRecognition.instances[0].fireError('some-weird-code');
    assertEqual(seen, 'generic');
  });
});

describe('speech: graceful when unsupported', () => {
  test('reports "unsupported" error instead of throwing when no API exists', () => {
    const saved = window.SpeechRecognition;
    delete window.SpeechRecognition;
    let seen = null;
    startVoiceCapture('en', { onFinalResult: () => {}, onError: (c) => { seen = c; }, onListeningChange: () => {}, onEnd: () => {} });
    assertEqual(seen, 'unsupported');
    window.SpeechRecognition = saved;
  });
});

const ok = summarize();
if (!ok) process.exit(1);
