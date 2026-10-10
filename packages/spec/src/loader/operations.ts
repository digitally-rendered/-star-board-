import {
  REQUIRED_EXTENSIONS,
  SpecError,
  ViewEntrySchema,
  type JsonSchema,
  type OperationEntry,
  type ViewEntry,
} from '@star-board/core';
import { resolveSchema } from './refs.js';
import {
  invalid,
  isRecord,
  missingExtension,
  requireRecord,
  requireString,
  requireStringArray,
  type JsonObject,
} from './shared.js';

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
type Method = (typeof METHODS)[number];
/** Same shape as core's OperationEntrySchema id rule: `<schema>_<operation>`. */
const OPERATION_ID = /^[a-z][a-z0-9_]*_[a-z][a-z0-9_]*$/;
const JSON_MEDIA = 'application/json';
const VIEW_PATH_PREFIX = '/views/';

export interface Operations {
  operations: Record<string, OperationEntry>;
  views: Record<string, ViewEntry>;
}

/**
 * Every `paths.<path>.<method>` with an operationId becomes an OperationEntry; every one carrying
 * `x-view` also becomes a ViewEntry. The operationId is the one authority for the MCP tool name.
 */
export function collectOperations(
  paths: JsonObject,
  schemaNames: readonly string[],
  schemas: JsonObject,
): Operations {
  const operations: Record<string, OperationEntry> = {};
  const views: Record<string, ViewEntry> = {};
  for (const [path, item] of Object.entries(paths)) {
    const pathItem = requireRecord(item, `paths.${path}`);
    for (const method of METHODS) {
      const raw = pathItem[method];
      if (raw === undefined) continue;
      const at = `paths.${path}.${method}`;
      const operation = requireRecord(raw, at);
      const { entry, view } = buildOperation({ path, method, operation, at, schemaNames, schemas });
      if (entry.id in operations) {
        throw new SpecError('SPEC_OPERATION_ID', `Duplicate operationId ${entry.id} at ${at}`, {
          operationId: entry.id,
          at,
        });
      }
      operations[entry.id] = entry;
      if (view) {
        if (view.name in views) {
          throw invalid(`Duplicate view ${view.name} at ${at}`, { at, view: view.name });
        }
        views[view.name] = view;
      }
    }
  }
  return { operations, views };
}

interface OperationInput {
  path: string;
  method: Method;
  operation: JsonObject;
  at: string;
  schemaNames: readonly string[];
  schemas: JsonObject;
}

function buildOperation({ path, method, operation, at, schemaNames, schemas }: OperationInput): {
  entry: OperationEntry;
  view?: ViewEntry;
} {
  const id = operation.operationId;
  if (id === undefined) throw missingExtension('operationId', at);
  if (typeof id !== 'string' || !OPERATION_ID.test(id)) {
    throw new SpecError(
      'SPEC_OPERATION_ID',
      `operationId at ${at} must be <schema>_<operation> in snake_case`,
      { operationId: id, at },
    );
  }
  const rawView = operation[REQUIRED_EXTENSIONS.view];
  const viewAt = `${at}.${REQUIRED_EXTENSIONS.view}`;
  if (rawView !== undefined && !isRecord(rawView)) {
    throw invalid(`Expected an object at ${viewAt}`, { at: viewAt });
  }
  const matched = longestSchemaPrefix(id, schemaNames);
  let schema: string;
  let operationName: string;
  let view: ViewEntry | undefined;
  if (rawView) {
    view = buildView(id, rawView, viewAt, schemaNames);
    schema = view.schema;
    operationName = view.name;
  } else if (matched) {
    schema = matched;
    operationName = id.slice(matched.length + 1);
  } else if (path.startsWith(VIEW_PATH_PREFIX)) {
    throw missingExtension(REQUIRED_EXTENSIONS.view, at);
  } else {
    throw new SpecError(
      'SPEC_OPERATION_ID',
      `operationId ${id} at ${at} names no schema in the document and carries no ${REQUIRED_EXTENSIONS.view}`,
      { operationId: id, at, schemas: [...schemaNames] },
    );
  }

  const capabilitiesKey = REQUIRED_EXTENSIONS.capabilities;
  const rawCapabilities = operation[capabilitiesKey];
  if (rawCapabilities === undefined) throw missingExtension(capabilitiesKey, at);
  const capabilities = requireStringArray(rawCapabilities, `${at}.${capabilitiesKey}`);

  const request = requestSchema(operation, at, schemas);
  const response = responseSchema(operation, at, schemas);
  const entry: OperationEntry = {
    id,
    schema,
    operation: operationName,
    kind: deriveKind(path, method, view !== undefined),
    method,
    path,
    capabilities,
    mcpTool: id,
    ...(request ? { request } : {}),
    ...(response ? { response } : {}),
  };
  return view ? { entry, view } : { entry };
}

