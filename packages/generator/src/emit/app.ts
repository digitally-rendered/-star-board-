import { pascalCase, quote } from '../plan/names.js';
import type { GenerationPlan, SchemaPlan, ScreenPlan } from '../plan/plan.js';
import { header, indent, lines, stableJson, type GeneratedFile, type Source } from './support.js';

/*
 * Wiring: the registry (the port between generator and app), the route table (primary adapter
 * containers pairing an application hook with a domain screen), navigation and i18n defaults.
 */

export const REGISTRY_PATH = 'registry.ts';
export const ROUTES_PATH = 'routes.tsx';
export const NAV_PATH = 'nav.ts';
export const I18N_JSON_PATH = 'i18n.defaults.json';
export const I18N_PATH = 'i18n.ts';
export const SETUP_PATH = 'setup.ts';
export const INDEX_PATH = 'index.ts';

function screenImport(schema: SchemaPlan, screen: ScreenPlan, from: string): string {
  return `import { ${screen.component} } from '${from}/domain/${schema.name}/${screen.file.replace(/\.tsx$/, '.js')}';`;
}

function screenPropsImport(schema: SchemaPlan, screen: ScreenPlan, from: string): string {
  return `import type { ${screen.component}Props } from '${from}/domain/${schema.name}/${screen.file.replace(/\.tsx$/, '.js')}';`;
}

function uniqueScreens(schema: SchemaPlan): ScreenPlan[] {
  return schema.screens.filter(
    (s, i, all) => all.findIndex((o) => o.component === s.component) === i,
  );
}

export function emitRegistry(plan: GenerationPlan, source: Source): GeneratedFile {
  return {
    path: REGISTRY_PATH,
    contents: lines([
      header(source),
      "import type { ComponentRegistry } from '@star-board/core';",
      ...plan.schemas.flatMap((schema) =>
        uniqueScreens(schema).map((s) => screenImport(schema, s, '.')),
      ),
      '',
      '/**',
      ' * Registers every generated screen as the match for its (schema, operation). The renderer',
      ' * registers the field, column, action and state components itself (`registerDefaults`); an',
      ' * override in src/features/<schema>/index.ts at the same coordinates wins by source',
      ' * (hexagonal-rules shared/01 §6a, typescript/12 §3).',
      ' */',
      'export function registerGenerated(registry: ComponentRegistry): void {',
      ...plan.schemas.flatMap((schema) =>
        schema.screens.map((s) =>
          indent(
            `registry.register({ key: ${quote(s.key)}, schema: ${quote(schema.name)}, target: ${quote(s.operationId)}, component: ${s.component}, source: 'generated' });`,
          ),
        ),
      ),
      '}',
    ]),
  };
}

