# Architecture

star-board is a library monorepo with no domain logic. Nine packages sit on seven levels; a
package imports only lower levels. Inside a consuming app the generated code and the overrides
form the React hexagon of hexagonal-rules `typescript/01`.

## Package levels

| Level | Package                    | Role                                                                                                       | May import (workspace)                                    |
| ----- | -------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| L0    | `@star-board/core`         | contract keys, `ComponentRegistry` with scope resolution, `FeatureModel` types and zod schema, errors      | nothing (`zod` is its only dependency; an allowlist test) |
| L1    | `@star-board/spec`         | OpenAPI 3.1 document → validated `FeatureModel`; fails closed on a missing extension                       | core                                                      |
| L1    | `@star-board/tokens`       | DTCG tokens → CSS variables, MUI theme input, Figma variables, contract, Code Connect map                  | core                                                      |
| L2    | `@star-board/runtime`      | React providers, typed client, data hooks (TanStack Query), capability gating, errors, i18n, agent port    | core                                                      |
| L3    | `@star-board/renderer-mui` | one component per contract key, DataGrid, RHF + zod forms, theme from tokens; registers as universal match | core, runtime, tokens                                     |
| L4    | `@star-board/generator`    | `FeatureModel` → `src/generated/**`; pure `generate()`, drift `check()`                                    | core, spec                                                |
| L5    | `@star-board/testing`      | parity suite, msw from the document, fixtures, screen harness with axe, page objects                       | core, spec, runtime, renderer-mui, generator              |
| L5    | `@star-board/storybook`    | stories per key × mode × state; visual matrix                                                              | core, tokens, runtime, renderer-mui                       |
| L6    | `@star-board/cli`          | `star-board generate`, `check`, `init`, `tokens build`, `tokens lint`, `parity`                            | core, spec, tokens, generator, testing                    |
| L6    | `examples/petstore-ui`     | the reference consumer                                                                                     | everything                                                |

Two invariants cut across the levels:

- The core, the spec loader and the generator never import React or a renderer. Generated code
  reaches the renderer only through the registry.
- The generator never writes outside `--out` and never into `--features`.

## The dependency rule and its enforcement

| Check                                             | Command              | What it enforces                                                                                                                                                                                                                                                 |
| ------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint boundaries (`eslint.config.js`)            | `pnpm lint`          | each package is an element; `boundaries/element-types` allows only the lower levels above; `no-restricted-imports` bans `react`, `react-dom`, `@mui/*`, `@emotion/*`, `@tanstack/*`, `openapi-fetch` in core, spec and generator                                 |
| dependency-cruiser (`tools/depcruise.config.cjs`) | `pnpm check:arch`    | the same level table as `<pkg>-imports-only-lower-levels` rules, `no-circular`, and `core-and-generator-no-react-or-renderer` over `node_modules` paths                                                                                                          |
| ratchet (`tools/ratchet.ts`)                      | `pnpm check:ratchet` | counts over `packages/**` never rise above `tools/ratchet-baseline.json` (all zero): `any_escapes`, `handwritten_fetch`, `renderer_import_outside_registry` (`@mui/` outside the renderer), `inline_case_mapping`; `// ratchet-allow: <reason>` excuses one line |
| fitness (`tools/fitness.ts`)                      | `pnpm check:fitness` | layer import rules over `examples/*/src/{generated,features}` by sub-folder (see below)                                                                                                                                                                          |
| no skipped tests (`tools/noskip.ts`)              | `pnpm check:noskip`  | no `.skip`, `.only` or `.todo`                                                                                                                                                                                                                                   |
| waves (`tools/check_waves.ts`)                    | `pnpm check:waves`   | every `.kiro/specs/*/tasks.md` wave JSON is well formed                                                                                                                                                                                                          |
| drift                                             | `pnpm codegen:check` | the example's `src/generated` equals a fresh `generate`                                                                                                                                                                                                          |

`pnpm check` runs lint, typecheck, arch, fitness, waves, ratchet and noskip. CI runs `pnpm check`,
`pnpm format:check`, `pnpm build` and `pnpm test:coverage` on Node 22, 24 and 26.

## The React hexagon inside a consuming app

