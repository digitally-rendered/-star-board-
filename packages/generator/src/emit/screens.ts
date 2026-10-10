import type { FieldKey, ListColumnKey } from '@star-board/core';
import { quote } from '../plan/names.js';
import type {
  ActionPlan,
  ColumnPlan,
  FieldPlan,
  FormFieldPlan,
  GenerationPlan,
  SchemaPlan,
  ScreenPlan,
} from '../plan/plan.js';
import { header, indent, lines, type GeneratedFile, type Source } from './support.js';

/*
 * Default screens (hexagonal-rules typescript/12 §2): props-only domain components that compose
 * the resolved contract components (`useComponent(key, schema, target)` from the runtime) and
 * never fetch. Every interactive element carries a `data-testid`; labels and help come from the
 * i18n defaults (`t(...)`) so translations override by key.
 */

export const CONTRACT_PATH = 'domain/contract.ts';
export const AGENT_PANEL_PATH = 'domain/AgentPanelSlot.tsx';

export function emitContract(source: Source): GeneratedFile {
  return {
    path: CONTRACT_PATH,
    contents: lines([
      header(source),
      "import type { ListColumnKey } from '@star-board/core';",
      '',
      '/** What a container hook reports to its screen. */',
      "export type ScreenStatus = 'loading' | 'error' | 'forbidden' | 'ready';",
      "export type SortDirection = 'asc' | 'desc';",
      '',
      '/** Props every resolved `field.*` component receives. */',
      'export interface FieldProps<V = unknown> {',
      '  name: string;',
      '  label: string;',
      '  help: string | undefined;',
      '  required: boolean;',
      '  value: V;',
      '  onChange: (value: V) => void;',
      '  error: string | undefined;',
      '}',
      '',
      '/** Props every resolved `list.column.<type>` component receives: one cell or one detail value. */',
      'export interface ColumnProps<Row = unknown> {',
      '  field: string;',
      '  label: string;',
      '  value: unknown;',
      '  row: Row;',
      '}',
      '',
      'export interface ColumnSpec {',
      '  field: string;',
      '  key: ListColumnKey;',
      '  label: string;',
      '  hidden: boolean;',
      '  sortable: boolean;',
      '}',
      '',
      'export interface PageState {',
      '  page: number;',
      '  pageSize: number;',
      '  total: number;',
      '}',
      '',
      'export interface SortState {',
      '  field: string;',
      '  dir: SortDirection;',
      '}',
      '',
      '/** Props shared by the list and grid screens. */',
      'export interface ListProps<Row> {',
      '  rows: readonly Row[];',
      '  columns: readonly ColumnSpec[];',
      '  page: PageState;',
      '  sort: SortState | undefined;',
      '  filters: Readonly<Record<string, unknown>>;',
      '  onPage: (page: number) => void;',
      '  onSort: (field: string, dir: SortDirection) => void;',
      '  onFilter: (field: string, value: unknown) => void;',
      '}',
      '',
      '/** Props every resolved `action.*` component receives; a missing capability omits the action. */',
      'export interface ActionProps {',
      '  operationId: string;',
      '  label: string;',
      '  disabled: boolean;',
      '  onClick: () => void;',
      '}',
      '',
      '/** Props every resolved `state.*` component receives. */',
      'export interface StateProps {',
      '  schema: string;',
      '  operationId: string;',
      '  message: string | undefined;',
      '  retry: (() => void) | undefined;',
      '}',
      '',
      '/** Props of the resolved `help.inline` component. */',
      'export interface HelpProps {',
      '  text: string;',
      '}',
      '',
      '/** Props of the agent affordance panel (`screen.custom`, target `agent-panel`). */',
      'export interface AgentPanelProps {',
      '  schema: string;',
      '  operationId: string;',
      '  values: Readonly<Record<string, unknown>>;',
      '}',
      '',
      '/** The direction a sort header toggles to. */',
      'export function nextDirection(sort: SortState | undefined, field: string): SortDirection {',
      "  return sort !== undefined && sort.field === field && sort.dir === 'asc' ? 'desc' : 'asc';",
      '}',
      '',
      '/** Fields of `columns` that are not hidden. */',
      'export function shownFields(columns: readonly ColumnSpec[]): ReadonlySet<string> {',
      '  return new Set(columns.filter((column) => !column.hidden).map((column) => column.field));',
      '}',
    ]),
  };
}

