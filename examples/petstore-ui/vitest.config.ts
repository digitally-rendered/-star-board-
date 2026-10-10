import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { name: 'unit:example-petstore-ui', environment: 'jsdom', include: ['src/**/*.test.tsx'] },
});
