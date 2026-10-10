/**
 * Generated from the renderer manifest (`stories` in @star-board/renderer-mui) by
 * `pnpm -F @star-board/storybook generate:stories`; do not edit. A test diffs this file against
 * the generator, so a manifest change without regeneration fails `pnpm test`.
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { GridScreen } from '@star-board/renderer-mui';
import { storyArgs } from '../generated-stories.js';

const KEY = 'screen.grid';

const meta: Meta = {
  title: 'Contract/screen/grid',
  component: GridScreen,
  parameters: { starBoard: { key: KEY } },
};
export default meta;

export const Default: StoryObj = { name: 'Default', args: storyArgs(KEY, 'default') };
export const Loading: StoryObj = { name: 'Loading', args: storyArgs(KEY, 'loading') };
export const Empty: StoryObj = { name: 'Empty', args: storyArgs(KEY, 'empty') };
