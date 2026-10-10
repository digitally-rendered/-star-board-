import { check } from '@star-board/generator';
import { EXIT, type ExitCode } from '../errors.js';
import { printJson, printLines, type Context, type RawOptions } from '../io.js';
import { loadModel } from '../source.js';
import { resolveDocumentInputs } from './shared.js';

/** `star-board check`: regenerate in memory and diff against `out`; exit 1 on any drift. */
export async function runCheck(ctx: Context, raw: RawOptions): Promise<ExitCode> {
  const { document, options } = resolveDocumentInputs(ctx, raw);
  const model = await loadModel(document, ctx.cwd);
  const drifts = check(model, options);
  const code = drifts.length === 0 ? EXIT.ok : EXIT.findings;
  if (ctx.json) {
    printJson(ctx, { command: 'check', document, out: options.out, count: drifts.length, drifts });
    return code;
  }
  if (drifts.length === 0) {
    printLines(ctx, [`check: ${options.out} matches ${model.title}@${model.version}`]);
    return code;
  }
  printLines(
    ctx,
    drifts.map((drift) => `${drift.kind.padEnd(7)} ${drift.path}`),
  );
  printLines(ctx, [
    `check: ${drifts.length} drifted file(s) under ${options.out}; run \`star-board generate\``,
  ]);
  return code;
}
