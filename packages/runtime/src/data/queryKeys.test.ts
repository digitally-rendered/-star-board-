import { describe, expect, it } from 'vitest';
import { normalise, queryKeys } from './queryKeys.js';

describe('queryKeys', () => {
  it('nests every key under one root so a schema invalidation reaches lists and entities', () => {
    expect(queryKeys.all()).toEqual(['star-board']);
    expect(queryKeys.schema('pet')).toEqual(['star-board', 'pet']);
    expect(queryKeys.entity('pet', '1')).toEqual(['star-board', 'pet', 'entity', '1']);
    expect(queryKeys.list('pet', { page: 1 })).toEqual(['star-board', 'pet', 'list', { page: 1 }]);
    expect(queryKeys.view('v', { a: 1 })).toEqual(['star-board', 'view', 'v', { a: 1 }]);
  });
  it('normalises query objects so key order and undefined do not matter', () => {
    expect(normalise({ b: 1, a: { d: undefined, c: [2, { z: 1, y: 2 }] } })).toEqual({
      a: { c: [2, { y: 2, z: 1 }] },
      b: 1,
    });
    expect(normalise('x')).toBe('x');
    expect(JSON.stringify(queryKeys.list('p', { sort: 'a', page: 1 }))).toBe(
      JSON.stringify(queryKeys.list('p', { page: 1, sort: 'a', where: undefined })),
    );
  });
});
