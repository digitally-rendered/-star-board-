import { TokensError } from '@star-board/core';
import type { Token, TokenSet } from '../schema.js';
import { cssVariableName, toCss, toPx } from '../values.js';

/**
 * Plain JSON shaped for MUI's `createTheme({ cssVariables: true, ... })`. Every colour is a
 * `var(--sb-…)` reference, never a literal, so switching `data-mode` re-themes at runtime and a
 * token change is a CSS variable change. The renderer (L3) imports MUI; this package never does.
 */
export interface MuiPaletteInput {
  readonly mode: 'light' | 'dark';
  readonly primary: { readonly main: string };
  readonly error: { readonly main: string };
  readonly background: { readonly default: string };
}
export interface MuiThemeInput {
  readonly cssVariables: true;
  readonly colorSchemes: Readonly<Record<'light' | 'dark', { readonly palette: MuiPaletteInput }>>;
  readonly shape: { readonly borderRadius: number };
  readonly typography: { readonly fontFamily: string };
  readonly spacing: number;
}

/** Semantic tokens the MUI theme is built from; a set without them fails the build. */
export const MUI_REQUIRED_TOKENS = {
  primary: 'color.action.primary',
  error: 'color.text.danger',
  background: 'color.surface.default',
  radius: 'radius.control',
  font: 'font.body',
  spacing: 'space.1',
} as const;

function need(set: TokenSet, path: string): Token {
  const token = set.tokens[path];
  if (token === undefined) {
    throw new TokensError('TOKENS_INVALID', `MUI theme needs token '${path}'`, { path });
  }
  return token;
}

function varRef(token: Token): string {
  return `var(${cssVariableName(token.path)})`;
}

export function buildMuiThemeInput(set: TokenSet): MuiThemeInput {
  const primary = varRef(need(set, MUI_REQUIRED_TOKENS.primary));
  const error = varRef(need(set, MUI_REQUIRED_TOKENS.error));
  const background = varRef(need(set, MUI_REQUIRED_TOKENS.background));
  const palette = (mode: 'light' | 'dark'): MuiPaletteInput => ({
    mode,
    primary: { main: primary },
    error: { main: error },
    background: { default: background },
  });
  return {
    cssVariables: true,
    colorSchemes: { light: { palette: palette('light') }, dark: { palette: palette('dark') } },
    shape: { borderRadius: toPx(need(set, MUI_REQUIRED_TOKENS.radius)) },
    typography: { fontFamily: toCss(need(set, MUI_REQUIRED_TOKENS.font).value) },
    spacing: toPx(need(set, MUI_REQUIRED_TOKENS.spacing)),
  };
}