`typescript/12` §5: generated components are domain components, generated hooks are the
application layer, the generated client is the secondary adapter, the registry is the port between
generator and app. Both trees are classified by sub-folder (contradiction #9).

```
src/
├── generated/                      written by `star-board generate`; never edited
│   ├── domain/                     props-only components: contract.ts, AgentPanelSlot.tsx, <schema>/{types,schemas,columns}.ts, screens
│   ├── application/                container and action hooks over the runtime's shared data hooks
│   ├── adapters/                   paths.ts, client.ts (typed openapi-fetch client)
│   ├── registry.ts, setup.ts       registerGenerated(), createGeneratedRegistry()
│   └── routes.tsx, nav.ts, i18n.*  composition data
└── features/<schema>/              overrides; never touched by the generator
    ├── components/                 domain rules: props only; may use the registry hook; no data hook, no fetch
    ├── hooks/                      application rules: may import generated/application and adapters/client
    └── index.ts                    registry: imports and registry.register(...) calls only
```

| Directory                                      | Layer       | May import                                        | Rule in `tools/fitness.ts`                                                                      |
| ---------------------------------------------- | ----------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `generated/domain`, `features/*/components`    | domain      | domain, renderer, the registry hook               | `domain-no-application`, `domain-no-adapters`, `domain-no-runtime-data-hook`, `domain-no-fetch` |
| `generated/application`, `features/*/hooks`    | application | domain, the runtime data hooks, `adapters/client` | `application-adapters-only-client`                                                              |
| `generated/adapters`                           | adapters    | the runtime client factory                        | —                                                                                               |
| `generated/registry.ts`, `features/*/index.ts` | registry    | everything; it is wiring                          | `override-index-register-only`                                                                  |

`features/` may import `generated/`; `generated/` never imports `features/`. The composition root
(`app.tsx`, `main.tsx`) builds the client, registry, theme and i18n once and puts them in
context. Shared data hooks live in the runtime, not in generated code, so the drift check never
covers them (contradiction #2).

## Three brains

hexagonal-rules [`shared/14`](https://github.com/digitally-rendered/hexagonal-rules/blob/main/shared/14-design-build-operation-brains.md)
separates what the designing team knows (design brain: the plan, the specs, the rules), what the
coding agent knows while building (build brain: this repository, its state files, its checks)
and what the shipped agent knows while running (operation brain: records, permissions, audit).
star-board is build-brain output that produces operation-brain surfaces: the generator and the
Figma MCP server are build tools that never run in production and never see records
([figma.md](figma.md), `docs/design-permissions.json`), while the generated screens and the
agent affordance (`McpAgentPort`, the why and simulate→apply panel, the audit log) are the
operation brain's human surface, speaking to the application MCP that the backend generates
(`shared/13`). The design brain's decisions reach the code only through the document and the
tokens; the contradiction log below is where a disagreement between them is recorded rather than
patched.

## Contradictions resolved

`.kiro/specs/CONTRADICTIONS.md` records where the rules, the existing frontends and the backends'
current output disagree, and what star-board adopted. Twelve rows, none open.

| #   | Disagreement                                              | Resolution                                                                                                                                                       |
| --- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | two generator inputs (schema files + live OpenAPI) vs one | one document, built by a file-only step in the backend repo and committed as `openapi.json`; the loader never imports the app                                    |
| 2   | data hooks generated vs shared                            | shared hooks in `@star-board/runtime`; the generator emits thin typed action hooks; the drift check never covers the shared hooks                                |
| 3   | screens Tier 3 (hand-written) vs generated defaults       | a generated default screen is Tier 1/2 output; a registered override is Tier 3                                                                                   |
| 4   | scope axes `{version, channel}` vs `{version, role}`      | same algorithm and scores; role occupies the channel slot; the property test is shared                                                                           |
| 5   | 403-or-404 posture per project vs pinned 403              | read `info.x-ownership-posture`; default `404`; capability tags drive hiding                                                                                     |
| 6   | one UI library vs swappable renderer                      | MUI default behind the registry; another renderer is a per-app Class B override, never per component                                                             |
| 7   | required emission vs backends today                       | loader fails closed with the extension name; `fixtures/petstore.json` is hand-authored; [backend-conformance.md](backend-conformance.md) is owed to each backend |
| 8   | MUI X DataGrid community vs Pro                           | community grid; Pro behind a renderer option; TanStack Table under MUI table primitives as the documented fallback                                               |
| 9   | `generated/` and `features/` absent from the fitness map  | classified by sub-folder in `tools/fitness.ts`                                                                                                                   |
| 10  | pre-commit safety vs reading `/openapi.json`              | the CLI accepts a path or URL; pre-commit and CI use the committed path                                                                                          |
| 11  | zod 4 vs backend validators                               | agreement is a fast-check property over generated payloads; divergences are schema facts, never client-side patches                                              |
| 12  | help text source                                          | `x-*-reason` and field titles are the defaults for help text and i18n keys; translations override by key                                                         |
