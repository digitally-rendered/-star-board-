import { defineConfig } from 'vitest/config';
export default defineConfig({
  // Resolve workspace packages to their sources so tests need no prior build (tsconfig.base.json
  // uses the same condition).
  ssr: { resolve: { conditions: ['star-board-source'] } },
  test: {
    name: 'unit:spec',
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'test/**/*.test.ts'],
  },
});
