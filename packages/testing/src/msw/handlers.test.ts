import type { FeatureModel } from '@star-board/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { loadFixtureModel } from '../loadFixtureModel.js';
import { fixtures } from './fixtures.js';
import { etagOf, handlersFromModel, type Problem } from './handlers.js';
import { setupServerFromModel } from './server.js';
import { createStore, type Row } from './store.js';

const BASE = 'http://api.test/v1';
const model = loadFixtureModel();

interface Page {
  items: Row[];
  total: number;
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

const call = (path: string, init?: RequestInit) => fetch(`${BASE}${path}`, init);
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  call(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
const patch = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  call(path, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

describe('handlersFromModel', () => {
  it('emits one handler per operation in the document', () => {
    const handlers = handlersFromModel(model);
    expect(handlers).toHaveLength(Object.keys(model.operations).length);
    const described = handlers.map((h) => h.info.header);
    expect(described).toContain('GET */pet/:id/_history');
    expect(described).toContain('PATCH */pet/:id');
    expect(described).toContain('GET */views/available-pets');
  });

  it('accepts a bare store as the second argument', () => {
    const store = createStore({ pet: fixtures(model, 'pet', 2) });
    expect(handlersFromModel(model, store)).toHaveLength(Object.keys(model.operations).length);
    expect(store.list('pet')).toHaveLength(2);
  });
});

describe('the petstore lifecycle through fetch', () => {
  const clock = new Date('2026-10-10T12:00:00.000Z');
  const { server, store } = setupServerFromModel(model, {
    now: () => clock,
    principalId: 'staff-1',
  });
  beforeAll(() => {
    server.listen({ onUnhandledFrame: 'error' });
  });
  afterEach(() => {
    store.reset();
  });
  afterAll(() => {
    server.close();
  });

  it('create → get → list → update (If-Match) → stale 412 → history → delete → 404', async () => {
    const created = await post('/pet', { name: 'Rex', species: 'dog' });
    expect(created.status).toBe(201);
    const pet = await json<Row>(created);
    expect(pet).toMatchObject({
      name: 'Rex',
      species: 'dog',
      status: 'available',
      record_version: 1,
      created_at: clock.toISOString(),
      created_by: 'staff-1',
    });
    const id = pet.entity_id;
    if (typeof id !== 'string') throw new Error('no entity_id');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.headers.get('etag')).toBe(etagOf(id, 1));

    const got = await call(`/pet/${id}`);
    expect(got.status).toBe(200);
    expect(await json<Row>(got)).toEqual(pet);
    expect(got.headers.get('etag')).toBe(`W/"${id}:1"`);

    const listed = await json<Page>(await call('/pet?skip=0&limit=10'));
    expect(listed).toEqual({ items: [pet], total: 1 });

    const stale = await patch(`/pet/${id}`, { status: 'sold' }, { 'If-Match': 'W/"nope:9"' });
    expect(stale.status).toBe(412);
    expect(await json<Problem>(stale)).toMatchObject({ status: 412, title: 'Precondition Failed' });
    const missingIfMatch = await patch(`/pet/${id}`, { status: 'sold' });
    expect(missingIfMatch.status).toBe(412);

    const updated = await patch(`/pet/${id}`, { status: 'sold' }, { 'If-Match': etagOf(id, 1) });
    expect(updated.status).toBe(200);
    const sold = await json<Row>(updated);
    expect(sold).toMatchObject({ entity_id: id, name: 'Rex', status: 'sold', record_version: 2 });
    expect(updated.headers.get('etag')).toBe(etagOf(id, 2));

    const replay = await patch(`/pet/${id}`, { status: 'pending' }, { 'If-Match': etagOf(id, 1) });
    expect(replay.status).toBe(412);

    const history = await json<Page>(await call(`/pet/${id}/_history`));
    expect(history.total).toBe(2);
    expect(history.items.map((v) => v.record_version)).toEqual([1, 2]);

    const deleted = await call(`/pet/${id}`, { method: 'DELETE' });
    expect(deleted.status).toBe(204);
    expect(await deleted.text()).toBe('');

    const gone = await call(`/pet/${id}`);
    expect(gone.status).toBe(404);
    expect(gone.headers.get('content-type')).toBe('application/problem+json');
    expect(await json<Problem>(gone)).toMatchObject({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
    });
    expect((await json<Page>(await call('/pet'))).total).toBe(0);
    // The tombstone keeps the history.
    expect((await json<Page>(await call(`/pet/${id}/_history`))).total).toBe(2);
    expect((await call(`/pet/${id}`, { method: 'DELETE' })).status).toBe(404);
  });

  it('rejects an invalid create with 422 and field errors', async () => {
    const response = await post('/pet', { species: 'dragon', name: 'x'.repeat(81), extra: true });
    expect(response.status).toBe(422);
    const body = await json<Problem>(response);
    expect(body).toMatchObject({ status: 422, title: 'Unprocessable Content' });
    expect(body.errors).toMatchObject({
      species: expect.stringContaining('one of') as string,
      name: 'longer than 80 characters',
      extra: 'unknown field',
    });
    const missing = await json<Problem>(await post('/pet', {}));
    expect(missing.errors).toEqual({ name: 'required', species: 'required' });
    expect((await post('/pet', [1, 2])).status).toBe(422);
    expect(
      (
        await call('/pet', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{nope',
        })
      ).status,
    ).toBe(422);
    expect(store.list('pet')).toEqual([]);
  });

  it('validates the Update schema and keeps unknown fields out', async () => {
    const [seeded] = store.seed('pet', [{ name: 'Tom', species: 'cat', status: 'available' }]);
    const id = seeded?.entity_id;
    if (typeof id !== 'string') throw new Error('seed gave no id');
    const bad = await patch(`/pet/${id}`, { species: 'bird' }, { 'If-Match': etagOf(id, 1) });
    expect(bad.status).toBe(422);
    expect((await json<Problem>(bad)).errors).toEqual({ species: 'unknown field' });
    const nulled = await patch(`/pet/${id}`, { notes: null }, { 'If-Match': etagOf(id, 1) });
    expect(nulled.status).toBe(200);
    expect(await json<Row>(nulled)).toMatchObject({ notes: null, record_version: 2 });
  });

  it('pages a list with skip/limit or page/pageSize, filters with where and sorts', async () => {
    store.seed(
      'pet',
      ['d', 'b', 'a', 'c', 'e'].map((name, i) => ({
        name,
        species: i % 2 === 0 ? 'dog' : 'cat',
        status: 'available',
      })),
    );
    const first = await json<Page>(await call('/pet?limit=2&sort=name'));
    expect(first.total).toBe(5);
    expect(first.items.map((r) => r.name)).toEqual(['a', 'b']);
    const second = await json<Page>(await call('/pet?page=2&pageSize=2&sort=name'));
    expect(second.items.map((r) => r.name)).toEqual(['c', 'd']);
    const desc = await json<Page>(await call('/pet?skip=0&limit=5&sort=-name'));
    expect(desc.items.map((r) => r.name)).toEqual(['e', 'd', 'c', 'b', 'a']);
    const where = await json<Page>(
      await call(`/pet?where=${encodeURIComponent(JSON.stringify({ species: 'cat' }))}`),
    );
    expect(where.total).toBe(2);
    expect(where.items.every((r) => r.species === 'cat')).toBe(true);
    const everything = await json<Page>(await call('/pet'));
    expect(everything.items).toHaveLength(5);
  });

  it('projects and filters a view by its x-view', async () => {
    store.seed('pet', [
      { name: 'Zed', species: 'dog', status: 'available', notes: 'hidden from the view' },
      { name: 'Amy', species: 'cat', status: 'sold' },
      { name: 'Bob', species: 'dog', status: 'pending' },
    ]);
    const all = await json<Page>(await call('/views/available-pets'));
    expect(all.total).toBe(3);
    // Default sort from the view (name asc); projection plus the id, nothing else.
    expect(all.items.map((r) => r.name)).toEqual(['Amy', 'Bob', 'Zed']);
    for (const item of all.items)
      expect(Object.keys(item).sort()).toEqual(['entity_id', 'name', 'species', 'status']);
    const dogs = await json<Page>(await call('/views/available-pets?species=dog'));
    expect(dogs.items.map((r) => r.name)).toEqual(['Bob', 'Zed']);
    const dogsOp = await json<Page>(await call('/views/available-pets?species_eq=dog&limit=1'));
    expect(dogsOp).toMatchObject({ total: 2 });
    expect(dogsOp.items).toHaveLength(1);
    // A filter the view does not declare is ignored.
    const ignored = await json<Page>(await call('/views/available-pets?status=sold'));
    expect(ignored.total).toBe(3);
    // The view's max limit caps the page size.
    const capped = await json<Page>(await call('/views/available-pets?limit=5000'));
    expect(capped.items).toHaveLength(3);
  });
});

describe('capability enforcement by posture', () => {
  async function denied(posture: FeatureModel['posture'], caps: string[]): Promise<Response[]> {
    const posed: FeatureModel = { ...structuredClone(model), posture };
    const { server, store } = setupServerFromModel(posed, { principalCapabilities: caps });
    store.seed('pet', [{ entity_id: 'p1', name: 'Rex', species: 'dog', status: 'available' }]);
    server.listen({ onUnhandledFrame: 'error' });
    try {
      return await Promise.all([
        call('/pet/p1'),
        call('/pet'),
        post('/pet', { name: 'A', species: 'cat' }),
      ]);
    } finally {
      server.close();
    }
  }

  it('answers 403 under the 403 posture and 404 under the 404 posture', async () => {
    const [get403, list403, create403] = await denied('403', ['pet:read']);
    expect(get403?.status).toBe(200);
    expect(list403?.status).toBe(200);
    expect(create403?.status).toBe(403);
    if (create403 !== undefined)
      expect(await json<Problem>(create403)).toMatchObject({ status: 403, title: 'Forbidden' });

    const [get404, , create404] = await denied('404', []);
    expect(get404?.status).toBe(404);
    expect(create404?.status).toBe(404);
    if (get404 !== undefined)
      expect(await json<Problem>(get404)).toMatchObject({ status: 404, detail: 'no such record' });
  });

  it('enforces nothing when no principal is given', async () => {
    const { server } = setupServerFromModel(model);
    server.listen({ onUnhandledFrame: 'error' });
    try {
      expect((await post('/pet', { name: 'A', species: 'cat' })).status).toBe(201);
    } finally {
      server.close();
    }
  });
});

describe('custom operations', () => {
  it('answer 200 {} for a Tier 3 operation added to the document', async () => {
    const custom: FeatureModel = structuredClone(model);
    custom.operations.pet_adopt = {
      id: 'pet_adopt',
      schema: 'pet',
      operation: 'adopt',
      kind: 'custom',
      method: 'post',
      path: '/pet/{id}/adopt',
      capabilities: ['pet:write'],
    };
    const { server } = setupServerFromModel(custom);
    server.listen({ onUnhandledFrame: 'error' });
    try {
      const response = await post('/pet/p1/adopt', {});
      expect(response.status).toBe(200);
      expect(await json<Record<string, never>>(response)).toEqual({});
    } finally {
      server.close();
    }
  });
});
