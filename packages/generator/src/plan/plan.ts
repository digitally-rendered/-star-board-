import {
  fieldKeyFor,
  type ActionKey,
  type FeatureModel,
  type FieldKey,
  type JsonSchema,
  type ListColumnKey,
  type OperationEntry,
  type SchemaEntry,
  type ScreenKey,
  type ViewEntry,
} from '@star-board/core';
import {
  humanize,
  isNullable,
  pascalCase,
  pathParams,
  primaryType,
  propertiesOf,
  requiredOf,
  sortedEntries,
  stringOf,
} from './names.js';

/**
 * The per-schema plan the emitters consume (plan Part 4 "plan" step). Everything here is derived
 * from the FeatureModel alone, in a deterministic order, so the plan is snapshot-testable.
 */
export interface GenerationPlan {
  source: { title: string; version: string };
  posture: FeatureModel['posture'];
  schemas: SchemaPlan[];
  routes: RoutePlan[];
  nav: NavEntry[];
  /** Flat i18n defaults; keys sorted. */
  i18n: Record<string, string>;
}

export interface SchemaPlan {
  name: string;
  pascal: string;
  version: string;
  /** The Document property that identifies a record (`entity_id`, then `id`, then the first required). */
  idField: string;
  ownerField: string | null;
  /** Document fields in display order. */
  fields: FieldPlan[];
  createFields: FormFieldPlan[];
  updateFields: FormFieldPlan[];
  screens: ScreenPlan[];
  actions: ActionPlan[];
  columns: {
    list: ColumnPlan[];
    views: ViewColumnsPlan[];
  };
}

export interface FieldPlan {
  name: string;
  key: FieldKey;
  columnKey: ListColumnKey;
  required: boolean;
  /** `x-ui-order` when given; fields without one follow in schema order. */
  order: number | null;
  group: string | null;
  hidden: boolean;
  label: string;
  /** `x-<field>-reason`, else `description`. */
  help: string | null;
  /** System-managed: present in the Document but in neither Create nor Update. */
  audit: boolean;
  /** JSON Schema type name used in `list.column.<type>`. */
  type: string;
  nullable: boolean;
}

export interface FormFieldPlan extends FieldPlan {
  schema: JsonSchema;
}

export type ScreenKind = ScreenKey extends `screen.${infer K}` ? K : never;

export interface ScreenPlan {
  kind: ScreenKind;
  key: ScreenKey;
  /** The operation the screen fronts; the registry target. */
  operationId: string;
  /** For `grid`: the view name. */
  view: string | null;
  component: string;
  file: string;
  route: string;
  capabilities: string[];
  titleKey: string;
}

export type ActionKind = ActionKey extends `action.${infer K}` ? K : never;

export interface ActionPlan {
  id: string;
  operation: string;
  kind: ActionKind;
  operationKind: OperationEntry['kind'];
  key: ActionKey;
  method: OperationEntry['method'];
  path: string;
  params: string[];
  capabilities: string[];
  hasRequest: boolean;
  hasResponse: boolean;
  /** `true` for a POST/PUT/PATCH/DELETE operation: an action hook over `useMutation` is emitted. */
  mutation: boolean;
  /** `true` when the operation addresses one record (its path carries the id parameter). */
  item: boolean;
  labelKey: string;
}

export interface ColumnPlan {
  field: string;
  key: ListColumnKey;
  label: string;
  hidden: boolean;
  sortable: boolean;
  type: string;
}

export interface ViewColumnsPlan {
  view: string;
  operationId: string;
  schema: string;
  columns: ColumnPlan[];
  filters: { field: string; op: string }[];
  sort: { field: string; dir: 'asc' | 'desc' }[];
  limits: { default: number; max: number };
  roles: string[];
  titleKey: string;
}

export interface RoutePlan {
  path: string;
  schema: string;
  kind: ScreenKind;
  component: string;
  operationId: string;
  view: string | null;
}

export interface NavEntry {
  schema: string;
  label: string;
  i18nKey: string;
  path: string;
}

