import type { StarBoardConfig } from './config.js';

/** Where a run reads and writes; tests inject buffers and a temporary cwd. */
export interface Io {
  /** Directory that relative paths and `star-board.config.json` resolve against. */
  readonly cwd: string;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export function defaultIo(): Io {
  return {
    cwd: process.cwd(),
    stdout: (text) => {
      process.stdout.write(text);
    },
    stderr: (text) => {
      process.stderr.write(text);
    },
  };
}

/** One command's view of the world: io, the global flags and the loaded config. */
export interface Context extends Io {
  readonly json: boolean;
  readonly verbose: boolean;
  readonly config: StarBoardConfig;
}

/** Raw commander option values, narrowed before use. */
export type RawOptions = Readonly<Record<string, unknown>>;

export function optionString(raw: RawOptions, key: string): string | undefined {
  const value = raw[key];
  return typeof value === 'string' ? value : undefined;
}

export function optionBoolean(raw: RawOptions, key: string): boolean | undefined {
  const value = raw[key];
  return typeof value === 'boolean' ? value : undefined;
}

/** `a,b,c` → `['a', 'b', 'c']`; blanks dropped. */
export function csv(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts;
}

/** Pretty JSON with a trailing newline; the one shape every `--json` output and written file uses. */
export function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function printJson(ctx: Context, value: unknown): void {
  ctx.stdout(toJson(value));
}

export function printLines(ctx: Context, lines: readonly string[]): void {
  for (const line of lines) ctx.stdout(`${line}\n`);
}
