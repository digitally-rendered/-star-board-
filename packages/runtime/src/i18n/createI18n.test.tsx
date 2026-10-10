import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  createI18n,
  defaultLocale,
  I18nProvider,
  RUNTIME_DEFAULT_MESSAGES,
  useI18n,
} from './createI18n.js';

describe('createI18n', () => {
  const defaults = {
    'pet.title': 'Pets',
    'pet.count': '{n} pets',
    'pet.hello': 'Hello {name}, {missing}',
    'pet.rows.one': '{count} row',
    'pet.rows.other': '{count} rows',
    'pet.rows.zero': 'No rows',
    'pet.items.other': '{count} items in {place}',
  };

  it('returns the default text, lets a translation override by key and falls back to the key', () => {
    const base = createI18n(defaults);
    expect(base.t('pet.title')).toBe('Pets');
    expect(base.t('pet.unknown')).toBe('pet.unknown');
    const fr = createI18n(defaults, { 'pet.title': 'Animaux' });
    expect(fr.t('pet.title')).toBe('Animaux');
    expect(fr.t('pet.count', { n: 3 })).toBe('3 pets');
    expect(fr.has('pet.title')).toBe(true);
    expect(fr.has('nope')).toBe(false);
  });

  it('interpolates {vars} and leaves unknown placeholders visible', () => {
    expect(createI18n(defaults).t('pet.hello', { name: 'Ada' })).toBe('Hello Ada, {missing}');
    expect(createI18n(defaults).t('pet.count')).toBe('{n} pets');
  });

  it('extend layers translations without mutating the parent and may switch locale', () => {
    const base = createI18n(defaults, {}, { locale: 'en' });
    const extended = base.extend({ 'pet.title': 'Haustiere' }, 'de');
    expect(extended.t('pet.title')).toBe('Haustiere');
    expect(extended.locale).toBe('de');
    expect(base.t('pet.title')).toBe('Pets');
    expect(base.locale).toBe('en');
    expect(base.extend({}).locale).toBe('en');
  });

  it('selects plural forms by Intl.PluralRules, with zero and other fallbacks', () => {
    const en = createI18n(defaults, {}, { locale: 'en' });
    expect(en.t.plural('pet.rows', 1)).toBe('1 row');
    expect(en.t.plural('pet.rows', 2)).toBe('2 rows');
    expect(en.t.plural('pet.rows', 0)).toBe('No rows');
    expect(en.t.plural('pet.items', 1, { place: 'stock' })).toBe('1 items in stock');
    expect(en.t.plural('pet.missing', 3)).toBe('pet.missing');
    // French counts 0 and 1 as `one`.
    const fr = createI18n(defaults, { 'pet.items.one': '{count} article' }, { locale: 'fr' });
    expect(fr.t.plural('pet.items', 1)).toBe('1 article');
  });

  it('formats dates and numbers in the instance locale', () => {
    const en = createI18n({}, {}, { locale: 'en-US' });
    const de = createI18n({}, {}, { locale: 'de-DE' });
    expect(en.t.number(1234.5)).toBe('1,234.5');
    expect(de.t.number(1234.5)).toBe('1.234,5');
    expect(en.t.number(0.5, { style: 'percent' })).toBe('50%');
    const when = new Date(Date.UTC(2024, 0, 2, 3, 4));
    expect(en.t.date(when, { dateStyle: 'medium', timeZone: 'UTC' })).toBe('Jan 2, 2024');
    expect(de.t.date(when.toISOString(), { dateStyle: 'medium', timeZone: 'UTC' })).toBe(
      '02.01.2024',
    );
    expect(en.t.date(when.getTime(), { dateStyle: 'short', timeZone: 'UTC' })).toBe('1/2/24');
    expect(en.t.date('not a date')).toBe('not a date');
    expect(en.t.locale).toBe('en-US');
    expect(typeof en.t.date(when)).toBe('string');
  });

  it('defaults the locale to a well-formed tag', () => {
    expect(() => new Intl.Locale(defaultLocale())).not.toThrow();
    expect(createI18n({}).locale).toBe(defaultLocale());
  });
});

describe('useI18n', () => {
  it('serves the runtime defaults without a provider and the provided instance with one', () => {
    expect(renderHook(() => useI18n()).result.current.t('error.unknown')).toBe(
      RUNTIME_DEFAULT_MESSAGES['error.unknown'],
    );
    const i18n = createI18n({ 'error.unknown': 'Oops' });
    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider i18n={i18n}>{children}</I18nProvider>,
    });
    expect(result.current.t('error.unknown')).toBe('Oops');
    expect(result.current).toBe(i18n);
  });

  it('derives a locale and messages override from the inherited instance', () => {
    const i18n = createI18n({ 'pet.title': 'Pets', 'x.one': '{count}' }, {}, { locale: 'en' });
    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => (
        <I18nProvider i18n={i18n}>
          <I18nProvider locale="de-DE" messages={{ 'pet.title': 'Haustiere' }}>
            {children}
          </I18nProvider>
        </I18nProvider>
      ),
    });
    expect(result.current.locale).toBe('de-DE');
    expect(result.current.t('pet.title')).toBe('Haustiere');
    expect(result.current.t('error.unknown')).toBe('error.unknown');
    expect(result.current.t.number(1.5)).toBe('1,5');
    expect(i18n.t('pet.title')).toBe('Pets');
  });
});
