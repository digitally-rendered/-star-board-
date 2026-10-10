/**
 * Generated from the renderer manifest (`stories` in @star-board/renderer-mui) by
 * `pnpm -F @star-board/storybook generate:stories`; do not edit. A test diffs this file against
 * the generator, so a manifest change without regeneration fails `pnpm test`.
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DeleteAction } from '@star-board/renderer-mui';
import { storyArgs } from '../generated-stories.js';

const KEY = 'action.delete';

const meta: Meta = {
  title: 'Contract/action/delete',
  component: DeleteAction,
  parameters: { starBoard: { key: KEY } },
};
export default meta;

export const Default: StoryObj = { name: 'Default', args: storyArgs(KEY, 'default') };
export const Disabled: StoryObj = { name: 'Disabled', args: storyArgs(KEY, 'disabled') };
export const Destructive: StoryObj = { name: 'Destructive', args: storyArgs(KEY, 'destructive') };
