import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { COMPONENT_KEYS } from '@star-board/core';
import * as renderer from '@star-board/renderer-mui';
import { stories as manifest } from '@star-board/renderer-mui';
import { LIST_COLUMN_TYPES } from '@star-board/tokens';
import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import {
  generatedStories,
  renderStoriesFile,
  statesFor,
  storyArgs,
  storyId,
  storyTitle,
} from './generated-stories.js';

// jsdom rewrites `import.meta.url` to http, so paths come from `import.meta.dirname`.
const SRC = import.meta.dirname;
const files = generatedStories();
const everyKey = [...COMPONENT_KEYS, ...LIST_COLUMN_TYPES.map((t) => `list.column.${t}` as const)];

describe('generatedStories', () => {
  it('yields one story file per manifest entry, each with a Default story first', () => {
    expect(files.map((f) => f.key)).toEqual(manifest.map((e) => e.key));
    for (const file of files) {
      expect(file.stories.length).toBeGreaterThanOrEqual(1);
      expect(file.stories[0]?.state).toBe('default');
      expect(file.stories[0]?.exportName).toBe('Default');
    }
  });

  it("covers every key in core's COMPONENT_KEYS plus list.column.<type> over LIST_COLUMN_TYPES", () => {
    const covered = new Set(files.map((f) => f.key));
    for (const key of everyKey) expect(covered.has(key), key).toBe(true);
    expect(covered.size).toBe(everyKey.length);
  });

  it('adds the states each key kind needs', () => {
    expect(statesFor('field.text')).toEqual(['default', 'error', 'disabled']);
    expect(statesFor('action.create')).toEqual(['default', 'disabled', 'destructive']);
    expect(statesFor('screen.list')).toEqual(['default', 'loading', 'empty']);
    expect(statesFor('screen.grid')).toEqual(['default', 'loading', 'empty']);
    expect(statesFor('screen.detail')).toEqual(['default']);
    expect(statesFor('list.column.string')).toEqual(['default']);
    expect(statesFor('state.empty')).toEqual(['default']);
    expect(statesFor('help.inline')).toEqual(['default']);
  });

  it('names the renderer export that is the manifest component', () => {
    const exports = renderer as Record<string, unknown>;
    for (const [file, entry] of files.map((f, i) => [f, manifest[i]] as const)) {
      expect(exports[file.componentName], file.key).toBe(entry?.component);
    }
  });

  it('builds story ids the way Storybook does and unique across the matrix', () => {
    expect(storyTitle('list.column.date-time')).toBe('Contract/list/column/date-time');
    expect(storyId('Contract/list/column/date-time', 'WithError')).toBe(
      'contract-list-column-date-time--with-error',
    );
    const ids = files.flatMap((f) => f.stories.map((s) => s.storyId));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^contract-[a-z0-9-]+--[a-z0-9-]+$/);
  });
});

describe('storyArgs', () => {
  it('layers the state over the manifest props', () => {
    expect(storyArgs('field.text', 'default')).toEqual(
      manifest.find((e) => e.key === 'field.text')?.defaultProps,
    );
    expect(storyArgs('field.text', 'error')).toMatchObject({ error: expect.any(String) });
    expect(storyArgs('field.number', 'disabled')).toMatchObject({ disabled: true });
    expect(storyArgs('action.custom', 'destructive')).toMatchObject({
      destructive: true,
      confirm: expect.any(String),
    });
    expect(isValidElement(storyArgs('screen.list', 'loading').children)).toBe(true);
    expect(isValidElement(storyArgs('screen.grid', 'empty').children)).toBe(true);
  });

  it('rejects a state the key has no story for and an unknown key', () => {
    expect(() => storyArgs('state.empty', 'error')).toThrow(/no error story/);
    expect(() => storyArgs('list.column.unknown', 'default')).toThrow(/no renderer manifest entry/);
  });
});

describe('committed story files', () => {
  it('match the generator output (regenerate with `generate:stories` or `vitest run -u`)', async () => {
    for (const file of files) {
      await expect(renderStoriesFile(file)).toMatchFileSnapshot(resolve(SRC, file.fileName));
    }
  });

  it('exist for every key and for nothing else', () => {
    const expected = files.map((f) => f.fileName.replace(/^stories\//, '')).sort();
    const dir = resolve(SRC, 'stories');
    expect(existsSync(dir)).toBe(true);
    const actual = readdirSync(dir)
      .filter((n) => n.endsWith('.stories.tsx'))
      .sort();
    expect(actual).toEqual(expected);
  });
});
