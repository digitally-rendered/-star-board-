import type { FieldKey } from '@star-board/core';
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
 * the resolved contract components (`useResolved(key, schema, target)` over the runtime's
 * registry hook) and never fetch. The field, cell, action, state and help props are the
 * renderer's own contracts, re-exported by `domain/contract.ts`; every interactive element
 * carries a `data-testid`; every user-facing string is a key through `useT()` (typescript/05 §7).
 */

export const CONTRACT_PATH = 'domain/contract.ts';
export const AGENT_PANEL_PATH = 'domain/AgentPanelSlot.tsx';

/** The renderer types the generated code re-exports; the compile stub mirrors `contracts.ts`. */
const RENDERER_TYPES = [
  'ActionProps',
  'CellProps',
  'ColumnDescriptor',
  'FieldDescriptor',
  'FieldProps',
  'HelpProps',
  'Option',
  'StateProps',
  'UnsavedChangesDialogProps',
];

export function emitContract(source: Source, renderer: string): GeneratedFile {
  return {
    path: CONTRACT_PATH,
    contents: lines([
      header(source),
      "import type { ComponentType } from 'react';",
      "import type { ComponentKey, ListColumnKey } from '@star-board/core';",
      `import type { ${RENDERER_TYPES.join(', ')} } from ${quote(renderer)};`,
      "import { useComponent } from '@star-board/runtime';",
      '',
      '/*',
      ' * The props every generated screen composes (hexagonal-rules typescript/13 §3). Field, cell,',
      ' * action, state and help props are the renderer contract itself, re-exported so an override',
      ' * registered for a key accepts the same props as the default it replaces; the table, agent',
      " * slot and status shapes are the generator's own.",
      ' */',
      `export type { ${RENDERER_TYPES.join(', ')} };`,
      '',
      '/** What a container hook reports to its screen. */',
      "export type ScreenStatus = 'loading' | 'error' | 'forbidden' | 'ready';",
      "export type SortDirection = 'asc' | 'desc';",
      '',
      '/**',
      ' * The component the registry resolves for `key` on (schema, target): the renderer default or',
      ' * an override at narrower coordinates. The caller names the props; the registry holds them untyped.',
      ' */',
      'export function useResolved<P>(key: ComponentKey, schema: string, target: string): ComponentType<P> {',
      '  return useComponent<ComponentType<P>>(key, schema, target).component;',
      '}',
      '',
      '/**',
      ' * `useResolved` for a slot that may have no registration (a renderer that lacks the primitive):',
      ' * null instead of a RegistryError, so the caller renders nothing.',
      ' */',
      'export function useOptionalResolved<P>(',
      '  key: ComponentKey,',
      '  schema: string,',
      '  target: string,',
      '): ComponentType<P> | null {',
      '  try {',
      '    return useComponent<ComponentType<P>>(key, schema, target).component;',
      '  } catch {',
      '    return null;',
      '  }',
      '}',
      '',
      '/** One column of a generated table: the renderer descriptor plus its registry key and visibility. */',
      'export interface ColumnSpec extends ColumnDescriptor {',
      '  readonly key: ListColumnKey;',
      '  readonly hidden: boolean;',
      '}',
      '',
      'export interface PageState {',
      '  /** One-based, as the runtime ListQuery counts pages. */',
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
      'export interface TableProps<Row> {',
      '  rows: readonly Row[];',
      '  columns: readonly ColumnSpec[];',
      '  /** Under the `sm` breakpoint (typescript/05 §6): a card list of the first columns instead of the table. */',
      '  compact: boolean;',
      '  page: PageState;',
      '  sort: SortState | undefined;',
      '  filters: Readonly<Record<string, string>>;',
      '  onPage: (page: number) => void;',
      '  onSort: (field: string, dir: SortDirection) => void;',
      '  onFilter: (field: string, value: string) => void;',
      '  retry: (() => void) | undefined;',
      '}',
      '',
      '/** Props of the agent affordance slot beside a generated form (shared/13 §4). */',
      'export interface AgentSlotProps {',
      '  schema: string;',
      '  operationId: string;',
      '  /** The arguments the operation would be called with: the form values. */',
      '  args: unknown;',
      '  /** The ETag of the document being edited; an update or delete never applies without it. */',
      '  ifMatch: string | undefined;',
      '  onApplied: ((result: unknown) => void) | undefined;',
      '  disabled: boolean;',
      '}',
      '',
      '/** The optional field props, present only when defined (exactOptionalPropertyTypes). */',
      'export interface FieldText {',
      '  help?: string;',
      '  error?: string;',
      '}',
      '',
      'export function fieldText(help: string | undefined, error: string | undefined): FieldText {',
      '  const out: FieldText = {};',
      '  if (help !== undefined) out.help = help;',
      '  if (error !== undefined) out.error = error;',
      '  return out;',
      '}',
      '',
      '/** State props with the optional members present only when defined. */',
      'export function stateProps(',
      '  title: string,',
      '  description?: string,',
      "  action?: StateProps['action'],",
      '): StateProps {',
      '  const out: StateProps = { title };',
      '  if (description !== undefined) out.description = description;',
      '  if (action !== undefined) out.action = action;',
      '  return out;',
      '}',
      '',
      "export function retryAction(label: string, retry: (() => void) | undefined): StateProps['action'] {",
      '  return retry === undefined ? undefined : { label, onClick: retry };',
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
      '',
      '/** How many columns a compact card shows (typescript/05 §6: wider tables need a responsive pattern). */',
      'export const COMPACT_CARD_COLUMNS = 3;',
      '',
      '/** The shown fields a compact card carries: the first `limit` in column order. */',
      'export function cardFields(',
      '  columns: readonly ColumnSpec[],',
      '  limit: number = COMPACT_CARD_COLUMNS,',
      '): ReadonlySet<string> {',
      '  return new Set([...shownFields(columns)].slice(0, limit));',
      '}',
      '',
      '/** A reference field has no lookup by default; register a `field.reference` override that searches. */',
      'export function noReferenceSearch(): Promise<Option[]> {',
      '  return Promise.resolve([]);',
      '}',
    ]),
  };
}

