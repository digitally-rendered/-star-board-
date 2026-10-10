# Getting started

From one OpenAPI 3.1 document to a running React app with default screens, in six steps.
`examples/petstore-ui` is the reference consumer; every path below exists there.

## 1. Prerequisites

| Need           | Version                                   | Why                                                                          |
| -------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| Node           | 22 or later (`.nvmrc` says 26)            | `engines.node >= 22`; CI tests 22, 24 and 26                                 |
| pnpm           | 10 (`packageManager` pins `10.33.2`)      | workspace protocol, `pnpm -F` filters                                        |
| React          | 19                                        | `@star-board/runtime` and `@star-board/renderer-mui` peer on it              |
| An OpenAPI 3.1 | document that passes the conformance list | the only input; see [backend-conformance.md](backend-conformance.md)         |
| Playwright     | optional                                  | only for `test:e2e` in the example (`pnpm exec playwright install chromium`) |

The packages are not published yet (the publish dry-run is plan task 24). Consume them from
this workspace with `workspace:*` dependencies, as the example does.

## 2. Install and build

```bash
pnpm install
pnpm build                      # every package under packages/ (tsdown)
pnpm check && pnpm test         # lint, typecheck, arch, fitness, waves, ratchet, noskip; vitest
```

The CLI runs from `packages/cli/dist/bin.js`, so `pnpm -F @star-board/cli build` must have run
before any `star-board` command below.

## 3. Obtain a conforming document

star-board reads one OpenAPI 3.1 document and nothing else. The loader fails closed: a missing
`x-schema-version`, `operationId`, `x-capabilities` or `x-view` stops generation and names the
extension and its location. The full list is [backend-conformance.md](backend-conformance.md).

| Source                                        | Status                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `fixtures/petstore.json`                      | the hand-authored reference document; passes every rule; what the example is generated from |
| a slip-stream, stellar-drive or Syntact build | not yet; the backends do not emit the `x-*` extensions (`.claude/state/known-issues.md`)    |
| `fixtures/negative/*.json`                    | one document per missing extension; each fails with its name                                |

