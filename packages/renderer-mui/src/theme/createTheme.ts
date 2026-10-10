import { createTheme as muiCreateTheme, type CssVarsTheme, type Theme } from '@mui/material/styles';
import type { MuiPaletteInput, MuiThemeInput } from '@star-board/tokens';

/**
 * The MUI theme from the tokens build (typescript/13 §2: tokens are the theme source). Every colour
 * slot is the `var(--sb-…)` reference the tokens package emitted; this package never writes a literal
 * colour. Colour schemes switch with `data-mode` on the document root, the same attribute the tokens'
 * CSS blocks key on, so one attribute re-themes both layers.
 */
export const COLOR_SCHEME_ATTRIBUTE = 'data-mode';

export interface CreateThemeOptions {
  /** Attribute MUI keys its colour-scheme styles on; must match the tokens' mode selector. */
  readonly colorSchemeSelector?: string;
}

/** MUI derives `light`, `dark` and `contrastText` from `main` by parsing a literal; every slot is handed over as a reference instead. */
function palette(input: MuiPaletteInput) {
  const main = (color: string) => ({
    main: color,
    light: color,
    dark: color,
    contrastText: input.background.default,
  });
  return {
    mode: input.mode,
    primary: main(input.primary.main),
    error: main(input.error.main),
    background: {
      default: input.background.default,
      paper: input.background.default,
      // MUI would parse these from a literal and warn; the alpha overlays they feed degrade to the base colour.
      defaultChannel: input.background.default,
      paperChannel: input.background.default,
    },
  };
}

/** A theme built in CSS-variables mode: `vars`, `colorSchemes` and `generateStyleSheets` are present. */
export type TokensTheme = Theme & CssVarsTheme;

export function createTheme(input: MuiThemeInput, options: CreateThemeOptions = {}): TokensTheme {
  // `cssVariables: true` makes MUI return the CSS-variables theme; its signature keeps the plain type.
  return muiCreateTheme({
    cssVariables: { colorSchemeSelector: options.colorSchemeSelector ?? COLOR_SCHEME_ATTRIBUTE },
    colorSchemes: {
      light: { palette: palette(input.colorSchemes.light.palette) },
      dark: { palette: palette(input.colorSchemes.dark.palette) },
    },
    shape: { borderRadius: input.shape.borderRadius },
    typography: { fontFamily: input.typography.fontFamily },
    spacing: input.spacing,
  }) as TokensTheme;
}
