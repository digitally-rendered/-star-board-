/**
 * The component contract (hexagonal-rules typescript/13 §3): stable keys naming one design
 * component and one default renderer each. Adding a key here without a renderer, a Figma
 * component and a story fails the parity audit.
 */
export const FIELD_KINDS = [
  'text',
  'select',
  'datetime',
  'number',
  'boolean',
  'tags',
  'subform',
  'reference',
] as const;
export const ACTION_KINDS = ['create', 'update', 'delete', 'custom'] as const;
export const STATE_KINDS = ['empty', 'loading', 'error', 'forbidden'] as const;
export const SCREEN_KINDS = ['list', 'grid', 'detail', 'create', 'edit', 'custom'] as const;

export type FieldKey = `field.${(typeof FIELD_KINDS)[number]}`;
export type ListColumnKey = `list.column.${string}`;
export type ActionKey = `action.${(typeof ACTION_KINDS)[number]}`;
export type StateKey = `state.${(typeof STATE_KINDS)[number]}`;
export type ScreenKey = `screen.${(typeof SCREEN_KINDS)[number]}`;
export type HelpKey = 'help.inline';
export type ComponentKey = FieldKey | ListColumnKey | ActionKey | StateKey | ScreenKey | HelpKey;

const FIXED_KEYS: readonly string[] = [
  ...FIELD_KINDS.map((k) => `field.${k}`),
  ...ACTION_KINDS.map((k) => `action.${k}`),
  ...STATE_KINDS.map((k) => `state.${k}`),
  ...SCREEN_KINDS.map((k) => `screen.${k}`),
  'help.inline',
];

/** Every non-parameterised key; `list.column.<type>` is open over the JSON Schema type names. */
export const COMPONENT_KEYS: readonly ComponentKey[] = FIXED_KEYS as readonly ComponentKey[];

const LIST_COLUMN = /^list\.column\.[a-z][a-z0-9-]*$/;

export function isComponentKey(value: string): value is ComponentKey {
  return FIXED_KEYS.includes(value) || LIST_COLUMN.test(value);
}

/** JSON Schema field → contract key (typescript/13 §3 mapping; `x-ui-widget` may override). */
export function fieldKeyFor(field: {
  type?: string | string[];
  enum?: unknown[];
  format?: string;
  items?: { type?: string | string[] };
  $ref?: string;
  'x-ui-widget'?: string;
}): FieldKey {
  const widget = field['x-ui-widget'];
  if (widget && (FIELD_KINDS as readonly string[]).includes(widget))
    return `field.${widget as (typeof FIELD_KINDS)[number]}`;
  if (field.$ref) return 'field.reference';
  const type = Array.isArray(field.type) ? field.type.find((t) => t !== 'null') : field.type;
  if (field.enum) return 'field.select';
  switch (type) {
    case 'string':
      return field.format === 'date-time' || field.format === 'date'
        ? 'field.datetime'
        : 'field.text';
    case 'number':
    case 'integer':
      return 'field.number';
    case 'boolean':
      return 'field.boolean';
    case 'array': {
      const itemType = Array.isArray(field.items?.type) ? field.items.type[0] : field.items?.type;
      return itemType === 'object' ? 'field.subform' : 'field.tags';
    }
    case 'object':
      return 'field.subform';
    default:
      return 'field.text';
  }
}
