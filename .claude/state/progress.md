# Progress — star-board

**Last updated:** 2026-10-09 — Phase A, scaffold session.

## Session checkpoint

- **Spec:** `00-workspace`
- **Phase:** A
- **Next task:** integration pass: wire examples/petstore-ui from `star-board generate` against the real runtime and renderer, reconcile the generator's AgentPanel slot props with the renderer's, build the renderer-dependent screen harness in testing, run the full-workflow E2E (checkpoint 14, then HARD GATE 1 / task 17).

## What exists

| Date       | Delivered                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Evidence                                    |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 2026-10-10 | Master tasks 9, 11–13 (CLI half), 15 (parity half), 16, 20: renderer-mui (every contract key, theme from tokens, agent panel; 58 tests); generator (plan, emitters, override-safe writes, drift; 49); cli (generate, check, init, tokens, parity placeholder; 25); testing (parity report, msw from document, fixtures, selectors; 36); runtime agent affordance (McpAgentPort, audit, parity; runtime 94); storybook (29 generated story files, decorator with mode and density, visual matrix; 18; `build-storybook` succeeds) | `pnpm check && pnpm test` → 360 tests green |
| 2026-10-09 | Master tasks 3–6, 8: CONTRADICTIONS.md (12 rows, none open); `@star-board/core` (keys, registry with scope resolution, FeatureModel, errors; 13 tests); `@star-board/spec` (loadDocument, $ref inlining, fail-closed extensions; 36 tests); `@star-board/tokens` (DTCG parse, lint, CSS vars, MUI theme input, Figma variables, contract, Code Connect map; 31 tests); `@star-board/runtime` (providers, typed client, data hooks, capability gating, error presentation, i18n; 75 tests)                                        | `pnpm check && pnpm test` → 160 tests green |
| 2026-10-09 | Master tasks 1 and 2: pnpm monorepo scaffold (nine packages, example, tools, CI), steering, 14 spec skeletons with wave JSON, state files, fixture document, reference tokens                                                                                                                                                                                                                                                                                                                                                    | `pnpm check`, `node tools/check_waves.ts`   |

## Do this first next session

Nothing broken.
