import { TokensError } from '@star-board/core';

/**
 * DTCG-style token file (design-tokens community-group format) as star-board reads it
 * (hexagonal-rules typescript/13 §2). A node with `$value` is a token; any other object is a
 * group. A token carries `$type` (or inherits it from an enclosing group) and may carry per-mode
 * values under `$extensions['star-board'].modes`; the default `$value` is the first mode.
 * A whole value may be an alias reference `{path.to.token}`; references are resolved here.
 */
export const TOKEN_TYPES = [
  'color',
  'dimension',
  'fontFamily',
  'number',
  'duration',
  'shadow',
] as const;
export type TokenType = (typeof TOKEN_TYPES)[number];

export interface ShadowValue {
  readonly color: string;
  readonly offsetX: string;
  readonly offsetY: string;
  readonly blur: string;
  readonly spread: string;
}
export type TokenValue = string | number | readonly string[] | ShadowValue;

export interface Token {
  /** Dotted path, e.g. `color.surface.default`. */
  readonly path: string;
  readonly type: TokenType;
  /** True when any path segment is `primitive`; primitives are never themed and never alias. */
  readonly primitive: boolean;
  /** Default value as authored: a literal or an alias reference. */
  readonly raw: TokenValue;
  /** Default value with aliases resolved. */
  readonly value: TokenValue;
  /** Per-mode values as authored (alias or literal); the default mode is absent. */
  readonly modes: Readonly<Record<string, TokenValue>>;
  /** Per-mode values with aliases resolved. */
  readonly resolvedModes: Readonly<Record<string, TokenValue>>;
}

export interface TokenSet {
  /** Tokens by path; keys are sorted. */
  readonly tokens: Readonly<Record<string, Token>>;
  /** Sorted paths. */
  readonly paths: readonly string[];
  /** Every mode name any token declares, sorted. */
  readonly modes: readonly string[];
}

export interface TokenIssue {
  readonly path: string;
  readonly message: string;
}

export const MAX_ALIAS_DEPTH = 8;
export const ALIAS_PATTERN = /^\{([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*)\}$/;
const NAME_PATTERN = /^[A-Za-z0-9_-]+$/;
/** Keys that would reach Object.prototype when a path is materialised; never valid token or group names. */
export const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);
/** A font family name: letters, digits, spaces, hyphens, underscores and dots; this value is emitted into CSS. */
const FONT_FAMILY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,63}$/;
export function isSafeKey(key: string): boolean {
  return NAME_PATTERN.test(key) && !FORBIDDEN_KEYS.has(key);
}
const COLOR_PATTERN = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const DIMENSION_PATTERN = /^-?(?:\d+|\d*\.\d+)(?:px|rem)$/;
const DURATION_PATTERN = /^(?:\d+|\d*\.\d+)ms$/;
const EXTENSION_KEY = 'star-board';

export function isAlias(value: unknown): value is string {
  return typeof value === 'string' && ALIAS_PATTERN.test(value);
}

/** `{a.b.c}` → `a.b.c`; throws on a non-alias. */
export function aliasTarget(value: string): string {
  const match = ALIAS_PATTERN.exec(value);
  if (match?.[1] === undefined) {
    throw new TokensError('TOKENS_INVALID', `Not an alias reference: ${value}`, { value });
  }
  return match[1];
}

export function isPrimitivePath(path: string): boolean {
  return path.split('.').includes('primitive');
}

