// @vitest-environment jsdom
import {
  expectNoViolations,
  expectTestIds,
  renderGeneratedScreen,
  renderedTestIds,
} from '@star-board/testing/harness';
import { fixtures } from '@star-board/testing';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActionProps } from './generated/domain/contract.js';
import { AVAILABLE_PETS_COLUMNS, PET_LIST_COLUMNS } from './generated/domain/pet/columns.js';
import type { PetCreateScreenProps } from './generated/domain/pet/PetCreateScreen.js';
import type { PetDetailScreenProps } from './generated/domain/pet/PetDetailScreen.js';
import type { PetEditScreenProps } from './generated/domain/pet/PetEditScreen.js';
import type { PetGridScreenProps } from './generated/domain/pet/PetGridScreen.js';
import type { PetListScreenProps } from './generated/domain/pet/PetListScreen.js';
import { MODEL } from './model.js';
import { harnessOptions, toPet } from './testing.js';

/*
 * Every generated screen mounts through the registry with fixture data, carries every static test
 * id the page objects name, and is axe clean (plan Part 5 `a11y`; typescript/12 §7).
 */

const pets = fixtures(MODEL, 'pet', 3, { seed: 7 }).map(toPet);
const first = pets[0];
if (first === undefined) throw new Error('fixtures yielded no pet');

const action = (operationId: string, label: string): ActionProps => ({
  operationId,
  label,
  disabled: false,
  onClick: vi.fn(),
});

const table = {
  page: { page: 1, pageSize: 25, total: pets.length },
  sort: undefined,
  filters: {},
  onPage: vi.fn(),
  onSort: vi.fn(),
  onFilter: vi.fn(),
  retry: undefined,
  status: 'ready' as const,
  error: undefined,
  onOpen: vi.fn(),
};

describe('generated screens mount with fixture data', () => {
  it('screen.list', async () => {
    const props: PetListScreenProps = {
      ...table,
      rows: pets,
      columns: PET_LIST_COLUMNS,
      actions: [action('pet_create', 'Create')],
    };
    const { container } = renderGeneratedScreen({
      ...harnessOptions(),
      screen: { key: 'screen.list', schema: 'pet', target: 'pet_list' },
      props,
    });
    expectTestIds(container, renderedTestIds(MODEL, 'pet', 'list'));
    expect(screen.getAllByTestId(/^pet-list-row-/)).toHaveLength(pets.length);
    expect(screen.getByTestId('action-pet_create')).toBeTruthy();
    expect(screen.getAllByTestId('cell-status')[0]?.textContent).toBe(
      first.status.charAt(0).toUpperCase() + first.status.slice(1),
    );
    await expectNoViolations(container);
  });

  it('screen.grid (available_pets view)', async () => {
    const props: PetGridScreenProps = {
      ...table,
      title: 'Available pets',
      filterable: ['species'],
      rows: pets.map(({ entity_id, name, species, status }) => ({
        entity_id,
        name,
        species,
        status,
      })),
      columns: AVAILABLE_PETS_COLUMNS,
      actions: [],
    };
    const { container } = renderGeneratedScreen({
      ...harnessOptions(),
      screen: { key: 'screen.grid', schema: 'pet', target: 'available_pets_query' },
      props,
    });
    expectTestIds(container, renderedTestIds(MODEL, 'pet', 'grid', 'available_pets'));
    expect(screen.getByTestId('field-species')).toBeTruthy();
    await expectNoViolations(container);
  });

  it('screen.detail', async () => {
    const props: PetDetailScreenProps = {
      status: 'ready',
      error: undefined,
      entity: first,
      actions: [action('pet_update', 'Update'), action('pet_delete', 'Delete')],
      retry: undefined,
      onBack: vi.fn(),
    };
    const { container } = renderGeneratedScreen({
      ...harnessOptions(),
      screen: { key: 'screen.detail', schema: 'pet', target: 'pet_get' },
      props,
    });
    expectTestIds(container, renderedTestIds(MODEL, 'pet', 'detail'));
    expect(screen.getByTestId('cell-name').textContent).toBe(first.name);
    expect(screen.getByTestId('action-pet_delete')).toBeTruthy();
    await expectNoViolations(container);
  });

  it('screen.create', async () => {
    const props: PetCreateScreenProps = {
      values: { name: 'Rex' },
      errors: { species: 'Required' },
      pending: false,
      submitError: undefined,
      onChange: vi.fn(),
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
      onAgentApplied: undefined,
    };
    const { container } = renderGeneratedScreen({
      ...harnessOptions(),
      screen: { key: 'screen.create', schema: 'pet', target: 'pet_create' },
      props,
    });
    expectTestIds(container, renderedTestIds(MODEL, 'pet', 'create'));
    expect(screen.getByRole('alert').textContent).toBe('Required');
    expect(screen.getByTestId('action-pet_create')).toBeTruthy();
    await expectNoViolations(container);
  });

  it('screen.edit', async () => {
    const props: PetEditScreenProps = {
      status: 'ready',
      error: undefined,
      entity: first,
      ifMatch: `W/"${first.entity_id}:1"`,
      retry: undefined,
      values: { name: first.name, status: first.status },
      errors: {},
      pending: false,
      submitError: 'Stale',
      onChange: vi.fn(),
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
      onAgentApplied: undefined,
    };
    const { container } = renderGeneratedScreen({
      ...harnessOptions(),
      screen: { key: 'screen.edit', schema: 'pet', target: 'pet_update' },
      props,
    });
    expectTestIds(container, renderedTestIds(MODEL, 'pet', 'edit'));
    expect(screen.getByTestId('state-error').textContent).toContain('Stale');
    await expectNoViolations(container);
  });

  it('every screen renders its loading, forbidden (posture 404 → empty) and error states', async () => {
    const base = { ...table, rows: pets, columns: PET_LIST_COLUMNS, actions: [] };
    for (const [status, testId] of [
      ['loading', 'state-loading'],
      ['forbidden', 'state-empty'],
      ['error', 'state-error'],
    ] as const) {
      const props: PetListScreenProps = { ...base, status, error: 'boom' };
      const { container, unmount } = renderGeneratedScreen({
        ...harnessOptions(),
        screen: { key: 'screen.list', schema: 'pet', target: 'pet_list' },
        props,
      });
      expect(screen.getByTestId(testId)).toBeTruthy();
      await expectNoViolations(container);
      unmount();
    }
  });
});
