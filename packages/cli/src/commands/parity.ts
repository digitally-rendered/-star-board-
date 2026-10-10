import { EXIT, type ExitCode } from '../errors.js';
import { printJson, type Context } from '../io.js';

export const PARITY_MESSAGE = 'parity: available once @star-board/testing ships';

/** Placeholder until `@star-board/testing` ships its parity suite; always exits 2. */
export function runParity(ctx: Context): ExitCode {
  if (ctx.json)
    printJson(ctx, { command: 'parity', error: { code: 'unavailable', message: PARITY_MESSAGE } });
  else ctx.stdout(`${PARITY_MESSAGE}\n`);
  return EXIT.usage;
}
