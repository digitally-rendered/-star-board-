import { assertClean, lintTokens } from '../lint.js';
import type { ModeOptions } from '../modes.js';
import type { TokenSet } from '../schema.js';
import { buildCodeConnectMap, type CodeConnectMap } from './code-connect.js';
import { buildContract, type ContractRow } from './contract.js';
import { buildCssVariables, type CssVariables } from './css-variables.js';
import { buildFigmaVariables, type FigmaVariables } from './figma-variables.js';
import { buildMuiThemeInput, type MuiThemeInput } from './mui-theme.js';

/**
 * Bumped whenever an output format changes, so a committed build that disagrees with the
 * current builder fails the drift check (`codegen:check`) even when the tokens did not move.
 */
export const BUILD_VERSION = '1.0.0' as const;

export interface BuildOutput {
  readonly version: typeof BUILD_VERSION;
  readonly cssVariables: CssVariables;
  readonly muiTheme: MuiThemeInput;
  readonly figmaVariables: FigmaVariables;
  readonly contract: readonly ContractRow[];
  readonly codeConnect: CodeConnectMap;
}

/** Lints, then runs every builder. Pure and deterministic: equal inputs give deep-equal output. */
export function build(set: TokenSet, options: ModeOptions): BuildOutput {
  const contract = buildContract();
  assertClean(lintTokens(set, { ...options, contract }));
  return {
    version: BUILD_VERSION,
    cssVariables: buildCssVariables(set, options),
    muiTheme: buildMuiThemeInput(set),
    figmaVariables: buildFigmaVariables(set, options),
    contract,
    codeConnect: buildCodeConnectMap(contract),
  };
}
