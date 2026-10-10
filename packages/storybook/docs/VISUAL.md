# Visual regression

The `design/visual-regression` skill of hexagonal-rules `typescript/13` §5: screenshot every
component key in every mode and every generated screen state, diff against a baseline, and
require a reason in the commit for a new baseline. This document describes what this package
implements: the matrix (`src/visual/matrix.ts`), the capture and compare scripts (`scripts/`) and
the committed baselines (`visual/baselines/`).

## What is captured

`visualMatrix()` (`src/visual/matrix.ts`) is the one list the job iterates: every generated story
(`src/stories/*.stories.tsx`, one file per contract key, one story per state) × every
colour-scheme mode of the reference tokens (`light`, `dark`, `high-contrast`) × every density
(`default`, `dense`). A cell is `{ storyId, mode, density }`; `storyUrl(cell, base)` gives the
story iframe URL with the two toolbar globals, and `baselinePath(cell)` the baseline file. The
matrix size is a test: stories × 3 × 2.

The screenshot target is the story root, `[data-testid="star-board-story-root"]`, which carries
`data-mode` and `data-density` so the tokens' CSS blocks and MUI's colour schemes apply. Generated
screen states (list, grid, detail, create, edit per schema) join the matrix when the generator's
example app has stories of its own; until then the shell keys cover the chrome and the renderer
states cover the bodies.

## How baselines are captured

1. `pnpm build && pnpm -F @star-board/storybook build-storybook` produces `storybook-static/`.
   The scripts build nothing themselves and fail with this command when the build is missing;
   they also fail when a matrix story is not in the build's `index.json`.
2. `pnpm -F @star-board/storybook visual:capture` (`scripts/capture-baselines.ts`) serves
   `storybook-static/` from a Node `http` server on a free port, launches Chromium through
   `playwright` and, for every cell, opens `storyUrl(cell)`
   (`iframe.html?viewMode=story&id=<storyId>&globals=mode:<mode>;density:<density>`), waits for
   network idle and for the story root `[data-testid="star-board-story-root"]`, checks that the
   root carries the cell's `data-mode` / `data-density`, waits for `document.fonts.ready`, and
   screenshots the root element to `baselinePath(cell)`.
3. Pixels are pinned: viewport 1024×768, device scale factor 1, CSS pixels, `prefers-reduced-motion:
reduce`, `prefers-color-scheme: light` (the mode comes from `data-mode`, never from the system),
   locale `en-US`, time zone UTC, Playwright's `animations: 'disabled'` and `caret: 'hide'`, plus an
   injected `* { transition: none; animation: none }`. Fonts are whatever the capturing machine
   resolves for the tokens' `Inter, system-ui, sans-serif` stack, so baselines are compared on the
   machine family that captured them (see the ratchet).
4. `pnpm -F @star-board/storybook visual:compare` (`scripts/compare-baselines.ts`) re-captures the
   matrix into a temporary directory and compares each file with `visual/baselines/` pixel by
   pixel (`scripts/visual/png.ts` decodes what Chromium writes; anything it cannot decode is
   compared as bytes). It writes `visual/report.json`
   (`{ cells, changed, missing, extra, failed, details }`, git-ignored) and exits 1 on any
   changed, missing or extra baseline. `--update` writes the new captures over the baselines,
   adds the missing ones, deletes the extras and exits 0.

Baselines are PNG files committed next to the stories. A commit that adds or changes a baseline
states why in its message (a token change, a renderer change, a new state); a visual diff with no
reason is a review finding. `src/visual/baselines.test.ts` keeps the directory and the matrix in
step: `baselinePath()` is injective, and every cell has exactly one committed PNG.

## Ratchet

`visual:compare` is not part of `pnpm check` or `pnpm test`, and the CI workflow does not run it
yet. The ratchet is:

1. **Informational (now).** Baselines are committed and `visual:compare` is run by hand (or by a
   CI job with `continue-on-error: true` that uploads `visual/report.json`); the count of changed
   cells is reported, nothing fails on it. The first weeks of baselines settle here while the
   machine family that captures them is fixed.
2. **Strict (later).** Once the changed count has been zero for a release, the job loses
   `continue-on-error` and `visual:compare`'s exit 1 fails the build. The threshold then only
   tightens: a per-cell pixel tolerance may shrink, never grow, and the strict switch is never
   turned back without a recorded reason in `.claude/state/known-issues.md`.

The compare exits 1 on any difference in both stages; only what CI does with that exit changes.

## Local use

```bash
pnpm -F @star-board/storybook storybook           # browse; toolbar switches mode and density
pnpm -F @star-board/storybook generate:stories    # after changing the renderer manifest
pnpm -F @star-board/storybook test                # story coverage, matrix size, decorator render, baselines ↔ matrix
pnpm build && pnpm -F @star-board/storybook build-storybook
pnpm -F @star-board/storybook visual:capture      # (re)write every baseline
pnpm -F @star-board/storybook visual:compare      # diff against the baselines; visual/report.json
pnpm -F @star-board/storybook visual:compare --update   # accept the differences
```
