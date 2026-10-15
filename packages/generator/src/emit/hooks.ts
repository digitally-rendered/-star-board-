import { pascalCase, quote } from '../plan/names.js';
import type {
  ActionPlan,
  FormFieldPlan,
  GenerationPlan,
  SchemaPlan,
  ScreenPlan,
} from '../plan/plan.js';
import { listColumnsConstName, viewConstName } from './screens.js';
import { header, indent, lines, type GeneratedFile, type Source } from './support.js';
import { viewRowType } from './types.js';

/*
 * Application layer (hexagonal-rules typescript/01 §3): thin typed action hooks over the runtime's
 * `useMutation`, and container hooks that wire `useEntity`/`useEntityList`/`useView` plus the
 * capability check to the props of the generated screens. Nothing here fetches on its own.
 */

export const APPLICATION_SUPPORT_PATH = 'application/support.ts';

export function emitApplicationSupport(source: Source): GeneratedFile {
  return {
    path: APPLICATION_SUPPORT_PATH,
    contents: lines([
      header(source),
      "import { useCallback, useMemo, useState } from 'react';",
      "import { etagOf, isHttpError, type ListQuery, type Versioned, type ViewQuery } from '@star-board/runtime';",
      "import type { ScreenStatus, SortDirection, SortState } from '../domain/contract.js';",
      "import type { T } from '../i18n.js';",
      '',
      '/** The shape the shared data hooks report; only these members are read. */',
      'export interface QueryLike {',
      '  loading: boolean;',
      '  error: unknown;',
      '}',
      '',
      '/**',
      ' * Loading, then error, then ready (typescript/05 §2). A 404 reads as "nothing to show" so the',
      ' * screen renders its empty state (the 404 posture makes it indistinguishable from a denial); a',
      ' * 403 is the forbidden state.',
      ' */',
      'export function statusOf(result: QueryLike, allowed: boolean): ScreenStatus {',
      "  if (!allowed) return 'forbidden';",
      "  if (result.loading) return 'loading';",
      "  if (result.error === undefined || result.error === null) return 'ready';",
      '  if (isHttpError(result.error)) {',
      "    if (result.error.status === 404) return 'ready';",
      "    if (result.error.status === 403) return 'forbidden';",
      '  }',
      "  return 'error';",
      '}',
      '',
      'export function messageOf(error: unknown): string | undefined {',
      '  if (error === undefined || error === null) return undefined;',
      '  if (error instanceof Error) return error.message;',
      "  return typeof error === 'string' ? error : JSON.stringify(error);",
      '}',
      '',
      '/** The members of a zod 4 issue the message mapper reads; structural, so any issue shape fits. */',
      'export interface IssueLike {',
      '  code: string;',
      '  path: readonly PropertyKey[];',
      '  message: string;',
      '  input?: unknown;',
      '  expected?: unknown;',
      '  values?: readonly unknown[];',
      '  minimum?: unknown;',
      '  maximum?: unknown;',
      '  origin?: unknown;',
      '  format?: unknown;',
      '}',
      '',
      '/**',
      ' * A zod issue as a sentence for the person filling the form (typescript/05 §7: a key per case,',
      " * never zod's own text). A missing required value reads as required whatever the expected type;",
      ' * everything the table does not name falls back to `validation.invalid`.',
      ' */',
      'export function messageForIssue(issue: IssueLike, t: T, label: string): string {',
      '  const missing = issue.input === undefined || issue.input === null;',
      '  switch (issue.code) {',
      "    case 'invalid_type':",
      "      return missing ? t('validation.required', { label }) : t('validation.invalid');",
      "    case 'invalid_value':",
      "      return missing ? t('validation.required', { label }) : t('validation.invalidOption');",
      "    case 'too_big':",
      "      return issue.origin === 'string'",
      "        ? t('validation.maxLength', { max: String(issue.maximum) })",
      "        : t('validation.max', { max: String(issue.maximum) });",
      "    case 'too_small':",
      "      return issue.origin === 'string'",
      "        ? t('validation.minLength', { min: String(issue.minimum) })",
      "        : t('validation.min', { min: String(issue.minimum) });",
      "    case 'invalid_format':",
      "      return t('validation.invalidFormat', { format: String(issue.format) });",
      '    default:',
      "      return t('validation.invalid');",
      '  }',
      '}',
      '',
      '/** zod issues → first message per top-level field, worded through `messageForIssue` with the field labels. */',
      'export function fieldErrors(',
      '  issues: readonly IssueLike[],',
      '  t: T,',
      '  labels: Readonly<Record<string, string>>,',
      '): Record<string, string> {',
      '  const errors: Record<string, string> = {};',
      '  for (const issue of issues) {',
      "    const key = issue.path.length > 0 ? String(issue.path[0]) : '';",
      '    errors[key] ??= messageForIssue(issue, t, labels[key] ?? key);',
      '  }',
      '  return errors;',
      '}',
      '',
      '/**',
      ' * A form is dirty once a value differs from what it started with (typescript/05 §9: unsaved',
      ' * changes hold navigation); `initial` is the create defaults, or nothing for the edit deltas.',
      ' */',
      'export function isDirty(',
      '  values: Readonly<Record<string, unknown>>,',
      '  initial: Readonly<Record<string, unknown>> = {},',
      '): boolean {',
      '  return Object.entries(values).some(([field, value]) => value !== initial[field]);',
      '}',
      '',
      '/** The per-field messages of a 422 response (RFC 7807 `errors` or the envelope `details`). */',
      'export function serverFieldErrors(error: unknown): Record<string, string> {',
      '  return isHttpError(error) && error.fields !== undefined ? { ...error.fields } : {};',
      '}',
      '',
      '/** The `entity_id` and `record_version` of a document, for If-Match (typescript/02 §3). */',
      'export function versionedOf(entity: object): Versioned {',
      '  const record: Record<string, unknown> = { ...entity };',
      '  const id = record.entity_id ?? record.entityId;',
      '  const version = record.record_version ?? record.recordVersion;',
      '  const out: Versioned = {};',
      "  if (typeof id === 'string') out.entity_id = id;",
      "  if (typeof version === 'number') out.record_version = version;",
      '  return out;',
      '}',
      '',
      '/** `W/"<id>:<version>"` of a loaded document, or undefined when it carries no version. */',
      'export function etagFor(entity: object | undefined): string | undefined {',
      '  if (entity === undefined) return undefined;',
      '  const versioned = versionedOf(entity);',
      '  if (versioned.entity_id === undefined || versioned.record_version === undefined) return undefined;',
      '  return etagOf(versioned);',
      '}',
      '',
      '/** `name` or `-name`: the sort spelling the backend routers and the runtime ListQuery share. */',
      'export function sortParam(sort: SortState | undefined): string | undefined {',
      '  if (sort === undefined) return undefined;',
      "  return sort.dir === 'desc' ? `-${sort.field}` : sort.field;",
      '}',
      '',
      'export interface ListState {',
      '  page: number;',
      '  pageSize: number;',
      '  sort: SortState | undefined;',
      '  filters: Record<string, string>;',
      '  /** For `useEntityList`: page, pageSize, sort and `where` from the set filters. */',
      '  query: ListQuery;',
      '  /** For `useView`: page, limit, sort and one query parameter per set filter. */',
      '  viewQuery: ViewQuery;',
      '  setPage: (page: number) => void;',
      '  setSort: (field: string, dir: SortDirection) => void;',
      '  setFilter: (field: string, value: string) => void;',
      '}',
      '',
      '/** Page, sort and filter state of one list or grid; the queries omit unset members. */',
      'export function useListState(pageSize: number, initialSort?: SortState): ListState {',
      '  const [page, setPage] = useState(1);',
      '  const [sort, setSortState] = useState<SortState | undefined>(initialSort);',
      '  const [filters, setFilters] = useState<Record<string, string>>({});',
      '  const setSort = useCallback((field: string, dir: SortDirection) => {',
      '    setSortState({ field, dir });',
      '    setPage(1);',
      '  }, []);',
      '  const setFilter = useCallback((field: string, value: string) => {',
      '    setFilters((previous) => ({ ...previous, [field]: value }));',
      '    setPage(1);',
      '  }, []);',
      '  const active = useMemo(',
      "    () => Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')),",
      '    [filters],',
      '  );',
      '  const query = useMemo<ListQuery>(() => {',
      '    const out: ListQuery = { page, pageSize };',
      '    const sortValue = sortParam(sort);',
      '    if (sortValue !== undefined) out.sort = sortValue;',
      '    if (Object.keys(active).length > 0) out.where = active;',
      '    return out;',
      '  }, [active, page, pageSize, sort]);',
      '  const viewQuery = useMemo<ViewQuery>(() => {',
      '    const out: ViewQuery = { ...active, page, limit: pageSize };',
      '    const sortValue = sortParam(sort);',
      '    if (sortValue !== undefined) out.sort = sortValue;',
      '    return out;',
      '  }, [active, page, pageSize, sort]);',
      '  return { page, pageSize, sort, filters, query, viewQuery, setPage, setSort, setFilter };',
      '}',
    ]),
  };
}

