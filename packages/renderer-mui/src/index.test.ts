import { describe, expect, it } from 'vitest';
import { LAYER, PACKAGE } from './index.js';

describe('renderer-mui smoke', () => {
  it('declares its package and layer', () => {
    expect(PACKAGE).toBe('@star-board/renderer-mui');
    expect(LAYER).toBe('L3');
  });
});
