import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentRegistry, FeatureModel } from '@star-board/core';
import {
  createTheme,
  RENDERER_DEFAULT_MESSAGES,
  ThemeRoot,
  type TokensTheme,
} from '@star-board/renderer-mui';
import {
  createClient,
  createI18n,
  I18nProvider,
  RegistryProvider,
  RUNTIME_DEFAULT_MESSAGES,
  ServicesProvider,
  type I18n,
  type Principal,
  type Services,
} from '@star-board/runtime';
import {
  buildCssVariables,
  buildMuiThemeInput,
  parseTokens,
  REFERENCE_MODES,
  type CssVariables,
} from '@star-board/tokens';
import type { ReactElement, ReactNode } from 'react';
import { createBrowserRouter, Navigate, RouterProvider, type RouteObject } from 'react-router';
import referenceTokens from '../../../tokens/reference.tokens.json' with { type: 'json' };
import { registerPetOverrides } from './features/pet/index.js';
import i18nDefaults from './generated/i18n.defaults.json' with { type: 'json' };
import { nav } from './generated/nav.js';
import { routes } from './generated/routes.js';
import { createGeneratedRegistry } from './generated/setup.js';
import { Layout } from './Layout.js';

/*
 * Composition root (hexagonal-rules typescript/05 §1): every adapter is built once here and put in
 * context; nothing below this file constructs a client, a registry or a theme.
 */

/** The demo principal: every capability of the petstore, role `staff`. */
export const DEMO_PRINCIPAL: Principal = {
  id: 'demo',
  roles: ['staff'],
  capabilities: ['pet:read', 'pet:write', 'pet:delete'],
};

export interface ServicesOptions {
  model: FeatureModel;
  /** Where the API lives; the msw worker answers `/api` in development. */
  baseUrl?: string;
  principal?: Principal | null;
  notify?: Services['notify'];
}

export function createServices(options: ServicesOptions): Services {
  const principal = options.principal === undefined ? DEMO_PRINCIPAL : options.principal;
  const auth: Services['auth'] = {
    getToken: () => Promise.resolve(null),
    getPrincipal: () => principal,
    onUnauthorized: () => undefined,
  };
  return {
    client: createClient(options.baseUrl ?? '/api', auth),
    auth,
    notify: options.notify ?? { notify: () => undefined },
    model: options.model,
  };
}

/** The renderer defaults, the generated screens, then (unless switched off) the overrides of `src/features`. */
export function createAppRegistry(overrides = true): ComponentRegistry {
  const registry = createGeneratedRegistry();
  if (overrides) registerPetOverrides(registry);
  return registry;
}

/**
 * Runtime and renderer strings under the generated defaults; a translation table layers on top
 * and `locale` drives the formatters (typescript/05 §7).
 */
export function createAppI18n(translations: Record<string, string> = {}, locale?: string): I18n {
  return createI18n(
    { ...RUNTIME_DEFAULT_MESSAGES, ...RENDERER_DEFAULT_MESSAGES, ...i18nDefaults },
    translations,
    locale === undefined ? {} : { locale },
  );
}

export interface AppTheme {
  theme: TokensTheme;
  cssVariables: CssVariables;
}

/** The MUI theme and CSS variables from the reference tokens (tokens are the theme source). */
export function createAppTheme(tokens: unknown = referenceTokens): AppTheme {
  const set = parseTokens(tokens);
  return {
    theme: createTheme(buildMuiThemeInput(set)),
    cssVariables: buildCssVariables(set, REFERENCE_MODES),
  };
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 5_000 } },
  });
}

export interface AppProvidersProps {
  services: Services;
  registry: ComponentRegistry;
  i18n: I18n;
  theme: AppTheme;
  queryClient: QueryClient;
  children: ReactNode;
}

export function AppProviders(props: AppProvidersProps): ReactElement {
  return (
    <QueryClientProvider client={props.queryClient}>
      <ThemeRoot theme={props.theme.theme} cssVariables={props.theme.cssVariables}>
        <RegistryProvider registry={props.registry}>
          <ServicesProvider services={props.services}>
            <I18nProvider i18n={props.i18n}>{props.children}</I18nProvider>
          </ServicesProvider>
        </RegistryProvider>
      </ThemeRoot>
    </QueryClientProvider>
  );
}

/** The generated routes under one layout; `/` goes to the first navigation entry. */
export function appRoutes(): RouteObject[] {
  const home = nav[0]?.path ?? '/';
  return [
    {
      path: '/',
      element: <Layout />,
      children: [{ index: true, element: <Navigate to={home} replace /> }, ...routes],
    },
  ];
}

export interface AppProps {
  model: FeatureModel;
  baseUrl?: string;
  /** The i18n locale; default the browser's. */
  locale?: string;
  /** Translations by key over the generated, renderer and runtime defaults. */
  messages?: Record<string, string>;
  /** Register `src/features` (default); false shows the generated defaults alone, for review. */
  overrides?: boolean;
}

export function App(props: AppProps): ReactElement {
  const services = createServices({
    model: props.model,
    ...(props.baseUrl === undefined ? {} : { baseUrl: props.baseUrl }),
  });
  return (
    <AppProviders
      services={services}
      registry={createAppRegistry(props.overrides ?? true)}
      i18n={createAppI18n(props.messages, props.locale)}
      theme={createAppTheme()}
      queryClient={createQueryClient()}
    >
      <RouterProvider router={createBrowserRouter(appRoutes())} />
    </AppProviders>
  );
}