function hookName(schema: SchemaPlan, action: ActionPlan): string {
  return `use${schema.pascal}${pascalCase(action.operation)}`;
}

/** The request type: the Create/Update interface for those operations, else the paths entry. */
function bodyType(schema: SchemaPlan, action: ActionPlan): string {
  if (!action.hasRequest) return 'never';
  if (action.kind === 'create') return `${schema.pascal}Create`;
  if (action.kind === 'update') return `${schema.pascal}Update`;
  return `operations[${quote(action.id)}]['body']`;
}

function responseType(schema: SchemaPlan, action: ActionPlan): string {
  if (action.kind === 'delete' && !action.hasResponse) return 'void';
  return `operations[${quote(action.id)}]['response']`;
}

/** `application/<schema>/use<Schema>Actions.ts`. */
export function emitActions(schema: SchemaPlan, source: Source): GeneratedFile {
  const { name, pascal } = schema;
  const mutations = schema.actions.filter((a) => a.mutation);
  const needsCreate = mutations.some((a) => a.kind === 'create' && a.hasRequest);
  const needsUpdate = mutations.some((a) => a.kind === 'update' && a.hasRequest);
  const typeImports = [
    needsCreate ? `${pascal}Create` : null,
    needsUpdate ? `${pascal}Update` : null,
  ].filter((v): v is string => v !== null);
  const capabilities = [...new Set(schema.actions.flatMap((a) => a.capabilities))].sort();
  const screensOps = schema.screens.map((s) => s.operationId);
  const allOps = [
    ...new Set([
      ...schema.actions.map((a) => a.id),
      ...screensOps,
      ...schema.columns.views.map((v) => v.operationId),
    ]),
  ].sort();
  const opCapabilities = (id: string): string[] => {
    const action = schema.actions.find((a) => a.id === id);
    if (action) return action.capabilities;
    const screen = schema.screens.find((s) => s.operationId === id);
    return screen?.capabilities ?? [];
  };
  return {
    path: `application/${name}/use${pascal}Actions.ts`,
    contents: lines([
      header(source),
      "import { useCapability, useMutation, type MutationState } from '@star-board/runtime';",
      `import type { operations } from '../../adapters/paths.js';`,
      typeImports.length > 0
        ? `import type { ${typeImports.join(', ')} } from '../../domain/${name}/types.js';`
        : null,
      '',
      `/** Every operation of ${name} with the capabilities it needs (one authority: the document). */`,
      `export const ${name.toUpperCase()}_OPERATIONS = {`,
      ...allOps.map((id) =>
        indent(`${id}: { capabilities: [${opCapabilities(id).map(quote).join(', ')}] },`),
      ),
      '} as const;',
      '',
      `export type ${pascal}OperationId = keyof typeof ${name.toUpperCase()}_OPERATIONS;`,
      '',
      `/** Which operations the current principal may perform; a hidden action is a missing capability. */`,
      `export function use${pascal}Capabilities(): Record<${pascal}OperationId, boolean> {`,
      ...capabilities.map((cap) => indent(`const ${capVar(cap)} = useCapability(${quote(cap)});`)),
      '  return {',
      ...allOps.map((id) => {
        const caps = opCapabilities(id);
        return indent(`${id}: ${caps.length === 0 ? 'false' : caps.map(capVar).join(' && ')},`, 2);
      }),
      '  };',
      '}',
      '',
      ...mutations.flatMap((action) => [
        `/**`,
        ` * \`${action.id}\`: ${action.method.toUpperCase()} ${action.path}; requires ${action.capabilities.map((c) => `\`${c}\``).join(', ') || 'no capability'}.`,
        ...(action.kind === 'update' || action.kind === 'delete'
          ? [
              ' * Call `mutateAsync({ id, body, doc })` with the loaded document: its version becomes the If-Match header.',
            ]
          : [
              ` * Call \`mutateAsync({ ${action.item ? 'id, ' : ''}${action.hasRequest ? 'body' : ''} })\`.`,
            ]),
        ' */',
        `export function ${hookName(schema, action)}(): MutationState<${bodyType(schema, action)}, ${responseType(schema, action)}> {`,
        `  return useMutation<${bodyType(schema, action)}, ${responseType(schema, action)}>(${quote(action.id)});`,
        '}',
        '',
      ]),
    ]),
  };
}

