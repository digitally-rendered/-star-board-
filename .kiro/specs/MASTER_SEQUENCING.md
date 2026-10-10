# Master sequencing — star-board

## Purpose

Mirror of the plan's Part 7. Phases ordered by architectural dependency; checkpoints block; HARD GATE 1 after parity, HARD GATE 2 after CI green on main.

## Implementation Status Audit (2026-10-10)

| Area                                                            | Status      | Evidence                                                                                               |
| --------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| workspace, tooling, specs (tasks 1–3)                           | Built       | `pnpm check`; `node tools/check_waves.ts` 14 ✓; `CONTRADICTIONS.md` 12 rows, none open                 |
| core, spec, tokens, runtime (4–8)                               | Built       | `pnpm test` projects unit:core/spec/tokens/runtime                                                     |
| renderer-mui, generator, cli, example (9–14)                    | Built       | example generated from `fixtures/petstore.json`; `pnpm codegen:check` clean; Playwright workflow green |
| testing parity + harness, agent affordance, HARD GATE 1 (15–18) | Built       | parity report, hide/deny matrix, override round trip, 475 tests, coverage 90/81/96/91                  |
| Figma adapter (19)                                              | Built       | round trip exact + property; Code Connect emission                                                     |
| Storybook stories and matrix (20)                               | Built       | 29 story files, `build-storybook` succeeds                                                             |
| visual baseline capture (21)                                    | In progress | `packages/storybook/scripts/capture-baselines.ts` (this session)                                       |
| platform rules (22)                                             | Built       | i18n lint, unsaved changes, session timeout, compact lists, embedded shell, disclaimer                 |
| docs (23)                                                       | Built       | `docs/*.md`                                                                                            |
| HARD GATE 2 (24)                                                | Passed      | CI green on main; `pnpm -r publish --dry-run` lists nine packages                                      |
| rules backfill (25)                                             | Built       | hexagonal-rules commit 9e8e51f                                                                         |
| handoff (26)                                                    | In progress | this audit, `handoff.json`, `.claude/state/progress.md`                                                |

## Dependency Graph and Detailed Sequencing

```json
{
  "waves": [
    { "wave": 1, "tasks": [1], "description": "Phase A — workspace scaffold" },
    { "wave": 2, "tasks": [2], "description": "Phase A — steering, spec skeletons, state files" },
    {
      "wave": 3,
      "tasks": [3],
      "description": "Phase A — tooling green on the skeleton and BLOCKING contradiction analysis (shared/07 A.5)"
    },
    {
      "wave": 4,
      "tasks": [4],
      "description": "Phase B1 — core: contract keys, registry with scope resolution, errors"
    },
    {
      "wave": 5,
      "tasks": [5, 6],
      "description": "Phase B1 — spec loader/FeatureModel and tokens build; disjoint packages, both depend only on core"
    },
    {
      "wave": 6,
      "tasks": [7],
      "description": "Phase B1 checkpoint — fixture document loads, negative fixtures fail closed, tokens emit a theme"
    },
    {
      "wave": 7,
      "tasks": [8],
      "description": "Phase B2 — runtime: providers, typed client, data hooks, capability gating, error presentation"
    },
    {
      "wave": 8,
      "tasks": [9],
      "description": "Phase B3 — renderer-mui: one component per contract key, theme from tokens, stories"
    },
    {
      "wave": 9,
      "tasks": [10],
      "description": "Phase B3 checkpoint — every contract key has a renderer and a story; axe clean"
    },
    {
      "wave": 10,
      "tasks": [11],
      "description": "Phase B4 — generator: plan, emit types/zod/client/hooks, registry, routes"
    },
    {
      "wave": 11,
      "tasks": [12],
      "description": "Phase B4 — generator: default screens and override safety; drift check"
    },
    {
      "wave": 12,
      "tasks": [13],
      "description": "Phase B5 — cli generate|check and examples/petstore-ui wired to a Syntact petstore document"
    },
    {
      "wave": 13,
      "tasks": [14],
      "description": "Phase B5 checkpoint — petstore-ui boots from generate alone; full workflow E2E green with zero overrides"
    },
    {
      "wave": 14,
      "tasks": [15, 16],
      "description": "Phase C — testing package (parity suite, msw from document, screen harness, page objects) and agent affordance (why panel, simulate→apply over an MCP tool list); disjoint packages"
    },
    {
      "wave": 15,
      "tasks": [17],
      "description": "Phase C checkpoint — HARD GATE 1: parity green across REST/MCP/screens on the fixture; coverage; a11y; ratchet baseline committed"
    },
    {
      "wave": 16,
      "tasks": [18, 19, 20],
      "description": "Phase D — overrides worked example in petstore-ui, Figma adapter (variables sync, Code Connect map, design permissions fragment), Storybook visual baselines; disjoint dirs"
    },
    {
      "wave": 17,
      "tasks": [21],
      "description": "Phase D checkpoint — override registered and generator leaves features/ untouched; token round-trip; visual baselines"
    },
    {
      "wave": 18,
      "tasks": [22, 23],
      "description": "Phase E — i18n, mobile/PWA and embedded-shell rules of typescript/05 applied to generated output; docs"
    },
    {
      "wave": 19,
      "tasks": [24],
      "description": "Phase E checkpoint — HARD GATE 2: CI green on main, publish dry-run"
    },
    {
      "wave": 20,
      "tasks": [25],
      "description": "Phase F — rules backfill: typescript/12 and shared/13 status to shipped, README lineage row, shared/02 §1 drift table, typescript/01 tree confirmed"
    },
    {
      "wave": 21,
      "tasks": [26],
      "description": "Phase F checkpoint — rules cross-reference lint green, handoff"
    }
  ]
}
```

