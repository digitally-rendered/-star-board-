import type { FeatureModel, JsonSchema, OperationEntry, ViewEntry } from '@star-board/core';
import { http, HttpResponse, type HttpHandler, type PathParams } from 'msw';
import { createStore, type Row, type Store } from './store.js';
import { propertiesOf, requiredOf, typesOf, validatePayload, type FieldError } from './validate.js';

/*
 * msw handlers derived from the document (plan Part 2: "msw handlers from the document"). The
 * handlers imitate the contract the backends share (hexagonal-rules shared/02 §6a): list pages as
 * `{ items, total }`, RFC 7807 problems, weak ETags `W/"<id>:<version>"` with `If-Match` on update,
 * 204 + tombstone on delete, `_history` versions, views as projected rows. Nothing here calls
 * `fetch`; the handlers only answer it.
 */

export interface HandlerOptions {
  store?: Store;
  /** Prefix of every path (`'*'` matches any origin and API prefix). */
  baseUrl?: string;
  /** When set, operations whose capabilities the principal lacks answer by the document's posture. */
  principalCapabilities?: readonly string[];
  /** Clock for `created_at`/`updated_at`; defaults to `Date.now`. */
  now?: () => Date;
  /** Actor written into `*_by` audit fields. */
  principalId?: string;
}

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail: string;
  errors?: Record<string, string>;
}

export const PROBLEM_TYPE = 'about:blank';
const PROBLEM_HEADERS = { 'content-type': 'application/problem+json' };

export function problem(
  status: number,
  title: string,
  detail: string,
  errors?: Record<string, string>,
) {
  const body: Problem = { type: PROBLEM_TYPE, title, status, detail };
  if (errors !== undefined) body.errors = errors;
  return HttpResponse.json(body, { status, headers: PROBLEM_HEADERS });
}

export function etagOf(id: string, version: number): string {
  return `W/"${id}:${version}"`;
}

/** The id field of a schema by the generator's convention: `entity_id`, then `id`, then the first required. */
export function idFieldOf(document: JsonSchema): string {
  const props = propertiesOf(document);
  if ('entity_id' in props) return 'entity_id';
  if ('id' in props) return 'id';
  return requiredOf(document)[0] ?? Object.keys(props)[0] ?? 'id';
}

export function handlersFromModel(
  model: FeatureModel,
  storeOrOptions: Store | HandlerOptions = {},
): HttpHandler[] {
  const options: HandlerOptions =
    'seed' in storeOrOptions && typeof storeOrOptions.seed === 'function'
      ? { store: storeOrOptions }
      : (storeOrOptions as HandlerOptions);
  const store = options.store ?? createStore();
  const baseUrl = options.baseUrl ?? '*';
  const ctx: Context = {
    model,
    store,
    now: options.now ?? (() => new Date()),
    principalId: options.principalId ?? 'test-principal',
    capabilities: options.principalCapabilities,
  };
  return Object.values(model.operations)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((op) => handlerFor(ctx, op, `${baseUrl}${op.path.replace(/\{([^}]+)\}/g, ':$1')}`));
}

interface Context {
  model: FeatureModel;
  store: Store;
  now: () => Date;
  principalId: string;
  capabilities: readonly string[] | undefined;
}

type Resolver = (info: { request: Request; params: PathParams }) => Promise<Response> | Response;

function handlerFor(ctx: Context, op: OperationEntry, path: string): HttpHandler {
  const resolve: Resolver = async (info) => {
    const denied = deny(ctx, op);
    if (denied !== undefined) return denied;
    const schema = ctx.model.schemas[op.schema];
    switch (op.kind) {
      case 'list':
        return list(ctx, op, info.request);
      case 'get':
        return schema === undefined ? problemNoSchema(op) : get(ctx, op, schema, info.params);
      case 'create':
        return schema === undefined ? problemNoSchema(op) : create(ctx, op, schema, info.request);
      case 'update':
        return schema === undefined
          ? problemNoSchema(op)
          : update(ctx, op, schema, info.request, info.params);
      case 'delete':
        return schema === undefined ? problemNoSchema(op) : remove(ctx, op, schema, info.params);
      case 'history':
        return schema === undefined ? problemNoSchema(op) : history(ctx, op, schema, info.params);
      case 'view':
        return view(ctx, op, info.request);
      case 'bulk':
      case 'custom':
        return HttpResponse.json({});
    }
  };
  switch (op.method) {
    case 'get':
      return http.get(path, resolve);
    case 'post':
      return http.post(path, resolve);
    case 'put':
      return http.put(path, resolve);
    case 'patch':
      return http.patch(path, resolve);
    case 'delete':
      return http.delete(path, resolve);
  }
}

