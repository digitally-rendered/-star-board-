import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ComponentRegistry, FeatureModelSchema, type FeatureModel } from '@star-board/core';
import { vi } from 'vitest';
import { createClient } from '../src/client/createClient.js';
import type { AuthPort, NotifyPort, Principal } from '../src/ports.js';
import { RegistryProvider } from '../src/registry/RegistryProvider.js';
import { ServicesProvider, type Services } from '../src/services/ServicesProvider.js';

export const BASE_URL = 'http://api.test';

export const principal: Principal = {
  id: 'u1',
  roles: ['admin'],
  capabilities: ['pet:read', 'pet:write'],
};

export function makeAuth(overrides: Partial<AuthPort> & { token?: string | null } = {}): AuthPort {
  const { token = 'tok-1', ...rest } = overrides;
  return {
    getToken: vi.fn(() => Promise.resolve(token)),
    getPrincipal: vi.fn(() => principal),
    onUnauthorized: vi.fn(),
    ...rest,
  };
}

export function makeNotify(): NotifyPort {
  return { notify: vi.fn() };
}

/** A hand-built FeatureModel shaped like the petstore fixture; validated by the core schema. */
export const model: FeatureModel = FeatureModelSchema.parse({
  title: 'petstore',
  version: '1.0.0',
  posture: '404',
  schemas: {
    pet: {
      name: 'pet',
      version: '1.2.0',
      document: {},
      create: {},
      update: {},
      ownerField: 'owner_id',
      reasons: {},
      ui: {},
    },
  },
  views: {
    'available-pets': {
      name: 'available-pets',
      schema: 'pet',
      operationId: 'available_pets_query',
      projection: ['name'],
      limits: { default: 20, max: 100 },
    },
  },
  operations: {
    pet_list: {
      id: 'pet_list',
      schema: 'pet',
      operation: 'list',
      kind: 'list',
      method: 'get',
      path: '/pet',
      capabilities: ['pet:read'],
    },
    pet_get: {
      id: 'pet_get',
      schema: 'pet',
      operation: 'get',
      kind: 'get',
      method: 'get',
      path: '/pet/{id}',
      capabilities: ['pet:read'],
    },
    pet_create: {
      id: 'pet_create',
      schema: 'pet',
      operation: 'create',
      kind: 'create',
      method: 'post',
      path: '/pet',
      capabilities: ['pet:write'],
    },
    pet_update: {
      id: 'pet_update',
      schema: 'pet',
      operation: 'update',
      kind: 'update',
      method: 'patch',
      path: '/pet/{id}',
      capabilities: ['pet:write'],
    },
    pet_delete: {
      id: 'pet_delete',
      schema: 'pet',
      operation: 'delete',
      kind: 'delete',
      method: 'delete',
      path: '/pet/{id}',
      capabilities: ['pet:delete'],
    },
    available_pets_query: {
      id: 'available_pets_query',
      schema: 'pet',
      operation: 'available_pets_query',
      kind: 'view',
      method: 'get',
      path: '/views/available-pets',
      capabilities: ['pet:read'],
    },
  },
});

/** `model: undefined` removes the model, so a test can exercise the fail-closed paths. */
export function makeServices(
  overrides: Omit<Partial<Services>, 'model'> & { model?: FeatureModel | undefined } = {},
): Services {
  const auth = overrides.auth ?? makeAuth();
  const { model: modelOverride, ...rest } = overrides;
  const services: Services = {
    client: createClient(BASE_URL, auth),
    auth,
    notify: makeNotify(),
    ...rest,
  };
  const chosen = 'model' in overrides ? modelOverride : model;
  if (chosen !== undefined) services.model = chosen;
  return services;
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

export function Providers(props: {
  services: Services;
  registry?: ComponentRegistry;
  queryClient?: QueryClient;
  children?: ReactNode;
}) {
  const registry = props.registry ?? new ComponentRegistry();
  const queryClient = props.queryClient ?? makeQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <ServicesProvider services={props.services}>
        <RegistryProvider registry={registry}>{props.children}</RegistryProvider>
      </ServicesProvider>
    </QueryClientProvider>
  );
}

/** A `wrapper` for `renderHook`/`render` over one services instance. */
export function wrapperFor(
  services: Services,
  extra: { registry?: ComponentRegistry; queryClient?: QueryClient } = {},
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Providers services={services} {...extra}>
        {children}
      </Providers>
    );
  };
}
