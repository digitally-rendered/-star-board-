import { defineConfig } from 'tsdown';
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    browser: 'src/browser.ts',
    'harness/index': 'src/harness/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  fixedExtension: false,
  sourcemap: true,
});
