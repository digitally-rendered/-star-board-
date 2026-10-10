import { TOKENS_STYLE_ATTRIBUTE } from '@star-board/renderer-mui';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { manifestEntry, storyArgs } from '../generated-stories.js';
import {
  createStoryEnvironment,
  STORY_ROOT_TEST_ID,
  storyRootAttributes,
  withStarBoard,
} from './withStarBoard.js';

/** A story the way Storybook hands it to a decorator: a function returning the rendered component. */
function story(key: 'field.text' | 'action.delete', state: 'default' | 'error' | 'disabled') {
  const entry = manifestEntry(key);
  return () => createElement(entry.component, storyArgs(key, state));
}

afterEach(() => {
  document.documentElement.removeAttribute('data-mode');
  document.documentElement.removeAttribute('data-density');
});

describe('withStarBoard', () => {
  it('renders a field story in its error state under the providers and the theme', () => {
    render(withStarBoard(story('field.text', 'error'), { globals: {} }));
    expect(screen.getByTestId('field-text')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('This value is not valid.');
    const root = screen.getByTestId(STORY_ROOT_TEST_ID);
    expect(root.getAttribute('data-mode')).toBe('light');
    expect(root.hasAttribute('data-density')).toBe(false);
    const style = root.querySelector(`style[${TOKENS_STYLE_ATTRIBUTE}]`);
    expect(style?.textContent).toContain('[data-mode="dark"] {');
    expect(style?.textContent).toContain('[data-density="dense"] {');
    expect(document.documentElement.getAttribute('data-mode')).toBe('light');
  });

  it('writes the mode and density globals on the story root and the document root', () => {
    render(
      withStarBoard(story('action.delete', 'default'), {
        globals: { mode: 'dark', density: 'dense' },
      }),
    );
    expect(screen.getByTestId('action-thing_delete')).toBeTruthy();
    const root = screen.getByTestId(STORY_ROOT_TEST_ID);
    expect(root.getAttribute('data-mode')).toBe('dark');
    expect(root.getAttribute('data-density')).toBe('dense');
    expect(document.documentElement.getAttribute('data-mode')).toBe('dark');
    expect(document.documentElement.getAttribute('data-density')).toBe('dense');
  });

  it('falls back to the default axes for missing or malformed globals', () => {
    expect(storyRootAttributes({})).toEqual({ 'data-mode': 'light' });
    expect(storyRootAttributes({ mode: 3, density: null })).toEqual({ 'data-mode': 'light' });
    expect(storyRootAttributes({ mode: 'high-contrast', density: 'default' })).toEqual({
      'data-mode': 'high-contrast',
    });
  });

  it('builds the environment from the reference tokens with every default registered', () => {
    const env = createStoryEnvironment();
    expect(env.registry.resolve('field.text', 'pet', 'create', {}).source).toBe('generated');
    expect(env.i18n.has('action.confirmDelete')).toBe(true);
    expect(env.i18n.has('error.forbidden')).toBe(true);
    expect(Object.keys(env.cssVariables)).toContain('[data-mode="high-contrast"]');
    expect(() => createStoryEnvironment({ not: 'tokens' })).toThrow();
  });
});
