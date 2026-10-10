# Overrides

Every hand-written React screen, field, column, action or state lives in a component registry
as an override. A restyled default is a registration, never a copy. This is hexagonal-rules
`typescript/12` §3 with the backend's scope resolution (`shared/01` §6a) and `role` in the
channel slot.

## The registry

`ComponentRegistry` lives in `@star-board/core` (L0, no React). A registration is keyed by
`(key, schema, target, scope)`:

| Field       | Meaning                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------- |
| `key`       | a `ComponentKey`: `field.*`, `list.column.<type>`, `action.*`, `state.*`, `screen.*`, `help.inline` |
| `schema`    | the schema name (`pet`) or `'*'`                                                                    |
| `target`    | the operation id (`pet_get`), field name (`name`) or slot, or `'*'`                                 |
| `scope`     | `{ version?, role? }`; both optional                                                                |
| `component` | the React component; the registry holds it untyped                                                  |
| `source`    | `'generated'` or `'override'`                                                                       |

### Specificity

`specificityOf(scope)` scores the scope exactly as the backends score `{version, channel}`:

| Scope declares                          | Specificity                |
| --------------------------------------- | -------------------------- |
| version and role                        | 4                          |
| role only                               | 3                          |
| version only                            | 2                          |
| nothing (universal)                     | 1                          |
| an axis that does not match the request | excluded, never scored low |

`resolve(key, schema, target, ctx)` keeps the registrations whose `schema` and `target` are
exact or `'*'` and whose scope matches `ctx`, then ranks them by: exact schema, exact target,
specificity, source (`override` beats `generated`), then registration order. Resolution is a
total stable order; a property test in `packages/core` proves it. No candidate throws
`REGISTRY_UNRESOLVED`.

Two registrations at the same `(key, schema, target, source, scope)` throw
`REGISTRY_DUPLICATE_SPECIFICITY` at registration time, so the app fails to start rather than pick
one silently. One owner per coordinate.

### What the role is at runtime

`useScope()` in the runtime reads `role` from the principal's first role unless a
`ScopeProvider` pins one, and `version` from `ScopeProvider` or the schema's `x-schema-version`
in the `FeatureModel`.

## The API

The rules call this `registerComponent(...)`; in code the method is `register`.

```ts
import type { ComponentRegistry } from '@star-board/core';

registry.register({ key, schema, target, scope?, component, source }); // → Registration
registry.resolve(key, schema, target, ctx?); // → Registration; throws REGISTRY_UNRESOLVED
registry.list({ key?, schema?, target?, source? }); // → readonly Registration[]
registry.size;
```

| Layer                            | Call                                  | Role                                                                  |
| -------------------------------- | ------------------------------------- | --------------------------------------------------------------------- |
| `@star-board/renderer-mui`       | `registerDefaults(registry)`          | every key at `schema '*'`, `target '*'`, `source 'generated'`         |
| generated `registry.ts`          | `registerGenerated(registry)`         | each generated screen at `(screen.<kind>, schema, operationId)`       |
| generated `setup.ts`             | `createGeneratedRegistry()`           | a fresh registry with the two calls above, in that order              |
| `src/features/<schema>/index.ts` | `register<Schema>Overrides(registry)` | your `registry.register(...)` calls, `source: 'override'`             |
| `@star-board/runtime`            | `useComponent(key, schema, target)`   | the resolved `Registration` (`.component`, `.source`, `.specificity`) |
| generated `domain/contract.ts`   | `useResolved<P>(key, schema, target)` | `useComponent(...).component` typed by the caller                     |

The example's `src/features/pet/index.ts`:

```ts
import type { ComponentRegistry } from '@star-board/core';
import { NameFieldWithCounter } from './components/NameFieldWithCounter.js';
import { PetDetailOverride } from './components/PetDetailOverride.js';
import { StatusChip } from './components/StatusChip.js';

export function registerPetOverrides(registry: ComponentRegistry): void {
  registry.register({
    key: 'field.text',
    schema: 'pet',
    target: 'name',
    component: NameFieldWithCounter,
    source: 'override',
  });
  registry.register({
    key: 'list.column.enum',
    schema: 'pet',
    target: 'status',
    component: StatusChip,
    source: 'override',
  });
  registry.register({
    key: 'screen.detail',
    schema: 'pet',
    target: 'pet_get',
    component: PetDetailOverride,
    source: 'override',
  });
}
```

`src/app.tsx` calls it after `createGeneratedRegistry()`. An override accepts the same props as
the default it replaces: the renderer's `FieldProps`, `CellProps`, `ActionProps`, `StateProps`,
`HelpProps`, or the generated `<Schema><Kind>ScreenProps`.

## The granularity ladder

Prefer the narrowest rung that reproduces the design. A whole-screen override needs a reason
comment at the site (`typescript/12` §3).

| Rung         | Key                                                              | Target                | Replaces                                             | Example                |
| ------------ | ---------------------------------------------------------------- | --------------------- | ---------------------------------------------------- | ---------------------- |
| field widget | `field.text`, `field.select`, … (8 kinds)                        | field name            | one input in create and edit forms                   | `NameFieldWithCounter` |
| column       | `list.column.<type>`                                             | field name            | one cell renderer in lists, grids and detail values  | `StatusChip`           |
| action       | `action.<kind>` (create, update, delete, custom)                 | operation id          | one button and its confirm dialog                    | —                      |
| state, help  | `state.<kind>` (empty, loading, error, forbidden), `help.inline` | operation id or field | one state body or help text                          | —                      |
| screen       | `screen.<kind>` (list, grid, detail, create, edit, custom)       | operation id          | the whole screen; the route container still feeds it | `PetDetailOverride`    |
| feature      | every `screen.*` of one schema                                   | each operation id     | the whole feature, hooks and client kept             | —                      |

