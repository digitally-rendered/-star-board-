import type { JsonSchema } from '@star-board/core';

/*
 * A minimal structural validator over the subset of JSON Schema the documents use: `type`,
 * `required`, `enum`, `const`, string bounds and formats, numeric bounds, `items`, nested
 * `properties` and `additionalProperties: false`. It stands in for the backend's validator in the
 * msw handlers and for the generated zod schema in the fixture tests; it is not a full validator.
 */

export interface FieldError {
  /** Dotted path from the payload root; `''` for the payload itself. */
  field: string;
  message: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validatePayload(schema: JsonSchema, value: unknown): FieldError[] {
  const errors: FieldError[] = [];
  validateAt(schema, value, '', errors);
  return errors;
}

export function typesOf(schema: JsonSchema): string[] {
  const type = schema.type;
  if (typeof type === 'string') return [type];
  if (Array.isArray(type)) return type.filter((t): t is string => typeof t === 'string');
  return [];
}

export function propertiesOf(schema: JsonSchema): Record<string, JsonSchema> {
  const props = schema.properties;
  if (typeof props !== 'object' || props === null) return {};
  const out: Record<string, JsonSchema> = {};
  for (const [name, sub] of Object.entries(props as Record<string, unknown>)) {
    if (typeof sub === 'object' && sub !== null) out[name] = sub as JsonSchema;
  }
  return out;
}

export function requiredOf(schema: JsonSchema): string[] {
  const required = schema.required;
  return Array.isArray(required) ? required.filter((r): r is string => typeof r === 'string') : [];
}

function numberOf(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function jsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

function typeMatches(declared: readonly string[], value: unknown): boolean {
  if (declared.length === 0) return true;
  const actual = jsonType(value);
  return declared.some((t) => t === actual || (t === 'number' && actual === 'integer'));
}

function validateAt(schema: JsonSchema, value: unknown, path: string, errors: FieldError[]): void {
  const at = (message: string): void => {
    errors.push({ field: path, message });
  };
  const declared = typesOf(schema);
  if (!typeMatches(declared, value)) {
    at(`expected ${declared.join(' | ')}, got ${jsonType(value)}`);
    return;
  }
  if (value === null) return;
  if ('const' in schema && JSON.stringify(schema.const) !== JSON.stringify(value)) {
    at('must equal the constant');
    return;
  }
  const options = schema.enum;
  if (Array.isArray(options) && !options.some((o) => JSON.stringify(o) === JSON.stringify(value))) {
    at(`must be one of ${options.map((o) => JSON.stringify(o)).join(', ')}`);
    return;
  }
  if (typeof value === 'string') validateString(schema, value, at);
  else if (typeof value === 'number') validateNumber(schema, value, at);
  else if (Array.isArray(value)) validateArray(schema, value, path, errors, at);
  else if (typeof value === 'object')
    validateObject(schema, value as Record<string, unknown>, path, errors);
}

function validateString(schema: JsonSchema, value: string, at: (m: string) => void): void {
  const max = numberOf(schema.maxLength);
  const min = numberOf(schema.minLength);
  if (max !== undefined && value.length > max) at(`longer than ${max} characters`);
  if (min !== undefined && value.length < min) at(`shorter than ${min} characters`);
  if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern, 'u').test(value))
    at(`does not match ${schema.pattern}`);
  switch (schema.format) {
    case 'uuid':
      if (!UUID.test(value)) at('not a uuid');
      break;
    case 'date-time':
      if (!DATE_TIME.test(value) || Number.isNaN(Date.parse(value)))
        at('not an RFC 3339 date-time');
      break;
    case 'date':
      if (!DATE.test(value) || Number.isNaN(Date.parse(value))) at('not a date');
      break;
    case 'email':
      if (!EMAIL.test(value)) at('not an email address');
      break;
    default:
      break;
  }
}

function validateNumber(schema: JsonSchema, value: number, at: (m: string) => void): void {
  const min = numberOf(schema.minimum);
  const max = numberOf(schema.maximum);
  const exMin = numberOf(schema.exclusiveMinimum);
  const exMax = numberOf(schema.exclusiveMaximum);
  if (min !== undefined && value < min) at(`less than ${min}`);
  if (max !== undefined && value > max) at(`greater than ${max}`);
  if (exMin !== undefined && value <= exMin) at(`not greater than ${exMin}`);
  if (exMax !== undefined && value >= exMax) at(`not less than ${exMax}`);
}

function validateArray(
  schema: JsonSchema,
  value: unknown[],
  path: string,
  errors: FieldError[],
  at: (m: string) => void,
): void {
  const min = numberOf(schema.minItems);
  const max = numberOf(schema.maxItems);
  if (min !== undefined && value.length < min) at(`fewer than ${min} items`);
  if (max !== undefined && value.length > max) at(`more than ${max} items`);
  const items = schema.items;
  if (typeof items === 'object' && items !== null && !Array.isArray(items)) {
    value.forEach((item, index) => {
      validateAt(items as JsonSchema, item, `${path}[${index}]`, errors);
    });
  }
}

function validateObject(
  schema: JsonSchema,
  value: Record<string, unknown>,
  path: string,
  errors: FieldError[],
): void {
  const props = propertiesOf(schema);
  const prefix = path === '' ? '' : `${path}.`;
  for (const name of requiredOf(schema)) {
    if (!(name in value) || value[name] === undefined)
      errors.push({ field: `${prefix}${name}`, message: 'required' });
  }
  for (const [name, sub] of Object.entries(props)) {
    if (name in value && value[name] !== undefined)
      validateAt(sub, value[name], `${prefix}${name}`, errors);
  }
  if (schema.additionalProperties === false) {
    for (const name of Object.keys(value)) {
      if (!(name in props)) errors.push({ field: `${prefix}${name}`, message: 'unknown field' });
    }
  }
}
