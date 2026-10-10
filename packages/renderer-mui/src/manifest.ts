import type { ComponentKey } from '@star-board/core';
import type { ComponentType, ElementType } from 'react';
import { CreateAction, CustomAction, DeleteAction, UpdateAction } from './actions/ActionButton.js';
import {
  AGENT_PANEL_TARGET,
  AgentPanel,
  AgentPanelView,
  type AgentPanelProps,
  type AgentPanelState,
  type AgentPanelViewProps,
} from './agent/AgentPanel.js';
import type {
  ActionProps,
  CellProps,
  ColumnDescriptor,
  HelpProps,
  ScreenShellProps,
  StateProps,
} from './contracts.js';
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
import {
  BooleanCell,
  DateTimeCell,
  EnumCell,
  NumberCell,
  ReferenceCell,
  StringCell,
} from './list/columns.js';
import {
  CreateScreen,
  CustomScreen,
  DetailScreen,
  EditScreen,
  GridScreen,
  ListScreen,
} from './screens/ScreenShell.js';
import { EmptyState, ErrorState, ForbiddenState, LoadingState } from './states/index.js';

/**
 * One story seed per contract key for the storybook package (task 20) to iterate: the component
 * and props that render it in its resting state. Built through {@link entry} so the props are
 * checked against the component at compile time, then widened.
 */
export interface ManifestEntry {
  readonly key: ComponentKey;
  readonly component: ElementType;
  readonly defaultProps: Readonly<Record<string, unknown>>;
}

function entry<P extends object>(
  key: ComponentKey,
  component: ComponentType<P>,
  defaultProps: P,
): ManifestEntry {
  return { key, component, defaultProps: defaultProps as Readonly<Record<string, unknown>> };
}

const noop = () => undefined;
const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];
const field = { label: 'Label', help: 'Help text', onChange: noop };
const action = (operationId: string, label: string): ActionProps => ({
  operationId,
  label,
  onClick: noop,
});
const state = (title: string): StateProps => ({
  title,
  description: 'A short explanation.',
  action: { label: 'Do something', onClick: noop },
});
const column = (type: ColumnDescriptor['type']): ColumnDescriptor => ({
  field: type,
  headerName: type,
  type,
  options,
});
const cell = (type: ColumnDescriptor['type'], value: unknown): CellProps => ({
  value,
  row: {},
  column: column(type),
});
const screen: ScreenShellProps = {
  title: 'Title',
  breadcrumbs: [{ label: 'Home', to: '/' }, { label: 'Title' }],
  children: 'Body',
};
const help: HelpProps = { id: 'help-example', text: 'Why this field exists.' };

export const stories: readonly ManifestEntry[] = [
  entry('field.text', TextField, { ...field, name: 'text', value: 'hello' }),
  entry('field.select', SelectField, { ...field, name: 'select', value: 'a', options }),
  entry('field.datetime', DateTimeField, {
    ...field,
    name: 'datetime',
    value: '2024-01-02T03:04:00.000Z',
  }),
  entry('field.number', NumberField, {
    ...field,
    name: 'number',
    value: 3,
    min: 0,
    max: 10,
    step: 1,
  }),
  entry('field.boolean', BooleanField, { ...field, name: 'boolean', value: true }),
  entry('field.tags', TagsField, { ...field, name: 'tags', value: ['one', 'two'] }),
  entry('field.subform', SubformField, {
    ...field,
    name: 'subform',
    value: { street: 'Main St', number: 1 },
    fields: [
      { name: 'street', label: 'Street', kind: 'text' },
      { name: 'number', label: 'Number', kind: 'number' },
    ],
  }),
  entry('field.reference', ReferenceField, {
    ...field,
    name: 'reference',
    value: 'a',
    search: () => Promise.resolve(options),
  }),
  entry('list.column.string', StringCell, cell('string', 'text')),
  entry('list.column.number', NumberCell, cell('number', 1234.5)),
  entry('list.column.boolean', BooleanCell, cell('boolean', true)),
  entry('list.column.date-time', DateTimeCell, cell('date-time', '2024-01-02T03:04:00.000Z')),
  entry('list.column.enum', EnumCell, cell('enum', 'a')),
  entry('list.column.reference', ReferenceCell, cell('reference', { id: 'x1', label: 'Entity' })),
  entry('action.create', CreateAction, action('thing_create', 'Create')),
  entry('action.update', UpdateAction, action('thing_update', 'Save')),
  entry('action.delete', DeleteAction, action('thing_delete', 'Delete')),
  entry('action.custom', CustomAction, action('thing_archive', 'Archive')),
  entry('state.empty', EmptyState, state('Nothing here yet')),
  entry('state.loading', LoadingState, state('Loading')),
  entry('state.error', ErrorState, state('Something went wrong')),
  entry('state.forbidden', ForbiddenState, state('You do not have access')),
  entry('help.inline', InlineHelp, help),
  entry('screen.list', ListScreen, screen),
  entry('screen.grid', GridScreen, screen),
  entry('screen.detail', DetailScreen, screen),
  entry('screen.create', CreateScreen, screen),
  entry('screen.edit', EditScreen, screen),
  entry('screen.custom', CustomScreen, screen),
];

