import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.js';
import { localeFromSearch } from './i18n/locale.js';
import { MODEL } from './model.js';

/**
 * Review switches on the query string (the usability capture uses them): `?overrides=0` skips
 * `registerPetOverrides` so the generated defaults show, `?rows=<n>` seeds that many rows and
 * `?delay=<ms>` holds every mock answer so the loading states can be seen.
 */
export function reviewOptions(search: string): {
  overrides: boolean;
  rows: number | undefined;
  delay: number | undefined;
} {
  const params = new URLSearchParams(search);
  const integer = (name: string): number | undefined => {
    const value = params.get(name);
    if (value === null) return undefined;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) || parsed < 0 ? undefined : parsed;
  };
  return {
    overrides: params.get('overrides') !== '0',
    rows: integer('rows'),
    delay: integer('delay'),
  };
}

/** msw answers `/api` in development (`VITE_MSW=0` to reach a real backend). */
async function start(): Promise<void> {
  const review = reviewOptions(window.location.search);
  if (import.meta.env.DEV && import.meta.env.VITE_MSW !== '0') {
    const { startMockServer } = await import('./msw/browser.js');
    await startMockServer(MODEL, {
      ...(review.rows === undefined ? {} : { rows: review.rows }),
      ...(review.delay === undefined ? {} : { delay: review.delay }),
    });
  }
  const root = document.getElementById('root');
  if (root === null) throw new Error('index.html has no #root');
  // `?lang=fr` switches the locale and the translation table (typescript/05 §7).
  const { locale, messages } = localeFromSearch(window.location.search);
  document.documentElement.lang = locale;
  createRoot(root).render(
    <StrictMode>
      <App model={MODEL} locale={locale} messages={messages} overrides={review.overrides} />
    </StrictMode>,
  );
}

void start();
