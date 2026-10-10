import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    name: 'unit:runtime',
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'test/**/*.test.ts'],
  },
});
