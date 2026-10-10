import { TokensError } from '@star-board/core';
import type { Token, TokenValue } from './schema.js';

function isShadowValue(
  value: TokenValue,
): value is Exclude<TokenValue, string | number | readonly string[]> {
  return typeof value === 'object' && !Array.isArray(value);
}

/** A resolved value as CSS text. */
export function toCss(value: TokenValue): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (isShadowValue(value)) {
    return `${value.offsetX} ${value.offsetY} ${value.blur} ${value.spread} ${value.color}`;
  }
  return value.join(', ');
}

const PX = /^(-?(?:\d+|\d*\.\d+))px$/;
const REM = /^(-?(?:\d+|\d*\.\d+))rem$/;

/** A dimension as a pixel number (`rem` at 16px); throws TOKENS_INVALID for anything else. */
export function toPx(token: Token): number {
  const value = token.value;
  if (typeof value === 'string') {
    const px = PX.exec(value);
    if (px?.[1] !== undefined) return Number(px[1]);
    const rem = REM.exec(value);
    if (rem?.[1] !== undefined) return Number(rem[1]) * 16;
  }
  throw new TokensError('TOKENS_INVALID', `Token '${token.path}' is not a pixel dimension`, {
    path: token.path,
    value,
  });
}

/** The value of a token in a mode, falling back to the default value. */
export function valueIn(token: Token, mode: string | undefined): TokenValue {
  if (mode === undefined) return token.value;
  return token.resolvedModes[mode] ?? token.value;
}

/** Dotted path → CSS custom property name: `color.surface.default` → `--sb-color-surface-default`. */
export function cssVariableName(path: string): string {
  return `--sb-${path.replaceAll('.', '-')}`;
}

/** Dotted path → Figma variable name: `color.surface.default` → `color/surface/default`. */
export function figmaVariableName(path: string): string {
  return path.replaceAll('.', '/');
}

export function sortedKeys<T>(record: Readonly<Record<string, T>>): string[] {
  return Object.keys(record).sort();
}
