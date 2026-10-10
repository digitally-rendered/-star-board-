import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SpecError, type ErrorCode } from '@star-board/core';
import { describe, expect, it } from 'vitest';
import { loadDocument } from './index.js';

const FIXTURES = new URL('../../../fixtures/', import.meta.url);
const PETSTORE = new URL('petstore.json', FIXTURES);
const negative = (name: string): string => fileURLToPath(new URL(`negative/${name}`, FIXTURES));

type Json = Record<string, unknown>;
const petstore = (): Json => JSON.parse(readFileSync(PETSTORE, 'utf8')) as Json;

function catchSpecError(run: () => unknown): SpecError {
  try {
    run();
  } catch (error) {
    if (error instanceof SpecError) return error;
    throw error;
  }
  throw new Error('expected loadDocument to throw a SpecError');
}

function expectSpecError(run: () => unknown, code: ErrorCode, details: Record<string, unknown>) {
  const error = catchSpecError(run);
  expect(error.code).toBe(code);
  expect(error.details).toMatchObject(details);
  expect(error.message).not.toContain('\n');
  return error;
}

/** Minimal document with one schema; tests mutate it to probe a single rule. */
function miniDocument(): Json {
  return {
    openapi: '3.1.0',
    info: { title: 'mini', version: '1' },
    paths: {
      '/item': {
        get: { operationId: 'item_list', 'x-capabilities': ['item:read'], responses: {} },
      },
    },
    components: {
      schemas: {
        Item: {
          type: 'object',
          'x-schema-version': '1.0.0',
          properties: { id: { type: 'string' } },
        },
        ItemCreate: { type: 'object' },
        ItemUpdate: { type: 'object' },
      },
    },
  };
}

describe('loadDocument over fixtures/petstore.json (contract)', () => {
  const model = loadDocument(fileURLToPath(PETSTORE));

  it('reads title, version and the 404 posture from info', () => {
    expect(model.title).toBe('petstore');
    expect(model.version).toBe('2026.10.0');
    expect(model.posture).toBe('404');
  });

  it('accepts the same document as a file URL, a JSON string and a parsed object', () => {
    const text = readFileSync(PETSTORE, 'utf8');
    expect(loadDocument(PETSTORE)).toEqual(model);
    expect(loadDocument(text)).toEqual(model);
    expect(loadDocument(JSON.parse(text) as object)).toEqual(model);
  });

  it('builds the pet schema entry from Pet/PetCreate/PetUpdate', () => {
    expect(Object.keys(model.schemas)).toEqual(['pet']);
    const pet = model.schemas.pet;
    expect(pet?.name).toBe('pet');
    expect(pet?.version).toBe('1.0.0');
    expect(pet?.ownerField).toBe('created_by');
    expect(pet?.reasons.notes).toMatch(/Free text/);
    expect(pet?.ui.order.name).toBe(1);
    expect(pet?.ui.widget.species).toBe('select');
    expect(pet?.ui.group.notes).toBe('details');
    expect(pet?.ui.hidden).toEqual([]);
    expect(pet?.document.required).toEqual(['entity_id', 'name', 'species', 'status']);
    expect(pet?.create.required).toEqual(['name', 'species']);
    expect(pet?.update.additionalProperties).toBe(false);
  });

  it('derives every operation with its kind, schema and capabilities', () => {
    const summary = Object.fromEntries(
      Object.values(model.operations).map((op) => [
        op.id,
        [op.kind, op.schema, op.method, op.path, op.capabilities] as const,
      ]),
    );
    expect(summary).toEqual({
      pet_list: ['list', 'pet', 'get', '/pet', ['pet:read']],
      pet_create: ['create', 'pet', 'post', '/pet', ['pet:write']],
      pet_get: ['get', 'pet', 'get', '/pet/{id}', ['pet:read']],
      pet_update: ['update', 'pet', 'patch', '/pet/{id}', ['pet:write']],
      pet_delete: ['delete', 'pet', 'delete', '/pet/{id}', ['pet:delete']],
      pet_history: ['history', 'pet', 'get', '/pet/{id}/_history', ['pet:read']],
      available_pets_query: ['view', 'pet', 'get', '/views/available-pets', ['pet:read']],
    });
    expect(model.operations.pet_create?.operation).toBe('create');
    expect(model.operations.available_pets_query?.operation).toBe('available_pets');
  });

  it('names the MCP tool after the operation id (one authority)', () => {
    for (const op of Object.values(model.operations)) expect(op.mcpTool).toBe(op.id);
  });

  it('resolves request bodies inline and leaves absent responses undefined', () => {
    expect(model.operations.pet_create?.request).toMatchObject({
      type: 'object',
      required: ['name', 'species'],
    });
    expect(model.operations.pet_create?.request).not.toHaveProperty('$ref');
    expect(model.operations.pet_update?.request).toMatchObject({ additionalProperties: false });
    expect(model.operations.pet_list?.request).toBeUndefined();
    expect(model.operations.pet_list?.response).toBeUndefined();
  });

  it('builds the available_pets view from x-view', () => {
    expect(Object.keys(model.views)).toEqual(['available_pets']);
    expect(model.views.available_pets).toEqual({
      name: 'available_pets',
      schema: 'pet',
      operationId: 'available_pets_query',
      projection: ['name', 'species', 'status'],
      filters: [{ field: 'species', op: '_eq' }],
      sort: [{ field: 'name', dir: 'asc' }],
      limits: { default: 25, max: 100 },
      roles: ['customer', 'staff'],
    });
  });
});

