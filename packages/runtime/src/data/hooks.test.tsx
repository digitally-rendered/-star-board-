import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeQueryClient, makeServices, wrapperFor } from '../../test/helpers.js';
import { HttpError } from '../client/errors.js';
import { useEntity, useEntityList, useMutation, useView } from './hooks.js';
import type { OperationsPort } from './operations.js';
import { queryKeys } from './queryKeys.js';

function stubPort(overrides: Partial<OperationsPort> = {}): OperationsPort {
  return {
    get: vi.fn((schema: string, id: string) => Promise.resolve({ schema, id })),
    list: vi.fn((schema: string) =>
      Promise.resolve({ items: [{ schema }], total: 1, page: 1, pageSize: 50 }),
    ),
    view: vi.fn((view: string) =>
      Promise.resolve({ items: [{ view }], total: null, page: 1, pageSize: 20 }),
    ),
    mutate: vi.fn(() => Promise.resolve({ ok: true })),
    ...overrides,
  };
}

describe('useEntity', () => {
  it('fetches through the port and caches by key', async () => {
    const operations = stubPort();
    const services = makeServices({ operations });
    const queryClient = makeQueryClient();
    const wrapper = wrapperFor(services, { queryClient });
    const a = renderHook(() => useEntity<{ id: string }>('pet', '1'), { wrapper });
    expect(a.result.current.loading).toBe(true);
    await waitFor(() => {
      expect(a.result.current.loading).toBe(false);
    });
    expect(a.result.current.data).toEqual({ schema: 'pet', id: '1' });
    expect(a.result.current.error).toBeNull();
    const b = renderHook(() => useEntity('pet', '1'), { wrapper });
    await waitFor(() => {
      expect(b.result.current.data).toEqual({ schema: 'pet', id: '1' });
    });
    expect(operations.get).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(queryKeys.entity('pet', '1'))).toEqual({
      schema: 'pet',
      id: '1',
    });
  });

  it('does not fetch for a falsy id', async () => {
    const operations = stubPort();
    const { result } = renderHook(() => useEntity('pet', undefined), {
      wrapper: wrapperFor(makeServices({ operations })),
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeUndefined();
    await act(() => Promise.resolve());
    expect(operations.get).not.toHaveBeenCalled();
  });

  it('surfaces the port error unchanged', async () => {
    const boom = new HttpError({ status: 404, code: 'NOT_FOUND', title: '', detail: 'gone' });
    const operations = stubPort({ get: vi.fn(() => Promise.reject(boom)) });
    const { result } = renderHook(() => useEntity('pet', 'x'), {
      wrapper: wrapperFor(makeServices({ operations })),
    });
    await waitFor(() => {
      expect(result.current.error).toBe(boom);
    });
    expect(result.current.loading).toBe(false);
  });
});

describe('useEntityList and useView', () => {
  it('list keys on the normalised query so equal queries share one fetch', async () => {
    const operations = stubPort();
    const queryClient = makeQueryClient();
    const wrapper = wrapperFor(makeServices({ operations }), { queryClient });
    const a = renderHook(() => useEntityList('pet', { where: { status: 'open' }, page: 1 }), {
      wrapper,
    });
    const b = renderHook(
      () => useEntityList('pet', { page: 1, where: { status: 'open' }, sort: undefined }),
      { wrapper },
    );
    await waitFor(() => {
      expect(a.result.current.data?.items).toEqual([{ schema: 'pet' }]);
      expect(b.result.current.data?.items).toEqual([{ schema: 'pet' }]);
    });
    expect(operations.list).toHaveBeenCalledTimes(1);
    expect(operations.list).toHaveBeenCalledWith('pet', { where: { status: 'open' }, page: 1 });
    const c = renderHook(() => useEntityList('pet', { page: 2 }), { wrapper });
    await waitFor(() => {
      expect(c.result.current.loading).toBe(false);
    });
    expect(operations.list).toHaveBeenCalledTimes(2);
  });

  it('view fetches by view name and query', async () => {
    const operations = stubPort();
    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useView('available-pets', { species: 'dog' }), {
      wrapper: wrapperFor(makeServices({ operations }), { queryClient }),
    });
    await waitFor(() => {
      expect(result.current.data?.items).toEqual([{ view: 'available-pets' }]);
    });
    expect(operations.view).toHaveBeenCalledWith('available-pets', { species: 'dog' });
    expect(
      queryClient.getQueryData(queryKeys.view('available-pets', { species: 'dog' })),
    ).toBeDefined();
  });
});

