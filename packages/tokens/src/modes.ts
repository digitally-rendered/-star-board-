/**
 * Modes are token sets, not components (typescript/13 §2). Colour-scheme modes form one axis
 * whose first entry is the default `$value`; every semantic colour token needs every other
 * entry. Density modes form a second axis that dimension tokens may opt into.
 */
export interface ModeOptions {
  /** Colour-scheme modes; the first is the default and lives in `$value`. */
  readonly modes: readonly string[];
  /** Density modes (dimension tokens only); the default density has no name. */
  readonly density?: readonly string[];
}

/** The modes of the reference token set (`tokens/reference.tokens.json`). */
export const REFERENCE_MODES: ModeOptions = {
  modes: ['light', 'dark', 'high-contrast'],
  density: ['dense'],
};

export function defaultMode(options: ModeOptions): string {
  return options.modes[0] ?? 'light';
}

/** Colour-scheme modes other than the default. */
export function themedModes(options: ModeOptions): readonly string[] {
  return options.modes.slice(1);
}

export function densityModes(options: ModeOptions): readonly string[] {
  return options.density ?? [];
}