describe('loadDocument over fixtures/negative (fails closed, names the gap)', () => {
  it('missing-schema-version.json names x-schema-version on the Pet schema', () => {
    expectSpecError(
      () => loadDocument(negative('missing-schema-version.json')),
      'SPEC_MISSING_EXTENSION',
      {
        extension: 'x-schema-version',
        at: 'components.schemas.Pet',
      },
    );
  });

  it('missing-capabilities.json names x-capabilities on paths./pet.post', () => {
    expectSpecError(
      () => loadDocument(negative('missing-capabilities.json')),
      'SPEC_MISSING_EXTENSION',
      {
        extension: 'x-capabilities',
        at: 'paths./pet.post',
      },
    );
  });

  it('missing-operation-id.json names operationId on paths./pet.post', () => {
    expectSpecError(
      () => loadDocument(negative('missing-operation-id.json')),
      'SPEC_MISSING_EXTENSION',
      {
        extension: 'operationId',
        at: 'paths./pet.post',
      },
    );
  });

  it('missing-x-view.json names x-view on the /views/ operation whose id is no schema', () => {
    expectSpecError(() => loadDocument(negative('missing-x-view.json')), 'SPEC_MISSING_EXTENSION', {
      extension: 'x-view',
      at: 'paths./views/available-pets.get',
    });
  });
});

