import type { FeatureModel } from '@star-board/core';
import { createStore, fixtures, handlersFromModel, type Store } from '@star-board/testing/browser';
import { delay, http } from 'msw';
import { setupWorker, type SetupWorker } from 'msw/browser';

export interface MockServer {
  worker: SetupWorker;
  store: Store;
}

/** Rows seeded per schema when the worker starts. */
export const SEED_ROWS = 12;

export interface MockServerOptions {
  baseUrl?: string;
  /** Rows per schema; default {@link SEED_ROWS}, 0 for the empty states. */
  rows?: number;
  /** Milliseconds every answer waits; shows the loading states. */
  delay?: number;
}

/**
 * Dev mode without a backend: a service worker answering every operation of the document from an
 * in-memory store seeded with fixtures (deterministic for a seed), the same handlers the tests use.
 */
export async function startMockServer(
  model: FeatureModel,
  options: MockServerOptions = {},
): Promise<MockServer> {
  const baseUrl = options.baseUrl ?? '/api';
  const store = createStore();
  for (const schema of Object.keys(model.schemas)) {
    store.seed(schema, fixtures(model, schema, options.rows ?? SEED_ROWS, { seed: 1 }));
  }
  const wait = options.delay;
  // A handler that answers nothing falls through to the document's handlers after the wait.
  const slow =
    wait === undefined
      ? []
      : [
          http.all(`${baseUrl}/*`, async () => {
            await delay(wait);
          }),
        ];
  const worker = setupWorker(...slow, ...handlersFromModel(model, { store, baseUrl }));
  await worker.start({ quiet: true });
  return { worker, store };
}
