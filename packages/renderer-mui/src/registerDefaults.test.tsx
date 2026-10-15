import { ComponentRegistry, COMPONENT_KEYS, type ComponentKey } from '@star-board/core';
import { LIST_COLUMN_TYPES } from '@star-board/tokens';
import { describe, expect, it } from 'vitest';
import { stories } from './manifest.js';
import { AGENT_PANEL_TARGET, AgentPanel } from './agent/AgentPanel.js';
import { UNSAVED_CHANGES_TARGET, UnsavedChangesDialog } from './dialogs/UnsavedChangesDialog.js';
import { DEFAULT_COMPONENTS, EXTRA_REGISTRATIONS, registerDefaults } from './registerDefaults.js';
import { DataGridList, LIST_BODY_TARGET } from './list/DataGridList.js';
import { CustomScreen, GridScreen, ListScreen } from './screens/ScreenShell.js';

/** Every key the contract names: the fixed set plus `list.column.<type>` over the tokens' types. */
export const CONTRACT_KEYS: readonly ComponentKey[] = [
  ...COMPONENT_KEYS,
  ...LIST_COLUMN_TYPES.map((type) => `list.column.${type}` as const),
];

describe('registerDefaults — parity with the component contract', () => {
  it('resolves every contract key as the universal, generated match on a fresh registry', () => {
    const registry = new ComponentRegistry();
    registerDefaults(registry);
    expect(CONTRACT_KEYS.length).toBeGreaterThan(0);
    for (const key of CONTRACT_KEYS) {
      const registration = registry.resolve(key, 'anything', 'anything', { role: 'any' });
      expect(registration.key).toBe(key);
      expect(registration.schema).toBe('*');
      expect(registration.target).toBe('*');
      expect(registration.source).toBe('generated');
      expect(registration.specificity).toBe(1);
      expect(typeof registration.component).toBe('function');
    }
    // one registration per key plus the target-exact agent panel, unsaved-changes dialog and the
    // list body at `table` under screen.list and screen.grid
    expect(EXTRA_REGISTRATIONS).toBe(4);
    expect(registry.size).toBe(CONTRACT_KEYS.length + EXTRA_REGISTRATIONS);
  });

  it('registers the agent panel for screen.custom at target agent-panel only', () => {
    const registry = new ComponentRegistry();
    registerDefaults(registry);
    const panel = registry.resolve('screen.custom', 'pet', AGENT_PANEL_TARGET, { role: 'any' });
    expect(panel.component).toBe(AgentPanel);
    expect(panel.target).toBe(AGENT_PANEL_TARGET);
    expect(panel.schema).toBe('*');
    expect(panel.source).toBe('generated');
    expect(registry.resolve('screen.custom', 'pet', 'anything').component).toBe(CustomScreen);
  });

  it('registers the unsaved-changes dialog for screen.custom at target unsaved-changes only', () => {
    const registry = new ComponentRegistry();
    registerDefaults(registry);
    const dialog = registry.resolve('screen.custom', 'pet', UNSAVED_CHANGES_TARGET, {
      role: 'any',
    });
    expect(dialog.component).toBe(UnsavedChangesDialog);
    expect(dialog.target).toBe(UNSAVED_CHANGES_TARGET);
    expect(dialog.source).toBe('generated');
    expect(registry.resolve('screen.custom', 'pet', AGENT_PANEL_TARGET).component).toBe(AgentPanel);
  });

  it('registers the DataGrid body for screen.list and screen.grid at target table only', () => {
    const registry = new ComponentRegistry();
    registerDefaults(registry);
    for (const key of ['screen.list', 'screen.grid'] as const) {
      const body = registry.resolve(key, 'pet', LIST_BODY_TARGET, { role: 'any' });
      expect(body.component).toBe(DataGridList);
      expect(body.target).toBe(LIST_BODY_TARGET);
      expect(body.schema).toBe('*');
      expect(body.source).toBe('generated');
    }
    expect(registry.resolve('screen.list', 'pet', 'pet_list').component).toBe(ListScreen);
    expect(registry.resolve('screen.grid', 'pet', 'a_view').component).toBe(GridScreen);
  });

  it('implements exactly the contract keys, no more', () => {
    expect([...DEFAULT_COMPONENTS.keys()].sort()).toEqual([...CONTRACT_KEYS].sort());
  });

  it('registers only once: a second call is a duplicate at equal specificity', () => {
    const registry = new ComponentRegistry();
    registerDefaults(registry);
    expect(() => {
      registerDefaults(registry);
    }).toThrow(/duplicate/);
  });

  it('an override at any specificity beats a default', () => {
    const registry = new ComponentRegistry();
    registerDefaults(registry);
    const override = () => null;
    registry.register({
      key: 'field.text',
      schema: 'pet',
      target: '*',
      component: override,
      source: 'override',
    });
    expect(registry.resolve('field.text', 'pet', 'name').component).toBe(override);
    expect(registry.resolve('field.text', 'other', 'name').component).toBe(
      DEFAULT_COMPONENTS.get('field.text'),
    );
  });
});

describe('stories manifest', () => {
  it('has one entry per contract key, each pointing at the registered default', () => {
    expect(stories.map((s) => s.key).sort()).toEqual([...CONTRACT_KEYS].sort());
    for (const story of stories) {
      expect(story.component).toBe(DEFAULT_COMPONENTS.get(story.key));
      expect(typeof story.defaultProps).toBe('object');
    }
  });
});
