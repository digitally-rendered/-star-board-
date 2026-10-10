import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { JsonSchema } from '@star-board/core';
import { generate, zodExpr } from '../src/index.js';
import { petstore } from './fixture.js';

/**
 * Evaluates the emitted `schemas.ts` with the installed zod: the import line and the type-only
 * lines are stripped, `export const` becomes `const`, and the module body runs as a function.
 */
function evaluateSchemas(source: string): Record<string, z.ZodType> {
  const names = [...source.matchAll(/export const (\w+) = /g)].map((m) => m[1] ?? '');
  const body = source
    .split('\n')
    .filter((line) => !line.startsWith('import ') && !line.startsWith('export type '))
    .join('\n')
    .replace(/export const /g, 'const ');
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- running the emitted module text is the point of this test
  const factory = new Function('z', `${body}\nreturn { ${names.join(', ')} };`) as (
    zod: typeof z,
  ) => Record<string, z.ZodType>;
  return factory(z);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A fast-check arbitrary for payloads the backend accepts, derived from the JSON Schema. */
function validArbitrary(schema: JsonSchema): fc.Arbitrary<unknown> {
  if (Array.isArray(schema.enum)) return fc.constantFrom(...(schema.enum as unknown[]));
  const type = Array.isArray(schema.type) ? schema.type : [schema.type];
  const variants = type.map((t): fc.Arbitrary<unknown> => {
    switch (t) {
      case 'string':
        return fc.string({
          minLength: typeof schema.minLength === 'number' ? schema.minLength : 0,
          maxLength: typeof schema.maxLength === 'number' ? schema.maxLength : 40,
        });
      case 'integer':
        return fc.integer();
      case 'number':
        return fc.double({ noNaN: true, noDefaultInfinity: true });
      case 'boolean':
        return fc.boolean();
      case 'null':
        return fc.constant(null);
      case 'object':
        return objectArbitrary(schema);
      default:
        return fc.constant(undefined);
    }
  });
  const [first] = variants;
  return variants.length === 1 && first !== undefined ? first : fc.oneof(...variants);
}

function objectArbitrary(schema: JsonSchema): fc.Arbitrary<Record<string, unknown>> {
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  const shape: Record<string, fc.Arbitrary<unknown>> = {};
  for (const [name, definition] of Object.entries(properties)) {
    if (!isRecord(definition)) continue;
    shape[name] = validArbitrary(definition);
  }
  return fc.record(shape, { requiredKeys: required });
}

describe('zod agreement over generated payloads (contradiction #11)', () => {
  const model = petstore();
  const pet = model.schemas.pet;
  if (!pet) throw new Error('fixture has no pet schema');
  const files = generate(model, { out: 'out', features: 'features' });
  const source = files.find((f) => f.path === 'domain/pet/schemas.ts')?.contents ?? '';
  const schemas = evaluateSchemas(source);
  const createSchema = schemas.PetCreateSchema;
  const updateSchema = schemas.PetUpdateSchema;
  const documentSchema = schemas.PetDocumentSchema;
  if (!createSchema || !updateSchema || !documentSchema)
    throw new Error('schemas.ts did not evaluate');

  it('accepts every valid Create payload', () => {
    fc.assert(
      fc.property(objectArbitrary(pet.create), (payload) => {
        const result = createSchema.safeParse(payload);
        expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(
          true,
        );
      }),
      { numRuns: 300 },
    );
  });

  it('accepts every valid Update and Document payload', () => {
    fc.assert(
      fc.property(objectArbitrary(pet.update), (payload) => {
        expect(updateSchema.safeParse(payload).success).toBe(true);
      }),
    );
    const document = fc.record({
      entity_id: fc.uuid(),
      record_version: fc.integer(),
      name: fc.string({ maxLength: 80 }),
      species: fc.constantFrom('dog', 'cat', 'bird'),
      status: fc.constantFrom('available', 'pending', 'sold'),
      created_at: fc
        .date({
          min: new Date('1970-01-01T00:00:00Z'),
          max: new Date('2100-01-01T00:00:00Z'),
          noInvalidDate: true,
        })
        .map((d) => d.toISOString()),
    });
    fc.assert(
      fc.property(document, (payload) => {
        expect(documentSchema.safeParse(payload).success).toBe(true);
      }),
    );
  });

  it('rejects a name over maxLength', () => {
    fc.assert(
      fc.property(
        objectArbitrary(pet.create),
        fc.string({ minLength: 81, maxLength: 200 }),
        (payload, name) => {
          expect(createSchema.safeParse({ ...payload, name }).success).toBe(false);
        },
      ),
    );
  });

  it('rejects a species outside the enum', () => {
    fc.assert(
      fc.property(
        objectArbitrary(pet.create),
        fc.string().filter((s) => !['dog', 'cat', 'bird'].includes(s)),
        (payload, species) => {
          expect(createSchema.safeParse({ ...payload, species }).success).toBe(false);
        },
      ),
    );
  });

  it('rejects a missing required field and an unknown key (additionalProperties: false)', () => {
    fc.assert(
      fc.property(
        objectArbitrary(pet.create),
        fc.constantFrom('name', 'species'),
        (payload, drop) => {
          const rest = Object.fromEntries(Object.entries(payload).filter(([key]) => key !== drop));
          expect(createSchema.safeParse(rest).success).toBe(false);
        },
      ),
    );
    fc.assert(
      fc.property(objectArbitrary(pet.create), (payload) => {
        expect(createSchema.safeParse({ ...payload, colour: 'blue' }).success).toBe(false);
      }),
    );
  });

  it('agrees field by field: the emitted expression for each property verdicts like the whole', () => {
    const properties = pet.create.properties as Record<string, JsonSchema>;
    for (const [name, definition] of Object.entries(properties)) {
      const expression = zodExpr(definition);
      // eslint-disable-next-line @typescript-eslint/no-implied-eval -- evaluating the emitted expression is the point
      const build = new Function('z', `return ${expression};`) as (zod: typeof z) => z.ZodType;
      const single = build(z);
      fc.assert(
        fc.property(validArbitrary(definition), (value) => {
          expect(single.safeParse(value).success, `${name}: ${expression}`).toBe(true);
        }),
      );
    }
    expect(zodExpr({ type: 'string', format: 'date-time' })).toBe('z.iso.datetime()');
    expect(zodExpr({ type: 'string', format: 'uuid' })).toBe('z.uuid()');
    expect(zodExpr({ type: ['string', 'null'], maxLength: 3 })).toBe(
      'z.string().max(3).nullable()',
    );
    expect(zodExpr({ type: 'integer', minimum: 1 })).toBe('z.number().int().min(1)');
    expect(zodExpr({ type: 'array', items: { enum: ['a', 'b'] } })).toBe(
      "z.array(z.enum(['a', 'b']))",
    );
  });
});
