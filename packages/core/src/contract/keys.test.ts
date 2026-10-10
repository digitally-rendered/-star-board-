import { describe, expect, it } from 'vitest';
import { COMPONENT_KEYS, fieldKeyFor, isComponentKey } from './keys.js';

describe('component keys', () => {
  it('accepts every fixed key and parameterised list columns', () => {
    for (const k of COMPONENT_KEYS) expect(isComponentKey(k)).toBe(true);
    expect(isComponentKey('list.column.date-time')).toBe(true);
    expect(isComponentKey('field.magic')).toBe(false);
    expect(isComponentKey('list.column.')).toBe(false);
  });
  it('maps JSON Schema fields to keys per typescript/13 §3', () => {
    expect(fieldKeyFor({ type: 'string' })).toBe('field.text');
    expect(fieldKeyFor({ type: 'string', enum: ['a'] })).toBe('field.select');
    expect(fieldKeyFor({ type: 'string', format: 'date-time' })).toBe('field.datetime');
    expect(fieldKeyFor({ type: ['string', 'null'], format: 'date' })).toBe('field.datetime');
    expect(fieldKeyFor({ type: 'integer' })).toBe('field.number');
    expect(fieldKeyFor({ type: 'boolean' })).toBe('field.boolean');
    expect(fieldKeyFor({ type: 'array', items: { type: 'string' } })).toBe('field.tags');
    expect(fieldKeyFor({ type: 'array', items: { type: 'object' } })).toBe('field.subform');
    expect(fieldKeyFor({ $ref: '#/components/schemas/Owner' })).toBe('field.reference');
    expect(fieldKeyFor({ type: 'boolean', 'x-ui-widget': 'select' })).toBe('field.select');
  });
});
