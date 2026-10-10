// @vitest-environment jsdom
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { check, generate, writeFiles } from '@star-board/generator';
import { fixtures } from '@star-board/testing';
import { renderGeneratedScreen } from '@star-board/testing/harness';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PET_LIST_COLUMNS } from './generated/domain/pet/columns.js';
import type { PetCreateScreenProps } from './generated/domain/pet/PetCreateScreen.js';
import type { PetDetailScreenProps } from './generated/domain/pet/PetDetailScreen.js';
import type { PetListScreenProps } from './generated/domain/pet/PetListScreen.js';
import { MODEL } from './model.js';
import { harnessOptions, registerDefaultsOnly, registerWithOverrides, toPet } from './testing.js';

/*
 * Overrides at each granularity (hexagonal-rules typescript/12 §3): a field widget, a column
 * renderer and a whole screen replace the defaults through the registry alone, and a generator
 * run leaves `src/features` byte-identical (task 18).
 */

// This file's folder (vitest provides it in every environment).
const SRC = import.meta.dirname;
const pets = fixtures(MODEL, 'pet', 2, { seed: 11 }).map(toPet);
const pet = pets[0];
if (pet === undefined) throw new Error('no fixture');

const listProps: PetListScreenProps = {
  status: 'ready',
  error: undefined,
  rows: pets,
  columns: PET_LIST_COLUMNS,
  page: { page: 1, pageSize: 25, total: 2 },
  sort: undefined,
  filters: {},
  onPage: vi.fn(),
  onSort: vi.fn(),
  onFilter: vi.fn(),
  retry: undefined,
  actions: [],
  onOpen: vi.fn(),
};
const createProps: PetCreateScreenProps = {
  values: { name: 'Rex' },
  errors: {},
  pending: false,
  submitError: undefined,
  onChange: vi.fn(),
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
  onAgentApplied: undefined,
};
const detailProps: PetDetailScreenProps = {
  status: 'ready',
  error: undefined,
  entity: pet,
  actions: [{ operationId: 'pet_update', label: 'Update', disabled: false, onClick: vi.fn() }],
  retry: undefined,
  onBack: vi.fn(),
};

function tree(dir: string): [string, string][] {
  const out: [string, string][] = [];
  const walk = (current: string, prefix: string): void => {
    for (const entry of readdirSync(current).sort()) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full, `${prefix}${entry}/`);
      else out.push([`${prefix}${entry}`, readFileSync(full, 'utf8')]);
    }
  };
  walk(dir, '');
  return out;
}

describe('the three pet overrides render instead of the defaults', () => {
  it('field.text pet/name: the counter appears only with the override', () => {
    const plain = renderGeneratedScreen({
      ...harnessOptions(registerDefaultsOnly),
      screen: { key: 'screen.create', schema: 'pet', target: 'pet_create' },
      props: createProps,
    });
    expect(screen.queryByTestId('pet-name-counter')).toBeNull();
    plain.unmount();
    renderGeneratedScreen({
      ...harnessOptions(registerWithOverrides),
      screen: { key: 'screen.create', schema: 'pet', target: 'pet_create' },
      props: createProps,
    });
    expect(screen.getByTestId('pet-name-counter').textContent).toBe('3/80');
    // The default field stays underneath: same test id, same label.
    expect(screen.getByTestId('field-name')).toBeTruthy();
    expect(screen.queryByTestId('pet-species-counter')).toBeNull();
  });

  it('list.column.enum pet/status: the coloured chip replaces the neutral one for status only', () => {
    const plain = renderGeneratedScreen({
      ...harnessOptions(registerDefaultsOnly),
      screen: { key: 'screen.list', schema: 'pet', target: 'pet_list' },
      props: listProps,
    });
    expect(screen.queryAllByTestId('pet-status-chip')).toHaveLength(0);
    plain.unmount();
    renderGeneratedScreen({
      ...harnessOptions(registerWithOverrides),
      screen: { key: 'screen.list', schema: 'pet', target: 'pet_list' },
      props: listProps,
    });
    const chips = screen.getAllByTestId('pet-status-chip');
    expect(chips).toHaveLength(2);
    expect(chips[0]?.getAttribute('data-status')).toBe(pet.status);
    // species is an enum column too and keeps the renderer default.
    expect(screen.getAllByTestId('cell-species')).toHaveLength(2);
  });

  it('screen.detail pet/pet_get: the whole screen is replaced and keeps the page-object ids', () => {
    const plain = renderGeneratedScreen({
      ...harnessOptions(registerDefaultsOnly),
      screen: { key: 'screen.detail', schema: 'pet', target: 'pet_get' },
      props: detailProps,
    });
    expect(screen.getByTestId('pet-detail-screen').getAttribute('data-override')).toBeNull();
    plain.unmount();
    const { harness } = renderGeneratedScreen({
      ...harnessOptions(registerWithOverrides),
      screen: { key: 'screen.detail', schema: 'pet', target: 'pet_get' },
      props: detailProps,
    });
    expect(screen.getByTestId('pet-detail-screen').getAttribute('data-override')).toBe('pet');
    expect(screen.getByTestId('pet-detail-field-species')).toBeTruthy();
    expect(screen.getByTestId('action-pet_update')).toBeTruthy();
    // The status chip override composes into the overridden screen through the same registry.
    expect(screen.getByTestId('pet-status-chip')).toBeTruthy();
    const resolved = harness.registry.resolve('screen.detail', 'pet', 'pet_get');
    expect(resolved.source).toBe('override');
    expect(harness.registry.resolve('screen.list', 'pet', 'pet_list').source).toBe('generated');
  });
});

describe('generate leaves the overrides untouched', () => {
  it('a generator run into a copy keeps features/ byte-identical and the committed tree has no drift', () => {
    const root = mkdtempSync(join(tmpdir(), 'petstore-ui-overrides-'));
    try {
      const features = join(root, 'src', 'features');
      cpSync(join(SRC, 'features'), features, { recursive: true });
      const before = tree(features);
      expect(before.map(([path]) => path)).toContain('pet/index.ts');
      const out = join(root, 'src', 'generated');
      writeFiles(generate(MODEL, { out, features }), { out, features });
      expect(tree(features)).toEqual(before);
      expect(tree(features)).toEqual(tree(join(SRC, 'features')));
      // What was just written equals what is committed: the example is the drift-check target.
      expect(tree(out)).toEqual(tree(join(SRC, 'generated')));
      expect(
        check(MODEL, { out: join(SRC, 'generated'), features: join(SRC, 'features') }),
      ).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