export function emitAgentPanelSlot(source: Source): GeneratedFile {
  return {
    path: AGENT_PANEL_PATH,
    contents: lines([
      header(source),
      "import type { ComponentType, ReactElement } from 'react';",
      "import { useComponent } from '@star-board/runtime';",
      "import type { AgentPanelProps } from './contract.js';",
      '',
      '/**',
      ' * The agent affordance slot beside every generated form (hexagonal-rules shared/13 §4). It renders',
      ' * the component registered for `screen.custom` with target `agent-panel`; until the agent',
      ' * affordance registers one, the registry resolves nothing and the slot renders null.',
      ' */',
      'export function AgentPanelSlot(props: AgentPanelProps): ReactElement | null {',
      '  const Panel = useAgentPanel(props.schema);',
      '  return Panel === null ? null : <Panel {...props} />;',
      '}',
      '',
      'function useAgentPanel(schema: string): ComponentType<AgentPanelProps> | null {',
      '  try {',
      "    return useComponent<AgentPanelProps>('screen.custom', schema, 'agent-panel');",
      '  } catch {',
      '    return null;',
      '  }',
      '}',
    ]),
  };
}

interface ScreenContext {
  plan: GenerationPlan;
  schema: SchemaPlan;
  screen: ScreenPlan;
  source: Source;
}

export function emitScreen(ctx: ScreenContext): GeneratedFile {
  switch (ctx.screen.kind) {
    case 'list':
      return emitTableScreen(ctx, 'list');
    case 'grid':
      return emitTableScreen(ctx, 'grid');
    case 'detail':
      return emitDetailScreen(ctx);
    case 'create':
      return emitFormScreen(ctx, 'create');
    case 'edit':
      return emitFormScreen(ctx, 'edit');
    case 'custom':
      return emitCustomScreen(ctx);
  }
}

/* ---------------------------------------------------------------- helpers */

const testId = (schema: string, kind: string, ...rest: string[]): string =>
  [schema, kind, ...rest].join('-');

/** A JSX string attribute value. */
const attr = (value: string): string => JSON.stringify(value);

function componentName(field: string, suffix: string): string {
  return `${field
    .split(/[^a-zA-Z0-9]+/)
    .filter((p) => p.length > 0)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('')}${suffix}`;
}

function actionComponentName(action: ActionPlan): string {
  return componentName(action.id, 'Action');
}

function labelCall(plan: GenerationPlan, key: string): string {
  return key in plan.i18n ? `t(${quote(key)})` : quote(key);
}

function helpExpr(plan: GenerationPlan, schema: string, field: string): string {
  const key = `${schema}.field.${field}.help`;
  return key in plan.i18n ? `t(${quote(key)})` : 'undefined';
}

function stateHooks(schema: SchemaPlan, operationId: string, posture: GenerationPlan['posture']) {
  const s = quote(schema.name);
  const o = quote(operationId);
  const denied = posture === '403' ? 'state.forbidden' : 'state.empty';
  return [
    `const Loading = useComponent<StateProps>('state.loading', ${s}, ${o});`,
    `const ErrorState = useComponent<StateProps>('state.error', ${s}, ${o});`,
    `const Empty = useComponent<StateProps>('state.empty', ${s}, ${o});`,
    `// Posture ${posture} (hexagonal-rules shared/01 §5): what a missing capability shows.`,
    `const Denied = useComponent<StateProps>('${denied}', ${s}, ${o});`,
  ];
}

