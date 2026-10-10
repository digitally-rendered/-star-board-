import { REFERENCE_MODES, type ModeOptions } from '@star-board/tokens';
import { generatedStories, type GeneratedStoryFile } from '../generated-stories.js';

/** The default density has no token mode name; the toolbar and the matrix call it this. */
export const DEFAULT_DENSITY = 'default';

/** Colour-scheme modes of the reference token set; the first is the default. */
export const MODES: readonly string[] = REFERENCE_MODES.modes;
export const DEFAULT_MODE: string = MODES[0] ?? 'light';

export function densitiesOf(modes: ModeOptions): readonly string[] {
  return [DEFAULT_DENSITY, ...(modes.density ?? [])];
}

/** Density axis of the reference token set: `default` plus every density mode. */
export const DENSITIES: readonly string[] = densitiesOf(REFERENCE_MODES);

/** One screenshot: a story in one mode at one density (typescript/13 §5 `design/visual-regression`). */
export interface VisualCell {
  readonly storyId: string;
  readonly mode: string;
  readonly density: string;
}

/**
 * Every story × every colour-scheme mode × every density, in a stable order (stories as the
 * manifest lists them, then modes, then densities). The CI job iterates this list.
 */
export function visualMatrix(
  files: readonly GeneratedStoryFile[] = generatedStories(),
  modes: ModeOptions = REFERENCE_MODES,
): VisualCell[] {
  const densities = densitiesOf(modes);
  return files.flatMap((file) =>
    file.stories.flatMap(({ storyId }) =>
      modes.modes.flatMap((mode) => densities.map((density) => ({ storyId, mode, density }))),
    ),
  );
}

/** Where a cell's baseline lives, relative to the package root. */
export function baselinePath(cell: VisualCell): string {
  return `visual/baselines/${cell.storyId}__${cell.mode}__${cell.density}.png`;
}

/** The story iframe URL for a cell; `globals` is Storybook's `key:value;key:value` syntax. */
export function storyUrl(cell: VisualCell, base = ''): string {
  const globals = `mode:${cell.mode};density:${cell.density}`;
  return `${base}/iframe.html?viewMode=story&id=${cell.storyId}&globals=${encodeURIComponent(globals)}`;
}
