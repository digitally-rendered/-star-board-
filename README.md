# star-board

**Default screens from the spec.** star-board reads the OpenAPI 3.1 document a schema-driven
backend emits ([slip-stream](https://github.com/digitally-rendered/slip-stream),
[stellar-drive](https://github.com/digitally-rendered/stellar-drive),
[Syntact](https://github.com/digitally-rendered/Syntact)) and generates the human surface of
every feature: TypeScript types, zod validators, a typed client, action hooks, list, grid,
detail and form screens, routes, navigation, help text, and the panel where an agent explains
or simulates a change before a person applies it. Hand-written React lives in a component
registry as overrides, resolved by the same specificity scoring the backends use, so a
restyled default is a registration, never a copy.

Status: HARD GATE 1 passed 2026-10-10: `examples/petstore-ui` is generated from
`fixtures/petstore.json` against the real runtime and renderer; parity across REST, MCP and
screens, the hide/deny matrix, three overrides and the full workflow are green (428 tests).
Planned: visual baselines (task 21), platform rules (22), HARD GATE 2 (24), rules backfill (25).
Plan and sequencing in `.kiro/specs/MASTER_SEQUENCING.md`; progress in
`.claude/state/progress.md`. Design authority:
[hexagonal-rules](https://github.com/digitally-rendered/hexagonal-rules) `typescript/12`,
`typescript/13`, `shared/13`.

## Packages

| Package                    | Level | Role                                                                                            |
| -------------------------- | ----- | ----------------------------------------------------------------------------------------------- |
| `@star-board/core`         | L0    | component contract keys, registry with scope resolution, FeatureModel types, errors             |
| `@star-board/spec`         | L1    | OpenAPI document → validated FeatureModel; fails closed on missing extensions                   |
| `@star-board/tokens`       | L1    | design tokens → MUI CSS-variables theme, Figma variables, component contract, Code Connect map  |
| `@star-board/runtime`      | L2    | React providers, typed client, data hooks, capability gating, agent port                        |
| `@star-board/renderer-mui` | L3    | MUI implementation of every contract key; DataGrid; forms                                       |
| `@star-board/generator`    | L4    | FeatureModel → `src/generated/**`; drift check; never touches overrides                         |
| `@star-board/testing`      | L5    | parity suite (REST, MCP, screens), msw from the document, screen harness with axe, page objects |
| `@star-board/storybook`    | L5    | stories per key × mode × state; visual baselines                                                |
| `@star-board/cli`          | L6    | `star-board generate \| check \| init \| tokens build \| tokens lint \| parity`                 |

## What the backend must emit

Every declared `x-*` extension, `x-schema-version`, `x-view` on view operations, operation
ids of the form `<schema>_<operation>` and the capability tags of each operation must be
present in the document (`hexagonal-rules/shared/02` §6a). A document missing any of them
fails generation with the extension's name.

## Documentation

| Document                                                   | Covers                                                                            |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [docs/getting-started.md](docs/getting-started.md)         | install, a conforming document, `init` → `generate` → `check`, wiring, msw, drift |
| [docs/overrides.md](docs/overrides.md)                     | the component registry, specificity, granularity, the worked examples             |
| [docs/tokens.md](docs/tokens.md)                           | design tokens as the theme source; `tokens build` and `tokens lint`; `ThemeRoot`  |
| [docs/parity.md](docs/parity.md)                           | REST, MCP and screens; `star-board parity`; the hide/deny matrix                  |
| [docs/architecture.md](docs/architecture.md)               | package levels, enforcement, the React hexagon, three brains, contradictions      |
| [docs/backend-conformance.md](docs/backend-conformance.md) | what the document must carry, per backend                                         |
| [docs/figma.md](docs/figma.md)                             | Figma as an adapter; the design MCP server as a build tool                        |
| [docs/README.md](docs/README.md)                           | index and plan status                                                             |

## Development

```bash
pnpm install
pnpm check && pnpm test
```

MIT.
