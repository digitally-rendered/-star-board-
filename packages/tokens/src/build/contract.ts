import {
  ACTION_KINDS,
  COMPONENT_KEYS,
  FIELD_KINDS,
  SCREEN_KINDS,
  STATE_KINDS,
} from '@star-board/core';

/**
 * The component contract table (hexagonal-rules typescript/13 §3) as data: one row per contract
 * key with its one Figma component, its default renderer and the semantic tokens the default
 * renderer may use. `buildCodeConnectMap` and the parity audit read this table; the Figma side
 * is generated from it, never the other way round.
 */
export interface ContractRow {
  readonly key: string;
  readonly figmaComponent: string;
  readonly renderer: 'default';
  /**
   * Export name of the default renderer's component for this key, as data: the Code Connect
   * emitter imports it from the renderer package. Tokens (L1) never imports the renderer (L3);
   * the renderer's parity test holds this table to its `DEFAULT_COMPONENTS` map.
   */
  readonly componentName: string;
  /** Semantic token paths (never primitives — `lintTokens` checks). */
  readonly tokens: readonly string[];
}

/** JSON Schema types that `list.column.<type>` is parameterised over. */
export const LIST_COLUMN_TYPES = [
  'string',
  'number',
  'boolean',
  'date-time',
  'enum',
  'reference',
] as const;
export type ListColumnType = (typeof LIST_COLUMN_TYPES)[number];

const FIELD_COMPONENTS: Readonly<Record<(typeof FIELD_KINDS)[number], string>> = {
  text: 'Text field',
  select: 'Select',
  datetime: 'Date picker',
  number: 'Number field',
  boolean: 'Switch',
  tags: 'Chip input',
  subform: 'Card group',
  reference: 'Entity picker',
};

/**
 * Default renderer export per fixed key (`@star-board/renderer-mui`), kept here as data so the
 * Code Connect files can be generated without importing React or the renderer.
 */
export const COMPONENT_NAMES: Readonly<Record<string, string>> = {
  'field.text': 'TextField',
  'field.select': 'SelectField',
  'field.datetime': 'DateTimeField',
  'field.number': 'NumberField',
  'field.boolean': 'BooleanField',
  'field.tags': 'TagsField',
  'field.subform': 'SubformField',
  'field.reference': 'ReferenceField',
  'action.create': 'CreateAction',
  'action.update': 'UpdateAction',
  'action.delete': 'DeleteAction',
  'action.custom': 'CustomAction',
  'state.empty': 'EmptyState',
  'state.loading': 'LoadingState',
  'state.error': 'ErrorState',
  'state.forbidden': 'ForbiddenState',
  'screen.list': 'ListScreen',
  'screen.grid': 'GridScreen',
  'screen.detail': 'DetailScreen',
  'screen.create': 'CreateScreen',
  'screen.edit': 'EditScreen',
  'screen.custom': 'CustomScreen',
  'help.inline': 'InlineHelp',
  'list.column.string': 'StringCell',
  'list.column.number': 'NumberCell',
  'list.column.boolean': 'BooleanCell',
  'list.column.date-time': 'DateTimeCell',
  'list.column.enum': 'EnumCell',
  'list.column.reference': 'ReferenceCell',
};

const FIELD_TOKENS = [
  'color.surface.default',
  'color.text.danger',
  'font.body',
  'radius.control',
  'space.2',
];
const COLUMN_TOKENS = ['density.row', 'font.body', 'space.2'];
const ACTION_TOKENS = ['color.action.primary', 'font.body', 'radius.control', 'space.1'];
const STATE_TOKENS = ['color.surface.default', 'font.body', 'space.3'];
const SCREEN_TOKENS = ['color.surface.default', 'font.body', 'space.3'];
const HELP_TOKENS = ['font.body', 'space.1'];

function sorted(paths: readonly string[]): readonly string[] {
  return [...new Set(paths)].sort();
}

function row(key: string, figmaComponent: string, tokens: readonly string[]): ContractRow {
  const componentName = COMPONENT_NAMES[key];
  if (componentName === undefined) {
    throw new Error(`No renderer component name for contract key '${key}'`);
  }
  return { key, figmaComponent, renderer: 'default', componentName, tokens: sorted(tokens) };
}

function rowFor(key: string): ContractRow {
  const [family, kind] = key.split('.', 2) as [string, string | undefined];
  if (
    family === 'field' &&
    kind !== undefined &&
    (FIELD_KINDS as readonly string[]).includes(kind)
  ) {
    return row(key, FIELD_COMPONENTS[kind as (typeof FIELD_KINDS)[number]], FIELD_TOKENS);
  }
  if (
    family === 'action' &&
    kind !== undefined &&
    (ACTION_KINDS as readonly string[]).includes(kind)
  ) {
    const tokens = kind === 'delete' ? [...ACTION_TOKENS, 'color.text.danger'] : ACTION_TOKENS;
    return row(key, `Button / ${kind}`, tokens);
  }
  if (
    family === 'state' &&
    kind !== undefined &&
    (STATE_KINDS as readonly string[]).includes(kind)
  ) {
    const tokens =
      kind === 'error' || kind === 'forbidden'
        ? [...STATE_TOKENS, 'color.text.danger']
        : STATE_TOKENS;
    return row(key, `State / ${kind}`, tokens);
  }
  if (
    family === 'screen' &&
    kind !== undefined &&
    (SCREEN_KINDS as readonly string[]).includes(kind)
  ) {
    return row(key, `Screen / ${kind}`, SCREEN_TOKENS);
  }
  if (key === 'help.inline') return row(key, 'Help text', HELP_TOKENS);
  throw new Error(`No contract row for component key '${key}'`);
}

/** Every fixed `COMPONENT_KEYS` entry plus `list.column.<type>` for each {@link LIST_COLUMN_TYPES}. */
export function buildContract(): readonly ContractRow[] {
  const rows = [
    ...COMPONENT_KEYS.map((key) => rowFor(key)),
    ...LIST_COLUMN_TYPES.map((type) =>
      row(`list.column.${type}`, `Table cell / ${type}`, COLUMN_TOKENS),
    ),
  ];
  return rows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
