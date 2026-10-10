import { defineConfig } from 'vitest/config';
export default defineConfig({
  // Resolve workspace packages to their sources so tests need no prior build (tsconfig.base.json
  // uses the same condition). Vitest runs in Vite's SSR environment, which reads `ssr.resolve`.
  resolve: { conditions: ['star-board-source'] },
  ssr: {
    resolve: { conditions: ['star-board-source', 'module', 'node', 'development|production'] },
  },
  test: {
    name: 'unit:testing',
    // The renderer-independent half runs in node; the screen harness (src/harness) will need jsdom.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'test/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
