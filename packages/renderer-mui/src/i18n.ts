import { useMemo } from 'react';
import { createI18n, useI18n, type I18n } from '@star-board/runtime';

/**
 * Strings the renderer itself needs (typescript/05 §7: key-based, never backend text). The nearest
 * `I18nProvider` wins by key; these defaults fill the gaps so the renderer works without one.
 */
export const RENDERER_DEFAULT_MESSAGES = {
  'action.cancel': 'Cancel',
  'action.confirm': 'Confirm',
  'action.confirmDelete': 'This cannot be undone. Delete this record?',
  'action.confirmTitle': 'Please confirm',
  'field.noOptions': 'No matches',
  'field.loading': 'Loading…',
  'field.addTag': 'Type and press Enter to add',
  'field.yes': 'Yes',
  'field.no': 'No',
  'list.loading': 'Loading rows',
  'state.retry': 'Try again',
  'screen.actions': 'Actions',
  'screen.breadcrumbs': 'Breadcrumb',
  'screen.skipTarget': 'Main content',
  'agent.title': 'Ask the agent',
  'agent.explain': 'Explain',
  'agent.simulate': 'Simulate',
  'agent.apply': 'Apply',
  'agent.rationale': 'Why',
  'agent.citations': 'Sources',
  'agent.diff': 'Proposed change',
  'agent.warnings': 'Warnings',
  'agent.wouldFail': 'This change would not succeed.',
  'agent.applied': 'Applied.',
  'agent.audit': 'Agent activity',
  'agent.toggle': 'Show or hide the agent panel',
  'agent.unavailable': 'The agent is not available right now.',
} as const satisfies Record<string, string>;

export type RendererMessageKey = keyof typeof RENDERER_DEFAULT_MESSAGES;

const fallback: I18n = createI18n({ ...RENDERER_DEFAULT_MESSAGES });

/** `t(key)` from the nearest I18n, falling back to {@link RENDERER_DEFAULT_MESSAGES}. */
export function useText(): (
  key: RendererMessageKey,
  vars?: Record<string, string | number>,
) => string {
  const i18n = useI18n();
  return useMemo(
    () => (key: RendererMessageKey, vars?: Record<string, string | number>) =>
      i18n.has(key) ? i18n.t(key, vars) : fallback.t(key, vars),
    [i18n],
  );
}
