#!/usr/bin/env node
/** Layer classification for a consuming app (typescript/12 §5): generated/* and features/<schema>/* are classified by sub-folder
 *  so the React hexagon import rules apply to both. Implemented in plan task 12; this stub documents the contract. */
export type Layer = 'domain' | 'application' | 'adapters' | 'registry';
export function classify(path: string): Layer | null {
  const m =
    /(?:^|\/)(?:generated|features\/[^/]+)\/(domain|components|application|hooks|adapters)\//.exec(
      path,
    );
  if (!m) return /registry\.ts$|features\/[^/]+\/index\.ts$/.test(path) ? 'registry' : null;
  const seg = m[1];
  return seg === 'components' ? 'domain' : seg === 'hooks' ? 'application' : (seg as Layer);
}
