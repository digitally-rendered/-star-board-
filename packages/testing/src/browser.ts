/**
 * `@star-board/testing/browser`: the half of the msw support a browser bundle may import (a dev
 * mode without a backend). Handlers, store and fixtures only; `setupServerFromModel` and the rest
 * of the package stay on `msw/node`.
 */
export {
  etagOf,
  handlersFromModel,
  idFieldOf,
  problem,
  PROBLEM_TYPE,
  type HandlerOptions,
  type Problem,
} from './msw/handlers.js';
export { createStore, idOf, ID_FIELDS, type Row, type Store } from './msw/store.js';
export { fixtures, fixturesFromSchema, prng, type FixtureOptions } from './msw/fixtures.js';
export { validatePayload, type FieldError } from './msw/validate.js';
