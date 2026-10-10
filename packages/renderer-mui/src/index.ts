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
export { SkipToContent, type SkipToContentProps } from './screens/SkipToContent.js';
export {
  UNSAVED_CHANGES_TARGET,
  UnsavedChangesDialog,
  type UnsavedChangesDialogProps,
} from './dialogs/UnsavedChangesDialog.js';
export { useSchemaForm, type SchemaForm } from './form/useSchemaForm.js';
export {
  COLOR_SCHEME_ATTRIBUTE,
  createTheme,
  type CreateThemeOptions,
  type TokensTheme,
} from './theme/createTheme.js';
export {
  cssVariablesToText,
  HOST_THEME_SELECTOR,
  ThemeRoot,
  TOKENS_STYLE_ATTRIBUTE,
  withHostTheme,
  type HostTheme,
  type ThemeRootProps,
} from './theme/ThemeRoot.js';
export { RENDERER_DEFAULT_MESSAGES, useText, type RendererMessageKey } from './i18n.js';
export {
  DEFAULT_COMPONENTS,
  EXTRA_REGISTRATIONS,
  registerDefaults,
  type AnyComponent,
} from './registerDefaults.js';
export {
  agentPanelStories,
  stories,
  type AgentPanelManifestEntry,
  type ManifestEntry,
} from './manifest.js';
export {
  AGENT_AUDIT_ROWS,
  AGENT_PANEL_TARGET,
  AgentPanel,
  AgentPanelView,
  agentTestId,
  type AgentPanelProps,
  type AgentPanelState,
  type AgentPanelViewProps,
} from './agent/AgentPanel.js';
