import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.js';
import { MODEL } from './model.js';

/** msw answers `/api` in development (`VITE_MSW=0` to reach a real backend). */
async function start(): Promise<void> {
  if (import.meta.env.DEV && import.meta.env.VITE_MSW !== '0') {
    const { startMockServer } = await import('./msw/browser.js');
    await startMockServer(MODEL);
  }
  const root = document.getElementById('root');
  if (root === null) throw new Error('index.html has no #root');
  createRoot(root).render(
    <StrictMode>
      <App model={MODEL} />
    </StrictMode>,
  );
}

void start();
