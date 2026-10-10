/** @star-board/core — L0. Component contract keys, registry with scope resolution, FeatureModel types, errors. No React, no renderer. */
export const PACKAGE = '@star-board/core' as const;
export const LAYER = 'L0' as const;
export * from './errors/index.js';
export * from './contract/keys.js';
export * from './registry/registry.js';
export * from './model/feature-model.js';
