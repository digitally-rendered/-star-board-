/**
 * Generated from the renderer manifest (`stories` in @star-board/renderer-mui) by
 * `pnpm -F @star-board/storybook generate:stories`; do not edit. A test diffs this file against
 * the generator, so a manifest change without regeneration fails `pnpm test`.
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { NumberCell } from '@star-board/renderer-mui';
import { storyArgs } from '../generated-stories.js';

const KEY = 'list.column.number';

const meta: Meta = {
  title: 'Contract/list/column/number',
  component: NumberCell,
  parameters: { starBoard: { key: KEY } },
};
export default meta;

export const Default: StoryObj = { name: 'Default', args: storyArgs(KEY, 'default') };
