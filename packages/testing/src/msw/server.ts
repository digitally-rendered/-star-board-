import type { FeatureModel } from '@star-board/core';
import type { HttpHandler } from 'msw';
import { setupServer, type SetupServer } from 'msw/node';
import { handlersFromModel, type HandlerOptions } from './handlers.js';
import { createStore, type Store } from './store.js';

export interface ModelServer {
  server: SetupServer;
  store: Store;
  handlers: HttpHandler[];
}

/**
 * `setupServer` over the document's handlers, for vitest in node. Call `server.listen()` in
 * `beforeAll`, `store.reset()` in `afterEach`, `server.close()` in `afterAll`.
 */
export function setupServerFromModel(
  model: FeatureModel,
  options: HandlerOptions = {},
): ModelServer {
  const store = options.store ?? createStore();
  const handlers = handlersFromModel(model, { ...options, store });
  return { server: setupServer(...handlers), store, handlers };
}
