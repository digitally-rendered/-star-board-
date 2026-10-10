import { readFile, writeFile } from 'node:fs/promises';
import { TokensError } from '@star-board/core';
import type { FigmaVariablesDocument, TokenSourcePort } from './ports.js';
import { parseFigmaVariables } from './from-figma.js';

/** Node-only: a TokenSourcePort over a JSON file. Exported from `@star-board/tokens/node`, never from the main entry, so browser bundles stay free of node built-ins. */
export class JsonFileTokenSource implements TokenSourcePort {
  constructor(readonly path: string) {}

  async pull(): Promise<FigmaVariablesDocument> {
    let json: unknown;
    try {
      json = JSON.parse(await readFile(this.path, 'utf8'));
    } catch (cause) {
      throw new TokensError(
        'TOKENS_INVALID',
        `Cannot read Figma variables file ${this.path} as JSON`,
        { path: this.path, cause: cause instanceof Error ? cause.message : String(cause) },
        { cause },
      );
    }
    return parseFigmaVariables(json);
  }

  async push(doc: FigmaVariablesDocument): Promise<void> {
    await writeFile(this.path, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  }
}
