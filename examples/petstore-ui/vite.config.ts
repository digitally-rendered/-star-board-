import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { loadDocument } from '@star-board/spec';
import { defineConfig, type Plugin } from 'vite';

/** The document this app is generated from: one input, read at build time. */
export const DOCUMENT = fileURLToPath(new URL('../../fixtures/petstore.json', import.meta.url));

export const MODEL_MODULE = 'virtual:star-board/model';

/**
 * Loads the OpenAPI document through the spec loader at build time and serves the FeatureModel as
 * a virtual module, so the browser bundle never carries the loader (it reads files) and the app
 * still has exactly one input. Edit the document, restart, and the model follows.
 */
export function featureModelPlugin(documentPath: string): Plugin {
  const resolved = `\0${MODEL_MODULE}`;
  return {
    name: 'star-board:feature-model',
    resolveId(id) {
      return id === MODEL_MODULE ? resolved : null;
    },
    load(id) {
      if (id !== resolved) return null;
      this.addWatchFile(documentPath);
      return `export default ${JSON.stringify(loadDocument(documentPath))};\n`;
    },
  };
}

export default defineConfig({
  plugins: [react(), featureModelPlugin(DOCUMENT)],
  // Workspace packages resolve to their sources (tsconfig.base.json uses the same condition).
  resolve: { conditions: ['star-board-source'] },
  // The msw worker script (`msw init`, a vendored file) lives under public/generated so lint skips it.
  publicDir: 'public/generated',
  server: { port: 5173 },
  preview: { port: 4173 },
});
