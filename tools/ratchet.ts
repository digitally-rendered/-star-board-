#!/usr/bin/env node
/** Architecture-drift ratchet (shared/04 §3). Counts never increase; baseline in tools/ratchet-baseline.json. */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const COUNTERS: Record<string, RegExp> = {
  any_escapes: /\bas any\b|:\s*any\b/,
  handwritten_fetch: /\bfetch\(|from 'axios'/,
  renderer_import_outside_registry: /from '@mui\//,
  inline_case_mapping: /\b(snakeToCamel|camelToSnake)\(/,
};
const SKIP = new Set(['node_modules', 'dist', '.tsbuild', 'coverage', 'generated']);
function walk(dir: string, out: string[]): void {
  for (const e of readdirSync(dir)) {
    if (SKIP.has(e) || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
  }
}
const files: string[] = [];
walk('packages', files);
const counts: Record<string, number> = Object.fromEntries(Object.keys(COUNTERS).map((k) => [k, 0]));
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  for (const [k, re] of Object.entries(COUNTERS)) {
    // renderer imports are allowed inside the renderer package itself
    if (k === 'renderer_import_outside_registry' && f.startsWith(join('packages', 'renderer-mui')))
      continue;
    if (re.test(text)) counts[k] = (counts[k] ?? 0) + 1;
  }
}
const baselinePath = 'tools/ratchet-baseline.json';
if (process.argv.includes('--update')) {
  writeFileSync(baselinePath, JSON.stringify(counts, null, 2) + '\n');
  console.log('ratchet: baseline updated', counts);
  process.exit(0);
}
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as Record<string, number>;
let bad = 0;
for (const [k, v] of Object.entries(counts)) {
  const b = baseline[k] ?? 0;
  if (v > b) {
    bad++;
    console.error(`ratchet: ${k} rose ${b} -> ${v}`);
  }
}
console.log(bad ? `ratchet: ${bad} counter(s) increased` : `ratchet: ok ${JSON.stringify(counts)}`);
process.exit(bad ? 1 : 0);
