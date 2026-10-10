/** @star-board/testing — L5. Parity suite (document, generated code, MCP tool list), msw handlers from the document, screen test harness with axe, Playwright page objects, fixture documents. */
export const PACKAGE = '@star-board/testing' as const;
export const LAYER = 'L5' as const;
export { FIXTURES_URL, loadFixtureModel } from './loadFixtureModel.js';
export * from './parity/index.js';
export * from './msw/index.js';
export * from './e2e/index.js';
