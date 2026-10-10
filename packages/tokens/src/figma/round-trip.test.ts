import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildFigmaVariables } from '../build/figma-variables.js';
import { color, expectTokensInvalid, referenceSet } from '../fixture.test-helper.js';
import { REFERENCE_MODES } from '../modes.js';
import { parseTokens } from '../schema.js';
import {
  figmaVariablesToTokenJson,
  figmaVariablesToTokens,
  parseFigmaVariables,
} from './from-figma.js';

const name = fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/);
const hex = fc.stringMatching(/^#[0-9a-f]{6}$/);
const px = fc.integer({ min: -64, max: 512 }).map((n) => `${n}px`);

/** Colour-scheme mode axes of two or three modes, `light` first. */
const modeAxis = fc.constantFrom(['light', 'dark'], ['light', 'dark', 'high-contrast']);

interface Sample {
  readonly modes: readonly string[];
  readonly json: Record<string, unknown>;
}

/** 1–3 primitives, 1–3 semantic colours (literal or alias per mode), optional dimensions and density. */
const sample: fc.Arbitrary<Sample> = modeAxis.chain((modes) => {
  const themed = modes.slice(1);
  const primitives = fc
    .uniqueArray(name, { minLength: 1, maxLength: 3 })
    .chain((names) => fc.tuple(...names.map((n) => hex.map((v) => [n, v] as const))));
  return primitives.chain((prims) => {
    const aliasOrHex = fc.oneof(
      hex,
      fc.constantFrom(...prims.map(([n]) => `{color.primitive.${n}}`)),
    );
    const semantic = fc.uniqueArray(name, { minLength: 1, maxLength: 3 }).chain((names) =>
      fc.tuple(
        ...names.map((n) =>
          fc
            .tuple(aliasOrHex, fc.tuple(...themed.map(() => aliasOrHex)))
            .map(([value, perMode]) => {
              const modeValues: Record<string, string> = {};
              themed.forEach((m, i) => {
                const v = perMode[i];
                if (v !== undefined) modeValues[m] = v;
              });
              return [n, color(value, modeValues)] as const;
            }),
        ),
      ),
    );
    const dimensions = fc.uniqueArray(name, { maxLength: 2 }).chain((names) =>
      fc.tuple(
        ...names.map((n) =>
          fc
            .tuple(px, fc.option(px, { nil: undefined }), fc.option(px, { nil: undefined }))
            .map(([value, dark, dense]) => {
              const token: Record<string, unknown> = { $type: 'dimension', $value: value };
              // A token is themed on one axis only: a dark override or a dense one, never both.
              if (dense !== undefined) {
                token.$extensions = { 'star-board': { modes: { dense } } };
              } else if (dark !== undefined && dark !== value) {
                token.$extensions = { 'star-board': { modes: { dark } } };
              }
              return [n, token] as const;
            }),
        ),
      ),
    );
    return fc.tuple(semantic, dimensions).map(([sem, dims]) => {
      const json: Record<string, unknown> = {
        color: {
          primitive: Object.fromEntries(prims.map(([n, v]) => [n, color(v)])),
          semantic: Object.fromEntries(sem),
        },
      };
      if (dims.length > 0) json.space = Object.fromEntries(dims);
      return { modes, json };
    });
  });
});

describe('figmaVariablesToTokens', () => {
  it('round-trips the reference set exactly (modes, aliases, density, font list)', () => {
    const set = referenceSet();
    const doc = buildFigmaVariables(set, REFERENCE_MODES);
    const back = figmaVariablesToTokens(parseFigmaVariables(JSON.parse(JSON.stringify(doc))));
    expect(back).toEqual(set);
    expect(back.paths).toEqual(set.paths);
    expect(back.tokens['color.surface.default']?.raw).toBe('{color.primitive.grey.50}');
    expect(back.tokens['color.surface.default']?.modes).toEqual({
      dark: '{color.primitive.grey.900}',
      'high-contrast': '#ffffff',
    });
    expect(back.tokens['font.body']?.raw).toEqual(['Inter', 'system-ui', 'sans-serif']);
    expect(back.tokens['density.row']?.modes).toEqual({ dense: '32px' });
  });

  it('round-trips generated token sets: tokens → variables → tokens is the identity', () => {
    fc.assert(
      fc.property(sample, ({ modes, json }) => {
        const set = parseTokens(json);
        const doc = buildFigmaVariables(set, { modes, density: ['dense'] });
        expect(figmaVariablesToTokens(doc)).toEqual(set);
      }),
      { numRuns: 200 },
    );
  });

  it('emits DTCG JSON that parses back to the same set', () => {
    const set = referenceSet();
    const json = figmaVariablesToTokenJson(buildFigmaVariables(set, REFERENCE_MODES));
    expect(parseTokens(json)).toEqual(set);
    const surface = (json as { color: { surface: { default: Record<string, unknown> } } }).color
      .surface.default;
    expect(surface).toEqual({
      $type: 'color',
      $value: '{color.primitive.grey.50}',
      $extensions: {
        'star-board': {
          modes: { dark: '{color.primitive.grey.900}', 'high-contrast': '#ffffff' },
        },
      },
    });
  });

  it('restores number and duration tokens only with a type hint (documented exclusion)', () => {
    const set = parseTokens({
      n: { $type: 'number', $value: 1.5 },
      d: { $type: 'duration', $value: '150ms' },
      r: { $type: 'dimension', $value: '0.5rem' },
    });
    const doc = buildFigmaVariables(set, { modes: ['light'] });
    const unhinted = figmaVariablesToTokens(doc);
    expect(unhinted.tokens.n?.type).toBe('dimension');
    expect(unhinted.tokens.n?.value).toBe('1.5px');
    const hinted = figmaVariablesToTokens(doc, { types: { n: 'number', d: 'duration' } });
    expect(hinted.tokens.n).toEqual(set.tokens.n);
    expect(hinted.tokens.d).toEqual(set.tokens.d);
    // rem is a documented exclusion: it comes back in px.
    expect(hinted.tokens.r?.value).toBe('8px');
  });

  it('restores a shadow from its text form', () => {
    const set = parseTokens({
      s: {
        $type: 'shadow',
        $value: { color: '#00000080', offsetX: '0px', offsetY: '1px', blur: '2px', spread: '0px' },
      },
    });
    const doc = buildFigmaVariables(set, { modes: ['light'] });
    expect(figmaVariablesToTokens(doc)).toEqual(set);
  });

  it('fails closed on an unknown collection or a density collection without a default mode', () => {
    const unknown = expectTokensInvalid(() =>
      figmaVariablesToTokens({
        collections: [{ name: 'brand', modes: ['light'], variables: [] }],
      }),
    );
    expect(JSON.stringify(unknown.details)).toContain('unknown collection');
    const density = expectTokensInvalid(() =>
      figmaVariablesToTokens({
        collections: [{ name: 'star-board-density', modes: ['dense'], variables: [] }],
      }),
    );
    expect(JSON.stringify(density.details)).toContain("'default'");
  });
});

describe('parseFigmaVariables', () => {
  it('accepts the builder output and rejects malformed documents with every issue listed', () => {
    const doc = buildFigmaVariables(referenceSet(), REFERENCE_MODES);
    expect(parseFigmaVariables(doc)).toEqual(doc);
    expectTokensInvalid(() => parseFigmaVariables(null));
    expectTokensInvalid(() => parseFigmaVariables({ collections: {} }));
    const error = expectTokensInvalid(() =>
      parseFigmaVariables({
        collections: [
          {
            name: 'star-board',
            modes: ['light', 'dark'],
            variables: [
              { name: 'color/a', type: 'COLOR', valuesByMode: { light: '#000000' } },
              { name: 'color/b', type: 'RGB', valuesByMode: {} },
              { name: 'color/a', type: 'COLOR', valuesByMode: { light: 1, dark: true, sepia: '' } },
            ],
          },
          { name: 'star-board', modes: [], variables: [] },
        ],
      }),
    );
    const issues = (error.details as { issues: { message: string }[] }).issues.map(
      (i) => i.message,
    );
    expect(issues).toEqual([
      "no value for mode 'dark'",
      'unknown variable type "RGB"',
      "mode 'dark': a value is a string, a finite number or { alias }",
      "value for mode 'sepia' which the collection does not declare",
      "no value for mode 'dark'",
      'duplicate variable name',
      'modes must be a non-empty list of distinct mode names',
    ]);
  });
});
