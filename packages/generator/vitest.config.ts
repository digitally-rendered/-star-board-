import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    name: 'unit:generator',
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'test/**/*.test.ts'],
  },
});
