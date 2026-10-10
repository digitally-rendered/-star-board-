/**
 * Re-captures the visual matrix into a temporary directory and compares it pixel by pixel with
 * `visual/baselines/`. Writes `visual/report.json` (`{ cells, changed, missing, extra, details }`)
 * and exits 1 on any difference; with `--update` it writes the new captures over the baselines
 * (adding missing ones, deleting extras) and exits 0. Run with
 * `pnpm -F @star-board/storybook visual:compare [--update]`. See docs/VISUAL.md for the ratchet.
 */
import {
  copyFileSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import {
  BASELINES_DIR,
  baselineFile,
  captureCells,
  cellsToCapture,
  PACKAGE_ROOT,
  REPORT_PATH,
} from './visual/capture.ts';
import { comparePng, type PngComparison } from './visual/png.ts';

interface Report {
  readonly cells: number;
  readonly changed: readonly string[];
  readonly missing: readonly string[];
  readonly extra: readonly string[];
  readonly failed: readonly string[];
  readonly details: Readonly<Record<string, PngComparison>>;
}

const update = process.argv.includes('--update');
const cells = cellsToCapture();
const tmp = mkdtempSync(join(tmpdir(), 'star-board-visual-'));

try {
  console.log(`capturing ${cells.length} cells into ${tmp}`);
  const capture = await captureCells({ cells, outDir: tmp });
  const failed = capture.failed.map((f) => f.file);
  for (const f of capture.failed) console.error(`FAILED ${f.file}: ${f.error}`);

  const expected = new Set(cells.map(baselineFile));
  const present = new Set(readdirSync(BASELINES_DIR).filter((name) => name.endsWith('.png')));
  const extra = [...present].filter((name) => !expected.has(name)).sort();
  const missing: string[] = [];
  const changed: string[] = [];
  const details: Record<string, PngComparison> = {};

  for (const file of capture.captured) {
    if (!present.has(file)) {
      missing.push(file);
      continue;
    }
    const result = comparePng(
      readFileSync(join(BASELINES_DIR, file)),
      readFileSync(join(tmp, file)),
    );
    if (result.kind !== 'identical') {
      changed.push(file);
      details[file] = result;
    }
  }

  const report: Report = { cells: cells.length, changed, missing, extra, failed, details };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');

  const where = relative(PACKAGE_ROOT, BASELINES_DIR);
  console.log(
    `${cells.length} cells: ${changed.length} changed, ${missing.length} missing, ${extra.length} extra, ${failed.length} failed (report: ${relative(PACKAGE_ROOT, REPORT_PATH)})`,
  );
  for (const file of changed) {
    const d = details[file];
    const why =
      d?.kind === 'pixels'
        ? `${d.differing} of ${d.total} pixels`
        : d?.kind === 'size'
          ? `size ${d.expected.join('x')} -> ${d.actual.join('x')}`
          : d?.kind === 'bytes'
            ? `bytes (${d.reason})`
            : 'differs';
    console.log(`  changed ${file}: ${why}`);
  }
  for (const file of missing) console.log(`  missing ${file}`);
  for (const file of extra) console.log(`  extra   ${file}`);

  if (update) {
    for (const file of [...changed, ...missing])
      copyFileSync(join(tmp, file), join(BASELINES_DIR, file));
    for (const file of extra) rmSync(join(BASELINES_DIR, file));
    console.log(
      `updated ${where}/: ${changed.length} replaced, ${missing.length} added, ${extra.length} removed`,
    );
  }
  const differences = changed.length + missing.length + extra.length;
  if (failed.length > 0 || (differences > 0 && !update)) process.exitCode = 1;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
