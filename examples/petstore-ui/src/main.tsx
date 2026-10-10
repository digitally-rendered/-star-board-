import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.js';
import { localeFromSearch } from './i18n/locale.js';
import { MODEL } from './model.js';

/** msw answers `/api` in development (`VITE_MSW=0` to reach a real backend). */
async function start(): Promise<void> {
  if (import.meta.env.DEV && import.meta.env.VITE_MSW !== '0') {
    const { startMockServer } = await import('./msw/browser.js');
    await startMockServer(MODEL);
  }
  const root = document.getElementById('root');
  if (root === null) throw new Error('index.html has no #root');
  // `?lang=fr` switches the locale and the translation table (typescript/05 §7).
  const { locale, messages } = localeFromSearch(window.location.search);
  document.documentElement.lang = locale;
  createRoot(root).render(
    <StrictMode>
      <App model={MODEL} locale={locale} messages={messages} />
    </StrictMode>,
  );
}

void start();
