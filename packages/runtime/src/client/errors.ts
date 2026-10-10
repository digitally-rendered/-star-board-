/**
 * Transport failures become one typed error (typescript/05 §2). `parseProblem` reads both error body
 * shapes the backend frameworks emit: RFC 7807 `application/problem+json` and the
 * `{ success: false, error: { code, message, details } }` envelope.
 */
export interface ProblemDetails {
  status: number;
  code: string;
  title: string;
  detail: string;
  fields?: Record<string, string>;
}

/** Codes the runtime assigns when a body carries none; the backend's own code wins when present. */
export const DEFAULT_CODES: Readonly<Record<number, string>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  412: 'PRECONDITION_FAILED',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
};

export function defaultCodeFor(status: number): string {
  const known = DEFAULT_CODES[status];
  if (known !== undefined) return known;
  return status >= 500 ? 'SERVER_ERROR' : 'HTTP_ERROR';
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string;
  readonly fields: Readonly<Record<string, string>> | undefined;
  /** True once the client has already called `auth.onUnauthorized()` for this response. */
  unauthorizedHandled: boolean;

  constructor(problem: ProblemDetails, options?: { unauthorizedHandled?: boolean }) {
    super(problem.detail || problem.title || `HTTP ${problem.status}`);
    this.name = 'HttpError';
    this.status = problem.status;
    this.code = problem.code;
    this.title = problem.title;
    this.detail = problem.detail;
    this.fields = problem.fields;
    this.unauthorizedHandled = options?.unauthorizedHandled ?? false;
  }

  toJSON(): ProblemDetails {
    const out: ProblemDetails = {
      status: this.status,
      code: this.code,
      title: this.title,
      detail: this.detail,
    };
    if (this.fields) out.fields = { ...this.fields };
    return out;
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Field errors arrive as `{ field: message }`, `[{ field|loc|pointer, message|msg|detail }]`. */
function fieldsFrom(value: unknown): Record<string, string> | undefined {
  if (isRecord(value)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(value)) {
      const message = str(v) ?? (Array.isArray(v) ? v.map(String).join('; ') : undefined);
      if (message !== undefined) out[k] = message;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  if (Array.isArray(value)) {
    const out: Record<string, string> = {};
    for (const item of value) {
      if (!isRecord(item)) continue;
      const loc = item.loc;
      const field =
        str(item.field) ??
        str(item.pointer)?.replace(/^#?\//, '').replaceAll('/', '.') ??
        (Array.isArray(loc)
          ? loc
              .filter((p) => p !== 'body')
              .map(String)
              .join('.')
          : undefined);
      const message = str(item.message) ?? str(item.msg) ?? str(item.detail);
      if (field !== undefined && message !== undefined) out[field] = message;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return undefined;
}

/** Normalise a parsed error body to ProblemDetails; `status` comes from the response. */
export function problemFromBody(status: number, body: unknown): ProblemDetails {
  const fallback = defaultCodeFor(status);
  if (!isRecord(body)) {
    return {
      status,
      code: fallback,
      title: str(body) ?? '',
      detail: str(body) ?? '',
    };
  }
  const envelope = body.success === false && isRecord(body.error) ? body.error : undefined;
  if (envelope) {
    const fields = fieldsFrom(envelope.details);
    const out: ProblemDetails = {
      status,
      code: str(envelope.code) ?? fallback,
      title: str(envelope.message) ?? '',
      detail: str(envelope.message) ?? '',
    };
    if (fields) out.fields = fields;
    return out;
  }
  // RFC 7807 (`type`, `title`, `status`, `detail`, extension members `code`, `errors`), with the
  // bare `{ detail }` shape the Python framework emits for simple errors read the same way.
  const detailValue = body.detail;
  const fields = fieldsFrom(body.errors) ?? fieldsFrom(body.fields) ?? fieldsFrom(detailValue);
  const out: ProblemDetails = {
    status,
    code: str(body.code) ?? fallback,
    title: str(body.title) ?? '',
    detail: str(detailValue) ?? str(body.message) ?? '',
  };
  if (fields) out.fields = fields;
  return out;
}

/** One function for both body shapes; never throws on a malformed body. */
export async function parseProblem(response: Response): Promise<ProblemDetails> {
  let body: unknown;
  try {
    const text = await response.text();
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }
  } catch {
    body = undefined;
  }
  return problemFromBody(response.status, body);
}
