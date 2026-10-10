import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GeneratorError } from '@star-board/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertNoDrift, check, generate, writeFiles, type Drift } from '../src/index.js';
import { petstore } from './fixture.js';

describe('drift check', () => {
  let root: string;
  let opts: { out: string; features: string };
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'star-board-drift-'));
    opts = { out: join(root, 'generated'), features: join(root, 'features') };
    writeFiles(generate(petstore(), opts), opts);
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reports nothing right after generate', () => {
    expect(check(petstore(), opts)).toEqual([]);
    expect(() => {
      assertNoDrift(petstore(), opts);
    }).not.toThrow();
  });

  it('reports changed after a byte change', () => {
    const target = join(opts.out, 'domain', 'pet', 'types.ts');
    writeFileSync(target, '// edited\n', { flag: 'a' });
    expect(check(petstore(), opts)).toEqual<Drift[]>([
      { path: 'domain/pet/types.ts', kind: 'changed' },
    ]);
  });

  it('reports missing after a delete and extra after a stray file', () => {
    unlinkSync(join(opts.out, 'routes.tsx'));
    writeFileSync(join(opts.out, 'domain', 'pet', 'Hand.tsx'), 'export {};\n');
    expect(check(petstore(), opts)).toEqual<Drift[]>([
      { path: 'domain/pet/Hand.tsx', kind: 'extra' },
      { path: 'routes.tsx', kind: 'missing' },
    ]);
  });

  it('reports drift when the model changes', () => {
    const model = petstore();
    const create = model.operations.pet_create;
    if (!create) throw new Error('fixture has no pet_create');
    create.capabilities = ['pet:admin'];
    const drifts = check(model, opts);
    expect(drifts.map((d) => d.path)).toContain('application/pet/usePetActions.ts');
    expect(drifts.every((d) => d.kind === 'changed')).toBe(true);
  });

  it('assertNoDrift throws GENERATOR_DRIFT listing the paths', () => {
    unlinkSync(join(opts.out, 'nav.ts'));
    const failing = () => {
      assertNoDrift(petstore(), opts);
    };
    expect(failing).toThrow(GeneratorError);
    expect(failing).toThrow(/missing nav\.ts/);
    try {
      failing();
    } catch (error) {
      const generatorError = error as GeneratorError;
      expect(generatorError.code).toBe('GENERATOR_DRIFT');
      expect(generatorError.details.drifts).toEqual([{ path: 'nav.ts', kind: 'missing' }]);
    }
  });

  it('accepts a bare readFile function and then reports no extras', () => {
    const drifts = check(petstore(), opts, () => undefined);
    expect(drifts.every((d) => d.kind === 'missing')).toBe(true);
    expect(drifts.length).toBe(generate(petstore(), opts).length);
  });
});
