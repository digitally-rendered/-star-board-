import { useCallback } from 'react';
import {
  useMutation as useTanstackMutation,
  useQuery,
  useQueryClient,
  type QueryKey as TanstackQueryKey,
} from '@tanstack/react-query';
import { etagOf, type Versioned } from '../client/etag.js';
import { useOperations, useServices } from '../services/ServicesProvider.js';
import type { Page } from './operations.js';
import { queryKeys, type ListQuery, type ViewQuery } from './queryKeys.js';

/**
 * Shared data hooks (typescript/02 §3) on TanStack Query. They depend on primitive parameters,
 * never on the client (typescript/02 §5), reach HTTP only through the OperationsPort, and return
 * `{ data, loading, error }` so pages check loading, then error, then render (typescript/05 §2).
 */
export interface QueryState<T> {
  data: T | undefined;
  loading: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
}

/** GET one document; a falsy id disables the fetch rather than requesting `/undefined`. */
export function useEntity<T = unknown>(
  schema: string,
  id: string | null | undefined,
): QueryState<T> {
  const ops = useOperations();
  const enabled = typeof id === 'string' && id !== '';
  const result = useQuery({
    queryKey: queryKeys.entity(schema, id ?? ''),
    queryFn: () => ops.get(schema, id ?? '') as Promise<T>,
    enabled,
  });
  return {
    data: result.data,
    loading: enabled && result.isPending,
    error: result.error,
    refetch: result.refetch,
  };
}

export function useEntityList<T = unknown>(
  schema: string,
  query: ListQuery = {},
): QueryState<Page<T>> {
  const ops = useOperations();
  const result = useQuery({
    queryKey: queryKeys.list(schema, query),
    queryFn: () => ops.list(schema, query) as Promise<Page<T>>,
  });
  return {
    data: result.data,
    loading: result.isPending,
    error: result.error,
    refetch: result.refetch,
  };
}

export function useView<T = unknown>(view: string, query: ViewQuery = {}): QueryState<Page<T>> {
  const ops = useOperations();
  const result = useQuery({
    queryKey: queryKeys.view(view, query),
    queryFn: () => ops.view(view, query) as Promise<Page<T>>,
  });
  return {
    data: result.data,
    loading: result.isPending,
    error: result.error,
    refetch: result.refetch,
  };
}

export interface MutationVariables<I = unknown> {
  id?: string;
  body?: I;
  /** The document being updated or deleted; its `If-Match` is built with `etagOf`. */
  doc?: Versioned;
}
export interface MutationOptions<I, O> {
  onSuccess?: (data: O, variables: MutationVariables<I>) => void | Promise<void>;
  onError?: (error: unknown, variables: MutationVariables<I>) => void;
  /** Keys to invalidate on success; defaults to the operation's schema, else every runtime key. */
  invalidates?: readonly TanstackQueryKey[];
}
export interface MutationState<I, O> {
  mutate: (variables: MutationVariables<I>) => void;
  mutateAsync: (variables: MutationVariables<I>) => Promise<O>;
  loading: boolean;
  error: unknown;
  data: O | undefined;
  reset: () => void;
}

/**
 * One operation by id. Update and delete carry `If-Match: W/"<entity_id>:<record_version>"` from
 * `variables.doc`; a stale document surfaces as an HttpError with status 412 (`PRECONDITION_FAILED`).
 */
export function useMutation<I = unknown, O = unknown>(
  operationId: string,
  options: MutationOptions<I, O> = {},
): MutationState<I, O> {
  const ops = useOperations();
  const { model } = useServices();
  const queryClient = useQueryClient();
  const entry = model?.operations[operationId];
  const kind = entry?.kind;
  const schema = entry?.schema;
  const { onSuccess, onError, invalidates } = options;

  const run = useCallback(
    (variables: MutationVariables<I>) => {
      const needsEtag = kind === 'update' || kind === 'delete';
      if (needsEtag && !variables.doc) {
        return Promise.reject(
          new TypeError(`${operationId}: ${kind} needs the current document for If-Match`),
        );
      }
      const input: { id?: string; body?: unknown; ifMatch?: string } = {};
      if (variables.id !== undefined) input.id = variables.id;
      if (variables.body !== undefined) input.body = variables.body;
      if (variables.doc) input.ifMatch = etagOf(variables.doc);
      return ops.mutate(operationId, input) as Promise<O>;
    },
    // `ops` is a memoised port, never the client; the primitives decide identity.
    [ops, operationId, kind],
  );

  const mutation = useTanstackMutation<O, unknown, MutationVariables<I>>({
    mutationFn: run,
    async onSuccess(data, variables) {
      const keys = invalidates ?? [
        schema === undefined ? queryKeys.all() : queryKeys.schema(schema),
      ];
      await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      await onSuccess?.(data, variables);
    },
    onError(error, variables) {
      onError?.(error, variables);
    },
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}