function stateReturns(schema: SchemaPlan, operationId: string): string[] {
  const common = `schema=${attr(schema.name)} operationId=${attr(operationId)}`;
  return [
    `if (props.status === 'loading') return <Loading ${common} message={undefined} retry={undefined} />;`,
    `if (props.status === 'forbidden') return <Denied ${common} message={props.error} retry={undefined} />;`,
    `if (props.status === 'error') return <ErrorState ${common} message={props.error} retry={undefined} />;`,
  ];
}

function columnSpecLiteral(plan: GenerationPlan, schema: string, column: ColumnPlan): string {
  const label = labelCall(plan, `${schema}.field.${column.field}.label`);
  return `{ field: ${quote(column.field)}, key: ${quote(column.key)}, label: ${label}, hidden: ${String(column.hidden)}, sortable: ${String(column.sortable)} },`;
}

function cellHook(schema: string, field: string, key: ListColumnKey, row: string): string {
  return `const ${componentName(field, 'Cell')} = useComponent<ColumnProps<${row}>>(${quote(key)}, ${quote(schema)}, ${quote(field)});`;
}

function fieldHook(schema: string, field: string, key: FieldKey, valueType: string): string {
  return `const ${componentName(field, 'Field')} = useComponent<FieldProps<${valueType}>>(${quote(key)}, ${quote(schema)}, ${quote(field)});`;
}

/* ------------------------------------------------------------- list / grid */

