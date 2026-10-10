import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { GeneratorError, type FeatureModel } from '@star-board/core';
import type { GeneratedFile } from './emit/support.js';
import { generate, type GenerateOptions } from './generate.js';

export type DriftKind = 'missing' | 'changed' | 'extra';

export interface Drift {
  /** Relative to `out`, `/` separators. */
  path: string;
  kind: DriftKind;
}

/** What `check` reads; a function is enough when only missing/changed matter. */
export interface Disk {
  /** Contents of the file at the absolute path, or undefined when absent. */
  readFile: (path: string) => string | undefined;
  /** Every file under the absolute directory, as paths relative to it with `/`; [] when absent. */
  listFiles?: (dir: string) => readonly string[];
}

export type DiskReader = Disk | Disk['readFile'];

/** `node:fs`-backed reader. */
export const nodeDisk: Required<Disk> = {
  readFile(path) {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      return undefined;
    }
  },
  listFiles(dir) {
    const out: string[] = [];
    const walk = (current: string): void => {
      let entries: string[];
      try {
        entries = readdirSync(current);
      } catch {
        return;
      }
      for (const entry of entries.sort()) {
        const full = join(current, entry);
        if (statSync(full).isDirectory()) walk(full);
        else out.push(relative(dir, full).split('\\').join('/'));
      }
    };
    walk(dir);
    return out;
  },
};

/**
 * Compares what `generate` would emit with what is on disk under `out` (plan Part 4 "check").
 * `extra` is a file under `out` that the generator did not emit; `features/` is never read.
 */
export function check(
  model: FeatureModel,
  opts: GenerateOptions,
  disk: DiskReader = nodeDisk,
): Drift[] {
  return checkFiles(generate(model, opts), opts, disk);
}

export function checkFiles(
  files: readonly GeneratedFile[],
  opts: Pick<GenerateOptions, 'out'>,
  disk: DiskReader = nodeDisk,
): Drift[] {
  const reader: Disk = typeof disk === 'function' ? { readFile: disk } : disk;
  const out = resolve(opts.out);
  const drifts: Drift[] = [];
  const expected = new Set(files.map((f) => f.path));
  for (const file of files) {
    const actual = reader.readFile(join(out, ...file.path.split('/')));
    if (actual === undefined) drifts.push({ path: file.path, kind: 'missing' });
    else if (actual !== file.contents) drifts.push({ path: file.path, kind: 'changed' });
  }
  if (reader.listFiles) {
    for (const path of reader.listFiles(out)) {
      if (!expected.has(path)) drifts.push({ path, kind: 'extra' });
    }
  }
  return drifts.sort((a, b) => a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind));
}

/** Throws GENERATOR_DRIFT listing every drifted path; the CLI maps it to exit 1. */
export function assertNoDrift(
  model: FeatureModel,
  opts: GenerateOptions,
  disk: DiskReader = nodeDisk,
): void {
  const drifts = check(model, opts, disk);
  if (drifts.length === 0) return;
  const summary = drifts.map((d) => `${d.kind} ${d.path}`).join(', ');
  throw new GeneratorError(
    'GENERATOR_DRIFT',
    `${drifts.length} generated file(s) drifted under ${opts.out}: ${summary}`,
    { out: opts.out, drifts },
  );
}
