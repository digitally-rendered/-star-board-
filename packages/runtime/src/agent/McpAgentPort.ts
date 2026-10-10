import type { AgentPort } from '../ports.js';
import { AgentAuditLog } from './AgentAuditLog.js';
import { argsHash } from './hash.js';
import {
  isAgentAffordancePort,
  type AgentAffordancePort,
  type AuditKind,
  type AuditRow,
  type Citation,
  type McpTransport,
  type SimulateResult,
  type WhyResult,
} from './types.js';

export interface McpAgentPortOptions {
  /** The delegating user recorded on every audit row; defaults to unknown. */
  principal?: () => string | null;
  log?: AgentAuditLog;
  now?: () => Date;
}

/** A tool reported an error (`isError: true`) or the call itself failed. */
export class AgentToolError extends Error {
  constructor(
    readonly tool: string,
    message: string,
  ) {
    super(message);
    this.name = 'AgentToolError';
  }
}

export function whyToolName(operationId: string): string {
  return `why_${operationId}`;
}
export function simulateToolName(operationId: string): string {
  return `simulate_${operationId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The text parts of an MCP `CallToolResult`, joined. */
function contentText(result: Record<string, unknown>): string | undefined {
  const { content } = result;
  if (!Array.isArray(content)) return undefined;
  const texts = content.flatMap((part: unknown) =>
    isRecord(part) && part.type === 'text' && typeof part.text === 'string' ? [part.text] : [],
  );
  return texts.length === 0 ? undefined : texts.join('\n');
}

/**
 * The payload of a tool result: `structuredContent` when present, else the text content parsed
 * as JSON when it is JSON, else the text, else the raw result. An `isError` result throws.
 */
export function parseToolResult(tool: string, result: unknown): unknown {
  if (!isRecord(result)) return result;
  const text = contentText(result);
  if (result.isError === true) {
    throw new AgentToolError(tool, text ?? `tool ${tool} failed`);
  }
  if (result.structuredContent !== undefined) return result.structuredContent;
  if (text === undefined) return result;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function citationsOf(value: unknown): Citation[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const citations = value.flatMap((item: unknown) =>
    isRecord(item) && typeof item.label === 'string' && typeof item.ref === 'string'
      ? [{ label: item.label, ref: item.ref }]
      : [],
  );
  return citations.length === 0 ? undefined : citations;
}

/** A `WhyResult` from whatever the tool returned: a shaped object, plain text, or anything else. */
export function toWhyResult(payload: unknown): WhyResult {
  if (isRecord(payload) && typeof payload.rationale === 'string') {
    const citations = citationsOf(payload.citations);
    return citations === undefined
      ? { rationale: payload.rationale }
      : { rationale: payload.rationale, citations };
  }
  if (typeof payload === 'string') return { rationale: payload };
  return { rationale: payload === undefined ? '' : JSON.stringify(payload) };
}

/** A `SimulateResult`; an unshaped payload is the diff itself and is assumed to succeed. */
export function toSimulateResult(payload: unknown): SimulateResult {
  if (isRecord(payload) && ('diff' in payload || 'wouldSucceed' in payload)) {
    const warnings = Array.isArray(payload.warnings)
      ? payload.warnings.filter((w: unknown): w is string => typeof w === 'string')
      : [];
    return {
      diff: payload.diff ?? null,
      warnings,
      wouldSucceed: typeof payload.wouldSucceed === 'boolean' ? payload.wouldSucceed : true,
    };
  }
  return { diff: payload, warnings: [], wouldSucceed: true };
}

/**
 * `AgentPort` over an MCP client (shared/13 §3–§4): `tools/list` is the capability-filtered tool
 * list, `why_*` and `simulate_*` are the affordance helpers and the operation's own tool applies.
 * Every call appends one audit row with actor `agent`, the delegating principal, the tool, an
 * arguments hash and the outcome; `ifMatch` travels in `_meta.ifMatch` of the `tools/call`.
 */
export class McpAgentPort implements AgentAffordancePort {
  private readonly log: AgentAuditLog;
  private readonly principal: () => string | null;
  private readonly now: () => Date;

  constructor(
    private readonly transport: McpTransport,
    options: McpAgentPortOptions = {},
  ) {
    this.log = options.log ?? new AgentAuditLog();
    this.principal = options.principal ?? (() => null);
    this.now = options.now ?? (() => new Date());
  }

  async listTools(): Promise<{ name: string }[]> {
    const result = await this.transport.request('tools/list');
    if (!isRecord(result) || !Array.isArray(result.tools)) return [];
    return result.tools.flatMap((tool: unknown) =>
      isRecord(tool) && typeof tool.name === 'string' ? [{ name: tool.name }] : [],
    );
  }

  call(name: string, args: unknown): Promise<unknown> {
    return this.invoke('call', name, args);
  }

  async why(operationId: string, args: unknown): Promise<WhyResult> {
    return toWhyResult(await this.invoke('why', whyToolName(operationId), args));
  }

  async simulate(operationId: string, args: unknown): Promise<SimulateResult> {
    return toSimulateResult(await this.invoke('simulate', simulateToolName(operationId), args));
  }

  apply(operationId: string, args: unknown, ifMatch?: string): Promise<unknown> {
    return this.invoke('apply', operationId, args, ifMatch);
  }

  audit(): readonly AuditRow[] {
    return this.log.rows();
  }

  subscribe(listener: () => void): () => void {
    return this.log.subscribe(listener);
  }

  private async invoke(
    kind: AuditKind,
    tool: string,
    args: unknown,
    ifMatch?: string,
  ): Promise<unknown> {
    const row: Omit<AuditRow, 'outcome'> = {
      at: this.now().toISOString(),
      tool,
      argsHash: argsHash(args),
      actor: 'agent',
      principal: this.principal(),
      kind,
    };
    const params: Record<string, unknown> = { name: tool, arguments: args };
    if (ifMatch !== undefined) params._meta = { ifMatch };
    try {
      const payload = parseToolResult(tool, await this.transport.request('tools/call', params));
      this.log.append({ ...row, outcome: 'ok' });
      return payload;
    } catch (error) {
      this.log.append({ ...row, outcome: 'error' });
      throw error;
    }
  }
}

const wrapped = new WeakMap<AgentPort, AgentAffordancePort>();

/**
 * The affordance view of any `AgentPort`: an `McpAgentPort` is returned as is; a plain
 * `{ listTools, call }` port is wrapped once (per instance) so the audit log is shared by every
 * hook and panel that reads it.
 */
export function withAgentAffordance(
  port: AgentPort,
  options: McpAgentPortOptions = {},
): AgentAffordancePort {
  if (isAffordance(port)) return port;
  const existing = wrapped.get(port);
  if (existing !== undefined) return existing;
  const transport: McpTransport = {
    request: async (method, params) => {
      if (method === 'tools/list') return { tools: await port.listTools() };
      const { name, arguments: args } = params as { name: string; arguments: unknown };
      return port.call(name, args);
    },
  };
  const affordance = new McpAgentPort(transport, options);
  wrapped.set(port, affordance);
  return affordance;
}

function isAffordance(port: AgentPort): port is AgentAffordancePort {
  return port instanceof McpAgentPort || isAgentAffordancePort(port);
}
