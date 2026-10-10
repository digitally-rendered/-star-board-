/**
 * The UI hides the actions the principal lacks and the application MCP filters its tool list by
 * the same capabilities (shared/13 §3): the two must agree. This pure check is what the parity
 * suite and `useAgentTools` share.
 */

/** Tools that accompany an operation rather than being one. */
export const AGENT_HELPER_PREFIXES = ['why_', 'simulate_'] as const;

export function isHelperTool(name: string): boolean {
  return AGENT_HELPER_PREFIXES.some((prefix) => name.startsWith(prefix));
}

export interface AgentParityIssue {
  kind: 'action-without-tool' | 'tool-without-action';
  operationId: string;
}

/**
 * Mismatches between the actions the UI shows (`useCapabilities`) and the tools the MCP lists:
 * a visible action with no tool, or a tool (helpers aside) for an action that is not visible.
 */
export function agentParityIssues(
  visibleOperationIds: readonly string[],
  toolNames: readonly string[],
): AgentParityIssue[] {
  const visible = new Set(visibleOperationIds);
  const tools = new Set(toolNames);
  const issues: AgentParityIssue[] = [];
  for (const operationId of visible) {
    if (!tools.has(operationId)) issues.push({ kind: 'action-without-tool', operationId });
  }
  for (const tool of tools) {
    if (!isHelperTool(tool) && !visible.has(tool)) {
      issues.push({ kind: 'tool-without-action', operationId: tool });
    }
  }
  return issues;
}

/** The operation ids that have a tool of the same name. */
export function operationsWithTools(
  operationIds: readonly string[],
  toolNames: readonly string[],
): string[] {
  const tools = new Set(toolNames);
  return operationIds.filter((id) => tools.has(id));
}
