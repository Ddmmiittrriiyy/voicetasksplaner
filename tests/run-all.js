// run-all.js — runs every *.test.js file in this folder in a child process,
// so that mocks (e.g. globalThis.window) in one file never leak into another.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter(f => f.endsWith('.test.js')).sort();

let allOk = true;
for (const file of files) {
  console.log(`\n=== ${file} ===`);
  const res = spawnSync(process.execPath, [path.join(dir, file)], { stdio: 'inherit' });
  if (res.status !== 0) allOk = false;
}

console.log(allOk ? '\nAll test files passed.' : '\nSome test files failed.');
process.exit(allOk ? 0 : 1);
