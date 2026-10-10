import { ComponentRegistry, COMPONENT_KEYS, type ComponentKey } from '@star-board/core';
import { LIST_COLUMN_TYPES } from '@star-board/tokens';
import { describe, expect, it } from 'vitest';
import { stories } from './manifest.js';
import { DEFAULT_COMPONENTS, registerDefaults } from './registerDefaults.js';

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
    expect(registry.size).toBe(CONTRACT_KEYS.length);
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
