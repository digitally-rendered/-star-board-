import type { FeatureModel, OperationEntry } from '@star-board/core';
import { IF_MATCH, type HttpClient } from '../client/createClient.js';
import type { ListQuery, ViewQuery } from './queryKeys.js';

/** One page of a list or view; the backends return either a bare array or an `items` envelope. */
export interface Page<T> {
  items: T[];
  total: number | null;
  page: number;
  pageSize: number;
}

export interface MutateInput {
  /** Path parameter `id` for get/update/delete-shaped operations. */
  id?: string;
  body?: unknown;
  /** `If-Match` precondition for update and delete (built with `etagOf`). */
  ifMatch?: string;
}

/**
 * The port between the data hooks and HTTP (typescript/01 §3–§4): hooks never see the client.
 * Tests stub it; the default implementation looks operations up in the FeatureModel by id.
 */
export interface OperationsPort {
  get: (schema: string, id: string) => Promise<unknown>;
  list: (schema: string, query: ListQuery) => Promise<Page<unknown>>;
  view: (view: string, query: ViewQuery) => Promise<Page<unknown>>;
  mutate: (operationId: string, input: MutateInput) => Promise<unknown>;
}

export const DEFAULT_PAGE_SIZE = 50;

/** `{ where, sort, page, pageSize }` → the backends' `where` (JSON), `sort`, `skip`, `limit`. */
export function listParams(query: ListQuery): Record<string, string | number> {
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  const page = query.page ?? 1;
  const params: Record<string, string | number> = { skip: (page - 1) * pageSize, limit: pageSize };
  if (query.where && Object.keys(query.where).length > 0)
    params.where = JSON.stringify(query.where);
  if (query.sort !== undefined && query.sort !== '') params.sort = query.sort;
  return params;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Bare arrays and `{ items | data | results, total }` envelopes all become one Page. */
export function toPage<T>(body: unknown, page: number, pageSize: number): Page<T> {
  if (Array.isArray(body)) return { items: body as T[], total: null, page, pageSize };
  if (isRecord(body)) {
    const items = body.items ?? body.data ?? body.results;
    if (Array.isArray(items)) {
      const total = body.total ?? body.count;
      return {
        items: items as T[],
        total: typeof total === 'number' ? total : null,
        page,
        pageSize,
      };
    }
  }
  throw new TypeError('toPage: response is neither an array nor an items envelope');
}

function findOperation(
  model: FeatureModel,
  schema: string,
  kind: OperationEntry['kind'],
): OperationEntry {
  const op = Object.values(model.operations).find((o) => o.schema === schema && o.kind === kind);
  if (!op) throw new Error(`no ${kind} operation for schema ${schema} in the FeatureModel`);
  return op;
}

export function createOperationsPort(client: HttpClient, model: FeatureModel): OperationsPort {
  async function call(op: OperationEntry, input: MutateInput, query?: Record<string, unknown>) {
    const headers: Record<string, string> = {};
    if (input.ifMatch !== undefined) headers[IF_MATCH] = input.ifMatch;
    const params: { path?: Record<string, unknown>; query?: Record<string, unknown> } = {};
    if (input.id !== undefined) params.path = { id: input.id };
    if (query) params.query = query;
    const { data } = await client.request(op.method, op.path, {
      params,
      headers,
      ...(input.body !== undefined ? { body: input.body } : {}),
    });
    return data;
  }
  return {
    async get(schema, id) {
      return await call(findOperation(model, schema, 'get'), { id });
    },
    async list(schema, query) {
      const body = await call(findOperation(model, schema, 'list'), {}, listParams(query));
      return toPage(body, query.page ?? 1, query.pageSize ?? DEFAULT_PAGE_SIZE);
    },
    async view(view, query) {
      const entry = model.views[view];
      if (!entry) throw new Error(`no view ${view} in the FeatureModel`);
      const op = model.operations[entry.operationId];
      if (!op) throw new Error(`view ${view} names unknown operation ${entry.operationId}`);
      const body = await call(op, {}, query);
      const page = typeof query.page === 'number' ? query.page : 1;
      const limit = typeof query.limit === 'number' ? query.limit : entry.limits.default;
      return toPage(body, page, limit);
    },
    async mutate(operationId, input) {
      const op = model.operations[operationId];
      if (!op) throw new Error(`no operation ${operationId} in the FeatureModel`);
      return await call(op, input);
    },
  };
}
