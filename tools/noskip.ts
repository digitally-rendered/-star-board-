#!/usr/bin/env node
/** Never skip a test (shared/04 §5 Class A). Fails on any skip/todo/only marker in test files. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const PATTERN = /\b(it|test|describe)\.(skip|todo|only)\(|\bx(it|test|describe)\(|\bfixme\(/;
const ALLOW = /\/\/\s*noskip-allow:\s*\S+/; // only for a missing optional integration dependency, with a reason
function walk(dir: string, out: string[]): void {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === 'dist' || e === 'coverage' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.test\.ts$|\.spec\.ts$/.test(e)) out.push(p);
  }
}
const files: string[] = [];
walk(process.cwd(), files);
let bad = 0;
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (PATTERN.test(l) && !ALLOW.test(l)) {
      bad++;
      console.error(`${f}:${i + 1}: ${l.trim()}`);
    }
  });
}
if (bad) {
  console.error(`noskip: ${bad} skipped/only/todo test markers found`);
  process.exit(1);
}
console.log(`noskip: ok (${files.length} test files)`);
