# @star-board/runtime

L2 (React). The shared runtime every generated screen and every override runs on: providers for the
component registry and the services, one typed HTTP client over `openapi-fetch`, data hooks on
TanStack Query, capability gating, error presentation and key-based i18n. It imports only
`@star-board/core` among workspace packages and never a renderer; it carries no domain logic.

Rules applied: `typescript/01` §3–§5 (hooks call ports, adapters own auth and error typing),
`typescript/02` §3 and §5 (shared data hooks, one client, primitives in dependency arrays),
`typescript/05` §1, §2, §5, §7 (services provider, error table, interceptor-owned tokens, i18n keys),
`shared/13` §3 (the capability filter that hides actions is the one the MCP tool list uses).

## Wiring

```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { ComponentRegistry } from '@star-board/core';
import {
  createClient,
  RegistryProvider,
  ScopeProvider,
  ServicesProvider,
} from '@star-board/runtime';
import type { paths } from './generated/adapters/types'; // from the generated layer

const client = createClient<paths>('/api/v1', auth); // auth: AuthPort
const registry = new ComponentRegistry();

<QueryClientProvider client={queryClient}>
  <ServicesProvider services={{ client, auth, notify, agent, model }}>
    <RegistryProvider registry={registry}>
      <ScopeProvider version={model.schemas.pet.version}>…</ScopeProvider>
    </RegistryProvider>
  </ServicesProvider>
</QueryClientProvider>;
```

`Services` is `{ client, auth, notify, agent?, model?, operations? }`. The data hooks reach HTTP
only through an `OperationsPort`; `useOperations()` returns `services.operations` when given
(tests stub it) and otherwise builds the default port from `client` and `model`, so one of the two
is required.

## Ports

| Port             | Shape                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| `AuthPort`       | `getToken(): Promise<string \| null>`, `getPrincipal(): Principal \| null`, `onUnauthorized(): void`           |
| `NotifyPort`     | `notify(level: 'info' \| 'success' \| 'warning' \| 'error', message: string)`                                  |
| `AgentPort`      | `listTools(): Promise<{ name }[]>`, `call(name, args): Promise<unknown>` (optional; the agent affordance)      |
| `OperationsPort` | `get(schema, id)`, `list(schema, query)`, `view(view, query)`, `mutate(operationId, { id?, body?, ifMatch? })` |

`Principal` is `{ id, roles: string[], capabilities: string[] }` in backend spellings.

## Client

- `createClient<Paths>(baseUrl, auth, { headers?, fetch? })` returns an `openapi-fetch` `Client<Paths>`
  with `createAuthMiddleware(auth)` installed: `Authorization: Bearer <token>` when a token exists,
  `Accept: application/json`, `If-Match` forwarded from the call, and every non-2xx response rethrown
  as `HttpError`. A 401 calls `auth.onUnauthorized()` exactly once per response and marks the error
  `unauthorizedHandled`.
- `parseProblem(response)` → `{ status, code, title, detail, fields? }` from RFC 7807 bodies or the
  `{ success: false, error: { code, message, details } }` envelope (`problemFromBody` is the pure
  half). A body without a code gets a default by status; 412 is `PRECONDITION_FAILED`.
- `etagOf(doc)` → `W/"<entity_id>:<record_version>"`; accepts `entityId`/`recordVersion` too.
- `HttpClient` / `UntypedPaths` type the client when no generated `paths` is in play.

## Data hooks

All return `{ data, loading, error, refetch }` and key through `queryKeys`, the one authority:
`queryKeys.entity(schema, id)`, `.list(schema, query)`, `.view(view, query)`, `.schema(schema)`,
`.all()`. Queries are normalised (sorted keys, `undefined` dropped) so equal queries share a cache.

- `useEntity<T>(schema, id)` — a falsy id disables the fetch.
- `useEntityList<T>(schema, { where?, sort?, page?, pageSize? })` → `Page<T>`; the default port maps
  these to the backends' `where` (JSON), `sort`, `skip`, `limit`.
