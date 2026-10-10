import type { CodeConnectMap } from '../build/code-connect.js';
import type { FigmaVariables } from '../build/figma-variables.js';

/**
 * The design-side ports of the hexagon (hexagonal-rules typescript/13 §1). The core (tokens,
 * contract) knows nothing of Figma; these ports are what an adapter implements. The variables
 * document is the plugin-compatible JSON `buildFigmaVariables` emits.
 */
export type FigmaVariablesDocument = FigmaVariables;

/** Read and write tokens in a design tool, as a variables document. */
export interface TokenSourcePort {
  pull(): Promise<FigmaVariablesDocument>;
  push(doc: FigmaVariablesDocument): Promise<void>;
}

/** A component of a design file: its key in the file, its name and its variant names. */
export interface DesignComponent {
  readonly key: string;
  readonly name: string;
  readonly variants: readonly string[];
}

/** Read frames, components and variants from a design file. */
export interface DesignFilePort {
  components(): Promise<readonly DesignComponent[]>;
}

/** Bind design components to code components (Code Connect or an equivalent). */
export interface CodeMappingPort {
  write(map: CodeConnectMap): Promise<void>;
}
