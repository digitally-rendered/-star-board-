import { SpecError } from '@star-board/core';
import { describe, expect, it } from 'vitest';
import { MAX_REF_DEPTH, resolveSchema } from './refs.js';

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

describe('resolveSchema', () => {
  it('inlines a reference and lets siblings win', () => {
    const schemas = { Leaf: { type: 'string', description: 'leaf' } };
    expect(resolveSchema({ ...ref('Leaf'), description: 'mine' }, schemas, 'at')).toEqual({
      type: 'string',
      description: 'mine',
    });
  });

  it('keeps a cyclic reference as $ref so resolution terminates', () => {
    const schemas = {
      Node: { type: 'object', properties: { next: ref('Node') } },
    };
    const resolved = resolveSchema(ref('Node'), schemas, 'at');
    expect(resolved.type).toBe('object');
    const properties = resolved.properties as Record<string, unknown>;
    expect(properties.next).toEqual(ref('Node'));
  });

  it('stops inlining past MAX_REF_DEPTH', () => {
    const schemas: Record<string, unknown> = { L0: { type: 'string' } };
    for (let level = 1; level <= MAX_REF_DEPTH + 2; level += 1) {
      schemas[`L${level}`] = { type: 'object', properties: { child: ref(`L${level - 1}`) } };
    }
    const top = resolveSchema(ref(`L${MAX_REF_DEPTH + 2}`), schemas, 'at');
    let node: Record<string, unknown> = top;
    let inlined = 0;
    while (!('$ref' in node)) {
      inlined += 1;
      node = (node.properties as { child: Record<string, unknown> }).child;
    }
    expect(inlined).toBe(MAX_REF_DEPTH);
    expect(node.$ref).toBe('#/components/schemas/L2');
  });

  it('leaves $ref keys inside data keywords alone', () => {
    const schema = { type: 'object', default: { $ref: 'literal' }, enum: [{ $ref: 'x' }] };
    expect(resolveSchema(schema, {}, 'at')).toEqual(schema);
  });

  it('throws SPEC_INVALID for an unknown target naming the location', () => {
    expect(() => resolveSchema(ref('Ghost'), {}, 'components.schemas.A')).toThrow(SpecError);
    try {
      resolveSchema({ properties: { a: ref('Ghost') } }, {}, 'components.schemas.A');
    } catch (error) {
      expect(error).toBeInstanceOf(SpecError);
      expect((error as SpecError).details).toEqual({
        at: 'components.schemas.A.properties.a',
        ref: '#/components/schemas/Ghost',
      });
    }
  });

  it('throws SPEC_INVALID for a non-local $ref', () => {
    expect(() => resolveSchema({ $ref: 'https://example.test/x.json' }, {}, 'at')).toThrow(
      SpecError,
    );
    expect(() => resolveSchema({ $ref: 7 }, {}, 'at')).toThrow(SpecError);
  });
});
