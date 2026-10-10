import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { baselinePath, visualMatrix } from './matrix.js';

// jsdom rewrites `import.meta.url` to http, so paths come from `import.meta.dirname`.
const BASELINES_DIR = resolve(import.meta.dirname, '../../visual/baselines');
const CAPTURE =
  'run `pnpm build && pnpm -F @star-board/storybook build-storybook && pnpm -F @star-board/storybook visual:capture`';

function committedBaselines(): string[] {
  if (!existsSync(BASELINES_DIR)) return [];
  return readdirSync(BASELINES_DIR)
    .filter((name) => name.endsWith('.png'))
    .sort();
}

describe('visual baselines', () => {
  const matrix = visualMatrix();

  it('baselinePath() is injective over the matrix and stays under visual/baselines/', () => {
    const paths = matrix.map(baselinePath);
    expect(new Set(paths).size).toBe(matrix.length);
    for (const path of paths) {
      expect(dirname(path)).toBe('visual/baselines');
      expect(basename(path)).toMatch(/^[a-z0-9-]+__[a-z-]+__[a-z-]+\.png$/);
    }
  });

  it('holds exactly one committed PNG per matrix cell', () => {
    const files = committedBaselines();
    expect(files.length, `visual/baselines/ holds no PNG: ${CAPTURE}`).toBeGreaterThan(0);
    const expected = matrix.map((cell) => basename(baselinePath(cell))).sort();
    const missing = expected.filter((name) => !files.includes(name));
    const extra = files.filter((name) => !expected.includes(name));
    expect(missing, `cells without a baseline (${CAPTURE}): ${missing.join(', ')}`).toEqual([]);
    expect(
      extra,
      `baselines without a matrix cell (delete them or run visual:compare --update): ${extra.join(', ')}`,
    ).toEqual([]);
    expect(files).toEqual(expected);
  });
});
