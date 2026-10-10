import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FeatureModel } from '@star-board/core';
import { loadDocument } from '@star-board/spec';

/** The workspace `fixtures/` folder, resolved from this source file (a workspace-only helper). */
export const FIXTURES_DIR = resolve(import.meta.dirname, '../../../fixtures');
export const FIXTURES_URL = pathToFileURL(`${FIXTURES_DIR}/`);

/** Loads `fixtures/<name>.json` through the spec loader, so the result fails closed like production. */
export function loadFixtureModel(name = 'petstore'): FeatureModel {
  return loadDocument(join(FIXTURES_DIR, `${name}.json`));
}
