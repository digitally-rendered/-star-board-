import { readFileSync } from 'node:fs';
import type { FeatureModel } from '@star-board/core';
import { loadDocument } from '@star-board/spec';

export const PETSTORE = new URL('../../../fixtures/petstore.json', import.meta.url);

export function petstore(): FeatureModel {
  return loadDocument(PETSTORE);
}

type Json = Record<string, unknown>;

/**
 * The fixture plus three Tier 3 operations, so the custom-operation stubs are exercised:
 * `pet_adopt` (POST on a record, no body), `pet_rename` (POST with a body) and `pet_owner`
 * (GET with a response schema).
 */
export function petstoreWithCustomOperations(): FeatureModel {
  const document = JSON.parse(readFileSync(PETSTORE, 'utf8')) as Json;
  const paths = document.paths as Json;
  paths['/pet/{id}/adopt'] = {
    post: {
      operationId: 'pet_adopt',
      tags: ['pet'],
      'x-capabilities': ['pet:write'],
      responses: { '200': { description: 'ok' } },
    },
  };
  paths['/pet/{id}/rename'] = {
    post: {
      operationId: 'pet_rename',
      tags: ['pet'],
      'x-capabilities': ['pet:write'],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name'],
              properties: { name: { type: 'string' } },
            },
          },
        },
      },
      responses: { '200': { description: 'ok' } },
    },
  };
  paths['/pet/{id}/owner'] = {
    get: {
      operationId: 'pet_owner',
      tags: ['pet'],
      'x-capabilities': ['pet:read'],
      responses: {
        '200': {
          description: 'ok',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { name: { type: 'string' } } },
            },
          },
        },
      },
    },
  };
  return loadDocument(document);
}