describe('useMutation', () => {
  it('sends If-Match from etagOf for an update and invalidates the schema', async () => {
    const operations = stubPort();
    const queryClient = makeQueryClient();
    queryClient.setQueryData(queryKeys.entity('pet', '1'), { stale: true });
    queryClient.setQueryData(queryKeys.entity('cat', '1'), { untouched: true });
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () => useMutation<{ name: string }>('pet_update', { onSuccess }),
      {
        wrapper: wrapperFor(makeServices({ operations }), { queryClient }),
      },
    );
    await act(() =>
      result.current.mutateAsync({
        id: '1',
        body: { name: 'Rex' },
        doc: { entity_id: '1', record_version: 4 },
      }),
    );
    expect(operations.mutate).toHaveBeenCalledWith('pet_update', {
      id: '1',
      body: { name: 'Rex' },
      ifMatch: 'W/"1:4"',
    });
    expect(onSuccess).toHaveBeenCalledWith({ ok: true }, expect.objectContaining({ id: '1' }));
    expect(queryClient.getQueryState(queryKeys.entity('pet', '1'))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.entity('cat', '1'))?.isInvalidated).toBe(false);
    await waitFor(() => {
      expect(result.current.data).toEqual({ ok: true });
    });
  });

  it('refuses an update or delete without the current document', async () => {
    const operations = stubPort();
    const { result } = renderHook(() => useMutation('pet_delete'), {
      wrapper: wrapperFor(makeServices({ operations })),
    });
    await expect(result.current.mutateAsync({ id: '1' })).rejects.toThrow(
      /needs the current document/,
    );
    expect(operations.mutate).not.toHaveBeenCalled();
  });

  it('creates without If-Match and honours explicit invalidation keys', async () => {
    const operations = stubPort();
    const queryClient = makeQueryClient();
    queryClient.setQueryData(queryKeys.view('available-pets', {}), []);
    const { result } = renderHook(
      () => useMutation('pet_create', { invalidates: [queryKeys.view('available-pets', {})] }),
      { wrapper: wrapperFor(makeServices({ operations }), { queryClient }) },
    );
    await act(() => result.current.mutateAsync({ body: { name: 'Rex' } }));
    expect(operations.mutate).toHaveBeenCalledWith('pet_create', { body: { name: 'Rex' } });
    expect(queryClient.getQueryState(queryKeys.view('available-pets', {}))?.isInvalidated).toBe(
      true,
    );
  });

  it('surfaces a 412 as an HttpError with PRECONDITION_FAILED', async () => {
    const stale = new HttpError({
      status: 412,
      code: 'PRECONDITION_FAILED',
      title: '',
      detail: 'stale',
    });
    const operations = stubPort({ mutate: vi.fn(() => Promise.reject(stale)) });
    const onError = vi.fn();
    const { result } = renderHook(() => useMutation('pet_update', { onError }), {
      wrapper: wrapperFor(makeServices({ operations })),
    });
    act(() => {
      result.current.mutate({ id: '1', body: {}, doc: { entity_id: '1', record_version: 1 } });
    });
    await waitFor(() => {
      expect(result.current.error).toBe(stale);
    });
    expect((result.current.error as HttpError).code).toBe('PRECONDITION_FAILED');
    expect(onError).toHaveBeenCalledWith(stale, expect.objectContaining({ id: '1' }));
    act(() => {
      result.current.reset();
    });
    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
  });

  it('invalidates every runtime key when the operation is unknown to the model', async () => {
    const operations = stubPort();
    const queryClient = makeQueryClient();
    queryClient.setQueryData(queryKeys.entity('cat', '1'), {});
    const { result } = renderHook(() => useMutation('cat_custom'), {
      wrapper: wrapperFor(makeServices({ operations, model: undefined }), { queryClient }),
    });
    await act(() => result.current.mutateAsync({ body: 1 }));
    expect(queryClient.getQueryState(queryKeys.entity('cat', '1'))?.isInvalidated).toBe(true);
  });
});
