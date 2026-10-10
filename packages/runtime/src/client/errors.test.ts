import { describe, expect, it } from 'vitest';
import { defaultCodeFor, HttpError, isHttpError, parseProblem, problemFromBody } from './errors.js';

describe('problemFromBody', () => {
  it('reads an RFC 7807 body with extension members', () => {
    const p = problemFromBody(422, {
      type: 'about:blank',
      title: 'Unprocessable',
      status: 422,
      detail: 'name is required',
      code: 'VALIDATION_FAILED',
      errors: [
        { field: 'name', message: 'required' },
        { pointer: '#/tags/0', detail: 'too long' },
      ],
    });
    expect(p).toEqual({
      status: 422,
      code: 'VALIDATION_FAILED',
      title: 'Unprocessable',
      detail: 'name is required',
      fields: { name: 'required', 'tags.0': 'too long' },
    });
  });

  it('reads the { success: false, error } envelope', () => {
    const p = problemFromBody(409, {
      success: false,
      error: { code: 'DUPLICATE', message: 'already exists', details: { name: 'taken' } },
    });
    expect(p).toEqual({
      status: 409,
      code: 'DUPLICATE',
      title: 'already exists',
      detail: 'already exists',
      fields: { name: 'taken' },
    });
  });

  it('reads the bare { detail } body with a FastAPI validation array', () => {
    const p = problemFromBody(422, {
      detail: [{ loc: ['body', 'age'], msg: 'must be positive', type: 'value_error' }],
    });
    expect(p.code).toBe('VALIDATION_ERROR');
    expect(p.fields).toEqual({ age: 'must be positive' });
    expect(p.detail).toBe('');
  });

  it('assigns a default code per status when the body has none', () => {
    expect(problemFromBody(412, { detail: 'stale' }).code).toBe('PRECONDITION_FAILED');
    expect(problemFromBody(401, undefined).code).toBe('UNAUTHORIZED');
    expect(problemFromBody(503, 'Service Unavailable')).toEqual({
      status: 503,
      code: 'SERVER_ERROR',
      title: 'Service Unavailable',
      detail: 'Service Unavailable',
    });
    expect(defaultCodeFor(418)).toBe('HTTP_ERROR');
  });

  it('drops field tables that carry nothing usable', () => {
    expect(problemFromBody(400, { errors: [{ nope: 1 }], fields: {} }).fields).toBeUndefined();
  });
});

describe('parseProblem', () => {
  it('parses a problem+json response', async () => {
    const res = new Response(JSON.stringify({ title: 'Forbidden', detail: 'no' }), {
      status: 403,
      headers: { 'Content-Type': 'application/problem+json' },
    });
    expect(await parseProblem(res)).toEqual({
      status: 403,
      code: 'FORBIDDEN',
      title: 'Forbidden',
      detail: 'no',
    });
  });

  it('never throws on a malformed body', async () => {
    const res = new Response('<html>oops</html>', { status: 502 });
    expect(await parseProblem(res)).toEqual({
      status: 502,
      code: 'SERVER_ERROR',
      title: '<html>oops</html>',
      detail: '<html>oops</html>',
    });
    const empty = new Response(null, { status: 500 });
    expect((await parseProblem(empty)).code).toBe('SERVER_ERROR');
  });
});

describe('HttpError', () => {
  it('is a serialisable Error carrying the problem', () => {
    const err = new HttpError({
      status: 404,
      code: 'NOT_FOUND',
      title: 'Not found',
      detail: 'gone',
      fields: { a: 'b' },
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('HttpError');
    expect(err.message).toBe('gone');
    expect(err.unauthorizedHandled).toBe(false);
    expect(JSON.parse(JSON.stringify(err))).toEqual({
      status: 404,
      code: 'NOT_FOUND',
      title: 'Not found',
      detail: 'gone',
      fields: { a: 'b' },
    });
    expect(isHttpError(err)).toBe(true);
    expect(isHttpError(new Error('x'))).toBe(false);
    expect(
      new HttpError({ status: 500, code: 'SERVER_ERROR', title: '', detail: '' }).message,
    ).toBe('HTTP 500');
  });
});
