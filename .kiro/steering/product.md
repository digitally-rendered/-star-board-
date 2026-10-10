# Product — star-board

## What it is

star-board is the generated frontend track: a family of `@star-board/*` packages that turn
the OpenAPI 3.1 document of a schema-driven backend into a working React frontend. From one
document a consumer gets, without writing a page:

- TypeScript types and zod validators for every Document, Create and Update schema;
- a typed client and action hooks over shared data hooks (entity, list, view, mutation);
- default list, grid, detail, create and edit screens per schema, a stub screen per custom
  operation, routes, navigation, help text from the schema's own reasons;
- capability-gated actions that hide exactly what the backend would deny;
- the agent affordance: a rationale panel and a simulate-then-apply flow next to every form,
  backed by the backend's generated MCP tools;
- a component registry where hand-written React registers as an override at the narrowest
  granularity (field widget → group → section → screen → feature), resolved by the same
  specificity scoring the backends use.

The look comes from design tokens; the MUI theme and the Figma variables are generated from
them. Parity across REST, MCP and screens is a test.

## Who it serves

| Persona           | Need                                                           | What star-board gives them                              |
| ----------------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| Product developer | a usable screen for a new entity the moment the schema exists  | `generate` → list, detail, forms, routes                |
| Designer          | change the look everywhere without touching code               | tokens → theme; Figma components bound to contract keys |
| Agent builder     | a human can see and approve what the agent proposes            | the agent affordance over `why_` and `simulate_` tools  |
| Platform owner    | one behaviour for errors, auth, a11y, i18n across every screen | fixed once in the runtime and renderer                  |

## Non-goals

No domain logic; no backend; no second component library inside one app; no hand-edited
generated files.
