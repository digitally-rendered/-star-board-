import { densityModes, themedModes, type ModeOptions } from '../modes.js';
import type { Token, TokenSet } from '../schema.js';
import { cssVariableName, toCss, valueIn } from '../values.js';

/**
 * CSS custom properties per selector. `:root` holds every semantic token's default value; each
 * colour-scheme mode gets a `[data-mode="<mode>"]` block and each density mode a
 * `[data-density="<mode>"]` block holding only the tokens that change. Primitives are not
 * emitted: components reference semantic tokens only.
 */
export type CssVariables = Readonly<Record<string, Readonly<Record<string, string>>>>;

export const ROOT_SELECTOR = ':root';
export function modeSelector(mode: string): string {
  return `[data-mode="${mode}"]`;
}
export function densitySelector(mode: string): string {
  return `[data-density="${mode}"]`;
}

function semanticTokens(set: TokenSet): Token[] {
  const out: Token[] = [];
  for (const path of set.paths) {
    const token = set.tokens[path];
    if (token !== undefined && !token.primitive) out.push(token);
  }
  return out;
}

export function buildCssVariables(set: TokenSet, options: ModeOptions): CssVariables {
  const semantic = semanticTokens(set);
  const root: Record<string, string> = {};
  for (const token of semantic) root[cssVariableName(token.path)] = toCss(token.value);

  const out: Record<string, Record<string, string>> = { [ROOT_SELECTOR]: root };
  const blocks: readonly (readonly [string, string])[] = [
    ...themedModes(options).map((m) => [m, modeSelector(m)] as const),
    ...densityModes(options).map((m) => [m, densitySelector(m)] as const),
  ];
  for (const [mode, selector] of blocks) {
    const block: Record<string, string> = {};
    for (const token of semantic) {
      if (Object.hasOwn(token.resolvedModes, mode)) {
        block[cssVariableName(token.path)] = toCss(valueIn(token, mode));
      }
    }
    if (Object.keys(block).length > 0) out[selector] = block;
  }
  return out;
}
