import { Command } from 'commander';
import { runCheck } from './commands/check.js';
import { runGenerate } from './commands/generate.js';
import { runInit } from './commands/init.js';
import { runParity } from './commands/parity.js';
import { runTokensBuild, runTokensLint } from './commands/tokens.js';
import { loadConfig } from './config.js';
import { EXIT, reportError, type ExitCode } from './errors.js';
import { defaultIo, optionBoolean, type Context, type Io, type RawOptions } from './io.js';

export const CLI_VERSION = '0.0.1';

/** Builds a Context from the global flags of the invoked command and the config in cwd. */
function contextFor(io: Io, command: Command): Context {
  const globals: RawOptions = command.optsWithGlobals();
  return {
    ...io,
    json: optionBoolean(globals, 'json') ?? false,
    verbose: optionBoolean(globals, 'verbose') ?? false,
    config: loadConfig(io.cwd),
  };
}

function documentOptions(command: Command): Command {
  return command
    .option('--document <path|url>', 'OpenAPI 3.1 document: a path or an http(s) URL')
    .option('--out <dir>', 'output directory, e.g. src/generated')
    .option('--features <dir>', 'override home, e.g. src/features; never written')
    .option('--renderer <pkg>', 'renderer package whose registerDefaults setup.ts calls');
}

function tokenOptions(command: Command): Command {
  return command
    .option('--tokens <file>', 'DTCG token file')
    .option('--modes <a,b,c>', 'colour-scheme modes, the first is the default')
    .option('--density <a,b>', 'density modes (dimension tokens only)');
}

/** The commander program; `run` wires it to an Io and maps every outcome to an exit code. */
export function buildProgram(io: Io, onExit: (code: ExitCode) => void): Command {
  const program = new Command('star-board')
    .description('Generate and check the human surface of one OpenAPI 3.1 document')
    .version(CLI_VERSION)
    .option('--json', 'machine-readable output on stdout (errors as JSON on stderr)')
    .option('--verbose', 'print stack traces with errors')
    .exitOverride()
    .configureOutput({ writeOut: io.stdout, writeErr: io.stderr })
    .showHelpAfterError(false);

  documentOptions(program.command('generate'))
    .description('document → src/generated/**; the override home is never touched')
    .option('--no-i18n', 'skip i18n.defaults.json and inline the defaults')
    .option('--dry-run', 'list the files that would be written; write nothing')
    .action(async (_options: unknown, command: Command) => {
      onExit(await runGenerate(contextFor(io, command), command.optsWithGlobals()));
    });

  documentOptions(program.command('check'))
    .description('regenerate in memory and diff against --out; exit 1 on drift')
    .option('--no-i18n', 'match a generate run that used --no-i18n')
    .action(async (_options: unknown, command: Command) => {
      onExit(await runCheck(contextFor(io, command), command.optsWithGlobals()));
    });

  program
    .command('init')
    .argument('<dir>', 'directory to initialise')
    .description('write a consumer skeleton: config, features README, main.tsx and App.tsx')
    .option('--document <path>', 'document path recorded in star-board.config.json', 'openapi.json')
    .option('--renderer <pkg>', 'renderer package recorded in star-board.config.json')
    .action((dir: string, _options: unknown, command: Command) => {
      onExit(runInit(contextFor(io, command), dir, command.optsWithGlobals()));
    });

  const tokens = program
    .command('tokens')
    .description('design tokens: build the theme outputs or lint');
  tokenOptions(tokens.command('build'))
    .description(
      'write theme.css-vars.json, mui-theme.json, figma-variables.json, contract.json, code-connect.json',
    )
    .option('--out <dir>', 'output directory; with --json and no --out the build prints to stdout')
    .action((_options: unknown, command: Command) => {
      onExit(runTokensBuild(contextFor(io, command), command.optsWithGlobals()));
    });
  tokenOptions(tokens.command('lint'))
    .description('print the semantic lint findings; exit 1 on any')
    .action((_options: unknown, command: Command) => {
      onExit(runTokensLint(contextFor(io, command), command.optsWithGlobals()));
    });

  program
    .command('parity')
    .description('document ↔ generated ↔ MCP tools/list parity (placeholder)')
    .action((_options: unknown, command: Command) => {
      onExit(runParity(contextFor(io, command)));
    });

  return program;
}

/**
 * Runs the CLI in-process. `argv` holds the user arguments only (what follows the script in
 * `process.argv`). Never calls `process.exit`; the bin does, with the returned code.
 */
export async function run(argv: readonly string[], io: Partial<Io> = {}): Promise<ExitCode> {
  const resolved: Io = { ...defaultIo(), ...io };
  let code: ExitCode = EXIT.ok;
  const program = buildProgram(resolved, (exit) => {
    code = exit;
  });
  try {
    await program.parseAsync([...argv], { from: 'user' });
    return code;
  } catch (error) {
    return reportError(error, resolved, {
      json: argv.includes('--json'),
      verbose: argv.includes('--verbose'),
    });
  }
}
