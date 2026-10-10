import type { AgentPort } from '../ports.js';

/**
 * The agent affordance (hexagonal-rules shared/13 §3–§4, typescript/12 §2). The application MCP
 * exposes one tool per operation plus `why_<operationId>` and `simulate_<operationId>`; the UI
 * shows the rationale and the simulated change beside the form and lets the human apply it.
 */

/** The smallest MCP client the port needs; a test stubs it with two methods. */
export interface McpTransport {
  request(method: 'tools/list' | 'tools/call', params?: unknown): Promise<unknown>;
}

export interface Citation {
  label: string;
  ref: string;
}

/** `why_<operationId>`: the agent's rationale for the proposed change. */
export interface WhyResult {
  rationale: string;
  citations?: Citation[];
}

/** `simulate_<operationId>`: the change the operation would make, without making it. */
export interface SimulateResult {
  diff: unknown;
  warnings: string[];
  wouldSucceed: boolean;
}

export type AuditKind = 'why' | 'simulate' | 'apply' | 'call';
export type AuditOutcome = 'ok' | 'error';

/** One audit event per tool call (shared/13 §3); simulations are logged as simulations. */
export interface AuditRow {
  /** ISO 8601 */
  at: string;
  tool: string;
  /** FNV-1a 64 of the canonical JSON of the arguments; the arguments themselves are not kept. */
  argsHash: string;
  actor: 'agent';
  /** The delegating user, when known. */
  principal: string | null;
  kind: AuditKind;
  outcome: AuditOutcome;
}

/** `AgentPort` plus the typed helpers and the audit the UI shows. */
export interface AgentAffordancePort extends AgentPort {
  why(operationId: string, args: unknown): Promise<WhyResult>;
  simulate(operationId: string, args: unknown): Promise<SimulateResult>;
  apply(operationId: string, args: unknown, ifMatch?: string): Promise<unknown>;
  audit(): readonly AuditRow[];
  /** Notifies after every appended audit row; returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}

export function isAgentAffordancePort(port: AgentPort): port is AgentAffordancePort {
  const candidate = port as Partial<AgentAffordancePort>;
  return (
    typeof candidate.why === 'function' &&
    typeof candidate.simulate === 'function' &&
    typeof candidate.apply === 'function' &&
    typeof candidate.audit === 'function' &&
    typeof candidate.subscribe === 'function'
  );
}
