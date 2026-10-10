import { describe, expect, it } from 'vitest';
import { LAYER, PACKAGE } from './index.js';

describe('tokens smoke', () => {
  it('declares its package and layer', () => {
    expect(PACKAGE).toBe('@star-board/tokens');
    expect(LAYER).toBe('L1');
  });
});
