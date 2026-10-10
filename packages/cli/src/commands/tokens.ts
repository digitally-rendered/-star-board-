import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  build,
  buildContract,
  lintTokens,
  parseTokens,
  REFERENCE_MODES,
  type BuildOutput,
  type LintFinding,
  type ModeOptions,
  type TokenSet,
} from '@star-board/tokens';
import { CliUsageError, EXIT, type ExitCode } from '../errors.js';
import {
  csv,
  optionString,
  printJson,
  printLines,
  toJson,
  type Context,
  type RawOptions,
} from '../io.js';

/** File per build output, in the order they are written. */
export const TOKEN_OUTPUTS: readonly { file: string; pick: (out: BuildOutput) => unknown }[] = [
  { file: 'theme.css-vars.json', pick: (out) => out.cssVariables },
  { file: 'mui-theme.json', pick: (out) => out.muiTheme },
  { file: 'figma-variables.json', pick: (out) => out.figmaVariables },
  { file: 'contract.json', pick: (out) => out.contract },
  { file: 'code-connect.json', pick: (out) => out.codeConnect },
];

interface TokenInputs {
  readonly file: string;
  readonly set: TokenSet;
  readonly modes: ModeOptions;
}

function loadTokenInputs(ctx: Context, raw: RawOptions): TokenInputs {
  const fromFlag = optionString(raw, 'tokens');
  const file = fromFlag ?? ctx.config.tokens?.file;
  if (file === undefined) {
    throw new CliUsageError(
      'missing --tokens (pass the flag or set "tokens.file" in star-board.config.json)',
      {
        option: 'tokens',
      },
    );
  }
  const path = resolve(ctx.cwd, file);
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, 'utf8'));
  } catch (cause) {
    throw new CliUsageError(`Cannot read token file ${path} as JSON`, {
      path,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
  }
  return { file: path, set: parseTokens(json), modes: resolveModes(ctx, raw) };
}

/**
 * `--modes` and `--density` win over `tokens.modes` / `tokens.density` in the config, which win
 * over the reference set's modes. Naming colour modes without a density clears the density
 * axis, so a set with no dense mode is not asked for one.
 */
export function resolveModes(ctx: Context, raw: RawOptions): ModeOptions {
  const flagModes = csv(optionString(raw, 'modes'));
  const flagDensity = csv(optionString(raw, 'density'));
  const modes = flagModes ?? ctx.config.tokens?.modes ?? REFERENCE_MODES.modes;
  if (modes.length === 0) throw new CliUsageError('--modes needs at least one mode', {});
  const density =
    flagDensity ??
    ctx.config.tokens?.density ??
    (flagModes === undefined ? REFERENCE_MODES.density : []);
  return { modes, ...(density === undefined ? {} : { density }) };
}

function lint(inputs: TokenInputs): readonly LintFinding[] {
  return lintTokens(inputs.set, { ...inputs.modes, contract: buildContract() });
}

function printFindings(ctx: Context, file: string, findings: readonly LintFinding[]): void {
  printLines(
    ctx,
    findings.map((f) => `${f.rule} ${f.path}: ${f.message}`),
  );
  printLines(ctx, [`tokens lint: ${findings.length} finding(s) in ${file}`]);
}

/** `star-board tokens lint`: print every finding; exit 1 on any. */
export function runTokensLint(ctx: Context, raw: RawOptions): ExitCode {
  const inputs = loadTokenInputs(ctx, raw);
  const findings = lint(inputs);
  const code = findings.length === 0 ? EXIT.ok : EXIT.findings;
  if (ctx.json) {
    printJson(ctx, {
      command: 'tokens lint',
      tokens: inputs.file,
      count: findings.length,
      findings,
    });
    return code;
  }
  if (findings.length === 0) printLines(ctx, [`tokens lint: ${inputs.file} is clean`]);
  else printFindings(ctx, inputs.file, findings);
  return code;
}

/**
 * `star-board tokens build`: lint, build and write the five outputs under `--out`. Without
 * `--out`, `--json` prints the whole build to stdout; otherwise `--out` is required.
 */
export function runTokensBuild(ctx: Context, raw: RawOptions): ExitCode {
  const inputs = loadTokenInputs(ctx, raw);
  const outFlag = optionString(raw, 'out') ?? ctx.config.tokens?.out;
  const out = outFlag === undefined ? undefined : resolve(ctx.cwd, outFlag);
  if (out === undefined && !ctx.json) {
    throw new CliUsageError(
      'missing --out (pass the flag, set "tokens.out" in star-board.config.json, or use --json to print the build)',
      {
        option: 'out',
      },
    );
  }
  const findings = lint(inputs);
  if (findings.length > 0) {
    if (ctx.json) {
      printJson(ctx, {
        command: 'tokens build',
        tokens: inputs.file,
        count: findings.length,
        findings,
      });
    } else {
      printFindings(ctx, inputs.file, findings);
    }
    return EXIT.findings;
  }
  const output = build(inputs.set, inputs.modes);
  if (out === undefined) {
    printJson(ctx, { command: 'tokens build', tokens: inputs.file, build: output });
    return EXIT.ok;
  }
  mkdirSync(out, { recursive: true });
  const written: string[] = [];
  for (const { file, pick } of TOKEN_OUTPUTS) {
    const target = join(out, file);
    writeFileSync(target, toJson(pick(output)), 'utf8');
    written.push(target);
  }
  if (ctx.json) {
    printJson(ctx, {
      command: 'tokens build',
      tokens: inputs.file,
      out,
      version: output.version,
      modes: inputs.modes,
      files: written,
    });
    return EXIT.ok;
  }
  printLines(ctx, written);
  printLines(ctx, [
    `tokens build: ${written.length} file(s) to ${out} (builder ${output.version})`,
  ]);
  return EXIT.ok;
}
