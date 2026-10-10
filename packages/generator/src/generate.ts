import { createHash } from 'node:crypto';
import type { FeatureModel } from '@star-board/core';
import {
  emitI18n,
  emitI18nJson,
  emitIndex,
  emitNav,
  emitRegistry,
  emitRoutes,
  emitSetup,
} from './emit/app.js';
import { emitClient, emitPaths } from './emit/client.js';
import { emitActions, emitApplicationSupport, emitScreenHooks } from './emit/hooks.js';
import { emitAgentPanelSlot, emitContract, emitScreen } from './emit/screens.js';
import { stableJson, type GeneratedFile } from './emit/support.js';
import { emitTypes } from './emit/types.js';
import { emitZod } from './emit/zod.js';
import { plan, type GenerationPlan } from './plan/plan.js';
import { BUILD_VERSION } from './version.js';

export type { GeneratedFile } from './emit/support.js';

export interface GenerateOptions {
  /** Output root, e.g. `src/generated`; every emitted path is relative to it. */
  out: string;
  /** Override home, e.g. `src/features`; never read, never written. */
  features: string;
  /** The renderer package whose `registerDefaults` the setup file calls. */
  renderer?: string;
  /** Emit `i18n.defaults.json` and wire `createI18n`; default true. */
  i18n?: boolean;
}

export const DEFAULT_RENDERER = '@star-board/renderer-mui';
export const MANIFEST_PATH = 'manifest.json';

export interface Manifest {
  buildVersion: string;
  source: { title: string; version: string };
  files: { path: string; sha256: string }[];
}

/**
 * Pure: FeatureModel → files. Nothing is read or written; `writeFiles` does the writing and
 * refuses any path outside `out` or inside `features` (hexagonal-rules typescript/12 §3).
 */
export function generate(model: FeatureModel, opts: GenerateOptions): GeneratedFile[] {
  const generationPlan = plan(model);
  return emitAll(model, generationPlan, opts);
}

export function emitAll(
  model: FeatureModel,
  generationPlan: GenerationPlan,
  opts: GenerateOptions,
): GeneratedFile[] {
  const source = generationPlan.source;
  const withI18n = opts.i18n ?? true;
  const files: GeneratedFile[] = [
    emitContract(source),
    emitAgentPanelSlot(source),
    emitApplicationSupport(source),
  ];
  for (const schema of generationPlan.schemas) {
    const entry = model.schemas[schema.name];
    if (entry === undefined) continue;
    const variants = { document: entry.document, create: entry.create, update: entry.update };
    files.push(emitTypes(schema, variants, source), emitZod(schema, variants, source));
    const seen = new Set<string>();
    for (const screen of schema.screens) {
      if (seen.has(screen.file)) continue;
      seen.add(screen.file);
      files.push(emitScreen({ plan: generationPlan, schema, screen, source }));
    }
    files.push(emitActions(schema, source), emitScreenHooks(generationPlan, schema, source));
  }
  files.push(
    emitPaths(generationPlan, model, source),
    emitClient(source),
    emitRegistry(generationPlan, source),
    emitRoutes(generationPlan, source),
    emitNav(generationPlan, source),
    emitSetup(opts.renderer ?? DEFAULT_RENDERER, source),
    emitI18n(generationPlan, source, withI18n),
  );
  if (withI18n) files.push(emitI18nJson(generationPlan));
  files.push(
    emitIndex(
      generationPlan,
      source,
      files.map((f) => f.path),
    ),
  );
  files.sort((a, b) => a.path.localeCompare(b.path));
  files.push({ path: MANIFEST_PATH, contents: stableJson(manifestOf(files, source)) });
  return files;
}

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function manifestOf(
  files: readonly GeneratedFile[],
  source: { title: string; version: string },
): Manifest {
  return {
    buildVersion: BUILD_VERSION,
    source: { title: source.title, version: source.version },
    files: files
      .filter((f) => f.path !== MANIFEST_PATH)
      .map((f) => ({ path: f.path, sha256: sha256(f.contents) }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  };
}
