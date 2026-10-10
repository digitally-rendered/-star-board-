import { RegistryError } from '@star-board/core';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeServices, model, Providers } from '../../test/helpers.js';
import { HttpError } from '../client/errors.js';
import { createI18n, I18nProvider, RUNTIME_DEFAULT_MESSAGES } from '../i18n/createI18n.js';
import { presentError, useErrorPresentation } from './useErrorPresentation.js';

const t = (key: string) => key;
const http = (status: number, extra: Partial<ConstructorParameters<typeof HttpError>[0]> = {}) =>
  new HttpError({ status, code: 'X', title: 'raw title', detail: 'raw backend text', ...extra });

describe('presentError (the error table)', () => {
  it.each([
    [401, '404', 'redirect', 'error.unauthorized'],
    [403, '404', 'empty', 'error.notFound'],
    [403, '403', 'forbidden', 'error.forbidden'],
    [404, '403', 'empty', 'error.notFound'],
    [409, '404', 'retry', 'error.conflict'],
    [412, '404', 'retry', 'error.stale'],
    [422, '404', 'alert', 'error.validation'],
    [429, '404', 'retry', 'error.rateLimited'],
    [400, '404', 'alert', 'error.unknown'],
    [500, '404', 'alert', 'error.server'],
    [503, '403', 'alert', 'error.server'],
  ] as const)('%i under posture %s → %s %s', (status, posture, kind, key) => {
    const out = presentError(http(status), t, posture);
    expect(out.kind).toBe(kind);
    expect(out.key).toBe(key);
    expect(out.message).toBe(key);
    expect(out.status).toBe(status);
    expect(out.code).toBe('X');
    expect(out.message).not.toContain('raw');
  });

  it('carries field errors for 422 and nothing else', () => {
    const out = presentError(http(422, { fields: { name: 'required' } }), t, '404');
    expect(out.fields).toEqual({ name: 'required' });
    expect(presentError(http(500), t, '404').fields).toBeUndefined();
  });

  it('maps registry, network and unknown errors', () => {
    const reg = presentError(new RegistryError('REGISTRY_UNRESOLVED', 'none'), t, '404');
    expect(reg).toMatchObject({
      kind: 'alert',
      key: 'error.registry',
      code: 'REGISTRY_UNRESOLVED',
    });
    expect(presentError(new TypeError('Failed to fetch'), t, '404')).toMatchObject({
      kind: 'alert',
      key: 'error.network',
    });
    expect(presentError('boom', t, '404')).toMatchObject({ kind: 'alert', key: 'error.unknown' });
    expect(presentError(undefined, t, '404').message).toBe('error.unknown');
  });
});

describe('useErrorPresentation', () => {
  it('uses the model posture and the runtime default messages', () => {
    const services = makeServices({ model: { ...model, posture: '403' } });
    const { result } = renderHook(() => useErrorPresentation(), {
      wrapper: ({ children }) => <Providers services={services}>{children}</Providers>,
    });
    expect(result.current(http(403))).toMatchObject({
      kind: 'forbidden',
      message: RUNTIME_DEFAULT_MESSAGES['error.forbidden'],
    });
    expect(result.current(http(500)).message).toBe(RUNTIME_DEFAULT_MESSAGES['error.server']);
  });

  it('redirects once on a 401 the client has not handled, never twice', () => {
    const services = makeServices();
    const { result } = renderHook(() => useErrorPresentation(), {
      wrapper: ({ children }) => <Providers services={services}>{children}</Providers>,
    });
    const fresh = http(401);
    expect(result.current(fresh).kind).toBe('redirect');
    expect(result.current(fresh).kind).toBe('redirect');
    expect(services.auth.onUnauthorized).toHaveBeenCalledTimes(1);
    const handled = new HttpError(
      { status: 401, code: 'UNAUTHORIZED', title: '', detail: '' },
      { unauthorizedHandled: true },
    );
    result.current(handled);
    expect(services.auth.onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('takes its messages from the nearest I18nProvider', () => {
    const i18n = createI18n({ ...RUNTIME_DEFAULT_MESSAGES }, { 'error.notFound': 'Rien ici.' });
    const { result } = renderHook(() => useErrorPresentation(), {
      wrapper: ({ children }) => (
        <Providers services={makeServices()}>
          <I18nProvider i18n={i18n}>{children}</I18nProvider>
        </Providers>
      ),
    });
    expect(result.current(http(404)).message).toBe('Rien ici.');
  });
});
