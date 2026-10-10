import { COMPONENT_KEYS } from '@star-board/core';
import { describe, expect, it } from 'vitest';
import {
  build,
  BUILD_VERSION,
  buildCodeConnectMap,
  buildContract,
  buildCssVariables,
  buildFigmaVariables,
  buildMuiThemeInput,
  LIST_COLUMN_TYPES,
} from './index.js';
import { color, expectTokensInvalid, referenceSet } from './fixture.test-helper.js';
import { REFERENCE_MODES } from './modes.js';
import { parseTokens } from './schema.js';

describe('build', () => {
  it('is deterministic: building twice yields deep-equal output with the build version', () => {
    const a = build(referenceSet(), REFERENCE_MODES);
    const b = build(referenceSet(), REFERENCE_MODES);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.version).toBe(BUILD_VERSION);
  });

  it('runs the lint first and fails closed', () => {
    const set = parseTokens({
      color: {
        primitive: { a: color('#000000') },
        surface: { default: color('{color.primitive.a}') },
      },
    });
    const error = expectTokensInvalid(() => build(set, REFERENCE_MODES));
    expect(error.message).toContain('lint');
  });
});

describe('buildCssVariables', () => {
  it('emits :root with every semantic token and a dark block holding the dark surface value', () => {
    const css = buildCssVariables(referenceSet(), REFERENCE_MODES);
    expect(Object.keys(css)).toEqual([
      ':root',
      '[data-mode="dark"]',
      '[data-mode="high-contrast"]',
      '[data-density="dense"]',
    ]);
    expect(css[':root']?.['--sb-color-surface-default']).toBe('#fafafa');
    expect(css[':root']?.['--sb-font-body']).toBe('Inter, system-ui, sans-serif');
    expect(css[':root']?.['--sb-space-1']).toBe('4px');
    expect(css['[data-mode="dark"]']?.['--sb-color-surface-default']).toBe('#121212');
    expect(css['[data-mode="dark"]']?.['--sb-space-1']).toBeUndefined();
    expect(css['[data-density="dense"]']).toEqual({ '--sb-density-row': '32px' });
  });

  it('excludes primitives and sorts names', () => {
    const root = buildCssVariables(referenceSet(), REFERENCE_MODES)[':root'] ?? {};
    const names = Object.keys(root);
    expect(names.some((n) => n.includes('primitive'))).toBe(false);
    expect(names).toEqual([...names].sort());
  });
});

describe('buildMuiThemeInput', () => {
  it('references CSS variables and never a literal colour', () => {
    const theme = buildMuiThemeInput(referenceSet());
    expect(JSON.stringify(theme)).not.toContain('#');
    expect(theme.cssVariables).toBe(true);
    expect(theme.colorSchemes.light.palette).toEqual({
      mode: 'light',
      primary: { main: 'var(--sb-color-action-primary)' },
      error: { main: 'var(--sb-color-text-danger)' },
      background: { default: 'var(--sb-color-surface-default)' },
    });
    expect(theme.colorSchemes.dark.palette.mode).toBe('dark');
    expect(theme.shape.borderRadius).toBe(6);
    expect(theme.typography.fontFamily).toBe('Inter, system-ui, sans-serif');
    expect(theme.spacing).toBe(4);
  });

  it('fails closed when a required token is missing or not in pixels', () => {
    const missing = expectTokensInvalid(() =>
      buildMuiThemeInput(parseTokens({ a: color('#000000') })),
    );
    expect(missing.message).toContain('color.action.primary');
    const set = parseTokens({
      color: {
        action: { primary: color('#000000') },
        text: { danger: color('#000000') },
        surface: { default: color('#000000') },
      },
      radius: { control: { $type: 'dimension', $value: '0.5rem' } },
      font: { body: { $type: 'fontFamily', $value: 'Inter' } },
      space: { '1': { $type: 'dimension', $value: '4px' } },
    });
    expect(buildMuiThemeInput(set).shape.borderRadius).toBe(8);
  });
});

