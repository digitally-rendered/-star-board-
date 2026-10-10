import type { FeatureModel } from '@star-board/core';
import { plan, type ScreenKind } from '@star-board/generator';
import { expect } from 'vitest';
import { selectors } from '../e2e/selectors.js';

/**
 * The static test ids a generated screen carries once it has data: the `selectorTable` entries the
 * screen kind owns, minus ids the screen renders only conditionally (sort buttons of hidden
 * columns, the filter bar of a view without filters). Renderer-owned ids (`field-<name>`) are
 * included for the forms because the resolved field components always emit them.
 */
export function renderedTestIds(
  model: FeatureModel,
  schema: string,
  kind: ScreenKind,
  view?: string,
): string[] {
  const planned = plan(model).schemas.find((s) => s.name === schema);
  if (planned === undefined) throw new Error(`no schema ${schema} in the document`);
  const s = selectors(schema);
  const ids: string[] = [];
  switch (kind) {
    case 'list':
    case 'grid': {
      const sel = kind === 'list' ? s.list : s.grid;
      ids.push(sel.screen, sel.header, sel.actions, sel.table, sel.pager);
      ids.push(sel.pagePrevious, sel.pageCurrent, sel.pageNext);
      const columns =
        kind === 'list'
          ? planned.columns.list
          : (planned.columns.views.find((v) => v.view === view)?.columns ?? []);
      for (const column of columns.filter((c) => c.sortable && !c.hidden))
        ids.push(sel.sort(column.field));
      const filters = planned.columns.views.find((v) => v.view === view)?.filters ?? [];
      if (kind === 'grid' && filters.length > 0) ids.push(sel.filters);
      break;
    }
    case 'detail': {
      ids.push(s.detail.screen, s.detail.header, s.detail.actions, s.detail.fields, s.detail.back);
      const visible = planned.fields.filter((f) => !f.hidden);
      for (const field of visible) ids.push(s.detail.field(field.name));
      for (const group of new Set(
        visible.filter((f) => !f.audit && f.group !== null).map((f) => f.group ?? ''),
      ))
        ids.push(s.detail.group(group));
      if (visible.some((f) => f.audit)) ids.push(s.detail.group('system'));
      break;
    }
    case 'create':
    case 'edit': {
      const sel = kind === 'create' ? s.create : s.edit;
      ids.push(sel.screen, sel.actions, sel.cancel);
      const fields = (kind === 'create' ? planned.createFields : planned.updateFields).filter(
        (f) => !f.hidden,
      );
      for (const field of fields) ids.push(s.field(field.name));
      for (const group of new Set(fields.filter((f) => f.group !== null).map((f) => f.group ?? '')))
        ids.push(sel.group(group));
      break;
    }
    case 'custom': {
      const screen = planned.screens.find((sc) => sc.kind === 'custom' && sc.view === view);
      const action = planned.actions.find((a) => a.id === screen?.operationId);
      const custom = s.custom(action?.operation ?? view ?? '');
      ids.push(custom.screen, custom.actions, custom.back);
      break;
    }
  }
  return [...new Set(ids)];
}

/** Fails naming every id of `ids` that `container` does not carry as a `data-testid`. */
export function expectTestIds(container: ParentNode, ids: readonly string[]): void {
  const missing = ids.filter((id) => container.querySelector(`[data-testid="${id}"]`) === null);
  expect(missing, `missing data-testid`).toEqual([]);
}
