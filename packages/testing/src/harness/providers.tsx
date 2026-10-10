import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ComponentRegistry, type ComponentKey, type FeatureModel } from '@star-board/core';
import {
  registerDefaults,
  RENDERER_DEFAULT_MESSAGES,
  ThemeRoot,
  type ThemeRootProps,
} from '@star-board/renderer-mui';
import {
  createClient,
  createI18n,
  I18nProvider,
  RegistryProvider,
  RUNTIME_DEFAULT_MESSAGES,
  ServicesProvider,
  type AgentPort,
  type I18n,
  type Principal,
  type Services,
} from '@star-board/runtime';
import { render, type RenderResult } from '@testing-library/react';
import { createElement, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { allCapabilities } from './capabilities.js';

/*
 * The screen harness (hexagonal-rules typescript/12 §7): mounts generated screens, route
 * containers or any element under the runtime providers the app itself uses — a QueryClient, the
 * registry (renderer defaults first, then whatever `register` adds: the generated screens and
 * the overrides), Services over a client that msw answers, and the i18n table. Tests own the
 * msw server (`setupServerFromModel`); the harness only points the client at it.
 */

/** Where the harness client sends requests; absolute, as fetch in jsdom resolves no relative URL. */
export const HARNESS_BASE_URL = 'http://star-board.test/api';

export interface HarnessOptions {
  model: FeatureModel;
  /** Adds registrations after the renderer defaults: `registerGenerated`, then overrides. */
  register?: (registry: ComponentRegistry) => void;
  /** A registry to use as is (no defaults are added). */
  registry?: ComponentRegistry;
  /** Default: a principal holding every capability of the document. `null` is anonymous. */
  principal?: Principal | null;
  baseUrl?: string;
  /** Message defaults layered over the runtime and renderer ones (the generated `i18n.defaults.json`). */
  messages?: Record<string, string>;
  agent?: AgentPort;
  /** The tokens theme; without it MUI renders with its built-in theme. */
  theme?: Pick<ThemeRootProps, 'theme' | 'cssVariables'>;
  queryClient?: QueryClient;
}

export interface Harness {
  registry: ComponentRegistry;
  services: Services;
  i18n: I18n;
  queryClient: QueryClient;
  principal: Principal | null;
  /** Wraps `children` in every provider; pass as RTL's `wrapper`. */
  Providers: ComponentType<{ children?: ReactNode }>;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
}

export function createHarness(options: HarnessOptions): Harness {
  const principal =
    options.principal === undefined
      ? { id: 'harness', roles: ['staff'], capabilities: allCapabilities(options.model) }
      : options.principal;
  const auth: Services['auth'] = {
    getToken: () => Promise.resolve(null),
    getPrincipal: () => principal,
    onUnauthorized: () => undefined,
  };
  const services: Services = {
    client: createClient(options.baseUrl ?? HARNESS_BASE_URL, auth),
    auth,
    notify: { notify: () => undefined },
    model: options.model,
    ...(options.agent === undefined ? {} : { agent: options.agent }),
  };
  let registry = options.registry;
  if (registry === undefined) {
    registry = new ComponentRegistry();
    registerDefaults(registry);
    options.register?.(registry);
  }
  const i18n = createI18n({
    ...RUNTIME_DEFAULT_MESSAGES,
    ...RENDERER_DEFAULT_MESSAGES,
    ...(options.messages ?? {}),
  });
  const queryClient = options.queryClient ?? createQueryClient();
  const theme = options.theme;
  const resolved = registry;
  const Providers = (props: { children?: ReactNode }): ReactElement => {
    const tree = (
      <RegistryProvider registry={resolved}>
        <ServicesProvider services={services}>
          <I18nProvider i18n={i18n}>{props.children}</I18nProvider>
        </ServicesProvider>
      </RegistryProvider>
    );
    return (
      <QueryClientProvider client={queryClient}>
        {theme === undefined ? (
          tree
        ) : (
          <ThemeRoot theme={theme.theme} cssVariables={theme.cssVariables}>
            {tree}
          </ThemeRoot>
        )}
      </QueryClientProvider>
    );
  };
  return { registry: resolved, services, i18n, queryClient, principal, Providers };
}

export interface HarnessRender extends RenderResult {
  harness: Harness;
}

/** Renders `ui` under the providers. */
export function renderWithProviders(ui: ReactElement, options: HarnessOptions): HarnessRender {
  const harness = createHarness(options);
  const result = render(ui, { wrapper: harness.Providers });
  return Object.assign(result, { harness });
}

export interface ScreenCoordinates {
  key: ComponentKey;
  schema: string;
  /** The operation id of the screen (its registry target). */
  target: string;
}

export interface RenderScreenOptions<P extends object> extends HarnessOptions {
  screen: ScreenCoordinates;
  props: P;
}

/**
 * Resolves the screen registered at `screen` (generated default or override) and renders it with
 * `props` — the props-only half of a screen, no container hook, no network.
 */
export function renderGeneratedScreen<P extends object>(
  options: RenderScreenOptions<P>,
): HarnessRender {
  const harness = createHarness(options);
  const registration = harness.registry.resolve<ComponentType<P>>(
    options.screen.key,
    options.screen.schema,
    options.screen.target,
    { version: options.model.schemas[options.screen.schema]?.version ?? '' },
  );
  const result = render(createElement(registration.component, options.props), {
    wrapper: harness.Providers,
  });
  return Object.assign(result, { harness });
}

export interface RenderRoutesOptions extends HarnessOptions {
  routes: RouteObject[];
  /** Where the memory router starts; default `['/']`. */
  initialEntries?: string[];
}

export interface RoutesRender extends HarnessRender {
  router: ReturnType<typeof createMemoryRouter>;
}

/**
 * Mounts the generated route table (containers with their hooks) in a memory router under the
 * providers: the full workflow, answered by msw.
 */
export function renderRoutes(options: RenderRoutesOptions): RoutesRender {
  const harness = createHarness(options);
  const router = createMemoryRouter(options.routes, {
    initialEntries: options.initialEntries ?? ['/'],
  });
  const result = render(<RouterProvider router={router} />, { wrapper: harness.Providers });
  return Object.assign(result, { harness, router });
}
