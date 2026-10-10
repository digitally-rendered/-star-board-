import type { FeatureModel, OperationEntry } from '@star-board/core';
import { pathParams, quote, sortedEntries } from '../plan/names.js';
import type { GenerationPlan, SchemaPlan } from '../plan/plan.js';
import { header, indent, lines, type GeneratedFile, type Source } from './support.js';
import { tsType, viewRowType } from './types.js';

/*
 * Secondary adapter (hexagonal-rules typescript/01 §5): a `paths`/`operations` interface derived
 * from the document's operations and a typed client over the runtime's `createClient`.
 */

export const PATHS_PATH = 'adapters/paths.ts';
const METHOD_ORDER: readonly OperationEntry['method'][] = ['get', 'post', 'put', 'patch', 'delete'];
export const CLIENT_PATH = 'adapters/client.ts';

interface OperationTypes {
  params: string;
  body: string;
  response: string;
}

function operationTypes(
  op: OperationEntry,
  schema: SchemaPlan | undefined,
  model: FeatureModel,
): OperationTypes {
  const params = pathParams(op.path);
  const paramsType =
    params.length === 0
      ? 'Record<never, never>'
      : `{ ${params
          .map((p) =>
            schema && (p === 'id' || p === schema.idField)
              ? `${p}: ${schema.pascal}Id`
              : `${p}: string`,
          )
          .join('; ')} }`;
  let body = 'never';
  if (op.request) {
    if (schema && op.kind === 'create') body = `${schema.pascal}Create`;
    else if (schema && op.kind === 'update') body = `${schema.pascal}Update`;
    else body = tsType(op.request, 1);
  }
  let response: string;
  if (op.response) response = tsType(op.response, 1);
  else if (schema && (op.kind === 'get' || op.kind === 'create' || op.kind === 'update')) {
    // Convention: the record operations answer with the Document when the document is silent.
    response = schema.pascal;
  } else if (op.kind === 'delete') response = 'void';
  else if (op.kind === 'view' && schema) {
    const view = Object.values(model.views).find((v) => v.operationId === op.id);
    response = view ? `${viewRowType(schema.pascal, view.name)}[]` : 'unknown';
  } else response = 'unknown';
  return { params: paramsType, body, response };
}

export function emitPaths(
  plan: GenerationPlan,
  model: FeatureModel,
  source: Source,
): GeneratedFile {
  const schemasByName = new Map(plan.schemas.map((s) => [s.name, s]));
  const sorted = sortedEntries(model.operations);
  const ids = sorted.map(([id]) => id);
  const usedTypes = new Map<string, Set<string>>();
  const entries = sorted.map(([, op]) => {
    const schema = schemasByName.get(op.schema);
    const types = operationTypes(op, schema, model);
    if (schema) {
      const set = usedTypes.get(schema.name) ?? new Set<string>();
      for (const candidate of [
        schema.pascal,
        `${schema.pascal}Id`,
        `${schema.pascal}Create`,
        `${schema.pascal}Update`,
        ...plan.schemas
          .filter((s) => s.name === schema.name)
          .flatMap((s) => s.columns.views.map((v) => viewRowType(s.pascal, v.view))),
      ]) {
        if (
          new RegExp(`\\b${candidate}\\b`).test(`${types.params} ${types.body} ${types.response}`)
        ) {
          set.add(candidate);
        }
      }
      usedTypes.set(schema.name, set);
    }
    return { op, types };
  });
  const imports = [...usedTypes.entries()]
    .filter(([, set]) => set.size > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([name, set]) =>
        `import type { ${[...set].sort().join(', ')} } from '../domain/${name}/types.js';`,
    );
  const byPath = new Map<string, { op: OperationEntry }[]>();
  for (const entry of entries) {
    const list = byPath.get(entry.op.path) ?? [];
    list.push(entry);
    byPath.set(entry.op.path, list);
  }
  return {
    path: PATHS_PATH,
    contents: lines([
      header(source),
      ...imports,
      '',
      '/** The request and response shape of one operation. */',
      'export interface OperationShape {',
      "  method: 'get' | 'post' | 'put' | 'patch' | 'delete';",
      '  path: string;',
      '  params: Record<string, string>;',
      '  body: unknown;',
      '  response: unknown;',
      '}',
      '',
      '/** Keyed by operationId (the MCP tool name, hexagonal-rules shared/13). */',
      'export interface operations {',
      ...entries.map(({ op, types }) =>
        indent(
          `${op.id}: {\n  method: ${quote(op.method)};\n  path: ${quote(op.path)};\n  params: ${types.params};\n  body: ${types.body};\n  response: ${types.response};\n};`,
        ),
      ),
      '}',
      '',
      '/** Keyed by path then method, for the typed client. */',
      'export interface paths {',
      ...[...byPath.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([path, list]) =>
          indent(
            `${quote(path)}: {\n${[...list]
              .sort((a, b) => METHOD_ORDER.indexOf(a.op.method) - METHOD_ORDER.indexOf(b.op.method))
              .map(({ op }) => `  ${op.method}: operations[${quote(op.id)}];`)
              .join('\n')}\n};`,
          ),
        ),
      '}',
      '',
      '/** Method, path and capabilities per operation, for runtime lookups. */',
      'export const OPERATION_TABLE = {',
      ...entries.map(({ op }) =>
        indent(
          `${op.id}: { method: ${quote(op.method)}, path: ${quote(op.path)}, schema: ${quote(op.schema)}, kind: ${quote(op.kind)}, capabilities: [${op.capabilities.map(quote).join(', ')}] },`,
        ),
      ),
      '} as const;',
      '',
      'export type OperationId = keyof operations;',
      `export const OPERATION_IDS: readonly OperationId[] = [${ids.map(quote).join(', ')}];`,
    ]),
  };
}

export function emitClient(source: Source): GeneratedFile {
  return {
    path: CLIENT_PATH,
    contents: lines([
      header(source),
      "import { createClient } from '@star-board/runtime';",
      "import type { paths } from './paths.js';",
      '',
      'export type GeneratedClient = ReturnType<typeof createClient<paths>>;',
      'export type ClientAuth = Parameters<typeof createClient>[1];',
      '',
      '/** The typed client over the document; auth and 401 handling live in the runtime. */',
      'export function createGeneratedClient(baseUrl: string, auth: ClientAuth): GeneratedClient {',
      '  return createClient<paths>(baseUrl, auth);',
      '}',
    ]),
  };
}
