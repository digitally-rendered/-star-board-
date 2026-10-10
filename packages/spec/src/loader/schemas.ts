import { REQUIRED_EXTENSIONS, type SchemaEntry, type UiHints } from '@star-board/core';
import { resolveSchema } from './refs.js';
import {
  invalid,
  isRecord,
  missingExtension,
  requireString,
  toSnakeCase,
  type JsonObject,
} from './shared.js';

const REASON_KEY = /^x-(.+)-reason$/;

/**
 * One SchemaEntry per `<Pascal>` in `components.schemas` that has `<Pascal>Create` and
 * `<Pascal>Update` siblings (the Document/Create/Update convention every backend emits).
 */
export function collectSchemas(schemas: JsonObject): Record<string, SchemaEntry> {
  const entries: Record<string, SchemaEntry> = {};
  for (const [pascal, raw] of Object.entries(schemas)) {
    const create = schemas[`${pascal}Create`];
    const update = schemas[`${pascal}Update`];
    if (!isRecord(create) || !isRecord(update)) continue;
    const at = `components.schemas.${pascal}`;
    if (!isRecord(raw)) throw invalid(`Expected a schema object at ${at}`, { at });
    const name = toSnakeCase(pascal);
    if (name in entries) {
      throw invalid(`Schema name ${name} is produced by more than one component`, { at, name });
    }
    entries[name] = buildEntry({ name, pascal, raw, create, update, schemas, at });
  }
  return entries;
}

interface EntryInput {
  name: string;
  pascal: string;
  raw: JsonObject;
  create: JsonObject;
  update: JsonObject;
  schemas: JsonObject;
  at: string;
}

function buildEntry({ name, pascal, raw, create, update, schemas, at }: EntryInput): SchemaEntry {
  const versionKey = REQUIRED_EXTENSIONS.schemaVersion;
  const version = raw[versionKey];
  if (version === undefined) throw missingExtension(versionKey, at);
  const { reasons, ui } = collectHints(raw, at);
  const entry: SchemaEntry = {
    name,
    version: requireString(version, `${at}.${versionKey}`),
    document: resolveSchema(raw, schemas, at),
    create: resolveSchema(create, schemas, `components.schemas.${pascal}Create`),
    update: resolveSchema(update, schemas, `components.schemas.${pascal}Update`),
    reasons,
    ui,
  };
  const ownerField = readOwnerField(raw, at);
  if (ownerField !== undefined) entry.ownerField = ownerField;
  return entry;
}

/** Absent → undefined (no ownership); `null`/`false` → null (explicitly unowned); string → field. */
function readOwnerField(raw: JsonObject, at: string): string | null | undefined {
  const key = REQUIRED_EXTENSIONS.ownerField;
  const value = raw[key];
  if (value === undefined) return undefined;
  if (value === null || value === false) return null;
  return requireString(value, `${at}.${key}`);
}

function collectHints(
  raw: JsonObject,
  at: string,
): { reasons: Record<string, string>; ui: UiHints } {
  const reasons: Record<string, string> = {};
  const ui: UiHints = { widget: {}, group: {}, order: {}, hidden: [] };
  for (const [key, value] of Object.entries(raw)) {
    const match = REASON_KEY.exec(key);
    if (match?.[1] !== undefined) reasons[match[1]] = requireString(value, `${at}.${key}`);
  }
  const properties = raw.properties;
  if (!isRecord(properties)) return { reasons, ui };
  for (const [field, definition] of Object.entries(properties)) {
    if (!isRecord(definition)) continue;
    const fieldAt = `${at}.properties.${field}`;
    for (const [key, value] of Object.entries(definition)) {
      if (REASON_KEY.test(key)) reasons[field] = requireString(value, `${fieldAt}.${key}`);
    }
    const widget = definition[REQUIRED_EXTENSIONS.uiWidget];
    if (widget !== undefined) {
      ui.widget[field] = requireString(widget, `${fieldAt}.${REQUIRED_EXTENSIONS.uiWidget}`);
    }
    const group = definition[REQUIRED_EXTENSIONS.uiGroup];
    if (group !== undefined) {
      ui.group[field] = requireString(group, `${fieldAt}.${REQUIRED_EXTENSIONS.uiGroup}`);
    }
    const order = definition[REQUIRED_EXTENSIONS.uiOrder];
    if (order !== undefined) {
      const orderAt = `${fieldAt}.${REQUIRED_EXTENSIONS.uiOrder}`;
      if (typeof order !== 'number' || !Number.isFinite(order)) {
        throw invalid(`Expected a number at ${orderAt}`, { at: orderAt });
      }
      ui.order[field] = order;
    }
    const hidden = definition[REQUIRED_EXTENSIONS.uiHidden];
    if (hidden !== undefined) {
      const hiddenAt = `${fieldAt}.${REQUIRED_EXTENSIONS.uiHidden}`;
      if (typeof hidden !== 'boolean')
        throw invalid(`Expected a boolean at ${hiddenAt}`, { at: hiddenAt });
      if (hidden) ui.hidden.push(field);
    }
  }
  return { reasons, ui };
}
