# star-board — agent guidance

The generated frontend track of the hexagon described in `~/development/hexagonal-rules`
(`typescript/12`, `typescript/13`, `shared/13`, `shared/02` §6a). star-board consumes the
OpenAPI 3.1 document that `slip-stream` (Python), `stellar-drive` (Go) and `Syntact`
(TypeScript) emit from one JSON Schema and generates the human surface: types, zod validators,
a typed client, action hooks, default list, grid, detail and form screens, routes, navigation
and the agent affordance, with a component registry whose specificity-scored overrides hold
every hand-written React screen. This is a **library monorepo**: no domain logic, stays generic.

## Critical

- Always `pnpm`. Node ≥ 22 (develop on 26). ESM only, TypeScript strict.
- **One input: the OpenAPI document.** The spec loader never reads schema files or backend
  source and fails closed on a missing extension (`x-view`, `x-ui-*`, operation ids,
  capability tags, `x-schema-version`).
- **The core and the generator never import React or a renderer.** Generated code reaches the
  renderer only through the component registry. Enforced by ESLint boundaries,
  `pnpm check:arch` (dependency-cruiser) and the ratchet.
- **The generator never writes outside its output directory.** `src/features/<schema>/` is the
  override home and is never touched; a snapshot test proves it.
- **Overrides go through the registry** with the backend's specificity scoring
  (`shared/01` §6a, role in place of channel). Duplicate registration at equal specificity
  is a build error.
- **Tokens are the theme source.** The MUI theme and Figma variables are generated; a hand
  edit fails `codegen:check`.
- Never skip, `.only`, or `.todo` a test (`pnpm check:noskip`).
- One authority per vocabulary: component keys, scope scoring, error codes, operation ids.
- `~/development/hexagonal-rules` is written only in the rules backfill task; the backend
  frameworks are read-only.

## Layer map and build levels

```
L0  packages/core           contract keys, registry + scope resolution, FeatureModel types, errors (zod only)
L1  packages/spec           OpenAPI document → FeatureModel
L1  packages/tokens         DTCG tokens → MUI CSS-variables theme, Figma variables, contract.json, Code Connect map
L2  packages/runtime        React: providers, typed client, data hooks (TanStack Query), capability gating, agent port
L3  packages/renderer-mui   one component per contract key; DataGrid; RHF + zod; registers as universal match
L4  packages/generator      FeatureModel → src/generated/** (pure generate(), check())
L5  packages/testing        parity suite, msw from document, screen harness + axe, page objects, fixtures
L5  packages/storybook      stories per key × mode × state, visual baselines
L6  packages/cli, examples/petstore-ui
```

A package imports only lower levels. `pnpm check:arch` verifies.

## Inside a consuming app

```
src/generated/{domain,application,adapters,registry.ts,routes.tsx,nav.ts}   written by `star-board generate`; never edited
src/features/<schema>/{components,hooks,index.ts}                           overrides; index.ts holds registerComponent calls only
```

`generated/*` and `features/<schema>/*` are classified by sub-folder; the React hexagon rules
of `typescript/01` apply to both.

## Commands

```bash
pnpm install && pnpm build
pnpm typecheck && pnpm lint
pnpm test | test:unit | test:contract | test:arch | test:property | test:a11y
pnpm check                      # lint, typecheck, arch, waves, ratchet, noskip
pnpm codegen:check              # regenerate the example and diff
node tools/check_waves.ts       # every .kiro/specs/*/tasks.md
```

## Spec system

`.kiro/steering/` then one spec per subsystem in `.kiro/specs/` (EARS `requirements.md` where
every story names its document input or contract key, `design.md`, `tasks.md` with wave JSON).
`MASTER_SEQUENCING.md` mirrors the plan. Update `.claude/state/progress.md` and
`known-issues.md` at every checkpoint; append a dead end to known issues immediately.
