import { describe, expect, it } from 'vitest';
import { etagOf } from './etag.js';

describe('etagOf', () => {
  it('builds the weak ETag from a raw document', () => {
    expect(etagOf({ entity_id: 'abc', record_version: 3 })).toBe('W/"abc:3"');
  });
  it('accepts the camelCase mapping too', () => {
    expect(etagOf({ entityId: 'abc', recordVersion: 1 })).toBe('W/"abc:1"');
  });
  it('fails closed on a document without a version', () => {
    expect(() => etagOf({ entity_id: 'abc' })).toThrow(TypeError);
  });
});
