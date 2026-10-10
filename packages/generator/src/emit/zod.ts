import type { JsonSchema } from '@star-board/core';
import {
  isNullable,
  isRecord,
  primaryType,
  propertiesOf,
  propertyKey,
  requiredOf,
} from '../plan/names.js';
import type { SchemaPlan } from '../plan/plan.js';
import { header, indent, lines, type GeneratedFile, type Source } from './support.js';

/**
 * JSON Schema → zod 4 expression text. The rules mirror `tsType` so the inferred type and the
 * emitted interface agree; constraints (`maxLength`, `minimum`, `enum`, `required`,
 * `additionalProperties: false`) are what the backend rejects too (contradiction #11).
 */
export function zodExpr(schema: JsonSchema, depth = 0): string {
  const base = zodBase(schema, depth);
  return isNullable(schema) && base !== 'z.null()' ? `${base}.nullable()` : base;
}

function zodBase(schema: JsonSchema, depth: number): string {
  if (typeof schema.$ref === 'string') return 'z.unknown()';
  if ('const' in schema) return `z.literal(${literal(schema.const)})`;
  if (Array.isArray(schema.enum)) {
    const values = schema.enum.filter((v) => v !== null);
    if (values.every((v): v is string => typeof v === 'string')) {
      return `z.enum([${values.map(literal).join(', ')}])`;
    }
    return `z.union([${values.map((v) => `z.literal(${literal(v)})`).join(', ')}])`;
  }
  const variants = schema.oneOf ?? schema.anyOf;
  if (Array.isArray(variants)) {
    const members = variants.filter(isRecord).map((v) => zodExpr(v, depth));
    return members.length > 0 ? `z.union([${members.join(', ')}])` : 'z.unknown()';
  }
  if (Array.isArray(schema.allOf)) {
    const members = schema.allOf.filter(isRecord).map((v) => zodExpr(v, depth));
    if (members.length === 0) return 'z.unknown()';
    return members.slice(1).reduce((acc, m) => `${acc}.and(${m})`, members[0] ?? 'z.unknown()');
  }
  switch (primaryType(schema)) {
    case 'string':
      return zodString(schema);
    case 'integer':
      return zodNumber(schema, true);
    case 'number':
      return zodNumber(schema, false);
    case 'boolean':
      return 'z.boolean()';
    case 'null':
      return 'z.null()';
    case 'array': {
      const items = isRecord(schema.items) ? zodExpr(schema.items, depth) : 'z.unknown()';
      let expr = `z.array(${items})`;
      if (typeof schema.minItems === 'number') expr += `.min(${schema.minItems})`;
      if (typeof schema.maxItems === 'number') expr += `.max(${schema.maxItems})`;
      return expr;
    }
    case 'object':
      return zodObject(schema, depth);
    default:
      return 'properties' in schema ? zodObject(schema, depth) : 'z.unknown()';
  }
}

function zodString(schema: JsonSchema): string {
  let expr: string;
  switch (schema.format) {
    case 'uuid':
      expr = 'z.uuid()';
      break;
    case 'date-time':
      expr = 'z.iso.datetime()';
      break;
    case 'date':
      expr = 'z.iso.date()';
      break;
    case 'time':
      expr = 'z.iso.time()';
      break;
    case 'email':
      expr = 'z.email()';
      break;
    case 'uri':
    case 'url':
      expr = 'z.url()';
      break;
    default:
      expr = 'z.string()';
  }
  if (typeof schema.minLength === 'number') expr += `.min(${schema.minLength})`;
  if (typeof schema.maxLength === 'number') expr += `.max(${schema.maxLength})`;
  if (typeof schema.pattern === 'string') {
    expr += `.regex(new RegExp(${literal(schema.pattern)}))`;
  }
  return expr;
}

function zodNumber(schema: JsonSchema, integer: boolean): string {
  let expr = integer ? 'z.number().int()' : 'z.number()';
  if (typeof schema.minimum === 'number') expr += `.min(${schema.minimum})`;
  if (typeof schema.maximum === 'number') expr += `.max(${schema.maximum})`;
  if (typeof schema.exclusiveMinimum === 'number') expr += `.gt(${schema.exclusiveMinimum})`;
  if (typeof schema.exclusiveMaximum === 'number') expr += `.lt(${schema.exclusiveMaximum})`;
  if (typeof schema.multipleOf === 'number') expr += `.multipleOf(${schema.multipleOf})`;
  return expr;
}

function zodObject(schema: JsonSchema, depth: number): string {
  const props = propertiesOf(schema);
  const required = requiredOf(schema);
  const entries = Object.entries(props);
  if (entries.length === 0) {
    const additional = schema.additionalProperties;
    if (isRecord(additional)) return `z.record(z.string(), ${zodExpr(additional, depth)})`;
    return 'z.record(z.string(), z.unknown())';
  }
  const body = entries.map(([name, def]) => {
    const expr = zodExpr(def, depth + 1);
    return `${propertyKey(name)}: ${expr}${required.includes(name) ? '' : '.optional()'},`;
  });
  const strict = schema.additionalProperties === false ? '.strict()' : '';
  return `z.object({\n${indent(body.join('\n'), depth + 1)}\n${'  '.repeat(depth)}})${strict}`;
}

function literal(value: unknown): string {
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null) return 'null';
  return 'undefined';
}

/** `domain/<schema>/schemas.ts`: zod validators for Create, Update and Document with inferred types. */
export function emitZod(
  schema: SchemaPlan,
  variants: { document: JsonSchema; create: JsonSchema; update: JsonSchema },
  source: Source,
): GeneratedFile {
  const { pascal, name } = schema;
  const each: [string, JsonSchema][] = [
    ['Create', variants.create],
    ['Update', variants.update],
    ['Document', variants.document],
  ];
  return {
    path: `domain/${name}/schemas.ts`,
    contents: lines([
      header(source),
      `// Schema ${name} version ${schema.version}. Validation agrees with the backend's (contradiction #11).`,
      "import { z } from 'zod';",
      '',
      ...each.flatMap(([variant, def]) => [
        `export const ${pascal}${variant}Schema = ${zodExpr(def)};`,
        `export type ${pascal}${variant}Values = z.infer<typeof ${pascal}${variant}Schema>;`,
        '',
      ]),
    ]),
  };
}
