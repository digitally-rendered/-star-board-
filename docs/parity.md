# Parity

One operation in the document must exist on three surfaces and agree on every axis. hexagonal-rules
`shared/13` §2 and §6 state it for REST and MCP; `typescript/12` §6 extends it to screens.

## The three surfaces

| Surface | Where it comes from                                                                      | Named by                                                                                       |
| ------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| REST    | the backend route for `paths.<path>.<method>`                                            | `operationId` (`<schema>_<operation>`)                                                         |
| MCP     | the application MCP server's `tools/list`                                                | a tool named exactly the operation id; `why_<id>` and `simulate_<id>` are helpers, not actions |
| screens | `star-board generate`: a `screen.*` with its route, or a `use<Schema><Op>()` action hook | the same operation id as registry target and `data-testid="action-<id>"`                       |

The document is the one authority. Every column below is read from the `FeatureModel` and
compared with what the other surfaces carry; nothing consults a backend or a renderer.

## The report

`parityReport({ model, generated, mcpTools?, restOperations? })` in `@star-board/testing` yields
one row per operation, in id order:

| Column           | True when                                                                                                                                                                 | Input                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `rest`           | `restOperations` has the id with the document's method and path; without it, the generated `adapters/paths.ts` `OPERATION_TABLE` row does                                 | `restOperations?`                      |
| `screenOrAction` | the capability table in `use<Schema>Actions.ts` names the id, every screen the plan gives it exists as a file with its route in `routes.tsx`, and a mutation has its hook | `generated`                            |
| `mcpTool`        | a tool named exactly the operation id is listed                                                                                                                           | `mcpTools?` (else `n/a`)               |
| `version`        | `domain/<schema>/types.ts` declares the `x-schema-version` and the `<title>@<version>` header; the manifest's `source.version` is the document version                    | `generated` (+ `manifest`)             |
| `capabilities`   | the capability table lists exactly the operation's `x-capabilities`                                                                                                       | `generated`                            |
| `inputSchema`    | the tool's `inputSchema` deep-equals the operation's request schema (key order ignored)                                                                                   | `mcpTools[].inputSchema?` (else `n/a`) |

`ok` is every column not `false`. `n/a` means the input for the column was not given and never
fails a row. `missing` lists `<operationId>: <column>` per failing cell. `assertParity(report)`
throws `ParityError { rows, missing }`.

## `star-board parity`

```bash
star-board parity --document openapi.json --out src/generated --features src/features
star-board parity --document openapi.json --out src/generated --features src/features --mcp-tools tools.json
star-board parity … --json
```

| Option               | Meaning                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `--document`         | path or `http(s)://` URL                                                                                              |
| `--out`              | the generated tree to read; empty → exit 2 with "run `star-board generate`"                                           |
| `--mcp-tools <file>` | a `tools/list` result: a JSON array or `{ "tools": [...] }`; each entry needs a string `name`, optional `inputSchema` |
| `--no-i18n`          | match a generate run that used `--no-i18n`                                                                            |
| `--json`             | `{ command, document, out, mcpTools, ok, rows, missing }` on stdout                                                   |

Exit 0 when every cell agrees, 1 on any disagreement, 2 on a usage or load error. The example
runs it as `pnpm -F @star-board/example-petstore-ui parity`.

## The hide/deny matrix

