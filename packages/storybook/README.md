# @star-board/storybook

L5. Stories for every contract key in every mode and state, and the visual regression plan
(hexagonal-rules `typescript/13` §5, `design/map-components` and `design/visual-regression`).
Imports `@star-board/core`, `@star-board/tokens`, `@star-board/runtime` and
`@star-board/renderer-mui`; nothing above L3.

## Stories

The renderer's `stories` manifest (`{ key, component, defaultProps }` per contract key) is the one
source. `src/generated-stories.ts` turns it into CSF3 story files, one per key under
`src/stories/<key>.stories.tsx`, with one story per state:

| Keys                         | Stories                              |
| ---------------------------- | ------------------------------------ |
| `field.*`                    | `Default`, `WithError`, `Disabled`   |
| `action.*`                   | `Default`, `Disabled`, `Destructive` |
| `screen.list`, `screen.grid` | `Default`, `Loading`, `Empty`        |
| everything else              | `Default`                            |

ESM exports are static, so the stories are generated files rather than a loop: run
`pnpm -F @star-board/storybook generate:stories` (Node over the built workspace) or
`pnpm -F @star-board/storybook test -u` (no build needed) after changing the manifest. The
committed files are file snapshots; `pnpm test` fails when they drift from the manifest, when a
key in `COMPONENT_KEYS` or `list.column.<type>` has no story, or when a story file exists for a key
the manifest no longer lists. Each generated file imports its component by name from the renderer
and calls `storyArgs(key, state)` at runtime, so props that are functions or elements are never
serialised.

Story ids follow Storybook's rule (`storyId(title, exportName)`), e.g.
`contract-field-text--with-error`; `visualMatrix()` relies on them.

## Preview

`.storybook/preview.tsx` installs `withStarBoard` (`src/preview/withStarBoard.tsx`) as the global
decorator: every story renders inside the renderer's `ThemeRoot` (theme and CSS variables built
from `tokens/reference.tokens.json` through `parseTokens` → `buildMuiThemeInput` /
`buildCssVariables` → `createTheme`), a `RegistryProvider` over a fresh registry with
`registerDefaults`, and an `I18nProvider` with the runtime and renderer default messages. The
toolbar globals `mode` (`light`, `dark`, `high-contrast`) and `density` (`default`, `dense`) become
`data-mode` / `data-density` on the story root and on the document root, so the token CSS blocks
and MUI's colour schemes apply.

`.storybook/main.ts` uses `@storybook/react-vite` with `@storybook/addon-a11y` and adds the
`star-board-source` resolve condition so `storybook dev` tracks the workspace sources without a
prior build.

## Visual regression

`src/visual/matrix.ts` exports `visualMatrix()`: every story × mode × density as
`{ storyId, mode, density }`, plus `storyUrl` and `baselinePath`
(`visual/baselines/<storyId>__<mode>__<density>.png`). `scripts/capture-baselines.ts` screenshots
every cell of a built `storybook-static/` with Playwright's Chromium into `visual/baselines/`;
`scripts/compare-baselines.ts` re-captures into a temporary directory, compares pixel by pixel
(`scripts/visual/png.ts`, a dependency-free PNG reader) and writes `visual/report.json`. The
baselines are committed; `src/visual/baselines.test.ts` fails when a cell has no baseline or a
baseline has no cell. `docs/VISUAL.md` has the capture settings and the ratchet from informational
to strict.

## Commands

```bash
pnpm -F @star-board/storybook storybook         # storybook dev -p 6006
pnpm -F @star-board/storybook build-storybook   # storybook-static/
pnpm -F @star-board/storybook generate:stories  # regenerate src/stories from the manifest
pnpm -F @star-board/storybook test              # vitest, jsdom
pnpm -F @star-board/storybook visual:capture    # storybook-static/ → visual/baselines/*.png
pnpm -F @star-board/storybook visual:compare    # re-capture, diff, visual/report.json; exit 1 on a difference
pnpm -F @star-board/storybook visual:compare --update   # accept the differences as the new baselines
```

`visual:capture` and `visual:compare` need `pnpm build` (the matrix is read from this package's
`dist`) and `pnpm -F @star-board/storybook build-storybook`; they build nothing themselves and
fail with the command to run when `storybook-static/` is missing.

`types/storybook.d.ts` declares the subset of the Storybook 10 API this package touches, so type
checking passes before the Storybook packages are installed; TypeScript ignores it once the real
packages resolve. Delete it after the first `pnpm install` that links them.
