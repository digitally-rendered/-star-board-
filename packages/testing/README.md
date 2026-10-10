# @star-board/testing

L5. The parity suite (document ↔ generated code ↔ MCP tool list), msw handlers derived from the
document, deterministic fixtures, page-object descriptors for the generated screens and the
fixture loader. Three entry points:

- `@star-board/testing` — node-safe: parity, msw server, fixtures, selectors, `loadFixtureModel`.
- `@star-board/testing/browser` — handlers, store and fixtures without `msw/node`, for a dev mode
  without a backend (`examples/petstore-ui/src/msw/browser.ts`).
- `@star-board/testing/harness` — the screen harness (RTL + vitest-axe under the runtime
  providers); the only entry that imports `@star-board/renderer-mui`, React and `react-router`.
  Needs jsdom (`// @vitest-environment jsdom`).

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
beforeAll(() => server.listen());
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

## Screen harness (`@star-board/testing/harness`)

```ts
import {
  capabilityCases,
  expectNoViolations,
  expectTestIds,
  renderedTestIds,
  renderGeneratedScreen,
  renderRoutes,
} from '@star-board/testing/harness';

const { container } = renderGeneratedScreen({
  model,
  register: (registry) => {
    registerGenerated(registry);
    registerPetOverrides(registry);
  },
  screen: { key: 'screen.list', schema: 'pet', target: 'pet_list' },
  props,
});
expectTestIds(container, renderedTestIds(model, 'pet', 'list'));
await expectNoViolations(container);
```

`createHarness(options)` builds what the app's composition root builds: a QueryClient, a registry
with the renderer defaults then whatever `register` adds (the generated `registerGenerated`, the
overrides), Services over `createClient(baseUrl)` (default `http://star-board.test/api`, which the
msw server answers) with a principal holding every capability of the document unless `principal`
is given, and the i18n table (runtime + renderer defaults + `messages`, the generated
`i18n.defaults.json`). An optional `theme` (`createTheme` + `buildCssVariables`) mounts `ThemeRoot`.

| Helper                                     | Role                                                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `renderWithProviders(ui, options)`         | RTL `render` under the providers                                                                                           |
| `renderGeneratedScreen({ screen, props })` | resolves `screen.<kind>` at (schema, operationId) through the registry — default or override — and renders it with `props` |
| `renderRoutes({ routes, initialEntries })` | the generated route table (containers + hooks) in a memory router: the full workflow against msw                           |
| `renderedTestIds(model, schema, kind)`     | the static ids a screen with data carries (hidden columns' sort buttons and a filterless grid's filter bar excluded)       |
| `expectTestIds(container, ids)`            | fails naming every missing `data-testid`                                                                                   |
| `expectNoViolations(root)`                 | axe over `root`, violations spelled out                                                                                    |
| `capabilityCases(model)`                   | per operation: the principal `with` every capability and the one `without` the operation's, for the hide/deny matrix       |

The tests that mount the petstore screens live in `examples/petstore-ui/src/*.test.tsx` (every
screen with axe and test ids, the capability hide/deny matrix, the override round trip, the full
workflow); this package's `harness.test.tsx` covers the harness itself.

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
