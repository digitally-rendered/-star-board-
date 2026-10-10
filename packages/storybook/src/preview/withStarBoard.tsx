import { ComponentRegistry } from '@star-board/core';
import {
  createTheme,
  registerDefaults,
  RENDERER_DEFAULT_MESSAGES,
  ThemeRoot,
  type TokensTheme,
} from '@star-board/renderer-mui';
import {
  createI18n,
  I18nProvider,
  RegistryProvider,
  RUNTIME_DEFAULT_MESSAGES,
  type I18n,
} from '@star-board/runtime';
import {
  buildCssVariables,
  buildMuiThemeInput,
  parseTokens,
  REFERENCE_MODES,
  type CssVariables,
} from '@star-board/tokens';
import { useEffect, type ReactElement, type ReactNode } from 'react';
import referenceTokens from '../../../../tokens/reference.tokens.json' with { type: 'json' };
import { DEFAULT_DENSITY, DEFAULT_MODE } from '../visual/matrix.js';

/** What every story renders inside: the tokens theme, a registry of the defaults and the i18n table. */
export interface StoryEnvironment {
  readonly theme: TokensTheme;
  readonly cssVariables: CssVariables;
  readonly registry: ComponentRegistry;
  readonly i18n: I18n;
}

/** Builds the environment from a token file (the reference set by default): tokens → theme → providers. */
export function createStoryEnvironment(tokens: unknown = referenceTokens): StoryEnvironment {
  const set = parseTokens(tokens);
  const registry = new ComponentRegistry();
  registerDefaults(registry);
  return {
    theme: createTheme(buildMuiThemeInput(set)),
    cssVariables: buildCssVariables(set, REFERENCE_MODES),
    registry,
    i18n: createI18n({ ...RUNTIME_DEFAULT_MESSAGES, ...RENDERER_DEFAULT_MESSAGES }),
  };
}

let shared: StoryEnvironment | undefined;
function sharedEnvironment(): StoryEnvironment {
  shared ??= createStoryEnvironment();
  return shared;
}

export const STORY_ROOT_TEST_ID = 'star-board-story-root';

/** The slice of Storybook's decorator context this decorator reads. */
export interface DecoratorContext {
  readonly globals: Readonly<Record<string, unknown>>;
}

/** Storybook's partial story function; also usable as a component (`<Story />`). */
export type StoryFn = (update?: unknown) => ReactNode;

export interface StoryRootAttributes {
  readonly 'data-mode': string;
  readonly 'data-density'?: string;
}

/** The token attributes for the toolbar globals; the default density has no attribute. */
export function storyRootAttributes(
  globals: Readonly<Record<string, unknown>>,
): StoryRootAttributes {
  const mode = typeof globals.mode === 'string' && globals.mode ? globals.mode : DEFAULT_MODE;
  const density = typeof globals.density === 'string' ? globals.density : DEFAULT_DENSITY;
  return density === DEFAULT_DENSITY
    ? { 'data-mode': mode }
    : { 'data-mode': mode, 'data-density': density };
}

interface StoryRootProps {
  readonly environment: StoryEnvironment;
  readonly attributes: StoryRootAttributes;
  readonly children: ReactNode;
}

/**
 * Carries `data-mode` / `data-density` on the story root, so the tokens' attribute-keyed CSS
 * blocks and MUI's colour schemes (both select on `[data-mode="…"]`) apply to the story, and
 * mirrors them on the document root so `CssBaseline` paints the page background in the same mode.
 */
export function StoryRoot(props: StoryRootProps) {
  const mode = props.attributes['data-mode'];
  const density = props.attributes['data-density'];
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-mode', mode);
    if (density) root.setAttribute('data-density', density);
    else root.removeAttribute('data-density');
  }, [mode, density]);
  return (
    <div data-testid={STORY_ROOT_TEST_ID} {...props.attributes}>
      <ThemeRoot theme={props.environment.theme} cssVariables={props.environment.cssVariables}>
        <RegistryProvider registry={props.environment.registry}>
          <I18nProvider i18n={props.environment.i18n}>{props.children}</I18nProvider>
        </RegistryProvider>
      </ThemeRoot>
    </div>
  );
}

/**
 * The global decorator (`.storybook/preview.tsx`): every story under the runtime providers and
 * the renderer theme built from the reference tokens, with the `mode` and `density` globals on
 * the story root. Typed against the slice of Storybook's signature it uses, so a test renders it
 * without Storybook.
 */
export function withStarBoard(Story: StoryFn, context: DecoratorContext): ReactElement {
  return (
    <StoryRoot environment={sharedEnvironment()} attributes={storyRootAttributes(context.globals)}>
      <Story />
    </StoryRoot>
  );
}
