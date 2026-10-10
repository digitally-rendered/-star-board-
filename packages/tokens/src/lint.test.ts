import { describe, expect, it } from 'vitest';
import { color, expectTokensInvalid, referenceJson, referenceSet } from './fixture.test-helper.js';
import { assertClean, lintTokens } from './lint.js';
import { REFERENCE_MODES } from './modes.js';
import { parseTokens } from './schema.js';

function withToken(path: string, token: unknown): unknown {
  const json = structuredClone(referenceJson()) as Record<string, unknown>;
  let cursor = json;
  const segments = path.split('.');
  for (const segment of segments.slice(0, -1)) {
    const next = (cursor[segment] ??= {});
    cursor = next as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1] ?? ''] = token;
  return json;
}

describe('lintTokens', () => {
  it('finds nothing in the reference set', () => {
    expect(lintTokens(referenceSet(), REFERENCE_MODES)).toEqual([]);
  });

  it('reports a semantic colour that lacks a declared mode', () => {
    const set = parseTokens(
      withToken('color.text.muted', color('{color.primitive.grey.900}', { dark: '#ffffff' })),
    );
    const findings = lintTokens(set, REFERENCE_MODES);
    expect(findings).toEqual([
      {
        path: 'color.text.muted',
        rule: 'semantic-mode-complete',
        message: "semantic colour token has no value for mode 'high-contrast'",
      },
    ]);
  });

  it('reports a primitive that aliases or is themed', () => {
    const set = parseTokens(
      withToken(
        'color.primitive.grey.100',
        color('{color.primitive.grey.50}', { dark: '#000000' }),
      ),
    );
    const rules = lintTokens(set, REFERENCE_MODES).map((f) => f.rule);
    expect(rules).toEqual(['primitive-no-alias', 'primitive-no-modes']);
  });

  it('reports an undeclared mode name on a semantic token', () => {
    const set = parseTokens(
      withToken(
        'color.text.muted',
        color('#000000', { dark: '#ffffff', 'high-contrast': '#ffffff', drak: '#ffffff' }),
      ),
    );
    expect(lintTokens(set, REFERENCE_MODES).map((f) => f.rule)).toEqual(['mode-unknown']);
  });

  it('reports a contract row that references a primitive or a missing token', () => {
    const contract = [
      {
        key: 'field.text',
        figmaComponent: 'Text field',
        renderer: 'default' as const,
        componentName: 'TextField',
        tokens: ['color.primitive.blue.500', 'color.nope'],
      },
    ];
    const findings = lintTokens(referenceSet(), { ...REFERENCE_MODES, contract });
    expect(findings.map((f) => [f.path, f.rule])).toEqual([
      ['color.nope', 'contract-semantic-only'],
      ['color.primitive.blue.500', 'contract-semantic-only'],
    ]);
  });

  it('assertClean throws TOKENS_INVALID with the findings and passes an empty list', () => {
    expect(() => {
      assertClean([]);
    }).not.toThrow();
    const error = expectTokensInvalid(() => {
      assertClean([{ path: 'a', rule: 'primitive-no-alias', message: 'm' }]);
    });
    expect(error.details.issues).toEqual([{ path: 'a', message: 'primitive-no-alias: m' }]);
  });
});
