#!/usr/bin/env node
/**
 * Deterministic gate for tasks.md wave graphs (hexagonal-rules/specs/04 §4).
 * Checks: wave JSON parses; waves are 1..M contiguous; every top-level task appears in exactly
 * one wave; mermaid edges (solid or dotted) respect wave(from) < wave(to); no unknown task ids.
 * Usage: node tools/check_waves.ts [paths...]   (default: .kiro/specs/*\/tasks.md)
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

interface Wave {
  wave: number;
  tasks: number[];
  description: string;
}

function findTasksFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const p = join(root, entry);
    if (statSync(p).isDirectory()) {
      const t = join(p, 'tasks.md');
      if (existsSync(t)) out.push(t);
    }
  }
  return out;
}

export function checkWaves(markdown: string): string[] {
  const errors: string[] = [];
  const jsonMatch = /```json\s*\n(\{\s*"waves"[\s\S]*?)\n```/m.exec(markdown);
  if (!jsonMatch?.[1]) return ['no wave JSON block found'];
  let waves: Wave[];
  try {
    waves = (JSON.parse(jsonMatch[1]) as { waves: Wave[] }).waves;
  } catch (e) {
    return [`wave JSON does not parse: ${(e as Error).message}`];
  }
  const taskIds = [...markdown.matchAll(/^- \[[ x]\] (?:\*\*)?(\d+)\./gm)].map((m) => Number(m[1]));
  const taskSet = new Set(taskIds);
  if (taskSet.size !== taskIds.length) errors.push('duplicate top-level task numbers');
  waves.forEach((w, i) => {
    if (w.wave !== i + 1)
      errors.push(`wave numbering not contiguous at index ${i} (got ${w.wave})`);
    if (!w.description.trim()) errors.push(`wave ${w.wave} has no description`);
  });
  const waveOf = new Map<number, number>();
  for (const w of waves)
    for (const t of w.tasks) {
      if (waveOf.has(t)) errors.push(`task ${t} appears in waves ${waveOf.get(t)} and ${w.wave}`);
      waveOf.set(t, w.wave);
      if (!taskSet.has(t)) errors.push(`wave ${w.wave} references unknown task ${t}`);
    }
  for (const t of taskSet) if (!waveOf.has(t)) errors.push(`task ${t} is in no wave`);
  const edges = [...markdown.matchAll(/T(\d+)\s*(?:-->|-\.->|-\.\s*->)\s*T(\d+)/g)];
  for (const e of edges) {
    const a = Number(e[1]);
    const b = Number(e[2]);
    const wa = waveOf.get(a);
    const wb = waveOf.get(b);
    if (wa === undefined || wb === undefined) {
      errors.push(`edge T${a}->T${b} references a task not in any wave`);
      continue;
    }
    if (!(wa < wb)) errors.push(`edge T${a}->T${b} violates wave order (w${wa} -> w${wb})`);
  }
  return errors;
}

const args = process.argv.slice(2);
const files = args.length ? args : findTasksFiles('.kiro/specs');
let failed = false;
for (const f of files) {
  const errs = checkWaves(readFileSync(f, 'utf8'));
  if (errs.length) {
    failed = true;
    console.error(`✗ ${f}`);
    for (const e of errs) console.error(`   - ${e}`);
  } else console.log(`✓ ${f}`);
}
if (!files.length) console.log('check_waves: no tasks.md files found');
process.exit(failed ? 1 : 0);
