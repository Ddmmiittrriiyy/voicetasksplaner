// testRunner.js — tiny zero-dependency test runner.
// Run any test file directly: `node tests/parser.test.js`
// Or all of them: `node tests/run-all.js`

let current = null;
const results = [];

export function describe(name, fn) {
  current = name;
  fn();
  current = null;
}

export function test(name, fn) {
  const label = current ? `${current} > ${name}` : name;
  try {
    fn();
    results.push({ label, ok: true });
  } catch (e) {
    results.push({ label, ok: false, error: e });
  }
}

export function assertEqual(actual, expected, msg = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${msg}\n  expected: ${e}\n  actual:   ${a}`);
  }
}

export function assertTrue(value, msg = 'expected truthy value') {
  if (!value) throw new Error(msg);
}

export function summarize() {
  const failed = results.filter(r => !r.ok);
  for (const r of results) {
    console.log(`${r.ok ? '✓' : '✗'} ${r.label}`);
    if (!r.ok) console.log(`    ${r.error.message.split('\n').join('\n    ')}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) process.exitCode = 1;
  return failed.length === 0;
}
