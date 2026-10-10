# Reference tokens

DTCG format. Semantic tokens (`color.surface.*`, `color.text.*`, `color.action.*`) alias primitives and carry per-mode values under `$extensions.star-board.modes` (light is the default `$value`; dark, high-contrast, dense). Components reference semantic tokens only. `@star-board/tokens` builds the MUI CSS-variables theme and the Figma variables from this file; both are generated, never edited.
