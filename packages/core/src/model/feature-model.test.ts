import { describe, expect, it } from 'vitest';
import { FeatureModelSchema, OperationEntrySchema, REQUIRED_EXTENSIONS } from './feature-model.js';

describe('FeatureModel schema', () => {
  it('requires <schema>_<operation> ids', () => {
    expect(
      OperationEntrySchema.safeParse({
        id: 'pet_create',
        schema: 'pet',
        operation: 'create',
        kind: 'create',
        method: 'post',
        path: '/pet',
        capabilities: [],
      }).success,
    ).toBe(true);
    expect(
      OperationEntrySchema.safeParse({
        id: 'createPet',
        schema: 'pet',
        operation: 'create',
        kind: 'create',
        method: 'post',
        path: '/pet',
        capabilities: [],
      }).success,
    ).toBe(false);
  });
  it('validates a minimal model and names the required extensions once', () => {
    const minimal = {
      title: 't',
      version: '1',
      posture: '404',
      schemas: {},
      views: {},
      operations: {},
    };
    expect(FeatureModelSchema.parse(minimal).posture).toBe('404');
    expect(REQUIRED_EXTENSIONS.view).toBe('x-view');
  });
});
