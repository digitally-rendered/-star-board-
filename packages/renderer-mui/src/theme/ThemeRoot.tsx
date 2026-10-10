import type { ReactNode } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, type Theme } from '@mui/material/styles';
import type { CssVariables } from '@star-board/tokens';

/** CSS custom properties a host page supplies to re-theme an embedded app (typescript/05 §8). */
export type HostTheme = Readonly<Record<string, string>>;

export interface ThemeRootProps {
  theme: Theme;
  /** `buildCssVariables` output: selector → custom properties. */
  cssVariables: CssVariables;
  /**
   * Variables the host wins with: merged over the tokens' root block, which is written after every
   * mode and density block so a host value overrides the tokens in every mode
   * (`{ '--sb-color-action-primary': 'var(--host-brand)' }`).
   */
  hostTheme?: HostTheme;
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
/** The block the host values join: root, moved after the mode blocks so it wins by source order. */
export const HOST_THEME_SELECTOR = ':root';

/** The tokens blocks with the host values merged into a trailing root block. */
export function withHostTheme(
  blocks: CssVariables,
  hostTheme: HostTheme | undefined,
): CssVariables {
  if (hostTheme === undefined || Object.keys(hostTheme).length === 0) return blocks;
  const rest = Object.fromEntries(
    Object.entries(blocks).filter(([selector]) => selector !== HOST_THEME_SELECTOR),
  );
  const root = blocks[HOST_THEME_SELECTOR] ?? {};
  return { ...rest, [HOST_THEME_SELECTOR]: { ...root, ...hostTheme } };
}

/**
 * Injects the tokens' CSS-variable blocks, then MUI's provider and baseline over the tokens theme.
 * Mount once at the app root; mode and density switch by setting `data-mode` / `data-density` on
 * the document root. An embedded build passes the host's variables as `hostTheme`.
 */
export function ThemeRoot(props: ThemeRootProps) {
  return (
    <>
      <style {...{ [TOKENS_STYLE_ATTRIBUTE]: '' }}>
        {cssVariablesToText(withHostTheme(props.cssVariables, props.hostTheme))}
      </style>
      <ThemeProvider theme={props.theme}>
        <CssBaseline />
        {props.children}
      </ThemeProvider>
    </>
  );
}
