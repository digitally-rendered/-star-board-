import type { ComponentRegistry } from '@star-board/core';
import type { HarnessOptions } from '@star-board/testing/harness';
import { createAppTheme } from './app.js';
import { registerPetOverrides } from './features/pet/index.js';
import { registerGenerated } from './generated/registry.js';
import i18nDefaults from './generated/i18n.defaults.json' with { type: 'json' };
import { asPetId, type Pet } from './generated/domain/pet/types.js';
import { PetDocumentSchema } from './generated/domain/pet/schemas.js';
import { MODEL } from './model.js';

/*
 * Shared test wiring: the harness options the example tests pass, with or without the overrides.
 * Not a test file itself; the tests import it.
 */

const theme = createAppTheme();

/** The generated screens only: what `star-board generate` gives before any override. */
export function registerDefaultsOnly(registry: ComponentRegistry): void {
  registerGenerated(registry);
}

/** The generated screens plus `src/features/pet`: what the app registers. */
export function registerWithOverrides(registry: ComponentRegistry): void {
  registerGenerated(registry);
  registerPetOverrides(registry);
}

export function harnessOptions(
  register: (registry: ComponentRegistry) => void = registerDefaultsOnly,
): HarnessOptions {
  return { model: MODEL, register, messages: i18nDefaults, theme };
}

/** A fixture row as the typed Document: validated by the generated zod schema, id branded. */
export function toPet(row: unknown): Pet {
  const parsed = PetDocumentSchema.parse(row);
  return { ...parsed, entity_id: asPetId(parsed.entity_id) };
}
