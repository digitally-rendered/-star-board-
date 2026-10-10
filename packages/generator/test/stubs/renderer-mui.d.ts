/**
 * Stub of `@star-board/renderer-mui` for the compile test: `registerDefaults` and the prop
 * contracts of packages/renderer-mui/src/contracts.ts, agent/AgentPanel.tsx and
 * dialogs/UnsavedChangesDialog.tsx, which the generated `domain/*` files re-export or resolve.
 * Keep in step with the renderer.
 */
import type { ComponentRegistry } from '@star-board/core';

export declare function registerDefaults(registry: ComponentRegistry): void;

export interface Option {
  readonly value: string;
  readonly label: string;
}
export type FieldKind =
  'text' | 'select' | 'datetime' | 'number' | 'boolean' | 'tags' | 'subform' | 'reference';
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
export interface FieldProps<V> {
  name: string;
  label: string;
  help?: string;
  required?: boolean;
  disabled?: boolean;
  value: V;
  onChange: (v: V) => void;
  error?: string;
  options?: Option[];
  min?: number;
  max?: number;
  step?: number;
  fields?: FieldDescriptor[];
  search?: (q: string) => Promise<Option[]>;
}
export type ListColumnType = 'string' | 'number' | 'boolean' | 'date-time' | 'enum' | 'reference';
export interface ColumnDescriptor {
  readonly field: string;
  readonly headerName: string;
  readonly type: ListColumnType;
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly width?: number;
  readonly flex?: number;
  readonly options?: readonly Option[];
}
export interface CellProps {
  value: unknown;
  row: unknown;
  column: ColumnDescriptor;
}
export interface ActionProps {
  operationId: string;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void | Promise<void>;
  confirm?: string;
}
export interface StateProps {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}
export interface HelpProps {
  text: string;
  id: string;
}
export interface AgentPanelProps {
  operationId: string;
  args: unknown;
  ifMatch?: string;
  onApplied?: (result: unknown) => void;
  disabled?: boolean;
  values?: unknown;
  schema?: string;
}
export interface UnsavedChangesDialogProps {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
  text?: string;
}
