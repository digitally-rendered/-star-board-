import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterAll, describe, expect, it } from 'vitest';
import { generate, writeFiles, type GeneratedFile } from '../src/index.js';
import { petstore, petstoreWithCustomOperations } from './fixture.js';

/*
 * Proves the emitted TypeScript and TSX are well-formed under the strictest consumer settings
 * (tsconfig.base.json: strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess) against stub
 * declarations of the runtime, the core, the renderer and react-router, and the real @types/react
 * and zod. No runtime package is needed.
 */

const require = createRequire(import.meta.url);
const STUBS = fileURLToPath(new URL('./stubs/', import.meta.url));
const REACT_TYPES = dirname(require.resolve('@types/react/package.json'));
const ZOD_TYPES = join(dirname(require.resolve('zod/package.json')), 'index.d.ts');

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function compile(files: readonly GeneratedFile[], label: string): string[] {
  const root = mkdtempSync(join(tmpdir(), `star-board-compile-${label}-`));
  roots.push(root);
  const out = join(root, 'src', 'generated');
  const features = join(root, 'src', 'features');
  writeFiles(files, { out, features });
  // NodeNext reads the nearest package.json to classify files; a consumer app is ESM.
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'consumer', type: 'module' }));
  const tsconfig = {
    compilerOptions: {
      target: 'ES2023',
      lib: ['ES2023', 'DOM', 'DOM.Iterable'],
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      jsx: 'react-jsx',
      strict: true,
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
      noImplicitOverride: true,
      noFallthroughCasesInSwitch: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      verbatimModuleSyntax: true,
      isolatedModules: true,
      resolveJsonModule: true,
      skipLibCheck: true,
      noEmit: true,
      types: [],
      baseUrl: '.',
      paths: {
        '@star-board/runtime': [join(STUBS, 'runtime.d.ts')],
        '@star-board/core': [join(STUBS, 'core.d.ts')],
        '@star-board/renderer-mui': [join(STUBS, 'renderer-mui.d.ts')],
        'react-router': [join(STUBS, 'react-router.d.ts')],
        react: [join(REACT_TYPES, 'index.d.ts')],
        'react/jsx-runtime': [join(REACT_TYPES, 'jsx-runtime.d.ts')],
        zod: [ZOD_TYPES],
      },
    },
    include: ['src/**/*.ts', 'src/**/*.tsx'],
  };
  const configPath = join(root, 'tsconfig.json');
  writeFileSync(configPath, JSON.stringify(tsconfig, null, 2));
  const read = ts.readConfigFile(configPath, (path) => ts.sys.readFile(path));
  if (read.error) throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, root);
  expect(parsed.errors).toEqual([]);
  expect(parsed.fileNames.length).toBe(files.filter((f) => /\.tsx?$/.test(f.path)).length);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const diagnostics = [
    ...program.getOptionsDiagnostics(),
    ...program.getGlobalDiagnostics(),
    ...program.getSyntacticDiagnostics(),
    ...program.getSemanticDiagnostics(),
  ];
  return diagnostics.map((d) => {
    const where = d.file
      ? `${d.file.fileName.replace(`${root}/`, '')}:${String(d.file.getLineAndCharacterOfPosition(d.start ?? 0).line + 1)}`
      : '<options>';
    return `${where} TS${String(d.code)} ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`;
  });
}

describe('generated screens compile', () => {
  it('type-checks the petstore output with no diagnostics', () => {
    const files = generate(petstore(), { out: 'src/generated', features: 'src/features' });
    expect(compile(files, 'petstore')).toEqual([]);
  });

  it('type-checks the output with Tier 3 operations and with i18n: false', () => {
    const files = generate(petstoreWithCustomOperations(), {
      out: 'src/generated',
      features: 'src/features',
      i18n: false,
    });
    expect(compile(files, 'custom')).toEqual([]);
  });
});
