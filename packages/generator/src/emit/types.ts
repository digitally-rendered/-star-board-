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
import { docComment, header, indent, lines, type GeneratedFile, type Source } from './support.js';

/**
 * JSON Schema → TypeScript type text. Small on purpose: object, array, enum, const, nullable
 * unions, oneOf/anyOf/allOf, formats as `string`. `$ref` has already been inlined by the spec
 * loader; one that survives (a cycle) becomes `unknown`.
 */
export function tsType(schema: JsonSchema, depth = 0): string {
  const base = tsBaseType(schema, depth);
  return isNullable(schema) && base !== 'null' ? `${base} | null` : base;
}

function tsBaseType(schema: JsonSchema, depth: number): string {
  if (typeof schema.$ref === 'string') return 'unknown';
  if ('const' in schema) return literal(schema.const);
  if (Array.isArray(schema.enum)) {
    const members = schema.enum.filter((v) => v !== null).map(literal);
    return members.length > 0 ? members.join(' | ') : 'never';
  }
  const variants = schema.oneOf ?? schema.anyOf;
  if (Array.isArray(variants)) {
    const members = variants.filter(isRecord).map((v) => parenthesize(tsType(v, depth)));
    return members.length > 0 ? members.join(' | ') : 'unknown';
  }
  if (Array.isArray(schema.allOf)) {
    const members = schema.allOf.filter(isRecord).map((v) => parenthesize(tsType(v, depth)));
    return members.length > 0 ? members.join(' & ') : 'unknown';
  }
  switch (primaryType(schema)) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array': {
      const items = isRecord(schema.items) ? tsType(schema.items, depth) : 'unknown';
      return `${parenthesize(items)}[]`;
    }
    case 'object':
      return objectType(schema, depth);
    default:
      return 'properties' in schema ? objectType(schema, depth) : 'unknown';
  }
}

function objectType(schema: JsonSchema, depth: number): string {
  const props = propertiesOf(schema);
  const required = requiredOf(schema);
  const entries = Object.entries(props);
  if (entries.length === 0) {
    const additional = schema.additionalProperties;
    if (isRecord(additional)) return `Record<string, ${tsType(additional, depth)}>`;
    return 'Record<string, unknown>';
  }
  const body = entries.map(([name, def]) =>
    member(name, tsType(def, depth + 1), required.includes(name)),
  );
  return `{\n${indent(body.join('\n'), depth + 1)}\n${'  '.repeat(depth)}}`;
}

/** Optional members admit `undefined` explicitly, as zod's inferred types do (exactOptionalPropertyTypes). */
function member(name: string, type: string, required: boolean): string {
  return required
    ? `${propertyKey(name)}: ${type};`
    : `${propertyKey(name)}?: ${type} | undefined;`;
}

function parenthesize(type: string): string {
  return /[|&]/.test(type) && !type.startsWith('{') ? `(${type})` : type;
}

function literal(value: unknown): string {
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null) return 'null';
  return 'unknown';
}

interface Variant {
  name: string;
  schema: JsonSchema;
  doc: string;
}

/** `domain/<schema>/types.ts`: Document, Create and Update interfaces and the branded id. */
export function emitTypes(
  schema: SchemaPlan,
  variants: { document: JsonSchema; create: JsonSchema; update: JsonSchema },
  source: Source,
): GeneratedFile {
  const { pascal, name, idField } = schema;
  const idType = `${pascal}Id`;
  const list: Variant[] = [
    { name: pascal, schema: variants.document, doc: `The ${name} record as the API returns it.` },
    { name: `${pascal}Create`, schema: variants.create, doc: `Payload of \`${name}_create\`.` },
    { name: `${pascal}Update`, schema: variants.update, doc: `Payload of \`${name}_update\`.` },
  ];
  const helpByField = new Map(schema.fields.map((f) => [f.name, f.help]));
  const interfaces = list.map((variant) =>
    emitInterface(variant, {
      brandField: variant.name === pascal ? idField : null,
      idType,
      helpByField,
    }),
  );
  const views = schema.columns.views.map(
    (view) =>
      `/** Row of the \`${view.view}\` view (projection of ${pascal}). */\nexport type ${viewRowType(pascal, view.view)} = Pick<${pascal}, ${view.columns
        .map((c) => `'${c.field}'`)
        .join(' | ')}>;`,
  );
  return {
    path: `domain/${name}/types.ts`,
    contents: lines([
      header(source),
      `// Schema ${name} version ${schema.version}.`,
      '',
      `declare const ${pascal}IdBrand: unique symbol;`,
      `/** The \`${idField}\` of a ${name}; branded so an id of another schema cannot be passed by mistake. */`,
      `export type ${idType} = string & { readonly [${pascal}IdBrand]: '${pascal}' };`,
      `export const as${idType} = (value: string): ${idType} => value as ${idType};`,
      '',
      ...interfaces.flatMap((text) => [text, '']),
      ...views.flatMap((text) => [text, '']),
    ]),
  };
}

export function viewRowType(pascal: string, view: string): string {
  return `${pascal}${view
    .split(/[^a-zA-Z0-9]+/)
    .filter((p) => p.length > 0)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('')}Row`;
}

function emitInterface(
  variant: Variant,
  ctx: { brandField: string | null; idType: string; helpByField: Map<string, string | null> },
): string {
  const props = propertiesOf(variant.schema);
  const required = requiredOf(variant.schema);
  const members = Object.entries(props).flatMap(([name, def]) => {
    const help =
      ctx.helpByField.get(name) ?? (typeof def.description === 'string' ? def.description : null);
    const type =
      name === ctx.brandField
        ? isNullable(def)
          ? `${ctx.idType} | null`
          : ctx.idType
        : tsType(def, 1);
    const text = member(name, type, required.includes(name));
    return help === null ? [indent(text)] : [docComment(help, 1), indent(text)];
  });
  const body = members.length > 0 ? members.join('\n') : '';
  return lines([
    docComment(variant.doc),
    `export interface ${variant.name} {`,
    body,
    '}',
  ]).trimEnd();
}