function emitTableScreen(ctx: ScreenContext, kind: 'list' | 'grid'): GeneratedFile {
  const { plan, schema, screen, source } = ctx;
  const { name, pascal, idField } = schema;
  const rowType = kind === 'list' ? pascal : `Partial<${pascal}>`;
  const views = kind === 'grid' ? schema.columns.views : [];
  // Columns a table may show: the list projection, or the union of every view's projection.
  const columns: ColumnPlan[] =
    kind === 'list' ? schema.columns.list : dedupe(views.flatMap((v) => v.columns));
  const filterFields = dedupeStrings(views.flatMap((v) => v.filters.map((f) => f.field)));
  const fieldByName = new Map(schema.fields.map((f) => [f.name, f]));
  // Collection actions (create, bulk) belong to the list; a view is read-only.
  const collectionActions =
    kind === 'list'
      ? schema.actions.filter(
          (a) => a.mutation && !a.item && a.kind !== 'custom' && a.kind !== 'update',
        )
      : [];
  const tid = (...rest: string[]) => attr(testId(name, kind, ...rest));
  const columnConsts =
    kind === 'list'
      ? [
          `/** Columns of the ${name} list: the Document's fields; system fields hidden by default. */`,
          `export const ${name.toUpperCase()}_LIST_COLUMNS: readonly ColumnSpec[] = [`,
          ...schema.columns.list.map((c) => indent(columnSpecLiteral(plan, name, c))),
          '];',
        ]
      : views.flatMap((view) => [
          `/** Columns of the \`${view.view}\` view (its projection). */`,
          `export const ${viewConstName(view.view)}: readonly ColumnSpec[] = [`,
          ...view.columns.map((c) => indent(columnSpecLiteral(plan, name, c))),
          '];',
          '',
        ]);
  const propsName = `${screen.component}Props`;
  const propsMembers = [
    'status: ScreenStatus;',
    'error: string | undefined;',
    ...(kind === 'grid' ? ['title: string;', 'filterable: readonly string[];'] : []),
    '/** Actions the current capabilities allow; the container filters them. */',
    'actions: readonly ActionProps[];',
    `onOpen: (id: ${pascal}Id) => void;`,
  ];
  const needsFieldProps = filterFields.length > 0;
  const imports = [
    "import type { ReactElement } from 'react';",
    "import { useComponent } from '@star-board/runtime';",
    "import { t } from '../../i18n.js';",
    `import {\n  nextDirection,\n  shownFields,\n  type ActionProps,\n  type ColumnProps,\n  type ColumnSpec,\n${needsFieldProps ? '  type FieldProps,\n' : ''}  type ListProps,\n  type ScreenStatus,\n  type StateProps,\n} from '../contract.js';`,
    `import type { ${pascal}, ${pascal}Id } from './types.js';`,
  ];
  const openButton = `<button type="button" data-testid={\`${testId(name, kind, 'open')}-\${id}\`} onClick={() => { props.onOpen(id); }}>\n  {t('common.open')}\n</button>`;
  const openCell =
    kind === 'list'
      ? `<td>\n${indent(openButton)}\n</td>`
      : `<td>\n  {id === undefined ? null : (\n${indent(openButton, 2)}\n  )}\n</td>`;
  // A view row may omit the id; the list row always carries it.
  const rowKey = kind === 'list' ? 'id' : 'id ?? String(index)';
  const rowMap = kind === 'list' ? '(row) => {' : '(row, index) => {';
  const title = kind === 'list' ? `t(${quote(screen.titleKey)})` : 'props.title';
  const body = [
    `export function ${screen.component}(props: ${propsName}): ReactElement {`,
    ...indentAll([
      ...stateHooks(schema, screen.operationId, plan.posture),
      ...collectionActions.map(
        (a) =>
          `const ${actionComponentName(a)} = useComponent<ActionProps>(${quote(a.key)}, ${quote(name)}, ${quote(a.id)});`,
      ),
      ...columns.map((c) => cellHook(name, c.field, c.key, rowType)),
      ...filterFields.map((field) => {
        const f = fieldByName.get(field);
        return fieldHook(name, field, f?.key ?? 'field.text', 'unknown');
      }),
      'const shown = shownFields(props.columns);',
      ...stateReturns(schema, screen.operationId),
      ...collectionActions.map(
        (a) =>
          `const ${a.id} = props.actions.find((action) => action.operationId === ${quote(a.id)});`,
      ),
      'return (',
      ...indentAll([
        `<section data-testid=${tid('screen')}>`,
        ...indentAll([
          `<header data-testid=${tid('header')}>`,
          `  <h1>{${title}}</h1>`,
          `  <div role="toolbar" aria-label={${title}} data-testid=${tid('actions')}>`,
          ...collectionActions.map(
            (a) =>
              `    {${a.id} === undefined ? null : <${actionComponentName(a)} {...${a.id}} />}`,
          ),
          '  </div>',
          '</header>',
          ...(filterFields.length > 0
            ? [
                `<div role="search" aria-label={t('common.filter')} data-testid=${tid('filters')}>`,
                ...filterFields.map((field) =>
                  indent(
                    `{props.filterable.includes(${quote(field)}) ? (\n  <${componentName(field, 'Field')}\n    name=${attr(field)}\n    label={${labelCall(plan, `${name}.field.${field}.label`)}}\n    help={${helpExpr(plan, name, field)}}\n    required={false}\n    value={props.filters[${quote(field)}]}\n    onChange={(value) => { props.onFilter(${quote(field)}, value); }}\n    error={undefined}\n  />\n) : null}`,
                  ),
                ),
                '</div>',
              ]
            : []),
          '{props.rows.length === 0 ? (',
          `  <Empty schema=${attr(name)} operationId=${attr(screen.operationId)} message={undefined} retry={undefined} />`,
          ') : (',
          ...indentAll([
            `<table data-testid=${tid('table')}>`,
            ...indentAll([
              '<thead>',
              '  <tr>',
              ...columns.map((c) =>
                indent(
                  c.sortable
                    ? `{shown.has(${quote(c.field)}) ? (\n  <th scope="col">\n    <button type="button" data-testid=${tid('sort', c.field)} onClick={() => { props.onSort(${quote(c.field)}, nextDirection(props.sort, ${quote(c.field)})); }}>\n      {${labelCall(plan, `${name}.field.${c.field}.label`)}}\n    </button>\n  </th>\n) : null}`
                    : `{shown.has(${quote(c.field)}) ? <th scope="col">{${labelCall(plan, `${name}.field.${c.field}.label`)}}</th> : null}`,
                  2,
                ),
              ),
              `    <th scope="col">{t('common.open')}</th>`,
              '  </tr>',
              '</thead>',
              '<tbody>',
              `  {props.rows.map(${rowMap}`,
              `    const id = row.${idField};`,
              '    return (',
              `      <tr key={${rowKey}} data-testid={\`${testId(name, kind, 'row')}-\${${rowKey}}\`}>`,
              ...columns.map((c) =>
                indent(
                  `{shown.has(${quote(c.field)}) ? (\n  <td>\n    <${componentName(c.field, 'Cell')} field=${attr(c.field)} label={${labelCall(plan, `${name}.field.${c.field}.label`)}} value={row.${c.field}} row={row} />\n  </td>\n) : null}`,
                  4,
                ),
              ),
              indent(openCell, 4),
              '      </tr>',
              '    );',
              '  })}',
              '</tbody>',
            ]),
            '</table>',
          ]),
          ')}',
          `<nav aria-label={t('common.page')} data-testid=${tid('pager')}>`,
          `  <button type="button" data-testid=${tid('page', 'previous')} disabled={props.page.page <= 1} onClick={() => { props.onPage(props.page.page - 1); }}>`,
          "    {t('common.previous')}",
          '  </button>',
          `  <span data-testid=${tid('page', 'current')}>{props.page.page}</span>`,
          `  <button type="button" data-testid=${tid('page', 'next')} disabled={props.page.page * props.page.pageSize >= props.page.total} onClick={() => { props.onPage(props.page.page + 1); }}>`,
          "    {t('common.next')}",
          '  </button>',
          '</nav>',
        ]),
        '</section>',
      ]),
      ');',
    ]),
    '}',
  ];
  return {
    path: `domain/${name}/${screen.file}`,
    contents: lines([
      header(source),
      ...imports,
      '',
      ...columnConsts,
      '',
      `export interface ${propsName} extends ListProps<${rowType}> {`,
      ...propsMembers.map((m) => indent(m)),
      '}',
      '',
      ...body,
    ]),
  };
}

