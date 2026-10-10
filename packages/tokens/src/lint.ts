import { densityModes, themedModes, type ModeOptions } from './modes.js';
import { buildContract, type ContractRow } from './build/contract.js';
import { invalid, isAlias, type Token, type TokenSet } from './schema.js';

/**
 * Semantic lint (typescript/13 §2 and §6): every semantic colour token has a value in every
 * colour-scheme mode; primitives never alias and are never themed; the component contract
 * references semantic tokens only.
 */
export const LINT_RULES = [
  'semantic-mode-complete',
  'mode-unknown',
  'primitive-no-alias',
  'primitive-no-modes',
  'contract-semantic-only',
] as const;
export type LintRule = (typeof LINT_RULES)[number];

export interface LintFinding {
  readonly path: string;
  readonly rule: LintRule;
  readonly message: string;
}

export interface LintOptions extends ModeOptions {
  /** Contract rows to check against the set; defaults to {@link buildContract}. */
  readonly contract?: readonly ContractRow[];
}

function aliasEntries(token: Token): string[] {
  const out: string[] = [];
  if (isAlias(token.raw)) out.push('$value');
  for (const mode of Object.keys(token.modes)) {
    if (isAlias(token.modes[mode])) out.push(`mode '${mode}'`);
  }
  return out;
}

export function lintTokens(set: TokenSet, options: LintOptions): readonly LintFinding[] {
  const findings: LintFinding[] = [];
  const themed = themedModes(options);
  const known = new Set([...options.modes, ...densityModes(options)]);

  for (const path of set.paths) {
    const token = set.tokens[path];
    if (token === undefined) continue;
    if (token.primitive) {
      for (const where of aliasEntries(token)) {
        findings.push({
          path,
          rule: 'primitive-no-alias',
          message: `primitive token aliases another token in ${where}`,
        });
      }
      const modes = Object.keys(token.modes);
      if (modes.length > 0) {
        findings.push({
          path,
          rule: 'primitive-no-modes',
          message: `primitive token declares modes (${modes.join(', ')}); only semantic tokens are themed`,
        });
      }
      continue;
    }
    if (token.type === 'color') {
      for (const mode of themed) {
        if (!Object.hasOwn(token.modes, mode)) {
          findings.push({
            path,
            rule: 'semantic-mode-complete',
            message: `semantic colour token has no value for mode '${mode}'`,
          });
        }
      }
    }
    for (const mode of Object.keys(token.modes)) {
      if (!known.has(mode)) {
        findings.push({
          path,
          rule: 'mode-unknown',
          message: `mode '${mode}' is not declared (known: ${[...known].sort().join(', ')})`,
        });
      }
    }
  }

  for (const row of options.contract ?? buildContract()) {
    for (const tokenPath of row.tokens) {
      const token = set.tokens[tokenPath];
      if (token === undefined) {
        findings.push({
          path: tokenPath,
          rule: 'contract-semantic-only',
          message: `contract key '${row.key}' references a token that does not exist`,
        });
      } else if (token.primitive) {
        findings.push({
          path: tokenPath,
          rule: 'contract-semantic-only',
          message: `contract key '${row.key}' references a primitive token`,
        });
      }
    }
  }

  return findings.sort((a, b) => {
    const byPath = a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
    if (byPath !== 0) return byPath;
    return a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0;
  });
}

/** Throws `TokensError('TOKENS_INVALID')` carrying the findings when there are any. */
export function assertClean(findings: readonly LintFinding[]): void {
  if (findings.length === 0) return;
  throw invalid(
    `Token lint failed: ${findings.length} finding(s)`,
    findings.map((f) => ({ path: f.path, message: `${f.rule}: ${f.message}` })),
  );
}
