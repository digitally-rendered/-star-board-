import type { Decorator, Preview } from '@storybook/react-vite';
import { withStarBoard } from '../src/preview/withStarBoard.js';

/** Adapts the framework-neutral decorator to Storybook's React decorator type. */
const starBoardDecorator: Decorator = (Story, context) =>
  withStarBoard(() => <Story />, { globals: context.globals });
import { DEFAULT_DENSITY, DEFAULT_MODE, DENSITIES, MODES } from '../src/visual/matrix.js';

/**
 * Every story renders inside the runtime providers and the tokens theme (see `withStarBoard`).
 * The toolbar globals `mode` and `density` are the two token axes; the decorator writes them as
 * `data-mode` / `data-density` on the story root so the token CSS blocks apply.
 */
const preview: Preview = {
  decorators: [starBoardDecorator],
  globalTypes: {
    mode: {
      description: 'Colour-scheme mode (tokens `data-mode`)',
      toolbar: { title: 'Mode', icon: 'mirror', items: [...MODES], dynamicTitle: true },
    },
    density: {
      description: 'Density (tokens `data-density`)',
      toolbar: { title: 'Density', icon: 'component', items: [...DENSITIES], dynamicTitle: true },
    },
  },
  initialGlobals: { mode: DEFAULT_MODE, density: DEFAULT_DENSITY },
  parameters: {
    a11y: { test: 'error' },
  },
};

export default preview;
