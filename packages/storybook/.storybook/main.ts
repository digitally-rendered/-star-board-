import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Vite's documented default client conditions; `resolve.conditions` replaces rather than extends
 * them, so they are re-added behind the workspace source condition.
 */
const VITE_DEFAULT_CONDITIONS = ['module', 'browser', 'development|production'];

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.tsx'],
  addons: ['@storybook/addon-a11y'],
  // Resolve workspace packages to their sources (the same condition tsconfig.base.json and the
  // vitest configs use) so `storybook dev` tracks the renderer without a prior `pnpm build`.
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    resolve: {
      ...viteConfig.resolve,
      conditions: [
        'star-board-source',
        ...(viteConfig.resolve?.conditions ?? VITE_DEFAULT_CONDITIONS),
      ],
    },
  }),
};

export default config;
