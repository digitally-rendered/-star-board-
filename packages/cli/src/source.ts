import { resolve } from 'node:path';
import { SpecError, type FeatureModel } from '@star-board/core';
import { loadDocument } from '@star-board/spec';

const HTTP_URL = /^https?:\/\//i;

export function isHttpUrl(src: string): boolean {
  return HTTP_URL.test(src);
}

/**
 * The one place the CLI touches the network: an `http(s)://` document is fetched with the
 * global fetch; anything else is a path resolved against `cwd` that the spec loader reads.
 * Hand-written fetches are counted by tools/ratchet.ts (`handwritten_fetch`); this one is the
 * CLI's document input, not an application adapter.
 */
export async function loadSource(src: string, cwd: string): Promise<string | object> {
  if (!isHttpUrl(src)) return resolve(cwd, src);
  // ratchet-allow: cli document fetch
  const response = await fetch(src);
  if (!response.ok) {
    throw new SpecError('SPEC_INVALID', `Cannot fetch OpenAPI document at ${src}`, {
      url: src,
      status: response.status,
    });
  }
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new SpecError(
      'SPEC_INVALID',
      `OpenAPI document ${src} is not valid JSON`,
      { url: src },
      { cause },
    );
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new SpecError('SPEC_INVALID', `OpenAPI document ${src} is not a JSON object`, {
      url: src,
    });
  }
  return parsed;
}

/** `loadSource` then the spec loader; every failure is a `SpecError`. */
export async function loadModel(src: string, cwd: string): Promise<FeatureModel> {
  return loadDocument(await loadSource(src, cwd));
}
