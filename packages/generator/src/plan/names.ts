import type { JsonSchema } from '@star-board/core';

/** `pet_owner` → `PetOwner`. */
export function pascalCase(name: string): string {
  return name
    .split(/[^a-zA-Z0-9]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** `created_at` → `Created at`; a schema `title` wins when present. */
export function humanize(name: string): string {
  const words = name.split(/[_\-\s]+/).filter((part) => part.length > 0);
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A string usable as a TypeScript identifier or a quoted key. */
export function propertyKey(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

export function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The `properties` of an object schema, in document order. */
export function propertiesOf(schema: JsonSchema): Record<string, JsonSchema> {
  const properties = schema.properties;
  if (!isRecord(properties)) return {};
  const out: Record<string, JsonSchema> = {};
  for (const [name, definition] of Object.entries(properties)) {
    if (isRecord(definition)) out[name] = definition;
  }
  return out;
}

export function requiredOf(schema: JsonSchema): readonly string[] {
  const required = schema.required;
  return Array.isArray(required) ? required.filter((r): r is string => typeof r === 'string') : [];
}

/** The non-null JSON Schema type name, or undefined when the schema declares none. */
export function primaryType(schema: JsonSchema): string | undefined {
  const type = schema.type;
  if (typeof type === 'string') return type;
  if (Array.isArray(type)) {
    const found = type.find((t): t is string => typeof t === 'string' && t !== 'null');
    return found;
  }
  return undefined;
}

export function isNullable(schema: JsonSchema): boolean {
  const type = schema.type;
  if (Array.isArray(type)) return type.includes('null');
  return type === 'null';
}

export function stringOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Route and path params: `/pet/{id}/adopt` → `['id']`. */
export function pathParams(path: string): string[] {
  return [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1] ?? '');
}

export function sortedKeys<T>(record: Record<string, T>): string[] {
  return Object.keys(record).sort();
}

/** Entries in key order: the one iteration order every emitter uses. */
export function sortedEntries<T>(record: Record<string, T>): [string, T][] {
  return Object.entries(record).sort(([a], [b]) => a.localeCompare(b));
}
