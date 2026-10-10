# @star-board/renderer-mui

L3 (React + MUI). One component per contract key (hexagonal-rules `typescript/13` §3), the
DataGrid list/grid body, forms via React Hook Form and zod, and the MUI theme built from the
tokens package. Everything registers as the universal match so any override wins
(`shared/01` §6a). Imports only `@star-board/core`, `@star-board/runtime` and
`@star-board/tokens`; never the generator, the spec loader or the CLI.

## Wiring

```tsx
import { ComponentRegistry } from '@star-board/core';
import {
  buildCssVariables,
  buildMuiThemeInput,
  parseTokens,
  REFERENCE_MODES,
} from '@star-board/tokens';
import { createTheme, registerDefaults, ThemeRoot } from '@star-board/renderer-mui';

const registry = new ComponentRegistry();
registerDefaults(registry); // every key, schema '*', target '*', source 'generated'

const set = parseTokens(tokensJson);
const theme = createTheme(buildMuiThemeInput(set));

<ThemeRoot theme={theme} cssVariables={buildCssVariables(set, REFERENCE_MODES)}>
  <RegistryProvider registry={registry}>…</RegistryProvider>
</ThemeRoot>;
```

`ThemeRoot` writes the tokens' CSS-variable blocks into one `<style>` and mounts MUI's
`ThemeProvider` + `CssBaseline`. Both layers key colour schemes on `data-mode` on the document
root (`createTheme(input, { colorSchemeSelector })` changes it); density on `data-density`.

## Contracts (`src/contracts.ts`)

The generator emits screens against these prop shapes and resolves the implementation through
`useComponent(key, schema, target)`; an override for a key accepts the same props.

| Keys                                                                      | Props                                                                                                                                                                            |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `field.text\|select\|datetime\|number\|boolean\|tags\|subform\|reference` | `FieldProps<V>` — `name, label, help?, required?, disabled?, value, onChange, error?` plus `options` (select), `min/max/step` (number), `fields` (subform), `search` (reference) |
| `list.column.<type>` (`string number boolean date-time enum reference`)   | `CellProps { value, row, column }`                                                                                                                                               |
| `DataGridList` (the default `screen.list` / `screen.grid` body)           | `ListProps<Row>` — server-side `onPage`, `onSort`, `onFilter`; `emptyLabel` renders `state.empty`                                                                                |
| `action.create\|update\|delete\|custom`                                   | `ActionProps { operationId, label, disabled?, destructive?, onClick, confirm? }`                                                                                                 |
| `state.empty\|loading\|error\|forbidden`                                  | `StateProps { title, description?, action? }`                                                                                                                                    |
| `help.inline`                                                             | `HelpProps { text, id }`                                                                                                                                                         |
| `screen.list\|grid\|detail\|create\|edit\|custom`                         | `ScreenShellProps { title, breadcrumbs?, actions?, children }`                                                                                                                   |

Value types per field: `text`/`datetime` (ISO 8601, `''` empty)/`select` → `string`; `number` →
`number | null`; `boolean` → `boolean`; `tags` → `string[]`; `subform` → `Record<string, unknown>`
with `FieldDescriptor[]` naming the nested fields; `reference` → the entity id (`string | null`),
labels resolved through `search`.

Every field renders one MUI control with an `id`, `aria-describedby` on the helper text (the error
replaces the help and is announced with `role="alert"`), the required marker,
`data-testid="field-<name>"`. Actions carry `data-testid="action-<operationId>"`; `delete`,
`destructive` and any `confirm` text go through a MUI `Dialog` (`…-confirm`, `…-cancel`), never
`window.confirm`. States: `empty` is a labelled `region`, `loading` a polite `status`, `error` an
`alert` with retry, `forbidden` a `status`. The screen shell has one `h1`, a `main` landmark with
`id="main-content"` (the skip-to-content target) and plain-anchor breadcrumbs.

`useSchemaForm(zodSchema, defaults)` wraps react-hook-form with the zod resolver and returns
`{ control, handleSubmit, fieldError(name), form }`.

`stories` (`src/manifest.ts`) lists `{ key, component, defaultProps }` for every key so the
storybook package iterates it; `DEFAULT_COMPONENTS` is the same table for the registry.

## Theme

`createTheme` takes `buildMuiThemeInput` output and returns a CSS-variables theme. Every slot the
tokens drive (`primary`, `error`, `background`, including `light`/`dark`/`contrastText`/`paper`)
is a `var(--sb-…)` reference; this package contains no literal colour, and a test greps `src/**`
for `#hex`, `rgb(` and `hsl(`. MUI's own defaults (greys, dividers) stay MUI's.

## Tests

`pnpm -F @star-board/renderer-mui test` — RTL + `axe-core` (via `vitest-axe`) on every
component; parity: every `COMPONENT_KEYS` entry plus `list.column.<LIST_COLUMN_TYPES>` resolves
after `registerDefaults` on a fresh registry and has a manifest entry. jsdom has no layout, so
`DataGridList` exposes `disableVirtualization` as a test-only seam that makes the virtualised
grid render its rows; production never sets it.
