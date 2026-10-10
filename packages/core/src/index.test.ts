import { describe, expect, it } from 'vitest';
import { LAYER, PACKAGE } from './index.js';

describe('core smoke', () => {
  it('declares its package and layer', () => {
    expect(PACKAGE).toBe('@star-board/core');
    expect(LAYER).toBe('L0');
  });
});
