/**
 * Stub of `@star-board/runtime` for the compile test: the hook signatures the plan (Part 3)
 * promises, so the emitted TSX is proven well-formed without depending on the runtime package.
 */
// eslint-disable-next-line no-restricted-imports -- a stub of a consumer module; the generator itself never imports React
import type { ComponentType } from 'react';
import type { ComponentKey } from '@star-board/core';

export interface QueryState<T> {
  data: T | undefined;
  error: unknown;
  status: 'pending' | 'error' | 'success';
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface SortSpec {
  field: string;
  dir: 'asc' | 'desc';
}
export interface ListQuery {
  page?: number;
  pageSize?: number;
  sort?: SortSpec;
  filter?: Record<string, unknown>;
}
export type ViewQuery = ListQuery;
export interface MutationState<I, O> {
  mutate: (input: I) => Promise<O>;
  isPending: boolean;
  error: unknown;
}
export declare function useEntity<T>(schema: string, id: string): QueryState<T>;
export declare function useEntityList<T>(schema: string, q: ListQuery): QueryState<Page<T>>;
export declare function useView<T>(view: string, q: ViewQuery): QueryState<Page<T>>;
export declare function useMutation<I, O>(
  operationId: string,
  opts?: Record<string, unknown>,
): MutationState<I, O>;
export declare function useCapability(cap: string): boolean;
export declare function useComponent<P>(
  key: ComponentKey,
  schema: string,
  target: string,
): ComponentType<P>;
export interface Services {
  client: unknown;
  auth: unknown;
  notify: unknown;
  agent?: unknown;
}
export declare function useServices(): Services;
export interface AuthPort {
  token(): string | undefined;
}
export interface TypedClient<Paths> {
  readonly paths: Paths;
  request(path: keyof Paths & string, init?: unknown): Promise<unknown>;
}
export declare function createClient<Paths>(baseUrl: string, auth: AuthPort): TypedClient<Paths>;
export interface I18n {
  t(key: string): string;
}
export declare function createI18n(defaults: Record<string, string>): I18n;
