import { defineConfig } from 'vitest/config';
export default defineConfig({
  // Resolve workspace packages to their sources so tests need no prior build (tsconfig.base.json
  // uses the same condition); jsdom tests transform in web mode, so both condition lists apply.
  resolve: { conditions: ['star-board-source'] },
  ssr: { resolve: { conditions: ['star-board-source'] } },
  test: {
    name: 'unit:renderer-mui',
    environment: 'jsdom',
    setupFiles: ['test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'test/**/*.test.ts'],
  },
});