export function emitAgentPanelSlot(source: Source, renderer: string): GeneratedFile {
  return {
    path: AGENT_PANEL_PATH,
    contents: lines([
      header(source),
      "import type { ComponentType, ReactElement } from 'react';",
      `import type { AgentPanelProps } from ${quote(renderer)};`,
      "import { useComponent } from '@star-board/runtime';",
      "import type { AgentSlotProps } from './contract.js';",
      '',
      '/**',
      ' * The agent affordance slot beside every generated form (hexagonal-rules shared/13 §4). It renders',
      ' * the component registered for `screen.custom` with target `agent-panel` (the renderer registers',
      ' * its AgentPanel there); without a registration the slot renders null. `ifMatch` and `onApplied`',
      ' * are passed only when defined so the panel sees exactly the props the form has.',
      ' */',
      'export function AgentPanelSlot(props: AgentSlotProps): ReactElement | null {',
      '  const Panel = useAgentPanel(props.schema);',
      '  if (Panel === null) return null;',
      '  const panel: AgentPanelProps = {',
      '    operationId: props.operationId,',
      '    args: props.args,',
      '    disabled: props.disabled,',
      '  };',
      '  if (props.ifMatch !== undefined) panel.ifMatch = props.ifMatch;',
      '  if (props.onApplied !== undefined) panel.onApplied = props.onApplied;',
      '  return <Panel {...panel} />;',
      '}',
      '',
      'function useAgentPanel(schema: string): ComponentType<AgentPanelProps> | null {',
      '  try {',
      "    return useComponent<ComponentType<AgentPanelProps>>('screen.custom', schema, 'agent-panel')",
      '      .component;',
      '  } catch {',
      '    return null;',
      '  }',
      '}',
    ]),
  };
}

/* ------------------------------------------------------------------ columns */

