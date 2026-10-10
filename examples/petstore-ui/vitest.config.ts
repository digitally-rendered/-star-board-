import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

export default mergeConfig(
  viteConfig,
  defineConfig({
    ssr: { resolve: { conditions: ['star-board-source'] } },
    test: {
      name: 'unit:example-petstore-ui',
      environment: 'jsdom',
      setupFiles: ['test/setup.ts'],
      include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
      testTimeout: 30_000,
    },
  }),
);
