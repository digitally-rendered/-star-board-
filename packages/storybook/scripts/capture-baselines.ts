/**
 * Writes the visual baselines: one PNG per `visualMatrix()` cell under `visual/baselines/`,
 * screenshot from the built `storybook-static/` (`pnpm build && pnpm -F @star-board/storybook
 * build-storybook` first; this script builds nothing). Run with
 * `pnpm -F @star-board/storybook visual:capture`. See docs/VISUAL.md for the viewport, the
 * freezing of animations and the ratchet.
 */
import { mkdirSync } from 'node:fs';
import { relative } from 'node:path';
import { BASELINES_DIR, captureCells, cellsToCapture, PACKAGE_ROOT } from './visual/capture.ts';

const cells = cellsToCapture();
mkdirSync(BASELINES_DIR, { recursive: true });
console.log(`capturing ${cells.length} cells into ${relative(PACKAGE_ROOT, BASELINES_DIR)}/`);

const result = await captureCells({
  cells,
  outDir: BASELINES_DIR,
  log: (line) => {
    if (line.startsWith('FAILED')) console.error(line);
  },
});

console.log(`captured ${result.captured.length} of ${cells.length} cells`);
if (result.failed.length > 0) {
  console.error(`${result.failed.length} cells failed:`);
  for (const f of result.failed) console.error(`  ${f.file}: ${f.error}`);
  process.exitCode = 1;
}
