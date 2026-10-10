import { describe, expect, it } from 'vitest';
import { LAYER, PACKAGE } from './index.js';

describe('generator smoke', () => {
  it('declares its package and layer', () => {
    expect(PACKAGE).toBe('@star-board/generator');
    expect(LAYER).toBe('L4');
  });
});
