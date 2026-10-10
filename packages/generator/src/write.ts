import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { GeneratorError } from '@star-board/core';
import type { GeneratedFile } from './emit/support.js';
import type { GenerateOptions } from './generate.js';

/** Absolute path of `file` under `out`, or GENERATOR_OUT_OF_SURFACE when it would land elsewhere. */
export function resolveOutputPath(
  path: string,
  opts: Pick<GenerateOptions, 'out' | 'features'>,
): string {
  const out = resolve(opts.out);
  const features = resolve(opts.features);
  const target = resolve(out, path);
  if (!isInside(out, target)) {
    throw new GeneratorError(
      'GENERATOR_OUT_OF_SURFACE',
      `generated path ${path} escapes the output directory ${opts.out}`,
      { path, out: opts.out, resolved: target },
    );
  }
  if (isInside(features, target)) {
    throw new GeneratorError(
      'GENERATOR_OUT_OF_SURFACE',
      `generated path ${path} lands inside the override directory ${opts.features}`,
      { path, features: opts.features, resolved: target },
    );
  }
  return target;
}

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

/**
 * Writes `files` under `opts.out` and nothing else. Every path is checked before the first write,
 * so a single offending path writes nothing; `features/` is never created, modified or deleted.
 */
export function writeFiles(
  files: readonly GeneratedFile[],
  opts: Pick<GenerateOptions, 'out' | 'features'>,
): string[] {
  const targets = files.map((file) => ({ file, target: resolveOutputPath(file.path, opts) }));
  const written: string[] = [];
  for (const { file, target } of targets) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.contents, 'utf8');
    written.push(target);
  }
  return written;
}
