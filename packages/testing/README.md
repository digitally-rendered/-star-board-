# @star-board/testing

L5. The parity suite (document ↔ generated code ↔ MCP tool list), msw handlers derived from the
document, deterministic fixtures, page-object descriptors for the generated screens and the
fixture loader. Imports `@star-board/core`, `@star-board/spec` and `@star-board/generator`; the
renderer-dependent screen harness (RTL + vitest-axe) is described in `src/harness/README.md` and
is the only part that will import `@star-board/renderer-mui`.

Rules applied: hexagonal-rules `shared/13` §2 "Parity is tested" and §6, `typescript/12` §6–§7,
`shared/02` §6a (the backend contract the msw handlers imitate).

## Parity

```ts
import { generate } from '@star-board/generator';
import { assertParity, loadFixtureModel, parityReport } from '@star-board/testing';

const model = loadFixtureModel('petstore');
const files = generate(model, { out: 'src/generated', features: 'src/features' });
const report = parityReport({ model, generated: files, mcpTools: await agent.listTools() });
assertParity(report); // throws ParityError { rows, missing } on any disagreement
```

One row per operation in the document, in id order. The document is the authority in every
column; `'n/a'` means the input needed for the column was not supplied and never fails a row.

| Column           | True when                                                                                                                                                                                                       | Input                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `rest`           | `restOperations` has the id with the document's method and path; without it, the generated `adapters/paths.ts` `OPERATION_TABLE` row does                                                                       | `restOperations?`                        |
| `screenOrAction` | the generated `use<Schema>Actions.ts` capability table names the id, every screen the plan gives the operation exists as a file with its route in `routes.tsx`, and a mutation has its `use<Schema><Op>()` hook | `generated`                              |
| `mcpTool`        | a tool named exactly the operation id is listed (and `mcpTool`, when the document carries one, repeats the id)                                                                                                  | `mcpTools?` (else `'n/a'`)               |
| `version`        | `domain/<schema>/types.ts` declares `Schema <name> version <x-schema-version>` and the `<title>@<version>` header; the manifest's `source.version` is the document version                                      | `generated` (+ `manifest`)               |
| `capabilities`   | the capability table lists exactly the operation's `x-capabilities`                                                                                                                                             | `generated`                              |
| `inputSchema`    | the tool's `inputSchema` deep-equals the operation's request schema (key order ignored)                                                                                                                         | `mcpTools[].inputSchema?` (else `'n/a'`) |

`ok` is every column not `false`; `missing` lists `<operationId>: <column>` for each failing cell.
The hiding/denying half of parity (the same missing capability hides the action and denies the
tool) is a screen-harness test and lands with it.

## msw from the document

```ts
import { setupServerFromModel, fixtures, loadFixtureModel } from '@star-board/testing';

const model = loadFixtureModel();
const { server, store } = setupServerFromModel(model, { principalCapabilities: ['pet:read'] });
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => store.reset());
afterAll(() => server.close());
store.seed('pet', fixtures(model, 'pet', 10));
```

`handlersFromModel(model, store | options)` returns one msw 3 `http.*` handler per operation,
matched on `*<path>` (any origin and prefix; set `baseUrl` to pin one). What each kind answers:

| Kind             | Behaviour                                                                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list`           | `{ items, total }`; paging by `skip`/`limit` (the runtime's spelling) or `page`/`pageSize`; `where` as JSON (`{ field: v }` or `{ field: { _op: v } }`), `field=` / `field_op=` params; `sort=name`, `-name`, `name:desc`                   |
| `get`            | the row with `ETag: W/"<id>:<record_version>"`, else 404 problem                                                                                                                                                                            |
| `create`         | validates the Create schema (required, type, enum, length, format, `additionalProperties: false`) → 422 `{ …problem, errors: { field: message } }`; else 201 with `entity_id` (uuid), `record_version: 1`, schema defaults and audit fields |
| `update`         | 404 when missing; `If-Match` must equal the current ETag else 412; validates the Update schema (422); increments `record_version`, refreshes `updated_*`                                                                                    |
| `delete`         | 204 and a tombstone (`get` is 404, `_history` survives); 404 when already gone                                                                                                                                                              |
| `history`        | `{ items: versions, total }` oldest first, 404 for a record that never existed                                                                                                                                                              |
| `view`           | rows projected to the view's `projection` plus the id, filtered only by the view's declared filters, sorted by its `sort`, paged within its `limits`                                                                                        |
| `custom`, `bulk` | 200 `{}`                                                                                                                                                                                                                                    |

Problems are RFC 7807 `{ type, title, status, detail }` with `application/problem+json`. With
`principalCapabilities` set, an operation whose capabilities the principal lacks answers 403
under the `403` posture and an indistinguishable 404 under the `404` posture (`shared/13` §3).
`now` and `principalId` pin the audit values for snapshot tests. Nothing in `src/` calls `fetch`.

`createStore(seed?)` is the in-memory state: `seed`, `list`, `get`, `insert`, `replace`, `remove`
(tombstone), `history`, `reset`.

## Fixtures

`fixtures(model, schema, n, { seed?, variant?, epoch? })` yields `n` rows that validate against
the schema's `document` (default), `create` or `update` variant: strings within
`minLength`/`maxLength`, enum members, `uuid`/`date-time`/`date`/`email` formats, numeric bounds,
arrays within `minItems`/`maxItems`, nested objects. The same seed yields the same rows.
`fixturesFromSchema(schema, n, options)` runs over a bare JSON Schema; `validatePayload(schema,
value)` is the structural check the handlers and the fixture tests share (not a full validator).

`loadFixtureModel(name = 'petstore')` loads `fixtures/<name>.json` from the workspace through
`loadDocument`, so a fixture that is missing an extension fails closed here too.

## Page objects

`selectors(schema)` is the `data-testid` vocabulary of the generated screens, encoded once and
Playwright-free. The generator emits `<schema>-<kind>-<part>[-<extra>]` (`pet-list-screen`,
`pet-list-sort-name`, `pet-list-row-<id>`, `pet-detail-field-name`, `pet-create-group-details`,
`pet-<op>-screen` for a custom operation); the renderer's contract components emit `field-<name>`,
`action-<operationId>` (+ `-dialog`, `-cancel`, `-confirm`), `cell-<field>`, `state-<kind>` and the
shell ids `screen`, `screen-actions`, `screen-body`, `data-grid-list`. `selectorTable(model)`
expands every static id the document's screens carry; its test asserts each appears in the
generated screen text and snapshots the table.

## Tests

`pnpm -F @star-board/testing test` (node environment): parity green on the petstore fixture and
red for a dropped tool, a changed capability, a changed schema version, a differing input schema
and a dropped screen, route, hook or file; the full lifecycle through `fetch` against
`setupServer` (create → get → list → update with `If-Match` → 412 → history → delete → 404), 422
on an invalid create, view projection and filters, 403/404 by posture; fixtures validate for every
seed (fast-check); the selector table snapshot.

See the plan Part 2 and `.kiro/specs/07-testing-parity/` for the owning spec.
