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
root (`createTheme(input, { colorSchemeSelector })` changes it); density on `data-density`. An
embedded build (typescript/05 §8) passes the host's variables as `hostTheme`
(`{ '--sb-color-action-primary': 'var(--host-brand)' }`): `withHostTheme` merges them into a
trailing `:root` block, so they win over the tokens in every mode.

## Contracts (`src/contracts.ts`)

The generator emits screens against these prop shapes and resolves the implementation through
`useComponent(key, schema, target)`; an override for a key accepts the same props.

| Keys                                                                      | Props                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `field.text\|select\|datetime\|number\|boolean\|tags\|subform\|reference` | `FieldProps<V>` — `name, label, help?, required?, disabled?, value, onChange, error?` plus `options` (select), `min/max/step` (number), `fields` (subform), `search` (reference)                                                                                                                                             |
| `list.column.<type>` (`string number boolean date-time enum reference`)   | `CellProps { value, row, column }`                                                                                                                                                                                                                                                                                           |
| `screen.list\|grid` at target `table` (`DataGridList`)                    | `ListProps<Row>` — server-side `onPage`, `onSort`, `onFilter`; `cells` by field (registry-resolved renderers); `emptyLabel` renders `state.empty`; `loading` the skeleton; `onRowClick` adds an Open column; `compact?` (default: under the `sm` breakpoint) renders a card list; `testIdPrefix` carries the page-object ids |
| `action.create\|update\|delete\|custom`                                   | `ActionProps { operationId, label, disabled?, destructive?, onClick, confirm?, variant?, testId? }` — `variant` is the emphasis (`create` contained, else outlined), `testId` replaces `action-<operationId>` for cancel and back buttons                                                                                    |
| `state.empty\|loading\|error\|forbidden`                                  | `StateProps { title, description?, action? }`                                                                                                                                                                                                                                                                                |
| `help.inline`                                                             | `HelpProps { text, id }`                                                                                                                                                                                                                                                                                                     |
| `screen.list\|grid\|detail\|create\|edit\|custom`                         | `ScreenShellProps { title, breadcrumbs?, actions?, children, embedded? }`                                                                                                                                                                                                                                                    |

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
`id="main-content"` (the skip-to-content target) and plain-anchor breadcrumbs; with `embedded`
(typescript/05 §8, a panel inside a host page) it is a `section` labelled by its one `h2`, with no
`main` and no id, so the host's landmarks are not duplicated.

## Platform primitives (typescript/05 §6 and §9)

- `SkipToContent { targetId? }`: the skip link, off-canvas until focused, jumping to
  `MAIN_CONTENT_ID`; mount it first in the app frame.
- `UnsavedChangesDialog { open, onStay, onLeave, text? }`: the component half of the unsaved-changes
  primitive (the runtime's `useUnsavedChanges` is the hook half); "keep editing" is the focused
  default. `registerDefaults` registers it at `screen.custom` / target `unsaved-changes`
  (`UNSAVED_CHANGES_TARGET`), so the generated route containers resolve it through the registry and
  an app replaces it per schema at the same coordinates — no new contract key.
- `DataGridList` is registered at `screen.list` and `screen.grid` with target `table`
  (`LIST_BODY_TARGET`), so the generated table screens resolve it through the registry and an app
  replaces the body per schema at the same coordinates. Under the `sm` breakpoint
  (`useCompactLayout()` from the runtime, or `compact`): one outlined card per row with the first
  `COMPACT_CARD_COLUMNS` (3) columns as a `dl`, the row action as a full-width button and a
  `TablePagination`; touch targets take `min-height: var(--sb-density-row)` (44px by default, 32px
  in the dense mode). With `testIdPrefix` (`<schema>-<kind>`) both layouts carry `<prefix>-table`,
  `-row-<id>`, `-open-<id>`, `-sort-<field>`, `-pager` and `-page-previous|current|next`.

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
grid render its rows; the testing harness registers the body with it (`registerHarnessSeams`),
production never sets it.

## Agent panel (`src/agent/AgentPanel.tsx`)

`registerDefaults` makes four registrations beyond the one-per-key defaults, all with schema `'*'`
and source `generated`: `screen.custom` at target `agent-panel` (`AGENT_PANEL_TARGET`) is this
panel, `screen.custom` at `unsaved-changes` (`UNSAVED_CHANGES_TARGET`) the unsaved-changes dialog,
and `screen.list` / `screen.grid` at `table` (`LIST_BODY_TARGET`) the DataGrid body. All are
target-exact, so they never shadow a universal match; the generated `AgentPanelSlot` resolves the
first with `useComponent('screen.custom', schema, 'agent-panel')`, the generated route containers
the second, the generated table screens the last two. `EXTRA_REGISTRATIONS` is that count for the
parity test.

`AgentPanel { operationId, args, ifMatch?, onApplied?, disabled? }` (the generated slot's
`schema`/`values` are accepted; `values` stands in for `args`) renders nothing when
`useAgent().available` is false or the operation has no tool in the capability-filtered list —
the same filter that hides the action. Otherwise a collapsible outlined `Card` (`role="region"`,
`aria-labelledby` its `h2`, `data-testid="agent-panel"`, `data-agent-state`) with Explain
(`why_` rationale and citation links), Simulate (the diff as pretty JSON in a labelled `<pre>`,
warnings, a would-fail notice) and Apply, enabled only after a simulation that `wouldSucceed`
while not `disabled`; Apply calls `apply(operationId, args, ifMatch)` then `onApplied(result)`.
New `args` (by hash) reset the simulation. The last five audit rows (tool, time, kind, outcome)
are listed. Every interactive element is `data-testid="agent-<action>"`
(`toggle explain simulate apply citation-<i>`). Strings are the `agent.*` keys in
`RENDERER_DEFAULT_MESSAGES`.

`AgentPanelView` is the presentational half; `agentPanelStories` (`src/manifest.ts`) lists one
entry per state (`hidden idle explained simulated applied`) with `target: 'agent-panel'`, kept
apart from `stories` so the one-per-key parity holds.
