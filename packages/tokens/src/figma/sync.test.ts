import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TokensError } from '@star-board/core';
import { afterEach, describe, expect, it } from 'vitest';
import { buildFigmaVariables, type FigmaVariable } from '../build/figma-variables.js';
import { referenceSet } from '../fixture.test-helper.js';
import { REFERENCE_MODES } from '../modes.js';
import type { FigmaVariablesDocument } from './ports.js';
import { InMemoryTokenSource } from './sources.js';
import { JsonFileTokenSource } from './node-sources.js';
import { changedPaths, syncTokens } from './sync.js';

async function failure(promise: Promise<unknown>): Promise<TokensError> {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(TokensError);
  const error = caught as TokensError;
  expect(error.code).toBe('TOKENS_INVALID');
  return error;
}

/** The reference document with one variable's value replaced in one mode. */
function withValue(
  doc: FigmaVariablesDocument,
  variableName: string,
  mode: string,
  value: FigmaVariable['valuesByMode'][string],
): FigmaVariablesDocument {
  return {
    collections: doc.collections.map((c) => ({
      ...c,
      variables: c.variables.map((v) =>
        v.name === variableName ? { ...v, valuesByMode: { ...v.valuesByMode, [mode]: value } } : v,
      ),
    })),
  };
}

describe('syncTokens push', () => {
  it('builds the variables document from the tokens and pushes it to the source', async () => {
    const tokens = referenceSet();
    const source = new InMemoryTokenSource();
    const result = await syncTokens({ tokens, source, direction: 'push', modes: REFERENCE_MODES });
    expect(source.document).toEqual(buildFigmaVariables(tokens, REFERENCE_MODES));
    expect(source.pushed).toHaveLength(1);
    expect(result).toEqual({ tokens, findings: [], changed: [] });
  });

  it('fails closed on lint findings and pushes nothing', async () => {
    const tokens = referenceSet();
    const source = new InMemoryTokenSource();
    const error = await failure(
      syncTokens({ tokens, source, direction: 'push', modes: { modes: ['light', 'sepia'] } }),
    );
    expect(error.message).toContain('lint');
    expect(source.document).toBeUndefined();
  });
});

