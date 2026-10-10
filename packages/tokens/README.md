# @star-board/tokens

L1. Design tokens are the theme source (hexagonal-rules `typescript/13` §2). This package
reads a DTCG-style token file, resolves aliases, lints the semantic rules and builds, with no
runtime dependency beyond `@star-board/core`, the plain JSON every adapter consumes: the MUI
CSS-variables theme input, Figma variables, the component contract and the Code Connect map.
It never imports React or MUI; the renderer (L3) turns the theme input into a theme.

## Input

The design-tokens community-group format as in `tokens/reference.tokens.json`:

- A node with `$value` is a token; any other object is a group. `$type` is on the token or
  inherited from a group: `color | dimension | fontFamily | number | duration | shadow`.
- A whole value may alias another token: `"{color.primitive.grey.50}"`. Aliases resolve across
  at most `MAX_ALIAS_DEPTH` (8) hops, must match the target's `$type`, and never cycle.
- Per-mode values live under `$extensions["star-board"].modes`; the default mode is `$value`.
- Any path with a `primitive` segment is a primitive. Primitives never alias and are never
  themed; components reference semantic tokens only.

## API

```ts
import { parseTokens, lintTokens, assertClean, build, REFERENCE_MODES } from '@star-board/tokens';

const set = parseTokens(json); // TokenSet; throws TokensError('TOKENS_INVALID')
const findings = lintTokens(set, REFERENCE_MODES); // { path, rule, message }[]
assertClean(findings); // throws TOKENS_INVALID with the findings
const out = build(set, REFERENCE_MODES); // lint + every builder, deterministic
```

| Function                                          | Output                                                                                                                                                                                                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parseTokens(json)`                               | `TokenSet { tokens, paths, modes }`; each `Token` keeps `raw` (as authored) and `value` (resolved), plus `modes` / `resolvedModes`                                                                                                                             |
| `lintTokens(set, { modes, density?, contract? })` | rules `semantic-mode-complete`, `mode-unknown`, `primitive-no-alias`, `primitive-no-modes`, `contract-semantic-only`                                                                                                                                           |
| `buildCssVariables(set, modes)`                   | `{ ':root': { '--sb-color-surface-default': '#fafafa', … }, '[data-mode="dark"]': { … }, '[data-density="dense"]': { … } }` — semantic tokens only; mode blocks hold only what changes                                                                         |
| `buildMuiThemeInput(set)`                         | `{ cssVariables: true, colorSchemes: { light, dark }, shape: { borderRadius }, typography: { fontFamily }, spacing }` with `var(--sb-…)` references and no literal colour; needs `MUI_REQUIRED_TOKENS`                                                         |
| `buildFigmaVariables(set, modes)`                 | `{ collections: [{ name: 'star-board', modes, variables: [{ name: 'color/surface/default', type: 'COLOR', valuesByMode }] }, { name: 'star-board-density', … }] }`; primitives are variables, an authored alias becomes `{ alias: 'color/primitive/grey/50' }` |
| `buildContract()`                                 | `typescript/13` §3 as rows `{ key, figmaComponent, renderer: 'default', tokens }` for every `COMPONENT_KEYS` entry plus `list.column.<type>` over `LIST_COLUMN_TYPES`                                                                                          |
| `buildCodeConnectMap(contract)`                   | `{ [figmaComponent]: { key, props: { label: { figma: 'Label', kind: 'string' }, … } } }` for the Code Connect generator                                                                                                                                        |
| `build(set, modes)`                               | `{ version: BUILD_VERSION, cssVariables, muiTheme, figmaVariables, contract, codeConnect }`                                                                                                                                                                    |

## Modes

`ModeOptions` has two axes because a Figma collection has one: `modes` are colour-scheme modes
whose first entry is the default (`light`) and which every semantic colour token must cover;
`density` modes (`dense`) are opt-in for dimension tokens. The CSS output selects them with
`data-mode` and `data-density` on the document root, which compose. MUI's `colorSchemes` only
knows `light` and `dark`; other colour modes are CSS-only and switch the same variables.

## Figma adapter

`src/figma/` is the design-tool side of the hexagon (`typescript/13` §1 and §4; `docs/figma.md`
explains the flow). It is plain TypeScript over JSON: no Figma SDK, no `@figma/code-connect`
dependency.

| Export                                                         | Role                                                                                                                                                                                                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TokenSourcePort`, `DesignFilePort`, `CodeMappingPort`         | the ports; `FigmaVariablesDocument` is the `buildFigmaVariables` output                                                                                                                                          |
| `JsonFileTokenSource(path)`, `InMemoryTokenSource`             | `TokenSourcePort` over the plugin-compatible JSON file (pull validates with `parseFigmaVariables`, fail closed) and in memory for tests                                                                          |
| `figmaVariablesToTokens(doc, { types? })`                      | the inverse of `buildFigmaVariables`: collections back into DTCG tokens with `$extensions['star-board'].modes` and `{alias}` entries restored to `{path}` references; `figmaVariablesToTokenJson` gives the JSON |
| `syncTokens({ tokens, source, direction, modes })`             | push: lint, build, `source.push`; pull: `source.pull` → tokens → lint (fail closed, `TOKENS_INVALID` with findings) → `{ tokens, findings, changed }`; never writes the local file                               |
| `emitCodeConnect(contract, { rendererPackage, figmaFileUrl })` | `{ path: 'codeconnect/<key>.figma.tsx', contents }[]` in the shape `@figma/code-connect` React consumes, one per contract key, importing `componentName` from the renderer package                               |
| `emitCodeConnectConfig()`                                      | `figma.config.json` text: React parser over `codeconnect/**`                                                                                                                                                     |

### Round-trip exclusions

`figmaVariablesToTokens(buildFigmaVariables(set))` deep-equals `set` for the reference tokens
and for generated sets (property test). The variables document carries less than DTCG does, so
these are excluded by design:

- `$description` and other DTCG metadata: no field in the document.
- The DTCG `$type` behind a Figma type: `FLOAT` returns as `dimension` in `px` and `STRING` as
  `fontFamily` (or `shadow` when the text parses as one) unless `types` names the path.
  `syncTokens` passes the local set's types, so `number` and `duration` survive a pull;
  `rem` dimensions come back in `px`.
- A single-entry `fontFamily` array returns as a plain string (both serialise the same).
- A non-colour semantic token whose mode value equals its default loses that redundant entry.
  Semantic colour tokens keep every mode because the lint requires them.
- A token themed on both axes (colour scheme and density) lives in the density collection only,
  so its colour-scheme modes are not carried.

## Checks

Tests (`pnpm -F @star-board/tokens test`) parse the reference set, cover alias resolution
(chain, cycle, depth, unknown target, type mismatch), each lint rule, determinism of `build`,
the no-literal-colour rule on the MUI theme, every mode on the Figma variables, a contract
row with a component name for every component key, the Figma round trip (reference exact and a
fast-check property), `syncTokens` in both directions with fail-closed pulls, the Code Connect
emission (one file per key, a snapshot) and the read-only rule on `docs/design-permissions.json`. `BUILD_VERSION` is part of the output so `codegen:check` catches a
builder change as drift even when the tokens did not move.
