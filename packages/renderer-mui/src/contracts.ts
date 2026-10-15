import type { ComponentType, ReactNode } from 'react';
import type { ListColumnType } from '@star-board/tokens';

/**
 * The prop contracts behind every component key (hexagonal-rules typescript/13 §3). The generator
 * emits screens against these shapes and resolves the implementation through the registry; an
 * override that registers for a key must accept the same props. These types are the one authority:
 * the generator's stubs are checked against them.
 */

export interface Option {
  readonly value: string;
  readonly label: string;
}

/** The field kinds a `field.subform` may nest (the `field.` prefix dropped). */
export type FieldKind =
  'text' | 'select' | 'datetime' | 'number' | 'boolean' | 'tags' | 'subform' | 'reference';

/** One nested field of a `field.subform`; `kind` picks the renderer, the rest feed its props. */
export interface FieldDescriptor {
  readonly name: string;
  readonly label: string;
  readonly kind: FieldKind;
  readonly help?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly options?: readonly Option[];
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly fields?: readonly FieldDescriptor[];
  readonly search?: (q: string) => Promise<Option[]>;
}

/**
 * `field.<kind>`. Every field renders one MUI control with an `id`, `aria-describedby` pointing at
 * the help or error text, `data-testid="field-<name>"`, a required marker and the error text.
 */
export interface FieldProps<V> {
  name: string;
  label: string;
  help?: string;
  required?: boolean;
  disabled?: boolean;
  value: V;
  onChange: (v: V) => void;
  error?: string;
  /** `field.select` */
  options?: Option[];
  /** `field.number` */
  min?: number;
  max?: number;
  step?: number;
  /** `field.subform` */
  fields?: FieldDescriptor[];
  /** `field.reference` */
  search?: (q: string) => Promise<Option[]>;
}

export type TextFieldProps = FieldProps<string>;
export type SelectFieldProps = FieldProps<string> & { options: Option[] };
/** ISO 8601 string, `''` when empty. */
export type DateTimeFieldProps = FieldProps<string>;
export type NumberFieldProps = FieldProps<number | null>;
export type BooleanFieldProps = FieldProps<boolean>;
export type TagsFieldProps = FieldProps<string[]>;
export type SubformValue = Record<string, unknown>;
export type SubformFieldProps = FieldProps<SubformValue> & { fields: FieldDescriptor[] };
/** The referenced entity's id, `null` when empty; `search` resolves ids to labels. */
export type ReferenceFieldProps = FieldProps<string | null> & {
  search: (q: string) => Promise<Option[]>;
};

/** One `x-view` column; `type` selects the `list.column.<type>` cell renderer. */
export interface ColumnDescriptor {
  readonly field: string;
  readonly headerName: string;
  readonly type: ListColumnType;
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly width?: number;
  readonly flex?: number;
  /** `enum` columns: value → label. */
  readonly options?: readonly Option[];
}

/** `list.column.<type>`: renders one cell value. */
export interface CellProps {
  value: unknown;
  row: unknown;
  column: ColumnDescriptor;
}

export type SortDirection = 'asc' | 'desc';

/**
 * The default `screen.list` / `screen.grid` body: a server-side paged, sorted and filtered table.
 * `registerDefaults` registers it at both keys with target `table` (`LIST_BODY_TARGET`), so a
 * generated screen resolves `useResolved<ListProps<Row>>('screen.list', schema, 'table')` and an
 * app replaces the body per schema at the same coordinates (no new contract key).
 */
export interface ListProps<Row = Record<string, unknown>> {
  rows: readonly Row[];
  columns: readonly ColumnDescriptor[];
  /**
   * Cell renderers by field, resolved through the registry by the caller (`list.column.<type>`
   * at `(schema, field)`); a field without one renders with the renderer's cell for its type.
   */
  cells?: Readonly<Record<string, ComponentType<CellProps>>>;
  total: number;
  /** Zero-based. */
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
  onSort: (field: string, dir: SortDirection) => void;
  onFilter: (field: string, value: string) => void;
  onRowClick?: (row: Row) => void;
  loading?: boolean;
  getRowId: (row: Row) => string;
  emptyLabel: string;
  /**
   * Mobile layout (typescript/05 §6): a card list with the first three columns and the row action.
   * Unset, the implementation follows the viewport (under the `sm` breakpoint).
   */
  compact?: boolean;
  /**
   * The page-object prefix (`<schema>-<kind>`): the body then carries `<prefix>-table`,
   * `<prefix>-row-<id>`, `<prefix>-open-<id>`, `<prefix>-sort-<field>`, `<prefix>-pager` and
   * `<prefix>-page-previous|current|next` as `data-testid`, so one set of selectors drives the
   * table and the card list alike.
   */
  testIdPrefix?: string;
}

/** `action.<kind>`: one operation as a button; `delete` and any `confirm` text open a dialog. */
export interface ActionProps {
  operationId: string;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void | Promise<void>;
  confirm?: string;
  /** Emphasis; default `contained` for `action.create`, `outlined` otherwise. */
  variant?: ActionVariant;
  /** The `data-testid`; default `action-<operationId>`. */
  testId?: string;
}

export type ActionVariant = 'contained' | 'outlined' | 'text';

/** `state.<kind>` */
export interface StateProps {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

/** `help.inline` */
export interface HelpProps {
  text: string;
  id: string;
}

export interface Breadcrumb {
  label: string;
  to?: string;
}

/**
 * `screen.<kind>` shell: one `h1`, a `main` landmark and the skip-to-content target. Embedded in a
 * host page (typescript/05 §8) the shell must not duplicate the host's landmarks: `embedded`
 * renders a labelled `section` with an `h2` instead.
 */
export interface ScreenShellProps {
  title: string;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
  children: ReactNode;
  embedded?: boolean;
}