function routeContainer(schema: SchemaPlan, screen: ScreenPlan): string {
  const { name, pascal } = schema;
  const listPath = schema.screens.find((s) => s.kind === 'list')?.route ?? `/${name}`;
  const container = `${screen.component.replace(/Screen$/, '')}${screen.view === null ? '' : pascalCase(screen.view)}Route`;
  const nav = (expr: string) => `() => {\n  void navigate(${expr});\n}`;
  const navId = (template: string, param = 'id') =>
    `(${param}) => {\n  void navigate(\`${template}\`);\n}`;
  // After a save the form is left on purpose: the navigation runs with the guard released.
  const saved = (expr: string, param: string | null) =>
    `(${param ?? ''}) => {\n  unsaved.release(() => void navigate(${expr}));\n}`;
  const collection = schema.actions.filter(
    (a) => a.mutation && !a.item && a.kind !== 'custom' && a.kind !== 'update',
  );
  const customs = schema.actions.filter((a) => a.item && a.kind === 'custom' && a.mutation);
  const detail = schema.screens.find((s) => s.kind === 'detail');
  const edit = schema.screens.find((s) => s.kind === 'edit');
  const create = schema.screens.find((s) => s.kind === 'create');
  const createAction = schema.actions.find((a) => a.id === screen.operationId);
  // The record operations answer with the Document unless the document declares a response schema.
  const afterCreate =
    detail && createAction !== undefined && !createAction.hasResponse
      ? saved(`\`/${name}/\${created.${schema.idField}}\``, 'created')
      : saved(quote(listPath), null);
  const onOpen = detail ? navId(`/${name}/\${id}`) : nav(quote(listPath));
  let body: string[];
  switch (screen.kind) {
    case 'list':
      body = [
        `const props = use${pascal}ListScreen({`,
        `  onOpen: ${indent(onOpen).trimStart()},`,
        ...collection.map(
          (a) =>
            `  on${pascalCase(a.operation)}: ${indent(nav(quote(a.kind === 'create' && create ? create.route : listPath))).trimStart()},`,
        ),
        '});',
      ];
      break;
    case 'grid':
      body = [
        `const props = use${pascalCase(screen.view ?? '')}GridScreen({`,
        `  onOpen: ${indent(onOpen).trimStart()},`,
        '});',
      ];
      break;
    case 'detail':
      body = [
        `const id = as${pascal}Id(useParams().id ?? '');`,
        `const props = use${pascal}DetailScreen(id, {`,
        edit
          ? `  onEdit: ${indent(navId(`/${name}/\${target}/edit`, 'target')).trimStart()},`
          : null,
        schema.actions.some((a) => a.kind === 'delete' && a.item)
          ? `  onDeleted: ${indent(nav(quote(listPath))).trimStart()},`
          : null,
        customs.length > 0
          ? `  onCustom: (operationId, target) => {\n    void navigate(\`/${name}/\${target}/\${operationId.slice(${name.length + 1})}\`);\n  },`
          : null,
        `  onBack: ${indent(nav(quote(listPath))).trimStart()},`,
        '});',
      ].filter((l): l is string => l !== null);
      break;
    case 'create':
      body = [
        `const props = use${pascal}CreateScreen({`,
        `  onCreated: ${indent(afterCreate).trimStart()},`,
        `  onCancel: ${indent(nav(quote(listPath))).trimStart()},`,
        '});',
      ];
      break;
    case 'edit':
      body = [
        `const id = as${pascal}Id(useParams().id ?? '');`,
        `const props = use${pascal}EditScreen(id, {`,
        `  onSaved: ${indent(saved(detail ? `\`/${name}/\${id}\`` : quote(listPath), null)).trimStart()},`,
        `  onCancel: ${indent(nav(detail ? `\`/${name}/\${id}\`` : quote(listPath))).trimStart()},`,
        '});',
      ];
      break;
    case 'custom': {
      const action = schema.actions.find((a) => a.id === screen.operationId);
      const item = action?.item ?? false;
      body = [
        item ? `const id = as${pascal}Id(useParams().id ?? '');` : null,
        `const props = use${pascal}${pascalCase(action?.operation ?? '')}Screen(${item ? 'id, ' : ''}{`,
        `  onBack: ${indent(nav(detail && item ? `\`/${name}/\${id}\`` : quote(listPath))).trimStart()},`,
        '});',
      ].filter((l): l is string => l !== null);
      break;
    }
  }
  const form = screen.kind === 'create' || screen.kind === 'edit';
  return lines([
    `function ${container}(): ReactElement {`,
    '  const navigate = useNavigate();',
    // The screen is resolved through the registry, so an override registered for the same
    // (schema, operation) replaces the generated default (typescript/12 §3).
    `  const Screen = useResolved<${screen.component}Props>(${quote(screen.key)}, ${quote(name)}, ${quote(screen.operationId)});`,
    ...(form
      ? [
          '  // The unsaved-changes dialog (typescript/05 §9): the renderer registers it at screen.custom / unsaved-changes.',
          `  const UnsavedChanges = useOptionalResolved<UnsavedChangesDialogProps>('screen.custom', ${quote(name)}, 'unsaved-changes');`,
        ]
      : []),
    ...body.map((l) => indent(l)),
    ...(form
      ? [
          '  // A dirty form holds navigation until the user decides; a save releases it (`onSaved` / `onCreated`).',
          '  const unsaved = useUnsavedChanges(props.dirty);',
          '  return (',
          '    <>',
          '      <Screen {...props} />',
          '      {UnsavedChanges === null ? null : (',
          '        <UnsavedChanges open={unsaved.blocked} onStay={unsaved.stay} onLeave={unsaved.leave} />',
          '      )}',
          '    </>',
          '  );',
        ]
      : ['  return <Screen {...props} />;']),
    '}',
  ]).trimEnd();
}

export function emitRoutes(plan: GenerationPlan, source: Source): GeneratedFile {
  const containers = plan.schemas.flatMap((schema) =>
    schema.screens.map((screen) => ({ schema, screen, text: routeContainer(schema, screen) })),
  );
  const containerName = (schema: SchemaPlan, screen: ScreenPlan) =>
    `${screen.component.replace(/Screen$/, '')}${screen.view === null ? '' : pascalCase(screen.view)}Route`;
  const needsParams = plan.schemas.some((s) =>
    s.screens.some(
      (sc) =>
        sc.kind === 'detail' ||
        sc.kind === 'edit' ||
        (sc.kind === 'custom' && s.actions.some((a) => a.id === sc.operationId && a.item)),
    ),
  );
  const routeFor = (schema: SchemaPlan, screen: ScreenPlan): string => {
    if (screen.kind !== 'custom') return screen.route;
    const action = schema.actions.find((a) => a.id === screen.operationId);
    return action?.item ? `/${schema.name}/:id/${action.operation}` : screen.route;
  };
  const needsUnsaved = plan.schemas.some((s) =>
    s.screens.some((sc) => sc.kind === 'create' || sc.kind === 'edit'),
  );
  const home = plan.nav[0]?.path ?? '/';
  return {
    path: ROUTES_PATH,
    contents: lines([
      header(source),
      "import type { ReactElement } from 'react';",
      `import { isRouteErrorResponse, useNavigate, ${needsParams ? 'useParams, ' : ''}useRouteError, type RouteObject } from 'react-router';`,
      needsUnsaved ? "import { useUnsavedChanges } from '@star-board/runtime';" : null,
      "import { messageOf } from './application/support.js';",
      needsUnsaved
        ? "import { stateProps, useOptionalResolved, useResolved, type StateProps, type UnsavedChangesDialogProps } from './domain/contract.js';"
        : "import { stateProps, useResolved, type StateProps } from './domain/contract.js';",
      "import { useT } from './i18n.js';",
      ...plan.schemas.flatMap((schema) => {
        const hooks = schema.screens.map((s) => hookNameFor(schema, s)).sort();
        return [
          `import { ${hooks.join(', ')} } from './application/${schema.name}/use${schema.pascal}Screens.js';`,
          ...uniqueScreens(schema).map((s) => screenPropsImport(schema, s, '.')),
          needsParams &&
          schema.screens.some(
            (s) => s.kind === 'detail' || s.kind === 'edit' || s.kind === 'custom',
          )
            ? `import { as${schema.pascal}Id } from './domain/${schema.name}/types.js';`
            : null,
        ];
      }),
      '',
      '/* Containers: one per generated screen, pairing its application hook with the registry-resolved screen. */',
      '',
      ...containers.flatMap((c) => [c.text, '']),
      '/** The way back from an error or an unknown address: the first navigation entry. */',
      `const HOME = ${quote(home)};`,
      '',
      '/** The not-found state: an address no route matches (the `*` route) or a 404 route error. */',
      'export function NotFoundRoute(): ReactElement {',
      '  const t = useT();',
      '  const navigate = useNavigate();',
      "  const Empty = useResolved<StateProps>('state.empty', '*', 'not-found');",
      '  return (',
      '    <Empty',
      "      {...stateProps(t('common.notFound'), t('common.notFoundDescription'), {",
      "        label: t('common.home'),",
      '        onClick: () => {',
      '          void navigate(HOME);',
      '        },',
      '      })}',
      '    />',
      '  );',
      '}',
      '',
      '/**',
      ' * What a route renders when it throws (`errorElement`): a 404 route error is the not-found state,',
      " * anything else the error state with a way home. Mounted inside the app's layout, so the frame stays.",
      ' */',
      'export function RouteErrorRoute(): ReactElement {',
      '  const t = useT();',
      '  const navigate = useNavigate();',
      '  const error: unknown = useRouteError();',
      "  const ErrorState = useResolved<StateProps>('state.error', '*', 'route');",
      '  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundRoute />;',
      '  return (',
      '    <ErrorState',
      "      {...stateProps(t('common.error'), messageOf(error), {",
      "        label: t('common.home'),",
      '        onClick: () => {',
      '          void navigate(HOME);',
      '        },',
      '      })}',
      '    />',
      '  );',
      '}',
      '',
      '/** Route objects in a stable order; static (no lazy loading) so the table is inspectable. */',
      'export const routes: RouteObject[] = [',
      ...plan.schemas.flatMap((schema) =>
        schema.screens.map((s) =>
          indent(
            `{ path: ${quote(routeFor(schema, s))}, element: <${containerName(schema, s)} />, errorElement: <RouteErrorRoute /> },`,
          ),
        ),
      ),
      "  { path: '*', element: <NotFoundRoute /> },",
      '];',
    ]),
  };
}

function hookNameFor(schema: SchemaPlan, screen: ScreenPlan): string {
  switch (screen.kind) {
    case 'grid':
      return `use${pascalCase(screen.view ?? '')}GridScreen`;
    case 'custom': {
      const action = schema.actions.find((a) => a.id === screen.operationId);
      return `use${schema.pascal}${pascalCase(action?.operation ?? '')}Screen`;
    }
    default:
      return `use${screen.component}`;
  }
}

export function emitNav(plan: GenerationPlan, source: Source): GeneratedFile {
  return {
    path: NAV_PATH,
    contents: lines([
      header(source),
      "import { t, type I18nKey } from './i18n.js';",
      '',
      'export interface NavEntry {',
      '  schema: string;',
      '  /** The default text; a frame that follows the locale renders `t(i18nKey)` instead. */',
      '  label: string;',
      '  i18nKey: I18nKey;',
      '  path: string;',
      '}',
      '',
      '/** One entry per schema, ordered by schema name; the label is the i18n default. */',
      'export const nav: readonly NavEntry[] = [',
      ...plan.nav.map((n) =>
        indent(
          `{ schema: ${quote(n.schema)}, label: t(${quote(n.i18nKey)}), i18nKey: ${quote(n.i18nKey)}, path: ${quote(n.path)} },`,
        ),
      ),
      '];',
    ]),
  };
}

export function emitI18nJson(plan: GenerationPlan): GeneratedFile {
  return { path: I18N_JSON_PATH, contents: stableJson(plan.i18n) };
}

export function emitI18n(
  plan: GenerationPlan,
  source: Source,
  withRuntime: boolean,
): GeneratedFile {
  if (!withRuntime) {
    return {
      path: I18N_PATH,
      contents: lines([
        header(source),
        '// Generated with `i18n: false`: labels are the defaults and no i18n runtime is wired.',
        'const defaults = {',
        ...Object.entries(plan.i18n).map(([k, v]) => indent(`${quote(k)}: ${quote(v)},`)),
        '} as const;',
        '',
        'export type I18nKey = keyof typeof defaults;',
        'export type Vars = Record<string, string | number>;',
        'export type T = (key: I18nKey, vars?: Vars) => string;',
        '',
        'export function t(key: I18nKey, vars?: Vars): string {',
        '  const text: string = defaults[key];',
        '  if (vars === undefined) return text;',
        '  return text.replace(/\\{(\\w+)\\}/g, (match, name: string) => {',
        '    const value = vars[name];',
        '    return value === undefined ? match : String(value);',
        '  });',
        '}',
        '',
        '/** No provider is wired: the defaults are the only table. */',
        'export function useT(): T {',
        '  return t;',
        '}',
      ]),
    };
  }
  return {
    path: I18N_PATH,
    contents: lines([
      header(source),
      "import { useMemo } from 'react';",
      "import { createI18n, useI18n, type Vars } from '@star-board/runtime';",
      "import defaults from './i18n.defaults.json' with { type: 'json' };",
      '',
      '/** Every message key the generated screens use; translations override by key. */',
      'export type I18nKey = keyof typeof defaults;',
      'export type { Vars };',
      'export type T = (key: I18nKey, vars?: Vars) => string;',
      '',
      '/** The defaults as an instance: the fallback of `useT` and the table for module-level labels. */',
      'export const i18n = createI18n(defaults);',
      '',
      '/** The default text of `key` (no provider). Components call `useT` so a locale switch reaches them. */',
      'export function t(key: I18nKey, vars?: Vars): string {',
      '  return i18n.t(key, vars);',
      '}',
      '',
      '/**',
      ' * `t` from the nearest I18nProvider (its locale and translations, typescript/05 §7), typed by the',
      ' * generated keys; a key the provider lacks falls back to the generated default.',
      ' */',
      'export function useT(): T {',
      '  const provided = useI18n();',
      '  return useMemo(',
      '    () => (key: I18nKey, vars?: Vars) =>',
      '      provided.has(key) ? provided.t(key, vars) : i18n.t(key, vars),',
      '    [provided],',
      '  );',
      '}',
    ]),
  };
}

export function emitSetup(renderer: string, source: Source): GeneratedFile {
  return {
    path: SETUP_PATH,
    contents: lines([
      header(source),
      "import { ComponentRegistry } from '@star-board/core';",
      `import { registerDefaults } from ${quote(renderer)};`,
      "import { registerGenerated } from './registry.js';",
      '',
      '/**',
      ' * Composition root for the registry: the renderer defaults first (universal match), then the',
      ' * generated screens. Register overrides from src/features/<schema>/index.ts afterwards.',
      ' */',
      'export function createGeneratedRegistry(): ComponentRegistry {',
      '  const registry = new ComponentRegistry();',
      '  registerDefaults(registry);',
      '  registerGenerated(registry);',
      '  return registry;',
      '}',
    ]),
  };
}

export function emitIndex(
  plan: GenerationPlan,
  source: Source,
  files: readonly string[],
): GeneratedFile {
  const has = (path: string) => files.includes(path);
  return {
    path: INDEX_PATH,
    contents: lines([
      header(source),
      ...plan.schemas.flatMap((schema) => [
        `export * from './domain/${schema.name}/types.js';`,
        `export * from './domain/${schema.name}/schemas.js';`,
        `export * from './domain/${schema.name}/columns.js';`,
        ...uniqueScreens(schema).map(
          (s) => `export * from './domain/${schema.name}/${s.file.replace(/\.tsx$/, '.js')}';`,
        ),
        `export * from './application/${schema.name}/use${schema.pascal}Actions.js';`,
        `export * from './application/${schema.name}/use${schema.pascal}Screens.js';`,
      ]),
      "export * from './domain/contract.js';",
      "export { AgentPanelSlot } from './domain/AgentPanelSlot.js';",
      "export * from './adapters/paths.js';",
      "export * from './adapters/client.js';",
      "export { registerGenerated } from './registry.js';",
      "export { createGeneratedRegistry } from './setup.js';",
      "export { NotFoundRoute, RouteErrorRoute, routes } from './routes.js';",
      "export { nav, type NavEntry } from './nav.js';",
      has(I18N_PATH)
        ? "export { t, useT, type I18nKey, type T, type Vars } from './i18n.js';"
        : null,
    ]),
  };
}
