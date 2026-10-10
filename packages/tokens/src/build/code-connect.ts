import type { ContractRow } from './contract.js';

/**
 * Plain JSON that the Code Connect generator (Figma adapter) turns into `.figma.ts` files: one
 * entry per Figma component naming the contract key it binds and the props the design side
 * exposes. Renaming a key renames both sides because this map is derived from the contract.
 */
export interface CodeConnectProp {
  readonly figma: string;
  readonly kind: 'string' | 'boolean' | 'enum';
  readonly values?: readonly string[];
}
export interface CodeConnectEntry {
  readonly key: string;
  readonly props: Readonly<Record<string, CodeConnectProp>>;
}
export type CodeConnectMap = Readonly<Record<string, CodeConnectEntry>>;

const FIELD_PROPS: Readonly<Record<string, CodeConnectProp>> = {
  disabled: { figma: 'Disabled', kind: 'boolean' },
  error: { figma: 'Error', kind: 'boolean' },
  helperText: { figma: 'Helper text', kind: 'string' },
  label: { figma: 'Label', kind: 'string' },
  required: { figma: 'Required', kind: 'boolean' },
};
const COLUMN_PROPS: Readonly<Record<string, CodeConnectProp>> = {
  align: { figma: 'Align', kind: 'enum', values: ['left', 'right'] },
  header: { figma: 'Header', kind: 'string' },
};
const ACTION_PROPS: Readonly<Record<string, CodeConnectProp>> = {
  disabled: { figma: 'Disabled', kind: 'boolean' },
  label: { figma: 'Label', kind: 'string' },
  variant: { figma: 'Variant', kind: 'enum', values: ['contained', 'outlined', 'text'] },
};
const STATE_PROPS: Readonly<Record<string, CodeConnectProp>> = {
  description: { figma: 'Description', kind: 'string' },
  title: { figma: 'Title', kind: 'string' },
};
const SCREEN_PROPS: Readonly<Record<string, CodeConnectProp>> = {
  title: { figma: 'Title', kind: 'string' },
};
const HELP_PROPS: Readonly<Record<string, CodeConnectProp>> = {
  text: { figma: 'Text', kind: 'string' },
};

function propsFor(key: string): Readonly<Record<string, CodeConnectProp>> {
  const family = key.split('.', 1)[0];
  switch (family) {
    case 'field':
      return FIELD_PROPS;
    case 'list':
      return COLUMN_PROPS;
    case 'action':
      return ACTION_PROPS;
    case 'state':
      return STATE_PROPS;
    case 'screen':
      return SCREEN_PROPS;
    default:
      return HELP_PROPS;
  }
}

export function buildCodeConnectMap(contract: readonly ContractRow[]): CodeConnectMap {
  const out: Record<string, CodeConnectEntry> = {};
  const rows = [...contract].sort((a, b) =>
    a.figmaComponent < b.figmaComponent ? -1 : a.figmaComponent > b.figmaComponent ? 1 : 0,
  );
  for (const row of rows) {
    out[row.figmaComponent] = { key: row.key, props: propsFor(row.key) };
  }
  return out;
}
