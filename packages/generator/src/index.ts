/** @star-board/generator — L4. FeatureModel to files: types, zod, typed client, action hooks, default screens, registry, routes, nav, i18n defaults; pure generate() and a drift check(); never writes overrides. */
export const PACKAGE = '@star-board/generator' as const;
export const LAYER = 'L4' as const;
export { BUILD_VERSION } from './version.js';
export {
  plan,
  COMMON_I18N,
  type ActionKind,
  type ActionPlan,
  type ColumnPlan,
  type FieldPlan,
  type FormFieldPlan,
  type GenerationPlan,
  type NavEntry,
  type RoutePlan,
  type SchemaPlan,
  type ScreenKind,
  type ScreenPlan,
  type ViewColumnsPlan,
} from './plan/plan.js';
export {
  generate,
  emitAll,
  manifestOf,
  sha256,
  DEFAULT_RENDERER,
  MANIFEST_PATH,
  type GenerateOptions,
  type GeneratedFile,
  type Manifest,
} from './generate.js';
export { tsType } from './emit/types.js';
export { zodExpr } from './emit/zod.js';
export { writeFiles, resolveOutputPath } from './write.js';
export {
  check,
  checkFiles,
  assertNoDrift,
  nodeDisk,
  type Disk,
  type DiskReader,
  type Drift,
  type DriftKind,
} from './check.js';
