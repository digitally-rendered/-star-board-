import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { AgentAuditLog } from './AgentAuditLog.js';
import { argsHash, canonicalJson, fnv1a64 } from './hash.js';
import {
  AgentToolError,
  McpAgentPort,
  parseToolResult,
  toSimulateResult,
  toWhyResult,
  withAgentAffordance,
} from './McpAgentPort.js';
import type { McpTransport } from './types.js';

interface Call {
  method: string;
  params: unknown;
}

/** A stub MCP server: a tool list and one canned result per tool name. */
function stubTransport(tools: string[], results: Record<string, unknown>) {
  const calls: Call[] = [];
  const transport: McpTransport = {
    request: vi.fn((method: 'tools/list' | 'tools/call', params?: unknown) => {
      calls.push({ method, params });
      if (method === 'tools/list')
        return Promise.resolve({ tools: tools.map((name) => ({ name })) });
      const { name } = params as { name: string };
      const result = results[name];
      if (result === undefined) return Promise.reject(new Error(`no such tool ${name}`));
      return Promise.resolve(result);
    }),
  };
  return { transport, calls };
}

const text = (value: unknown) => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }],
});

describe('argsHash', () => {
  it('is FNV-1a 64 of the canonical JSON, independent of key order', () => {
    expect(fnv1a64('')).toBe('cbf29ce484222325');
    expect(fnv1a64('a')).toBe('af63dc4c8601ec8c');
    expect(canonicalJson({ b: 1, a: [true, null, { d: 'x', c: undefined }] })).toBe(
      '{"a":[true,null,{"d":"x"}],"b":1}',
    );
    expect(argsHash({ b: 1, a: 2 })).toBe(argsHash({ a: 2, b: 1 }));
    expect(argsHash({ a: 1 })).not.toBe(argsHash({ a: 2 }));
    expect(argsHash(undefined)).toBe(fnv1a64('null'));
    expect(argsHash({ a: 1 })).toMatch(/^[0-9a-f]{16}$/);
    // the canonical form is what a server-side sha-256 audit would hash too
    const sha = createHash('sha256')
      .update(canonicalJson({ b: 1, a: 2 }))
      .digest('hex');
    expect(sha).toBe(
      createHash('sha256')
        .update(canonicalJson({ a: 2, b: 1 }))
        .digest('hex'),
    );
  });
});

describe('parseToolResult / toWhyResult / toSimulateResult', () => {
  it('prefers structuredContent, then JSON text, then plain text, then the raw result', () => {
    expect(parseToolResult('t', { structuredContent: { x: 1 }, ...text('ignored') })).toEqual({
      x: 1,
    });
    expect(parseToolResult('t', text({ x: 1 }))).toEqual({ x: 1 });
    expect(parseToolResult('t', text('not json'))).toBe('not json');
    expect(parseToolResult('t', { content: [{ type: 'image', data: '' }] })).toEqual({
      content: [{ type: 'image', data: '' }],
    });
    expect(parseToolResult('t', 42)).toBe(42);
  });
  it('throws AgentToolError on isError', () => {
    expect(() => parseToolResult('pet_update', { isError: true, ...text('nope') })).toThrow(
      AgentToolError,
    );
  });
  it('shapes why and simulate payloads and wraps unshaped ones', () => {
    expect(
      toWhyResult({ rationale: 'r', citations: [{ label: 'l', ref: 'r1' }, { bad: 1 }] }),
    ).toEqual({ rationale: 'r', citations: [{ label: 'l', ref: 'r1' }] });
    expect(toWhyResult('plain')).toEqual({ rationale: 'plain' });
    expect(toWhyResult({ other: 1 })).toEqual({ rationale: '{"other":1}' });
    expect(toSimulateResult({ diff: { a: 1 }, warnings: ['w', 2], wouldSucceed: false })).toEqual({
      diff: { a: 1 },
      warnings: ['w'],
      wouldSucceed: false,
    });
    expect(toSimulateResult({ diff: { a: 1 } })).toEqual({
      diff: { a: 1 },
      warnings: [],
      wouldSucceed: true,
    });
    expect(toSimulateResult('free text')).toEqual({
      diff: 'free text',
      warnings: [],
      wouldSucceed: true,
    });
  });
});