type SchemaEntry = FeatureModel['schemas'][string];

function problemNoSchema(op: OperationEntry) {
  return problem(
    500,
    'Unknown schema',
    `operation ${op.id} names schema ${op.schema}, which the document lacks`,
  );
}

/** Posture (`x-ownership-posture`): a missing capability is 403 or an indistinguishable 404. */
function deny(ctx: Context, op: OperationEntry): Response | undefined {
  if (ctx.capabilities === undefined) return undefined;
  const held = ctx.capabilities;
  if (op.capabilities.every((c) => held.includes(c))) return undefined;
  return ctx.model.posture === '403'
    ? problem(403, 'Forbidden', `missing capability for ${op.id}`)
    : problem(404, 'Not Found', 'no such record');
}

function notFound(op: OperationEntry, id: string) {
  return problem(404, 'Not Found', `${op.schema} ${id} does not exist`);
}

function paramId(params: PathParams, idField: string): string {
  const raw = params.id ?? params[idField] ?? Object.values(params)[0];
  if (typeof raw === 'string') return raw;
  return raw?.[0] ?? '';
}

/* --------------------------------------------------------------- paging */

interface Paging {
  skip: number;
  limit: number;
}

function paging(url: URL, defaults: { default: number; max: number }): Paging {
  const q = url.searchParams;
  const int = (name: string): number | undefined => {
    const raw = q.get(name);
    if (raw === null) return undefined;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const limit = Math.min(
    int('limit') ?? int('pageSize') ?? int('page_size') ?? defaults.default,
    defaults.max,
  );
  const page = int('page');
  const skip =
    int('skip') ?? int('offset') ?? (page === undefined ? 0 : Math.max(page - 1, 0) * limit);
  return { skip, limit };
}

function pageOf(rows: readonly Row[], { skip, limit }: Paging) {
  return HttpResponse.json({ items: rows.slice(skip, skip + limit), total: rows.length });
}

const LIST_LIMITS = { default: 25, max: 1000 };

/* -------------------------------------------------------------- filters */

type FilterOp = '_eq' | '_ne' | '_in' | '_gt' | '_gte' | '_lt' | '_lte' | '_contains' | '_like';
const FILTER_OPS: readonly FilterOp[] = [
  '_eq',
  '_ne',
  '_in',
  '_gt',
  '_gte',
  '_lt',
  '_lte',
  '_contains',
  '_like',
];

interface Filter {
  field: string;
  op: FilterOp;
  value: string;
}

/** `where` as JSON (`{ field: value }` or `{ field: { _op: value } }`), then `field=` and `field_op=` params. */
function filtersOf(url: URL, allowed?: readonly { field: string; op: string }[]): Filter[] {
  const filters: Filter[] = [];
  const permitted = (field: string, op: FilterOp): boolean =>
    allowed === undefined ||
    allowed.some((a) => a.field === field && (a.op === op || (a.op === '' && op === '_eq')));
  const where = url.searchParams.get('where');
  if (where !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(where);
    } catch {
      parsed = undefined;
    }
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      for (const [field, spec] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof spec === 'object' && spec !== null && !Array.isArray(spec)) {
          for (const [op, value] of Object.entries(spec as Record<string, unknown>)) {
            if (isFilterOp(op) && permitted(field, op))
              filters.push({ field, op, value: scalar(value) });
          }
        } else if (permitted(field, '_eq')) filters.push({ field, op: '_eq', value: scalar(spec) });
      }
    }
  }
  for (const [name, value] of url.searchParams) {
    if (RESERVED_PARAMS.has(name)) continue;
    const op = FILTER_OPS.find((candidate) => name.endsWith(candidate));
    const field = op === undefined ? name : name.slice(0, -op.length);
    const actual = op ?? '_eq';
    if (field !== '' && permitted(field, actual)) filters.push({ field, op: actual, value });
  }
  return filters;
}

