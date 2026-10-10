import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadDocument } from './index.js';

const minimal = {
  openapi: '3.1.0',
  info: { title: 't', version: '1' },
  paths: {},
  components: { schemas: {} },
};

describe('loadDocument without node built-ins', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it('loads a parsed object when process.getBuiltinModule is absent', () => {
    vi.stubGlobal('process', { ...process, getBuiltinModule: undefined });
    expect(loadDocument(minimal).title).toBe('t');
  });
  it('explains that a path needs Node when the built-in loader is absent', () => {
    vi.stubGlobal('process', { ...process, getBuiltinModule: undefined });
    expect(() => loadDocument('/tmp/nowhere.json')).toThrow(/needs Node/);
  });
  it('rejects a non-file URL', () => {
    expect(() => loadDocument(new URL('https://example.test/openapi.json'))).toThrow(
      /Only file: URLs/,
    );
  });
});
