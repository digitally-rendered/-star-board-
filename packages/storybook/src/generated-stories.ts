import type { ComponentKey } from '@star-board/core';
import * as renderer from '@star-board/renderer-mui';
import { EmptyState, LoadingState, stories as manifest } from '@star-board/renderer-mui';
import type { ManifestEntry } from '@star-board/renderer-mui';
import { createElement, type ElementType } from 'react';

/**
 * The renderer manifest (`stories` in @star-board/renderer-mui: one `{ key, component,
 * defaultProps }` per contract key) turned into CSF3 stories: one file per key, one story per
 * state. ESM exports are static, so this module does not export stories itself; it produces the
 * data and the source text of `src/stories/<key>.stories.tsx`, which `scripts/gen-stories.ts`
 * writes and a test keeps in step with the manifest. The generated files call back into
 * {@link storyArgs} at runtime, so props that are functions or React elements never need to be
 * serialised.
 *
 * This module is loaded by plain Node from the generation script, so it imports only packages,
 * never a sibling source file.
 */

export const STORY_STATES = [
  'default',
  'error',
  'disabled',
  'loading',
  'empty',
  'destructive',
] as const;
export type StoryState = (typeof STORY_STATES)[number];

interface StateSpec {
  readonly exportName: string;
  readonly name: string;
}

const STATE_SPECS: Readonly<Record<StoryState, StateSpec>> = {
  default: { exportName: 'Default', name: 'Default' },
  error: { exportName: 'WithError', name: 'With error' },
  disabled: { exportName: 'Disabled', name: 'Disabled' },
  loading: { exportName: 'Loading', name: 'Loading' },
  empty: { exportName: 'Empty', name: 'Empty' },
  destructive: { exportName: 'Destructive', name: 'Destructive' },
};

/** Keys whose shell shows a list body: loading and empty are states of that body. */
const LIST_SCREENS: readonly ComponentKey[] = ['screen.list', 'screen.grid'];

/** The states a key gets a story for; `default` always comes first. */
export function statesFor(key: ComponentKey): readonly StoryState[] {
  if (key.startsWith('field.')) return ['default', 'error', 'disabled'];
  if (key.startsWith('action.')) return ['default', 'disabled', 'destructive'];
  if (LIST_SCREENS.includes(key)) return ['default', 'loading', 'empty'];
  return ['default'];
}

export function manifestEntry(key: ComponentKey, entries: readonly ManifestEntry[] = manifest) {
  const entry = entries.find((e) => e.key === key);
  if (!entry) throw new Error(`no renderer manifest entry for ${key}`);
  return entry;
}

/** Prop overrides per state over the manifest's resting props. */
function stateOverrides(state: StoryState): Readonly<Record<string, unknown>> {
  switch (state) {
    case 'default':
      return {};
    case 'error':
      return { error: 'This value is not valid.' };
    case 'disabled':
      return { disabled: true };
    case 'destructive':
      return { destructive: true, confirm: 'This cannot be undone. Continue?' };
    case 'loading':
      return { children: createElement(LoadingState, { title: 'Loading' }) };
    case 'empty':
      return { children: createElement(EmptyState, { title: 'Nothing here yet' }) };
  }
}

/** The args of one story: the manifest's resting props with the state's overrides applied. */
export function storyArgs(
  key: ComponentKey,
  state: StoryState,
  entries: readonly ManifestEntry[] = manifest,
): Record<string, unknown> {
  if (!statesFor(key).includes(state)) throw new Error(`${key} has no ${state} story`);
  return { ...manifestEntry(key, entries).defaultProps, ...stateOverrides(state) };
}

/** `field.text` → `Contract/field/text`: one Storybook folder level per key segment. */
export function storyTitle(key: ComponentKey): string {
  return `Contract/${key.replaceAll('.', '/')}`;
}

/** Storybook's `sanitize`: lower-case, punctuation and spaces to single dashes, trimmed. */
function sanitize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ ’–—―′¿'`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The id Storybook assigns: `toId(title, storyNameFromExport(exportName))`, where the export name
 * is split at camel-case boundaries. The custom `name` does not take part.
 */
export function storyId(title: string, exportName: string): string {
  const words = exportName.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return `${sanitize(title)}--${sanitize(words)}`;
}

/** The renderer export that is this component, found by identity (factory-made components have no usable `name`). */
export function componentExportName(component: ElementType): string {
  const hit = Object.entries(renderer as Record<string, unknown>).find(([, v]) => v === component);
  if (!hit) throw new Error('manifest component is not a named export of @star-board/renderer-mui');
  return hit[0];
}

export interface GeneratedStory {
  readonly key: ComponentKey;
  readonly state: StoryState;
  readonly exportName: string;
  readonly name: string;
  readonly storyId: string;
}

export interface GeneratedStoryFile {
  readonly key: ComponentKey;
  readonly title: string;
  /** Named export of @star-board/renderer-mui that renders the key. */
  readonly componentName: string;
  /** Relative to `src/`. */
  readonly fileName: string;
  readonly stories: readonly GeneratedStory[];
}

/** Every manifest entry as a story file description, in manifest order. */
export function generatedStories(
  entries: readonly ManifestEntry[] = manifest,
): GeneratedStoryFile[] {
  return entries.map((entry) => {
    const title = storyTitle(entry.key);
    return {
      key: entry.key,
      title,
      componentName: componentExportName(entry.component),
      fileName: `stories/${entry.key}.stories.tsx`,
      stories: statesFor(entry.key).map((state) => ({
        key: entry.key,
        state,
        exportName: STATE_SPECS[state].exportName,
        name: STATE_SPECS[state].name,
        storyId: storyId(title, STATE_SPECS[state].exportName),
      })),
    };
  });
}

/** The CSF3 source of one story file; formatted to the repository's Prettier settings. */
export function renderStoriesFile(file: GeneratedStoryFile): string {
  const stories = file.stories
    .map(
      (s) =>
        `export const ${s.exportName}: StoryObj = { name: '${s.name}', args: storyArgs(KEY, '${s.state}') };`,
    )
    .join('\n');
  return `/**
 * Generated from the renderer manifest (\`stories\` in @star-board/renderer-mui) by
 * \`pnpm -F @star-board/storybook generate:stories\`; do not edit. A test diffs this file against
 * the generator, so a manifest change without regeneration fails \`pnpm test\`.
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ${file.componentName} } from '@star-board/renderer-mui';
import { storyArgs } from '../generated-stories.js';

const KEY = '${file.key}';

const meta: Meta = {
  title: '${file.title}',
  component: ${file.componentName},
  parameters: { starBoard: { key: KEY } },
};
export default meta;

${stories}
`;
}