function capVar(capability: string): string {
  return `can_${capability.replace(/[^a-zA-Z0-9]+/g, '_')}`;
}

/** `application/<schema>/use<Schema>Screens.ts`: one container hook per generated screen. */
export function emitScreenHooks(
  plan: GenerationPlan,
  schema: SchemaPlan,
  source: Source,
): GeneratedFile {
  const { name, pascal } = schema;
  const blocks = schema.screens.map((screen) => screenHook(plan, schema, screen));
  const needs = (kind: ScreenPlan['kind']) => schema.screens.some((s) => s.kind === kind);
  const runtimeImports = [
    needs('list') || needs('grid') ? 'useCompactLayout' : null,
    needs('detail') || needs('edit') ? 'useEntity' : null,
    needs('list') ? 'useEntityList' : null,
    needs('grid') ? 'useView' : null,
  ].filter((v): v is string => v !== null);
  const usesT = blocks.some((b) => /\bt\(/.test(b));
  const runnable = (a: ActionPlan) => a.kind === 'custom' && a.mutation && !a.hasRequest;
  const needsState =
    needs('create') ||
    needs('edit') ||
    schema.screens.some((s) => schema.actions.some((a) => a.id === s.operationId && runnable(a)));
  const reactImports = [needsState ? 'useState' : null].filter((v): v is string => v !== null);
  const screenImports = schema.screens
    .filter((s, i, all) => all.findIndex((o) => o.component === s.component) === i)
    .map((s) => {
      const file = s.file.replace(/\.tsx$/, '.js');
      return `import type { ${s.component}Props } from '../../domain/${name}/${file}';`;
    });
  const columnImports = [
    ...(needs('list') ? [listColumnsConstName(schema)] : []),
    ...(needs('grid') ? schema.columns.views.map((v) => viewConstName(v.view)) : []),
  ].sort();
  const mutationHooks = [
    ...new Set(
      schema.screens.flatMap((s) => {
        const action = schema.actions.find((a) => a.id === s.operationId);
        // The detail container runs delete itself; update and custom actions navigate instead.
        const extra =
          s.kind === 'detail' ? detailActions(schema).filter((a) => a.kind === 'delete') : [];
        // A custom stub calls its hook only when it can run the operation without a body.
        const own =
          action?.mutation && (action.kind !== 'custom' || runnable(action)) ? [action] : [];
        return [...own, ...extra].map((a) => hookName(schema, a));
      }),
    ),
  ].sort();
  const schemaImports = [
    needs('create') ? `${pascal}CreateSchema` : null,
    needs('edit') ? `${pascal}UpdateSchema` : null,
  ].filter((v): v is string => v !== null);
  const typeImports = [
    pascal,
    needs('create') ? `${pascal}Create` : null,
    `${pascal}Id`,
    needs('edit') ? `${pascal}Update` : null,
    ...schema.columns.views.map((v) => viewRowType(pascal, v.view)),
  ].filter((v): v is string => v !== null);
  const needsVersion =
    needs('edit') || (needs('detail') && detailActions(schema).some((a) => a.kind === 'delete'));
  const supportImports = [
    needs('edit') ? 'etagFor' : null,
    needs('create') || needs('edit') ? 'fieldErrors' : null,
    needs('create') || needs('edit') ? 'isDirty' : null,
    'messageOf',
    needs('create') || needs('edit') ? 'serverFieldErrors' : null,
    'statusOf',
    needs('list') || needs('grid') ? 'useListState' : null,
    needsVersion ? 'versionedOf' : null,
  ].filter((v): v is string => v !== null);
  return {
    path: `application/${name}/use${pascal}Screens.ts`,
    contents: lines([
      header(source),
      reactImports.length > 0 ? `import { ${reactImports.join(', ')} } from 'react';` : null,
      runtimeImports.length > 0
        ? `import { ${runtimeImports.join(', ')} } from '@star-board/runtime';`
        : null,
      usesT ? "import { useT } from '../../i18n.js';" : null,
      needs('create') || needs('edit')
        ? "import type { operations } from '../../adapters/paths.js';"
        : null,
      "import type { ActionProps } from '../../domain/contract.js';",
      columnImports.length > 0
        ? `import { ${columnImports.join(', ')} } from '../../domain/${name}/columns.js';`
        : null,
      ...screenImports,
      schemaImports.length > 0
        ? `import { ${schemaImports.join(', ')} } from '../../domain/${name}/schemas.js';`
        : null,
      `import type { ${typeImports.join(', ')} } from '../../domain/${name}/types.js';`,
      `import { ${supportImports.join(', ')} } from '../support.js';`,
      `import { use${pascal}Capabilities${mutationHooks.map((h) => `, ${h}`).join('')} } from './use${pascal}Actions.js';`,
      '',
      ...blocks.flatMap((b) => [b, '']),
    ]),
  };
}

/** A schema `default` as a TypeScript literal: strings single-quoted like the rest of the output, the rest as JSON. */
function defaultLiteral(value: unknown): string {
  return typeof value === 'string' ? quote(value) : JSON.stringify(value);
}

/** The field labels a form's validation messages name, from the provider's `t`. */
function labelsTable(
  schema: SchemaPlan,
  payload: string,
  fields: readonly FormFieldPlan[],
): string[] {
  return [
    `  const labels: Readonly<Record<keyof ${payload}, string>> = {`,
    ...fields.map((f) => `    ${f.name}: t(${quote(`${schema.name}.field.${f.name}.label`)}),`),
    '  };',
  ];
}

function detailActions(schema: SchemaPlan): ActionPlan[] {
  return schema.actions.filter(
    (a) =>
      a.item && (a.kind === 'update' || a.kind === 'delete' || (a.kind === 'custom' && a.mutation)),
  );
}

function actionLiteral(action: ActionPlan, disabled: string, onClick: string): string {
  return `{ operationId: ${quote(action.id)}, label: t(${quote(action.labelKey)}), disabled: ${disabled}, onClick: ${onClick} }`;
}

const PAGE_TOTAL = 'result.data?.total ?? result.data?.items.length ?? 0';

/** Adds `const t = useT();` to a hook body that translates (the provider's locale reaches labels). */
function withT(block: string): string {
  if (!/\bt\(/.test(block)) return block;
  return block.replace(/^(export function use[^\n]*\{\n)/m, '$1  const t = useT();\n');
}

function screenHook(plan: GenerationPlan, schema: SchemaPlan, screen: ScreenPlan): string {
  return withT(screenHookBody(plan, schema, screen));
}

function screenHookBody(plan: GenerationPlan, schema: SchemaPlan, screen: ScreenPlan): string {
  const { name, pascal } = schema;
  const props = `${screen.component}Props`;
  const can = `can.${screen.operationId}`;
  switch (screen.kind) {
    case 'list': {
      const collection = schema.actions.filter(
        (a) => a.mutation && !a.item && a.kind !== 'custom' && a.kind !== 'update',
      );
      return lines([
        `export interface ${pascal}ListCallbacks {`,
        `  onOpen: (id: ${pascal}Id) => void;`,
        ...collection.map((a) => `  on${pascalCase(a.operation)}: () => void;`),
        '}',
        '',
        `export function use${pascal}ListScreen(callbacks: ${pascal}ListCallbacks): ${props} {`,
        `  const can = use${pascal}Capabilities();`,
        '  const compact = useCompactLayout();',
        '  const list = useListState(25);',
        `  const result = useEntityList<${pascal}>(${quote(name)}, list.query);`,
        '  const actions: ActionProps[] = [];',
        ...collection.map(
          (a) =>
            `  if (can.${a.id}) actions.push(${actionLiteral(a, 'false', `callbacks.on${pascalCase(a.operation)}`)});`,
        ),
        '  return {',
        `    status: statusOf(result, ${can}),`,
        '    error: messageOf(result.error),',
        '    rows: result.data?.items ?? [],',
        `    columns: ${listColumnsConstName(schema)},`,
        '    compact,',
        `    page: { page: list.page, pageSize: list.pageSize, total: ${PAGE_TOTAL} },`,
        '    sort: list.sort,',
        '    filters: list.filters,',
        '    onPage: list.setPage,',
        '    onSort: list.setSort,',
        '    onFilter: list.setFilter,',
        '    retry: () => {',
        '      void result.refetch();',
        '    },',
        '    actions,',
        '    onOpen: callbacks.onOpen,',
        '  };',
        '}',
      ]).trimEnd();
    }
    case 'grid': {
      const view = schema.columns.views.find((v) => v.view === screen.view);
      if (!view) return '';
      const initialSort = view.sort[0];
      return lines([
        `export interface ${pascal}GridCallbacks {`,
        `  onOpen: (id: ${pascal}Id) => void;`,
        '}',
        '',
        `/** Container of the \`${view.view}\` view${view.roles.length > 0 ? ` (roles: ${view.roles.join(', ')})` : ''}. */`,
        `export function use${pascalCase(view.view)}GridScreen(callbacks: ${pascal}GridCallbacks): ${props} {`,
        `  const can = use${pascal}Capabilities();`,
        '  const compact = useCompactLayout();',
        `  const list = useListState(${view.limits.default}${initialSort ? `, { field: ${quote(initialSort.field)}, dir: ${quote(initialSort.dir)} }` : ''});`,
        `  const result = useView<${viewRowType(pascal, view.view)}>(${quote(view.view)}, list.viewQuery);`,
        '  return {',
        `    status: statusOf(result, ${can}),`,
        '    error: messageOf(result.error),',
        `    title: t(${quote(view.titleKey)}),`,
        '    rows: result.data?.items ?? [],',
        `    columns: ${viewConstName(view.view)},`,
        '    compact,',
        `    filterable: [${view.filters.map((f) => quote(f.field)).join(', ')}],`,
        `    page: { page: list.page, pageSize: list.pageSize, total: ${PAGE_TOTAL} },`,
        '    sort: list.sort,',
        '    filters: list.filters,',
        '    onPage: list.setPage,',
        '    onSort: list.setSort,',
        '    onFilter: list.setFilter,',
        '    retry: () => {',
        '      void result.refetch();',
        '    },',
        '    actions: [],',
        '    onOpen: callbacks.onOpen,',
        '  };',
        '}',
      ]).trimEnd();
    }
    case 'detail': {
      const actions = detailActions(schema);
      const update = actions.find((a) => a.kind === 'update');
      const remove = actions.find((a) => a.kind === 'delete');
      const customs = actions.filter((a) => a.kind === 'custom');
      return lines([
        `export interface ${pascal}DetailCallbacks {`,
        update ? `  onEdit: (id: ${pascal}Id) => void;` : null,
        remove ? '  onDeleted: () => void;' : null,
        customs.length > 0 ? `  onCustom: (operationId: string, id: ${pascal}Id) => void;` : null,
        '  onBack: () => void;',
        '}',
        '',
        `export function use${pascal}DetailScreen(id: ${pascal}Id, callbacks: ${pascal}DetailCallbacks): ${props} {`,
        `  const can = use${pascal}Capabilities();`,
        `  const result = useEntity<${pascal}>(${quote(name)}, id);`,
        remove ? `  const remove = ${hookName(schema, remove)}();` : null,
        '  const entity = result.data;',
        '  const actions: ActionProps[] = [];',
        update
          ? `  if (can.${update.id}) actions.push(${actionLiteral(update, 'false', `() => { callbacks.onEdit(id); }`)});`
          : null,
        remove
          ? lines([
              `  if (can.${remove.id}) {`,
              `    actions.push(${actionLiteral(
                remove,
                'remove.loading || entity === undefined',
                `() =>\n        entity === undefined\n          ? undefined\n          : remove\n              .mutateAsync({ id, doc: versionedOf(entity) })\n              .then(() => {\n                callbacks.onDeleted();\n              })\n              .catch(() => undefined)`,
              )});`,
              '  }',
            ]).trimEnd()
          : null,
        ...customs.map(
          (a) =>
            `  if (can.${a.id}) actions.push(${actionLiteral(a, 'false', `() => { callbacks.onCustom(${quote(a.id)}, id); }`)});`,
        ),
        '  return {',
        `    status: statusOf(result, ${can}),`,
        remove
          ? '    error: messageOf(result.error) ?? messageOf(remove.error),'
          : '    error: messageOf(result.error),',
        '    entity,',
        '    actions,',
        '    retry: () => {',
        '      void result.refetch();',
        '    },',
        '    onBack: callbacks.onBack,',
        '  };',
        '}',
      ]).trimEnd();
    }
    case 'create': {
      const action = schema.actions.find((a) => a.id === screen.operationId);
      if (!action) return '';
      const defaults = schema.createFields.filter((f) => f.schema.default !== undefined);
      const defaultsName = `${name.toUpperCase()}_CREATE_DEFAULTS`;
      return lines([
        `/** The schema \`default\` values the create form starts from (keys quoted: document data, not UI text). */`,
        `export const ${defaultsName}: Partial<${pascal}Create> = {${defaults.length === 0 ? '' : ` ${defaults.map((f) => `${quote(f.name)}: ${defaultLiteral(f.schema.default)}`).join(', ')} `}};`,
        '',
        `export interface ${pascal}CreateCallbacks {`,
        `  onCreated: (created: ${responseType(schema, action)}) => void;`,
        '  onCancel: () => void;',
        '  /** After the agent applied the create (shared/13 §4); omitted, the form stays put. */',
        '  onAgentApplied?: (result: unknown) => void;',
        '}',
        '',
        `export function use${pascal}CreateScreen(callbacks: ${pascal}CreateCallbacks): ${props} {`,
        `  const [values, setValues] = useState<Partial<${pascal}Create>>(() => ({ ...${defaultsName} }));`,
        `  const [errors, setErrors] = useState<Partial<Record<keyof ${pascal}Create, string>>>({});`,
        `  const create = ${hookName(schema, action)}();`,
        ...labelsTable(schema, `${pascal}Create`, schema.createFields),
        '  return {',
        '    values,',
        '    errors,',
        `    dirty: isDirty(values, ${defaultsName}),`,
        '    pending: create.loading,',
        '    submitError: messageOf(create.error),',
        '    onChange: (field, value) => {',
        '      setValues((previous) => ({ ...previous, [field]: value }));',
        '      // A corrected value drops its message at once; the next submit re-validates everything.',
        '      setErrors((previous) => ({ ...previous, [field]: undefined }));',
        '    },',
        '    onSubmit: () => {',
        `      const parsed = ${pascal}CreateSchema.safeParse(values);`,
        '      if (!parsed.success) {',
        '        setErrors(fieldErrors(parsed.error.issues, t, labels));',
        '        return;',
        '      }',
        '      setErrors({});',
        '      create.mutateAsync({ body: parsed.data }).then(callbacks.onCreated, (error: unknown) => {',
        '        setErrors(serverFieldErrors(error));',
        '      });',
        '    },',
        '    onCancel: callbacks.onCancel,',
        '    onAgentApplied: callbacks.onAgentApplied,',
        '  };',
        '}',
      ]).trimEnd();
    }
    case 'edit': {
      const action = schema.actions.find((a) => a.id === screen.operationId);
      if (!action) return '';
      const shared = schema.updateFields.filter((f) =>
        schema.fields.some((d) => d.name === f.name),
      );
      return lines([
        `export interface ${pascal}EditCallbacks {`,
        `  onSaved: (saved: ${responseType(schema, action)}) => void;`,
        '  onCancel: () => void;',
        '}',
        '',
        `/** The editable part of a ${name} record: the fields ${pascal}Update shares with the Document. */`,
        `export function to${pascal}Update(entity: ${pascal}): Partial<${pascal}Update> {`,
        `  return { ${shared.map((f) => `${f.name}: entity.${f.name}`).join(', ')} };`,
        '}',
        '',
        `export function use${pascal}EditScreen(id: ${pascal}Id, callbacks: ${pascal}EditCallbacks): ${props} {`,
        `  const can = use${pascal}Capabilities();`,
        `  const result = useEntity<${pascal}>(${quote(name)}, id);`,
        `  const update = ${hookName(schema, action)}();`,
        `  const [edits, setEdits] = useState<Partial<${pascal}Update>>({});`,
        `  const [errors, setErrors] = useState<Partial<Record<keyof ${pascal}Update, string>>>({});`,
        ...labelsTable(schema, `${pascal}Update`, schema.updateFields),
        '  const entity = result.data;',
        `  const values: Partial<${pascal}Update> = { ...(entity === undefined ? {} : to${pascal}Update(entity)), ...edits };`,
        '  return {',
        `    status: statusOf(result, ${can}),`,
        '    error: messageOf(result.error),',
        '    entity,',
        '    // The agent applies an update only with the If-Match of the document the user is editing.',
        '    ifMatch: etagFor(entity),',
        '    values,',
        '    errors,',
        '    dirty: isDirty(edits),',
        '    pending: update.loading,',
        '    submitError: messageOf(update.error),',
        '    onChange: (field, value) => {',
        '      setEdits((previous) => ({ ...previous, [field]: value }));',
        '      setErrors((previous) => ({ ...previous, [field]: undefined }));',
        '    },',
        '    onSubmit: () => {',
        '      if (entity === undefined) return;',
        `      const parsed = ${pascal}UpdateSchema.safeParse(values);`,
        '      if (!parsed.success) {',
        '        setErrors(fieldErrors(parsed.error.issues, t, labels));',
        '        return;',
        '      }',
        '      setErrors({});',
        '      update',
        '        .mutateAsync({ id, body: parsed.data, doc: versionedOf(entity) })',
        '        .then(callbacks.onSaved, (error: unknown) => {',
        '          setErrors(serverFieldErrors(error));',
        '        });',
        '    },',
        '    onCancel: callbacks.onCancel,',
        '    retry: () => {',
        '      void result.refetch();',
        '    },',
        '    onAgentApplied: () => {',
        '      setEdits({});',
        '      void result.refetch();',
        '    },',
        '  };',
        '}',
      ]).trimEnd();
    }
    case 'custom': {
      const action = schema.actions.find((a) => a.id === screen.operationId);
      if (!action) return '';
      const runnable = action.mutation && !action.hasRequest;
      // The id is only read when the stub runs the operation; `_id` keeps the container's call shape.
      const idParam = action.item ? `${runnable ? 'id' : '_id'}: ${pascal}Id, ` : '';
      const input = action.item ? '{ id }' : '{}';
      return lines([
        `export interface ${pascalCase(action.operation)}Callbacks {`,
        '  onBack: () => void;',
        '}',
        '',
        `/** Stub container for \`${action.id}\`${action.hasRequest ? '; the operation takes a request body, so the stub exposes no action until a screen override provides the form' : ''}. */`,
        `export function use${pascal}${pascalCase(action.operation)}Screen(${idParam}callbacks: ${pascalCase(action.operation)}Callbacks): ${props} {`,
        `  const can = use${pascal}Capabilities();`,
        runnable ? `  const run = ${hookName(schema, action)}();` : null,
        runnable
          ? '  const [result, setResult] = useState<unknown>(undefined);'
          : '  const result: unknown = undefined;',
        runnable
          ? `  const action: ActionProps | undefined = can.${action.id}\n    ? ${actionLiteral(action, 'run.loading', `() =>\n          run\n            .mutateAsync(${input})\n            .then(setResult)\n            .catch(() => undefined)`)}\n    : undefined;`
          : '  const action: ActionProps | undefined = undefined;',
        '  return {',
        `    status: can.${action.id} ? 'ready' : 'forbidden',`,
        runnable ? '    error: messageOf(run.error),' : '    error: undefined,',
        runnable ? '    pending: run.loading,' : '    pending: false,',
        '    result,',
        '    action,',
        '    onBack: callbacks.onBack,',
        '  };',
        '}',
      ]).trimEnd();
    }
  }
}
