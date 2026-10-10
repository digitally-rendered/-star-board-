import type { FeatureModel } from '@star-board/core';
import { createStore, fixtures, handlersFromModel, type Store } from '@star-board/testing/browser';
import { setupWorker, type SetupWorker } from 'msw/browser';

export interface MockServer {
  worker: SetupWorker;
  store: Store;
}

/** Rows seeded per schema when the worker starts. */
export const SEED_ROWS = 12;

/**
 * Dev mode without a backend: a service worker answering every operation of the document from an
 * in-memory store seeded with fixtures (deterministic for a seed), the same handlers the tests use.
 */
export async function startMockServer(model: FeatureModel, baseUrl = '/api'): Promise<MockServer> {
  const store = createStore();
  for (const schema of Object.keys(model.schemas)) {
    store.seed(schema, fixtures(model, schema, SEED_ROWS, { seed: 1 }));
  }
  const worker = setupWorker(...handlersFromModel(model, { store, baseUrl }));
  await worker.start({ quiet: true });
  return { worker, store };
}
