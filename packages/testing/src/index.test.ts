import { describe, expect, it } from 'vitest';
import {
  FIXTURES_URL,
  LAYER,
  PACKAGE,
  handlersFromModel,
  loadFixtureModel,
  parityReport,
  selectors,
} from './index.js';

describe('testing smoke', () => {
  it('declares its package and layer', () => {
    expect(PACKAGE).toBe('@star-board/testing');
    expect(LAYER).toBe('L5');
  });

  it('exports the renderer-independent surface', () => {
    expect(typeof parityReport).toBe('function');
    expect(typeof handlersFromModel).toBe('function');
    expect(typeof selectors).toBe('function');
    expect(FIXTURES_URL.pathname.endsWith('/fixtures/')).toBe(true);
  });

  it('loads the petstore fixture through the spec loader', () => {
    const model = loadFixtureModel();
    expect(model.title).toBe('petstore');
    expect(Object.keys(model.schemas)).toEqual(['pet']);
    expect(() => loadFixtureModel('does-not-exist')).toThrow();
  });
});