The document is built by a file-only step in the backend repo and committed as `openapi.json`
(contradiction #1). The CLI also accepts an `http(s)://` URL, fetched once; pre-commit and CI
read the committed path (contradiction #10).

## 4. `init`, `generate`, `check`

```bash
star-board init my-app                     # star-board.config.json, src/features/README.md, src/main.tsx, src/App.tsx
cd my-app
star-board generate --document openapi.json --out src/generated --features src/features
star-board check    --document openapi.json --out src/generated --features src/features
```

| Command    | Does                                                                                                                         | Exit                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `init`     | writes a consumer skeleton; refuses to overwrite any existing target                                                         | 0; 2 if a file exists |
| `generate` | document → `FeatureModel` → files under `--out`; prints the file count and the sha256 of `manifest.json`                     | 0                     |
| `check`    | regenerates in memory and diffs byte for byte against `--out`; one `kind path` row per drift (`missing`, `changed`, `extra`) | 0 clean, 1 drift      |

Every command reads `star-board.config.json` from the working directory for omitted flags, so
after `init` the three options can be left out. `--dry-run` on `generate` lists the files and
writes nothing. `--features` is never written: a generated path that would land inside it fails
with `GENERATOR_OUT_OF_SURFACE` and nothing is written. The full command table is
[`packages/cli/README.md`](../packages/cli/README.md).

What lands under `--out` (`packages/generator/README.md` has the file-by-file table):

```
src/generated/
├── domain/        contract.ts, AgentPanelSlot.tsx, <schema>/{types,schemas,columns}.ts and the five screens
├── application/   support.ts, <schema>/use<Schema>Actions.ts, use<Schema>Screens.ts
├── adapters/      paths.ts, client.ts
├── registry.ts    registerGenerated(registry)
├── setup.ts       createGeneratedRegistry(): renderer defaults, then the generated screens
├── routes.tsx, nav.ts, i18n.defaults.json, i18n.ts, index.ts
└── manifest.json
```

The example runs the same three commands through its scripts:
`pnpm -F @star-board/example-petstore-ui generate | check | parity`.

## 5. Wire `main.tsx`

The composition root builds every adapter once and puts it in context. The example splits this
into `src/main.tsx` (bootstrap) and `src/app.tsx` (providers, registry, routes).

### Providers, in nesting order

| Provider              | From                       | Carries                                                                        |
| --------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| `QueryClientProvider` | `@tanstack/react-query`    | the TanStack Query client the data hooks use                                   |
| `ThemeRoot`           | `@star-board/renderer-mui` | the MUI theme and the tokens' CSS-variable blocks (see [tokens.md](tokens.md)) |
| `RegistryProvider`    | `@star-board/runtime`      | the `ComponentRegistry`                                                        |
| `ServicesProvider`    | `@star-board/runtime`      | `{ client, auth, notify, model, agent? }`                                      |
| `I18nProvider`        | `@star-board/runtime`      | runtime + renderer defaults + the generated `i18n.defaults.json`               |
| `RouterProvider`      | `react-router`             | the generated `routes` under your layout                                       |

### Registry

```ts
import { createGeneratedRegistry } from './generated/setup.js';
import { registerPetOverrides } from './features/pet/index.js';

const registry = createGeneratedRegistry(); // registerDefaults(renderer), then registerGenerated()
registerPetOverrides(registry); // overrides last; they win by source at equal coordinates
```

### Services

`createClient(baseUrl, auth)` from the runtime returns the `openapi-fetch` client with the auth
middleware installed. `auth` is an `AuthPort`: `getToken()`, `getPrincipal()`, `onUnauthorized()`.
The principal's `capabilities` decide which actions and screens appear. Pass `model` (the
`FeatureModel`) so the default operations port and the posture are known.

### Routes and model

`routes` from `./generated/routes.js` is a `RouteObject[]`; `nav` from `./generated/nav.js` has
one entry per schema. The example mounts them under one `Layout` and sends `/` to `nav[0].path`.

The browser bundle must not import the spec loader (it reads files). The example's
`vite.config.ts` loads the document at build time with `featureModelPlugin` and serves the
`FeatureModel` as `virtual:star-board/model`; `src/model.ts` validates it with
`FeatureModelSchema`. The known issue is recorded in `.claude/state/known-issues.md`.

## 6. Run against msw

No backend is needed to develop. `@star-board/testing/browser` derives one msw handler per
operation from the document (list pages, RFC 7807 problems, ETags and `If-Match`, tombstones,
history, views). The example starts it in `src/msw/browser.ts` and `src/main.tsx`:

```bash
pnpm -F @star-board/example-petstore-ui dev     # http://localhost:5173; msw answers /api
VITE_MSW=0 pnpm -F @star-board/example-petstore-ui dev   # reach a real backend at /api instead
```

The worker script is vendored under `public/generated/` (Vite's `publicDir`). The same handlers
run under `setupServer` in the tests, so dev and test see one contract. Details in
[parity.md](parity.md).

## 7. The drift check

`src/generated/**` is never edited. `star-board check` is the drift check of hexagonal-rules
`shared/02` §1; the root script `pnpm codegen:check` runs it over the example
(`packages/cli` `check:example`).

| Where                    | Today                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm codegen:check`     | `star-board check` over `examples/petstore-ui`; exit 1 on drift; needs the CLI built                                                        |
| `pnpm test`              | `examples/petstore-ui/src/overrides.test.tsx` runs the generator's `check()` over the committed tree and fails on drift                     |
| pre-commit (`.husky`)    | `pnpm lint-staged`, `pnpm typecheck`, `pnpm check:noskip`; `codegen:check` is not in the hook yet                                           |
| CI (`.github/workflows`) | `pnpm check`, `pnpm format:check`, `pnpm build`, `pnpm test:coverage` on Node 22, 24, 26; a direct `codegen:check` job is planned (task 24) |

Prettier ignores `**/src/generated/**` so a reformat cannot create drift. A consuming app adds
`star-board check` to its own pre-commit hook and CI; both read the committed document, never a
live URL (contradiction #10).
