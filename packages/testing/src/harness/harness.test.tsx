// @vitest-environment jsdom
import { ComponentRegistry } from '@star-board/core';
import { useComponent } from '@star-board/runtime';
import { cleanup, screen } from '@testing-library/react';
import type { ComponentType, ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { loadFixtureModel } from '../loadFixtureModel.js';
import { expectNoViolations } from './a11y.js';
import { allCapabilities, capabilityCases, principalFor } from './capabilities.js';
import {
  createHarness,
  HARNESS_BASE_URL,
  renderGeneratedScreen,
  renderRoutes,
  renderWithProviders,
} from './providers.js';
import { expectTestIds, renderedTestIds } from './testIds.js';

const model = loadFixtureModel();

afterEach(() => {
  cleanup();
});

interface StubProps {
  title: string;
}
function StubScreen(props: StubProps): ReactElement {
  return (
    <section data-testid="pet-adopt-screen">
      <h1>{props.title}</h1>
      <button type="button" data-testid="pet-adopt-back">
        Back
      </button>
    </section>
  );
}

describe('createHarness', () => {
  it('registers the renderer defaults, then what `register` adds; the principal holds every capability', () => {
    const harness = createHarness({
      model,
      register: (registry) => {
        registry.register({
          key: 'screen.custom',
          schema: 'pet',
          target: 'pet_adopt',
          component: StubScreen,
          source: 'generated',
        });
      },
    });
    expect(harness.registry.resolve('field.text', 'pet', 'name').source).toBe('generated');
    expect(harness.registry.resolve('screen.custom', 'pet', 'pet_adopt').component).toBe(
      StubScreen,
    );
    expect(harness.principal?.capabilities).toEqual(['pet:delete', 'pet:read', 'pet:write']);
    expect(harness.services.model).toBe(model);
    expect(harness.i18n.t('agent.title')).toBe('Ask the agent');
  });

  it('uses a supplied registry and principal as given, and layers messages', () => {
    const registry = new ComponentRegistry();
    const harness = createHarness({
      model,
      registry,
      principal: null,
      messages: { 'pet.nav.label': 'Pets' },
    });
    expect(harness.registry).toBe(registry);
    expect(harness.principal).toBeNull();
    expect(harness.i18n.t('pet.nav.label')).toBe('Pets');
    expect(HARNESS_BASE_URL.startsWith('http://')).toBe(true);
  });
});

describe('renderWithProviders / renderGeneratedScreen / renderRoutes', () => {
  function Resolved(): ReactElement {
    const Field = useComponent<
      ComponentType<{ name: string; label: string; value: string; onChange: () => void }>
    >('field.text', 'pet', 'name').component;
    return <Field name="name" label="Name" value="Rex" onChange={() => undefined} />;
  }

  it('renders an element that resolves a renderer default through the registry', async () => {
    const { container } = renderWithProviders(<Resolved />, { model });
    expect(screen.getByTestId('field-name')).toBeTruthy();
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Rex');
    await expectNoViolations(container);
  });

  it('renders the screen registered at the coordinates with the given props', () => {
    renderGeneratedScreen<StubProps>({
      model,
      register: (registry) => {
        registry.register({
          key: 'screen.custom',
          schema: 'pet',
          target: 'pet_adopt',
          component: StubScreen,
          source: 'override',
        });
      },
      screen: { key: 'screen.custom', schema: 'pet', target: 'pet_adopt' },
      props: { title: 'Adopt' },
    });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Adopt');
    expectTestIds(document.body, renderedTestIds(model, 'pet', 'custom', 'adopt').slice(0, 1));
  });

  it('mounts a route table in a memory router', () => {
    const { router } = renderRoutes({
      model,
      routes: [{ path: '/pet', element: <StubScreen title="List" /> }],
      initialEntries: ['/pet'],
    });
    expect(router.state.location.pathname).toBe('/pet');
    expect(screen.getByTestId('pet-adopt-screen')).toBeTruthy();
  });
});

describe('renderedTestIds / expectTestIds', () => {
  it('lists the ids a screen with data carries, without the sort buttons of hidden columns', () => {
    const list = renderedTestIds(model, 'pet', 'list');
    expect(list).toContain('pet-list-sort-name');
    expect(list).not.toContain('pet-list-sort-entity_id');
    expect(list).toContain('pet-list-pager');
    const grid = renderedTestIds(model, 'pet', 'grid', 'available_pets');
    expect(grid).toContain('pet-grid-filters');
    expect(grid).toContain('pet-grid-sort-species');
    const detail = renderedTestIds(model, 'pet', 'detail');
    expect(detail).toEqual(
      expect.arrayContaining([
        'pet-detail-field-name',
        'pet-detail-group-details',
        'pet-detail-group-system',
        'pet-detail-back',
      ]),
    );
    const create = renderedTestIds(model, 'pet', 'create');
    expect(create).toEqual(
      expect.arrayContaining(['field-name', 'field-species', 'pet-create-group-details']),
    );
    expect(renderedTestIds(model, 'pet', 'edit')).not.toContain('field-species');
    expect(() => renderedTestIds(model, 'nope', 'list')).toThrow(/no schema nope/);
  });

  it('expectTestIds names every missing id', () => {
    const root = document.createElement('div');
    root.innerHTML = '<span data-testid="a"></span>';
    expectTestIds(root, ['a']);
    expect(() => {
      expectTestIds(root, ['a', 'b']);
    }).toThrow(/b/);
  });
});

describe('capability matrix', () => {
  it('builds one with/without pair per operation that names a capability', () => {
    expect(allCapabilities(model)).toEqual(['pet:delete', 'pet:read', 'pet:write']);
    const cases = capabilityCases(model);
    expect(cases.map((c) => c.operationId)).toEqual([
      'available_pets_query',
      'pet_create',
      'pet_delete',
      'pet_get',
      'pet_history',
      'pet_list',
      'pet_update',
    ]);
    const remove = cases.find((c) => c.operationId === 'pet_delete');
    expect(remove?.with.capabilities).toEqual(['pet:delete', 'pet:read', 'pet:write']);
    expect(remove?.without.capabilities).toEqual(['pet:read', 'pet:write']);
    expect(principalFor(['x'], 'customer')).toEqual({
      id: 'principal-customer',
      roles: ['customer'],
      capabilities: ['x'],
    });
  });
});
