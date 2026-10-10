import {
  FIGMA_COLLECTION,
  FIGMA_DEFAULT_DENSITY,
  FIGMA_DENSITY_COLLECTION,
  type FigmaAlias,
  type FigmaCollection,
  type FigmaValue,
  type FigmaVariable,
  type FigmaVariableType,
} from '../build/figma-variables.js';
import {
  invalid,
  parseTokens,
  isSafeKey,
  TOKEN_TYPES,
  type ShadowValue,
  type TokenIssue,
  type TokenSet,
  type TokenType,
  type TokenValue,
} from '../schema.js';
import type { FigmaVariablesDocument } from './ports.js';

/**
 * The inverse of `buildFigmaVariables`: a variables document back into DTCG token JSON and a
 * parsed `TokenSet`. Figma keeps less than the tokens do, so the round trip is exact only for
 * what the document can carry. Explicitly excluded (documented in the README):
 *
 * - `$description` and any other DTCG metadata: the document has no field for them.
 * - The DTCG `$type` behind a Figma type: `FLOAT` comes back as `dimension` in `px` and `STRING`
 *   as `fontFamily` (or `shadow` when the text parses as one) unless `types` names the path.
 *   `number` and `duration` tokens therefore need a type hint; `rem` dimensions come back in `px`.
 * - A single-entry `fontFamily` array comes back as a plain string (both serialise the same).
 * - A non-colour semantic token whose mode value equals its default loses that redundant entry;
 *   semantic colour tokens keep every mode because the lint requires them.
 * - A token themed on both axes (colour scheme and density) is in the density collection only.
 */
export interface FromFigmaOptions {
  /** DTCG `$type` per token path, usually taken from the local token set. */
  readonly types?: Readonly<Record<string, TokenType>>;
}

const FIGMA_TYPES: readonly FigmaVariableType[] = ['COLOR', 'FLOAT', 'STRING'];
const VARIABLE_NAME = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/;
const SHADOW_TEXT = /^(\S+) (\S+) (\S+) (\S+) (#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFigmaAlias(value: unknown): value is FigmaAlias {
  return (
    isRecord(value) &&
    Object.keys(value).length === 1 &&
    typeof value.alias === 'string' &&
    VARIABLE_NAME.test(value.alias)
  );
}

function isFigmaValue(value: unknown): value is FigmaValue {
  return (
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    isFigmaAlias(value)
  );
}

function readVariable(
  collection: string,
  modes: readonly string[],
  value: unknown,
  issues: TokenIssue[],
): FigmaVariable | undefined {
  const where = `${collection}/`;
  if (!isRecord(value)) {
    issues.push({ path: where, message: 'a variable must be an object' });
    return undefined;
  }
  const { name, type, valuesByMode } = value;
  if (typeof name !== 'string' || !VARIABLE_NAME.test(name)) {
    issues.push({ path: where, message: `invalid variable name ${JSON.stringify(name)}` });
    return undefined;
  }
  if (!name.split('/').every((segment) => isSafeKey(segment))) {
    issues.push({
      path: where + name,
      message: 'variable name segments must never be __proto__, constructor or prototype',
    });
    return undefined;
  }
  const path = where + name;
  if (typeof type !== 'string' || !(FIGMA_TYPES as readonly string[]).includes(type)) {
    issues.push({ path, message: `unknown variable type ${JSON.stringify(type)}` });
    return undefined;
  }
  if (!isRecord(valuesByMode)) {
    issues.push({ path, message: 'valuesByMode must be an object' });
    return undefined;
  }
  const values: Record<string, FigmaValue> = {};
  for (const mode of Object.keys(valuesByMode).sort()) {
    if (!modes.includes(mode)) {
      issues.push({
        path,
        message: `value for mode '${mode}' which the collection does not declare`,
      });
      continue;
    }
    const v = valuesByMode[mode];
    if (!isFigmaValue(v)) {
      issues.push({
        path,
        message: `mode '${mode}': a value is a string, a finite number or { alias }`,
      });
      continue;
    }
    values[mode] = v;
  }
  for (const mode of modes) {
    if (!Object.hasOwn(values, mode)) {
      issues.push({ path, message: `no value for mode '${mode}'` });
    }
  }
  return { name, type: type as FigmaVariableType, valuesByMode: values };
}

