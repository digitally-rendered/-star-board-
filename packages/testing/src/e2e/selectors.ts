import type { FeatureModel } from '@star-board/core';
import { plan } from '@star-board/generator';

/*
 * Page-object descriptors for the generated screens: the `data-testid` vocabulary in one place,
 * with no Playwright dependency. Two emitters produce test ids:
 *
 * - the generator's screens: `<schema>-<kind>-<part>[-<extra>]`, where `<kind>` is the screen
 *   kind (`list`, `grid`, `detail`, `create`, `edit`) or the custom operation name; a table's
 *   `table`, `row`, `open`, `sort` and pager ids are derived by the renderer's list body from the
 *   `testIdPrefix` (`<schema>-<kind>`) the screen hands it, under both layouts;
 * - the renderer's contract components (reached through the registry): `field-<name>`,
 *   `action-<operationId>` (+ `-dialog`, `-cancel`, `-confirm`), `cell-<field>`, `state-<kind>`
 *   (+ `-action`), the shell `screen`, `screen-actions`, `screen-body` and `data-grid-list`.
 *
 * `selectors.test.ts` snapshots the expansion for the petstore fixture; a renamed id fails there
 * before it fails in Playwright.
 */

/** The generator's rule, encoded once: `[schema, kind, ...rest].join('-')`. */
export function testId(schema: string, kind: string, ...rest: string[]): string {
  return [schema, kind, ...rest].join('-');
}

/** Test ids the renderer owns, independent of schema. */
export const RENDERER_TEST_IDS = {
  shell: 'screen',
  shellActions: 'screen-actions',
  shellBody: 'screen-body',
  dataGrid: 'data-grid-list',
} as const;

export interface ActionSelectors {
  button: string;
  dialog: string;
  cancel: string;
  confirm: string;
}

export interface ListSelectors {
  screen: string;
  header: string;
  actions: string;
  filters: string;
  table: string;
  pager: string;
  pagePrevious: string;
  pageCurrent: string;
  pageNext: string;
  sort: (field: string) => string;
  row: (id: string) => string;
  open: (id: string) => string;
}

export interface DetailSelectors {
  screen: string;
  header: string;
  actions: string;
  fields: string;
  back: string;
  field: (name: string) => string;
  group: (id: string) => string;
}

export interface FormSelectors {
  screen: string;
  actions: string;
  cancel: string;
  group: (name: string) => string;
}

export interface CustomSelectors {
  screen: string;
  actions: string;
  result: string;
  back: string;
}

export interface SchemaSelectors {
  schema: string;
  list: ListSelectors;
  grid: ListSelectors;
  detail: DetailSelectors;
  create: FormSelectors;
  edit: FormSelectors;
  custom: (operation: string) => CustomSelectors;
  /** Renderer-owned ids. */
  field: (name: string) => string;
  action: (operationId: string) => ActionSelectors;
  cell: (field: string) => string;
  state: (kind: 'empty' | 'loading' | 'error' | 'forbidden') => { root: string; action: string };
  shell: typeof RENDERER_TEST_IDS;
}

function listSelectors(schema: string, kind: 'list' | 'grid'): ListSelectors {
  const id = (...rest: string[]) => testId(schema, kind, ...rest);
  return {
    screen: id('screen'),
    header: id('header'),
    actions: id('actions'),
    filters: id('filters'),
    table: id('table'),
    pager: id('pager'),
    pagePrevious: id('page', 'previous'),
    pageCurrent: id('page', 'current'),
    pageNext: id('page', 'next'),
    sort: (field) => id('sort', field),
    row: (rowId) => `${id('row')}-${rowId}`,
    open: (rowId) => `${id('open')}-${rowId}`,
  };
}

function formSelectors(schema: string, kind: 'create' | 'edit'): FormSelectors {
  const id = (...rest: string[]) => testId(schema, kind, ...rest);
  return {
    screen: id('screen'),
    actions: id('actions'),
    cancel: id('cancel'),
    group: (name) => id('group', name),
  };
}

