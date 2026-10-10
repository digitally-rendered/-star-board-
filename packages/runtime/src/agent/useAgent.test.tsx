import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeServices, wrapperFor } from '../../test/helpers.js';
import { McpAgentPort } from './McpAgentPort.js';
import { agentParityIssues, operationsWithTools } from './parity.js';
import type { McpTransport } from './types.js';
import { useAgent, useAgentTools } from './useAgent.js';

function transportFor(tools: string[]): McpTransport {
  return {
    request: vi.fn((method: 'tools/list' | 'tools/call', params?: unknown) => {
      if (method === 'tools/list')
        return Promise.resolve({ tools: tools.map((name) => ({ name })) });
      const { name } = params as { name: string };
      return Promise.resolve({
        content: [{ type: 'text', text: JSON.stringify({ rationale: name }) }],
      });
    }),
  };
}

describe('useAgent', () => {
  it('is unavailable without an agent port and its calls reject', async () => {
    const { result } = renderHook(() => useAgent(), { wrapper: wrapperFor(makeServices()) });
    expect(result.current.available).toBe(false);
    expect(result.current.tools).toEqual([]);
    expect(result.current.audit).toEqual([]);
    await expect(result.current.why('pet_update', {})).rejects.toThrow(/no agent port/);
  });

  it('loads the tool list, calls through and keeps the audit live with the principal', async () => {
    const agent = new McpAgentPort(transportFor(['pet_update', 'why_pet_update']));
    const { result } = renderHook(() => useAgent(), {
      wrapper: wrapperFor(makeServices({ agent })),
    });
    expect(result.current.available).toBe(true);
    await waitFor(() => {
      expect(result.current.tools).toEqual(['pet_update', 'why_pet_update']);
    });
    await act(async () => {
      await expect(result.current.why('pet_update', { id: '1' })).resolves.toEqual({
        rationale: 'why_pet_update',
      });
    });
    expect(result.current.audit).toHaveLength(1);
    expect(result.current.audit[0]?.tool).toBe('why_pet_update');
    // an app-built McpAgentPort names its own principal (none here); the hook does not override it
    expect(result.current.audit[0]?.principal).toBeNull();
  });

  it('wraps a plain { listTools, call } port', async () => {
    const agent = {
      listTools: () => Promise.resolve([{ name: 'pet_create' }]),
      call: vi.fn(() => Promise.resolve('fine')),
    };
    const { result } = renderHook(() => useAgent(), {
      wrapper: wrapperFor(makeServices({ agent })),
    });
    await waitFor(() => {
      expect(result.current.tools).toEqual(['pet_create']);
    });
    await act(async () => {
      await expect(result.current.apply('pet_create', { name: 'x' })).resolves.toBe('fine');
    });
    expect(agent.call).toHaveBeenCalledWith('pet_create', { name: 'x' });
    expect(result.current.audit.map((r) => r.kind)).toEqual(['apply']);
    // the wrapper records the delegating user from the auth port
    expect(result.current.audit[0]?.principal).toBe('u1');
  });

  it('falls back to no tools when tools/list fails', async () => {
    const agent = new McpAgentPort({ request: () => Promise.reject(new Error('down')) });
    const { result } = renderHook(() => useAgent(), {
      wrapper: wrapperFor(makeServices({ agent })),
    });
    await waitFor(() => {
      expect(result.current.available).toBe(true);
    });
    expect(result.current.tools).toEqual([]);
  });
});

describe('useAgentTools', () => {
  it('keeps only the operation ids that have a tool of the same name', async () => {
    const agent = new McpAgentPort(transportFor(['pet_update', 'why_pet_update', 'pet_create']));
    const ids = ['pet_create', 'pet_update', 'pet_delete'];
    const { result } = renderHook(() => useAgentTools(ids), {
      wrapper: wrapperFor(makeServices({ agent })),
    });
    await waitFor(() => {
      expect(result.current).toEqual(['pet_create', 'pet_update']);
    });
  });
  it('is empty without an agent', () => {
    const { result } = renderHook(() => useAgentTools(['pet_create']), {
      wrapper: wrapperFor(makeServices()),
    });
    expect(result.current).toEqual([]);
  });
});

describe('agentParityIssues', () => {
  it('reports a visible action without a tool and a tool without a visible action', () => {
    const visible = ['pet_create', 'pet_update'];
    const tools = ['pet_update', 'pet_delete', 'why_pet_update', 'simulate_pet_update'];
    expect(agentParityIssues(visible, tools)).toEqual([
      { kind: 'action-without-tool', operationId: 'pet_create' },
      { kind: 'tool-without-action', operationId: 'pet_delete' },
    ]);
    expect(agentParityIssues(['pet_update'], ['pet_update', 'why_pet_update'])).toEqual([]);
    expect(operationsWithTools(visible, tools)).toEqual(['pet_update']);
  });
});
