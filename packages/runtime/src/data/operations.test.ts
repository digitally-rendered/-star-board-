import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BASE_URL, makeAuth, model } from '../../test/helpers.js';
import { createClient } from '../client/createClient.js';
import { createOperationsPort, DEFAULT_PAGE_SIZE, listParams, toPage } from './operations.js';

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

describe('listParams', () => {
  it('maps page/pageSize to skip/limit and serialises where and sort', () => {
    expect(listParams({})).toEqual({ skip: 0, limit: DEFAULT_PAGE_SIZE });
    expect(
      listParams({ page: 3, pageSize: 10, where: { status: 'open' }, sort: '-created_at' }),
    ).toEqual({
      skip: 20,
      limit: 10,
      where: '{"status":"open"}',
      sort: '-created_at',
    });
    expect(listParams({ where: {}, sort: '' })).toEqual({ skip: 0, limit: DEFAULT_PAGE_SIZE });
  });
});

describe('toPage', () => {
  it('accepts a bare array and the items envelopes', () => {
    expect(toPage([1, 2], 1, 2)).toEqual({ items: [1, 2], total: null, page: 1, pageSize: 2 });
    expect(toPage({ items: [1], total: 9 }, 2, 1)).toEqual({
      items: [1],
      total: 9,
      page: 2,
      pageSize: 1,
    });
    expect(toPage({ data: [1], count: 4 }, 1, 1).total).toBe(4);
    expect(toPage({ results: [] }, 1, 1).items).toEqual([]);
  });
  it('rejects anything else', () => {
    expect(() => toPage({ nope: true }, 1, 1)).toThrow(TypeError);
    expect(() => toPage('x', 1, 1)).toThrow(TypeError);
  });
});

describe('createOperationsPort', () => {
  const port = () => createOperationsPort(createClient(BASE_URL, makeAuth()), model);

  it('get substitutes the path parameter', async () => {
    server.use(http.get(`${BASE_URL}/pet/42`, () => HttpResponse.json({ id: '42' })));
    expect(await port().get('pet', '42')).toEqual({ id: '42' });
  });

  it('list sends skip, limit, where and sort and returns a page', async () => {
    let url: URL | undefined;
    server.use(
      http.get(`${BASE_URL}/pet`, ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json({ items: [{ id: '1' }], total: 1 });
      }),
    );
    const page = await port().list('pet', { page: 2, pageSize: 5, where: { a: 1 }, sort: 'name' });
    expect(url?.searchParams.get('skip')).toBe('5');
    expect(url?.searchParams.get('limit')).toBe('5');
    expect(url?.searchParams.get('where')).toBe('{"a":1}');
    expect(url?.searchParams.get('sort')).toBe('name');
    expect(page).toEqual({ items: [{ id: '1' }], total: 1, page: 2, pageSize: 5 });
  });

  it('view resolves the operation through the FeatureModel view entry', async () => {
    let url: URL | undefined;
    server.use(
      http.get(`${BASE_URL}/views/available-pets`, ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json([{ name: 'Rex' }]);
      }),
    );
    const page = await port().view('available-pets', { species: 'dog', limit: 10, page: 2 });
    expect(url?.searchParams.get('species')).toBe('dog');
    expect(page).toEqual({ items: [{ name: 'Rex' }], total: null, page: 2, pageSize: 10 });
    const defaults = await port().view('available-pets', {});
    expect(defaults.pageSize).toBe(20);
  });

  it('mutate sends the body and If-Match', async () => {
    let seen: { ifMatch: string | null; body: unknown } | undefined;
    server.use(
      http.patch(`${BASE_URL}/pet/1`, async ({ request }) => {
        seen = { ifMatch: request.headers.get('if-match'), body: await request.json() };
        return HttpResponse.json({ id: '1', record_version: 2 });
      }),
    );
    const out = await port().mutate('pet_update', {
      id: '1',
      body: { name: 'Rex' },
      ifMatch: 'W/"1:1"',
    });
    expect(seen).toEqual({ ifMatch: 'W/"1:1"', body: { name: 'Rex' } });
    expect(out).toEqual({ id: '1', record_version: 2 });
  });

  it('fails closed on operations the model does not have', async () => {
    const p = port();
    await expect(p.mutate('pet_fly', {})).rejects.toThrow(/no operation pet_fly/);
    await expect(p.get('cat', '1')).rejects.toThrow(/no get operation for schema cat/);
    await expect(p.view('nope', {})).rejects.toThrow(/no view nope/);
    const broken = createOperationsPort(createClient(BASE_URL, makeAuth()), {
      ...model,
      operations: Object.fromEntries(
        Object.entries(model.operations).filter(([id]) => id === 'pet_list'),
      ),
    });
    await expect(broken.view('available-pets', {})).rejects.toThrow(/unknown operation/);
  });
});
