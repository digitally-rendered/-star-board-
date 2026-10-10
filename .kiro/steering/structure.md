# Structure — star-board

```
packages/{core,spec,tokens,runtime,renderer-mui,generator,testing,storybook,cli}
examples/petstore-ui         consumer app generated from fixtures/petstore.json
fixtures/                    OpenAPI documents for tests (petstore.json and negative/*)
tokens/                      the reference token set (light, dark, high-contrast, dense)
tools/                       check_waves, noskip, ratchet (+ baseline), depcruise config, fitness
.kiro/                       steering, specs, MASTER_SEQUENCING, handoff.json
.claude/state/               progress.md, known-issues.md
```

Levels L0–L6 as in `CLAUDE.md`; a package imports only lower levels. In a consuming app,
`src/generated/` is written by the generator and `src/features/<schema>/` holds overrides.
