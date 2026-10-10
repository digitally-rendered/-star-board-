import { useCallback } from 'react';
import { RegistryError } from '@star-board/core';
import { isHttpError } from '../client/errors.js';
import { useI18n } from '../i18n/createI18n.js';
import { useServices } from '../services/ServicesProvider.js';

/**
 * The frontend error table (typescript/05 §2) as one pure function plus a hook. Raw backend text
 * never reaches the user: every message is an i18n key resolved through the nearest I18nProvider.
 * `fields` carries per-field validation messages for forms to place next to inputs.
 */
export type ErrorKind = 'redirect' | 'alert' | 'retry' | 'empty' | 'forbidden';
export interface ErrorPresentation {
  kind: ErrorKind;
  message: string;
  /** The i18n key `message` came from, for tests and logging. */
  key: string;
  status?: number;
  code?: string;
  fields?: Readonly<Record<string, string>>;
}
export type Posture = '403' | '404';

export function presentError(
  error: unknown,
  t: (key: string) => string,
  posture: Posture,
): ErrorPresentation {
  const make = (kind: ErrorKind, key: string, extra: Partial<ErrorPresentation> = {}) => ({
    kind,
    key,
    message: t(key),
    ...extra,
  });
  if (isHttpError(error)) {
    const extra: Partial<ErrorPresentation> = { status: error.status, code: error.code };
    if (error.fields) extra.fields = error.fields;
    switch (error.status) {
      case 401:
        return make('redirect', 'error.unauthorized', extra);
      case 403:
        return posture === '403'
          ? make('forbidden', 'error.forbidden', extra)
          : make('empty', 'error.notFound', extra);
      case 404:
        return make('empty', 'error.notFound', extra);
      case 409:
        return make('retry', 'error.conflict', extra);
      case 412:
        return make('retry', 'error.stale', extra);
      case 422:
        return make('alert', 'error.validation', extra);
      case 429:
        return make('retry', 'error.rateLimited', extra);
      default:
        return error.status >= 500
          ? make('alert', 'error.server', extra)
          : make('alert', 'error.unknown', extra);
    }
  }
  if (error instanceof RegistryError) return make('alert', 'error.registry', { code: error.code });
  if (error instanceof TypeError) return make('alert', 'error.network');
  return make('alert', 'error.unknown');
}

/** Maps any error to what the page renders; a 401 that the client has not yet handled redirects once. */
export function useErrorPresentation(): (error: unknown) => ErrorPresentation {
  const { auth, model } = useServices();
  const { t } = useI18n();
  const posture: Posture = model?.posture ?? '404';
  return useCallback(
    (error: unknown) => {
      if (isHttpError(error) && error.status === 401 && !error.unauthorizedHandled) {
        error.unauthorizedHandled = true;
        auth.onUnauthorized();
      }
      return presentError(error, t, posture);
    },
    [auth, t, posture],
  );
}
