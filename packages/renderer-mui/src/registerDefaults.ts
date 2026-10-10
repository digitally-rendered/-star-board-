import type { ComponentKey, ComponentRegistry } from '@star-board/core';
import { LIST_COLUMN_TYPES } from '@star-board/tokens';
import type { ElementType } from 'react';
import { CreateAction, CustomAction, DeleteAction, UpdateAction } from './actions/ActionButton.js';
import { AGENT_PANEL_TARGET, AgentPanel } from './agent/AgentPanel.js';
import { UNSAVED_CHANGES_TARGET, UnsavedChangesDialog } from './dialogs/UnsavedChangesDialog.js';
import {
  BooleanField,
  DateTimeField,
  NumberField,
  ReferenceField,
  SelectField,
  SubformField,
  TagsField,
  TextField,
} from './fields/index.js';
import { InlineHelp } from './help/InlineHelp.js';
import { CELLS } from './list/columns.js';
import {
  CreateScreen,
  CustomScreen,
  DetailScreen,
  EditScreen,
  GridScreen,
  ListScreen,
} from './screens/ScreenShell.js';
import { EmptyState, ErrorState, ForbiddenState, LoadingState } from './states/index.js';

/** A component for a key, widened so one table can hold every contract. */
export type AnyComponent = ElementType;

const fixed: Readonly<Record<string, AnyComponent>> = {
  'field.text': TextField,
  'field.select': SelectField,
  'field.datetime': DateTimeField,
  'field.number': NumberField,
  'field.boolean': BooleanField,
  'field.tags': TagsField,
  'field.subform': SubformField,
  'field.reference': ReferenceField,
  'action.create': CreateAction,
  'action.update': UpdateAction,
  'action.delete': DeleteAction,
  'action.custom': CustomAction,
  'state.empty': EmptyState,
  'state.loading': LoadingState,
  'state.error': ErrorState,
  'state.forbidden': ForbiddenState,
  'screen.list': ListScreen,
  'screen.grid': GridScreen,
  'screen.detail': DetailScreen,
  'screen.create': CreateScreen,
  'screen.edit': EditScreen,
  'screen.custom': CustomScreen,
  'help.inline': InlineHelp,
};

/** Every key this renderer implements, with its default component. */
export const DEFAULT_COMPONENTS: ReadonlyMap<ComponentKey, AnyComponent> = new Map<
  ComponentKey,
  AnyComponent
>([
  ...(Object.entries(fixed) as [ComponentKey, AnyComponent][]),
  ...LIST_COLUMN_TYPES.map((type) => [`list.column.${type}`, CELLS[type]] as const),
]);

/**
 * Registers every default as the universal match (`schema '*'`, `target '*'`, no scope,
 * `source 'generated'`), so any override at any specificity wins (shared/01 §6a). Two more
 * registrations under `screen.custom` are target-exact, so they never shadow the universal
 * `screen.custom`: target `agent-panel` is the agent affordance the generated `AgentPanelSlot`
 * resolves, and target `unsaved-changes` the dialog the generated `UnsavedChangesSlot` resolves
 * (typescript/05 §9) — shared primitives reached through the registry, not a new contract key.
 */
export function registerDefaults(registry: ComponentRegistry): void {
  for (const [key, component] of DEFAULT_COMPONENTS) {
    registry.register({ key, schema: '*', target: '*', component, source: 'generated' });
  }
  registry.register({
    key: 'screen.custom',
    schema: '*',
    target: AGENT_PANEL_TARGET,
    component: AgentPanel,
    source: 'generated',
  });
  registry.register({
    key: 'screen.custom',
    schema: '*',
    target: UNSAVED_CHANGES_TARGET,
    component: UnsavedChangesDialog,
    source: 'generated',
  });
}

/** Registrations beyond the one-per-key defaults; the parity test accounts for them. */
export const EXTRA_REGISTRATIONS = 2;