export function invalid(message: string, issues: readonly TokenIssue[]): TokensError {
  return new TokensError('TOKENS_INVALID', message, { issues });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTokenType(value: unknown): value is TokenType {
  return typeof value === 'string' && (TOKEN_TYPES as readonly string[]).includes(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'string');
}

const SHADOW_KEYS = ['color', 'offsetX', 'offsetY', 'blur', 'spread'] as const;

function isShadow(value: unknown): value is ShadowValue {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  if (keys.join(',') !== [...SHADOW_KEYS].sort().join(',')) return false;
  return (
    typeof value.color === 'string' &&
    COLOR_PATTERN.test(value.color) &&
    SHADOW_KEYS.filter((k) => k !== 'color').every((k) => {
      const v = value[k];
      return typeof v === 'string' && DIMENSION_PATTERN.test(v);
    })
  );
}

/** Literal value check per `$type`; aliases are accepted everywhere and checked on resolution. */
function describeLiteral(type: TokenType, value: unknown): string | undefined {
  if (isAlias(value)) return undefined;
  switch (type) {
    case 'color':
      return typeof value === 'string' && COLOR_PATTERN.test(value)
        ? undefined
        : 'a color is #rrggbb or #rrggbbaa';
    case 'dimension':
      return typeof value === 'string' && DIMENSION_PATTERN.test(value)
        ? undefined
        : 'a dimension is a number with a px or rem unit';
    case 'fontFamily':
      return (typeof value === 'string' && FONT_FAMILY_PATTERN.test(value)) ||
        (isStringArray(value) && value.every((v) => FONT_FAMILY_PATTERN.test(v)))
        ? undefined
        : 'a fontFamily is a font name (letters, digits, space, - _ .) or a non-empty array of them';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        ? undefined
        : 'a number is a finite JSON number';
    case 'duration':
      return typeof value === 'string' && DURATION_PATTERN.test(value)
        ? undefined
        : 'a duration is a number with an ms unit';
    case 'shadow':
      return isShadow(value)
        ? undefined
        : 'a shadow is { color, offsetX, offsetY, blur, spread } with color and dimension strings';
  }
}

interface RawToken {
  readonly path: string;
  readonly type: TokenType;
  readonly raw: TokenValue;
  readonly modes: Readonly<Record<string, TokenValue>>;
}

interface Walk {
  readonly issues: TokenIssue[];
  readonly tokens: Map<string, RawToken>;
}

function readModes(
  path: string,
  type: TokenType,
  extensions: unknown,
  walk: Walk,
): Record<string, TokenValue> {
  const modes: Record<string, TokenValue> = {};
  if (extensions === undefined) return modes;
  if (!isRecord(extensions)) {
    walk.issues.push({ path, message: '$extensions must be an object' });
    return modes;
  }
  const ours = extensions[EXTENSION_KEY];
  if (ours === undefined) return modes;
  if (!isRecord(ours)) {
    walk.issues.push({ path, message: `$extensions['${EXTENSION_KEY}'] must be an object` });
    return modes;
  }
  for (const key of Object.keys(ours)) {
    if (key !== 'modes') {
      walk.issues.push({ path, message: `unknown $extensions['${EXTENSION_KEY}'] key '${key}'` });
    }
  }
  const declared = ours.modes;
  if (declared === undefined) return modes;
  if (!isRecord(declared)) {
    walk.issues.push({ path, message: 'modes must be a record of mode name to value' });
    return modes;
  }
  for (const mode of Object.keys(declared).sort()) {
    if (!isSafeKey(mode)) {
      walk.issues.push({ path, message: `invalid mode name '${mode}'` });
      continue;
    }
    const value = declared[mode];
    const problem = describeLiteral(type, value);
    if (problem !== undefined) {
      walk.issues.push({ path, message: `mode '${mode}': ${problem}` });
      continue;
    }
    modes[mode] = value as TokenValue;
  }
  return modes;
}

function walkNode(
  node: unknown,
  segments: readonly string[],
  inherited: unknown,
  walk: Walk,
): void {
  const path = segments.join('.');
  if (!isRecord(node)) {
    walk.issues.push({ path, message: 'a token or group must be an object' });
    return;
  }
  const declaredType = node.$type;
  if (declaredType !== undefined && !isTokenType(declaredType)) {
    walk.issues.push({
      path,
      message: `unknown $type ${JSON.stringify(declaredType)}; expected one of ${TOKEN_TYPES.join(', ')}`,
    });
    return;
  }
  const type = declaredType ?? inherited;

  if (Object.hasOwn(node, '$value')) {
    if (segments.length === 0) {
      walk.issues.push({ path, message: 'the root must be a group, not a token' });
      return;
    }
    if (!isTokenType(type)) {
      walk.issues.push({ path, message: 'a token needs a $type on itself or an enclosing group' });
      return;
    }
    const problem = describeLiteral(type, node.$value);
    if (problem !== undefined) {
      walk.issues.push({ path, message: `$value: ${problem}` });
      return;
    }
    for (const key of Object.keys(node)) {
      if (!key.startsWith('$')) {
        walk.issues.push({ path, message: `a token cannot contain the child '${key}'` });
      }
    }
    const modes = readModes(path, type, node.$extensions, walk);
    walk.tokens.set(path, { path, type, raw: node.$value as TokenValue, modes });
    return;
  }

  for (const key of Object.keys(node).sort()) {
    if (key.startsWith('$')) continue;
    if (!isSafeKey(key)) {
      walk.issues.push({
        path: [...segments, key].join('.'),
        message: `invalid name '${key}'; names use letters, digits, '_' and '-'`,
      });
      continue;
    }
    walkNode(node[key], [...segments, key], type, walk);
  }
}

interface Resolution {
  readonly tokens: ReadonlyMap<string, RawToken>;
  readonly issues: TokenIssue[];
}

function resolveValue(
  token: RawToken,
  mode: string | undefined,
  chain: readonly string[],
  res: Resolution,
): TokenValue | undefined {
  const raw =
    mode !== undefined && Object.hasOwn(token.modes, mode) ? token.modes[mode] : token.raw;
  if (raw === undefined || !isAlias(raw)) return raw;
  const target = aliasTarget(raw);
  const origin = chain[0] ?? token.path;
  if (chain.includes(target)) {
    res.issues.push({ path: origin, message: `alias cycle: ${[...chain, target].join(' -> ')}` });
    return undefined;
  }
  if (chain.length >= MAX_ALIAS_DEPTH) {
    res.issues.push({
      path: origin,
      message: `alias chain deeper than ${MAX_ALIAS_DEPTH}: ${[...chain, target].join(' -> ')}`,
    });
    return undefined;
  }
  const next = res.tokens.get(target);
  if (next === undefined) {
    res.issues.push({ path: token.path, message: `alias to unknown token '${target}'` });
    return undefined;
  }
  if (next.type !== token.type) {
    res.issues.push({
      path: token.path,
      message: `alias type mismatch: ${token.type} token aliases ${next.type} token '${target}'`,
    });
    return undefined;
  }
  return resolveValue(next, mode, [...chain, token.path], res);
}

function sortedRecord<T>(entries: Iterable<readonly [string, T]>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [key, value] of [...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    out[key] = value;
  }
  return out;
}

/**
 * Validates a token file and resolves every alias (cycle-safe, at most {@link MAX_ALIAS_DEPTH}
 * hops). Throws `TokensError('TOKENS_INVALID')` whose `details.issues` lists every problem.
 */
export function parseTokens(json: unknown): TokenSet {
  if (!isRecord(json)) {
    throw invalid('Token file must be a JSON object', [
      { path: '', message: 'the root must be an object' },
    ]);
  }
  const walk: Walk = { issues: [], tokens: new Map() };
  walkNode(json, [], undefined, walk);
  if (walk.issues.length > 0) {
    throw invalid(`Token file invalid: ${walk.issues.length} issue(s)`, walk.issues);
  }

  const res: Resolution = { tokens: walk.tokens, issues: [] };
  const resolved = new Map<string, Token>();
  const modeNames = new Set<string>();
  for (const raw of walk.tokens.values()) {
    const value = resolveValue(raw, undefined, [], res);
    const resolvedModes: Record<string, TokenValue> = {};
    for (const mode of Object.keys(raw.modes).sort()) {
      modeNames.add(mode);
      const v = resolveValue(raw, mode, [], res);
      if (v !== undefined) resolvedModes[mode] = v;
    }
    if (value === undefined) continue;
    resolved.set(raw.path, {
      path: raw.path,
      type: raw.type,
      primitive: isPrimitivePath(raw.path),
      raw: raw.raw,
      value,
      modes: sortedRecord(Object.entries(raw.modes)),
      resolvedModes,
    });
  }
  if (res.issues.length > 0) {
    throw invalid(`Token aliases invalid: ${res.issues.length} issue(s)`, res.issues);
  }
  const tokens = sortedRecord(resolved);
  return { tokens, paths: Object.keys(tokens), modes: [...modeNames].sort() };
}
