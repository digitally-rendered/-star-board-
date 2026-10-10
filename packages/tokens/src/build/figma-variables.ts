import { defaultMode, densityModes, type ModeOptions } from '../modes.js';
import { aliasTarget, isAlias, type Token, type TokenSet, type TokenValue } from '../schema.js';
import { figmaVariableName, toCss, toPx, valueIn } from '../values.js';

/**
 * Figma variables as plugin-compatible JSON (the TokenSourcePort adapter, typescript/13 §1).
 * Figma gives a collection one mode axis, so colour-scheme modes form the `star-board`
 * collection and density modes the `star-board-density` collection. Primitives are variables in
 * their own right; a semantic token whose authored value is an alias becomes a Figma alias.
 */
export type FigmaVariableType = 'COLOR' | 'FLOAT' | 'STRING';
export interface FigmaAlias {
  readonly alias: string;
}
export type FigmaValue = string | number | FigmaAlias;
export interface FigmaVariable {
  readonly name: string;
  readonly type: FigmaVariableType;
  readonly valuesByMode: Readonly<Record<string, FigmaValue>>;
}
export interface FigmaCollection {
  readonly name: string;
  readonly modes: readonly string[];
  readonly variables: readonly FigmaVariable[];
}
export interface FigmaVariables {
  readonly collections: readonly FigmaCollection[];
}

export const FIGMA_COLLECTION = 'star-board';
export const FIGMA_DENSITY_COLLECTION = 'star-board-density';
export const FIGMA_DEFAULT_DENSITY = 'default';

export function figmaTypeFor(token: Token): FigmaVariableType {
  switch (token.type) {
    case 'color':
      return 'COLOR';
    case 'dimension':
    case 'number':
    case 'duration':
      return 'FLOAT';
    case 'fontFamily':
    case 'shadow':
      return 'STRING';
  }
}

function literal(token: Token, value: TokenValue): FigmaValue {
  switch (token.type) {
    case 'dimension':
      return toPx({ ...token, value });
    case 'number':
      return typeof value === 'number' ? value : Number(toCss(value));
    case 'duration':
      return Number.parseFloat(toCss(value));
    case 'color':
    case 'fontFamily':
    case 'shadow':
      return toCss(value);
  }
}

/** Alias when authored as one, else the resolved literal for that mode. */
function figmaValue(token: Token, mode: string | undefined): FigmaValue {
  const raw =
    mode !== undefined && Object.hasOwn(token.modes, mode) ? token.modes[mode] : token.raw;
  if (isAlias(raw)) return { alias: figmaVariableName(aliasTarget(raw)) };
  return literal(token, valueIn(token, mode));
}

function variable(token: Token, modes: readonly string[], defaultName: string): FigmaVariable {
  const valuesByMode: Record<string, FigmaValue> = {};
  for (const mode of modes) {
    valuesByMode[mode] =
      mode === defaultName ? figmaValue(token, undefined) : figmaValue(token, mode);
  }
  return { name: figmaVariableName(token.path), type: figmaTypeFor(token), valuesByMode };
}

export function buildFigmaVariables(set: TokenSet, options: ModeOptions): FigmaVariables {
  const density = densityModes(options);
  const densitySet = new Set(density);
  const tokens: Token[] = [];
  for (const path of set.paths) {
    const token = set.tokens[path];
    if (token !== undefined) tokens.push(token);
  }
  const isDensity = (t: Token): boolean => Object.keys(t.modes).some((m) => densitySet.has(m));

  const scheme: FigmaCollection = {
    name: FIGMA_COLLECTION,
    modes: [...options.modes],
    variables: tokens
      .filter((t) => !isDensity(t))
      .map((t) => variable(t, options.modes, defaultMode(options))),
  };
  const collections: FigmaCollection[] = [scheme];
  const densityTokens = tokens.filter(isDensity);
  if (density.length > 0 && densityTokens.length > 0) {
    const modes = [FIGMA_DEFAULT_DENSITY, ...density];
    collections.push({
      name: FIGMA_DENSITY_COLLECTION,
      modes,
      variables: densityTokens.map((t) => variable(t, modes, FIGMA_DEFAULT_DENSITY)),
    });
  }
  return { collections };
}
