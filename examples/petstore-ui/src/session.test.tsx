// @vitest-environment jsdom
import { setupServerFromModel } from '@star-board/testing';
import { HARNESS_BASE_URL, renderRoutes } from '@star-board/testing/harness';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { appRoutes } from './app.js';
import { MODEL } from './model.js';
import { harnessOptions } from './testing.js';

/*
 * Session and auth (typescript/05 §5): a 401 is handled by the client interceptor, which calls
 * `auth.onUnauthorized()` exactly once per unauthorized response — the redirect-once path — and
 * the screen shows its error state rather than the backend's text.
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

describe('401 redirect-once', () => {
  it('navigating to a list that answers 401 calls onUnauthorized once and shows the error state', async () => {
    let responses = 0;
    server.use(
      http.get(`${HARNESS_BASE_URL}/pet`, () => {
        responses++;
        return HttpResponse.json(
          { type: 'about:blank', title: 'Session expired', status: 401, code: 'UNAUTHORIZED' },
          { status: 401 },
        );
      }),
    );
    const onUnauthorized = vi.fn();
    renderRoutes({
      ...harnessOptions(),
      onUnauthorized,
      routes: appRoutes(),
      initialEntries: ['/pet'],
    });
    await screen.findByTestId('state-error');
    expect(responses).toBe(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('pet-list-table')).toBeNull();
  });
});