export function viewConstName(view: string): string {
  return `${view.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()}_COLUMNS`;
}

function dedupe(columns: ColumnPlan[]): ColumnPlan[] {
  const seen = new Set<string>();
  return columns.filter((c) => (seen.has(c.field) ? false : (seen.add(c.field), true)));
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function indentAll(parts: readonly (string | null)[], depth = 1): string[] {
  return parts.filter((p): p is string => p !== null).map((p) => indent(p, depth));
}

/* ------------------------------------------------------------------ detail */

function groupsOf<F extends FieldPlan>(
  fields: readonly F[],
): { group: string | null; fields: F[] }[] {
  const groups: { group: string | null; fields: F[] }[] = [{ group: null, fields: [] }];
  for (const field of fields) {
    const existing = groups.find((g) => g.group === field.group);
    if (existing) existing.fields.push(field);
    else groups.push({ group: field.group, fields: [field] });
  }
  return groups.filter((g) => g.fields.length > 0);
}

function emitDetailScreen(ctx: ScreenContext): GeneratedFile {
  const { plan, schema, screen, source } = ctx;
  const { name, pascal } = schema;
  const visible = schema.fields.filter((f) => !f.hidden);
  // Record fields first, system (audit) fields in a trailing section.
  const fields = [...visible.filter((f) => !f.audit), ...visible.filter((f) => f.audit)];
  const itemActions = schema.actions.filter(
    (a) =>
      a.item && (a.kind === 'update' || a.kind === 'delete' || (a.kind === 'custom' && a.mutation)),
  );
  const withHelp = fields.filter((f) => `${name}.field.${f.name}.help` in plan.i18n);
  const tid = (...rest: string[]) => attr(testId(name, 'detail', ...rest));
  const propsName = `${screen.component}Props`;
  const fieldBlock = (f: FieldPlan): string =>
    lines([
      `<div data-testid=${tid('field', f.name)}>`,
      `  <dt>{${labelCall(plan, `${name}.field.${f.name}.label`)}}</dt>`,
      '  <dd>',
      `    <${componentName(f.name, 'Cell')} field=${attr(f.name)} label={${labelCall(plan, `${name}.field.${f.name}.label`)}} value={entity.${f.name}} row={entity} />`,
      withHelp.includes(f)
        ? `    <${componentName(f.name, 'Help')} text={${helpExpr(plan, name, f.name)}} />`
        : null,
      '  </dd>',
      '</div>',
    ]).trimEnd();
  const section = (id: string, title: string, blocks: FieldPlan[]): string =>
    lines([
      `<section data-testid=${tid('group', id)}>`,
      `  <h2>{${title}}</h2>`,
      ...blocks.map((f) => indent(fieldBlock(f))),
      '</section>',
    ]).trimEnd();
  const groups = [
    ...groupsOf(fields.filter((f) => !f.audit)).map((g) =>
      g.group === null
        ? g.fields.map(fieldBlock).join('\n')
        : section(g.group, labelCall(plan, `${name}.group.${g.group}.label`), g.fields),
    ),
    ...(fields.some((f) => f.audit)
      ? [
          section(
            'system',
            "t('common.system')",
            fields.filter((f) => f.audit),
          ),
        ]
      : []),
  ];
  return {
    path: `domain/${name}/${screen.file}`,
    contents: lines([
      header(source),
      "import type { ReactElement } from 'react';",
      "import { useComponent } from '@star-board/runtime';",
      "import { t } from '../../i18n.js';",
      `import type { ActionProps, ColumnProps, ${withHelp.length > 0 ? 'HelpProps, ' : ''}ScreenStatus, StateProps } from '../contract.js';`,
      `import type { ${pascal} } from './types.js';`,
      '',
      `export interface ${propsName} {`,
      '  status: ScreenStatus;',
      '  error: string | undefined;',
      `  entity: ${pascal} | undefined;`,
      '  /** Actions the current capabilities allow; the container filters them. */',
      '  actions: readonly ActionProps[];',
      '  onBack: () => void;',
      '}',
      '',
      `export function ${screen.component}(props: ${propsName}): ReactElement {`,
      ...indentAll([
        ...stateHooks(schema, screen.operationId, plan.posture),
        ...itemActions.map(
          (a) =>
            `const ${actionComponentName(a)} = useComponent<ActionProps>(${quote(a.key)}, ${quote(name)}, ${quote(a.id)});`,
        ),
        ...fields.map((f) => cellHook(name, f.name, f.columnKey, pascal)),
        ...withHelp.map(
          (f) =>
            `const ${componentName(f.name, 'Help')} = useComponent<HelpProps>('help.inline', ${quote(name)}, ${quote(f.name)});`,
        ),
        ...stateReturns(schema, screen.operationId),
        'const entity = props.entity;',
        `if (entity === undefined) return <Empty schema=${attr(name)} operationId=${attr(screen.operationId)} message={undefined} retry={undefined} />;`,
        ...itemActions.map(
          (a) =>
            `const ${a.id} = props.actions.find((action) => action.operationId === ${quote(a.id)});`,
        ),
        'return (',
        ...indentAll([
          `<article data-testid=${tid('screen')}>`,
          ...indentAll([
            `<header data-testid=${tid('header')}>`,
            `  <h1>{t(${quote(screen.titleKey)})}</h1>`,
            `  <div role="toolbar" aria-label={t(${quote(screen.titleKey)})} data-testid=${tid('actions')}>`,
            ...itemActions.map(
              (a) =>
                `    {${a.id} === undefined ? null : <${actionComponentName(a)} {...${a.id}} />}`,
            ),
            '  </div>',
            '</header>',
            `<dl data-testid=${tid('fields')}>`,
            ...groups.map((g) => indent(g)),
            '</dl>',
            `<button type="button" data-testid=${tid('back')} onClick={props.onBack}>`,
            "  {t('common.back')}",
            '</button>',
          ]),
          '</article>',
        ]),
        ');',
      ]),
      '}',
    ]),
  };
}

/* --------------------------------------------------------- create / edit */

function emitFormScreen(ctx: ScreenContext, kind: 'create' | 'edit'): GeneratedFile {
  const { plan, schema, screen, source } = ctx;
  const { name, pascal } = schema;
  const payload = kind === 'create' ? `${pascal}Create` : `${pascal}Update`;
  const fields: FormFieldPlan[] = (
    kind === 'create' ? schema.createFields : schema.updateFields
  ).filter((f) => !f.hidden);
  const action = schema.actions.find((a) => a.id === screen.operationId);
  const actionKey = action?.key ?? (kind === 'create' ? 'action.create' : 'action.update');
  const tid = (...rest: string[]) => attr(testId(name, kind, ...rest));
  const propsName = `${screen.component}Props`;
  const fieldBlock = (f: FormFieldPlan): string =>
    lines([
      `<${componentName(f.name, 'Field')}`,
      `  name=${attr(f.name)}`,
      `  label={${labelCall(plan, `${name}.field.${f.name}.label`)}}`,
      `  help={${helpExpr(plan, name, f.name)}}`,
      `  required={${String(f.required)}}`,
      `  value={props.values.${f.name}}`,
      `  onChange={(value) => { props.onChange(${quote(f.name)}, value); }}`,
      `  error={props.errors.${f.name}}`,
      '/>',
    ]).trimEnd();
  const groups = groupsOf(fields).map((g) =>
    g.group === null
      ? g.fields.map(fieldBlock).join('\n')
      : lines([
          `<fieldset data-testid=${tid('group', g.group)}>`,
          `  <legend>{${labelCall(plan, `${name}.group.${g.group}.label`)}}</legend>`,
          ...g.fields.map((f) => indent(fieldBlock(f))),
          '</fieldset>',
        ]).trimEnd(),
  );
  const editMembers =
    kind === 'edit'
      ? ['status: ScreenStatus;', 'error: string | undefined;', `entity: ${pascal} | undefined;`]
      : [];
  const typeImports = [
    'ActionProps',
    'FieldProps',
    ...(kind === 'edit' ? ['ScreenStatus'] : []),
    'StateProps',
  ];
  return {
    path: `domain/${name}/${screen.file}`,
    contents: lines([
      header(source),
      "import type { ReactElement } from 'react';",
      "import { useComponent } from '@star-board/runtime';",
      "import { t } from '../../i18n.js';",
      "import { AgentPanelSlot } from '../AgentPanelSlot.js';",
      `import type { ${typeImports.join(', ')} } from '../contract.js';`,
      `import type { ${kind === 'edit' ? `${pascal}, ` : ''}${payload} } from './types.js';`,
      '',
      `export interface ${propsName} {`,
      ...editMembers.map((m) => indent(m)),
      `  values: Partial<${payload}>;`,
      `  errors: Partial<Record<keyof ${payload}, string>>;`,
      '  pending: boolean;',
      '  submitError: string | undefined;',
      `  onChange: <K extends keyof ${payload}>(field: K, value: ${payload}[K] | undefined) => void;`,
      '  onSubmit: () => void;',
      '  onCancel: () => void;',
      '}',
      '',
      `export function ${screen.component}(props: ${propsName}): ReactElement {`,
      ...indentAll([
        ...(kind === 'edit' ? stateHooks(schema, screen.operationId, plan.posture) : []),
        kind === 'create'
          ? `const ErrorState = useComponent<StateProps>('state.error', ${quote(name)}, ${quote(screen.operationId)});`
          : null,
        `const Submit = useComponent<ActionProps>(${quote(actionKey)}, ${quote(name)}, ${quote(screen.operationId)});`,
        ...fields.map((f) =>
          fieldHook(name, f.name, f.key, `${payload}[${quote(f.name)}] | undefined`),
        ),
        ...(kind === 'edit'
          ? [
              ...stateReturns(schema, screen.operationId),
              `if (props.entity === undefined) return <Empty schema=${attr(name)} operationId=${attr(screen.operationId)} message={undefined} retry={undefined} />;`,
            ]
          : []),
        'return (',
        ...indentAll([
          `<form data-testid=${tid('screen')} noValidate onSubmit={(event) => { event.preventDefault(); props.onSubmit(); }}>`,
          ...indentAll([
            `<h1>{t(${quote(screen.titleKey)})}</h1>`,
            ...groups.map((g) => g),
            `{props.submitError === undefined ? null : <ErrorState schema=${attr(name)} operationId=${attr(screen.operationId)} message={props.submitError} retry={undefined} />}`,
            `<AgentPanelSlot schema=${attr(name)} operationId=${attr(screen.operationId)} values={props.values} />`,
            `<div role="toolbar" aria-label={t(${quote(screen.titleKey)})} data-testid=${tid('actions')}>`,
            `  <Submit operationId=${attr(screen.operationId)} label={${labelCall(plan, action?.labelKey ?? 'common.save')}} disabled={props.pending} onClick={props.onSubmit} />`,
            `  <button type="button" data-testid=${tid('cancel')} onClick={props.onCancel}>`,
            "    {t('common.cancel')}",
            '  </button>',
            '</div>',
          ]),
          '</form>',
        ]),
        ');',
      ]),
      '}',
    ]),
  };
}

/* ------------------------------------------------------------------ custom */

function emitCustomScreen(ctx: ScreenContext): GeneratedFile {
  const { plan, schema, screen, source } = ctx;
  const { name } = schema;
  const action = schema.actions.find((a) => a.id === screen.operationId);
  const op = action?.operation ?? screen.operationId;
  const tid = (...rest: string[]) => attr(testId(name, op, ...rest));
  const propsName = `${screen.component}Props`;
  return {
    path: `domain/${name}/${screen.file}`,
    contents: lines([
      header(source),
      `// Stub for the Tier 3 operation \`${screen.operationId}\` (hexagonal-rules typescript/12 §1).`,
      `// Replace the whole screen by registering 'screen.custom' for (${quote(name)}, ${quote(screen.operationId)}) in src/features/${name}/index.ts.`,
      "import type { ReactElement } from 'react';",
      "import { useComponent } from '@star-board/runtime';",
      "import { t } from '../../i18n.js';",
      "import type { ActionProps, ScreenStatus, StateProps } from '../contract.js';",
      '',
      `export interface ${propsName} {`,
      '  status: ScreenStatus;',
      '  error: string | undefined;',
      '  pending: boolean;',
      '  result: unknown;',
      '  /** The action when the capability is present and the operation needs no request body. */',
      '  action: ActionProps | undefined;',
      '  onBack: () => void;',
      '}',
      '',
      `export function ${screen.component}(props: ${propsName}): ReactElement {`,
      ...indentAll([
        ...stateHooks(schema, screen.operationId, plan.posture),
        `const Run = useComponent<ActionProps>(${quote(action?.key ?? 'action.custom')}, ${quote(name)}, ${quote(screen.operationId)});`,
        ...stateReturns(schema, screen.operationId),
        'return (',
        ...indentAll([
          `<section data-testid=${tid('screen')}>`,
          `  <h1>{t(${quote(screen.titleKey)})}</h1>`,
          `  <div role="toolbar" aria-label={t(${quote(screen.titleKey)})} data-testid=${tid('actions')}>`,
          '    {props.action === undefined ? null : <Run {...props.action} />}',
          '  </div>',
          `  {props.result === undefined ? null : <pre data-testid=${tid('result')}>{JSON.stringify(props.result, null, 2)}</pre>}`,
          `  {props.result === undefined && props.action === undefined ? <Empty schema=${attr(name)} operationId=${attr(screen.operationId)} message={undefined} retry={undefined} /> : null}`,
          `  <button type="button" data-testid=${tid('back')} onClick={props.onBack}>`,
          "    {t('common.back')}",
          '  </button>',
          '</section>',
        ]),
        ');',
      ]),
      '}',
    ]),
  };
}
