// @vitest-environment jsdom
import { handlersFromModel, setupServerFromModel, fixtures } from '@star-board/testing';
import {
  capabilityCases,
  HARNESS_BASE_URL,
  renderRoutes,
  type CapabilityCase,
} from '@star-board/testing/harness';
import { screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { appRoutes } from './app.js';
import { MODEL } from './model.js';
import { harnessOptions, registerDefaultsOnly } from './testing.js';

/*
 * The hide/deny matrix (hexagonal-rules shared/13 §3): the same missing capability hides the
 * action or screen in the UI and makes the handler deny the request by the document's posture
 * (404 here, so a denial is indistinguishable from a missing record). One case per operation.
 */

const { server, store } = setupServerFromModel(MODEL);
beforeAll(() => {
  server.listen();
});
afterEach(() => {
  server.resetHandlers();
  store.reset();
});
afterAll(() => {
  server.close();
});

/** Where each operation surfaces in the generated UI. */
interface Surface {
  route: (id: string) => string;
  /** The action button a capable principal sees; absent for read operations. */
  action?: string;
  /** The screen a capable principal sees; a denied one sees the empty state instead. */
  screen?: string;
}
const SURFACES: Readonly<Record<string, Surface>> = {
  pet_list: { route: () => '/pet', screen: 'pet-list-screen' },
  pet_create: { route: () => '/pet', action: 'action-pet_create' },
  pet_get: { route: (id) => `/pet/${id}`, screen: 'pet-detail-screen' },
  pet_update: { route: (id) => `/pet/${id}`, action: 'action-pet_update' },
  pet_delete: { route: (id) => `/pet/${id}`, action: 'action-pet_delete' },
  available_pets_query: { route: () => '/views/available_pets', screen: 'pet-grid-screen' },
};

function serve(principalCapabilities: readonly string[]): void {
  server.use(...handlersFromModel(MODEL, { store, principalCapabilities }));
}

function seed(): string {
  const [row] = store.seed('pet', fixtures(MODEL, 'pet', 2, { seed: 3 }));
  const id = row?.entity_id;
  if (typeof id !== 'string') throw new Error('seed produced no id');
  return id;
}

async function request(c: CapabilityCase, id: string): Promise<number> {
  const op = MODEL.operations[c.operationId];
  if (op === undefined) throw new Error(c.operationId);
  const path = op.path.replace('{id}', id);
  const init: RequestInit = { method: op.method.toUpperCase() };
  if (op.kind === 'create') {
    init.body = JSON.stringify({ name: 'Rex', species: 'dog' });
    init.headers = { 'content-type': 'application/json' };
  }
  if (op.kind === 'update') {
    init.body = JSON.stringify({ status: 'sold' });
    init.headers = { 'content-type': 'application/json', 'if-match': `W/"${id}:1"` };
  }
  const response = await fetch(`${HARNESS_BASE_URL}${path}`, init);
  return response.status;
}

describe.each(capabilityCases(MODEL))('$operationId', (c) => {
  it('is denied by posture without the capability and answered with it', async () => {
    const id = seed();
    serve(c.without.capabilities);
    expect(await request(c, id)).toBe(404);
    server.resetHandlers();
    serve(c.with.capabilities);
    const status = await request(c, id);
    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(300);
  });

  it('is hidden in the UI without the capability and shown with it', async () => {
    const surface = SURFACES[c.operationId];
    if (surface === undefined) return; // history has no generated screen yet (generator README)
    const id = seed();
    serve(c.without.capabilities);
    const denied = renderRoutes({
      ...harnessOptions(registerDefaultsOnly),
      principal: c.without,
      routes: appRoutes(),
      initialEntries: [surface.route(id)],
    });
    if (surface.screen !== undefined) {
      await screen.findByTestId('state-empty');
      expect(screen.queryByTestId(surface.screen)).toBeNull();
    } else if (surface.action !== undefined) {
      await waitFor(() => {
        expect(screen.queryByTestId('state-loading')).toBeNull();
      });
      expect(screen.queryByTestId(surface.action)).toBeNull();
    }
    denied.unmount();
    server.resetHandlers();
    serve(c.with.capabilities);
    renderRoutes({
      ...harnessOptions(registerDefaultsOnly),
      principal: c.with,
      routes: appRoutes(),
      initialEntries: [surface.route(id)],
    });
    await screen.findByTestId(surface.screen ?? surface.action ?? '');
  });
});
