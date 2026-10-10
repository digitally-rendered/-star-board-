import { TokensError } from '@star-board/core';
import type { FigmaVariablesDocument, TokenSourcePort } from './ports.js';

/**
 * `TokenSourcePort` over a JSON file: the document a Figma variables import/export plugin reads
 * and writes. Pulling validates the shape and fails closed with `TOKENS_INVALID`.
 */

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
