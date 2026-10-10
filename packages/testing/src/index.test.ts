import { describe, expect, it } from 'vitest';
import { LAYER, PACKAGE } from './index.js';

describe('testing smoke', () => {
  it('declares its package and layer', () => {
    expect(PACKAGE).toBe('@star-board/testing');
    expect(LAYER).toBe('L5');
  });
});
