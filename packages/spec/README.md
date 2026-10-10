# @star-board/spec

L1. OpenAPI 3.1 document loader producing a validated `FeatureModel`; fails closed on a missing
extension. Depends on `@star-board/core` only; never imports React, a renderer or a generator
(ESLint boundaries and `pnpm check:arch` enforce it).

One input: the OpenAPI document (`CLAUDE.md`). The loader reads no schema files, no backend
source and nothing over the network; every `$ref` must point inside `#/components/schemas/`.

## Public API

```ts
import { loadDocument, resolveSchema, MAX_REF_DEPTH, REF_PREFIX, PACKAGE, LAYER } from '@star-board/spec';

loadDocument(src: string | object): FeatureModel;
```

`src` is a parsed document object, a JSON string, a filesystem path, or a `file:` `URL`.

| FeatureModel field         | Document source                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`, `version`         | `info.title`, `info.version`                                                                                                                                                                                                                                                                                                                                                                                                        |
| `posture`                  | `info.x-ownership-posture`, `'403'` or `'404'`; default `'404'` (contradiction #5)                                                                                                                                                                                                                                                                                                                                                  |
| `schemas.<snake>`          | every `components.schemas.<Pascal>` that has `<Pascal>Create` and `<Pascal>Update` siblings (`Pet` → `pet`); `version` from `x-schema-version`; `ownerField` from `x-owner-field` (absent → undefined, `null`/`false` → null); `reasons` from `x-<field>-reason` on properties and `x-*-reason` on the schema; `ui` from `x-ui-widget`, `x-ui-group`, `x-ui-order`, `x-ui-hidden`; `document`/`create`/`update` with `$ref` inlined |
| `operations.<operationId>` | every `paths.<path>.<get\|post\|put\|patch\|delete>`; `id` is `<schema>_<operation>` where `<schema>` is a known schema name (longest match) or the operation carries `x-view`; `capabilities` from `x-capabilities`; `request` from the `application/json` request body; `response` from the first 2xx `application/json` schema; `mcpTool` = operationId (one authority)                                                          |
| `operations.<id>.kind`     | `view` (has `x-view`), `history` (path ends `/_history`), `bulk` (path ends `/_bulk`), `list` (GET on a collection path), `get`/`update`/`delete` (GET/PUT                                                                                                                                                                                                                                                                          | PATCH/DELETE on an item path `…/{id}`), `create` (POST on a collection path), else `custom` |
| `views.<name>`             | every operation with `x-view`; `name` = operationId without the `_query` suffix; `x-view.schema` must name a known schema; `projection`, `filters`, `sort`, `limits`, `roles` validated by core's `ViewEntrySchema`                                                                                                                                                                                                                 |

`resolveSchema(schema, components.schemas, at)` inlines `#/components/schemas/<Name>` references
(siblings of `$ref` win), stops at `MAX_REF_DEPTH` (8) and keeps a reference that recurs on the
current path as a `$ref`, so cyclic schemas terminate. `$ref` keys inside `enum`, `const`,
`default`, `example(s)` are data and are left alone.

## Errors

Every failure is a `SpecError` from `@star-board/core`; the message is one line and `details`
names what is missing and where (`at` is a dotted document location, e.g. `paths./pet.post`).

| Code                     | When                                                                                                                                                                                                                                                     | `details`                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `SPEC_MISSING_EXTENSION` | `x-schema-version` absent on a Document schema; `operationId` absent; `x-capabilities` absent; `x-view` absent on an operation under `/views/` whose id names no schema                                                                                  | `{ extension, at }`                             |
| `SPEC_OPERATION_ID`      | operationId is not `<schema>_<operation>` snake_case; names no schema in the document and carries no `x-view`; duplicated                                                                                                                                | `{ operationId, at, schemas? }`                 |
| `SPEC_INVALID`           | not an OpenAPI 3.1 document; unreadable path or invalid JSON; unknown posture; mistyped extension value (`x-ui-order` not a number, …); unsupported or unresolved `$ref`; view over an unknown schema; `ViewEntrySchema` or `FeatureModelSchema` rejects | `{ at, … }` plus zod `issues` when zod rejected |

## Tests

`pnpm -F @star-board/spec test` runs the contract suite over `fixtures/petstore.json` and
`fixtures/negative/*.json` (each negative fixture names its missing extension) plus unit tests for
`$ref` resolution. `vitest.config.ts` resolves workspace packages through the `star-board-source`
condition, so no build is needed first.

See the plan Part 2 and `.kiro/specs/02-spec-feature-model/` for the owning spec.
