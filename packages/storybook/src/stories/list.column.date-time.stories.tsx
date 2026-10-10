/**
 * Generated from the renderer manifest (`stories` in @star-board/renderer-mui) by
 * `pnpm -F @star-board/storybook generate:stories`; do not edit. A test diffs this file against
 * the generator, so a manifest change without regeneration fails `pnpm test`.
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DateTimeCell } from '@star-board/renderer-mui';
import { storyArgs } from '../generated-stories.js';

const KEY = 'list.column.date-time';

const meta: Meta = {
  title: 'Contract/list/column/date-time',
  component: DateTimeCell,
  parameters: { starBoard: { key: KEY } },
};
export default meta;

export const Default: StoryObj = { name: 'Default', args: storyArgs(KEY, 'default') };
