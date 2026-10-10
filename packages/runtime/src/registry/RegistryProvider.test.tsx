import { ComponentRegistry, RegistryError } from '@star-board/core';
import { render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeAuth, makeServices, Providers, wrapperFor } from '../../test/helpers.js';
import {
  RegistryProvider,
  ScopeProvider,
  useComponent,
  useRegistry,
  useScope,
} from './RegistryProvider.js';

function registryWith(): ComponentRegistry {
  const registry = new ComponentRegistry();
  registry.register({
    key: 'field.text',
    schema: '*',
    target: '*',
    component: 'universal',
    source: 'generated',
  });
  registry.register({
    key: 'field.text',
    schema: 'pet',
    target: 'name',
    component: 'pet-name',
    source: 'override',
  });
  registry.register({
    key: 'field.text',
    schema: 'pet',
    target: 'name',
    scope: { role: 'admin' },
    component: 'pet-name-admin',
    source: 'override',
  });
  registry.register({
    key: 'field.text',
    schema: 'pet',
    target: 'name',
    scope: { version: '1.2.0', role: 'admin' },
    component: 'pet-name-admin-1.2',
    source: 'override',
  });
  return registry;
}

describe('RegistryProvider', () => {
  it('exposes the registry and throws without one', () => {
    const registry = new ComponentRegistry();
    const { result } = renderHook(() => useRegistry(), {
      wrapper: ({ children }) => (
        <RegistryProvider registry={registry}>{children}</RegistryProvider>
      ),
    });
    expect(result.current).toBe(registry);
    expect(() => renderHook(() => useRegistry())).toThrow(/no RegistryProvider/);
  });
});

describe('useScope', () => {
  it('takes the role from the principal and the version from the ScopeProvider', () => {
    const services = makeServices();
    const { result } = renderHook(() => useScope(), {
      wrapper: ({ children }) => (
        <Providers services={services}>
          <ScopeProvider version="2.0.0">{children}</ScopeProvider>
        </Providers>
      ),
    });
    expect(result.current).toEqual({ version: '2.0.0', role: 'admin' });
  });
  it('is empty for an anonymous principal and lets a pinned role win', () => {
    const anonymous = makeServices({ auth: makeAuth({ getPrincipal: vi.fn(() => null) }) });
    expect(renderHook(() => useScope(), { wrapper: wrapperFor(anonymous) }).result.current).toEqual(
      {},
    );
    const pinned = renderHook(() => useScope(), {
      wrapper: ({ children }) => (
        <Providers services={makeServices()}>
          <ScopeProvider role="viewer">{children}</ScopeProvider>
        </Providers>
      ),
    });
    expect(pinned.result.current).toEqual({ role: 'viewer' });
  });
});

describe('useComponent', () => {
  it('resolves through the registry with the principal role and the schema version', () => {
    const { result } = renderHook(() => useComponent<string>('field.text', 'pet', 'name'), {
      wrapper: wrapperFor(makeServices(), { registry: registryWith() }),
    });
    expect(result.current.component).toBe('pet-name-admin-1.2');
    expect(result.current.source).toBe('override');
    expect(result.current.specificity).toBe(4);
  });

  it('respects role scope: another role never sees the admin override', () => {
    const viewer = makeServices({
      auth: makeAuth({
        getPrincipal: vi.fn(() => ({ id: 'v', roles: ['viewer'], capabilities: [] })),
      }),
    });
    const { result } = renderHook(() => useComponent<string>('field.text', 'pet', 'name'), {
      wrapper: wrapperFor(viewer, { registry: registryWith() }),
    });
    expect(result.current.component).toBe('pet-name');
    const other = renderHook(() => useComponent<string>('field.text', 'pet', 'species'), {
      wrapper: wrapperFor(viewer, { registry: registryWith() }),
    });
    expect(other.result.current.component).toBe('universal');
  });

  it('a pinned version overrides the model version', () => {
    const services = makeServices();
    function Probe() {
      const reg = useComponent<string>('field.text', 'pet', 'name');
      return <output data-testid="c">{reg.component}</output>;
    }
    render(
      <Providers services={services} registry={registryWith()}>
        <ScopeProvider version="9.9.9">
          <Probe />
        </ScopeProvider>
      </Providers>,
    );
    expect(screen.getByTestId('c').textContent).toBe('pet-name-admin');
  });

  it('lets the core RegistryError through unchanged', () => {
    const silence = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(() =>
        renderHook(() => useComponent('state.empty', 'pet', '*'), {
          wrapper: wrapperFor(makeServices(), { registry: registryWith() }),
        }),
      ).toThrow(RegistryError);
      let caught: unknown;
      try {
        renderHook(() => useComponent('state.empty', 'pet', '*'), {
          wrapper: wrapperFor(makeServices(), { registry: registryWith() }),
        });
      } catch (e) {
        caught = e;
      }
      expect((caught as RegistryError).code).toBe('REGISTRY_UNRESOLVED');
    } finally {
      silence.mockRestore();
    }
  });
});
