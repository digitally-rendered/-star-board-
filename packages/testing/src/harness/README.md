# Screen test harness (renderer-dependent; not yet in this package)

The renderer-independent half of `@star-board/testing` (parity, msw, fixtures, selectors) runs
in node and imports no renderer. The screen harness is the other half and lands once
`@star-board/renderer-mui` has settled; it is the only part of this package that may import the
renderer.

## What it provides

- `renderGeneratedScreen(model, files, screen, options)` — mounts one generated screen (from
  `generate()` output, compiled in memory or from an example app) under the runtime providers:
  `QueryClientProvider`, `ServicesProvider` with an `OperationsPort` over `handlersFromModel`,
  `RegistryProvider` with `registerDefaults(registry)` from the renderer and
  `registerGenerated(registry)` from the generated `registry.ts`, `ScopeProvider` pinned to the
  schema version, `I18nProvider` over `i18n.defaults.json`.
- `axe(container)` from `vitest-axe` on every mounted screen (`a11y` project); a violation fails.
- `expectTestIds(container, selectorTable(model))` — every static id in `src/e2e/selectors.ts`
  that the screen kind owns is present (typescript/12 §7 "every interactive element has
  `data-testid`").
- A capability matrix helper: render with and without each capability of the screen's
  operation and assert the action is hidden and the state is `state.forbidden` or `state.empty`
  by posture (shared/13 §3).
- Override round trip: register one override at the screen's coordinates and assert the
  registry resolves it and the generated default disappears (typescript/12 §3).

## What it needs

- `@star-board/renderer-mui`: `registerDefaults`, `actionTestId`, the `ScreenShell` ids.
- The runtime's `createOperationsPort` wired to msw (`setupServerFromModel`) in a jsdom
  environment; this package's `vitest.config.ts` moves to `environment: 'jsdom'` for the harness
  tests only (a `// @vitest-environment jsdom` pragma per file keeps the node tests fast).
- `@testing-library/react`, `@testing-library/user-event`, `vitest-axe` (already declared).
- A way to execute generated TSX in tests: either the example app's committed
  `src/generated/` or an in-memory transpile of `generate()` output (the generator's compile test
  already proves it type-checks).