describe('McpAgentPort', () => {
  const at = new Date('2024-05-06T07:08:09.000Z');
  function make(results: Record<string, unknown> = {}) {
    const stub = stubTransport(['pet_update', 'why_pet_update', 'simulate_pet_update'], results);
    const port = new McpAgentPort(stub.transport, { principal: () => 'u1', now: () => at });
    return { ...stub, port };
  }

  it('lists the tools and tolerates a malformed list', async () => {
    const { port } = make();
    expect(await port.listTools()).toEqual([
      { name: 'pet_update' },
      { name: 'why_pet_update' },
      { name: 'simulate_pet_update' },
    ]);
    const broken = new McpAgentPort({ request: () => Promise.resolve('junk') });
    expect(await broken.listTools()).toEqual([]);
  });

  it('why calls why_<operationId> and parses JSON text', async () => {
    const { port, calls } = make({
      why_pet_update: text({ rationale: 'Because', citations: [{ label: 'Rule', ref: 'r/1' }] }),
    });
    const why = await port.why('pet_update', { id: '1' });
    expect(why).toEqual({ rationale: 'Because', citations: [{ label: 'Rule', ref: 'r/1' }] });
    expect(calls[0]).toEqual({
      method: 'tools/call',
      params: { name: 'why_pet_update', arguments: { id: '1' } },
    });
  });

  it('why wraps plain text as the rationale', async () => {
    const { port } = make({ why_pet_update: text('Just text') });
    expect(await port.why('pet_update', {})).toEqual({ rationale: 'Just text' });
  });

  it('simulate calls simulate_<operationId> and reads structuredContent', async () => {
    const { port, calls } = make({
      simulate_pet_update: {
        structuredContent: {
          diff: { name: ['a', 'b'] },
          warnings: ['renames'],
          wouldSucceed: true,
        },
      },
    });
    expect(await port.simulate('pet_update', { id: '1', name: 'b' })).toEqual({
      diff: { name: ['a', 'b'] },
      warnings: ['renames'],
      wouldSucceed: true,
    });
    expect((calls[0]?.params as { name: string }).name).toBe('simulate_pet_update');
  });

  it('apply fails closed on a versioned mutation without ifMatch and never calls the tool', async () => {
    const transport = { request: vi.fn() };
    const port = new McpAgentPort(transport, { versionedOperations: ['pet_archive'] });
    await expect(port.apply('pet_update', { name: 'x' })).rejects.toThrow(/requires ifMatch/);
    await expect(port.apply('pet_delete', {})).rejects.toThrow(/requires ifMatch/);
    await expect(port.apply('pet_archive', {})).rejects.toThrow(/requires ifMatch/);
    expect(transport.request).not.toHaveBeenCalled();
    expect(port.audit()).toHaveLength(0);
  });

  it('apply calls the operation tool itself and sends ifMatch in _meta', async () => {
    const { port, calls } = make({ pet_update: text({ id: '1', version: 2 }) });
    expect(await port.apply('pet_update', { id: '1' }, 'W/"1"')).toEqual({ id: '1', version: 2 });
    expect(calls[0]).toEqual({
      method: 'tools/call',
      params: { name: 'pet_update', arguments: { id: '1' }, _meta: { ifMatch: 'W/"1"' } },
    });
    await port.apply('pet_update', { id: '1' }, 'W/"1"');
    expect(calls[1]?.params).toEqual({ name: 'pet_update', arguments: { id: '1' } });
  });

  it('records one audit row per call with the args hash, principal, kind and outcome', async () => {
    const { port } = make({
      why_pet_update: text('ok'),
      simulate_pet_update: text({ diff: {}, wouldSucceed: true }),
      pet_update: { isError: true, ...text('version conflict') },
    });
    await port.why('pet_update', { id: '1' });
    await port.simulate('pet_update', { id: '1' });
    await expect(port.apply('pet_update', { id: '1' }, 'W/"1"')).rejects.toThrow(
      'version conflict',
    );
    await expect(port.call('missing', {})).rejects.toThrow(/no such tool/);
    const hash = argsHash({ id: '1' });
    expect(port.audit()).toEqual([
      {
        at: at.toISOString(),
        tool: 'why_pet_update',
        argsHash: hash,
        actor: 'agent',
        principal: 'u1',
        kind: 'why',
        outcome: 'ok',
      },
      {
        at: at.toISOString(),
        tool: 'simulate_pet_update',
        argsHash: hash,
        actor: 'agent',
        principal: 'u1',
        kind: 'simulate',
        outcome: 'ok',
      },
      {
        at: at.toISOString(),
        tool: 'pet_update',
        argsHash: hash,
        actor: 'agent',
        principal: 'u1',
        kind: 'apply',
        outcome: 'error',
      },
      {
        at: at.toISOString(),
        tool: 'missing',
        argsHash: argsHash({}),
        actor: 'agent',
        principal: 'u1',
        kind: 'call',
        outcome: 'error',
      },
    ]);
  });

  it('notifies subscribers and bounds the log', async () => {
    const log = new AgentAuditLog(2);
    const { transport } = stubTransport(['a'], { a: text('x') });
    const port = new McpAgentPort(transport, { log });
    const listener = vi.fn();
    const unsubscribe = port.subscribe(listener);
    await port.call('a', 1);
    await port.call('a', 2);
    await port.call('a', 3);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(port.audit().map((r) => r.argsHash)).toEqual([argsHash(2), argsHash(3)]);
    expect(port.audit()[0]?.principal).toBeNull();
    unsubscribe();
    await port.call('a', 4);
    expect(listener).toHaveBeenCalledTimes(3);
  });
});

describe('withAgentAffordance', () => {
  it('returns an McpAgentPort unchanged and wraps a plain port once', async () => {
    const mcp = new McpAgentPort({ request: () => Promise.resolve({ tools: [] }) });
    expect(withAgentAffordance(mcp)).toBe(mcp);
    const plain = {
      listTools: vi.fn(() => Promise.resolve([{ name: 'pet_update' }])),
      call: vi.fn((name: string) => Promise.resolve(text({ rationale: `why ${name}` }))),
    };
    const wrapped = withAgentAffordance(plain);
    expect(withAgentAffordance(plain)).toBe(wrapped);
    expect(await wrapped.listTools()).toEqual([{ name: 'pet_update' }]);
    expect(await wrapped.why('pet_update', { a: 1 })).toEqual({ rationale: 'why why_pet_update' });
    expect(plain.call).toHaveBeenCalledWith('why_pet_update', { a: 1 });
    expect(wrapped.audit()).toHaveLength(1);
  });
});
