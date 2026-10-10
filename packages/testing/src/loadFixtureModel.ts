import type { FeatureModel } from '@star-board/core';
import { loadDocument } from '@star-board/spec';

/** The workspace `fixtures/` folder, resolved from this source file (a workspace-only helper). */
export const FIXTURES_URL = new URL('../../../fixtures/', import.meta.url);

/** Loads `fixtures/<name>.json` through the spec loader, so the result fails closed like production. */
export function loadFixtureModel(name = 'petstore'): FeatureModel {
  return loadDocument(new URL(`${name}.json`, FIXTURES_URL));
}
