/**
 * Generated from the renderer manifest (`stories` in @star-board/renderer-mui) by
 * `pnpm -F @star-board/storybook generate:stories`; do not edit. A test diffs this file against
 * the generator, so a manifest change without regeneration fails `pnpm test`.
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DateTimeField } from '@star-board/renderer-mui';
import { storyArgs } from '../generated-stories.js';

const KEY = 'field.datetime';

const meta: Meta = {
  title: 'Contract/field/datetime',
  component: DateTimeField,
  parameters: { starBoard: { key: KEY } },
};
export default meta;

export const Default: StoryObj = { name: 'Default', args: storyArgs(KEY, 'default') };
export const WithError: StoryObj = { name: 'With error', args: storyArgs(KEY, 'error') };
export const Disabled: StoryObj = { name: 'Disabled', args: storyArgs(KEY, 'disabled') };