const ID_CANDIDATES = ['entity_id', 'id'] as const;

/** Labels shared by every screen; keys live beside the per-schema ones. */
export const COMMON_I18N: Readonly<Record<string, string>> = {
  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.empty': 'Nothing here yet',
  'common.filter': 'Filter',
  'common.loading': 'Loading',
  'common.next': 'Next',
  'common.open': 'Open',
  'common.page': 'Page',
  'common.previous': 'Previous',
  'common.save': 'Save',
  'common.sort': 'Sort',
  'common.system': 'System',
};

export function plan(model: FeatureModel): GenerationPlan {
  const i18n: Record<string, string> = { ...COMMON_I18N };
  const schemas = sortedEntries(model.schemas).map(([, entry]) => planSchema(model, entry, i18n));
  const routes: RoutePlan[] = [];
  const nav: NavEntry[] = [];
  for (const schema of schemas) {
    for (const screen of schema.screens) {
      routes.push({
        path: screen.route,
        schema: schema.name,
        kind: screen.kind,
        component: screen.component,
        operationId: screen.operationId,
        view: screen.view,
      });
    }
    const list = schema.screens.find((s) => s.kind === 'list');
    const first = list ?? schema.screens[0];
    if (first) {
      const key = `${schema.name}.nav.label`;
      i18n[key] = humanize(schema.name);
      nav.push({ schema: schema.name, label: i18n[key], i18nKey: key, path: first.route });
    }
  }
  return {
    source: { title: model.title, version: model.version },
    posture: model.posture,
    schemas,
    routes,
    nav,
    i18n: sortRecord(i18n),
  };
}

function sortRecord(record: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of sortedEntries(record)) out[key] = value;
  return out;
}

function planSchema(
  model: FeatureModel,
  entry: SchemaEntry,
  i18n: Record<string, string>,
): SchemaPlan {
  const name = entry.name;
  const pascal = pascalCase(name);
  const documentProps = propertiesOf(entry.document);
  const createProps = propertiesOf(entry.create);
  const updateProps = propertiesOf(entry.update);
  const idField = pickIdField(documentProps, requiredOf(entry.document));

  const fields = orderFields(
    Object.entries(documentProps).map(([field, schema]) =>
      planField(entry, field, schema, {
        required: requiredOf(entry.document).includes(field),
        audit: !(field in createProps) && !(field in updateProps),
      }),
    ),
  );
  for (const field of fields) {
    i18n[`${name}.field.${field.name}.label`] = field.label;
    if (field.help !== null) i18n[`${name}.field.${field.name}.help`] = field.help;
  }
  const createFields = formFields(entry, entry.create, fields);
  const updateFields = formFields(entry, entry.update, fields);
  for (const field of [...createFields, ...updateFields]) {
    i18n[`${name}.field.${field.name}.label`] ??= field.label;
    if (field.help !== null) i18n[`${name}.field.${field.name}.help`] ??= field.help;
  }
  for (const field of [...fields, ...createFields, ...updateFields]) {
    if (field.group !== null) i18n[`${name}.group.${field.group}.label`] ??= humanize(field.group);
  }

  const operations = sortedEntries(model.operations)
    .map(([, op]) => op)
    .filter((op) => op.schema === name);
  const views = sortedEntries(model.views)
    .map(([, view]) => view)
    .filter((view) => view.schema === name);

  const actions = operations
    .filter((op) => op.kind !== 'view')
    .map((op) => planAction(op, idField));
  for (const action of actions) i18n[action.labelKey] = humanize(action.operation);

  const screens = planScreens(name, pascal, operations, views, i18n);
  const viewColumns = views.map((view) => planViewColumns(view, fields, i18n));
  return {
    name,
    pascal,
    version: entry.version,
    idField,
    ownerField: entry.ownerField ?? null,
    fields,
    createFields,
    updateFields,
    screens,
    actions,
    columns: { list: listColumns(fields), views: viewColumns },
  };
}

