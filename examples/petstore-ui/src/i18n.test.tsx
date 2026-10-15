// @vitest-environment jsdom
import { RENDERER_DEFAULT_MESSAGES } from '@star-board/renderer-mui';
import { RUNTIME_DEFAULT_MESSAGES } from '@star-board/runtime';
import { fixtures } from '@star-board/testing';
import { renderGeneratedScreen, renderRoutes } from '@star-board/testing/harness';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { appRoutes, createAppI18n } from './app.js';
import { PET_LIST_COLUMNS } from './generated/domain/pet/columns.js';
import type { PetListScreenProps } from './generated/domain/pet/PetListScreen.js';
import i18nDefaults from './generated/i18n.defaults.json' with { type: 'json' };
import { localeFromSearch, TRANSLATIONS } from './i18n/locale.js';
import { MODEL } from './model.js';
import { harnessOptions, toPet } from './testing.js';

/*
 * The locale switch smoke test (typescript/05 §7): `?lang=fr` picks a table and a locale, every
 * generated string follows because it is a key read through the provider, and the formatters use
 * the locale. The translation tables name only keys that exist.
 */

const pets = fixtures(MODEL, 'pet', 2, { seed: 13 }).map(toPet);

describe('?lang= locale switch', () => {
  it('picks a known table and falls back to en for unknown or missing languages', () => {
    expect(localeFromSearch('?lang=fr')).toEqual({ locale: 'fr', messages: TRANSLATIONS.fr });
    expect(localeFromSearch('?lang=xx')).toEqual({ locale: 'en', messages: {} });
    expect(localeFromSearch('')).toEqual({ locale: 'en', messages: {} });
  });

  it('every translated key exists among the generated, renderer and runtime defaults', () => {
    const known = new Set([
      ...Object.keys(RUNTIME_DEFAULT_MESSAGES),
      ...Object.keys(RENDERER_DEFAULT_MESSAGES),
      ...Object.keys(i18nDefaults),
    ]);
    for (const table of Object.values(TRANSLATIONS)) {
      const unknown = Object.keys(table).filter((key) => !known.has(key));
      expect(unknown).toEqual([]);
    }
  });

  it('createAppI18n layers the table over the defaults and formats in the locale', () => {
    const fr = createAppI18n(TRANSLATIONS.fr, 'fr');
    expect(fr.t('pet.screen.list.title')).toBe('Liste des animaux');
    expect(fr.t('common.back')).toBe('Back');
    expect(fr.t('error.unknown')).toBe(RUNTIME_DEFAULT_MESSAGES['error.unknown']);
    expect(fr.t.number(1234.5)).toBe(new Intl.NumberFormat('fr').format(1234.5));
    expect(createAppI18n().t('pet.screen.list.title')).toBe('Pet list');
  });

  it('a generated screen renders in French under a French provider', () => {
    const { locale, messages } = localeFromSearch('?lang=fr');
    const props: PetListScreenProps = {
      status: 'ready',
      error: undefined,
      rows: pets,
      columns: PET_LIST_COLUMNS,
      compact: false,
      page: { page: 1, pageSize: 25, total: pets.length },
      sort: undefined,
      filters: {},
      onPage: vi.fn(),
      onSort: vi.fn(),
      onFilter: vi.fn(),
      retry: undefined,
      actions: [{ operationId: 'pet_create', label: 'x', disabled: false, onClick: vi.fn() }],
      onOpen: vi.fn(),
    };
    renderGeneratedScreen({
      ...harnessOptions(),
      locale,
      messages: { ...i18nDefaults, ...messages },
      screen: { key: 'screen.list', schema: 'pet', target: 'pet_list' },
      props,
    });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Liste des animaux');
    expect(screen.getByTestId('pet-list-sort-name').textContent).toBe('Nom');
    // The table body is the renderer's: its `list.open` key follows the table too.
    expect(screen.getAllByText('Ouvrir').length).toBeGreaterThan(0);
    // A key the French table lacks falls back to the generated default.
    expect(screen.getByTestId('pet-list-sort-notes').textContent).toBe('Notes');
  });

  it('the app frame follows the locale too: nav label and skip link', () => {
    const { locale, messages } = localeFromSearch('?lang=fr');
    renderRoutes({
      ...harnessOptions(),
      locale,
      messages: { ...i18nDefaults, ...messages },
      routes: appRoutes(),
      initialEntries: ['/pet'],
    });
    expect(screen.getByTestId('nav-pet').textContent).toBe('Animaux');
    expect(screen.getByTestId('skip-to-content').textContent).toBe('Aller au contenu principal');
    expect(screen.getByRole('navigation', { name: 'Navigation' })).toBeTruthy();
  });
});
