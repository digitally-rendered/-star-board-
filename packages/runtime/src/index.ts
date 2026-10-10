/** @star-board/runtime — L2. React runtime: RegistryProvider, ServicesProvider, typed client factory, data hooks on TanStack Query, capability gating, error presentation, i18n keys, platform primitives (unsaved changes, session timeout, compact layout), agent affordance port. */
export const PACKAGE = '@star-board/runtime' as const;
export const LAYER = 'L2' as const;

export type { AgentPort, AuthPort, NotifyLevel, NotifyPort, Principal } from './ports.js';
export {
  createAuthMiddleware,
  createClient,
  IF_MATCH,
  type ClientOptions,
  type HttpClient,
  type HttpMethod,
  type UntypedOperation,
  type UntypedPaths,
} from './client/createClient.js';
export {
  DEFAULT_CODES,
  defaultCodeFor,
  HttpError,
  isHttpError,
  parseProblem,
  problemFromBody,
  type ProblemDetails,
} from './client/errors.js';
export { etagOf, type Versioned } from './client/etag.js';
export {
  ServicesProvider,
  useOperations,
  useServices,
  type Services,
} from './services/ServicesProvider.js';
export {
  RegistryProvider,
  ScopeProvider,
  useComponent,
  useRegistry,
  useScope,
} from './registry/RegistryProvider.js';
export {
  normalise,
  queryKeys,
  type ListQuery,
  type QueryKey,
  type ViewQuery,
} from './data/queryKeys.js';
export {
  createOperationsPort,
  DEFAULT_PAGE_SIZE,
  listParams,
  toPage,
  type MutateInput,
  type OperationsPort,
  type Page,
} from './data/operations.js';
export {
  useEntity,
  useEntityList,
  useMutation,
  useView,
  type MutationOptions,
  type MutationState,
  type MutationVariables,
  type QueryState,
} from './data/hooks.js';
export {
  filterOperations,
  hasCapabilities,
  useCapabilities,
  useCapability,
} from './capability/useCapability.js';
export {
  presentError,
  useErrorPresentation,
  type ErrorKind,
  type ErrorPresentation,
  type Posture,
} from './errors/useErrorPresentation.js';
export {
  createI18n,
  DEFAULT_LOCALE,
  defaultLocale,
  I18nProvider,
  RUNTIME_DEFAULT_MESSAGES,
  useI18n,
  type I18n,
  type I18nOptions,
  type I18nProviderProps,
  type Translate,
  type Vars,
} from './i18n/createI18n.js';
export { useUnsavedChanges, type UnsavedChanges } from './platform/useUnsavedChanges.js';
export {
  ACTIVITY_EVENTS,
  ACTIVITY_THROTTLE_MS,
  useSessionTimeout,
  type SessionTimeout,
  type SessionTimeoutOptions,
  type SessionTimeoutState,
} from './platform/useSessionTimeout.js';
export {
  COMPACT_BREAKPOINT_PX,
  COMPACT_MEDIA_QUERY,
  useCompactLayout,
  useMediaQuery,
} from './platform/useMediaQuery.js';
export {
  AGENT_HELPER_PREFIXES,
  AgentAuditLog,
  agentParityIssues,
  AgentToolError,
  argsHash,
  canonicalJson,
  fnv1a64,
  isAgentAffordancePort,
  isHelperTool,
  McpAgentPort,
  operationsWithTools,
  parseToolResult,
  simulateToolName,
  toSimulateResult,
  toWhyResult,
  useAgent,
  useAgentTools,
  whyToolName,
  withAgentAffordance,
  type AgentAffordancePort,
  type AgentHandle,
  type AgentParityIssue,
  type AuditKind,
  type AuditOutcome,
  type AuditRow,
  type Citation,
  type McpAgentPortOptions,
  type McpTransport,
  type SimulateResult,
  type WhyResult,
} from './agent/index.js';
