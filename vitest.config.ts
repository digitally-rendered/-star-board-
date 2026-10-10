import { defineConfig } from 'vitest/config';

// Workspace root. Every package and example is a project; filter with --project.
export default defineConfig({
  test: {
    projects: ['packages/*/vitest.config.ts', 'examples/*/vitest.config.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      include: ['**/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/index.ts',
        '**/dist/**',
        '**/.tsbuild/**',
        '**/generated/**',
      ],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
    reporters: process.env.CI ? ['dot', 'junit'] : ['default'],
    outputFile: { junit: 'coverage/junit.xml' },
  },
});