const RESERVED_PARAMS = new Set([
  'where',
  'sort',
  'skip',
  'limit',
  'offset',
  'page',
  'pageSize',
  'page_size',
]);

function isFilterOp(value: string): value is FilterOp {
  return (FILTER_OPS as readonly string[]).includes(value);
}

function scalar(value: unknown): string {
  if (Array.isArray(value)) return value.map(scalar).join(',');
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === undefined) return '';
  return JSON.stringify(value);
}

function matches(row: Row, filter: Filter): boolean {
  const actual = row[filter.field];
  const text = scalar(actual);
  const asNumber = typeof actual === 'number' ? actual : Number(text);
  const wanted = Number(filter.value);
  const numeric = Number.isFinite(asNumber) && Number.isFinite(wanted) && text !== '';
  switch (filter.op) {
    case '_eq':
      return text === filter.value;
    case '_ne':
      return text !== filter.value;
    case '_in':
      return filter.value.split(',').includes(text);
    case '_gt':
      return numeric ? asNumber > wanted : text > filter.value;
    case '_gte':
      return numeric ? asNumber >= wanted : text >= filter.value;
    case '_lt':
      return numeric ? asNumber < wanted : text < filter.value;
    case '_lte':
      return numeric ? asNumber <= wanted : text <= filter.value;
    case '_contains':
    case '_like':
      return text.toLowerCase().includes(filter.value.replace(/%/g, '').toLowerCase());
  }
}

/* ---------------------------------------------------------------- sorting */

interface Sort {
  field: string;
  dir: 'asc' | 'desc';
}

/** `sort=name`, `sort=-name`, `sort=name:desc` or `sort=name desc`; several comma-separated. */
function sortsOf(url: URL, fallback: readonly Sort[]): Sort[] {
  const raw = url.searchParams.get('sort');
  if (raw === null || raw.trim() === '') return [...fallback];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part): Sort => {
      if (part.startsWith('-')) return { field: part.slice(1), dir: 'desc' };
      const [field = '', dir = 'asc'] = part.split(/[: ]+/);
      return { field, dir: dir.toLowerCase() === 'desc' ? 'desc' : 'asc' };
    });
}

function sortRows(rows: Row[], sorts: readonly Sort[]): Row[] {
  if (sorts.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const { field, dir } of sorts) {
      const left = a[field];
      const right = b[field];
      const order =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : scalar(left).localeCompare(scalar(right));
      if (order !== 0) return dir === 'asc' ? order : -order;
    }
    return 0;
  });
}

/* ------------------------------------------------------------ operations */

function list(ctx: Context, op: OperationEntry, request: Request) {
  const url = new URL(request.url);
  const filters = filtersOf(url);
  const rows = sortRows(
    ctx.store.list(op.schema).filter((row) => filters.every((f) => matches(row, f))),
    sortsOf(url, []),
  );
  return pageOf(rows, paging(url, LIST_LIMITS));
}

function get(ctx: Context, op: OperationEntry, schema: SchemaEntry, params: PathParams) {
  const id = paramId(params, idFieldOf(schema.document));
  const row = ctx.store.get(op.schema, id);
  if (row === undefined) return notFound(op, id);
  return HttpResponse.json(row, { headers: { etag: etagOf(id, versionOf(row)) } });
}

function versionOf(row: Row): number {
  const version = row.record_version;
  return typeof version === 'number' ? version : 1;
}

async function body(request: Request): Promise<Record<string, unknown> | Response> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return problem(422, 'Unprocessable Content', 'the request body is not JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    return problem(422, 'Unprocessable Content', 'the request body must be a JSON object');
  return parsed as Record<string, unknown>;
}

function invalid(errors: readonly FieldError[]) {
  const fields: Record<string, string> = {};
  for (const error of errors) fields[error.field] ??= error.message;
  return problem(422, 'Unprocessable Content', 'the payload is invalid', fields);
}

/** Schema `default`s for properties the payload omits. */
function defaultsOf(schema: JsonSchema, payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, sub] of Object.entries(propertiesOf(schema))) {
    if (!(name in payload) && 'default' in sub) out[name] = sub.default;
  }
  return out;
}

