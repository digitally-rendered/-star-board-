import { SpecError } from '@star-board/core';

/** A parsed JSON object; the loader never trusts a shape it has not checked. */
export type JsonObject = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function invalid(
  message: string,
  details: Record<string, unknown>,
  options?: ErrorOptions,
): SpecError {
  return new SpecError('SPEC_INVALID', message, details, options);
}

/** The fail-closed error: names the extension and where it was expected (CLAUDE.md). */
export function missingExtension(extension: string, at: string): SpecError {
  return new SpecError(
    'SPEC_MISSING_EXTENSION',
    `Missing required extension ${extension} at ${at}`,
    { extension, at },
  );
}

export function requireRecord(value: unknown, at: string): JsonObject {
  if (!isRecord(value)) throw invalid(`Expected an object at ${at}`, { at });
  return value;
}

export function requireString(value: unknown, at: string): string {
  if (typeof value !== 'string') throw invalid(`Expected a string at ${at}`, { at });
  return value;
}

export function requireStringArray(value: unknown, at: string): string[] {
  if (!Array.isArray(value)) throw invalid(`Expected an array of strings at ${at}`, { at });
  const items: unknown[] = value;
  if (!items.every((item): item is string => typeof item === 'string')) {
    throw invalid(`Expected an array of strings at ${at}`, { at });
  }
  return items;
}

/** `PetOwner` → `pet_owner`; the FeatureModel keys schemas by snake_case name. */
export function toSnakeCase(pascal: string): string {
  return pascal
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}
