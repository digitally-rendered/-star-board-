import { describe, expect, it } from 'vitest';
import { LAYER, PACKAGE } from './index.js';

describe('storybook smoke', () => {
  it('declares its package and layer', () => {
    expect(PACKAGE).toBe('@star-board/storybook');
    expect(LAYER).toBe('L5');
  });
});