/** Document fields outside the Create schema: the system fills them (id, version, audit). */
function systemFields(
  ctx: Context,
  schema: SchemaEntry,
  idField: string,
  id: string,
  version: number,
): Row {
  const createProps = propertiesOf(schema.create);
  const row: Row = { [idField]: id, record_version: version };
  for (const [name, sub] of Object.entries(propertiesOf(schema.document))) {
    if (name in createProps || name in row) continue;
    const types = typesOf(sub);
    if (sub.format === 'uuid') row[name] = crypto.randomUUID();
    else if (sub.format === 'date-time') row[name] = ctx.now().toISOString();
    else if (sub.format === 'date') row[name] = ctx.now().toISOString().slice(0, 10);
    else if (types.includes('integer') || types.includes('number')) row[name] = 0;
    else if (types.includes('boolean')) row[name] = false;
    else if (types.includes('string')) row[name] = ctx.principalId;
  }
  return row;
}

async function create(ctx: Context, op: OperationEntry, schema: SchemaEntry, request: Request) {
  const payload = await body(request);
  if (payload instanceof Response) return payload;
  const errors = validatePayload(schema.create, payload);
  if (errors.length > 0) return invalid(errors);
  const idField = idFieldOf(schema.document);
  const id = crypto.randomUUID();
  const row: Row = {
    ...systemFields(ctx, schema, idField, id, 1),
    ...defaultsOf(schema.create, payload),
    ...payload,
  };
  ctx.store.insert(op.schema, id, row);
  return HttpResponse.json(row, { status: 201, headers: { etag: etagOf(id, 1) } });
}

async function update(
  ctx: Context,
  op: OperationEntry,
  schema: SchemaEntry,
  request: Request,
  params: PathParams,
) {
  const id = paramId(params, idFieldOf(schema.document));
  const current = ctx.store.get(op.schema, id);
  if (current === undefined) return notFound(op, id);
  const version = versionOf(current);
  const ifMatch = request.headers.get('if-match');
  if (ifMatch?.trim() !== etagOf(id, version)) {
    return problem(
      412,
      'Precondition Failed',
      ifMatch === null ? 'If-Match is required' : `expected ${etagOf(id, version)}, got ${ifMatch}`,
    );
  }
  const payload = await body(request);
  if (payload instanceof Response) return payload;
  const errors = validatePayload(schema.update, payload);
  if (errors.length > 0) return invalid(errors);
  const next: Row = { ...current, ...payload, record_version: version + 1 };
  for (const [name, sub] of Object.entries(propertiesOf(schema.document))) {
    if (name.startsWith('updated') && sub.format === 'date-time')
      next[name] = ctx.now().toISOString();
    else if (name === 'updated_by' || name === 'modified_by') next[name] = ctx.principalId;
  }
  ctx.store.replace(op.schema, id, next);
  return HttpResponse.json(next, { headers: { etag: etagOf(id, version + 1) } });
}

function remove(ctx: Context, op: OperationEntry, schema: SchemaEntry, params: PathParams) {
  const id = paramId(params, idFieldOf(schema.document));
  if (!ctx.store.remove(op.schema, id)) return notFound(op, id);
  return new HttpResponse(null, { status: 204 });
}

function history(ctx: Context, op: OperationEntry, schema: SchemaEntry, params: PathParams) {
  const id = paramId(params, idFieldOf(schema.document));
  const versions = ctx.store.history(op.schema, id);
  if (versions === undefined) return notFound(op, id);
  return HttpResponse.json({ items: versions, total: versions.length });
}

function viewOf(model: FeatureModel, op: OperationEntry): ViewEntry | undefined {
  return Object.values(model.views).find((v) => v.operationId === op.id);
}

function view(ctx: Context, op: OperationEntry, request: Request) {
  const spec = viewOf(ctx.model, op);
  if (spec === undefined) return problem(500, 'Unknown view', `operation ${op.id} has no x-view`);
  const schema = ctx.model.schemas[spec.schema];
  if (schema === undefined) return problemNoSchema(op);
  const url = new URL(request.url);
  const filters = filtersOf(url, spec.filters);
  const idField = idFieldOf(schema.document);
  const columns = new Set([idField, ...spec.projection]);
  const rows = sortRows(
    ctx.store.list(spec.schema).filter((row) => filters.every((f) => matches(row, f))),
    sortsOf(url, spec.sort),
  ).map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => columns.has(key))));
  return pageOf(rows, paging(url, spec.limits));
}
