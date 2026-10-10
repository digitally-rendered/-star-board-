# @star-board/cli

L6. The `star-board` command: generate and check the human surface of one OpenAPI 3.1 document,
build the theme from design tokens, and scaffold a consumer. Imports `@star-board/core`, `spec`,
`tokens`, `generator` and `testing`.

```bash
star-board generate --document openapi.json --out src/generated --features src/features
star-board check    --document openapi.json --out src/generated --features src/features
star-board init my-app
star-board tokens build --tokens tokens.json --out src/theme
star-board tokens lint  --tokens tokens.json
```

## Commands

| Command                                                                                                   | Does                                                                                                                                                                                                                                                                                                                            | Exit                     |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `generate --document <path\|url> --out <dir> --features <dir> [--renderer <pkg>] [--no-i18n] [--dry-run]` | `loadDocument` → `generate` → `writeFiles`. Prints the file count and the sha256 of `manifest.json`. `--dry-run` prints the file list and writes nothing. `features/` is never touched (`GENERATOR_OUT_OF_SURFACE` otherwise, and nothing is written).                                                                          | 0                        |
| `check` (same options)                                                                                    | Regenerates in memory and diffs byte for byte against `--out`; prints one `kind path` row per drift (`missing`, `changed`, `extra`).                                                                                                                                                                                            | 0 clean, 1 drift         |
| `init <dir> [--document <path>] [--renderer <pkg>]`                                                       | Writes `star-board.config.json`, `src/features/README.md`, `src/main.tsx`, `src/App.tsx`. Refuses to overwrite: when any target exists nothing is written.                                                                                                                                                                      | 0, 2 when a file exists  |
| `tokens build --tokens <file> [--out <dir>] [--modes a,b,c] [--density a,b]`                              | `parseTokens` → lint → `build`; writes `theme.css-vars.json`, `mui-theme.json`, `figma-variables.json`, `contract.json`, `code-connect.json` under `--out`. With `--json` and no `--out` the whole build prints to stdout.                                                                                                      | 0, 1 lint findings       |
| `tokens lint --tokens <file> [--modes a,b,c] [--density a,b]`                                             | Prints every semantic lint finding as `rule path: message`.                                                                                                                                                                                                                                                                     | 0 clean, 1 findings      |
| `parity --document --out --features [--mcp-tools <file>] [--no-i18n]`                                     | Loads the document, reads the generated tree under `--out` and the optional `tools/list` JSON (an array or `{ "tools": [...] }`), prints one row per operation (`rest`, `screenOrAction`, `mcpTool`, `version`, `capabilities`, `inputSchema`; `n/a` when the input was not given) and the summary. `--json` prints the report. | 0 ok, 1 any disagreement |

Global flags: `--json` (machine-readable output on stdout, errors as one JSON object on stderr),
`--verbose` (stack traces), `--version`, `--help`.

## Exit codes

| Code | Meaning                                                                                                                                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0    | Done; `check` and `tokens lint` found nothing.                                                                                                                                                                                                                                       |
| 1    | Findings: drift under `--out` (`GENERATOR_DRIFT`), token lint findings.                                                                                                                                                                                                              |
| 2    | Usage or load error: unknown command or flag, a missing option that the config does not supply, `SPEC_*` (unreadable or invalid document), `TOKENS_INVALID`, `GENERATOR_OUT_OF_SURFACE`, `init` would overwrite, `parity` without a generated tree or with an unreadable tools file. |

Every `StarBoardError` prints `CODE: message` and its `details` as JSON on stderr; a usage error
prints `usage: message`. Stack traces appear only under `--verbose`.

## `star-board.config.json`

Every command reads this file from the working directory for the flags that were omitted; a flag
always wins and paths are relative to the directory holding the file. `init` writes the first
four keys.

```json
{
  "document": "openapi.json",
  "out": "src/generated",
  "features": "src/features",
  "renderer": "@star-board/renderer-mui",
  "i18n": true,
  "tokens": {
    "file": "tokens.json",
    "out": "src/theme",
    "modes": ["light", "dark"],
    "density": ["dense"]
  }
}
```

Modes default to the reference set's (`light`, `dark`, `high-contrast`; density `dense`). Naming
`--modes` without `--density` clears the density axis.

## Document input

`--document` is a path or an `http(s)://` URL. A URL is fetched once with the global `fetch`
(`src/source.ts`, the CLI's only network call); the spec loader then validates it like a file and
fails closed on a missing extension.

## Programmatic use

```ts
import { run } from '@star-board/cli';

const code = await run([
  'check',
  '--document',
  'openapi.json',
  '--out',
  'src/generated',
  '--features',
  'src/features',
]);
```

`run(argv, io?)` takes the user arguments (what follows the script in `process.argv`), never
calls `process.exit`, and returns the exit code; `io` overrides `cwd`, `stdout` and `stderr`.
`dist/bin.js` is the `star-board` binary and sets `process.exitCode` from it.

## Scripts

`pnpm -F @star-board/cli test` runs `run()` in-process against temporary directories: generate
writes the manifest and every file; check is clean, then exits 1 after a hand edit; `--dry-run`
writes nothing; `init` scaffolds and refuses to overwrite; `tokens build` writes five files from
`tokens/reference.tokens.json`; a missing document exits 2 with a `SPEC_*` message; `--json`
output parses. `pnpm -F @star-board/cli check:example` runs `check` over `examples/petstore-ui`
(the root `codegen:check`); it fails until the example is generated.

See the plan Part 2 task 13 and `.kiro/specs/08-cli/` for the owning spec.