function pickIdField(props: Record<string, JsonSchema>, required: readonly string[]): string {
  for (const candidate of ID_CANDIDATES) if (candidate in props) return candidate;
  return required[0] ?? Object.keys(props)[0] ?? 'id';
}

function planField(
  entry: SchemaEntry,
  field: string,
  schema: JsonSchema,
  flags: { required: boolean; audit: boolean },
): FieldPlan {
  const type = primaryType(schema) ?? 'string';
  const hint = entry.ui.widget[field];
  const keySource = hint === undefined ? schema : { ...schema, 'x-ui-widget': hint };
  return {
    name: field,
    key: fieldKeyFor(keySource),
    columnKey: `list.column.${type}`,
    required: flags.required,
    order: entry.ui.order[field] ?? null,
    group: entry.ui.group[field] ?? null,
    hidden: entry.ui.hidden.includes(field),
    label: stringOf(schema.title) ?? humanize(field),
    help: entry.reasons[field] ?? stringOf(schema.description) ?? null,
    audit: flags.audit,
    type,
    nullable: isNullable(schema),
  };
}

/** `x-ui-order` first (ascending, ties by schema order), then the rest in schema order. */
function orderFields<F extends FieldPlan>(fields: F[]): F[] {
  const ordered = fields
    .map((field, index) => ({ field, index }))
    .sort((a, b) => {
      const ao = a.field.order;
      const bo = b.field.order;
      if (ao !== null && bo !== null) return ao - bo || a.index - b.index;
      if (ao !== null) return -1;
      if (bo !== null) return 1;
      return a.index - b.index;
    });
  return ordered.map((o) => o.field);
}

function formFields(
  entry: SchemaEntry,
  variant: JsonSchema,
  documentFields: FieldPlan[],
): FormFieldPlan[] {
  const props = propertiesOf(variant);
  const required = requiredOf(variant);
  const byName = new Map(documentFields.map((f) => [f.name, f]));
  const fields = Object.entries(props).map(([field, schema]): FormFieldPlan => {
    const base =
      byName.get(field) ??
      planField(entry, field, schema, { required: required.includes(field), audit: false });
    return {
      ...base,
      required: required.includes(field),
      audit: false,
      schema,
      hidden: base.hidden,
    };
  });
  return orderFields(fields);
}

function planAction(op: OperationEntry, idField: string): ActionPlan {
  const kind = actionKindOf(op.kind);
  const params = pathParams(op.path);
  return {
    id: op.id,
    operation: op.operation,
    kind,
    operationKind: op.kind,
    key: `action.${kind}`,
    method: op.method,
    path: op.path,
    params,
    capabilities: [...op.capabilities],
    hasRequest: op.request !== undefined,
    hasResponse: op.response !== undefined,
    mutation: op.method !== 'get',
    item: params.length > 0 && (params.includes('id') || params.includes(idField)),
    labelKey: `${op.schema}.action.${op.id}.label`,
  };
}

function actionKindOf(kind: OperationEntry['kind']): ActionKind {
  switch (kind) {
    case 'create':
    case 'update':
    case 'delete':
      return kind;
    default:
      return 'custom';
  }
}

interface ScreenSource {
  kind: ScreenKind;
  op: OperationEntry;
  view: ViewEntry | null;
  component: string;
  file: string;
  route: string;
}

