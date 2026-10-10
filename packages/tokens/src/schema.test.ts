import { describe, expect, it } from 'vitest';
import { color, expectTokensInvalid, referenceJson, referenceSet } from './fixture.test-helper.js';
import {
  aliasTarget,
  isAlias,
  isPrimitivePath,
  MAX_ALIAS_DEPTH,
  parseTokens,
  TOKEN_TYPES,
} from './schema.js';

describe('parseTokens', () => {
  it('parses the reference token set with sorted paths and the modes it declares', () => {
    const set = referenceSet();
    expect(set.paths).toEqual([...set.paths].sort());
    expect(set.paths).toContain('color.surface.default');
    expect(set.paths).toContain('color.primitive.grey.50');
    expect(set.modes).toEqual(['dark', 'dense', 'high-contrast']);
    expect(set.tokens['font.body']?.value).toEqual(['Inter', 'system-ui', 'sans-serif']);
  });

  it('marks the primitive subtree and keeps the authored alias next to the resolved value', () => {
    const set = referenceSet();
    const surface = set.tokens['color.surface.default'];
    expect(surface?.primitive).toBe(false);
    expect(surface?.raw).toBe('{color.primitive.grey.50}');
    expect(surface?.value).toBe('#fafafa');
    expect(surface?.modes.dark).toBe('{color.primitive.grey.900}');
    expect(surface?.resolvedModes.dark).toBe('#121212');
    expect(surface?.resolvedModes['high-contrast']).toBe('#ffffff');
    expect(set.tokens['color.primitive.grey.50']?.primitive).toBe(true);
    expect(isPrimitivePath('color.primitive.blue.500')).toBe(true);
    expect(isPrimitivePath('color.action.primary')).toBe(false);
  });

  it('resolves alias chains through intermediate tokens and per mode', () => {
    const set = parseTokens({
      color: {
        primitive: { a: color('#111111'), b: color('#222222') },
        base: color('{color.primitive.a}', { dark: '{color.primitive.b}' }),
        derived: color('{color.base}', { dark: '{color.base}' }),
      },
    });
    expect(set.tokens['color.derived']?.value).toBe('#111111');
    expect(set.tokens['color.derived']?.resolvedModes.dark).toBe('#222222');
  });

  it('inherits $type from an enclosing group', () => {
    const set = parseTokens({ space: { $type: 'dimension', '1': { $value: '4px' } } });
    expect(set.tokens['space.1']?.type).toBe('dimension');
  });

  it('rejects an unknown $type with TOKENS_INVALID', () => {
    const error = expectTokensInvalid(() => parseTokens({ odd: { $type: 'weird', $value: '1' } }));
    expect(error.details.issues).toEqual([
      { path: 'odd', message: `unknown $type "weird"; expected one of ${TOKEN_TYPES.join(', ')}` },
    ]);
  });

  it('rejects a literal that does not match its $type', () => {
    const error = expectTokensInvalid(() =>
      parseTokens({
        c: color('red'),
        d: { $type: 'dimension', $value: '4' },
        n: { $type: 'number', $value: '4' },
        t: { $type: 'duration', $value: '4s' },
        f: { $type: 'fontFamily', $value: [] },
        s: { $type: 'shadow', $value: { color: '#000000' } },
      }),
    );
    const paths = (error.details.issues as { path: string }[]).map((i) => i.path);
    expect(paths).toEqual(['c', 'd', 'f', 'n', 's', 't']);
  });

  it('rejects a bad mode value, an unknown extension key and a token with children', () => {
    const error = expectTokensInvalid(() =>
      parseTokens({
        a: {
          $type: 'color',
          $value: '#000000',
          $extensions: { 'star-board': { modes: { dark: 'x' }, extra: 1 } },
        },
        b: { $type: 'color', $value: '#000000', child: color('#ffffff') },
      }),
    );
    const messages = (error.details.issues as { message: string }[]).map((i) => i.message);
    expect(messages).toEqual([
      "unknown $extensions['star-board'] key 'extra'",
      "mode 'dark': a color is #rrggbb or #rrggbbaa",
      "a token cannot contain the child 'child'",
    ]);
  });

  it('rejects a non-object root, a token at the root, a bad name and a non-object node', () => {
    expectTokensInvalid(() => parseTokens('nope'));
    expectTokensInvalid(() => parseTokens({ $type: 'color', $value: '#000000' }));
    expectTokensInvalid(() => parseTokens({ 'a.b': color('#000000') }));
    expectTokensInvalid(() => parseTokens({ a: 3 }));
    expectTokensInvalid(() => parseTokens({ a: { $value: '#000000' } }));
  });

  it('rejects an alias to an unknown token and an alias across types', () => {
    const unknown = expectTokensInvalid(() => parseTokens({ a: color('{b}') }));
    expect(unknown.details.issues).toEqual([{ path: 'a', message: "alias to unknown token 'b'" }]);
    const mismatch = expectTokensInvalid(() =>
      parseTokens({ a: color('{d}'), d: { $type: 'dimension', $value: '1px' } }),
    );
    expect((mismatch.details.issues as { message: string }[])[0]?.message).toContain(
      'type mismatch',
    );
  });

  it('rejects an alias cycle without looping', () => {
    const error = expectTokensInvalid(() =>
      parseTokens({ a: color('{b}'), b: color('{c}'), c: color('{a}') }),
    );
    const messages = (error.details.issues as { message: string }[]).map((i) => i.message);
    expect(messages.some((m) => m.startsWith('alias cycle'))).toBe(true);
  });

  it(`rejects an alias chain deeper than ${MAX_ALIAS_DEPTH}`, () => {
    const file: Record<string, unknown> = { t0: color('#000000') };
    for (let i = 1; i <= MAX_ALIAS_DEPTH + 1; i += 1) file[`t${i}`] = color(`{t${i - 1}}`);
    const error = expectTokensInvalid(() => parseTokens(file));
    const messages = (error.details.issues as { message: string }[]).map((i) => i.message);
    expect(messages.some((m) => m.includes(`deeper than ${MAX_ALIAS_DEPTH}`))).toBe(true);
    const shorter: Record<string, unknown> = { t0: color('#000000') };
    for (let i = 1; i <= MAX_ALIAS_DEPTH; i += 1) shorter[`t${i}`] = color(`{t${i - 1}}`);
    expect(parseTokens(shorter).tokens[`t${MAX_ALIAS_DEPTH}`]?.value).toBe('#000000');
  });

  it('exposes alias helpers', () => {
    expect(isAlias('{a.b}')).toBe(true);
    expect(isAlias('#000000')).toBe(false);
    expect(aliasTarget('{a.b}')).toBe('a.b');
    expectTokensInvalid(() => aliasTarget('nope'));
  });

  it('accepts the reference file untouched as valid JSON input', () => {
    expect(() => parseTokens(referenceJson())).not.toThrow();
  });
});
