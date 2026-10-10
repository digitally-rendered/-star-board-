import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { BASE_URL, makeAuth } from '../../test/helpers.js';
import { createClient, IF_MATCH } from './createClient.js';
import { HttpError } from './errors.js';

const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

describe('createClient', () => {
  it('injects the bearer token and asks for JSON', async () => {
    let seen: Headers | undefined;
    server.use(
      http.get(`${BASE_URL}/pet/1`, ({ request }) => {
        seen = request.headers;
        return HttpResponse.json({ id: '1' });
      }),
    );
    const client = createClient(BASE_URL, makeAuth({ token: 'tok-9' }));
    const { data } = await client.GET('/pet/{id}', { params: { path: { id: '1' } } });
    expect(data).toEqual({ id: '1' });
    expect(seen?.get('authorization')).toBe('Bearer tok-9');
    expect(seen?.get('accept')).toBe('application/json');
  });

  it('sends no Authorization header when anonymous', async () => {
    let seen: Headers | undefined;
    server.use(
      http.get(`${BASE_URL}/pet`, ({ request }) => {
        seen = request.headers;
        return HttpResponse.json([]);
      }),
    );
    const client = createClient(BASE_URL, makeAuth({ token: null }));
    await client.GET('/pet');
    expect(seen?.has('authorization')).toBe(false);
  });

  it('passes If-Match through and applies default headers', async () => {
    let seen: Headers | undefined;
    server.use(
      http.patch(`${BASE_URL}/pet/1`, ({ request }) => {
        seen = request.headers;
        return HttpResponse.json({ id: '1', record_version: 3 });
      }),
    );
    const client = createClient(BASE_URL, makeAuth(), { headers: { 'X-Client': 'star-board' } });
    await client.PATCH('/pet/{id}', {
      params: { path: { id: '1' } },
      headers: { [IF_MATCH]: 'W/"1:2"' },
      body: { name: 'Rex' },
    });
    expect(seen?.get('if-match')).toBe('W/"1:2"');
    expect(seen?.get('x-client')).toBe('star-board');
    expect(seen?.get('content-type')).toContain('application/json');
  });

  it('calls onUnauthorized exactly once on a 401 and rethrows a typed HttpError', async () => {
    server.use(
      http.get(`${BASE_URL}/pet/1`, () =>
        HttpResponse.json({ detail: 'token expired' }, { status: 401 }),
      ),
    );
    const auth = makeAuth();
    const client = createClient(BASE_URL, auth);
    const failure = await client
      .GET('/pet/{id}', { params: { path: { id: '1' } } })
      .catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(HttpError);
    const err = failure as HttpError;
    expect(err.status).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.unauthorizedHandled).toBe(true);
    expect(auth.onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not call onUnauthorized for other failures and parses both body shapes', async () => {
    server.use(
      http.patch(`${BASE_URL}/pet/1`, () =>
        HttpResponse.json(
          { type: 'about:blank', title: 'Precondition Failed', status: 412, detail: 'stale' },
          { status: 412, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
      http.post(`${BASE_URL}/pet`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'INVALID', message: 'bad', details: { name: 'required' } },
          },
          { status: 422 },
        ),
      ),
    );
    const auth = makeAuth();
    const client = createClient(BASE_URL, auth);
    const stale = (await client
      .PATCH('/pet/{id}', { params: { path: { id: '1' } }, body: {} })
      .catch((e: unknown) => e)) as HttpError;
    expect(stale.status).toBe(412);
    expect(stale.code).toBe('PRECONDITION_FAILED');
    expect(stale.title).toBe('Precondition Failed');
    const invalid = (await client.POST('/pet', { body: {} }).catch((e: unknown) => e)) as HttpError;
    expect(invalid.status).toBe(422);
    expect(invalid.code).toBe('INVALID');
    expect(invalid.fields).toEqual({ name: 'required' });
    expect(auth.onUnauthorized).not.toHaveBeenCalled();
  });

  it('treats 204 as success and lets a custom fetch stand in for the network', async () => {
    const fetchStub = vi.fn((input: Request) =>
      Promise.resolve(new Response(null, { status: 204, headers: { 'X-Url': input.url } })),
    );
    const client = createClient(BASE_URL, makeAuth(), { fetch: fetchStub });
    const { data, response } = await client.DELETE('/pet/{id}', { params: { path: { id: '7' } } });
    expect(data).toBeUndefined();
    expect(response.status).toBe(204);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(response.headers.get('x-url')).toBe(`${BASE_URL}/pet/7`);
  });
});