export function selectors(schema: string): SchemaSelectors {
  const detail = (...rest: string[]) => testId(schema, 'detail', ...rest);
  return {
    schema,
    list: listSelectors(schema, 'list'),
    grid: listSelectors(schema, 'grid'),
    detail: {
      screen: detail('screen'),
      header: detail('header'),
      actions: detail('actions'),
      fields: detail('fields'),
      back: detail('back'),
      field: (name) => detail('field', name),
      group: (id) => detail('group', id),
    },
    create: formSelectors(schema, 'create'),
    edit: formSelectors(schema, 'edit'),
    custom: (operation) => ({
      screen: testId(schema, operation, 'screen'),
      actions: testId(schema, operation, 'actions'),
      result: testId(schema, operation, 'result'),
      back: testId(schema, operation, 'back'),
    }),
    field: (name) => `field-${name}`,
    action: (operationId) => ({
      button: `action-${operationId}`,
      dialog: `action-${operationId}-dialog`,
      cancel: `action-${operationId}-cancel`,
      confirm: `action-${operationId}-confirm`,
    }),
    cell: (field) => `cell-${field}`,
    state: (kind) => ({ root: `state-${kind}`, action: `state-${kind}-action` }),
    shell: RENDERER_TEST_IDS,
  };
}

/**
 * Every static test id a document's generated screens can carry, as `<schema>.<screen>.<part>`
 * → id, expanded from the generator's plan: the screens that exist, the visible fields of each
 * form and detail, the sortable columns, the actions. Functions over runtime values (row ids)
 * are not expanded.
 */
export function selectorTable(model: FeatureModel): Record<string, string> {
  const table: Record<string, string> = {};
  for (const schema of plan(model).schemas) {
    const s = selectors(schema.name);
    const put = (key: string, value: string): void => {
      table[`${schema.name}.${key}`] = value;
    };
    for (const screen of schema.screens) {
      switch (screen.kind) {
        case 'list':
        case 'grid': {
          const sel = screen.kind === 'list' ? s.list : s.grid;
          const prefix = screen.kind === 'list' ? 'list' : `grid.${screen.view ?? ''}`;
          const view = schema.columns.views.find((v) => v.view === screen.view);
          // The filter bar exists only on a grid whose view declares filters.
          const hasFilters = screen.kind === 'grid' && (view?.filters.length ?? 0) > 0;
          for (const [part, value] of Object.entries(sel)) {
            if (typeof value !== 'string' || (part === 'filters' && !hasFilters)) continue;
            put(`${prefix}.${part}`, value);
          }
          // A grid screen is one file per schema over the union of its views' columns; a sort
          // button is emitted for every sortable column (hidden ones render only when shown).
          const columns =
            screen.kind === 'list'
              ? schema.columns.list
              : schema.columns.views.flatMap((v) => v.columns);
          for (const column of columns.filter((c) => c.sortable))
            put(`${prefix}.sort.${column.field}`, sel.sort(column.field));
          break;
        }
        case 'detail': {
          for (const [part, value] of Object.entries(s.detail)) {
            if (typeof value === 'string') put(`detail.${part}`, value);
          }
          const visible = schema.fields.filter((f) => !f.hidden);
          for (const field of visible)
            put(`detail.field.${field.name}`, s.detail.field(field.name));
          // Record fields grouped by x-ui-group, then one `system` section for the audit fields.
          for (const field of visible.filter((f) => !f.audit && f.group !== null))
            put(`detail.group.${field.group ?? ''}`, s.detail.group(field.group ?? ''));
          if (visible.some((f) => f.audit)) put('detail.group.system', s.detail.group('system'));
          break;
        }
        case 'create':
        case 'edit': {
          const sel = screen.kind === 'create' ? s.create : s.edit;
          for (const [part, value] of Object.entries(sel)) {
            if (typeof value === 'string') put(`${screen.kind}.${part}`, value);
          }
          const fields = screen.kind === 'create' ? schema.createFields : schema.updateFields;
          for (const field of fields.filter((f) => !f.hidden)) {
            put(`${screen.kind}.field.${field.name}`, s.field(field.name));
            if (field.group !== null)
              put(`${screen.kind}.group.${field.group}`, sel.group(field.group));
          }
          break;
        }
        case 'custom': {
          const action = schema.actions.find((a) => a.id === screen.operationId);
          const operation = action?.operation ?? screen.operationId;
          const custom = s.custom(operation);
          for (const part of ['screen', 'actions', 'result', 'back'] as const)
            put(`custom.${operation}.${part}`, custom[part]);
          break;
        }
      }
    }
    // Only a mutation renders as an `action.<kind>` button; reads are screens, not actions.
    for (const action of schema.actions.filter((a) => a.mutation))
      put(`action.${action.id}`, s.action(action.id).button);
  }
  return Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)));
}