### Phase A — Workspace and steering

- [ ] **1. Scaffold the pnpm monorepo**: root `package.json` (scripts `build`, `typecheck`, `lint`, `test`, `test:unit|contract|arch|property|a11y|e2e|visual`, `check:arch|waves|ratchet|noskip`, `codegen:check`, `storybook`), `pnpm-workspace.yaml`, `tsconfig.base.json` + project references, tsdown per package, ESLint 10 flat config with typescript-eslint + boundaries (layers of §2.1 and §2.2), Prettier, Vitest projects, Changesets, husky + lint-staged, `.editorconfig`, `.nvmrc`=26, `CLAUDE.md`, README, `.gitignore`; nine packages with `package.json`, `src/index.ts`, `tsconfig.json`, smoke test; `examples/petstore-ui`, `fixtures/`, `tokens/`, `tools/{check_waves,noskip,ratchet,fitness}.ts`, `depcruise.config.cjs`, `.github/workflows/ci.yml`.
  - _Requirements: WS-1..WS-6 (spec 00-workspace)_
- [ ] **2. Steering, spec skeletons, state files**: `.kiro/steering/{product,tech,structure}.md`, `.kiro/specs/README.md`, `MASTER_SEQUENCING.md`, `handoff.json`, `.claude/state/{progress,known-issues}.md`, and `requirements.md/design.md/tasks.md` for the 14 specs of Part 6 with wave JSON sliced from this graph.
  - _Requirements: WS-7_
- [ ] **3. Tooling green on the skeleton + contradiction analysis (BLOCKING)**: depcruise passes with the level graph; `check_waves` validates every `tasks.md`; ratchet baseline zeros; CI runs. `.kiro/specs/CONTRADICTIONS.md`: where typescript/01, typescript/02, typescript/12, shared/13 and the backends' current OpenAPI output disagree (two-source split vs one document, hooks generated vs shared, screens tier, role vs channel, Pro grid, pre-commit safety) and the resolution adopted (§2.3).
  - _Requirements: WS-8, ENF-1, ENF-2_

### Phase B1 — Core, spec, tokens

- [ ] **4. `@star-board/core`**: `ComponentKey` union and `isComponentKey`; `ComponentRegistry` with `register/resolve/list`, specificity scoring and deterministic order (`shared/01` §6a, role for channel), `DUPLICATE_SPECIFICITY`; `FeatureModel` types + zod schema; `errors/` (`SpecError`, `RegistryError`, `GeneratorError` with codes). Tests: unit; property P1 "resolve is a total stable order"; allowlist test (core depends on `zod` only).
  - _Requirements: CORE-1..CORE-5_
- [ ] **5. `@star-board/spec`**: `loadDocument(src)` → validated `FeatureModel`; reads `components.schemas` Document/Create/Update by naming convention and `x-schema-version`, `x-owner-field`, `x-*-reason`, `x-ui-*`, `x-view` on view operations, operation ids `<schema>_<op>`, capability tags (`x-capabilities` or tags), `x-ownership-posture`; negative fixtures per missing extension. Tests: contract over `fixtures/petstore.json` and `fixtures/negative/*.json`.
  - _Requirements: SPEC-1..SPEC-8_
- [ ] **6. `@star-board/tokens`**: tokens JSON schema (DTCG), semantic-over-primitive lint, modes (light, dark, high-contrast, dense) completeness check; style-dictionary build → `theme.css-vars.json` for MUI `cssVariables: true`, Figma variables JSON, and the component-contract table (`typescript/13` §3) as `contract.json`; Code Connect map generator stub. Tests: schema validation; every semantic token in every mode; build is deterministic.
  - _Requirements: TOK-1..TOK-6_
- [ ] **7. Checkpoint B1**: fixture loads; each negative fixture fails with its extension name; tokens build reproducible twice; `pnpm check` green.

### Phase B2–B5 — Runtime, renderer, generator, CLI, example

- [ ] **8. `@star-board/runtime`**: `RegistryProvider`, `ServicesProvider` (client, auth, notify, optional agent), typed client factory over openapi-fetch with auth interceptor and 401 handling (`typescript/05` §5), data hooks on TanStack Query (`useEntity`, `useEntityList`, `useView`, `useMutation` with optimistic CAS `If-Match`), `useCapability`, error presentation hook (RFC 7807 and envelope), i18n key resolver. Tests: hook tests with msw; interceptor tests; no component reads tokens.
  - _Requirements: RT-1..RT-9_
