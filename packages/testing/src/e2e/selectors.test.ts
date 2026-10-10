import { generate } from '@star-board/generator';
import { describe, expect, it } from 'vitest';
import { loadFixtureModel } from '../loadFixtureModel.js';
import { RENDERER_TEST_IDS, selectors, selectorTable, testId } from './selectors.js';

const model = loadFixtureModel();

describe('selectors(schema)', () => {
  const pet = selectors('pet');

  it('encodes the generator convention <schema>-<kind>-<part>', () => {
    expect(testId('pet', 'list', 'screen')).toBe('pet-list-screen');
    expect(pet.list.screen).toBe('pet-list-screen');
    expect(pet.list.sort('name')).toBe('pet-list-sort-name');
    expect(pet.list.row('p1')).toBe('pet-list-row-p1');
    expect(pet.list.open('p1')).toBe('pet-list-open-p1');
    expect(pet.list.pageNext).toBe('pet-list-page-next');
    expect(pet.grid.filters).toBe('pet-grid-filters');
    expect(pet.detail.field('name')).toBe('pet-detail-field-name');
    expect(pet.detail.group('system')).toBe('pet-detail-group-system');
    expect(pet.create.group('details')).toBe('pet-create-group-details');
    expect(pet.edit.cancel).toBe('pet-edit-cancel');
    expect(pet.custom('adopt')).toEqual({
      screen: 'pet-adopt-screen',
      actions: 'pet-adopt-actions',
      result: 'pet-adopt-result',
      back: 'pet-adopt-back',
    });
  });

  it('encodes the renderer convention field-/action-/cell-/state-', () => {
    expect(pet.field('name')).toBe('field-name');
    expect(pet.action('pet_delete')).toEqual({
      button: 'action-pet_delete',
      dialog: 'action-pet_delete-dialog',
      cancel: 'action-pet_delete-cancel',
      confirm: 'action-pet_delete-confirm',
    });
    expect(pet.cell('status')).toBe('cell-status');
    expect(pet.state('forbidden')).toEqual({
      root: 'state-forbidden',
      action: 'state-forbidden-action',
    });
    expect(pet.shell).toBe(RENDERER_TEST_IDS);
    expect(RENDERER_TEST_IDS).toEqual({
      shell: 'screen',
      shellActions: 'screen-actions',
      shellBody: 'screen-body',
      dataGrid: 'data-grid-list',
    });
  });

  it('every static id the table lists appears in the generated screens', () => {
    const files = generate(model, { out: 'src/generated', features: 'src/features' });
    const screens = files
      .filter((f) => f.path.startsWith('domain/pet/') && f.path.endsWith('Screen.tsx'))
      .map((f) => f.contents)
      .join('\n');
    const table = selectorTable(model);
    for (const [key, id] of Object.entries(table)) {
      // Renderer-owned ids (fields, actions) are rendered by the resolved components, not the screen text.
      if (id.startsWith('field-') || id.startsWith('action-')) continue;
      expect(screens, key).toContain(`"${id}"`);
    }
    // And the generated screens carry no id the table does not know (bar the runtime-value ones).
    const emitted = [...screens.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1] ?? '');
    const known = new Set(Object.values(table));
    for (const id of emitted) expect(known.has(id), id).toBe(true);
  });

  it('is a stable snapshot for the petstore fixture', () => {
    expect(selectorTable(model)).toMatchSnapshot();
  });
});