function longestSchemaPrefix(id: string, schemaNames: readonly string[]): string | undefined {
  let best: string | undefined;
  for (const name of schemaNames) {
    if (
      id.startsWith(`${name}_`) &&
      id.length > name.length + 1 &&
      (!best || name.length > best.length)
    ) {
      best = name;
    }
  }
  return best;
}

function buildView(
  operationId: string,
  rawView: JsonObject,
  at: string,
  schemaNames: readonly string[],
): ViewEntry {
  const schema = requireString(rawView.schema, `${at}.schema`);
  if (!schemaNames.includes(schema)) {
    throw invalid(`View at ${at} names unknown schema ${schema}`, {
      at: `${at}.schema`,
      schema,
      schemas: [...schemaNames],
    });
  }
  const name = operationId.replace(/_query$/, '');
  const parsed = ViewEntrySchema.safeParse({ ...rawView, name, operationId });
  if (!parsed.success) {
    throw invalid(
      `Invalid ${REQUIRED_EXTENSIONS.view} at ${at}: ${summarize(parsed.error.issues)}`,
      {
        at,
        issues: parsed.error.issues,
      },
    );
  }
  return parsed.data;
}

function summarize(issues: readonly { path: PropertyKey[]; message: string }[]): string {
  return issues
    .map((issue) => `${issue.path.map(String).join('.') || '<root>'} ${issue.message}`)
    .join('; ');
}

/** Path shape decides the kind; the id never does (ids are names, kinds are affordances). */
export function deriveKind(path: string, method: Method, isView: boolean): OperationEntry['kind'] {
  if (isView) return 'view';
  if (path.endsWith('/_history')) return 'history';
  if (path.endsWith('/_bulk')) return 'bulk';
  const item = /\/\{[^/}]+\}$/.test(path);
  const collection = !path.includes('{');
  switch (method) {
    case 'get':
      if (item) return 'get';
      return collection ? 'list' : 'custom';
    case 'post':
      return collection ? 'create' : 'custom';
    case 'put':
    case 'patch':
      return item ? 'update' : 'custom';
    case 'delete':
      return item ? 'delete' : 'custom';
  }
}

function requestSchema(
  operation: JsonObject,
  at: string,
  schemas: JsonObject,
): JsonSchema | undefined {
  const body = operation.requestBody;
  if (!isRecord(body)) return undefined;
  return mediaSchema(body, `${at}.requestBody`, schemas);
}

/** The first 2xx response that declares an application/json schema. */
function responseSchema(
  operation: JsonObject,
  at: string,
  schemas: JsonObject,
): JsonSchema | undefined {
  const responses = operation.responses;
  if (!isRecord(responses)) return undefined;
  for (const [status, response] of Object.entries(responses)) {
    if (!/^2\d\d$/.test(status) || !isRecord(response)) continue;
    const schema = mediaSchema(response, `${at}.responses.${status}`, schemas);
    if (schema) return schema;
  }
  return undefined;
}

function mediaSchema(holder: JsonObject, at: string, schemas: JsonObject): JsonSchema | undefined {
  const content = holder.content;
  if (!isRecord(content)) return undefined;
  const media = content[JSON_MEDIA];
  if (!isRecord(media) || media.schema === undefined) return undefined;
  const schemaAt = `${at}.content.${JSON_MEDIA}.schema`;
  return resolveSchema(requireRecord(media.schema, schemaAt), schemas, schemaAt);
}
