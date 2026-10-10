import { REFERENCE_MODES } from '@star-board/tokens';
import { describe, expect, it } from 'vitest';
import { generatedStories } from '../generated-stories.js';
import {
  baselinePath,
  DEFAULT_DENSITY,
  DEFAULT_MODE,
  DENSITIES,
  MODES,
  storyUrl,
  visualMatrix,
} from './matrix.js';

describe('visualMatrix', () => {
  const files = generatedStories();
  const storyCount = files.reduce((n, f) => n + f.stories.length, 0);

  it('spans the reference axes: three modes, two densities', () => {
    expect(MODES).toEqual(['light', 'dark', 'high-contrast']);
    expect(DEFAULT_MODE).toBe('light');
    expect(DENSITIES).toEqual([DEFAULT_DENSITY, 'dense']);
  });

  it('has one cell per story × mode × density, each unique', () => {
    const matrix = visualMatrix();
    expect(matrix.length).toBe(storyCount * 3 * 2);
    expect(matrix.length).toBe(storyCount * REFERENCE_MODES.modes.length * DENSITIES.length);
    const keys = new Set(matrix.map((c) => `${c.storyId}|${c.mode}|${c.density}`));
    expect(keys.size).toBe(matrix.length);
    for (const cell of matrix) {
      expect(MODES).toContain(cell.mode);
      expect(DENSITIES).toContain(cell.density);
    }
  });

  it('orders stories as the manifest does, then modes, then densities', () => {
    const [first, second, third] = visualMatrix();
    expect(first).toEqual({
      storyId: files[0]?.stories[0]?.storyId,
      mode: 'light',
      density: 'default',
    });
    expect(second).toEqual({ ...first, density: 'dense' });
    expect(third).toEqual({ ...first, mode: 'dark' });
  });

  it('honours other mode options', () => {
    const matrix = visualMatrix(files.slice(0, 1), { modes: ['light'] });
    expect(matrix.length).toBe(files[0]?.stories.length);
    expect(matrix.every((c) => c.mode === 'light' && c.density === DEFAULT_DENSITY)).toBe(true);
  });

  it('names baselines and story urls from the cell', () => {
    const cell = { storyId: 'contract-field-text--default', mode: 'dark', density: 'dense' };
    expect(baselinePath(cell)).toBe(
      'visual/baselines/contract-field-text--default__dark__dense.png',
    );
    expect(storyUrl(cell, 'http://localhost:6006')).toBe(
      'http://localhost:6006/iframe.html?viewMode=story&id=contract-field-text--default&globals=mode%3Adark%3Bdensity%3Adense',
    );
  });
});
