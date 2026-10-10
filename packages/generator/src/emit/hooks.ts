import { pascalCase, quote } from '../plan/names.js';
import type { ActionPlan, GenerationPlan, SchemaPlan, ScreenPlan } from '../plan/plan.js';
import { viewConstName } from './screens.js';
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
      "import type { ScreenStatus, SortDirection, SortState } from '../domain/contract.js';",
      '',
      '/** The shape the shared data hooks report; only these members are read. */',
      'export interface QueryLike {',
      '  status: string;',
      '  error: unknown;',
      '}',
      '',
      'export function statusOf(result: QueryLike, allowed: boolean): ScreenStatus {',
      "  if (!allowed) return 'forbidden';",
      "  if (result.status === 'pending' || result.status === 'loading') return 'loading';",
      "  if (result.status === 'error') return 'error';",
      "  return 'ready';",
      '}',
      '',
      'export function messageOf(error: unknown): string | undefined {',
      '  if (error === undefined || error === null) return undefined;',
      '  if (error instanceof Error) return error.message;',
      "  return typeof error === 'string' ? error : JSON.stringify(error);",
      '}',
      '',
      '/** zod issues → first message per top-level field. */',
      'export function fieldErrors(',
      '  issues: readonly { path: readonly PropertyKey[]; message: string }[],',
      '): Record<string, string> {',
      '  const errors: Record<string, string> = {};',
      '  for (const issue of issues) {',
      "    const key = issue.path.length > 0 ? String(issue.path[0]) : '';",
      '    errors[key] ??= issue.message;',
      '  }',
      '  return errors;',
      '}',
      '',
      'export interface ListQuery {',
      '  page: number;',
      '  pageSize: number;',
      '  sort?: SortState;',
      '  filter?: Record<string, unknown>;',
      '}',
      '',
      'export interface ListState {',
      '  page: number;',
      '  pageSize: number;',
      '  sort: SortState | undefined;',
      '  filters: Record<string, unknown>;',
      '  query: ListQuery;',
      '  setPage: (page: number) => void;',
      '  setSort: (field: string, dir: SortDirection) => void;',
      '  setFilter: (field: string, value: unknown) => void;',
      '}',
      '',
      '/** Page, sort and filter state of one list or grid; the query omits unset members. */',
      'export function useListState(pageSize: number, initialSort?: SortState): ListState {',
      '  const [page, setPage] = useState(1);',
      '  const [sort, setSortState] = useState<SortState | undefined>(initialSort);',
      '  const [filters, setFilters] = useState<Record<string, unknown>>({});',
      '  const setSort = useCallback((field: string, dir: SortDirection) => {',
      '    setSortState({ field, dir });',
      '    setPage(1);',
      '  }, []);',
      '  const setFilter = useCallback((field: string, value: unknown) => {',
      '    setFilters((previous) => ({ ...previous, [field]: value }));',
      '    setPage(1);',
      '  }, []);',
      '  const query = useMemo<ListQuery>(() => {',
      "    const active = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''));",
      '    return {',
      '      page,',
      '      pageSize,',
      '      ...(sort === undefined ? {} : { sort }),',
      '      ...(Object.keys(active).length === 0 ? {} : { filter: active }),',
      '    };',
      '  }, [filters, page, pageSize, sort]);',
      '  return { page, pageSize, sort, filters, query, setPage, setSort, setFilter };',
      '}',
    ]),
  };
}

function inputTypeName(schema: SchemaPlan, action: ActionPlan): string {
  return `${schema.pascal}${pascalCase(action.operation)}Input`;
}

function hookName(schema: SchemaPlan, action: ActionPlan): string {
  return `use${schema.pascal}${pascalCase(action.operation)}`;
}

function inputMembers(schema: SchemaPlan, action: ActionPlan): string[] {
  const members = action.params.map((param) =>
    param === 'id' || param === schema.idField
      ? `${param}: ${schema.pascal}Id;`
      : `${param}: string;`,
  );
  if (action.hasRequest) members.push(`body: ${bodyType(schema, action)};`);
  return members;
}

