import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FeatureModelSchema, REQUIRED_EXTENSIONS, type FeatureModel } from '@star-board/core';
import { collectOperations } from './operations.js';
import { collectSchemas } from './schemas.js';
import { invalid, isRecord, requireRecord, requireString, type JsonObject } from './shared.js';

const POSTURES = ['403', '404'] as const;

/**
 * Loads one OpenAPI 3.1 document and returns the validated FeatureModel (plan Part 3).
 *
 * `src` is a parsed document object, a JSON string, a filesystem path, or a `file:` URL. The loader
 * reads nothing else: no schema files, no backend source, no network. Every gap in the contract
 * (hexagonal-rules shared/02 §6a) throws a SpecError whose `details` carry the missing extension
 * and the location (`SPEC_MISSING_EXTENSION`, `SPEC_OPERATION_ID`, `SPEC_INVALID`).
 */
export function loadDocument(src: string | object): FeatureModel {
  const document = readDocument(src);
  const openapi = document.openapi;
  if (typeof openapi !== 'string' || !openapi.startsWith('3.1')) {
    throw invalid('Expected an OpenAPI 3.1 document (`openapi` must start with "3.1")', {
      at: 'openapi',
      openapi,
    });
  }
  const info = requireRecord(document.info, 'info');
  const components = isRecord(document.components) ? document.components : {};
  const rawSchemas = isRecord(components.schemas) ? components.schemas : {};
  const schemas = collectSchemas(rawSchemas);
  const paths = document.paths === undefined ? {} : requireRecord(document.paths, 'paths');
  const { operations, views } = collectOperations(paths, Object.keys(schemas), rawSchemas);

  const draft: FeatureModel = {
    title: requireString(info.title, 'info.title'),
    version: requireString(info.version, 'info.version'),
    posture: readPosture(info),
    schemas,
    views,
    operations,
  };
  const parsed = FeatureModelSchema.safeParse(draft);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first ? first.path.map(String).join('.') : '<root>';
    throw invalid(`FeatureModel validation failed at ${where}: ${first?.message ?? 'unknown'}`, {
      at: where,
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}

/** Contradiction #5: the posture is the document's, default 404 (hexagonal-rules shared/01 §5). */
function readPosture(info: JsonObject): FeatureModel['posture'] {
  const key = REQUIRED_EXTENSIONS.posture;
  const value = info[key];
  if (value === undefined) return '404';
  const posture = POSTURES.find((candidate) => candidate === value);
  if (!posture) {
    throw invalid(`Expected ${key} to be one of ${POSTURES.join(', ')} at info.${key}`, {
      at: `info.${key}`,
      value,
    });
  }
  return posture;
}

function readDocument(src: string | object): JsonObject {
  if (typeof src === 'string') {
    return src.trimStart().startsWith('{')
      ? parseJson(src, '<inline>')
      : parseJson(readText(src), src);
  }
  if (src instanceof URL) {
    const path = fileURLToPath(src);
    return parseJson(readText(path), path);
  }
  if (!isRecord(src)) throw invalid('Expected an OpenAPI document object', { at: '' });
  return src;
}

function readText(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (cause) {
    throw invalid(`Cannot read OpenAPI document at ${path}`, { path }, { cause });
  }
}

function parseJson(text: string, source: string): JsonObject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw invalid(`OpenAPI document ${source} is not valid JSON`, { source }, { cause });
  }
  if (!isRecord(parsed))
    throw invalid(`OpenAPI document ${source} is not a JSON object`, { source });
  return parsed;
}
