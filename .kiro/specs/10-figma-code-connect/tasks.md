# Implementation Plan

**Feature:** Figma adapter and Code Connect

## Overview

Slice of `MASTER_SEQUENCING.md` owned by this spec.

## Task Dependency Graph

```mermaid
graph TD
  T19 --> T21
```

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": [18, 19],
      "description": "Phase D \u2014 overrides worked example in petstore-ui, Figma adapter (variables sync, Code Connect map, design permissions fragment), Storybook visual baselines; disjoint dirs"
    },
    {
      "wave": 2,
      "tasks": [21],
      "description": "Phase D checkpoint \u2014 override registered and generator leaves features/ untouched; token round-trip; visual baselines"
    }
  ]
}
```

## Tasks

- [ ] **18. Overrides worked example**
  - _Requirements: FIG-1_
- [ ] **19. Figma adapter**
  - _Requirements: FIG-1_
- [ ] **21. Checkpoint D**
  - _Requirements: FIG-1_

## Notes

Checkpoints block; update `.claude/state/progress.md` on completion.
