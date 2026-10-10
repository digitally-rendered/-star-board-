import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createI18n, I18nProvider, RUNTIME_DEFAULT_MESSAGES, useI18n } from './createI18n.js';

describe('createI18n', () => {
  const defaults = {
    'pet.title': 'Pets',
    'pet.count': '{n} pets',
    'pet.hello': 'Hello {name}, {missing}',
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

  it('extend layers translations without mutating the parent', () => {
    const base = createI18n(defaults);
    const extended = base.extend({ 'pet.title': 'Haustiere' });
    expect(extended.t('pet.title')).toBe('Haustiere');
    expect(base.t('pet.title')).toBe('Pets');
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
  });
});
