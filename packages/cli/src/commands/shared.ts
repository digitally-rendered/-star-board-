import { resolve } from 'node:path';
import type { GenerateOptions } from '@star-board/generator';
import { CliUsageError } from '../errors.js';
import { optionBoolean, optionString, type Context, type RawOptions } from '../io.js';

/** The inputs `generate` and `check` share: flags first, then `star-board.config.json`. */
export interface DocumentInputs {
  /** Path (resolved against cwd) or http(s) URL. */
  readonly document: string;
  readonly options: GenerateOptions;
}

function required(ctx: Context, raw: RawOptions, key: 'document' | 'out' | 'features'): string {
  const flag = optionString(raw, key);
  const fromConfig = ctx.config[key];
  const value = flag ?? (typeof fromConfig === 'string' ? fromConfig : undefined);
  if (value === undefined) {
    throw new CliUsageError(
      `missing --${key} (pass the flag or set "${key}" in star-board.config.json)`,
      {
        option: key,
      },
    );
  }
  return value;
}

export function resolveDocumentInputs(ctx: Context, raw: RawOptions): DocumentInputs {
  const document = required(ctx, raw, 'document');
  const out = resolve(ctx.cwd, required(ctx, raw, 'out'));
  const features = resolve(ctx.cwd, required(ctx, raw, 'features'));
  const renderer = optionString(raw, 'renderer') ?? ctx.config.renderer;
  const i18n = optionBoolean(raw, 'i18n') ?? ctx.config.i18n;
  const options: GenerateOptions = {
    out,
    features,
    ...(renderer === undefined ? {} : { renderer }),
    ...(i18n === undefined ? {} : { i18n }),
  };
  return { document, options };
}
