/* Dependency rule (shared/01 §1) and build levels (plan §2.1) as executable checks. */
const LEVELS = {
  core: [],
  spec: ['core'],
  tokens: ['core'],
  runtime: ['core'],
  'renderer-mui': ['core', 'runtime', 'tokens'],
  generator: ['core', 'spec'],
  testing: ['core', 'spec', 'runtime', 'renderer-mui', 'generator'],
  storybook: ['core', 'tokens', 'runtime', 'renderer-mui'],
  cli: ['core', 'spec', 'tokens', 'generator', 'testing'],
};
const forbidden = [{ name: 'no-circular', severity: 'error', from: {}, to: { circular: true } }];
for (const [pkg, allowed] of Object.entries(LEVELS)) {
  const ok = [pkg, ...allowed].map((p) => `^packages/${p}/`);
  forbidden.push({
    name: `${pkg}-imports-only-lower-levels`,
    severity: 'error',
    from: { path: `^packages/${pkg}/` },
    to: { path: '^packages/', pathNot: ok },
  });
}
forbidden.push({
  name: 'core-and-generator-no-react-or-renderer',
  severity: 'error',
  comment: 'shared/01 §1.4 — generated code imports the renderer only through the registry',
  from: { path: '^packages/(core|generator|spec)/' },
  to: { path: 'node_modules/(react|react-dom|@mui|@emotion|@tanstack|openapi-fetch)/' },
});
module.exports = {
  forbidden,
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    includeOnly: '^packages/',
    exclude: { path: '\\.test\\.tsx?$|/dist/|/\\.tsbuild/' },
  },
};
