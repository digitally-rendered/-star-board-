import type { ReactNode } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, type Theme } from '@mui/material/styles';
import type { CssVariables } from '@star-board/tokens';

export interface ThemeRootProps {
  theme: Theme;
  /** `buildCssVariables` output: selector → custom properties. */
  cssVariables: CssVariables;
  children?: ReactNode;
}

/** `buildCssVariables` output as a stylesheet, deterministic in selector and property order. */
export function cssVariablesToText(blocks: CssVariables): string {
  return Object.entries(blocks)
    .map(([selector, vars]) => {
      const body = Object.entries(vars)
        .map(([name, value]) => `  ${name}: ${value};`)
        .join('\n');
      return `${selector} {\n${body}\n}`;
    })
    .join('\n');
}

export const TOKENS_STYLE_ATTRIBUTE = 'data-star-board-tokens';

/**
 * Injects the tokens' CSS-variable blocks, then MUI's provider and baseline over the tokens theme.
 * Mount once at the app root; mode and density switch by setting `data-mode` / `data-density` on
 * the document root.
 */
export function ThemeRoot(props: ThemeRootProps) {
  return (
    <>
      <style {...{ [TOKENS_STYLE_ATTRIBUTE]: '' }}>{cssVariablesToText(props.cssVariables)}</style>
      <ThemeProvider theme={props.theme}>
        <CssBaseline />
        {props.children}
      </ThemeProvider>
    </>
  );
}
