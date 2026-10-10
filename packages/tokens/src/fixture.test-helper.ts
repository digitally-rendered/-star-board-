import { readFileSync } from 'node:fs';
import { TokensError } from '@star-board/core';
import { expect } from 'vitest';
import { parseTokens, type TokenSet } from './schema.js';

export const REFERENCE_URL = new URL('../../../tokens/reference.tokens.json', import.meta.url);

export function referenceJson(): unknown {
  return JSON.parse(readFileSync(REFERENCE_URL, 'utf8')) as unknown;
}

export function referenceSet(): TokenSet {
  return parseTokens(referenceJson());
}

/** Asserts `fn` throws a `TokensError` with code TOKENS_INVALID and returns it. */
export function expectTokensInvalid(fn: () => unknown): TokensError {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(TokensError);
  const error = caught as TokensError;
  expect(error.code).toBe('TOKENS_INVALID');
  return error;
}

export function color(value: string, modes?: Record<string, string>): Record<string, unknown> {
  const token: Record<string, unknown> = { $type: 'color', $value: value };
  if (modes) token.$extensions = { 'star-board': { modes } };
  return token;
}
