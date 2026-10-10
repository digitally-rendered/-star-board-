import createOpenApiClient, { type Client, type Middleware } from 'openapi-fetch';
import type { AuthPort } from '../ports.js';
import { HttpError, parseProblem } from './errors.js';

/**
 * The one HTTP client (typescript/02 §5, typescript/05 §5). The generated layer supplies the
 * `paths` type from the OpenAPI document; the runtime leaves it generic. The middleware injects the
 * bearer token, asks for JSON, forwards `If-Match` when a call provides one, and turns every
 * non-2xx response into an `HttpError`; a 401 calls `auth.onUnauthorized()` exactly once.
 */

/** Shape of one operation when the generated `paths` type is not in play: params and body open. */
export interface UntypedOperation {
  parameters: {
    query?: Record<string, unknown>;
    header?: Record<string, unknown>;
    path?: Record<string, unknown>;
    cookie?: Record<string, unknown>;
  };
  requestBody?: { content: { 'application/json': unknown } };
  responses: Record<number | string, { content: { 'application/json': unknown } }>;
}
/** The methods the FeatureModel admits (core `OperationEntrySchema.method`). */
export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';
export type UntypedPaths = Record<string, Record<HttpMethod, UntypedOperation>>;
/** The client as the runtime holds it; a `Client<paths>` from the generated layer narrows it. */
export type HttpClient = Client<UntypedPaths>;

export interface ClientOptions {
  /** Headers added to every request (the middleware's own headers win). */
  headers?: Record<string, string>;
  /** Injected fetch, for tests or a custom transport. */
  fetch?: (input: Request) => Promise<Response>;
}

/** The header name the mutation hooks and the middleware agree on. */
export const IF_MATCH = 'If-Match';

export function createAuthMiddleware(auth: AuthPort): Middleware {
  return {
    async onRequest({ request }) {
      const token = await auth.getToken();
      if (token !== null && token !== '' && !request.headers.has('Authorization')) {
        request.headers.set('Authorization', `Bearer ${token}`);
      }
      if (!request.headers.has('Accept')) request.headers.set('Accept', 'application/json');
      return request;
    },
    async onResponse({ response }) {
      if (response.ok || response.status === 304) return response;
      const problem = await parseProblem(response.clone());
      const unauthorized = response.status === 401;
      if (unauthorized) auth.onUnauthorized();
      throw new HttpError(problem, { unauthorizedHandled: unauthorized });
    },
  };
}

export function createClient<Paths extends object = UntypedPaths>(
  baseUrl: string,
  auth: AuthPort,
  opts: ClientOptions = {},
): Client<Paths> {
  const client = createOpenApiClient<Paths>({
    baseUrl,
    ...(opts.headers ? { headers: opts.headers } : {}),
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
  });
  client.use(createAuthMiddleware(auth));
  return client;
}
