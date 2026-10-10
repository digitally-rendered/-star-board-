import type { ContractRow } from '../build/contract.js';
import { buildFigmaVariables } from '../build/figma-variables.js';
import { assertClean, lintTokens, type LintFinding } from '../lint.js';
import type { ModeOptions } from '../modes.js';
import type { Token, TokenSet } from '../schema.js';
import { figmaVariablesToTokens, tokenTypesOf } from './from-figma.js';
import type { TokenSourcePort } from './ports.js';

/**
 * `design/sync-tokens` (typescript/13 §5) as a function over the token port. Push builds the
 * variables document from the local tokens and hands it to the source; pull reads the source,
 * turns it back into tokens and lints them. Neither direction writes the local token file: the
 * CLI does that with the returned set, so a sync is reviewable before it lands.
 */
export type SyncDirection = 'push' | 'pull';

export interface SyncTokensOptions {
  /** The local token set (the source of truth on push, the baseline for `changed` on pull). */
  readonly tokens: TokenSet;
  readonly source: TokenSourcePort;
  readonly direction: SyncDirection;
  readonly modes: ModeOptions;
  /** Contract rows for the lint; defaults to `buildContract()`. */
  readonly contract?: readonly ContractRow[];
}

export interface SyncResult {
  /** On push the local set unchanged; on pull the set read from the source. */
  readonly tokens: TokenSet;
  /** Lint findings on the resulting set; always empty because findings fail closed. */
  readonly findings: readonly LintFinding[];
  /** Token paths whose type, authored value or authored modes differ between local and result. */
  readonly changed: readonly string[];
}

function authoredOf(token: Token | undefined): string {
  return token === undefined
    ? ''
    : JSON.stringify({ type: token.type, raw: token.raw, modes: token.modes });
}

/** Paths added, removed or authored differently between two sets, sorted. */
export function changedPaths(before: TokenSet, after: TokenSet): readonly string[] {
  const paths = new Set([...before.paths, ...after.paths]);
  return [...paths]
    .filter((path) => authoredOf(before.tokens[path]) !== authoredOf(after.tokens[path]))
    .sort();
}

export async function syncTokens(options: SyncTokensOptions): Promise<SyncResult> {
  const { tokens, source, modes } = options;
  const lintOptions = {
    ...modes,
    ...(options.contract === undefined ? {} : { contract: options.contract }),
  };
  if (options.direction === 'push') {
    assertClean(lintTokens(tokens, lintOptions));
    await source.push(buildFigmaVariables(tokens, modes));
    return { tokens, findings: [], changed: [] };
  }
  const doc = await source.pull();
  const pulled = figmaVariablesToTokens(doc, { types: tokenTypesOf(tokens) });
  const findings = lintTokens(pulled, lintOptions);
  assertClean(findings);
  return { tokens: pulled, findings, changed: changedPaths(tokens, pulled) };
}