/** The request type: the Create/Update interface for those operations, else the paths entry. */
function bodyType(schema: SchemaPlan, action: ActionPlan): string {
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
  const needsCreate = mutations.some((a) => a.kind === 'create');
  const needsUpdate = mutations.some((a) => a.kind === 'update');
  const needsId = mutations.some((a) => a.params.length > 0);
  const typeImports = [
    needsCreate ? `${pascal}Create` : null,
    needsId ? `${pascal}Id` : null,
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
      "import { useCapability, useMutation } from '@star-board/runtime';",
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
        `export interface ${inputTypeName(schema, action)} {`,
        ...inputMembers(schema, action).map((m) => indent(m)),
        '}',
        '',
        `/** \`${action.id}\`: ${action.method.toUpperCase()} ${action.path}; requires ${action.capabilities.map((c) => `\`${c}\``).join(', ') || 'no capability'}. */`,
        `export function ${hookName(schema, action)}() {`,
        `  return useMutation<${inputTypeName(schema, action)}, ${responseType(schema, action)}>(${quote(action.id)});`,
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
    needs('detail') || needs('edit') ? 'useEntity' : null,
    needs('list') ? 'useEntityList' : null,
    needs('grid') ? 'useView' : null,
  ].filter((v): v is string => v !== null);
  const runnable = (a: ActionPlan) => a.kind === 'custom' && a.mutation && !a.hasRequest;
  const needsState =
    needs('create') ||
    needs('edit') ||
    schema.screens.some((s) => schema.actions.some((a) => a.id === s.operationId && runnable(a)));
  const reactImports = [needsState ? 'useState' : null].filter((v): v is string => v !== null);
  const screenImports = schema.screens
    .filter((s, i, all) => all.findIndex((o) => o.component === s.component) === i)
    .map((s) => {
      const consts =
        s.kind === 'list'
          ? [`${name.toUpperCase()}_LIST_COLUMNS`]
          : s.kind === 'grid'
            ? schema.columns.views.map((v) => viewConstName(v.view))
            : [];
      const file = s.file.replace(/\.tsx$/, '.js');
      return `import { ${[...consts, `type ${s.component}Props`].join(', ')} } from '../../domain/${name}/${file}';`;
    });
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
  const supportImports = [
    needs('create') || needs('edit') ? 'fieldErrors' : null,
    'messageOf',
    'statusOf',
    needs('list') || needs('grid') ? 'useListState' : null,
  ].filter((v): v is string => v !== null);
  return {
    path: `application/${name}/use${pascal}Screens.ts`,
    contents: lines([
      header(source),
      reactImports.length > 0 ? `import { ${reactImports.join(', ')} } from 'react';` : null,
      runtimeImports.length > 0
        ? `import { ${runtimeImports.join(', ')} } from '@star-board/runtime';`
        : null,
      "import { t } from '../../i18n.js';",
      needs('create') || needs('edit')
        ? "import type { operations } from '../../adapters/paths.js';"
        : null,
      "import type { ActionProps } from '../../domain/contract.js';",
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

function detailActions(schema: SchemaPlan): ActionPlan[] {
  return schema.actions.filter(
    (a) =>
      a.item && (a.kind === 'update' || a.kind === 'delete' || (a.kind === 'custom' && a.mutation)),
  );
}

function actionLiteral(action: ActionPlan, disabled: string, onClick: string): string {
  return `{ operationId: ${quote(action.id)}, label: t(${quote(action.labelKey)}), disabled: ${disabled}, onClick: ${onClick} }`;
}

function screenHook(plan: GenerationPlan, schema: SchemaPlan, screen: ScreenPlan): string {
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
        `    columns: ${name.toUpperCase()}_LIST_COLUMNS,`,
        '    page: { page: list.page, pageSize: list.pageSize, total: result.data?.total ?? 0 },',
        '    sort: list.sort,',
        '    filters: list.filters,',
        '    onPage: list.setPage,',
        '    onSort: list.setSort,',
        '    onFilter: list.setFilter,',
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
        `  const list = useListState(${view.limits.default}${initialSort ? `, { field: ${quote(initialSort.field)}, dir: ${quote(initialSort.dir)} }` : ''});`,
        `  const result = useView<${viewRowType(pascal, view.view)}>(${quote(view.view)}, list.query);`,
        '  return {',
        `    status: statusOf(result, ${can}),`,
        '    error: messageOf(result.error),',
        `    title: t(${quote(view.titleKey)}),`,
        '    rows: result.data?.items ?? [],',
        `    columns: ${viewConstName(view.view)},`,
        `    filterable: [${view.filters.map((f) => quote(f.field)).join(', ')}],`,
        `    page: { page: list.page, pageSize: list.pageSize, total: result.data?.total ?? 0 },`,
        '    sort: list.sort,',
        '    filters: list.filters,',
        '    onPage: list.setPage,',
        '    onSort: list.setSort,',
        '    onFilter: list.setFilter,',
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
        '  const actions: ActionProps[] = [];',
        update
          ? `  if (can.${update.id}) actions.push(${actionLiteral(update, 'false', `() => { callbacks.onEdit(id); }`)});`
          : null,
        remove
          ? `  if (can.${remove.id}) actions.push(${actionLiteral(remove, 'remove.isPending', `() => { void remove.mutate({ id }).then(() => { callbacks.onDeleted(); }); }`)});`
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
        '    entity: result.data,',
        '    actions,',
        '    onBack: callbacks.onBack,',
        '  };',
        '}',
      ]).trimEnd();
    }
    case 'create': {
      const action = schema.actions.find((a) => a.id === screen.operationId);
      if (!action) return '';
      return lines([
        `export interface ${pascal}CreateCallbacks {`,
        `  onCreated: (created: ${responseType(schema, action)}) => void;`,
        '  onCancel: () => void;',
        '}',
        '',
        `export function use${pascal}CreateScreen(callbacks: ${pascal}CreateCallbacks): ${props} {`,
        `  const [values, setValues] = useState<Partial<${pascal}Create>>({});`,
        `  const [errors, setErrors] = useState<Partial<Record<keyof ${pascal}Create, string>>>({});`,
        `  const create = ${hookName(schema, action)}();`,
        '  return {',
        '    values,',
        '    errors,',
        '    pending: create.isPending,',
        '    submitError: messageOf(create.error),',
        '    onChange: (field, value) => {',
        '      setValues((previous) => ({ ...previous, [field]: value }));',
        '    },',
        '    onSubmit: () => {',
        `      const parsed = ${pascal}CreateSchema.safeParse(values);`,
        '      if (!parsed.success) {',
        '        setErrors(fieldErrors(parsed.error.issues));',
        '        return;',
        '      }',
        '      setErrors({});',
        '      void create.mutate({ body: parsed.data }).then(callbacks.onCreated);',
        '    },',
        '    onCancel: callbacks.onCancel,',
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
        `  const values: Partial<${pascal}Update> = { ...(result.data === undefined ? {} : to${pascal}Update(result.data)), ...edits };`,
        '  return {',
        `    status: statusOf(result, ${can}),`,
        '    error: messageOf(result.error),',
        '    entity: result.data,',
        '    values,',
        '    errors,',
        '    pending: update.isPending,',
        '    submitError: messageOf(update.error),',
        '    onChange: (field, value) => {',
        '      setEdits((previous) => ({ ...previous, [field]: value }));',
        '    },',
        '    onSubmit: () => {',
        `      const parsed = ${pascal}UpdateSchema.safeParse(values);`,
        '      if (!parsed.success) {',
        '        setErrors(fieldErrors(parsed.error.issues));',
        '        return;',
        '      }',
        '      setErrors({});',
        '      void update.mutate({ id, body: parsed.data }).then(callbacks.onSaved);',
        '    },',
        '    onCancel: callbacks.onCancel,',
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
          ? `  const action: ActionProps | undefined = can.${action.id}\n    ? ${actionLiteral(action, 'run.isPending', `() => { void run.mutate(${input}).then(setResult); }`)}\n    : undefined;`
          : '  const action: ActionProps | undefined = undefined;',
        '  return {',
        `    status: can.${action.id} ? 'ready' : 'forbidden',`,
        runnable ? '    error: messageOf(run.error),' : '    error: undefined,',
        runnable ? '    pending: run.isPending,' : '    pending: false,',
        '    result,',
        '    action,',
        '    onBack: callbacks.onBack,',
        '  };',
        '}',
      ]).trimEnd();
    }
  }
}
