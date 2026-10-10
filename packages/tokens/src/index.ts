/** @star-board/tokens — L1. Design tokens (DTCG JSON): schema, alias resolution, semantic lint, modes; a plain TypeScript build to the MUI CSS-variables theme input, Figma variables JSON, the component contract and the Code Connect map. No React, no MUI. */
export const PACKAGE = '@star-board/tokens' as const;
export const LAYER = 'L1' as const;
export * from './schema.js';
export * from './modes.js';
export * from './values.js';
export * from './lint.js';
export * from './build/contract.js';
export * from './build/code-connect.js';
export * from './build/css-variables.js';
export * from './build/mui-theme.js';
export * from './build/figma-variables.js';
export * from './build/index.js';