describe('loadDocument rules on a minimal document', () => {
  it('defaults the posture to 404 and honours 403', () => {
    expect(loadDocument(miniDocument()).posture).toBe('404');
    const doc = miniDocument();
    (doc.info as Json)['x-ownership-posture'] = '403';
    expect(loadDocument(doc).posture).toBe('403');
  });

  it('rejects an unknown posture as SPEC_INVALID', () => {
    const doc = miniDocument();
    (doc.info as Json)['x-ownership-posture'] = '401';
    expectSpecError(() => loadDocument(doc), 'SPEC_INVALID', { at: 'info.x-ownership-posture' });
  });

  it('rejects anything but OpenAPI 3.1', () => {
    const doc = miniDocument();
    doc.openapi = '3.0.3';
    expectSpecError(() => loadDocument(doc), 'SPEC_INVALID', { at: 'openapi' });
    expectSpecError(() => loadDocument('{"info":{}}'), 'SPEC_INVALID', { at: 'openapi' });
  });

  it('rejects unreadable input with SPEC_INVALID', () => {
    expectSpecError(() => loadDocument('{not json'), 'SPEC_INVALID', { source: '<inline>' });
    expectSpecError(() => loadDocument('/nonexistent/openapi.json'), 'SPEC_INVALID', {
      path: '/nonexistent/openapi.json',
    });
    expectSpecError(() => loadDocument([]), 'SPEC_INVALID', {});
  });

  it('reports an operation id that names no schema as SPEC_OPERATION_ID', () => {
    const doc = miniDocument();
    (doc.paths as Json)['/other'] = {
      get: { operationId: 'other_list', 'x-capabilities': [], responses: {} },
    };
    expectSpecError(() => loadDocument(doc), 'SPEC_OPERATION_ID', {
      operationId: 'other_list',
      at: 'paths./other.get',
      schemas: ['item'],
    });
  });

  it('reports a malformed operation id as SPEC_OPERATION_ID', () => {
    const doc = miniDocument();
    (doc.paths as Json)['/item'] = {
      get: { operationId: 'listItems', 'x-capabilities': [], responses: {} },
    };
    expectSpecError(() => loadDocument(doc), 'SPEC_OPERATION_ID', { operationId: 'listItems' });
  });

  it('reports a duplicate operation id as SPEC_OPERATION_ID', () => {
    const doc = miniDocument();
    (doc.paths as Json)['/item/all'] = {
      get: { operationId: 'item_list', 'x-capabilities': [], responses: {} },
    };
    expectSpecError(() => loadDocument(doc), 'SPEC_OPERATION_ID', {
      operationId: 'item_list',
      at: 'paths./item/all.get',
    });
  });

  it('rejects a view over an unknown schema as SPEC_INVALID', () => {
    const doc = miniDocument();
    (doc.paths as Json)['/views/open-items'] = {
      get: {
        operationId: 'open_items_query',
        'x-capabilities': ['item:read'],
        'x-view': { schema: 'ghost', projection: ['id'], limits: { default: 10, max: 50 } },
        responses: {},
      },
    };
    expectSpecError(() => loadDocument(doc), 'SPEC_INVALID', {
      at: 'paths./views/open-items.get.x-view.schema',
      schema: 'ghost',
    });
  });

  it('rejects a view that fails the ViewEntry schema as SPEC_INVALID with the zod issues', () => {
    const doc = miniDocument();
    (doc.paths as Json)['/views/open-items'] = {
      get: {
        operationId: 'open_items_query',
        'x-capabilities': ['item:read'],
        'x-view': { schema: 'item', projection: [], limits: { default: 10, max: 50 } },
        responses: {},
      },
    };
    const error = expectSpecError(() => loadDocument(doc), 'SPEC_INVALID', {
      at: 'paths./views/open-items.get.x-view',
    });
    expect(Array.isArray(error.details.issues)).toBe(true);
  });

  it('derives bulk and custom kinds from the path shape', () => {
    const doc = miniDocument();
    (doc.paths as Json)['/item/_bulk'] = {
      post: { operationId: 'item_bulk', 'x-capabilities': ['item:write'], responses: {} },
    };
    (doc.paths as Json)['/item/{id}/archive'] = {
      post: { operationId: 'item_archive', 'x-capabilities': ['item:write'], responses: {} },
    };
    (doc.paths as Json)['/item/{id}'] = {
      put: { operationId: 'item_replace', 'x-capabilities': ['item:write'], responses: {} },
    };
    const model = loadDocument(doc);
    expect(model.operations.item_bulk?.kind).toBe('bulk');
    expect(model.operations.item_archive?.kind).toBe('custom');
    expect(model.operations.item_archive?.operation).toBe('archive');
    expect(model.operations.item_replace?.kind).toBe('update');
  });

  it('takes the first 2xx application/json schema as the response', () => {
    const doc = miniDocument();
    const paths = doc.paths as Json;
    paths['/item'] = {
      get: {
        operationId: 'item_list',
        'x-capabilities': ['item:read'],
        responses: {
          '204': { description: 'no body' },
          '200': {
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Item' } } },
          },
        },
      },
    };
    const model = loadDocument(doc);
    expect(model.operations.item_list?.response).toMatchObject({
      type: 'object',
      'x-schema-version': '1.0.0',
    });
  });

  it('maps x-owner-field null or false to null and absent to undefined', () => {
    const doc = miniDocument();
    expect(loadDocument(doc).schemas.item).not.toHaveProperty('ownerField');
    ((doc.components as Json).schemas as Json).Item = {
      ...(((doc.components as Json).schemas as Json).Item as Json),
      'x-owner-field': null,
    };
    expect(loadDocument(doc).schemas.item?.ownerField).toBeNull();
  });

  it('collects schema-level reasons and x-ui-hidden fields', () => {
    const doc = miniDocument();
    const schemas = (doc.components as Json).schemas as Json;
    schemas.Item = {
      ...(schemas.Item as Json),
      'x-archive-reason': 'Archived items stay queryable for audit.',
      properties: {
        id: { type: 'string', 'x-ui-hidden': true },
        label: { type: 'string', 'x-ui-hidden': false, 'x-label-reason': 'Shown in lists.' },
      },
    };
    const item = loadDocument(doc).schemas.item;
    expect(item?.reasons).toEqual({
      archive: 'Archived items stay queryable for audit.',
      label: 'Shown in lists.',
    });
    expect(item?.ui.hidden).toEqual(['id']);
  });

  it('rejects a mistyped x-ui-order with its location', () => {
    const doc = miniDocument();
    const schemas = (doc.components as Json).schemas as Json;
    schemas.Item = {
      ...(schemas.Item as Json),
      properties: { id: { type: 'string', 'x-ui-order': '1' } },
    };
    expectSpecError(() => loadDocument(doc), 'SPEC_INVALID', {
      at: 'components.schemas.Item.properties.id.x-ui-order',
    });
  });

  it('snake_cases multi-word schema names', () => {
    const doc = miniDocument();
    const schemas = (doc.components as Json).schemas as Json;
    schemas.ItemTag = { type: 'object', 'x-schema-version': '1.0.0' };
    schemas.ItemTagCreate = { type: 'object' };
    schemas.ItemTagUpdate = { type: 'object' };
    (doc.paths as Json)['/item-tag'] = {
      get: { operationId: 'item_tag_list', 'x-capabilities': ['item:read'], responses: {} },
    };
    const model = loadDocument(doc);
    expect(Object.keys(model.schemas).sort()).toEqual(['item', 'item_tag']);
    expect(model.operations.item_tag_list?.schema).toBe('item_tag');
    expect(model.operations.item_tag_list?.operation).toBe('list');
  });

  it('resolves $ref inside schemas and request bodies from an inline document', () => {
    const doc = miniDocument();
    const schemas = (doc.components as Json).schemas as Json;
    schemas.Address = { type: 'object', properties: { city: { type: 'string' } } };
    schemas.Item = {
      ...(schemas.Item as Json),
      properties: {
        id: { type: 'string' },
        address: { $ref: '#/components/schemas/Address', description: 'home' },
        tags: { type: 'array', items: { $ref: '#/components/schemas/Address' } },
      },
    };
    (doc.paths as Json)['/item'] = {
      post: {
        operationId: 'item_create',
        'x-capabilities': ['item:write'],
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ItemCreate' } } },
        },
        responses: {},
      },
    };
    const model = loadDocument(doc);
    const properties = model.schemas.item?.document.properties as Json;
    expect(properties.address).toEqual({
      type: 'object',
      properties: { city: { type: 'string' } },
      description: 'home',
    });
    expect((properties.tags as Json).items).toEqual({
      type: 'object',
      properties: { city: { type: 'string' } },
    });
    expect(model.operations.item_create?.request).toEqual({ type: 'object' });
  });

  it('rejects an external or unknown $ref as SPEC_INVALID', () => {
    const doc = miniDocument();
    const schemas = (doc.components as Json).schemas as Json;
    schemas.Item = {
      ...(schemas.Item as Json),
      properties: { id: { $ref: '#/components/schemas/Ghost' } },
    };
    expectSpecError(() => loadDocument(doc), 'SPEC_INVALID', {
      at: 'components.schemas.Item.properties.id',
      ref: '#/components/schemas/Ghost',
    });
    schemas.Item = { ...(schemas.Item as Json), properties: { id: { $ref: 'other.json#/Thing' } } };
    expectSpecError(() => loadDocument(doc), 'SPEC_INVALID', { ref: 'other.json#/Thing' });
  });

  it('loads the petstore fixture after mutation into a 403 posture document', () => {
    const doc = petstore();
    (doc.info as Json)['x-ownership-posture'] = '403';
    expect(loadDocument(doc).posture).toBe('403');
  });
});
