import type { JsonSchema } from '@star-board/core';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { loadFixtureModel } from '../loadFixtureModel.js';
import { fixtures, fixturesFromSchema, prng } from './fixtures.js';
import { createStore } from './store.js';
import { validatePayload } from './validate.js';

const model = loadFixtureModel();
const pet = model.schemas.pet;
if (pet === undefined) throw new Error('fixture lacks pet');

describe('fixtures(model, schema, n)', () => {
  it('yields n rows that validate against the Document schema', () => {
    const rows = fixtures(model, 'pet', 10);
    expect(rows).toHaveLength(10);
    for (const row of rows) {
      expect(validatePayload(pet.document, row)).toEqual([]);
      expect(row.record_version).toBe(1);
      expect(typeof row.entity_id).toBe('string');
    }
    expect(new Set(rows.map((r) => r.entity_id)).size).toBe(10);
  });

  it('is deterministic for a seed and differs across seeds', () => {
    expect(fixtures(model, 'pet', 5)).toEqual(fixtures(model, 'pet', 5));
    expect(fixtures(model, 'pet', 5, { seed: 7 })).toEqual(fixtures(model, 'pet', 5, { seed: 7 }));
    expect(fixtures(model, 'pet', 5, { seed: 7 })).not.toEqual(
      fixtures(model, 'pet', 5, { seed: 8 }),
    );
    expect(fixtures(model, 'pet', 3)).toMatchSnapshot();
  });

  it('yields Create and Update payloads that validate against their variants', () => {
    for (const row of fixtures(model, 'pet', 20, { variant: 'create' })) {
      expect(validatePayload(pet.create, row)).toEqual([]);
      expect(row).not.toHaveProperty('entity_id');
    }
    for (const row of fixtures(model, 'pet', 20, { variant: 'update' }))
      expect(validatePayload(pet.update, row)).toEqual([]);
  });

  it('seeds a store directly', () => {
    const store = createStore({ pet: fixtures(model, 'pet', 4) });
    expect(store.list('pet')).toHaveLength(4);
    const first = store.list('pet')[0];
    if (first === undefined || typeof first.entity_id !== 'string') throw new Error('no row');
    expect(store.get('pet', first.entity_id)).toBe(first);
  });

  it('throws for an unknown schema', () => {
    expect(() => fixtures(model, 'unicorn', 1)).toThrow('unicorn');
  });

  it('honours formats, bounds, enums, arrays and nested objects', () => {
    const schema: JsonSchema = {
      type: 'object',
      required: [
        'id',
        'when',
        'day',
        'mail',
        'kind',
        'count',
        'ratio',
        'flag',
        'tags',
        'child',
        'short',
      ],
      additionalProperties: false,
      properties: {
        id: { type: 'string', format: 'uuid' },
        when: { type: 'string', format: 'date-time' },
        day: { type: 'string', format: 'date' },
        mail: { type: 'string', format: 'email' },
        kind: { type: 'string', enum: ['a', 'b'] },
        count: { type: 'integer', minimum: 3, maximum: 5 },
        ratio: { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 1 },
        flag: { type: 'boolean' },
        tags: { type: 'array', items: { type: 'string', maxLength: 5 }, minItems: 1, maxItems: 2 },
        child: { type: 'object', required: ['n'], properties: { n: { type: 'integer' } } },
        short: { type: 'string', minLength: 12, maxLength: 12 },
        maybe: { type: ['string', 'null'] },
        fixed: { const: 42 },
      },
    };
    const rows = fixturesFromSchema(schema, 25, { seed: 1 });
    for (const row of rows) {
      expect(validatePayload(schema, row)).toEqual([]);
      expect((row.short as string).length).toBe(12);
    }
  });

  it('property: every seed and size yields rows the Document schema accepts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        fc.integer({ min: 0, max: 12 }),
        (seed, n) => {
          const rows = fixtures(model, 'pet', n, { seed });
          return (
            rows.length === n &&
            rows.every((row) => validatePayload(pet.document, row).length === 0)
          );
        },
      ),
      { numRuns: 50 },
    );
  });

  it('prng is deterministic and in [0, 1)', () => {
    const a = prng(42);
    const b = prng(42);
    for (let i = 0; i < 100; i += 1) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('validatePayload', () => {
  it('reports required, type, enum, length and unknown-field errors with paths', () => {
    const errors = validatePayload(pet.create, {
      species: 3,
      status: 'lost',
      notes: 'x',
      extra: 1,
    });
    expect(errors).toEqual([
      { field: 'name', message: 'required' },
      { field: 'species', message: 'expected string, got integer' },
      { field: 'status', message: 'must be one of "available", "pending", "sold"' },
      { field: 'extra', message: 'unknown field' },
    ]);
    expect(validatePayload({ type: 'object' }, 'nope')).toEqual([
      { field: '', message: 'expected object, got string' },
    ]);
    expect(validatePayload({ type: 'array', items: { type: 'integer' } }, [1, 'two'])).toEqual([
      { field: '[1]', message: 'expected integer, got string' },
    ]);
    expect(validatePayload({ type: 'string', format: 'uuid' }, 'abc')).toEqual([
      { field: '', message: 'not a uuid' },
    ]);
    expect(
      validatePayload({ type: 'string', format: 'date-time' }, '2026-13-40T00:00:00Z'),
    ).toHaveLength(1);
    expect(validatePayload({ type: ['string', 'null'] }, null)).toEqual([]);
    expect(validatePayload({ type: 'number', minimum: 1 }, 0)).toEqual([
      { field: '', message: 'less than 1' },
    ]);
    expect(validatePayload({ const: 'a' }, 'b')).toEqual([
      { field: '', message: 'must equal the constant' },
    ]);
    expect(validatePayload({ type: 'string', pattern: '^a+$' }, 'bbb')).toEqual([
      { field: '', message: 'does not match ^a+$' },
    ]);
  });
});
