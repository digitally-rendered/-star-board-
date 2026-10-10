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
    if (src.protocol !== 'file:')
      throw invalid(`Only file: URLs are read; got ${src.protocol}`, { at: src.href });
    const path = decodeURIComponent(src.pathname);
    return parseJson(readText(path), path);
  }
  if (!isRecord(src)) throw invalid('Expected an OpenAPI document object', { at: '' });
  return src;
}

interface NodeFs {
  readFileSync(path: string, encoding: 'utf8'): string;
}
interface NodeProcess {
  getBuiltinModule?(id: string): unknown;
}

/**
 * Reads a document from disk through `process.getBuiltinModule` (Node ≥ 22.3) so this module has
 * no static node built-in import and a browser bundle can call `loadDocument` with a parsed object.
 */
function readText(path: string): string {
  const proc = (globalThis as { process?: NodeProcess }).process;
  const fs = proc?.getBuiltinModule?.('node:fs') as NodeFs | undefined;
  if (fs === undefined) {
    throw invalid('Reading a document from a path needs Node; pass a parsed object instead', {
      path,
    });
  }
  try {
    return fs.readFileSync(path, 'utf8');
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
