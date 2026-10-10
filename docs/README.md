# Docs

star-board generates the human surface of an OpenAPI 3.1 document: types, zod validators, a
typed client, action hooks, default screens, routes, navigation and the agent affordance, with a
component registry for every hand-written override.

## Guides

| Document                                           | One line                                                                                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [getting-started.md](getting-started.md)           | prerequisites, install, a conforming document, `init` → `generate` → `check`, wiring `main.tsx`, msw, the drift check       |
| [overrides.md](overrides.md)                       | the registry and specificity, the granularity ladder, the registry API, the three worked examples, fitness rules            |
| [tokens.md](tokens.md)                             | the DTCG file, semantic over primitive, modes and density, `tokens build` and `tokens lint`, what is generated, `ThemeRoot` |
| [parity.md](parity.md)                             | REST, MCP and screens; the report columns and `star-board parity`; the hide/deny matrix; msw from the document              |
| [architecture.md](architecture.md)                 | package levels, the dependency rule and its checks, the React hexagon in a consuming app, three brains, contradictions      |
| [backend-conformance.md](backend-conformance.md)   | the checklist a backend's OpenAPI document must pass (`hexagonal-rules/shared/02` §6a) and the status per backend           |
| [figma.md](figma.md)                               | tokens as the source, Figma variables and Code Connect as generated adapters, the Figma MCP server as a build tool          |
| [design-permissions.json](design-permissions.json) | the Claude Code settings fragment that keeps the Figma MCP server read-only                                                 |

Package-level detail lives in each `packages/*/README.md`; the command table is
[`packages/cli/README.md`](../packages/cli/README.md). The rules this implements are
hexagonal-rules `typescript/12`, `typescript/13`, `shared/13` and `shared/02` §6a.

## Plan status

From `.claude/state/progress.md` and the wave list of the plan (`.kiro/specs/MASTER_SEQUENCING.md`).
Dates are evidence of when a gate passed, not live state.

| Task  | Phase | Deliverable                                                                                                                                                                                  | Status | Evidence                                                                                                                 |
| ----- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| 1–3   | A     | workspace scaffold, steering and specs, tooling green, CONTRADICTIONS.md                                                                                                                     | done   | `pnpm check` on the skeleton; 12 rows, none open                                                                         |
| 4–7   | B1    | core, spec, tokens; checkpoint                                                                                                                                                               | done   | fixture loads, negative fixtures fail closed, tokens build deterministic                                                 |
| 8     | B2    | runtime                                                                                                                                                                                      | done   | 94 tests                                                                                                                 |
| 9–10  | B3    | renderer-mui; every key has a renderer and a story; axe clean                                                                                                                                | done   | 58 tests                                                                                                                 |
| 11–12 | B4    | generator: emitters, default screens, override safety, drift                                                                                                                                 | done   | 49 tests; golden snapshots                                                                                               |
| 13–14 | B5    | cli, example app; boots from `generate` alone                                                                                                                                                | done   | 2026-10-10; Vite build green; the full workflow runs under vitest + jsdom and in Chromium (`test:e2e`, also a CI job)    |
| 15–16 | C     | testing (parity, msw, harness, page objects); agent affordance                                                                                                                               | done   | 36 testing tests; `McpAgentPort`, audit, `AgentPanel`                                                                    |
| 17    | C     | HARD GATE 1: parity across REST, MCP and screens; coverage; a11y; ratchet baseline                                                                                                           | done   | 2026-10-10; 475 tests; coverage 90/81/96/91                                                                              |
| 18    | D     | overrides worked example in `examples/petstore-ui/src/features/pet`                                                                                                                          | done   | `overrides.test.tsx`; `check:fitness`                                                                                    |
| 19    | D     | Figma adapter: variables sync, Code Connect map, design permissions                                                                                                                          | done   | round-trip test; `design-permissions.test.ts`                                                                            |
| 20    | D     | Storybook: stories per key × mode × state, decorator, visual matrix                                                                                                                          | done   | 29 story files; `build-storybook` succeeds; the capture job is task 21                                                   |
| 21    | D     | checkpoint D: visual baselines captured and committed                                                                                                                                        | done   | 342 PNGs under `packages/storybook/visual/baselines/`; `visual:compare` exit 0; informational until the ratchet tightens |
| 22    | E     | `typescript/05` platform rules in generated output (i18n with Intl, unsaved changes, session timeout, compact card lists, installable manifest, embedded shell, host theme, disclaimer slot) | done   | i18n lint over emitted TSX; `session.test.tsx`, `pwa.test.ts`, `i18n.test.tsx`                                           |
| 23    | E     | docs (this set)                                                                                                                                                                              | done   | `docs/*.md`                                                                                                              |
| 24    | E     | HARD GATE 2: CI green on main, publish dry-run                                                                                                                                               | done   | 2026-10-10; `pnpm -r publish --dry-run` lists nine packages                                                              |
| 25    | F     | hexagonal-rules backfill                                                                                                                                                                     | done   | hexagonal-rules `typescript/12` status shipped; `shared/05` Level C; `shared/13` §2a row                                 |
| 26    | F     | checkpoint F: rules lint green, handoff                                                                                                                                                      | done   | `tools/check_rules.py` 0 findings; `.kiro/handoff.json` R1–R4                                                            |

Open issues (spec loader in the browser, `Services.client` typing, unbranded ids, Playwright not
run here, backends not yet emitting the extensions) are in `.claude/state/known-issues.md`.
