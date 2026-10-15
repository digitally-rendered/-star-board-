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
  'ListProps',
  'Option',
  'StateProps',
  'UnsavedChangesDialogProps',
];

/** The registry target of the table body: `screen.list` / `screen.grid` at `table` (renderer `LIST_BODY_TARGET`). */
export const TABLE_TARGET = 'table';
/** The registry target of the cancel and back buttons: `action.custom` at `cancel` / `back`. */
export const CANCEL_TARGET = 'cancel';
export const BACK_TARGET = 'back';

export function emitContract(source: Source, renderer: string): GeneratedFile {
  return {
    path: CONTRACT_PATH,
    contents: lines([
      header(source),
      "import type { ComponentType, CSSProperties } from 'react';",
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
      '/** The columns a table shows: the ones not hidden, in order (the body receives the descriptors). */',
      'export function visibleColumns(columns: readonly ColumnSpec[]): ColumnSpec[] {',
      '  return columns.filter((column) => !column.hidden);',
      '}',
      '',
      '/**',
      " * The columns with their headers in the provider's locale (typescript/05 §7): `columns.ts` holds",
      ' * the default text, the screen reads `useT()` and hands the translated labels by field.',
      ' */',
      'export function localisedColumns(',
      '  columns: readonly ColumnSpec[],',
      '  headers: Readonly<Record<string, string>>,',
      '): ColumnSpec[] {',
      '  return columns.map((column) => ({ ...column, headerName: headers[column.field] ?? column.headerName }));',
      '}',
      '',
      '/** What a detail shows in place of a missing value. */',
      "export const EMPTY_VALUE = '—';",
      '',
      '/** Whether a detail value is worth a cell; otherwise the screen shows `EMPTY_VALUE`. */',
      'export function hasValue(value: unknown): boolean {',
      "  return value !== undefined && value !== null && value !== '';",
      '}',
      '',
      "const SPACE_2 = 'var(--sb-space-2, 8px)';",
      "const SPACE_3 = 'var(--sb-space-3, 16px)';",
      '',
      '/**',
      " * Layout of the generated screens: spacing from the tokens' CSS variables (ThemeRoot writes",
      ' * them), never a colour or a font, so the renderer stays the one visual authority.',
      ' */',
      'export const layout = {',
      "  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: SPACE_3, marginBottom: SPACE_3 },",
      '  heading: { margin: 0 },',
      "  subheading: { margin: 0, marginBottom: SPACE_2, fontSize: '1rem' },",
      "  toolbar: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: SPACE_2 },",
      "  actions: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: SPACE_2, marginTop: SPACE_3 },",
      "  filters: { display: 'flex', flexWrap: 'wrap', gap: SPACE_3, marginBottom: SPACE_3 },",
      "  filter: { flex: '1 1 240px', maxWidth: 360 },",
      "  stack: { display: 'grid', gap: SPACE_3 },",
      "  group: { display: 'grid', gap: SPACE_3, border: 0, padding: 0, margin: 0, minWidth: 0 },",
      '  legend: { padding: 0, marginBottom: SPACE_2, fontWeight: 600 },',
      "  definitions: { display: 'grid', gap: SPACE_3, margin: 0 },",
      "  term: { fontSize: '0.75rem', lineHeight: 1.66, opacity: 0.72, marginBottom: 2 },",
      "  definition: { margin: 0, display: 'grid', gap: 4, justifyItems: 'start', width: 'fit-content', maxWidth: '100%' },",
      '} as const satisfies Record<string, CSSProperties>;',
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

interface StateOptions {
  /** A table body renders its own loading (skeleton) and empty states, so the screen resolves neither. */
  loading?: boolean;
  empty?: boolean;
}

function stateHooks(
  schema: SchemaPlan,
  operationId: string,
  posture: GenerationPlan['posture'],
  options: StateOptions = {},
): string[] {
  const s = quote(schema.name);
  const o = quote(operationId);
  const denied = posture === '403' ? 'state.forbidden' : 'state.empty';
  return [
    options.loading === false
      ? null
      : `const Loading = useResolved<StateProps>('state.loading', ${s}, ${o});`,
    `const ErrorState = useResolved<StateProps>('state.error', ${s}, ${o});`,
    options.empty === false
      ? null
      : `const Empty = useResolved<StateProps>('state.empty', ${s}, ${o});`,
    `// Posture ${posture} (hexagonal-rules shared/01 §5): what a missing capability shows.`,
    `const Denied = useResolved<StateProps>('${denied}', ${s}, ${o});`,
  ].filter((l): l is string => l !== null);
}

function stateReturns(
  posture: GenerationPlan['posture'],
  retry = 'props.retry',
  options: StateOptions = {},
): string[] {
  return [
    options.loading === false
      ? null
      : `if (props.status === 'loading') return <Loading {...stateProps(t('common.loading'))} />;`,
    `if (props.status === 'forbidden') return <Denied {...stateProps(${deniedTitle(posture)}, props.error)} />;`,
    `if (props.status === 'error') {`,
    `  return <ErrorState {...stateProps(t('common.error'), props.error, retryAction(t('common.retry'), ${retry}))} />;`,
    '}',
  ].filter((l): l is string => l !== null);
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
  const columns: ColumnPlan[] =
    kind === 'list' ? schema.columns.list : dedupeColumns(views.flatMap((v) => v.columns));
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
  const optionImports = filterFields
    .filter((f) => filterKey(f) === 'field.select')
    .map((f) => optionsConstName(schema, f))
    .sort();
  const imports = [
    "import type { ReactElement } from 'react';",
    "import { useT } from '../../i18n.js';",
    `import {\n  layout,\n  localisedColumns,\n  retryAction,\n  stateProps,\n  useResolved,\n  visibleColumns,\n  type ActionProps,\n  type CellProps,\n${needsFieldProps ? '  type FieldProps,\n' : ''}  type ListProps,\n  type ScreenStatus,\n  type StateProps,\n  type TableProps,\n} from '../contract.js';`,
    optionImports.length > 0 ? `import { ${optionImports.join(', ')} } from './columns.js';` : null,
    `import type { ${pascal}, ${pascal}Id } from './types.js';`,
  ];
  const title = kind === 'list' ? `t(${quote(screen.titleKey)})` : 'props.title';
  // A view row may omit the id; the list row always carries it.
  const rowId =
    kind === 'list' ? `(row) => row.${idField}` : `(row) => row.${idField} ?? JSON.stringify(row)`;
  const open =
    kind === 'list'
      ? `(row) => { props.onOpen(row.${idField}); }`
      : `(row) => { if (row.${idField} !== undefined) props.onOpen(row.${idField}); }`;
  const body = [
    `export function ${screen.component}(props: ${propsName}): ReactElement {`,
    ...indentAll([
      'const t = useT();',
      ...stateHooks(schema, screen.operationId, plan.posture, { loading: false, empty: false }),
      ...collectionActions.map(
        (a) =>
          `const ${actionComponentName(a)} = useResolved<ActionProps>(${quote(a.key)}, ${quote(name)}, ${quote(a.id)});`,
      ),
      '// The table body (typescript/05 §6): the renderer registers its DataGrid at target `table`; the same',
      '// props drive the compact card list, and an app replaces the body per schema at these coordinates.',
      `const Table = useResolved<ListProps<${rowType}>>(${quote(screen.key)}, ${quote(name)}, ${quote(TABLE_TARGET)});`,
      ...columns.map((c) => cellHook(name, c.field, c.key)),
      ...filterFields.map(
        (field) =>
          `const ${componentName(field, 'Filter')} = useResolved<FieldProps<string>>(${quote(filterKey(field))}, ${quote(name)}, ${quote(field)});`,
      ),
      '// Cell renderers by field, each resolved at (schema, field) so a column override reaches the table.',
      `const cells = { ${columns.map((c) => `${c.field}: ${componentName(c.field, 'Cell')}`).join(', ')} };`,
      "// Column headers in the provider's locale; columns.ts carries the defaults.",
      `const headers = { ${columns.map((c) => `${c.field}: ${labelCall(plan, `${name}.field.${c.field}.label`)}`).join(', ')} };`,
      ...stateReturns(plan.posture, 'props.retry', { loading: false }),
      ...collectionActions.map(
        (a) =>
          `const ${a.id} = props.actions.find((action) => action.operationId === ${quote(a.id)});`,
      ),
      'return (',
      ...indentAll([
        `<section data-testid=${tid('screen')}>`,
        ...indentAll([
          `<header data-testid=${tid('header')} style={layout.header}>`,
          `  <h1 style={layout.heading}>{${title}}</h1>`,
          `  <div role="toolbar" aria-label={${title}} data-testid=${tid('actions')} style={layout.toolbar}>`,
          ...collectionActions.map(
            (a) =>
              `    {${a.id} === undefined ? null : <${actionComponentName(a)} {...${a.id}} />}`,
          ),
          '  </div>',
          '</header>',
          ...(filterFields.length > 0
            ? [
                `<div role="search" aria-label={t('common.filter')} data-testid=${tid('filters')} style={layout.filters}>`,
                ...filterFields.map((field) =>
                  indent(
                    `{props.filterable.includes(${quote(field)}) ? (\n  <div style={layout.filter}>\n    <${componentName(field, 'Filter')}\n      name=${attr(field)}\n      label={${labelCall(plan, `${name}.field.${field}.label`)}}\n      required={false}\n      value={props.filters[${quote(field)}] ?? ''}\n      onChange={(value) => { props.onFilter(${quote(field)}, value); }}\n${filterKey(field) === 'field.select' ? `      options={[...${optionsConstName(schema, field)}]}\n` : ''}    />\n  </div>\n) : null}`,
                  ),
                ),
                '</div>',
              ]
            : []),
          '<Table',
          '  rows={props.rows}',
          '  columns={localisedColumns(visibleColumns(props.columns), headers)}',
          '  cells={cells}',
          '  total={props.page.total}',
          '  page={props.page.page - 1}',
          '  pageSize={props.page.pageSize}',
          '  onPage={(page) => { props.onPage(page + 1); }}',
          '  onSort={props.onSort}',
          '  onFilter={props.onFilter}',
          `  onRowClick={${open}}`,
          "  loading={props.status === 'loading'}",
          `  getRowId={${rowId}}`,
          "  emptyLabel={t('common.empty')}",
          '  compact={props.compact}',
          `  testIdPrefix=${attr(testId(name, kind))}`,
          '/>',
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

function dedupeColumns(columns: ColumnPlan[]): ColumnPlan[] {
  const seen = new Set<string>();
  return columns.filter((c) => (seen.has(c.field) ? false : (seen.add(c.field), true)));
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
  // Update first, then the custom operations, delete last (the destructive action sits at the end).
  const itemActions = [
    ...schema.actions.filter((a) => a.item && a.kind === 'update'),
    ...schema.actions.filter((a) => a.item && a.kind === 'custom' && a.mutation),
    ...schema.actions.filter((a) => a.item && a.kind === 'delete'),
  ];
  const withHelp = fields.filter((f) => `${name}.field.${f.name}.help` in plan.i18n);
  const tid = (...rest: string[]) => attr(testId(name, 'detail', ...rest));
  const propsName = `${screen.component}Props`;
  const fieldBlock = (f: FieldPlan): string =>
    lines([
      `<div data-testid=${tid('field', f.name)}>`,
      `  <dt style={layout.term}>{${labelCall(plan, `${name}.field.${f.name}.label`)}}</dt>`,
      '  <dd style={layout.definition}>',
      `    {hasValue(entity.${f.name}) ? <${componentName(f.name, 'Cell')} value={entity.${f.name}} row={entity} column={${columnsConstName(schema)}.${f.name}} /> : EMPTY_VALUE}`,
      withHelp.includes(f)
        ? `    <${componentName(f.name, 'Help')} text={${helpExpr(plan, name, f.name)}} id=${tid('help', f.name)} />`
        : null,
      '  </dd>',
      '</div>',
    ]).trimEnd();
  // A `<dl>` admits only dt/dd groups (and divs around them), so each group is its own section.
  const list = (blocks: FieldPlan[]): string =>
    lines([
      '<dl style={layout.definitions}>',
      ...blocks.map((f) => indent(fieldBlock(f))),
      '</dl>',
    ]).trimEnd();
  const section = (id: string, title: string, blocks: FieldPlan[]): string =>
    lines([
      `<section data-testid=${tid('group', id)}>`,
      `  <h2 style={layout.subheading}>{${title}}</h2>`,
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
      `import {\n  EMPTY_VALUE,\n  hasValue,\n  layout,\n  retryAction,\n  stateProps,\n  useResolved,\n  type ActionProps,\n  type CellProps,\n${withHelp.length > 0 ? '  type HelpProps,\n' : ''}  type ScreenStatus,\n  type StateProps,\n} from '../contract.js';`,
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
        `const Back = useResolved<ActionProps>('action.custom', ${quote(name)}, ${quote(BACK_TARGET)});`,
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
            `<header data-testid=${tid('header')} style={layout.header}>`,
            `  <h1 style={layout.heading}>{t(${quote(screen.titleKey)})}</h1>`,
            `  <div role="toolbar" aria-label={t(${quote(screen.titleKey)})} data-testid=${tid('actions')} style={layout.toolbar}>`,
            ...itemActions.map(
              (a) =>
                `    {${a.id} === undefined ? null : <${actionComponentName(a)} {...${a.id}} />}`,
            ),
            '  </div>',
            '</header>',
            `<div data-testid=${tid('fields')} style={layout.stack}>`,
            ...groups.map((g) => indent(g)),
            '</div>',
            '<div style={layout.actions}>',
            `  <Back operationId=${attr(BACK_TARGET)} label={t('common.back')} variant="outlined" testId=${tid('back')} onClick={props.onBack} />`,
            '</div>',
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
          `<fieldset data-testid=${tid('group', g.group)} style={layout.group}>`,
          `  <legend style={layout.legend}>{${labelCall(plan, `${name}.group.${g.group}.label`)}}</legend>`,
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
    'layout',
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
        `const Cancel = useResolved<ActionProps>('action.custom', ${quote(name)}, ${quote(CANCEL_TARGET)});`,
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
            '<header style={layout.header}>',
            `  <h1 style={layout.heading}>{t(${quote(screen.titleKey)})}</h1>`,
            '</header>',
            `{disclaimer === '' ? null : <Disclaimer id=${tid('disclaimer')} text={disclaimer} />}`,
            '<div style={layout.stack}>',
            ...groups.map((g) => indent(g)),
            '</div>',
            `{props.submitError === undefined ? null : <ErrorState {...stateProps(t('common.error'), props.submitError)} />}`,
            `<AgentPanelSlot schema=${attr(name)} operationId=${attr(screen.operationId)} args={props.values} ifMatch={${kind === 'edit' ? 'props.ifMatch' : 'undefined'}} onApplied={props.onAgentApplied} disabled={props.pending} />`,
            `<div role="toolbar" aria-label={t(${quote(screen.titleKey)})} data-testid=${tid('actions')} style={layout.actions}>`,
            `  <Submit operationId=${attr(screen.operationId)} label={${labelCall(plan, action?.labelKey ?? 'common.save')}} variant="contained" disabled={props.pending} onClick={props.onSubmit} />`,
            `  <Cancel operationId=${attr(CANCEL_TARGET)} label={t('common.cancel')} variant="outlined" testId=${tid('cancel')} onClick={props.onCancel} />`,
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
      "import {\n  layout,\n  retryAction,\n  stateProps,\n  useResolved,\n  type ActionProps,\n  type ScreenStatus,\n  type StateProps,\n} from '../contract.js';",
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
        `const Back = useResolved<ActionProps>('action.custom', ${quote(name)}, ${quote(BACK_TARGET)});`,
        ...stateReturns(plan.posture, 'undefined'),
        'return (',
        ...indentAll([
          `<section data-testid=${tid('screen')}>`,
          '  <header style={layout.header}>',
          `    <h1 style={layout.heading}>{t(${quote(screen.titleKey)})}</h1>`,
          `    <div role="toolbar" aria-label={t(${quote(screen.titleKey)})} data-testid=${tid('actions')} style={layout.toolbar}>`,
          '      {props.action === undefined ? null : <Run {...props.action} />}',
          '    </div>',
          '  </header>',
          `  {props.result === undefined ? null : <pre data-testid=${tid('result')}>{JSON.stringify(props.result, null, 2)}</pre>}`,
          `  {props.result === undefined && props.action === undefined ? <Empty {...stateProps(t('common.empty'))} /> : null}`,
          '  <div style={layout.actions}>',
          `    <Back operationId=${attr(BACK_TARGET)} label={t('common.back')} variant="outlined" testId=${tid('back')} onClick={props.onBack} />`,
          '  </div>',
          '</section>',
        ]),
        ');',
      ]),
      '}',
    ]),
  };
}
