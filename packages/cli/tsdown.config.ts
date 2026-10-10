import { defineConfig } from 'tsdown';
export default defineConfig({
  // bin.ts keeps its shebang; tsdown preserves it in the entry chunk and marks it executable.
  entry: ['src/index.ts', 'src/bin.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  fixedExtension: false,
  sourcemap: true,
});