describe('syncTokens pull', () => {
  it('returns the local set unchanged when the source agrees', async () => {
    const tokens = referenceSet();
    const source = new InMemoryTokenSource(buildFigmaVariables(tokens, REFERENCE_MODES));
    const result = await syncTokens({ tokens, source, direction: 'pull', modes: REFERENCE_MODES });
    expect(result.tokens).toEqual(tokens);
    expect(result.changed).toEqual([]);
    expect(result.findings).toEqual([]);
  });

  it('detects a changed value and lists its path without touching the local set', async () => {
    const tokens = referenceSet();
    const doc = withValue(
      buildFigmaVariables(tokens, REFERENCE_MODES),
      'color/action/primary',
      'dark',
      '#448aff',
    );
    const source = new InMemoryTokenSource(doc);
    const result = await syncTokens({ tokens, source, direction: 'pull', modes: REFERENCE_MODES });
    expect(result.changed).toEqual(['color.action.primary']);
    expect(result.tokens.tokens['color.action.primary']?.modes.dark).toBe('#448aff');
    expect(tokens.tokens['color.action.primary']?.modes.dark).toBe('#82b1ff');
    const rest = result.tokens.paths.filter((p) => p !== 'color.action.primary');
    for (const path of rest) expect(result.tokens.tokens[path]).toEqual(tokens.tokens[path]);
  });

  it('lists an alias retargeted in the design tool as a change', async () => {
    const tokens = referenceSet();
    const doc = withValue(
      buildFigmaVariables(tokens, REFERENCE_MODES),
      'color/surface/default',
      'light',
      {
        alias: 'color/primitive/grey/900',
      },
    );
    const result = await syncTokens({
      tokens,
      source: new InMemoryTokenSource(doc),
      direction: 'pull',
      modes: REFERENCE_MODES,
    });
    expect(result.changed).toEqual(['color.surface.default']);
    expect(result.tokens.tokens['color.surface.default']?.raw).toBe('{color.primitive.grey.900}');
  });

  it('fails closed when the source carries a mode the local axis does not know', async () => {
    const tokens = referenceSet();
    const doc = buildFigmaVariables(tokens, {
      modes: ['light', 'dark', 'sepia'],
      density: ['dense'],
    });
    const error = await failure(
      syncTokens({
        tokens,
        source: new InMemoryTokenSource(doc),
        direction: 'pull',
        modes: REFERENCE_MODES,
      }),
    );
    expect(error.message).toContain('lint');
    const issues = (error.details as { issues: { message: string }[] }).issues.map(
      (i) => i.message,
    );
    expect(issues.some((m) => m.startsWith('mode-unknown'))).toBe(true);
    expect(issues.some((m) => m.startsWith('semantic-mode-complete'))).toBe(true);
  });

  it('fails closed when the source lacks a mode a semantic colour needs', async () => {
    const tokens = referenceSet();
    const doc = buildFigmaVariables(tokens, { modes: ['light', 'dark'], density: ['dense'] });
    const error = await failure(
      syncTokens({
        tokens,
        source: new InMemoryTokenSource(doc),
        direction: 'pull',
        modes: REFERENCE_MODES,
      }),
    );
    const issues = (error.details as { issues: { path: string; message: string }[] }).issues;
    expect(issues.map((i) => i.path)).toContain('color.surface.default');
    expect(issues.every((i) => i.message.includes("'high-contrast'"))).toBe(true);
  });

  it('fails closed on a value that is not a token of its type', async () => {
    const tokens = referenceSet();
    const doc = withValue(
      buildFigmaVariables(tokens, REFERENCE_MODES),
      'color/text/danger',
      'dark',
      'red',
    );
    const error = await failure(
      syncTokens({
        tokens,
        source: new InMemoryTokenSource(doc),
        direction: 'pull',
        modes: REFERENCE_MODES,
      }),
    );
    expect(JSON.stringify(error.details)).toContain('color.text.danger');
  });

  it('rejects an empty in-memory source', async () => {
    await failure(new InMemoryTokenSource().pull());
  });
});

describe('changedPaths', () => {
  it('lists added, removed and re-authored paths, sorted', () => {
    const a = referenceSet();
    const b = { ...a, tokens: { ...a.tokens }, paths: [...a.paths] };
    delete (b.tokens as Record<string, unknown>)['space.3'];
    b.paths = b.paths.filter((p) => p !== 'space.3');
    expect(changedPaths(a, b)).toEqual(['space.3']);
    expect(changedPaths(a, a)).toEqual([]);
  });
});

describe('JsonFileTokenSource', () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });

  async function tempFile(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'star-board-tokens-'));
    dirs.push(dir);
    return join(dir, 'figma-variables.json');
  }

  it('pushes pretty JSON with a trailing newline and pulls it back equal', async () => {
    const path = await tempFile();
    const source = new JsonFileTokenSource(path);
    const doc = buildFigmaVariables(referenceSet(), REFERENCE_MODES);
    await source.push(doc);
    const text = await readFile(path, 'utf8');
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).toBe(`${JSON.stringify(doc, null, 2)}\n`);
    expect(await source.pull()).toEqual(doc);
  });

  it('fails closed on a missing or malformed file', async () => {
    const path = await tempFile();
    const missing = await failure(new JsonFileTokenSource(path).pull());
    expect(missing.message).toContain(path);
    await new JsonFileTokenSource(path).push({ collections: [] });
    expect(await new JsonFileTokenSource(path).pull()).toEqual({ collections: [] });
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path, '{ not json', 'utf8');
    await failure(new JsonFileTokenSource(path).pull());
    await writeFile(
      path,
      '{"collections":[{"name":"star-board","modes":["light"],"variables":[1]}]}',
      'utf8',
    );
    await failure(new JsonFileTokenSource(path).pull());
  });
});
