import { describe, expect, it } from 'vitest';
import * as runtime from './index.js';

describe('runtime surface', () => {
  it('declares its package and layer', () => {
    expect(runtime.PACKAGE).toBe('@star-board/runtime');
    expect(runtime.LAYER).toBe('L2');
  });
  it('exports every public function', () => {
    const fns = [
      'createClient',
      'createAuthMiddleware',
      'parseProblem',
      'problemFromBody',
      'etagOf',
      'ServicesProvider',
      'useServices',
      'useOperations',
      'RegistryProvider',
      'ScopeProvider',
      'useRegistry',
      'useScope',
      'useComponent',
      'createOperationsPort',
      'useEntity',
      'useEntityList',
      'useView',
      'useMutation',
      'useCapability',
      'useCapabilities',
      'presentError',
      'useErrorPresentation',
      'createI18n',
      'I18nProvider',
      'useI18n',
      'useUnsavedChanges',
      'useSessionTimeout',
      'useMediaQuery',
      'useCompactLayout',
    ] as const;
    for (const name of fns) expect(typeof runtime[name], name).toBe('function');
    expect(runtime.queryKeys.all()).toEqual(['star-board']);
    expect(runtime.IF_MATCH).toBe('If-Match');
  });
});
