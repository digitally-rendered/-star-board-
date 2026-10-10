# Tokens

Design tokens are the theme source (hexagonal-rules `typescript/13` §2). The MUI theme, the CSS
variables and the Figma variables are generated from them. Nobody edits a theme by hand; a hand
edit is drift.

## The DTCG file

The reference set is `tokens/reference.tokens.json`, in the design-tokens community-group
format:

| Element     | Form                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| token       | a node with `$value`; `$type` on the token or inherited from its group                                                          |
| types       | `color`, `dimension`, `fontFamily`, `number`, `duration`, `shadow`                                                              |
| alias       | a whole value referencing another token: `"{color.primitive.grey.50}"`; at most 8 hops; same `$type`; no cycles                 |
| mode values | `$extensions["star-board"].modes`: `{ "dark": …, "high-contrast": … }`; `$value` is the default (light) mode                    |
| primitive   | any path with a `primitive` segment: `color.primitive.blue.500`                                                                 |
| semantic    | everything else: `color.surface.default`, `color.text.danger`, `color.action.primary`, `space.1`, `radius.control`, `font.body` |

A minimal semantic colour:

```json
{
  "color": {
    "surface": {
      "default": {
        "$type": "color",
        "$value": "{color.primitive.grey.50}",
        "$extensions": {
          "star-board": {
            "modes": { "dark": "{color.primitive.grey.900}", "high-contrast": "#ffffff" }
          }
        }
      }
    }
  }
}
```

## Semantic over primitive

Components reference semantic tokens only. Primitives are the palette; they never alias and are
never themed. The lint (`lintTokens`) enforces it:

| Rule                     | Fails when                                                              |
| ------------------------ | ----------------------------------------------------------------------- |
| `semantic-mode-complete` | a semantic colour token lacks a value in a requested colour-scheme mode |
| `mode-unknown`           | a token names a mode that is not requested                              |
| `primitive-no-alias`     | a primitive's value is an alias                                         |
| `primitive-no-modes`     | a primitive carries mode values                                         |
| `contract-semantic-only` | a contract row lists a primitive token                                  |

## Modes and density

`ModeOptions` has two axes because a Figma collection has one:

| Axis      | Reference modes                            | Applies to                  | Selected in CSS by                  |
| --------- | ------------------------------------------ | --------------------------- | ----------------------------------- |
| `modes`   | `light` (default), `dark`, `high-contrast` | every semantic colour token | `data-mode` on the document root    |
| `density` | `dense` (opt-in)                           | dimension tokens            | `data-density` on the document root |

`REFERENCE_MODES` in `@star-board/tokens` holds these. The two attributes compose. MUI's
`colorSchemes` knows `light` and `dark`; `high-contrast` is CSS-only and switches the same
variables.

## `star-board tokens build | lint`

```bash
star-board tokens lint  --tokens tokens/reference.tokens.json
star-board tokens build --tokens tokens/reference.tokens.json --out src/theme
star-board tokens build --tokens tokens/reference.tokens.json --json       # whole build on stdout
```

| Command        | Options                                           | Does                                                            | Exit                |
| -------------- | ------------------------------------------------- | --------------------------------------------------------------- | ------------------- |
| `tokens lint`  | `--tokens <file> [--modes a,b,c] [--density a,b]` | prints every finding as `rule path: message`                    | 0 clean, 1 findings |
| `tokens build` | the same plus `[--out <dir>]`                     | `parseTokens` → lint → `build`; writes five files under `--out` | 0, 1 lint findings  |

Flags win over the `tokens` block of `star-board.config.json` (`file`, `out`, `modes`,
`density`), which wins over the reference modes. Naming `--modes` without `--density` clears the
density axis. `tokens sync` and `map-components` (the Figma push/pull and Code Connect writers of
`typescript/13` §5) are not CLI commands yet; the functions exist in the package
(`syncTokens`, `emitCodeConnect`). See [figma.md](figma.md).

## What is generated

`build(set, modes)` is deterministic and returns one object; `tokens build` writes each member
to a file:

| File                   | Builder               | Content                                                                                                                                                                       | Consumer                       |
| ---------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `theme.css-vars.json`  | `buildCssVariables`   | `{ ':root': { '--sb-color-surface-default': '#fafafa', … }, '[data-mode="dark"]': …, '[data-density="dense"]': … }`; semantic tokens only; mode blocks hold only what changes | `ThemeRoot`                    |
| `mui-theme.json`       | `buildMuiThemeInput`  | `{ cssVariables: true, colorSchemes: { light, dark }, shape, typography, spacing }` with `var(--sb-…)` references and no literal colour                                       | `createTheme` in the renderer  |
| `figma-variables.json` | `buildFigmaVariables` | collections `star-board` (colour modes) and `star-board-density`; primitives are variables; an authored alias becomes `{ alias }`                                             | the Figma plugin import        |
| `contract.json`        | `buildContract`       | `typescript/13` §3 as rows `{ key, figmaComponent, renderer, tokens }` for every `COMPONENT_KEYS` entry and `list.column.<type>`                                              | the parity audit, Code Connect |
| `code-connect.json`    | `buildCodeConnectMap` | `{ [figmaComponent]: { key, props } }`                                                                                                                                        | `emitCodeConnect`              |

`BUILD_VERSION` is part of the output, so a builder change shows up as drift even when no token
moved. The MUI builder needs these semantic tokens (`MUI_REQUIRED_TOKENS`): `color.action.primary`,
`color.text.danger`, `color.surface.default`, `radius.control`, `font.body`, `space.1`.

## ThemeRoot

The renderer turns the two JSON outputs into a theme at the composition root. The example does
it in `src/app.tsx` (`createAppTheme`):

```tsx
import {
  buildCssVariables,
  buildMuiThemeInput,
  parseTokens,
  REFERENCE_MODES,
} from '@star-board/tokens';
import { createTheme, ThemeRoot } from '@star-board/renderer-mui';
import referenceTokens from '../../../tokens/reference.tokens.json' with { type: 'json' };

const set = parseTokens(referenceTokens);
const theme = createTheme(buildMuiThemeInput(set));
const cssVariables = buildCssVariables(set, REFERENCE_MODES);

<ThemeRoot theme={theme} cssVariables={cssVariables}>
  …
</ThemeRoot>;
```

`ThemeRoot` writes the CSS-variable blocks into one `<style>` and mounts MUI's `ThemeProvider`
and `CssBaseline`. Set `data-mode="dark"` or `data-density="dense"` on `<html>` to switch; the
Storybook toolbar does the same for every story.

## No literal colours

| Where                         | Check                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| `@star-board/tokens`          | a test asserts the MUI theme input references CSS variables and never a literal colour          |
| `@star-board/renderer-mui`    | every token-driven slot is a `var(--sb-…)`; a test greps `src/**` for `#hex`, `rgb(` and `hsl(` |
| overrides                     | colours come from the theme palette (`StatusChip` uses `color="success"`), never a literal      |
| generated theme and variables | `codegen:check` fails on a hand edit, as for any generated file                                 |

MUI's own defaults (greys, dividers) stay MUI's. A design that needs a new colour adds a semantic
token with every mode, not a hex value in a component. The design-tool side of this hexagon is in
[figma.md](figma.md).
