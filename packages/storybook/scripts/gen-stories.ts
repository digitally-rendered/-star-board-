/**
 * Writes `src/stories/<key>.stories.tsx` for every renderer manifest entry and removes story files
 * for keys the manifest no longer lists. Run with `pnpm -F @star-board/storybook generate:stories`
 * after `pnpm build` (Node loads the workspace packages from their `dist`); without a build,
 * `pnpm -F @star-board/storybook test -u` regenerates the same files through the drift test.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generatedStories, renderStoriesFile } from '../src/generated-stories.ts';

const src = resolve(import.meta.dirname, '../src');
const files = generatedStories();
mkdirSync(resolve(src, 'stories'), { recursive: true });

const expected = new Set(files.map((f) => f.fileName));
for (const name of readdirSync(resolve(src, 'stories'))) {
  if (name.endsWith('.stories.tsx') && !expected.has(`stories/${name}`)) {
    rmSync(resolve(src, 'stories', name));
    console.log(`removed src/stories/${name}`);
  }
}
for (const file of files) {
  writeFileSync(resolve(src, file.fileName), renderStoriesFile(file));
  console.log(`wrote src/${file.fileName} (${file.stories.length} stories)`);
}