- `useView<T>(view, query)` → `Page<T>` through the view's `operationId` in the FeatureModel.
- `useMutation<I, O>(operationId, { onSuccess?, onError?, invalidates? })` → `{ mutate, mutateAsync,
loading, error, data, reset }`. Variables are `{ id?, body?, doc? }`; for `update` and `delete`
  operations `doc` is required and becomes `If-Match` via `etagOf`. A stale document surfaces as
  `HttpError` 412 `PRECONDITION_FAILED`. Success invalidates the operation's schema keys (or
  `invalidates`).

## Registry and scope

- `useRegistry()`; `useComponent<C>(key, schema, target)` returns the resolved `Registration<C>`
  (render `.component`; `.source` and `.specificity` feed a why panel). Resolution uses
  `useScope()`: `role` from the principal's first role unless `ScopeProvider` pins one, `version`
  from `ScopeProvider` or else the schema's version in the FeatureModel. A core `RegistryError`
  propagates unchanged.

## Capabilities and errors

- `useCapability(cap)`; `useCapabilities(ops)` keeps the operations whose every capability the
  principal holds (`hasCapabilities`, `filterOperations` are the pure forms). Anonymous sees nothing.
- `useErrorPresentation()` returns `present(error)` → `{ kind, message, key, status?, code?, fields? }`
  with `kind` in `redirect | alert | retry | empty | forbidden`: 401 redirect (calling
  `onUnauthorized` once if the client has not), 403 forbidden or empty by the model's posture,
  404 empty, 409/412/429 retry, 422 alert with `fields`, 5xx alert, `RegistryError` alert, `TypeError`
  network alert. Messages come from i18n keys (`error.*`), never from backend text. `presentError`
  is the pure table.

## i18n

`createI18n(defaults, translations?)` → `{ t(key, vars?), has, extend }`; unknown keys fall back to
the default text, then to the key. `I18nProvider` / `useI18n()`; `RUNTIME_DEFAULT_MESSAGES` lists the
keys the runtime itself uses. The generator's `i18n.defaults.json` is the `defaults` argument.

## Tests

`pnpm -F @star-board/runtime test` — RTL `renderHook` under the providers with stubbed ports; the
client and the default operations port are exercised through msw against a hand-built FeatureModel.

## Agent affordance (`src/agent/`)

The "ask the agent" affordance (hexagonal-rules shared/13 §3–§4, typescript/12 §2) over the
application MCP. `McpAgentPort(transport, { principal?, log?, now? })` implements `AgentPort` over
a minimal `McpTransport { request('tools/list' | 'tools/call', params?) }` so a test stubs it in two
lines, and adds the typed helpers:

| Call                                 | Tool                     | Returns                                                                      |
| ------------------------------------ | ------------------------ | ---------------------------------------------------------------------------- |
| `why(operationId, args)`             | `why_<operationId>`      | `WhyResult { rationale, citations?: { label, ref }[] }`                      |
| `simulate(operationId, args)`        | `simulate_<operationId>` | `SimulateResult { diff, warnings: string[], wouldSucceed }`                  |
| `apply(operationId, args, ifMatch?)` | `<operationId>`          | the parsed tool result; `ifMatch` travels as `_meta.ifMatch` of `tools/call` |

A tool result is read as `structuredContent`, else its text content parsed as JSON when it is
JSON, else the text (a `why_` text becomes the rationale; a `simulate_` text becomes the diff and is
assumed to succeed). `isError: true` throws `AgentToolError`. Every call appends one `AuditRow`
`{ at, tool, argsHash, actor: 'agent', principal, kind, outcome }` to an in-memory, bounded
`AgentAuditLog` (`audit()`, `subscribe()`); `argsHash` is FNV-1a 64 of the canonical JSON of the
arguments (`canonicalJson`, `fnv1a64`), so the log identifies calls without keeping their inputs.
Simulations are logged with `kind: 'simulate'`.

`useAgent()` → `{ available, tools, why, simulate, apply, audit }` from `useServices().agent`:
`available` is false without an agent port (the affordance then renders nothing), `tools` is the
capability-filtered `tools/list`, `audit` re-renders after every call. A plain `{ listTools, call }`
port is wrapped once per instance by `withAgentAffordance`, which records the auth principal.
`useAgentTools(operationIds)` keeps the ids that have a tool of the same name; `agentParityIssues(
visibleOperationIds, toolNames)` is the pure check that this agrees with `useCapabilities`
(`action-without-tool`, `tool-without-action`; `why_`/`simulate_` helpers are not actions).
