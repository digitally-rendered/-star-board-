# petstore-ui/src

`generated/` is written by `pnpm generate` from `fixtures/petstore.json` and never edited (the root
`codegen:check` diffs it). `features/<schema>/` holds the overrides: `components/` (domain rules),
`hooks/` (application rules) and `index.ts` with `registry.register(...)` calls only;
`tools/fitness.ts` checks both trees by sub-folder. Everything else is the composition root
(`app.tsx`, `main.tsx`, `Layout.tsx`), the build-time model (`model.ts`), the msw dev mode
(`msw/browser.ts`), the shared test wiring (`testing.ts`) and the tests.
