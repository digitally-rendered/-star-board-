import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { render } from '@testing-library/react';
import {
  buildCssVariables,
  buildMuiThemeInput,
  parseTokens,
  REFERENCE_MODES,
} from '@star-board/tokens';
import { describe, expect, it, vi } from 'vitest';
import { COLOR_SCHEME_ATTRIBUTE, createTheme } from './createTheme.js';
import {
  cssVariablesToText,
  ThemeRoot,
  TOKENS_STYLE_ATTRIBUTE,
  withHostTheme,
} from './ThemeRoot.js';

// jsdom rewrites `import.meta.url` to http, so paths come from `import.meta.dirname`.
const HERE = import.meta.dirname;
const referenceSet = () =>
  parseTokens(
    JSON.parse(readFileSync(resolve(HERE, '../../../../tokens/reference.tokens.json'), 'utf8')),
  );

function colourStrings(value: unknown, path = 'palette'): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([k, v]) => colourStrings(v, `${path}.${k}`));
}

describe('createTheme', () => {
  it('carries only var(--sb-…) references in every token-driven palette slot of both schemes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const theme = createTheme(buildMuiThemeInput(referenceSet()));
    warn.mockRestore();
    for (const scheme of ['light', 'dark'] as const) {
      const palette = theme.colorSchemes[scheme]?.palette;
      expect(palette).toBeDefined();
      const slots = colourStrings({
        primary: palette?.primary,
        error: palette?.error,
        background: palette?.background,
      });
      expect(slots.length).toBeGreaterThan(0);
      for (const [slot, value] of slots) {
        expect(value, slot).toMatch(/^var\(--sb-[a-z0-9-]+\)$/);
      }
    }
    expect(theme.vars.palette.primary.main).toContain('var(--mui-palette-primary-main');
    expect(theme.shape.borderRadius).toBe(6);
    expect(theme.spacing(1)).toContain('4px');
  });

  it('keys colour schemes on the tokens mode attribute so one attribute switches both layers', () => {
    const theme = createTheme(buildMuiThemeInput(referenceSet()));
    const sheets = theme.generateStyleSheets();
    const selectors = sheets.flatMap((sheet) => Object.keys(sheet));
    expect(selectors.some((s) => s.includes(`[${COLOR_SCHEME_ATTRIBUTE}="dark"]`))).toBe(true);
    const custom = createTheme(buildMuiThemeInput(referenceSet()), {
      colorSchemeSelector: 'class',
    });
    expect(
      custom
        .generateStyleSheets()
        .flatMap((s) => Object.keys(s))
        .some((s) => s.includes('.dark')),
    ).toBe(true);
  });

  it('does not warn while building', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    createTheme(buildMuiThemeInput(referenceSet()));
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
  });
});

describe('ThemeRoot', () => {
  it('injects every tokens CSS block into one style element and renders children under the theme', () => {
    const set = referenceSet();
    const cssVariables = buildCssVariables(set, REFERENCE_MODES);
    const { container, getByText } = render(
      <ThemeRoot theme={createTheme(buildMuiThemeInput(set))} cssVariables={cssVariables}>
        <p>child</p>
      </ThemeRoot>,
    );
    const style = container.querySelector(`style[${TOKENS_STYLE_ATTRIBUTE}]`);
    expect(style).not.toBeNull();
    const text = style?.textContent ?? '';
    expect(text).toContain(':root {');
    expect(text).toContain('[data-mode="dark"] {');
    expect(text).toContain('--sb-color-action-primary:');
    expect(text).not.toMatch(/--sb-color-primitive/);
    expect(getByText('child')).toBeTruthy();
  });

  it('hostTheme variables are written last at root and override the tokens in every mode', () => {
    const set = referenceSet();
    const cssVariables = buildCssVariables(set, REFERENCE_MODES);
    const { container } = render(
      <ThemeRoot
        theme={createTheme(buildMuiThemeInput(set))}
        cssVariables={cssVariables}
        hostTheme={{ '--sb-color-action-primary': 'var(--host-brand)', '--host-only': '1px' }}
      >
        <p>child</p>
      </ThemeRoot>,
    );
    const text = container.querySelector(`style[${TOKENS_STYLE_ATTRIBUTE}]`)?.textContent ?? '';
    const blocks = text.split('\n}').map((b) => b.trim());
    const last = blocks.at(-2) ?? '';
    expect(last.startsWith(':root {')).toBe(true);
    expect(last).toContain('--sb-color-action-primary: var(--host-brand);');
    expect(last).toContain('--host-only: 1px;');
    expect(text.indexOf('[data-mode="dark"] {')).toBeLessThan(text.lastIndexOf(':root {'));
    // The tokens' own root block is gone: the host block replaces it, carrying the rest unchanged.
    expect(text.match(/:root \{/g)).toHaveLength(1);
    expect(last).toContain('--sb-font-body:');
    expect(withHostTheme(cssVariables, undefined)).toBe(cssVariables);
    expect(withHostTheme(cssVariables, {})).toBe(cssVariables);
  });

  it('cssVariablesToText is deterministic and one declaration per line', () => {
    const text = cssVariablesToText({ ':root': { '--sb-a': '1px', '--sb-b': '2px' } });
    expect(text).toBe(':root {\n  --sb-a: 1px;\n  --sb-b: 2px;\n}');
  });
});

describe('no literal colour in the renderer source', () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return walk(full);
      return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
    });
  }
  it('src/** contains no #hex, rgb( or hsl( colour outside tests', () => {
    const src = resolve(HERE, '..');
    const files = walk(src);
    expect(files.length).toBeGreaterThan(10);
    const hits = files.flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return text
        .split('\n')
        .map((line, i) => [i + 1, line] as const)
        .filter(([, line]) => /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(line))
        .map(([n, line]) => `${file.slice(src.length + 1)}:${n}: ${line.trim()}`);
    });
    expect(hits).toEqual([]);
  });
});
