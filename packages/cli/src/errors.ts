import { StarBoardError } from '@star-board/core';
import { CommanderError } from 'commander';
import { toJson, type Io } from './io.js';
import { CliUsageError } from './usage-error.js';

export { CliUsageError } from './usage-error.js';

/** Exit codes shared by every command (README "Exit codes"). */
export const EXIT = {
  ok: 0,
  findings: 1,
  usage: 2,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

/** Error codes that mean "findings" rather than "could not run". */
const FINDING_CODES: ReadonlySet<string> = new Set(['GENERATOR_DRIFT']);

export interface ReportOptions {
  readonly json: boolean;
  readonly verbose: boolean;
}

/**
 * Prints the error on stderr and returns the exit code. A `StarBoardError` prints
 * `code: message` and its `details` as JSON; a usage error prints `usage: message`; anything
 * else prints its message. The stack appears only under `--verbose`.
 */
export function reportError(error: unknown, io: Io, options: ReportOptions): ExitCode {
  if (error instanceof CommanderError) {
    // commander already wrote its own message through configureOutput.
    return error.exitCode === 0 ? EXIT.ok : EXIT.usage;
  }
  if (error instanceof StarBoardError) {
    const code = FINDING_CODES.has(error.code) ? EXIT.findings : EXIT.usage;
    emit(io, options, error.code, error.message, error.details, error);
    return code;
  }
  if (error instanceof CliUsageError) {
    emit(io, options, 'usage', error.message, error.details, error);
    return EXIT.usage;
  }
  const message = error instanceof Error ? error.message : String(error);
  emit(io, options, 'error', message, {}, error instanceof Error ? error : undefined);
  return EXIT.usage;
}

function emit(
  io: Io,
  options: ReportOptions,
  code: string,
  message: string,
  details: Readonly<Record<string, unknown>>,
  error: Error | undefined,
): void {
  if (options.json) {
    io.stderr(toJson({ error: { code, message, details } }));
  } else {
    io.stderr(`${code}: ${message}\n`);
    if (Object.keys(details).length > 0) io.stderr(toJson(details));
  }
  if (options.verbose && error?.stack) io.stderr(`${error.stack}\n`);
}
