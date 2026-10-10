export { AgentAuditLog } from './AgentAuditLog.js';
export { argsHash, canonicalJson, fnv1a64 } from './hash.js';
export {
  AgentToolError,
  McpAgentPort,
  parseToolResult,
  simulateToolName,
  toSimulateResult,
  toWhyResult,
  whyToolName,
  withAgentAffordance,
  type McpAgentPortOptions,
} from './McpAgentPort.js';
export {
  AGENT_HELPER_PREFIXES,
  agentParityIssues,
  isHelperTool,
  operationsWithTools,
  type AgentParityIssue,
} from './parity.js';
export type {
  AgentAffordancePort,
  AuditKind,
  AuditOutcome,
  AuditRow,
  Citation,
  McpTransport,
  SimulateResult,
  WhyResult,
} from './types.js';
export { isAgentAffordancePort } from './types.js';
export { useAgent, useAgentTools, type AgentHandle } from './useAgent.js';