function planScreens(
  name: string,
  pascal: string,
  operations: OperationEntry[],
  views: ViewEntry[],
  i18n: Record<string, string>,
): ScreenPlan[] {
  const byKind = (kind: OperationEntry['kind']): OperationEntry | undefined =>
    operations.find((op) => op.kind === kind);
  const sources: ScreenSource[] = [];
  const list = byKind('list');
  if (list) {
    sources.push({
      kind: 'list',
      op: list,
      view: null,
      component: `${pascal}ListScreen`,
      file: `${pascal}ListScreen.tsx`,
      route: `/${name}`,
    });
  }
  const create = byKind('create');
  if (create) {
    sources.push({
      kind: 'create',
      op: create,
      view: null,
      component: `${pascal}CreateScreen`,
      file: `${pascal}CreateScreen.tsx`,
      route: `/${name}/new`,
    });
  }
  const get = byKind('get');
  if (get) {
    sources.push({
      kind: 'detail',
      op: get,
      view: null,
      component: `${pascal}DetailScreen`,
      file: `${pascal}DetailScreen.tsx`,
      route: `/${name}/:id`,
    });
  }
  const update = byKind('update');
  if (update) {
    sources.push({
      kind: 'edit',
      op: update,
      view: null,
      component: `${pascal}EditScreen`,
      file: `${pascal}EditScreen.tsx`,
      route: `/${name}/:id/edit`,
    });
  }
  for (const view of views) {
    const op = operations.find((candidate) => candidate.id === view.operationId);
    if (!op) continue;
    sources.push({
      kind: 'grid',
      op,
      view,
      component: `${pascal}GridScreen`,
      file: `${pascal}GridScreen.tsx`,
      route: `/views/${view.name}`,
    });
  }
  for (const op of operations.filter((candidate) => candidate.kind === 'custom')) {
    const opPascal = pascalCase(op.operation);
    sources.push({
      kind: 'custom',
      op,
      view: null,
      component: `${pascal}${opPascal}Screen`,
      file: `${pascal}${opPascal}Screen.generated.tsx`,
      route: `/${name}/${op.operation}`,
    });
  }
  const screens: ScreenPlan[] = [];
  for (const source of sources) {
    // A screen exists only when its operation is reachable through at least one capability.
    if (source.op.capabilities.length === 0) continue;
    const titleKey =
      source.view !== null
        ? `${name}.view.${source.view.name}.title`
        : source.kind === 'custom'
          ? `${name}.screen.custom.${source.op.operation}.title`
          : `${name}.screen.${source.kind}.title`;
    i18n[titleKey] =
      source.view !== null
        ? humanize(source.view.name)
        : source.kind === 'custom'
          ? humanize(source.op.operation)
          : `${humanize(name)} ${source.kind}`;
    screens.push({
      kind: source.kind,
      key: `screen.${source.kind}`,
      operationId: source.op.id,
      view: source.view?.name ?? null,
      component: source.component,
      file: source.file,
      route: source.route,
      capabilities: [...source.op.capabilities],
      titleKey,
    });
  }
  return screens;
}

function listColumns(fields: FieldPlan[]): ColumnPlan[] {
  const visible = fields.filter((f) => !f.audit && !f.hidden);
  const audit = fields.filter((f) => f.audit || f.hidden);
  return [...visible, ...audit].map((f) => ({
    field: f.name,
    key: f.columnKey,
    label: f.label,
    hidden: f.audit || f.hidden,
    sortable: f.type !== 'object' && f.type !== 'array',
    type: f.type,
  }));
}

function planViewColumns(
  view: ViewEntry,
  fields: FieldPlan[],
  i18n: Record<string, string>,
): ViewColumnsPlan {
  const byName = new Map(fields.map((f) => [f.name, f]));
  const titleKey = `${view.schema}.view.${view.name}.title`;
  i18n[titleKey] ??= humanize(view.name);
  return {
    view: view.name,
    operationId: view.operationId,
    schema: view.schema,
    columns: view.projection.map((field): ColumnPlan => {
      const known = byName.get(field);
      return {
        field,
        key: known?.columnKey ?? 'list.column.string',
        label: known?.label ?? humanize(field),
        hidden: false,
        sortable:
          view.sort.some((s) => s.field === field) ||
          (known?.type !== 'object' && known?.type !== 'array'),
        type: known?.type ?? 'string',
      };
    }),
    filters: view.filters.map((f) => ({ field: f.field, op: f.op })),
    sort: view.sort.map((s) => ({ field: s.field, dir: s.dir })),
    limits: { default: view.limits.default, max: view.limits.max },
    roles: [...view.roles],
    titleKey,
  };
}
