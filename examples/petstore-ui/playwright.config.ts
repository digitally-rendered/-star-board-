import { defineConfig } from '@playwright/test';

/**
 * End-to-end over the Vite dev server with msw answering `/api` (no backend needed). Browsers must
 * be installed (`pnpm exec playwright install chromium`); `pnpm test:e2e` is not part of `pnpm test`.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  // reducedMotion: MUI transitions end immediately, so axe never measures a fading menu.
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure', reducedMotion: 'reduce' },
  webServer: {
    command: 'pnpm dev --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: process.env.CI === undefined,
    timeout: 60_000,
  },
});