export function columnsConstName(schema: SchemaPlan): string {
  return `${schema.name.toUpperCase()}_COLUMNS`;
}

export function listColumnsConstName(schema: SchemaPlan): string {
  return `${schema.name.toUpperCase()}_LIST_COLUMNS`;
}

export function viewConstName(view: string): string {
  return `${view.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()}_COLUMNS`;
}

function viewColumnsObjectName(view: string): string {
  return `${view.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()}_VIEW_COLUMNS`;
}

export function optionsConstName(schema: SchemaPlan, field: string): string {
  return `${schema.name.toUpperCase()}_${field.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()}_OPTIONS`;
}

function columnLiteral(plan: GenerationPlan, schema: SchemaPlan, column: ColumnPlan): string {
  const label = labelCall(plan, `${schema.name}.field.${column.field}.label`);
  const options =
    column.options === null ? '' : `, options: ${optionsConstName(schema, column.field)}`;
  return `{ field: ${quote(column.field)}, key: ${quote(column.key)}, type: ${quote(column.type)}, headerName: ${label}, hidden: ${String(column.hidden)}, sortable: ${String(column.sortable)}${options} }`;
}

/** `domain/<schema>/columns.ts`: enum option labels and the column descriptors of every table. */
export function emitColumns(
  plan: GenerationPlan,
  schema: SchemaPlan,
  source: Source,
): GeneratedFile {
  const { name } = schema;
  const withOptions = [
    ...new Map(
      [...schema.fields, ...schema.createFields, ...schema.updateFields]
        .filter((f) => f.options !== null)
        .map((f) => [f.name, f] as const),
    ).values(),
  ];
  const needsOption = withOptions.length > 0;
  const views = schema.columns.views;
  return {
    path: `domain/${name}/columns.ts`,
    contents: lines([
      header(source),
      "import { t } from '../../i18n.js';",
      `import type { ColumnSpec${needsOption ? ', Option' : ''} } from '../contract.js';`,
      '',
      ...withOptions.flatMap((f) => [
        `/** The members of \`${f.name}\` with their labels. */`,
        `export const ${optionsConstName(schema, f.name)}: readonly Option[] = [`,
        ...(f.options ?? []).map((value) =>
          indent(
            `{ value: ${quote(value)}, label: ${labelCall(plan, `${name}.field.${f.name}.option.${value}`)} },`,
          ),
        ),
        '];',
        '',
      ]),
      `/** Every Document field of ${name} as a column; system fields are hidden by default. */`,
      `export const ${columnsConstName(schema)} = {`,
      ...schema.columns.list.map((c) => indent(`${c.field}: ${columnLiteral(plan, schema, c)},`)),
      '} satisfies Record<string, ColumnSpec>;',
      '',
      `/** Columns of the ${name} list, in display order. */`,
      `export const ${listColumnsConstName(schema)}: readonly ColumnSpec[] = [`,
      ...schema.columns.list.map((c) => indent(`${columnsConstName(schema)}.${c.field},`)),
      '];',
      ...views.flatMap((view) => [
        '',
        `/** Columns of the \`${view.view}\` view (its projection). */`,
        `export const ${viewColumnsObjectName(view.view)} = {`,
        ...view.columns.map((c) => indent(`${c.field}: ${columnLiteral(plan, schema, c)},`)),
        '} satisfies Record<string, ColumnSpec>;',
        '',
        `export const ${viewConstName(view.view)}: readonly ColumnSpec[] = [`,
        ...view.columns.map((c) => indent(`${viewColumnsObjectName(view.view)}.${c.field},`)),
        '];',
      ]),
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

function deniedTitle(posture: GenerationPlan['posture']): string {
  return posture === '403' ? "t('common.forbidden')" : "t('common.notFound')";
}

function stateHooks(schema: SchemaPlan, operationId: string, posture: GenerationPlan['posture']) {
  const s = quote(schema.name);
  const o = quote(operationId);
  const denied = posture === '403' ? 'state.forbidden' : 'state.empty';
  return [
    `const Loading = useResolved<StateProps>('state.loading', ${s}, ${o});`,
    `const ErrorState = useResolved<StateProps>('state.error', ${s}, ${o});`,
    `const Empty = useResolved<StateProps>('state.empty', ${s}, ${o});`,
    `// Posture ${posture} (hexagonal-rules shared/01 §5): what a missing capability shows.`,
    `const Denied = useResolved<StateProps>('${denied}', ${s}, ${o});`,
  ];
}

function stateReturns(posture: GenerationPlan['posture'], retry = 'props.retry'): string[] {
  return [
    `if (props.status === 'loading') return <Loading {...stateProps(t('common.loading'))} />;`,
    `if (props.status === 'forbidden') return <Denied {...stateProps(${deniedTitle(posture)}, props.error)} />;`,
    `if (props.status === 'error') {`,
    `  return <ErrorState {...stateProps(t('common.error'), props.error, retryAction(t('common.retry'), ${retry}))} />;`,
    '}',
  ];
}

function cellHook(schema: string, field: string, key: string): string {
  return `const ${componentName(field, 'Cell')} = useResolved<CellProps>(${quote(key)}, ${quote(schema)}, ${quote(field)});`;
}

/** The widget value type for a field key, in terms of the payload member type. */
function widgetValueType(key: FieldKey, member: string): string {
  switch (key) {
    case 'field.select':
      return `NonNullable<${member}> | ''`;
    case 'field.number':
      return 'number | null';
    case 'field.boolean':
      return 'boolean';
    case 'field.tags':
      return 'string[]';
    case 'field.subform':
      return `Partial<NonNullable<${member}>>`;
    case 'field.reference':
      return 'string | null';
    default:
      return 'string';
  }
}

/** The widget `value` expression for a (possibly absent) payload value. */
function widgetValue(key: FieldKey, expr: string): string {
  switch (key) {
    case 'field.number':
    case 'field.reference':
      return `${expr} ?? null`;
    case 'field.boolean':
      return `${expr} ?? false`;
    case 'field.tags':
      return `${expr} ?? []`;
    case 'field.subform':
      return `${expr} ?? {}`;
    default:
      return `${expr} ?? ''`;
  }
}

/** What the form receives back from the widget: empty text and null mean "not set". */
function widgetChange(key: FieldKey, field: string, payload: string): string {
  switch (key) {
    case 'field.text':
    case 'field.select':
    case 'field.datetime':
      return `props.onChange(${quote(field)}, value === '' ? undefined : value);`;
    case 'field.number':
    case 'field.reference':
      return `props.onChange(${quote(field)}, value ?? undefined);`;
    case 'field.subform':
      // The nested object is completed by the user and validated by zod on submit.
      return `props.onChange(${quote(field)}, value as ${payload}[${quote(field)}]);`;
    default:
      return `props.onChange(${quote(field)}, value);`;
  }
}

/** Props a widget kind needs beyond the common field props. */
function widgetExtras(schema: SchemaPlan, field: FormFieldPlan): string[] {
  switch (field.key) {
    case 'field.select':
      return [`options={[...${optionsConstName(schema, field.name)}]}`];
    case 'field.subform':
      return [`fields={${subformFields(schema, field)}}`];
    case 'field.reference':
      return ['search={noReferenceSearch}'];
    default:
      return [];
  }
}

function subformFields(schema: SchemaPlan, field: FormFieldPlan): string {
  const properties = field.schema.properties;
  if (typeof properties !== 'object' || properties === null || Array.isArray(properties)) {
    return '[]';
  }
  const members = Object.keys(properties as Record<string, unknown>).map(
    (name) =>
      `{ name: ${quote(name)}, label: t(${quote(`${schema.name}.field.${field.name}.${name}.label`)}), kind: 'text' }`,
  );
  return `[${members.join(', ')}]`;
}

function indentAll(parts: readonly (string | null)[], depth = 1): string[] {
  return parts.filter((p): p is string => p !== null).map((p) => indent(p, depth));
}

/* ------------------------------------------------------------- list / grid */

function emitTableScreen(ctx: ScreenContext, kind: 'list' | 'grid'): GeneratedFile {
  const { plan, schema, screen, source } = ctx;
  const { name, pascal, idField } = schema;
  const rowType = kind === 'list' ? pascal : `Partial<${pascal}>`;
  const views = kind === 'grid' ? schema.columns.views : [];
  // Columns a table may show: the list projection, or the union of every view's projection.
  const columns: { column: ColumnPlan; descriptor: string }[] =
    kind === 'list'
      ? schema.columns.list.map((c) => ({
          column: c,
          descriptor: `${columnsConstName(schema)}.${c.field}`,
        }))
      : dedupe(
          views.flatMap((v) =>
            v.columns.map((c) => ({
              column: c,
              descriptor: `${viewColumnsObjectName(v.view)}.${c.field}`,
            })),
          ),
        );
  const filterFields = dedupeStrings(views.flatMap((v) => v.filters.map((f) => f.field)));
  const fieldByName = new Map(schema.fields.map((f) => [f.name, f]));
  const filterKey = (field: string): 'field.select' | 'field.text' =>
    fieldByName.get(field)?.options ? 'field.select' : 'field.text';
  // Collection actions (create, bulk) belong to the list; a view is read-only.
  const collectionActions =
    kind === 'list'
      ? schema.actions.filter(
          (a) => a.mutation && !a.item && a.kind !== 'custom' && a.kind !== 'update',
        )
      : [];
  const tid = (...rest: string[]) => attr(testId(name, kind, ...rest));
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
  const columnImports = [
    ...new Set([
      ...columns.map((c) => c.descriptor.split('.')[0] ?? ''),
      ...filterFields
        .filter((f) => filterKey(f) === 'field.select')
        .map((f) => optionsConstName(schema, f)),
    ]),
  ].sort();
  const imports = [
    "import type { ReactElement } from 'react';",
    "import { useT } from '../../i18n.js';",
    `import {\n  cardFields,\n  nextDirection,\n  retryAction,\n  shownFields,\n  stateProps,\n  useResolved,\n  type ActionProps,\n  type CellProps,\n${needsFieldProps ? '  type FieldProps,\n' : ''}  type ScreenStatus,\n  type StateProps,\n  type TableProps,\n} from '../contract.js';`,
    `import { ${columnImports.join(', ')} } from './columns.js';`,
    `import type { ${pascal}, ${pascal}Id } from './types.js';`,
  ];
  const openButton = `<button type="button" data-testid={\`${testId(name, kind, 'open')}-\${id}\`} onClick={() => { props.onOpen(id); }}>\n  {t('common.open')}\n</button>`;
  const openControl =
    kind === 'list' ? openButton : `{id === undefined ? null : (\n${indent(openButton)}\n)}`;
  const openCell = `<td>\n${indent(openControl)}\n</td>`;
  // A view row may omit the id; the list row always carries it.
  const rowKey = kind === 'list' ? 'id' : 'id ?? String(index)';
  const rowMap = kind === 'list' ? '(row) => {' : '(row, index) => {';
  const title = kind === 'list' ? `t(${quote(screen.titleKey)})` : 'props.title';
  // The compact body (typescript/05 §6): one card per row, the first shown columns, the row action.
  // It keeps the table's page-object ids (`-table`, `-row-<id>`, `-open-<id>`) under `data-layout="cards"`.
  const cards = [
    `<ul aria-label={${title}} data-testid=${tid('table')} data-layout="cards">`,
    `  {props.rows.map(${rowMap}`,
    `    const id = row.${idField};`,
    '    return (',
    `      <li key={${rowKey}} data-testid={\`${testId(name, kind, 'row')}-\${${rowKey}}\`}>`,
    '        <dl>',
    ...columns.map((c) =>
      indent(
        `{cards.has(${quote(c.column.field)}) ? (\n  <div>\n    <dt>{${labelCall(plan, `${name}.field.${c.column.field}.label`)}}</dt>\n    <dd>\n      <${componentName(c.column.field, 'Cell')} value={row.${c.column.field}} row={row} column={${c.descriptor}} />\n    </dd>\n  </div>\n) : null}`,
        5,
      ),
    ),
    '        </dl>',
    indent(openControl, 4),
    '      </li>',
    '    );',
    '  })}',
    '</ul>',
  ];
  const body = [
    `export function ${screen.component}(props: ${propsName}): ReactElement {`,
    ...indentAll([
      'const t = useT();',
      ...stateHooks(schema, screen.operationId, plan.posture),
      ...collectionActions.map(
        (a) =>
          `const ${actionComponentName(a)} = useResolved<ActionProps>(${quote(a.key)}, ${quote(name)}, ${quote(a.id)});`,
      ),
      ...columns.map((c) => cellHook(name, c.column.field, c.column.key)),
      ...filterFields.map(
        (field) =>
          `const ${componentName(field, 'Filter')} = useResolved<FieldProps<string>>(${quote(filterKey(field))}, ${quote(name)}, ${quote(field)});`,
      ),
      'const shown = shownFields(props.columns);',
      'const cards = cardFields(props.columns);',
      ...stateReturns(plan.posture),
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
                    `{props.filterable.includes(${quote(field)}) ? (\n  <${componentName(field, 'Filter')}\n    name=${attr(field)}\n    label={${labelCall(plan, `${name}.field.${field}.label`)}}\n    required={false}\n    value={props.filters[${quote(field)}] ?? ''}\n    onChange={(value) => { props.onFilter(${quote(field)}, value); }}\n${filterKey(field) === 'field.select' ? `    options={[...${optionsConstName(schema, field)}]}\n` : ''}  />\n) : null}`,
                  ),
                ),
                '</div>',
              ]
            : []),
          '{props.rows.length === 0 ? (',
          `  <Empty {...stateProps(t('common.empty'))} />`,
          ') : props.compact ? (',
          ...indentAll(cards),
          ') : (',
          ...indentAll([
            `<table data-testid=${tid('table')}>`,
            ...indentAll([
              '<thead>',
              '  <tr>',
              ...columns.map(({ column: c }) =>
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
                  `{shown.has(${quote(c.column.field)}) ? (\n  <td>\n    <${componentName(c.column.field, 'Cell')} value={row.${c.column.field}} row={row} column={${c.descriptor}} />\n  </td>\n) : null}`,
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
      `export interface ${propsName} extends TableProps<${rowType}> {`,
      ...propsMembers.map((m) => indent(m)),
      '}',
      '',
      ...body,
    ]),
  };
}

function dedupe<T extends { column: ColumnPlan }>(columns: T[]): T[] {
  const seen = new Set<string>();
  return columns.filter((c) =>
    seen.has(c.column.field) ? false : (seen.add(c.column.field), true),
  );
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
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
      `    <${componentName(f.name, 'Cell')} value={entity.${f.name}} row={entity} column={${columnsConstName(schema)}.${f.name}} />`,
      withHelp.includes(f)
        ? `    <${componentName(f.name, 'Help')} text={${helpExpr(plan, name, f.name)}} id=${tid('help', f.name)} />`
        : null,
      '  </dd>',
      '</div>',
    ]).trimEnd();
  // A `<dl>` admits only dt/dd groups (and divs around them), so each group is its own section.
  const list = (blocks: FieldPlan[]): string =>
    lines(['<dl>', ...blocks.map((f) => indent(fieldBlock(f))), '</dl>']).trimEnd();
  const section = (id: string, title: string, blocks: FieldPlan[]): string =>
    lines([
      `<section data-testid=${tid('group', id)}>`,
      `  <h2>{${title}}</h2>`,
      indent(list(blocks)),
      '</section>',
    ]).trimEnd();
  const groups = [
    ...groupsOf(fields.filter((f) => !f.audit)).map((g) =>
      g.group === null
        ? list(g.fields)
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
      "import { useT } from '../../i18n.js';",
      `import {\n  retryAction,\n  stateProps,\n  useResolved,\n  type ActionProps,\n  type CellProps,\n${withHelp.length > 0 ? '  type HelpProps,\n' : ''}  type ScreenStatus,\n  type StateProps,\n} from '../contract.js';`,
      `import { ${columnsConstName(schema)} } from './columns.js';`,
      `import type { ${pascal} } from './types.js';`,
      '',
      `export interface ${propsName} {`,
      '  status: ScreenStatus;',
      '  error: string | undefined;',
      `  entity: ${pascal} | undefined;`,
      '  /** Actions the current capabilities allow; the container filters them. */',
      '  actions: readonly ActionProps[];',
      '  retry: (() => void) | undefined;',
      '  onBack: () => void;',
      '}',
      '',
      `export function ${screen.component}(props: ${propsName}): ReactElement {`,
      ...indentAll([
        'const t = useT();',
        ...stateHooks(schema, screen.operationId, plan.posture),
        ...itemActions.map(
          (a) =>
            `const ${actionComponentName(a)} = useResolved<ActionProps>(${quote(a.key)}, ${quote(name)}, ${quote(a.id)});`,
        ),
        ...fields.map((f) => cellHook(name, f.name, f.columnKey)),
        ...withHelp.map(
          (f) =>
            `const ${componentName(f.name, 'Help')} = useResolved<HelpProps>('help.inline', ${quote(name)}, ${quote(f.name)});`,
        ),
        ...stateReturns(plan.posture),
        'const entity = props.entity;',
        `if (entity === undefined) return <Empty {...stateProps(t('common.notFound'))} />;`,
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
            `<div data-testid=${tid('fields')}>`,
            ...groups.map((g) => indent(g)),
            '</div>',
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
      `  required={${String(f.required)}}`,
      `  value={${widgetValue(f.key, `props.values.${f.name}`)}}`,
      `  onChange={(value) => { ${widgetChange(f.key, f.name, payload)} }}`,
      ...widgetExtras(schema, f).map((extra) => `  ${extra}`),
      `  {...fieldText(${helpExpr(plan, name, f.name)}, props.errors.${f.name})}`,
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
      ? [
          'status: ScreenStatus;',
          'error: string | undefined;',
          `entity: ${pascal} | undefined;`,
          '/** `W/"<id>:<version>"` of the loaded document; sent as If-Match and handed to the agent. */',
          'ifMatch: string | undefined;',
          'retry: (() => void) | undefined;',
        ]
      : [];
  const optionConsts = fields
    .filter((f) => f.key === 'field.select')
    .map((f) => optionsConstName(schema, f.name))
    .sort();
  const needsReference = fields.some((f) => f.key === 'field.reference');
  const contractImports = [
    'fieldText',
    needsReference ? 'noReferenceSearch' : null,
    kind === 'edit' ? 'retryAction' : null,
    'stateProps',
    'useResolved',
    'type ActionProps',
    'type FieldProps',
    'type HelpProps',
    ...(kind === 'edit' ? ['type ScreenStatus'] : []),
    'type StateProps',
  ].filter((v): v is string => v !== null);
  const disclaimerKey = `${name}.screen.${kind}.disclaimer`;
  return {
    path: `domain/${name}/${screen.file}`,
    contents: lines([
      header(source),
      "import type { ReactElement } from 'react';",
      "import { useT } from '../../i18n.js';",
      "import { AgentPanelSlot } from '../AgentPanelSlot.js';",
      `import {\n${contractImports.map((i) => `  ${i},`).join('\n')}\n} from '../contract.js';`,
      optionConsts.length > 0 ? `import { ${optionConsts.join(', ')} } from './columns.js';` : null,
      `import type { ${kind === 'edit' ? `${pascal}, ` : ''}${payload} } from './types.js';`,
      '',
      `export interface ${propsName} {`,
      ...editMembers.map((m) => indent(m)),
      `  values: Partial<${payload}>;`,
      `  errors: Partial<Record<keyof ${payload}, string>>;`,
      '  /** True once the user changed a value; the container holds navigation while set (typescript/05 §9). */',
      '  dirty: boolean;',
      '  pending: boolean;',
      '  submitError: string | undefined;',
      `  onChange: <K extends keyof ${payload}>(field: K, value: ${payload}[K] | undefined) => void;`,
      '  onSubmit: () => void;',
      '  onCancel: () => void;',
      '  /** Called after the agent applied the operation (shared/13 §4); the container refetches or navigates. */',
      '  onAgentApplied: ((result: unknown) => void) | undefined;',
      '}',
      '',
      `export function ${screen.component}(props: ${propsName}): ReactElement {`,
      ...indentAll([
        'const t = useT();',
        ...(kind === 'edit' ? stateHooks(schema, screen.operationId, plan.posture) : []),
        kind === 'create'
          ? `const ErrorState = useResolved<StateProps>('state.error', ${quote(name)}, ${quote(screen.operationId)});`
          : null,
        `const Submit = useResolved<ActionProps>(${quote(actionKey)}, ${quote(name)}, ${quote(screen.operationId)});`,
        `// Regulated wording (typescript/05 §4): the reviewed disclaimer of this screen, empty unless a translation sets it.`,
        `const Disclaimer = useResolved<HelpProps>('help.inline', ${quote(name)}, ${quote(screen.operationId)});`,
        `const disclaimer = t(${quote(disclaimerKey)});`,
        ...fields.map(
          (f) =>
            `const ${componentName(f.name, 'Field')} = useResolved<FieldProps<${widgetValueType(f.key, `${payload}[${quote(f.name)}]`)}>>(${quote(f.key)}, ${quote(name)}, ${quote(f.name)});`,
        ),
        ...(kind === 'edit'
          ? [
              ...stateReturns(plan.posture),
              `if (props.entity === undefined) return <Empty {...stateProps(t('common.notFound'))} />;`,
            ]
          : []),
        'return (',
        ...indentAll([
          `<form data-testid=${tid('screen')} noValidate onSubmit={(event) => { event.preventDefault(); props.onSubmit(); }}>`,
          ...indentAll([
            `<h1>{t(${quote(screen.titleKey)})}</h1>`,
            `{disclaimer === '' ? null : <Disclaimer id=${tid('disclaimer')} text={disclaimer} />}`,
            ...groups.map((g) => g),
            `{props.submitError === undefined ? null : <ErrorState {...stateProps(t('common.error'), props.submitError)} />}`,
            `<AgentPanelSlot schema=${attr(name)} operationId=${attr(screen.operationId)} args={props.values} ifMatch={${kind === 'edit' ? 'props.ifMatch' : 'undefined'}} onApplied={props.onAgentApplied} disabled={props.pending} />`,
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
      "import { useT } from '../../i18n.js';",
      "import {\n  retryAction,\n  stateProps,\n  useResolved,\n  type ActionProps,\n  type ScreenStatus,\n  type StateProps,\n} from '../contract.js';",
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
        'const t = useT();',
        ...stateHooks(schema, screen.operationId, plan.posture),
        `const Run = useResolved<ActionProps>(${quote(action?.key ?? 'action.custom')}, ${quote(name)}, ${quote(screen.operationId)});`,
        ...stateReturns(plan.posture, 'undefined'),
        'return (',
        ...indentAll([
          `<section data-testid=${tid('screen')}>`,
          `  <h1>{t(${quote(screen.titleKey)})}</h1>`,
          `  <div role="toolbar" aria-label={t(${quote(screen.titleKey)})} data-testid=${tid('actions')}>`,
          '    {props.action === undefined ? null : <Run {...props.action} />}',
          '  </div>',
          `  {props.result === undefined ? null : <pre data-testid=${tid('result')}>{JSON.stringify(props.result, null, 2)}</pre>}`,
          `  {props.result === undefined && props.action === undefined ? <Empty {...stateProps(t('common.empty'))} /> : null}`,
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
