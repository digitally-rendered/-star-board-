/**
 * Stub of `@star-board/runtime` for the compile test: the signatures the real package exports
 * (packages/runtime/src), so the emitted TSX is proven well-formed without depending on it.
 */
import type { ComponentKey, Registration } from '@star-board/core';

export interface QueryState<T> {
  data: T | undefined;
  loading: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
}
export interface Page<T> {
  items: T[];
  total: number | null;
  page: number;
  pageSize: number;
}
export interface ListQuery {
  where?: Record<string, unknown> | undefined;
  sort?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}
export type ViewQuery = Record<string, unknown>;
export interface Versioned {
  entity_id?: string;
  record_version?: number;
  entityId?: string;
  recordVersion?: number;
}
export declare function etagOf(doc: Versioned): string;
export interface MutationVariables<I = unknown> {
  id?: string;
  body?: I;
  doc?: Versioned;
}
export interface MutationOptions<I, O> {
  onSuccess?: (data: O, variables: MutationVariables<I>) => void | Promise<void>;
  onError?: (error: unknown, variables: MutationVariables<I>) => void;
}
export interface MutationState<I, O> {
  mutate: (variables: MutationVariables<I>) => void;
  mutateAsync: (variables: MutationVariables<I>) => Promise<O>;
  loading: boolean;
  error: unknown;
  data: O | undefined;
  reset: () => void;
}
export declare function useEntity<T = unknown>(
  schema: string,
  id: string | null | undefined,
): QueryState<T>;
export declare function useEntityList<T = unknown>(
  schema: string,
  query?: ListQuery,
): QueryState<Page<T>>;
export declare function useView<T = unknown>(view: string, query?: ViewQuery): QueryState<Page<T>>;
export declare function useMutation<I = unknown, O = unknown>(
  operationId: string,
  options?: MutationOptions<I, O>,
): MutationState<I, O>;
export declare function useCapability(cap: string): boolean;
export declare function useComponent<C = unknown>(
  key: ComponentKey,
  schema: string,
  target: string,
): Registration<C>;
export declare class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Readonly<Record<string, string>> | undefined;
}
export declare function isHttpError(value: unknown): value is HttpError;
export interface Principal {
  id: string;
  roles: string[];
  capabilities: string[];
}
export interface AuthPort {
  getToken: () => Promise<string | null>;
  getPrincipal: () => Principal | null;
  onUnauthorized: () => void;
}
export interface ClientOptions {
  headers?: Record<string, string>;
  fetch?: (input: Request) => Promise<Response>;
}
/** openapi-fetch's Client, reduced to the members the generated adapter names. */
export interface Client<Paths extends object> {
  readonly __paths?: Paths;
  use(...middleware: unknown[]): void;
}
export declare function createClient<Paths extends object = Record<string, unknown>>(
  baseUrl: string,
  auth: AuthPort,
  opts?: ClientOptions,
): Client<Paths>;
export type Vars = Record<string, string | number>;
export interface Translate {
  (key: string, vars?: Vars): string;
  plural(key: string, count: number, vars?: Vars): string;
  date(value: Date | string | number, options?: Intl.DateTimeFormatOptions): string;
  number(value: number, options?: Intl.NumberFormatOptions): string;
  readonly locale: string;
}
export interface I18n {
  t: Translate;
  readonly locale: string;
  extend(translations: Record<string, string>, locale?: string): I18n;
  has(key: string): boolean;
}
export declare function createI18n(
  defaults: Record<string, string>,
  translations?: Record<string, string>,
  options?: { locale?: string },
): I18n;
export declare function useI18n(): I18n;
export interface UnsavedChanges {
  blocked: boolean;
  stay: () => void;
  leave: () => void;
  release: <T>(navigate: () => T) => T;
}
export declare function useUnsavedChanges(isDirty: boolean): UnsavedChanges;
export declare function useCompactLayout(): boolean;
