# Backend conformance: what the OpenAPI document must carry

star-board reads one OpenAPI 3.1 document and nothing else. The loader
(`@star-board/spec`) fails closed: a document missing any item below stops
generation with an error that names the item and its location. This is the
checklist a backend built on slip-stream, stellar-drive or Syntact must pass
(`hexagonal-rules/shared/02` §6a). Run it with:

```bash
star-board check --document openapi.json --out /tmp/sb --features /tmp/sb-features
```

| #   | Where                       | Requirement                                                                                                                                                                                                              | Error when missing                                                                            |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| 1   | root                        | `openapi` starts with `3.1`                                                                                                                                                                                              | `SPEC_INVALID` at `openapi`                                                                   |
| 2   | `info`                      | `title`, `version`; optional `x-ownership-posture` of `"403"` or `"404"` (default `404`)                                                                                                                                 | `SPEC_INVALID` at `info.x-ownership-posture`                                                  |
| 3   | `components.schemas`        | for each entity `<Pascal>`, siblings `<Pascal>Create` and `<Pascal>Update`                                                                                                                                               | entity skipped; operations naming it fail rule 7                                              |
| 4   | each entity Document schema | `x-schema-version` (semver string)                                                                                                                                                                                       | `SPEC_MISSING_EXTENSION` `{extension: "x-schema-version", at: "components.schemas.<Pascal>"}` |
| 5   | each entity Document schema | `x-owner-field` present: a field name, or `null`/`false` for shared records (absent means scoped on `created_by`)                                                                                                        | none; absent is a valid default                                                               |
| 6   | properties                  | `x-ui-widget` (one of text, select, datetime, number, boolean, tags, subform, reference), `x-ui-group` (string), `x-ui-order` (number), `x-ui-hidden` (true), `x-<field>-reason` (string) are optional; wrong types fail | `SPEC_INVALID` at the property path                                                           |
| 7   | every operation             | `operationId` of the form `<schema>_<operation>` where `<schema>` is a known entity in snake_case, or the operation carries `x-view`                                                                                     | `SPEC_MISSING_EXTENSION` `operationId`, or `SPEC_OPERATION_ID`                                |
| 8   | every operation             | `x-capabilities`: array of capability strings; an empty array means the operation is never shown                                                                                                                         | `SPEC_MISSING_EXTENSION` `x-capabilities` at `paths.<path>.<method>`                          |
| 9   | view operations             | `x-view` object: `schema`, `projection[]`, `filters[]` (`{field, op}`), `sort[]` (`{field, dir}`), `limits` (`{default, max}`), `roles[]`                                                                                | `SPEC_MISSING_EXTENSION` `x-view` for an unknown-schema operation under `/views/`             |
| 10  | request bodies              | `application/json` schema, referencing `<Pascal>Create` or `<Pascal>Update` by `$ref` inside `#/components/schemas/`                                                                                                     | request omitted; forms cannot be generated for that operation                                 |
| 11  | `$ref`                      | local refs only (`#/components/schemas/...`), depth ≤ 8                                                                                                                                                                  | `SPEC_INVALID` `{at, ref}`                                                                    |
| 12  | MCP                         | tool names equal operation ids (`hexagonal-rules/shared/13` §2); the parity suite compares `tools/list` with the document                                                                                                | parity failure, not a loader error                                                            |

## How operations are classified

| Shape                           | Kind                                                    |
| ------------------------------- | ------------------------------------------------------- |
| `GET /<schema>`                 | list                                                    |
| `GET /<schema>/{id}`            | get                                                     |
| `POST /<schema>`                | create                                                  |
| `PATCH` or `PUT /<schema>/{id}` | update                                                  |
| `DELETE /<schema>/{id}`         | delete                                                  |
| path ends `_history`            | history                                                 |
| path ends `_bulk`               | bulk                                                    |
| operation carries `x-view`      | view                                                    |
| anything else                   | custom (a stub screen and a typed action are generated) |

## Status per backend (2026-10-09)

| Backend       | Emits 1–3, 10, 11         | 4 `x-schema-version` | 5 `x-owner-field` | 6 `x-ui-*` / reasons | 7 operation ids         | 8 `x-capabilities` | 9 `x-view` |
| ------------- | ------------------------- | -------------------- | ----------------- | -------------------- | ----------------------- | ------------------ | ---------- |
| Syntact       | planned (OpenAPI builder) | planned              | planned           | not yet              | planned `<schema>_<op>` | not yet            | not yet    |
| stellar-drive | yes (OpenAPI generator)   | not yet              | not yet           | not yet              | not verified            | not yet            | not yet    |
| slip-stream   | yes (FastAPI)             | not yet              | not yet           | not yet              | not verified            | not yet            | not yet    |

Until a backend passes, `fixtures/petstore.json` is the hand-authored reference
document that does. The gap is tracked in `.claude/state/known-issues.md`.