describe('buildFigmaVariables', () => {
  it('carries every colour-scheme mode and a density collection', () => {
    const figma = buildFigmaVariables(referenceSet(), REFERENCE_MODES);
    expect(figma.collections.map((c) => c.name)).toEqual(['star-board', 'star-board-density']);
    const scheme = figma.collections[0];
    expect(scheme?.modes).toEqual(['light', 'dark', 'high-contrast']);
    for (const variable of scheme?.variables ?? []) {
      expect(Object.keys(variable.valuesByMode)).toEqual(['light', 'dark', 'high-contrast']);
    }
    const surface = scheme?.variables.find((v) => v.name === 'color/surface/default');
    expect(surface).toEqual({
      name: 'color/surface/default',
      type: 'COLOR',
      valuesByMode: {
        light: { alias: 'color/primitive/grey/50' },
        dark: { alias: 'color/primitive/grey/900' },
        'high-contrast': '#ffffff',
      },
    });
    const grey = scheme?.variables.find((v) => v.name === 'color/primitive/grey/50');
    expect(grey?.valuesByMode).toEqual({
      light: '#fafafa',
      dark: '#fafafa',
      'high-contrast': '#fafafa',
    });
    expect(scheme?.variables.find((v) => v.name === 'space/1')).toEqual({
      name: 'space/1',
      type: 'FLOAT',
      valuesByMode: { light: 4, dark: 4, 'high-contrast': 4 },
    });
    expect(scheme?.variables.find((v) => v.name === 'font/body')?.type).toBe('STRING');
    expect(figma.collections[1]).toEqual({
      name: 'star-board-density',
      modes: ['default', 'dense'],
      variables: [{ name: 'density/row', type: 'FLOAT', valuesByMode: { default: 44, dense: 32 } }],
    });
  });

  it('maps number, duration and shadow tokens to FLOAT, FLOAT and STRING', () => {
    const set = parseTokens({
      n: { $type: 'number', $value: 1.5 },
      d: { $type: 'duration', $value: '150ms' },
      s: {
        $type: 'shadow',
        $value: { color: '#00000080', offsetX: '0px', offsetY: '1px', blur: '2px', spread: '0px' },
      },
    });
    const variables =
      buildFigmaVariables(set, { modes: ['light'] }).collections[0]?.variables ?? [];
    expect(variables).toEqual([
      { name: 'd', type: 'FLOAT', valuesByMode: { light: 150 } },
      { name: 'n', type: 'FLOAT', valuesByMode: { light: 1.5 } },
      { name: 's', type: 'STRING', valuesByMode: { light: '0px 1px 2px 0px #00000080' } },
    ]);
  });
});

describe('buildContract', () => {
  it('has one row per COMPONENT_KEY plus list.column.<type>, with unique Figma components', () => {
    const contract = buildContract();
    const keys = contract.map((r) => r.key);
    for (const key of COMPONENT_KEYS) expect(keys).toContain(key);
    for (const type of LIST_COLUMN_TYPES) expect(keys).toContain(`list.column.${type}`);
    expect(contract).toHaveLength(COMPONENT_KEYS.length + LIST_COLUMN_TYPES.length);
    expect(new Set(contract.map((r) => r.figmaComponent)).size).toBe(contract.length);
    expect(keys).toEqual([...keys].sort());
    for (const row of contract) {
      expect(row.renderer).toBe('default');
      expect(row.tokens.length).toBeGreaterThan(0);
      expect(row.tokens.some((t) => t.includes('primitive'))).toBe(false);
    }
  });

  it('names the Figma components of typescript/13 §3', () => {
    const byKey = new Map(buildContract().map((r) => [r.key, r.figmaComponent]));
    expect(byKey.get('field.text')).toBe('Text field');
    expect(byKey.get('field.reference')).toBe('Entity picker');
    expect(byKey.get('help.inline')).toBe('Help text');
    expect(byKey.get('action.delete')).toBe('Button / delete');
    expect(byKey.get('list.column.date-time')).toBe('Table cell / date-time');
  });
});

describe('buildCodeConnectMap', () => {
  it('maps every Figma component to its key and props', () => {
    const contract = buildContract();
    const map = buildCodeConnectMap(contract);
    expect(Object.keys(map)).toHaveLength(contract.length);
    expect(Object.keys(map)).toEqual([...Object.keys(map)].sort());
    expect(map['Text field']?.key).toBe('field.text');
    expect(map['Text field']?.props.label).toEqual({ figma: 'Label', kind: 'string' });
    expect(map['Button / create']?.props.variant?.kind).toBe('enum');
    expect(map['Table cell / enum']?.key).toBe('list.column.enum');
    expect(map['State / empty']?.props.title).toBeDefined();
    expect(map['Screen / list']?.props.title).toBeDefined();
    expect(map['Help text']?.props.text).toBeDefined();
  });
});
