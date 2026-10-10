import { invalid, isRecord, type JsonObject } from './shared.js';

export const REF_PREFIX = '#/components/schemas/';
/** Inline depth past which a `$ref` is left in place rather than expanded further. */
export const MAX_REF_DEPTH = 8;

/** Keywords whose values are data, not schemas; a `$ref` key inside them is left untouched. */
const DATA_KEYWORDS = new Set(['enum', 'const', 'default', 'examples', 'example']);

/**
 * Returns `schema` with every `#/components/schemas/<Name>` reference replaced by the referenced
 * schema (siblings of `$ref` win, per OpenAPI 3.1). A reference that recurs on the current path or
 * sits deeper than MAX_REF_DEPTH is kept as a `$ref` so cycles terminate. Any other `$ref` form or
 * an unknown target is SPEC_INVALID: the loader has one input and never fetches.
 */
export function resolveSchema(schema: JsonObject, schemas: JsonObject, at: string): JsonObject {
  return resolveObject(schema, schemas, at, 0, []);
}

function resolveNode(
  node: unknown,
  schemas: JsonObject,
  at: string,
  depth: number,
  stack: readonly string[],
): unknown {
  if (Array.isArray(node)) {
    return node.map((item, index) => resolveNode(item, schemas, `${at}[${index}]`, depth, stack));
  }
  return isRecord(node) ? resolveObject(node, schemas, at, depth, stack) : node;
}

function resolveObject(
  node: JsonObject,
  schemas: JsonObject,
  at: string,
  depth: number,
  stack: readonly string[],
): JsonObject {
  const { $ref, ...siblings } = node;
  const resolvedSiblings = resolveEntries(siblings, schemas, at, depth, stack);
  if ($ref === undefined) return resolvedSiblings;
  if (typeof $ref !== 'string' || !$ref.startsWith(REF_PREFIX)) {
    throw invalid(`Unsupported $ref at ${at}; only ${REF_PREFIX}<Name> references are resolved`, {
      at,
      ref: $ref,
    });
  }
  const name = $ref.slice(REF_PREFIX.length);
  const target = schemas[name];
  if (!isRecord(target)) throw invalid(`Unresolved $ref ${$ref} at ${at}`, { at, ref: $ref });
  if (depth >= MAX_REF_DEPTH || stack.includes(name)) return { $ref, ...resolvedSiblings };
  const resolvedTarget = resolveObject(target, schemas, `components.schemas.${name}`, depth + 1, [
    ...stack,
    name,
  ]);
  return { ...resolvedTarget, ...resolvedSiblings };
}

function resolveEntries(
  node: JsonObject,
  schemas: JsonObject,
  at: string,
  depth: number,
  stack: readonly string[],
): JsonObject {
  const out: JsonObject = {};
  for (const [key, value] of Object.entries(node)) {
    out[key] = DATA_KEYWORDS.has(key)
      ? value
      : resolveNode(value, schemas, `${at}.${key}`, depth, stack);
  }
  return out;
}
