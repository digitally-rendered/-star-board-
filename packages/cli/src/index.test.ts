import { describe, expect, it } from 'vitest';
import { LAYER, PACKAGE } from './index.js';

describe('cli smoke', () => {
  it('declares its package and layer', () => {
    expect(PACKAGE).toBe('@star-board/cli');
    expect(LAYER).toBe('L6');
  });
});
