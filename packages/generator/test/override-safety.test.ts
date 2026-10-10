import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GeneratorError } from '@star-board/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generate, resolveOutputPath, writeFiles } from '../src/index.js';
import { petstore } from './fixture.js';

/** Every file under `dir` with its contents, as a sorted list: the snapshot of a tree. */
function snapshotTree(dir: string): [string, string][] {
  const out: [string, string][] = [];
  const walk = (current: string, prefix: string): void => {
    for (const entry of readdirSync(current).sort()) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full, `${prefix}${entry}/`);
      else out.push([`${prefix}${entry}`, readFileSync(full, 'utf8')]);
    }
  };
  walk(dir, '');
  return out;
}

describe('override safety', () => {
  let root: string;
  let out: string;
  let features: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'star-board-generator-'));
    out = join(root, 'src', 'generated');
    features = join(root, 'src', 'features');
    mkdirSync(join(features, 'pet', 'components'), { recursive: true });
    writeFileSync(join(features, 'pet', 'index.ts'), "export const registered = ['field.text'];\n");
    writeFileSync(
      join(features, 'pet', 'components', 'NameField.tsx'),
      'export const NameField = 1;\n',
    );
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('leaves features/ byte-identical and writes only under out', () => {
    const before = snapshotTree(features);
    const files = generate(petstore(), { out, features });
    const written = writeFiles(files, { out, features });
    expect(snapshotTree(features)).toEqual(before);
    expect(written).toHaveLength(files.length);
    for (const path of written) expect(path.startsWith(out)).toBe(true);
    expect(readdirSync(join(root, 'src')).sort()).toEqual(['features', 'generated']);
    expect(existsSync(join(out, 'manifest.json'))).toBe(true);
  });

  it('refuses a path that escapes out', () => {
    const escaping = () => resolveOutputPath('../features/x.ts', { out, features });
    expect(escaping).toThrow(GeneratorError);
    expect(escaping).toThrow(/escapes the output directory/);
    try {
      escaping();
    } catch (error) {
      expect((error as GeneratorError).code).toBe('GENERATOR_OUT_OF_SURFACE');
    }
    expect(() => resolveOutputPath('/etc/passwd', { out, features })).toThrow(GeneratorError);
  });

  it('refuses a path that lands inside features even when features is under out', () => {
    const nested = { out: join(root, 'src'), features };
    expect(() => resolveOutputPath('features/pet/index.ts', nested)).toThrow(/override directory/);
    expect(() => resolveOutputPath('generated/x.ts', nested)).not.toThrow();
  });

  it('writes nothing when one file in the set is out of surface', () => {
    const files = [
      { path: 'ok.ts', contents: 'export {};\n' },
      { path: '../features/pet/index.ts', contents: 'overwritten\n' },
    ];
    const before = snapshotTree(features);
    expect(() => writeFiles(files, { out, features })).toThrow(GeneratorError);
    expect(existsSync(join(out, 'ok.ts'))).toBe(false);
    expect(snapshotTree(features)).toEqual(before);
  });
});
