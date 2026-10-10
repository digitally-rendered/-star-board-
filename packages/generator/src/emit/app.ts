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
      ? navId(`/${name}/\${created.${schema.idField}}`, 'created')
      : nav(quote(listPath));
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
        `  onSaved: ${indent(nav(detail ? `\`/${name}/\${id}\`` : quote(listPath))).trimStart()},`,
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
  return lines([
    `function ${container}(): ReactElement {`,
    '  const navigate = useNavigate();',
    ...body.map((l) => indent(l)),
    `  return <${screen.component} {...props} />;`,
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
  return {
    path: ROUTES_PATH,
    contents: lines([
      header(source),
      "import type { ReactElement } from 'react';",
      `import { ${needsParams ? 'useNavigate, useParams' : 'useNavigate'}, type RouteObject } from 'react-router';`,
      ...plan.schemas.flatMap((schema) => {
        const hooks = schema.screens.map((s) => hookNameFor(schema, s)).sort();
        return [
          `import { ${hooks.join(', ')} } from './application/${schema.name}/use${schema.pascal}Screens.js';`,
          ...uniqueScreens(schema).map((s) => screenImport(schema, s, '.')),
          needsParams &&
          schema.screens.some(
            (s) => s.kind === 'detail' || s.kind === 'edit' || s.kind === 'custom',
          )
            ? `import { as${schema.pascal}Id } from './domain/${schema.name}/types.js';`
            : null,
        ];
      }),
      '',
      '/* Containers: one per generated screen, pairing its application hook with the domain screen. */',
      '',
      ...containers.flatMap((c) => [c.text, '']),
      '/** Route objects in a stable order; static (no lazy loading) so the table is inspectable. */',
      'export const routes: RouteObject[] = [',
      ...plan.schemas.flatMap((schema) =>
        schema.screens.map((s) =>
          indent(
            `{ path: ${quote(routeFor(schema, s))}, element: <${containerName(schema, s)} /> },`,
          ),
        ),
      ),
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
      "import { t } from './i18n.js';",
      '',
      'export interface NavEntry {',
      '  schema: string;',
      '  label: string;',
      '  i18nKey: string;',
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
        '',
        'export function t(key: I18nKey): string {',
        '  return defaults[key];',
        '}',
      ]),
    };
  }
  return {
    path: I18N_PATH,
    contents: lines([
      header(source),
      "import { createI18n } from '@star-board/runtime';",
      "import defaults from './i18n.defaults.json' with { type: 'json' };",
      '',
      '/** Every message key the generated screens use; translations override by key. */',
      'export type I18nKey = keyof typeof defaults;',
      '',
      'export const i18n = createI18n(defaults);',
      '',
      'export function t(key: I18nKey): string {',
      '  return i18n.t(key);',
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
      "export { routes } from './routes.js';",
      "export { nav, type NavEntry } from './nav.js';",
      has(I18N_PATH) ? "export { t, type I18nKey } from './i18n.js';" : null,
    ]),
  };
}
