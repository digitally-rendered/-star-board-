import type { FeatureModel, JsonSchema } from '@star-board/core';
import type { Row } from './store.js';
import { propertiesOf, requiredOf, typesOf } from './validate.js';

/*
 * Deterministic valid rows from a schema: the same seed yields the same rows, so a test can
 * seed a store and assert against literal values. Strings respect `maxLength`/`minLength`, enums
 * pick a member, `uuid`/`date-time`/`date`/`email` formats are honoured and nested objects and
 * arrays recurse.
 */

export interface FixtureOptions {
  /** PRNG seed; the default is stable across runs. */
  seed?: number;
  /** Which schema variant to satisfy; `document` rows carry the id and audit fields. */
  variant?: 'document' | 'create' | 'update';
  /** Epoch of the first generated date; later rows step forward one day at a time. */
  epoch?: string;
}

const DEFAULT_SEED = 0x5eed;
const DEFAULT_EPOCH = '2026-01-01T00:00:00.000Z';
const WORDS = [
  'alpha',
  'bravo',
  'charlie',
  'delta',
  'echo',
  'foxtrot',
  'golf',
  'hotel',
  'india',
  'juliet',
];

/** mulberry32: small, fast and good enough for fixtures. */
export function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Generator {
  next: () => number;
  epoch: number;
  index: number;
  ids: Set<string>;
}

export function fixtures(
  model: FeatureModel,
  schema: string,
  n: number,
  options: FixtureOptions = {},
): Row[] {
  const entry = model.schemas[schema];
  if (entry === undefined) throw new Error(`fixtures: schema ${schema} is not in the document`);
  const variant = options.variant ?? 'document';
  const source = entry[variant];
  return fixturesFromSchema(source, n, options);
}

/** The same generator over a bare JSON Schema (object). */
export function fixturesFromSchema(
  schema: JsonSchema,
  n: number,
  options: FixtureOptions = {},
): Row[] {
  const g: Generator = {
    next: prng(options.seed ?? DEFAULT_SEED),
    epoch: Date.parse(options.epoch ?? DEFAULT_EPOCH),
    index: 0,
    ids: new Set(),
  };
  const rows: Row[] = [];
  for (let i = 0; i < n; i += 1) {
    g.index = i;
    const value = generate(schema, g, 0);
    rows.push(
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Row)
        : { value },
    );
  }
  return rows;
}

function pick<T>(g: Generator, items: readonly T[]): T | undefined {
  return items[Math.floor(g.next() * items.length)];
}

function int(g: Generator, min: number, max: number): number {
  return min + Math.floor(g.next() * (max - min + 1));
}

function numberOf(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function uuid(g: Generator): string {
  const hex = (count: number): string => {
    let out = '';
    for (let i = 0; i < count; i += 1) out += int(g, 0, 15).toString(16);
    return out;
  };
  const variant = pick(g, ['8', '9', 'a', 'b']) ?? '8';
  let candidate = `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
  while (g.ids.has(candidate))
    candidate = `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
  g.ids.add(candidate);
  return candidate;
}

function dateTime(g: Generator): string {
  const day = 24 * 60 * 60 * 1000;
  return new Date(g.epoch + g.index * day + int(g, 0, day - 1)).toISOString();
}

function string(schema: JsonSchema, g: Generator, name: string | undefined): string {
  switch (schema.format) {
    case 'uuid':
      return uuid(g);
    case 'date-time':
      return dateTime(g);
    case 'date':
      return dateTime(g).slice(0, 10);
    case 'email':
      return `${pick(g, WORDS) ?? 'user'}${g.index}@example.test`;
    case 'uri':
    case 'url':
      return `https://example.test/${pick(g, WORDS) ?? 'path'}/${g.index}`;
    default:
      break;
  }
  const max = numberOf(schema.maxLength) ?? 40;
  const min = numberOf(schema.minLength) ?? Math.min(1, max);
  const base = `${name ?? pick(g, WORDS) ?? 'value'} ${pick(g, WORDS) ?? ''} ${g.index}`.trim();
  let text = base.length > max ? base.slice(0, max) : base;
  while (text.length < min) text += pick(g, WORDS) ?? 'x';
  return text.length > max ? text.slice(0, max) : text;
}

function number(
  schema: JsonSchema,
  integer: boolean,
  g: Generator,
  name: string | undefined,
): number {
  if (name === 'record_version') return 1;
  const exclusiveMin = numberOf(schema.exclusiveMinimum);
  const exclusiveMax = numberOf(schema.exclusiveMaximum);
  const min = numberOf(schema.minimum) ?? exclusiveMin ?? 0;
  const max = numberOf(schema.maximum) ?? exclusiveMax ?? Math.max(min + 1, 1000);
  if (integer) {
    const lo = Math.ceil(exclusiveMin === undefined ? min : min + 1);
    const hi = Math.floor(exclusiveMax === undefined ? max : max - 1);
    return int(g, lo, Math.max(lo, hi));
  }
  // Strictly inside the open interval when a bound is exclusive: the middle half of the range.
  if (max <= min) return min;
  return min + (0.25 + 0.5 * g.next()) * (max - min);
}

function generate(schema: JsonSchema, g: Generator, depth: number, name?: string): unknown {
  if ('const' in schema) return schema.const;
  const options = schema.enum;
  if (Array.isArray(options) && options.length > 0) return pick(g, options);
  if ('default' in schema && g.next() < 0.25) return schema.default;
  const types = typesOf(schema).filter((t) => t !== 'null');
  const type = types[0] ?? (schema.properties === undefined ? 'string' : 'object');
  switch (type) {
    case 'string':
      return string(schema, g, name);
    case 'integer':
      return number(schema, true, g, name);
    case 'number':
      return number(schema, false, g, name);
    case 'boolean':
      return g.next() < 0.5;
    case 'array': {
      const min = numberOf(schema.minItems) ?? 0;
      const max = numberOf(schema.maxItems) ?? Math.max(min, 3);
      const items = schema.items;
      const count = depth > 3 ? min : int(g, min, max);
      const itemSchema: JsonSchema =
        typeof items === 'object' && items !== null && !Array.isArray(items)
          ? (items as JsonSchema)
          : { type: 'string' };
      return Array.from({ length: count }, (_, i) =>
        generate(itemSchema, g, depth + 1, `${name ?? 'item'}${i}`),
      );
    }
    case 'object': {
      const out: Row = {};
      const required = new Set(requiredOf(schema));
      for (const [field, sub] of Object.entries(propertiesOf(schema))) {
        // Optional fields are present most of the time; a row is valid either way.
        if (!required.has(field) && depth > 0 && g.next() < 0.2) continue;
        out[field] = generate(sub, g, depth + 1, field);
      }
      return out;
    }
    case 'null':
      return null;
    default:
      return string(schema, g, name);
  }
}
