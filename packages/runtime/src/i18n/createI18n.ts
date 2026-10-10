import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';

/**
 * Key-based strings (typescript/05 §7). The generator emits `i18n.defaults.json`; a translation
 * table overrides by key, and an unknown key falls back to the default text, then to the key.
 * Plural forms, dates and numbers go through `Intl` with the instance's locale, so a consumer
 * switches language by handing `I18nProvider` a `locale` and a `messages` map.
 */
export type Vars = Record<string, string | number>;

export interface Translate {
  (key: string, vars?: Vars): string;
  /**
   * `key.<category>` by `Intl.PluralRules` (`one`, `other`, …), `key.zero` for an exact 0 when
   * present, falling back to `key.other` then `key`; `{count}` is interpolated.
   */
  plural(key: string, count: number, vars?: Vars): string;
  /** A date, ISO string or epoch through `Intl.DateTimeFormat`; an invalid value is returned as text. */
  date(value: Date | string | number, options?: Intl.DateTimeFormatOptions): string;
  /** `Intl.NumberFormat` in the instance's locale. */
  number(value: number, options?: Intl.NumberFormatOptions): string;
  /** The BCP 47 tag the formatters use. */
  readonly locale: string;
}

export interface I18n {
  t: Translate;
  readonly locale: string;
  /** A new instance layering `translations` over these defaults, in `locale` when given. */
  extend(translations: Record<string, string>, locale?: string): I18n;
  has(key: string): boolean;
}

export interface I18nOptions {
  /** Default: the runtime's locale (`navigator.language` in a browser), else `en`. */
  locale?: string;
}

export const DEFAULT_LOCALE = 'en';

function interpolate(text: string, vars: Vars | undefined): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/** `navigator.language` where there is one, else `en`; a malformed tag falls back too. */
export function defaultLocale(): string {
  const candidate =
    typeof navigator === 'object' && typeof navigator.language === 'string'
      ? navigator.language
      : DEFAULT_LOCALE;
  try {
    return new Intl.Locale(candidate).toString();
  } catch {
    return DEFAULT_LOCALE;
  }
}

const DEFAULT_DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };

export function createI18n(
  defaults: Record<string, string>,
  translations: Record<string, string> = {},
  options: I18nOptions = {},
): I18n {
  const table: Record<string, string> = { ...defaults, ...translations };
  const locale = options.locale ?? defaultLocale();
  const has = (key: string): boolean => key in table;
  const translate = (key: string, vars?: Vars): string => interpolate(table[key] ?? key, vars);
  const rules = new Intl.PluralRules(locale);
  const plural = (key: string, count: number, vars?: Vars): string => {
    const candidates = [
      ...(count === 0 ? [`${key}.zero`] : []),
      `${key}.${rules.select(count)}`,
      `${key}.other`,
      key,
    ];
    const found = candidates.find(has) ?? key;
    return translate(found, { count, ...vars });
  };
  const date = (value: Date | string | number, format?: Intl.DateTimeFormatOptions): string => {
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return new Intl.DateTimeFormat(locale, format ?? DEFAULT_DATE_FORMAT).format(parsed);
  };
  const number = (value: number, format?: Intl.NumberFormatOptions): string =>
    new Intl.NumberFormat(locale, format).format(value);
  const t: Translate = Object.assign(translate, { plural, date, number, locale });
  return {
    t,
    locale,
    has,
    extend: (more, nextLocale) => createI18n(table, more, { locale: nextLocale ?? locale }),
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

export interface I18nProviderProps {
  /** The instance to serve; default: the nearest provider's (or the runtime defaults). */
  i18n?: I18n;
  /** Switches the formatters' locale for everything below. */
  locale?: string;
  /** Message overrides by key, layered over `i18n` (or the inherited instance). */
  messages?: Record<string, string>;
  children?: ReactNode;
}

/**
 * Serves one `I18n` to the tree. `locale` and `messages` derive a new instance from `i18n` or the
 * inherited one, so a nested provider can switch language for a sub-tree without rebuilding the
 * table.
 */
export function I18nProvider(props: I18nProviderProps) {
  const inherited = useContext(I18nContext);
  const base = props.i18n ?? inherited;
  const { locale, messages } = props;
  const value = useMemo(
    () =>
      locale === undefined && messages === undefined ? base : base.extend(messages ?? {}, locale),
    [base, locale, messages],
  );
  return createElement(I18nContext.Provider, { value }, props.children);
}

/** The nearest I18n; without a provider the runtime defaults apply. */
export function useI18n(): I18n {
  return useContext(I18nContext);
}
