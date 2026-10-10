// @ts-check
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

// Hexagonal layers as ESLint elements (hexagonal-rules shared/01 §1, typescript/12 §5).
// Same facts as tools/depcruise.config.cjs; dependency-cruiser enforces them in CI.
const LAYERS = [
  { type: 'core', pattern: 'packages/core/**' },
  { type: 'spec', pattern: 'packages/spec/**' },
  { type: 'tokens', pattern: 'packages/tokens/**' },
  { type: 'runtime', pattern: 'packages/runtime/**' },
  { type: 'renderer', pattern: 'packages/renderer-mui/**' },
  { type: 'generator', pattern: 'packages/generator/**' },
  { type: 'testing', pattern: 'packages/testing/**' },
  { type: 'storybook', pattern: 'packages/storybook/**' },
  { type: 'cli', pattern: 'packages/cli/**' },
];

// Plan §2.1 build levels: a package imports only lower levels.
const ALLOWED = {
  core: ['core'],
  spec: ['core', 'spec'],
  tokens: ['core', 'tokens'],
  runtime: ['core', 'runtime'],
  renderer: ['core', 'runtime', 'tokens', 'renderer'],
  generator: ['core', 'spec', 'generator'],
  testing: ['core', 'spec', 'runtime', 'renderer', 'generator', 'testing'],
  storybook: ['core', 'tokens', 'runtime', 'renderer', 'storybook'],
  cli: ['core', 'spec', 'tokens', 'generator', 'testing', 'cli'],
};

// The core and the generator never import React or a renderer (type hints count).
const FORBIDDEN_IN_CORE = [
  'react',
  'react-dom',
  '@mui/*',
  '@emotion/*',
  '@tanstack/*',
  'openapi-fetch',
];

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/.tsbuild/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/generated/**',
      'storybook-static/**',
      '**/*.cjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { boundaries },
    settings: {
      'boundaries/elements': LAYERS,
      'import/resolver': { typescript: { project: ['tsconfig.json', 'packages/*/tsconfig.json'] } },
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: Object.entries(ALLOWED).map(([from, allow]) => ({ from, allow })),
        },
      ],
      'boundaries/no-unknown-files': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['packages/core/**', 'packages/generator/**', 'packages/spec/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: FORBIDDEN_IN_CORE }] },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: { '@typescript-eslint/no-unsafe-assignment': 'off' },
  },
  prettier,
);