function readCollection(value: unknown, issues: TokenIssue[]): FigmaCollection | undefined {
  if (!isRecord(value)) {
    issues.push({ path: '', message: 'a collection must be an object' });
    return undefined;
  }
  const { name, modes, variables } = value;
  if (typeof name !== 'string' || name.length === 0) {
    issues.push({ path: '', message: `invalid collection name ${JSON.stringify(name)}` });
    return undefined;
  }
  if (
    !Array.isArray(modes) ||
    modes.length === 0 ||
    !modes.every((m): m is string => typeof m === 'string' && /^[A-Za-z0-9_-]+$/.test(m)) ||
    new Set(modes).size !== modes.length
  ) {
    issues.push({ path: name, message: 'modes must be a non-empty list of distinct mode names' });
    return undefined;
  }
  if (!Array.isArray(variables)) {
    issues.push({ path: name, message: 'variables must be an array' });
    return undefined;
  }
  const out: FigmaVariable[] = [];
  const seen = new Set<string>();
  for (const v of variables) {
    const variable = readVariable(name, modes, v, issues);
    if (variable === undefined) continue;
    if (seen.has(variable.name)) {
      issues.push({ path: `${name}/${variable.name}`, message: 'duplicate variable name' });
      continue;
    }
    seen.add(variable.name);
    out.push(variable);
  }
  return { name, modes, variables: out };
}

/** Validates untrusted JSON as a variables document; throws `TOKENS_INVALID` listing every issue. */
export function parseFigmaVariables(json: unknown): FigmaVariablesDocument {
  const issues: TokenIssue[] = [];
  if (!isRecord(json) || !Array.isArray(json.collections)) {
    throw invalid('Figma variables document must be an object with a collections array', [
      { path: '', message: 'expected { collections: [...] }' },
    ]);
  }
  const collections: FigmaCollection[] = [];
  const names = new Set<string>();
  for (const c of json.collections) {
    const collection = readCollection(c, issues);
    if (collection === undefined) continue;
    if (names.has(collection.name)) {
      issues.push({ path: collection.name, message: 'duplicate collection name' });
      continue;
    }
    names.add(collection.name);
    collections.push(collection);
  }
  if (issues.length > 0) {
    throw invalid(`Figma variables document invalid: ${issues.length} issue(s)`, issues);
  }
  return { collections };
}

function tokenPath(variableName: string): string {
  return variableName.replaceAll('/', '.');
}

function inferType(variable: FigmaVariable, hint: TokenType | undefined): TokenType {
  if (hint !== undefined) return hint;
  switch (variable.type) {
    case 'COLOR':
      return 'color';
    case 'FLOAT':
      return 'dimension';
    case 'STRING': {
      const sample = Object.values(variable.valuesByMode).find((v) => typeof v === 'string');
      return sample !== undefined && SHADOW_TEXT.test(sample) ? 'shadow' : 'fontFamily';
    }
  }
}

function shadowFrom(text: string): ShadowValue | undefined {
  const m = SHADOW_TEXT.exec(text);
  if (m?.[1] === undefined) return undefined;
  const [, offsetX, offsetY, blur, spread, color] = m as unknown as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  return { color, offsetX, offsetY, blur, spread };
}

/** A Figma value as an authored DTCG value for `type`: aliases become `{path}` references. */
function tokenValue(
  type: TokenType,
  value: FigmaValue,
  path: string,
  mode: string,
  issues: TokenIssue[],
): TokenValue | undefined {
  if (isFigmaAlias(value)) return `{${tokenPath(value.alias)}}`;
  const literal = literalFor(type, value);
  if (literal === undefined) {
    issues.push({
      path,
      message: `mode '${mode}': a ${type} variable value is ${EXPECTED_LITERAL[type]}`,
    });
  }
  return literal;
}

const EXPECTED_LITERAL: Readonly<Record<TokenType, string>> = {
  color: 'a colour string',
  dimension: 'a number of pixels',
  number: 'a number',
  duration: 'a number of milliseconds',
  fontFamily: 'a family list string',
  shadow: '"<offsetX> <offsetY> <blur> <spread> <color>"',
};

/** A literal Figma value as the DTCG literal for `type`, or undefined when it cannot be one. */
function literalFor(type: TokenType, value: string | number): TokenValue | undefined {
  switch (type) {
    case 'color':
      return typeof value === 'string' ? value : undefined;
    case 'dimension':
      return typeof value === 'number' ? `${value}px` : undefined;
    case 'number':
      return typeof value === 'number' ? value : undefined;
    case 'duration':
      return typeof value === 'number' ? `${value}ms` : undefined;
    case 'fontFamily':
      if (typeof value !== 'string') return undefined;
      return value.includes(', ') ? value.split(', ') : value;
    case 'shadow':
      return typeof value === 'string' ? shadowFrom(value) : undefined;
  }
}

