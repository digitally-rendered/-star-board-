import { createContext, createElement, useContext, type ReactNode } from 'react';

/**
 * Key-based strings (typescript/05 §7). The generator emits `i18n.defaults.json`; a translation
 * table overrides by key, and an unknown key falls back to the default text, then to the key.
 */
export type Translate = (key: string, vars?: Record<string, string | number>) => string;
export interface I18n {
  t: Translate;
  /** A new instance layering `translations` over these defaults. */
  extend(translations: Record<string, string>): I18n;
  has(key: string): boolean;
}

function interpolate(text: string, vars: Record<string, string | number> | undefined): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

export function createI18n(
  defaults: Record<string, string>,
  translations: Record<string, string> = {},
): I18n {
  const table: Record<string, string> = { ...defaults, ...translations };
  const t: Translate = (key, vars) => interpolate(table[key] ?? key, vars);
  return {
    t,
    has: (key) => key in table,
    extend: (more) => createI18n(table, more),
  };
}

/** Strings the runtime itself needs; a consumer overrides any of them by key. */
export const RUNTIME_DEFAULT_MESSAGES: Readonly<Record<string, string>> = {
  'error.unauthorized': 'Your session has ended. Please sign in again.',
  'error.forbidden': 'You do not have permission to do this.',
  'error.notFound': 'Nothing to show here.',
  'error.stale': 'This record changed since you opened it. Reload to continue.',
  'error.validation': 'Please correct the highlighted fields.',
  'error.conflict': 'This change conflicts with another. Reload and try again.',
  'error.rateLimited': 'Too many requests. Please wait a moment.',
  'error.server': 'Something went wrong on our side. Please try again.',
  'error.network': 'We could not reach the server. Check your connection and retry.',
  'error.registry': 'This screen is not available.',
  'error.unknown': 'Something went wrong.',
};

const I18nContext = createContext<I18n>(createI18n({ ...RUNTIME_DEFAULT_MESSAGES }));

export function I18nProvider(props: { i18n: I18n; children?: ReactNode }) {
  return createElement(I18nContext.Provider, { value: props.i18n }, props.children);
}

/** The nearest I18n; without a provider the runtime defaults apply. */
export function useI18n(): I18n {
  return useContext(I18nContext);
}
