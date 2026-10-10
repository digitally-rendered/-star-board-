/** @star-board/renderer-mui — L3. MUI implementation of every component contract key; DataGrid list and grid; forms via React Hook Form and zod; theme from tokens; registers as the universal match. */
export const PACKAGE = '@star-board/renderer-mui' as const;
export const LAYER = 'L3' as const;

export * from './contracts.js';
export * from './fields/index.js';
export * from './list/index.js';
export {
  ActionButton,
  actionTestId,
  CreateAction,
  CustomAction,
  DeleteAction,
  UpdateAction,
  type ActionKind,
} from './actions/ActionButton.js';
export * from './states/index.js';
export { InlineHelp } from './help/InlineHelp.js';
export {
  CreateScreen,
  CustomScreen,
  DetailScreen,
  EditScreen,
  GridScreen,
  ListScreen,
  MAIN_CONTENT_ID,
  ScreenShell,
  type ScreenKind,
} from './screens/ScreenShell.js';
export { useSchemaForm, type SchemaForm } from './form/useSchemaForm.js';
export {
  COLOR_SCHEME_ATTRIBUTE,
  createTheme,
  type CreateThemeOptions,
  type TokensTheme,
} from './theme/createTheme.js';
export {
  cssVariablesToText,
  ThemeRoot,
  TOKENS_STYLE_ATTRIBUTE,
  type ThemeRootProps,
} from './theme/ThemeRoot.js';
export { RENDERER_DEFAULT_MESSAGES, useText, type RendererMessageKey } from './i18n.js';
export { DEFAULT_COMPONENTS, registerDefaults, type AnyComponent } from './registerDefaults.js';
export { stories, type ManifestEntry } from './manifest.js';
