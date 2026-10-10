import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeServices, wrapperFor } from '../../test/helpers.js';
import type { OperationsPort } from '../data/operations.js';
import type { AgentPort } from '../ports.js';
import { useOperations, useServices } from './ServicesProvider.js';

describe('ServicesProvider', () => {
  it('exposes client, auth, notify and the optional agent port', () => {
    const agent: AgentPort = {
      listTools: vi.fn(() => Promise.resolve([{ name: 'pet_list' }])),
      call: vi.fn(),
    };
    const services = makeServices({ agent });
    const { result } = renderHook(() => useServices(), { wrapper: wrapperFor(services) });
    expect(result.current).toBe(services);
    expect(result.current.agent).toBe(agent);
    expect(typeof result.current.client.GET).toBe('function');
  });

  it('throws outside a provider', () => {
    expect(() => renderHook(() => useServices())).toThrow(/no ServicesProvider/);
  });
});

describe('useOperations', () => {
  it('returns the given port, else builds one from client and model, memoised', () => {
    const operations: OperationsPort = {
      get: vi.fn(),
      list: vi.fn(),
      view: vi.fn(),
      mutate: vi.fn(),
    };
    const given = renderHook(() => useOperations(), {
      wrapper: wrapperFor(makeServices({ operations })),
    });
    expect(given.result.current).toBe(operations);

    const built = renderHook(() => useOperations(), { wrapper: wrapperFor(makeServices()) });
    const first = built.result.current;
    expect(typeof first.get).toBe('function');
    built.rerender();
    expect(built.result.current).toBe(first);
  });

  it('fails closed without a model or a port', () => {
    const silence = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(() =>
        renderHook(() => useOperations(), {
          wrapper: wrapperFor(makeServices({ model: undefined })),
        }),
      ).toThrow(/either `operations` or `model`/);
    } finally {
      silence.mockRestore();
    }
  });
});
