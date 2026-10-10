import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    name: 'unit:cli',
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'test/**/*.test.ts'],
  },
});
