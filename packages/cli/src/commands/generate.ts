import {
  generate,
  MANIFEST_PATH,
  resolveOutputPath,
  sha256,
  writeFiles,
} from '@star-board/generator';
import { EXIT, type ExitCode } from '../errors.js';
import { optionBoolean, printJson, printLines, type Context, type RawOptions } from '../io.js';
import { loadModel } from '../source.js';
import { resolveDocumentInputs } from './shared.js';

/**
 * `star-board generate`: document → FeatureModel → files under `out`. `--dry-run` lists what
 * would be written and writes nothing; the override home `features` is never touched.
 */
export async function runGenerate(ctx: Context, raw: RawOptions): Promise<ExitCode> {
  const { document, options } = resolveDocumentInputs(ctx, raw);
  const dryRun = optionBoolean(raw, 'dryRun') ?? false;
  const model = await loadModel(document, ctx.cwd);
  const files = generate(model, options);
  const manifest = files.find((file) => file.path === MANIFEST_PATH);
  const manifestHash = manifest === undefined ? null : sha256(manifest.contents);
  // Surface GENERATOR_OUT_OF_SURFACE on a dry run too, before anything would be written.
  for (const file of files) resolveOutputPath(file.path, options);
  if (!dryRun) writeFiles(files, options);
  const paths = files.map((file) => file.path);
  if (ctx.json) {
    printJson(ctx, {
      command: 'generate',
      document,
      out: options.out,
      dryRun,
      count: files.length,
      manifest: manifestHash,
      source: { title: model.title, version: model.version },
      files: paths,
    });
    return EXIT.ok;
  }
  if (dryRun) {
    printLines(ctx, paths);
    printLines(ctx, [
      `dry run: ${files.length} file(s) would be written to ${options.out} (manifest ${manifestHash ?? 'n/a'})`,
    ]);
  } else {
    printLines(ctx, [
      `generated ${files.length} file(s) to ${options.out} from ${model.title}@${model.version} (manifest ${manifestHash ?? 'n/a'})`,
    ]);
  }
  return EXIT.ok;
}
