# Visual regression

The `design/visual-regression` skill of hexagonal-rules `typescript/13` §5: screenshot every
component key in every mode and every generated screen state, diff against a baseline, and
require a reason in the commit for a new baseline. This document is the plan this package
implements; the capture job itself is task 21 and lives outside this package.

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
2. The job serves it and, with Playwright (the Storybook test-runner or `@storybook/test` plus
   `@playwright/test`, chosen in task 21), opens `storyUrl(cell)` for every cell, waits for the
   story root, and screenshots it at a fixed viewport, device scale factor 1, animations disabled
   and system fonts pinned in the Playwright browser so pixels are stable across machines.
3. The screenshot is compared with `baselinePath(cell)` under `visual/baselines/`; a missing
   baseline is written and reported as new.

Baselines are PNG files committed next to the stories. A commit that adds or changes a baseline
states why in its message (a token change, a renderer change, a new state); a visual diff with no
reason is a review finding.

## Ratchet

The job starts informational: it uploads the diff images as a CI artifact and reports the number
of cells that differ without failing the build, so the first weeks of baselines settle before they
gate. Once the diff count has been zero for a release, the job is switched to strict
(`VISUAL_STRICT=1`) and any diff fails. The threshold then only tightens: a per-cell pixel
tolerance may shrink, never grow, and the strict switch is never turned back without a recorded
reason in `.claude/state/known-issues.md`.

## Local use

```bash
pnpm -F @star-board/storybook storybook           # browse; toolbar switches mode and density
pnpm -F @star-board/storybook generate:stories    # after changing the renderer manifest
pnpm -F @star-board/storybook test                # story coverage, matrix size, decorator render
```
