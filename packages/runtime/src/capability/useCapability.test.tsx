import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeAuth, makeServices, model, wrapperFor } from '../../test/helpers.js';
import {
  filterOperations,
  hasCapabilities,
  useCapabilities,
  useCapability,
} from './useCapability.js';

const ops = Object.values(model.operations);

describe('hasCapabilities / filterOperations', () => {
  it('requires every named capability and denies the anonymous principal', () => {
    expect(hasCapabilities(['a', 'b'], ['a'])).toBe(true);
    expect(hasCapabilities(['a'], ['a', 'b'])).toBe(false);
    expect(hasCapabilities(['a'], [])).toBe(true);
    expect(hasCapabilities(undefined, [])).toBe(false);
    expect(filterOperations(ops, ['pet:read']).map((o) => o.id)).toEqual([
      'pet_list',
      'pet_get',
      'available_pets_query',
    ]);
  });
});

describe('useCapability', () => {
  it('reads the principal from the auth port', () => {
    const wrapper = wrapperFor(makeServices());
    expect(renderHook(() => useCapability('pet:read'), { wrapper }).result.current).toBe(true);
    expect(renderHook(() => useCapability('pet:delete'), { wrapper }).result.current).toBe(false);
  });
  it('is false when nobody is signed in', () => {
    const wrapper = wrapperFor(
      makeServices({ auth: makeAuth({ getPrincipal: vi.fn(() => null) }) }),
    );
    expect(renderHook(() => useCapability('pet:read'), { wrapper }).result.current).toBe(false);
  });
});

describe('useCapabilities', () => {
  it('hides the operations the principal lacks, the same filter the MCP tool list applies', () => {
    const { result } = renderHook(() => useCapabilities(ops), {
      wrapper: wrapperFor(makeServices()),
    });
    expect(result.current.map((o) => o.id)).toEqual([
      'pet_list',
      'pet_get',
      'pet_create',
      'pet_update',
      'available_pets_query',
    ]);
    expect(result.current.some((o) => o.id === 'pet_delete')).toBe(false);
  });
  it('returns nothing for an anonymous principal', () => {
    const wrapper = wrapperFor(
      makeServices({ auth: makeAuth({ getPrincipal: vi.fn(() => null) }) }),
    );
    expect(renderHook(() => useCapabilities(ops), { wrapper }).result.current).toEqual([]);
  });
});
