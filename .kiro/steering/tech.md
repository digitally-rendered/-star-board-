# Tech — star-board

- TypeScript 5.9 strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
  `verbatimModuleSyntax`), ESM only, `moduleResolution: NodeNext`, project references, tsdown.
- React 19, MUI 9 with the CSS-variables theme, MUI X DataGrid (community), React Hook Form +
  zod 4, TanStack Query 5, openapi-fetch, react-router 8, Vite 8.
- Tests: Vitest 5 projects (unit, contract, architecture, property via fast-check, a11y via
  vitest-axe), Testing Library, msw 3, Playwright with `@axe-core/playwright`, Storybook 10
  with screenshot baselines.
- Enforcement: ESLint 10 flat config with typescript-eslint and eslint-plugin-boundaries,
  dependency-cruiser (`check:arch`), `check:waves`, `check:ratchet`, `check:noskip`,
  `codegen:check`, husky + lint-staged, Changesets.
- Tokens: DTCG JSON, style-dictionary 5 with Tokens Studio transforms, Figma Code Connect.
- Node ≥ 22 (develop on 26), pnpm.
