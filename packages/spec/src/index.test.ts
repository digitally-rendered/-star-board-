import { describe, expect, it } from 'vitest';
import { LAYER, PACKAGE } from './index.js';

describe('spec smoke', () => {
  it('declares its package and layer', () => {
    expect(PACKAGE).toBe('@star-board/spec');
    expect(LAYER).toBe('L1');
  });
});
