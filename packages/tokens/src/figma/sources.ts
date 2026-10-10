import { readFile, writeFile } from 'node:fs/promises';
import { TokensError } from '@star-board/core';
import type { FigmaVariablesDocument, TokenSourcePort } from './ports.js';
import { parseFigmaVariables } from './from-figma.js';

/**
 * `TokenSourcePort` over a JSON file: the document a Figma variables import/export plugin reads
 * and writes. Pulling validates the shape and fails closed with `TOKENS_INVALID`.
 */
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

/** `TokenSourcePort` holding one document in memory, for tests and dry runs. */
export class InMemoryTokenSource implements TokenSourcePort {
  document: FigmaVariablesDocument | undefined;
  /** Every document pushed, oldest first. */
  readonly pushed: FigmaVariablesDocument[] = [];

  constructor(document?: FigmaVariablesDocument) {
    this.document = document;
  }

  pull(): Promise<FigmaVariablesDocument> {
    if (this.document === undefined) {
      return Promise.reject(
        new TokensError('TOKENS_INVALID', 'No Figma variables document to pull', {}),
      );
    }
    return Promise.resolve(this.document);
  }

  push(doc: FigmaVariablesDocument): Promise<void> {
    this.document = doc;
    this.pushed.push(doc);
    return Promise.resolve();
  }
}
