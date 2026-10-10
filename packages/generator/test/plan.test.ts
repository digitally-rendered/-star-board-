import { describe, expect, it } from 'vitest';
import { plan } from '../src/index.js';
import { petstore } from './fixture.js';

describe('plan(model)', () => {
  const generationPlan = plan(petstore());
  const pet = generationPlan.schemas[0];
  if (!pet) throw new Error('fixture has no schema');

  it('orders fields by x-ui-order then schema order and marks system fields as audit', () => {
    expect(pet.fields.map((f) => f.name)).toEqual([
      'name',
      'species',
      'status',
      'entity_id',
      'record_version',
      'notes',
      'created_at',
      'created_by',
    ]);
    expect(pet.fields.filter((f) => f.audit).map((f) => f.name)).toEqual([
      'entity_id',
      'record_version',
      'created_at',
      'created_by',
    ]);
    expect(pet.idField).toBe('entity_id');
    expect(pet.ownerField).toBe('created_by');
  });

  it('maps fields to contract keys, honouring x-ui-widget, and takes help from the reason', () => {
    const byName = Object.fromEntries(pet.fields.map((f) => [f.name, f]));
    expect(byName.species?.key).toBe('field.select');
    expect(byName.created_at?.key).toBe('field.datetime');
    expect(byName.record_version?.key).toBe('field.number');
    expect(byName.notes?.group).toBe('details');
    expect(byName.notes?.help).toMatch(/^Free text/);
    expect(byName.name?.help).toBeNull();
    expect(byName.name?.required).toBe(true);
  });

  it('plans the screens that have an operation with a capability', () => {
    expect(pet.screens.map((s) => [s.kind, s.operationId, s.route])).toEqual([
      ['list', 'pet_list', '/pet'],
      ['create', 'pet_create', '/pet/new'],
      ['detail', 'pet_get', '/pet/:id'],
      ['edit', 'pet_update', '/pet/:id/edit'],
      ['grid', 'available_pets_query', '/views/available_pets'],
    ]);
  });

  it('plans one action per non-view operation with its capabilities', () => {
    expect(pet.actions.map((a) => `${a.id}:${a.kind}:${String(a.mutation)}`)).toEqual([
      'pet_create:create:true',
      'pet_delete:delete:true',
      'pet_get:custom:false',
      'pet_history:custom:false',
      'pet_list:custom:false',
      'pet_update:update:true',
    ]);
    expect(pet.actions.find((a) => a.id === 'pet_delete')?.capabilities).toEqual(['pet:delete']);
    expect(pet.actions.find((a) => a.id === 'pet_create')?.hasRequest).toBe(true);
  });

  it('projects list columns (audit hidden) and view columns from the projection', () => {
    expect(pet.columns.list.map((c) => `${c.field}${c.hidden ? '!' : ''}`)).toEqual([
      'name',
      'species',
      'status',
      'notes',
      'entity_id!',
      'record_version!',
      'created_at!',
      'created_by!',
    ]);
    expect(pet.columns.views).toHaveLength(1);
    expect(pet.columns.views[0]?.columns.map((c) => c.key)).toEqual([
      'list.column.string',
      'list.column.string',
      'list.column.string',
    ]);
    expect(pet.columns.views[0]?.filters).toEqual([{ field: 'species', op: '_eq' }]);
  });

  it('derives routes, nav and i18n keys', () => {
    expect(generationPlan.routes.map((r) => r.path)).toEqual([
      '/pet',
      '/pet/new',
      '/pet/:id',
      '/pet/:id/edit',
      '/views/available_pets',
    ]);
    expect(generationPlan.nav).toEqual([
      { schema: 'pet', label: 'Pet', i18nKey: 'pet.nav.label', path: '/pet' },
    ]);
    expect(Object.keys(generationPlan.i18n)).toEqual([...Object.keys(generationPlan.i18n)].sort());
    expect(generationPlan.i18n['pet.field.notes.help']).toMatch(/^Free text/);
    expect(generationPlan.i18n['pet.screen.list.title']).toBe('Pet list');
    expect(generationPlan.i18n['pet.action.pet_create.label']).toBe('Create');
  });

  it('drops a screen whose operation has no capability', () => {
    const model = petstore();
    const create = model.operations.pet_create;
    if (!create) throw new Error('fixture has no pet_create');
    create.capabilities = [];
    const planned = plan(model).schemas[0];
    expect(planned?.screens.some((s) => s.kind === 'create')).toBe(false);
    expect(plan(model).routes.map((r) => r.path)).not.toContain('/pet/new');
  });
});
