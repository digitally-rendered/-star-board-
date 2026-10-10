# petstore-ui

The consuming app of the plan: everything a user sees comes from `star-board generate` over
`fixtures/petstore.json` plus three overrides in `src/features/pet`.

```bash
pnpm -F @star-board/cli build          # the CLI runs from dist
pnpm -F @star-board/example-petstore-ui generate   # → src/generated (committed, never edited)
pnpm -F @star-board/example-petstore-ui dev        # http://localhost:5173, msw answers /api
pnpm -F @star-board/example-petstore-ui test       # screens + axe, capability matrix, overrides, workflow
pnpm -F @star-board/example-petstore-ui test:e2e   # Playwright (needs `pnpm exec playwright install chromium`)
pnpm codegen:check                                 # from the root: no drift under src/generated
```

## How it is wired

- `vite.config.ts` loads the OpenAPI document through the spec loader at build time and serves
  the FeatureModel as `virtual:star-board/model` (`src/model.ts` validates it); the browser bundle
  never carries the loader. One input, as in production.
- `src/app.tsx` is the composition root: `createServices` (runtime `createClient('/api')`, a demo
  principal with every capability), `createAppRegistry` (renderer defaults → generated screens →
  `registerPetOverrides`), `createAppI18n(messages, locale)` (runtime + renderer + generated
  defaults, a translation table and the formatters' locale), `createAppTheme` (the reference
  tokens → MUI theme and CSS variables), `appRoutes` (the generated routes under `Layout`, `/` →
  the first nav entry).
- `?lang=fr` switches the locale (`src/i18n/locale.ts`, `main.tsx`): a small French table over the
  generated, renderer and runtime keys shows that every string follows, because generated
  components read `useT()` from the provider (typescript/05 §7).
- `Layout.tsx` mounts the renderer's `SkipToContent` first, labels the navigation through `t`, and
  owns the `main` landmark the skip link targets. The generated create and edit containers hold
  navigation while a form is dirty and ask through the renderer's `UnsavedChangesDialog`
  (typescript/05 §9).
- Installable (typescript/05 §6): `index.html` links `public/generated/manifest.webmanifest`
  (standalone, SVG icon placeholders under `public/generated/icons/`); no service worker and no
  offline data. Under the `sm` breakpoint the generated list and grid render as cards.
- `src/msw/browser.ts` starts a service worker with `handlersFromModel` seeded with fixtures when
  `VITE_MSW` is not `0` (the worker script is vendored under `public/generated/`, Vite's `publicDir`).
- `src/features/pet`: `field.text` for `pet`/`name` (a character counter around the default
  field), `list.column.enum` for `pet`/`status` (a chip coloured from the theme palette) and
  `screen.detail` for `pet`/`pet_get` (a card that keeps the generated container hook, actions and
  page-object ids). `index.ts` registers them and nothing else.

## Tests

`src/screens.test.tsx` mounts every generated screen with fixture data through the registry and
runs axe; `src/capabilities.test.tsx` is the hide/deny matrix (per operation, a principal without
the capability sees no action or screen and the handler answers 404 by posture, with it both are
there); `src/overrides.test.tsx` renders the three overrides in place of the defaults and proves a
generator run leaves `src/features` byte-identical and the committed tree drift-free;
`src/workflow.test.tsx` runs list → create → detail → edit (If-Match sent, version bumped) →
delete with confirmation → list → 404. `src/i18n.test.tsx` is the locale smoke test (`?lang=fr`
reaches a generated screen and the frame; translated keys all exist); `src/unsaved.test.tsx` holds
a dirty create form and lets a clean one go; `src/session.test.tsx` has msw answer 401 and asserts
`onUnauthorized` fires once; `src/pwa.test.ts` checks the manifest, icons and viewport.
`e2e/petstore.spec.ts` is the same workflow in a browser with `@axe-core/playwright`; it is not
part of `pnpm test`.
