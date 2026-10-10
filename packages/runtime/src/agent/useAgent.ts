import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { useServices } from '../services/ServicesProvider.js';
import { withAgentAffordance } from './McpAgentPort.js';
import { operationsWithTools } from './parity.js';
import type { AgentAffordancePort, AuditRow, SimulateResult, WhyResult } from './types.js';

export interface AgentHandle {
  /** False when the app wired no `agent` port; the affordance then renders nothing. */
  available: boolean;
  /** Names from `tools/list`, the capability-filtered list; empty until it has loaded. */
  tools: string[];
  why: (operationId: string, args: unknown) => Promise<WhyResult>;
  simulate: (operationId: string, args: unknown) => Promise<SimulateResult>;
  apply: (operationId: string, args: unknown, ifMatch?: string) => Promise<unknown>;
  /** Every tool call so far, oldest first (shared/13 §4: a human can always see what the agent did). */
  audit: readonly AuditRow[];
}

const NO_AGENT = 'useAgent: no agent port in Services';

function unavailable(): Promise<never> {
  return Promise.reject(new Error(NO_AGENT));
}

/** The agent affordance over `useServices().agent`; re-renders after every call so the audit is live. */
export function useAgent(): AgentHandle {
  const { agent, auth } = useServices();
  const port: AgentAffordancePort | null = useMemo(
    () =>
      agent === undefined
        ? null
        : withAgentAffordance(agent, { principal: () => auth.getPrincipal()?.id ?? null }),
    [agent, auth],
  );
  const [tools, setTools] = useState<string[]>([]);
  const [version, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (port === null) return;
    let live = true;
    port.listTools().then(
      (list) => {
        if (live) setTools(list.map((tool) => tool.name));
      },
      () => {
        if (live) setTools([]);
      },
    );
    return () => {
      live = false;
    };
  }, [port]);

  useEffect(() => (port === null ? undefined : port.subscribe(bump)), [port]);

  const why = useCallback(
    (operationId: string, args: unknown) =>
      port === null ? unavailable() : port.why(operationId, args),
    [port],
  );
  const simulate = useCallback(
    (operationId: string, args: unknown) =>
      port === null ? unavailable() : port.simulate(operationId, args),
    [port],
  );
  const apply = useCallback(
    (operationId: string, args: unknown, ifMatch?: string) =>
      port === null ? unavailable() : port.apply(operationId, args, ifMatch),
    [port],
  );
  // `version` is the subscription tick: it is what refreshes the snapshot.
  const audit = useMemo<readonly AuditRow[]>(
    () => (port === null ? [] : [...port.audit()]),
    [port, version],
  );

  return { available: port !== null, tools, why, simulate, apply, audit };
}

/**
 * The subset of `operationIds` the agent can perform: those with a tool of the same name in
 * `tools/list`. Agrees with `useCapabilities` by construction on the backend (shared/13 §3); the
 * parity suite checks it with `agentParityIssues`.
 */
export function useAgentTools(operationIds: readonly string[]): string[] {
  const { tools } = useAgent();
  return useMemo(() => operationsWithTools(operationIds, tools), [operationIds, tools]);
}
