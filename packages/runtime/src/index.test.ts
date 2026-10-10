import { describe, expect, it } from 'vitest';
import { LAYER, PACKAGE } from './index.js';

describe('runtime smoke', () => {
  it('declares its package and layer', () => {
    expect(PACKAGE).toBe('@star-board/runtime');
    expect(LAYER).toBe('L2');
  });
});