The same missing capability must hide the affordance in the UI and deny the request on the
server (`shared/13` §3). What the denial looks like is the document's `info.x-ownership-posture`
(default `404`, contradiction #5):

| Principal lacks the capability | REST / msw answer | Screen (read operation)                                 | Action (mutation) | MCP                                        |
| ------------------------------ | ----------------- | ------------------------------------------------------- | ----------------- | ------------------------------------------ |
| posture `404`                  | `404` problem     | `state.empty` (indistinguishable from a missing record) | button absent     | tool absent from the filtered `tools/list` |
| posture `403`                  | `403` problem     | `state.forbidden`                                       | button absent     | tool absent                                |
| holds the capability           | `2xx`             | the screen                                              | button present    | tool listed                                |

Where each half lives:

- UI: the generated container hooks call `useCapability` and filter `actions`; the generator
  chooses `state.empty` or `state.forbidden` from the posture. The runtime's
  `useErrorPresentation` maps 403 to `forbidden` or `empty` by the same posture and 404 to `empty`.
- server stand-in: `handlersFromModel(model, { principalCapabilities })` answers by posture for
  an operation whose capabilities the principal lacks.
- agent: `useAgentTools` and `agentParityIssues(visibleOperationIds, toolNames)` assert the
  filtered tool list equals the visible actions (`action-without-tool`, `tool-without-action`).

`examples/petstore-ui/src/capabilities.test.tsx` is the matrix as a test: `capabilityCases(model)`
yields, per operation, a principal `with` every capability and one `without` the operation's; the
test asserts the request is answered 404 then 2xx, and that the screen or action is absent then
present.

## msw handlers from the document

`@star-board/testing` derives one msw handler per operation from the document, imitating the
contract the backends share (`shared/02` §6a). The same handlers serve the tests
(`setupServerFromModel`) and the browser dev mode (`@star-board/testing/browser`).

| Kind             | Answers                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `list`           | `{ items, total }`; `skip`/`limit` or `page`/`pageSize`; `where` as JSON or `field=` / `field_op=`; `sort=name`, `-name`, `name:desc`       |
| `get`            | the row with `ETag: W/"<id>:<record_version>"`, else a 404 problem                                                                          |
| `create`         | validates the Create schema → 422 with `errors: { field: message }`; else 201 with `entity_id`, `record_version: 1`, defaults, audit fields |
| `update`         | 404 when missing; `If-Match` must equal the current ETag else 412; validates the Update schema; bumps `record_version`                      |
| `delete`         | 204 and a tombstone (`get` is 404, `_history` survives)                                                                                     |
| `history`        | `{ items: versions, total }`, oldest first                                                                                                  |
| `view`           | rows projected to `x-view.projection` plus the id, filtered, sorted and paged by the view                                                   |
| `custom`, `bulk` | 200 `{}`                                                                                                                                    |

Problems are RFC 7807 (`application/problem+json`). `fixtures(model, schema, n, { seed })` seeds
rows that validate against the schema; the same seed yields the same rows. Validation agreement
between the generated zod schemas and the stand-in backend is a fast-check property in the
generator (contradiction #11).

## Reading a failure

```
operation            rest           screenOrAction mcpTool        version        capabilities   inputSchema
pet_create           ok             ok             ok             ok             ok             ok
pet_delete           ok             ok             ok             ok             MISSING        n/a
pet_history          ok             ok             MISSING        ok             ok             n/a
parity: 2 cell(s) disagree: pet_delete: capabilities, pet_history: mcpTool
```

| Cell                           | Reads as                                                                       | Fix                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `rest MISSING`                 | the served route (or `paths.ts`) differs from the document's method or path    | regenerate; if `restOperations` was given, the backend drifted from its own document |
| `screenOrAction MISSING`       | a screen file, route or action hook is gone or renamed                         | `star-board generate`; never hand-edit `src/generated`                               |
| `mcpTool MISSING`              | the MCP server does not list a tool of that id                                 | the backend's MCP adapter must name tools by operation id (`shared/13` §2)           |
| `version MISSING` on every row | the document version or a schema's `x-schema-version` changed after generating | regenerate; the drift check would also fail                                          |
| `capabilities MISSING`         | `x-capabilities` changed after generating                                      | regenerate                                                                           |
| `inputSchema MISSING`          | the tool advertises a different input than the request schema                  | a schema fact to fix in the backend, never a client-side patch                       |
| `n/a`                          | `--mcp-tools` (or `restOperations`) was not given                              | supply it to light the column                                                        |

The columns never consult a renderer, so an override cannot turn a cell red; see
[overrides.md](overrides.md). The report is green on `fixtures/petstore.json` with a tool list
built from the document; `packages/testing/src/parity/parity.test.ts` holds one red case per
column.