function sameValue(a: TokenValue | undefined, b: TokenValue | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isPrimitive(path: string): boolean {
  return path.split('.').includes('primitive');
}

interface Authored {
  readonly type: TokenType;
  readonly value: TokenValue;
  readonly modes: Readonly<Record<string, TokenValue>>;
}

function authoredFrom(
  collection: FigmaCollection,
  variable: FigmaVariable,
  keepEveryMode: (type: TokenType, path: string) => boolean,
  options: FromFigmaOptions,
  issues: TokenIssue[],
): Authored | undefined {
  const path = tokenPath(variable.name);
  const type = inferType(variable, options.types?.[path]);
  const [defaultMode, ...themed] = collection.modes;
  if (defaultMode === undefined) return undefined;
  const value = tokenValue(
    type,
    variable.valuesByMode[defaultMode] ?? '',
    path,
    defaultMode,
    issues,
  );
  if (value === undefined) return undefined;
  const modes: Record<string, TokenValue> = {};
  if (!isPrimitive(path)) {
    for (const mode of themed) {
      const v = tokenValue(type, variable.valuesByMode[mode] ?? '', path, mode, issues);
      if (v === undefined) continue;
      if (keepEveryMode(type, path) || !sameValue(v, value)) modes[mode] = v;
    }
  }
  return { type, value, modes };
}

function setDeep(root: Record<string, unknown>, path: string, leaf: Record<string, unknown>): void {
  const segments = path.split('.');
  if (!segments.every((segment) => isSafeKey(segment))) {
    throw invalid(`unsafe token path ${path}`, [{ path, message: 'forbidden path segment' }]);
  }
  let node = root;
  for (const segment of segments.slice(0, -1)) {
    const next = node[segment];
    if (isRecord(next)) {
      node = next;
    } else {
      const fresh: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      node[segment] = fresh;
      node = fresh;
    }
  }
  node[segments[segments.length - 1] ?? path] = leaf;
}

/**
 * A variables document as DTCG token JSON (the shape `parseTokens` reads): collection
 * `star-board` carries colour-scheme modes whose first entry is `$value`, `star-board-density`
 * carries density modes whose `default` is `$value`. Alias entries become `{path}` references.
 * Any other collection fails closed.
 */
export function figmaVariablesToTokenJson(
  doc: FigmaVariablesDocument,
  options: FromFigmaOptions = {},
): Record<string, unknown> {
  const issues: TokenIssue[] = [];
  const authored = new Map<string, Authored>();
  for (const collection of doc.collections) {
    let keep: (type: TokenType, path: string) => boolean;
    if (collection.name === FIGMA_COLLECTION) {
      keep = (type) => type === 'color';
    } else if (collection.name === FIGMA_DENSITY_COLLECTION) {
      if (collection.modes[0] !== FIGMA_DEFAULT_DENSITY) {
        issues.push({
          path: collection.name,
          message: `the first density mode must be '${FIGMA_DEFAULT_DENSITY}'`,
        });
        continue;
      }
      keep = () => true;
    } else {
      issues.push({
        path: collection.name,
        message: `unknown collection; expected '${FIGMA_COLLECTION}' or '${FIGMA_DENSITY_COLLECTION}'`,
      });
      continue;
    }
    for (const variable of collection.variables) {
      const path = tokenPath(variable.name);
      if (authored.has(path)) {
        issues.push({ path, message: 'token appears in more than one collection' });
        continue;
      }
      const token = authoredFrom(collection, variable, keep, options, issues);
      if (token !== undefined) authored.set(path, token);
    }
  }
  if (issues.length > 0) {
    throw invalid(`Figma variables cannot become tokens: ${issues.length} issue(s)`, issues);
  }
  const root: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const path of [...authored.keys()].sort()) {
    const token = authored.get(path);
    if (token === undefined) continue;
    const leaf: Record<string, unknown> = { $type: token.type, $value: token.value };
    if (Object.keys(token.modes).length > 0) {
      leaf.$extensions = { 'star-board': { modes: token.modes } };
    }
    setDeep(root, path, leaf);
  }
  return root;
}

/** `figmaVariablesToTokenJson` parsed and alias-resolved; throws `TOKENS_INVALID` on any problem. */
export function figmaVariablesToTokens(
  doc: FigmaVariablesDocument,
  options: FromFigmaOptions = {},
): TokenSet {
  return parseTokens(figmaVariablesToTokenJson(doc, options));
}

/** The `types` hint for {@link figmaVariablesToTokens} taken from a local token set. */
export function tokenTypesOf(set: TokenSet): Record<string, TokenType> {
  const out: Record<string, TokenType> = {};
  for (const path of set.paths) {
    const token = set.tokens[path];
    if (token !== undefined && (TOKEN_TYPES as readonly string[]).includes(token.type)) {
      out[path] = token.type;
    }
  }
  return out;
}