- [ ] **9. `@star-board/renderer-mui`**: one component per contract key with variants per state; `List`/`Grid` over DataGrid with server-side filter/sort/pagination from the view spec; forms via RHF + zod; theme from tokens (CSS variables); `registerDefaults(registry)`. Stories per key × mode × state. Tests: RTL + vitest-axe per component; `data-testid` presence; theme has no literal colours (lint).
  - _Requirements: RND-1..RND-10_
- [ ] **10. Checkpoint B3**: every `ComponentKey` has a renderer registration and a story; axe clean; `pnpm check` green.
- [ ] **11. `@star-board/generator` part 1**: `plan(model)`; emitters for `types.ts`, `schemas.ts` (zod), `client.ts`, action hooks, `registry.ts`, `routes.tsx`, `nav.ts`, `i18n.defaults.json`; pure `generate()` returning files; golden tests against the fixture; zod ⇄ backend rejection property over generated payloads (fast-check).
  - _Requirements: GEN-1..GEN-7_
- [ ] **12. `@star-board/generator` part 2**: default screens (`screen.list|detail|create|edit`, `<Operation>Screen.generated.tsx` stubs), help text from reasons, capability-gated actions, agent affordance slot; `check()` drift; override safety (never writes outside `out`; `features/` snapshot identical). Tests: render every generated screen with fixture data; axe; drift exits 1; features untouched.
  - _Requirements: GEN-8..GEN-14_
- [ ] **13. `@star-board/cli` + `examples/petstore-ui`**: `star-board generate --document --out --features --renderer`, `check`, `init`; Vite app wired to a Syntact petstore `openapi.json` committed under `fixtures/`; msw dev mode when no backend.
  - _Requirements: CLI-1..CLI-4, EX-1_
- [ ] **14. Checkpoint B5**: petstore-ui boots from `generate` alone; Playwright full workflow (list → create → edit → delete → history) green with zero overrides; `codegen:check` green.

### Phase C — Testing, parity, agent affordance

- [ ] **15. `@star-board/testing`**: parity suite (document ↔ generated ↔ MCP `tools/list` fixture), msw handlers from the document, screen test harness, page objects for generated screens, fixture documents. Tests: parity green on petstore; a mutated fixture (dropped operation) fails parity.
  - _Requirements: TST-1..TST-6_
- [ ] **16. Agent affordance** (`runtime` + `renderer-mui`): `AgentPort` over an MCP client (tools/list, call `why_*`, `simulate_*`, apply), why-panel and simulate→apply flow beside every generated form, audit of agent-proposed changes shown to the user (`shared/13` §4). Tests: with a stub MCP server; capability-filtered tool list equals hidden actions.
  - _Requirements: AGT-1..AGT-5_
- [ ] **17. Checkpoint C — HARD GATE 1**: parity green across REST, MCP and screens; coverage thresholds; a11y suites; ratchet baseline committed.

### Phase D — Overrides, Figma, visual

- [ ] **18. Overrides worked example**: `features/pet/` with a field widget, a column renderer and a whole-screen override at each granularity; generator re-run leaves them; fitness test classifies them.
  - _Requirements: OVR-1..OVR-4_
- [ ] **19. Figma adapter** (`tokens`): variables push/pull through a plugin-compatible JSON, Code Connect map from `contract.json`, `templates/settings-permissions-design.json` equivalent in `docs/`; the design MCP server documented as build-tool only. Tests: round-trip tokens → variables JSON → tokens equal.
  - _Requirements: FIG-1..FIG-5_
- [ ] **20. Storybook visual baselines** (`storybook`): screenshots per key × mode × state and per generated screen state; informational CI job then ratcheted.
  - _Requirements: VIS-1..VIS-3_
- [ ] **21. Checkpoint D**: overrides registered, features untouched, token round-trip, visual baselines committed.

### Phase E — Platform rules and docs

- [ ] **22. typescript/05 rules in generated output**: i18n keys with defaults, mobile breakpoints and PWA shell, embedded-shell theming, regulated-wording slot, session timeout and unsaved-changes primitives from runtime.
  - _Requirements: PLT-1..PLT-6_
- [ ] **23. Docs**: getting started (document → generate → run), override guide, tokens guide, parity guide, backend requirements (`shared/02` §6a) with a conformance checklist per backend.
  - _Requirements: DOC-1..DOC-3_
- [ ] **24. Checkpoint E — HARD GATE 2**: CI green on main; `changeset publish --dry-run`.

### Phase F — Rules backfill

- [ ] **25. hexagonal-rules backfill** (Part 8): `typescript/12` §2a and `shared/13` §2a status to shipped with test paths; README lineage row for star-board; `shared/02` §1 drift table TS frontend cell; `typescript/01` tree confirmed; `typescript/13` cites `tokens` paths; backend conformance checklist linked from `shared/02` §6a.
  - _Requirements: RB-1..RB-4_
- [ ] **26. Checkpoint F**: `python3 -I tools/check_rules.py` green in hexagonal-rules; handoff.

---