/** A story for the agent panel: `screen.custom` at target `agent-panel`, one per visible state. */
export interface AgentPanelManifestEntry extends ManifestEntry {
  readonly key: 'screen.custom';
  readonly target: typeof AGENT_PANEL_TARGET;
  readonly state: AgentPanelState;
}

function agentEntry<P extends object>(
  state: AgentPanelState,
  component: ComponentType<P>,
  defaultProps: P,
): AgentPanelManifestEntry {
  return {
    key: 'screen.custom',
    target: AGENT_PANEL_TARGET,
    state,
    component,
    defaultProps: defaultProps as Readonly<Record<string, unknown>>,
  };
}

const agentArgs = { id: 'x1', name: 'Rex' };
const agentAudit = (kind: 'why' | 'simulate' | 'apply', tool: string) => ({
  at: '2024-01-02T03:04:05.000Z',
  tool,
  argsHash: '0123456789abcdef',
  actor: 'agent' as const,
  principal: 'u1',
  kind,
  outcome: 'ok' as const,
});
const agentView: Omit<AgentPanelViewProps, 'state'> = {
  operationId: 'thing_update',
  audit: [],
  onExplain: noop,
  onSimulate: noop,
  onApply: noop,
};
const agentWhy = {
  rationale: 'The name differs from the record on file.',
  citations: [{ label: 'Naming rule', ref: '#naming' }],
};
const agentSimulation = {
  diff: { name: ['Max', 'Rex'] },
  warnings: ['Renaming clears saved searches.'],
  wouldSucceed: true,
};

/**
 * The panel's states for the storybook package: `hidden` is the container with no agent in
 * `Services` (renders null); the rest are the view with the props of that state.
 */
export const agentPanelStories: readonly AgentPanelManifestEntry[] = [
  agentEntry<AgentPanelProps>('hidden', AgentPanel, {
    operationId: 'thing_update',
    args: agentArgs,
  }),
  agentEntry<AgentPanelViewProps>('idle', AgentPanelView, { ...agentView, state: 'idle' }),
  agentEntry<AgentPanelViewProps>('explained', AgentPanelView, {
    ...agentView,
    state: 'explained',
    why: agentWhy,
    audit: [agentAudit('why', 'why_thing_update')],
  }),
  agentEntry<AgentPanelViewProps>('simulated', AgentPanelView, {
    ...agentView,
    state: 'simulated',
    why: agentWhy,
    simulation: agentSimulation,
    audit: [agentAudit('why', 'why_thing_update'), agentAudit('simulate', 'simulate_thing_update')],
  }),
  agentEntry<AgentPanelViewProps>('applied', AgentPanelView, {
    ...agentView,
    state: 'applied',
    why: agentWhy,
    simulation: agentSimulation,
    audit: [
      agentAudit('why', 'why_thing_update'),
      agentAudit('simulate', 'simulate_thing_update'),
      agentAudit('apply', 'thing_update'),
    ],
  }),
];
