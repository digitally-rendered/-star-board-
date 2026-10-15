/*
 * The example's language switch (typescript/05 §7): `?lang=<tag>` picks a locale and a translation
 * table. The tables here are a smoke test of the key-based pipeline (generated keys, renderer keys
 * and runtime keys all override by key); a product loads reviewed translations instead.
 */

export interface LocaleChoice {
  locale: string;
  messages: Record<string, string>;
}

/** Translations by language tag; `en` is the generated defaults, so it needs no table. */
export const TRANSLATIONS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  fr: {
    'pet.nav.label': 'Animaux',
    'pet.screen.list.title': 'Liste des animaux',
    'pet.screen.create.title': 'Nouvel animal',
    'pet.screen.detail.title': 'Fiche animal',
    'pet.screen.edit.title': 'Modifier l’animal',
    'pet.field.name.label': 'Nom',
    'pet.field.species.label': 'Espèce',
    'pet.field.status.label': 'Statut',
    'pet.action.pet_create.label': 'Créer',
    'common.open': 'Ouvrir',
    'list.open': 'Ouvrir',
    'common.cancel': 'Annuler',
    'common.empty': 'Rien à afficher pour le moment',
    'screen.skipToContent': 'Aller au contenu principal',
    'unsaved.title': 'Quitter sans enregistrer ?',
    'unsaved.stay': 'Continuer la saisie',
    'unsaved.leave': 'Quitter',
  },
};

export const DEFAULT_LANGUAGE = 'en';

/** The `lang` query parameter when it names a known table; `en` (no overrides) otherwise. */
export function localeFromSearch(search: string): LocaleChoice {
  const lang = new URLSearchParams(search).get('lang') ?? DEFAULT_LANGUAGE;
  const messages = TRANSLATIONS[lang];
  return messages === undefined
    ? { locale: DEFAULT_LANGUAGE, messages: {} }
    : { locale: lang, messages: { ...messages } };
}
