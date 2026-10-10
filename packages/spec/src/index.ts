/** @star-board/spec — L1. OpenAPI 3.1 document loader producing a validated FeatureModel; fails closed on a missing extension. */
export const PACKAGE = '@star-board/spec' as const;
export const LAYER = 'L1' as const;
export { loadDocument } from './loader/load-document.js';
export { MAX_REF_DEPTH, REF_PREFIX, resolveSchema } from './loader/refs.js';