There is no key for a form group or list section today. A section is overridden at the screen
rung, composing the field, column and action keys back in through `useResolved`, as
`PetDetailOverride` does. Swapping the renderer library is a per-app Class B decision behind the
same registry, never a per-component mix (contradiction #6).

## The three worked examples

All three are in `examples/petstore-ui/src/features/pet/` and exercised by
`src/overrides.test.tsx`.

| Granularity  | File                                  | Coordinates                         | What it does                                                                                                                                                        | Test asserts                                                                                                          |
| ------------ | ------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| field widget | `components/NameFieldWithCounter.tsx` | `field.text`, `pet`, `name`         | wraps the renderer's `TextField` and adds a live `used/80` counter (`maxLength: 80` in the document); same props, same test ids                                     | `pet-name-counter` reads `3/80` only with the override; `field-name` stays; `species` untouched                       |
| column       | `components/StatusChip.tsx`           | `list.column.enum`, `pet`, `status` | an MUI `Chip` coloured by palette slot (`success`, `warning`, `default`); label from `column.options` so translations keep working                                  | two `pet-status-chip` cells; `species` (also an enum) keeps the default `cell-species`                                |
| screen       | `components/PetDetailOverride.tsx`    | `screen.detail`, `pet`, `pet_get`   | a card showing three fields; receives `PetDetailScreenProps` from the generated container hook, so data, gating and navigation are reused; keeps `pet-detail-*` ids | `data-override="pet"`; `action-pet_update` present; the status chip composes in; `resolve(...).source === 'override'` |

The screen override resolves its own parts through the registry
(`useResolved<CellProps>('list.column.enum', 'pet', 'status')`), which is why the column override
appears inside it without any import between the two.

## What the generator never touches

- `--features` is never read, created, modified or deleted. `writeFiles` checks every path first
  and throws `GENERATOR_OUT_OF_SURFACE` if one escapes `--out` or lands inside `--features`; then
  nothing is written.
- `check` never reads `features/`; an override is never `extra`.
- `generated/` never imports `features/`. The generator does not know the overrides exist.
- `src/overrides.test.tsx` copies `src/features` to a temporary root, runs `generate` +
  `writeFiles` beside it and asserts the tree is byte-identical before and after, then asserts
  `check()` over the committed tree is empty.

## Fitness rules (`tools/fitness.ts`, `pnpm check:fitness`)

The override tree is classified by sub-folder so the React hexagon import rules of
`typescript/01` apply to it as to generated code (contradiction #9). The script walks every
`examples/*/src` file (tests excluded); a file of no layer passes.

| Path                                                     | Layer       |
| -------------------------------------------------------- | ----------- |
| `generated/domain/**`, `features/<schema>/components/**` | domain      |
| `generated/application/**`, `features/<schema>/hooks/**` | application |
| `generated/adapters/**`                                  | adapters    |
| `generated/registry.ts`, `features/<schema>/index.ts`    | registry    |

| Rule                               | Layer       | Fails when                                                                                                                                                                                                   |
| ---------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `domain-no-application`            | domain      | a relative import points into `application/`                                                                                                                                                                 |
| `domain-no-adapters`               | domain      | a relative import points into `adapters/`                                                                                                                                                                    |
| `domain-no-runtime-data-hook`      | domain      | `@star-board/runtime` import names `useEntity`, `useEntityList`, `useView`, `useMutation`, `useCapability`, `useCapabilities`, `useServices`, `useOperations`, `useAgent`, `useAgentTools` or `createClient` |
| `domain-no-fetch`                  | domain      | the file calls `fetch(`                                                                                                                                                                                      |
| `application-adapters-only-client` | application | a value import from `adapters/` other than `adapters/client`                                                                                                                                                 |
| `override-index-register-only`     | registry    | `features/<schema>/index.ts` holds anything but imports, one `register…(registry)` function and `registry.register(...)` calls, or registers nothing                                                         |

A domain override may import the renderer (`@mui/material`, `@star-board/renderer-mui`) and the
registry hook; it may not fetch or reach a data hook. Hooks an override needs go in
`features/<schema>/hooks/`.

## Why parity still holds

- The parity report reads the document and the generated tree (`screenOrAction`, `version`,
  `capabilities`). Overrides register beside the generated screens; they remove nothing, so the
  columns are unchanged. See [parity.md](parity.md).
- Capability gating lives in the generated container hooks (`use<Schema>Screens.ts`), which keep
  feeding the override. A hidden action stays hidden in an overridden screen because the hook,
  not the screen, filters `actions`.
- The posture (`403` or `404`) is applied by the same hooks and the runtime's error presentation,
  so an overridden detail screen shows `state.empty` or `state.forbidden` as the default would.
- An override keeps the page-object ids (`selectors(schema)` in `@star-board/testing`), so the
  same tests drive both screens; `PetDetailOverride` is tested with the harness used for the
  default.
- The fitness rules keep an override on the generated hooks and types: a component that fetches
  on its own or re-declares a shape fails `domain-no-fetch` or the layer import rules.
