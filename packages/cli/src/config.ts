import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CliUsageError } from './usage-error.js';

export const CONFIG_FILE = 'star-board.config.json';

/** Token-command defaults; nested so `out` does not collide with the generator's `out`. */
export interface TokensConfig {
  readonly file?: string;
  readonly out?: string;
  readonly modes?: readonly string[];
  readonly density?: readonly string[];
}

/**
 * `star-board.config.json` in the working directory. Every command reads it for the flags that
 * were omitted; a flag always wins. Paths are relative to the directory holding the file.
 */
export interface StarBoardConfig {
  readonly document?: string;
  readonly out?: string;
  readonly features?: string;
  readonly renderer?: string;
  readonly i18n?: boolean;
  readonly tokens?: TokensConfig;
}

/** Reads the config from `cwd`; `{}` when absent; a usage error when unreadable or mistyped. */
export function loadConfig(cwd: string): StarBoardConfig {
  const path = join(cwd, CONFIG_FILE);
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new CliUsageError(`${CONFIG_FILE} is not valid JSON`, {
      path,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
  }
  return parseConfig(parsed, path);
}

export function parseConfig(value: unknown, path: string): StarBoardConfig {
  const record = asRecord(value, path, '');
  const config: StarBoardConfig = {
    ...optionalString(record, 'document', path),
    ...optionalString(record, 'out', path),
    ...optionalString(record, 'features', path),
    ...optionalString(record, 'renderer', path),
    ...optionalBoolean(record, 'i18n', path),
    ...optionalTokens(record, path),
  };
  return config;
}

function asRecord(value: unknown, path: string, at: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CliUsageError(`${CONFIG_FILE}${at === '' ? '' : ` ${at}`} must be a JSON object`, {
      path,
      at,
    });
  }
  return value as Record<string, unknown>;
}

function optionalString<K extends string>(
  record: Record<string, unknown>,
  key: K,
  path: string,
  at = key,
): Partial<Record<K, string>> {
  const value = record[key];
  if (value === undefined) return {};
  if (typeof value !== 'string') {
    throw new CliUsageError(`${CONFIG_FILE} ${at} must be a string`, { path, at, value });
  }
  return { [key]: value } as Partial<Record<K, string>>;
}

function optionalBoolean<K extends string>(
  record: Record<string, unknown>,
  key: K,
  path: string,
): Partial<Record<K, boolean>> {
  const value = record[key];
  if (value === undefined) return {};
  if (typeof value !== 'boolean') {
    throw new CliUsageError(`${CONFIG_FILE} ${key} must be a boolean`, { path, at: key, value });
  }
  return { [key]: value } as Partial<Record<K, boolean>>;
}

function optionalStringList(
  record: Record<string, unknown>,
  key: string,
  path: string,
  at: string,
): readonly string[] | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    throw new CliUsageError(`${CONFIG_FILE} ${at} must be an array of strings`, {
      path,
      at,
      value,
    });
  }
  return value;
}

function optionalTokens(
  record: Record<string, unknown>,
  path: string,
): Pick<StarBoardConfig, 'tokens'> {
  const value = record.tokens;
  if (value === undefined) return {};
  const tokens = asRecord(value, path, 'tokens');
  const modes = optionalStringList(tokens, 'modes', path, 'tokens.modes');
  const density = optionalStringList(tokens, 'density', path, 'tokens.density');
  return {
    tokens: {
      ...optionalString(tokens, 'file', path, 'tokens.file'),
      ...optionalString(tokens, 'out', path, 'tokens.out'),
      ...(modes === undefined ? {} : { modes }),
      ...(density === undefined ? {} : { density }),
    },
  };
}
