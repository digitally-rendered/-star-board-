/** @star-board/storybook — L5. Stories per contract key, mode and state; visual regression baselines. */
export const PACKAGE = '@star-board/storybook' as const;
export const LAYER = 'L5' as const;

export {
  componentExportName,
  generatedStories,
  manifestEntry,
  renderStoriesFile,
  statesFor,
  STORY_STATES,
  storyArgs,
  storyId,
  storyTitle,
  type GeneratedStory,
  type GeneratedStoryFile,
  type StoryState,
} from './generated-stories.js';
export * from './visual/index.js';
export {
  createStoryEnvironment,
  STORY_ROOT_TEST_ID,
  StoryRoot,
  storyRootAttributes,
  withStarBoard,
  type DecoratorContext,
  type StoryEnvironment,
  type StoryFn,
  type StoryRootAttributes,
} from './preview/withStarBoard.js';
