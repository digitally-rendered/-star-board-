# Screen test harness

Exported as `@star-board/testing/harness` (a subpath, so the node-only root entry never loads
React, the renderer or vitest-axe). See the package README, section "Screen harness", for the API;
`harness.test.tsx` here covers it and `examples/petstore-ui/src/*.test.tsx` use it against the
generated petstore screens. Needs jsdom: `// @vitest-environment jsdom` per file.

`HarnessOptions.locale` sets the i18n locale (formatters, plural rules) and `onUnauthorized`
observes the client's 401 path (typescript/05 §5: called once per unauthorized response), so an
example test can assert the redirect-once behaviour against msw.
