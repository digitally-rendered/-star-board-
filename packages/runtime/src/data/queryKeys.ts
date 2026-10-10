/** Query keys are one authority: every hook and every invalidation goes through this table. */
export interface ListQuery {
  where?: Record<string, unknown> | undefined;
  /** Comma-separated fields, `-` prefix for descending, as the backend routers read it. */
  sort?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}
export type ViewQuery = Record<string, unknown>;

const ROOT = 'star-board' as const;

export const queryKeys = {
  all: () => [ROOT] as const,
  schema: (schema: string) => [ROOT, schema] as const,
  entity: (schema: string, id: string) => [ROOT, schema, 'entity', id] as const,
  list: (schema: string, q: ListQuery) => [ROOT, schema, 'list', normalise(q)] as const,
  view: (view: string, q: ViewQuery) => [ROOT, 'view', view, normalise(q)] as const,
};
export type QueryKey = ReturnType<(typeof queryKeys)[keyof typeof queryKeys]>;

/** Stable key material: sorted own keys, undefined dropped, so equal queries hash equal. */
export function normalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalise);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = normalise(v);
    }
    return out;
  }
  return value;
}
