# Figma as an adapter

star-board treats the design side as the same hexagon as the code side (hexagonal-rules
`typescript/13` §1): a small core that owns the truth, with Figma, the renderer and the
generator as adapters around it.

## What is the source and what is generated

- **Tokens are the source.** `tokens/*.tokens.json` (DTCG format) is the one place colour,
  type, space, radius and density are decided. It is committed, linted and reviewed like code.
- **Figma variables are generated** from the tokens by `buildFigmaVariables` as a
  plugin-compatible JSON document (collections `star-board` for colour-scheme modes and
  `star-board-density` for density). Nobody edits variables by hand in Figma and expects them
  to stick; a change there comes back through a pull and lands as a token change in a commit.
- **The MUI theme is generated** from the same tokens in CSS-variables mode. A hand edit fails
  `codegen:check`.
- **Code Connect files are generated** from `contract.json`. Renaming a contract key renames
  the design binding and the renderer binding together.

The core (`@star-board/tokens`, L1) never imports React, MUI or a Figma SDK. The Figma
adapter is plain TypeScript over JSON in `packages/tokens/src/figma/`: the ports
`TokenSourcePort`, `DesignFilePort` and `CodeMappingPort`, two `TokenSourcePort` adapters
(`JsonFileTokenSource` over a file from `@star-board/tokens/node`, `InMemoryTokenSource` for tests), the inverse builder
`figmaVariablesToTokens`, `syncTokens` and the Code Connect emitter.

## The Figma MCP server is a build-brain tool

The design tool's MCP server is used by the coding agent at build time only (`typescript/13`
§4, `shared/14` §3): it reads a selected frame, its variables and component instances, and the
agent produces a registered override or a token change from what it read. It is:

- **never production**: it is registered in the project `.mcp.json` only and is absent from
  any runtime or deployment configuration;
- **never record data**: it sees design files and fixtures, never application records;
- **read-only by permission allowlist**: an `.mcp.json` entry cannot restrict a server's tools,
  so `docs/design-permissions.json` is the enforceable mechanism. It is a Claude Code
  `settings.json` fragment that pre-approves only the server's read tools (`get_*`, `list_*`
  placeholders to replace with exact names) and leaves every mutating tool prompted. A test in
  `packages/tokens/src/figma/design-permissions.test.ts` parses the fragment and fails if a
  rule approves the whole server or a tool that is not a read.

A frame that disagrees with the tokens or the contract is a design change request, recorded
as a contradiction, not a reason to hard-code a value.

## Sync flow

```
tokens JSON ──parseTokens──▶ TokenSet ──buildFigmaVariables──▶ variables document ──push──▶ Figma (plugin import)
tokens JSON ◀──CLI writes── TokenSet ◀──figmaVariablesToTokens── variables document ◀──pull── Figma (plugin export)
```

`syncTokens({ tokens, source, direction, modes })`:

- `push` lints the local tokens (fail closed), builds the document and hands it to the source.
- `pull` reads the document from the source, turns it back into tokens (type hints from the
  local set restore `number` and `duration`), lints the result and fails closed with
  `TOKENS_INVALID` on any finding (a missing or unknown mode, a value that is not a token of
  its type). On success it returns the pulled set and `changed`: every token path whose type,
  authored value or authored modes differ from the local set.

Neither direction writes the local token file; the CLI does, so a pull is a reviewable diff.
Fields the document cannot carry are listed under "Round-trip exclusions" in
`packages/tokens/README.md`.

## Code Connect

`emitCodeConnect(contract, { rendererPackage, figmaFileUrl })` yields one
`codeconnect/<key>.figma.tsx` per contract row in the shape `@figma/code-connect`'s React
parser consumes: it imports the row's `componentName` from the renderer package, binds the
props the Code Connect map declares (`figma.string`, `figma.boolean`, `figma.enum`) and renders
the component as the example. The node id is a placeholder until `design/map-components` fills
it from the design file. `emitCodeConnectConfig()` yields the matching `figma.config.json`.
`@figma/code-connect` is not a dependency of star-board; its CLI consumes the emitted files in
the consuming repository.

## Skills and CLI commands

| Skill (`typescript/13` §5) | CLI (wired in a later task)                                    | Does                                                                |
| -------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| `design/sync-tokens`       | `star-board tokens sync --direction push\|pull --figma <file>` | `syncTokens` over `JsonFileTokenSource`; writes tokens on pull      |
| `design/map-components`    | `star-board tokens map-components --figma-url <url>`           | writes `codeconnect/*.figma.tsx` and `figma.config.json`            |
| `design/parity-audit`      | `star-board tokens lint` + the renderer parity test            | every key has one Figma component, one renderer, one component name |
