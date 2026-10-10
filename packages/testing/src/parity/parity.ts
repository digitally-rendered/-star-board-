import type { FeatureModel, OperationEntry } from '@star-board/core';
import {
  plan,
  type GeneratedFile,
  type Manifest,
  type SchemaPlan,
  type ScreenPlan,
} from '@star-board/generator';

/*
 * The parity suite (hexagonal-rules shared/13 §2 "Parity is tested", §6; typescript/12 §6).
 * For every operation in the document the report records whether the REST route, the generated
 * screen or action, the MCP tool and the versions and capabilities agree. The document is the
 * one authority: every column is read from the FeatureModel and compared with what the other
 * surfaces carry; nothing here consults a backend or a renderer.
 */

export interface McpToolDescriptor {
  name: string;
  inputSchema?: unknown;
}

export interface RestOperationDescriptor {
  operationId: string;
  method: string;
  path: string;
}

export interface ParityInput {
  model: FeatureModel;
  /** `generate(model, …)` output, with or without its manifest. */
  generated: { manifest?: Manifest; files: readonly GeneratedFile[] } | readonly GeneratedFile[];
  /** An MCP `tools/list` result; when omitted the MCP columns read `'n/a'`. */
  mcpTools?: readonly McpToolDescriptor[];
  /** The REST surface as served; when omitted the generated `adapters/paths.ts` table stands in. */
  restOperations?: readonly RestOperationDescriptor[];
}

export interface ParityRow {
  operationId: string;
  /** The REST route exists with the document's method and path. */
  rest: boolean;
  /** A generated screen (file and route) or action hook fronts the operation. */
  screenOrAction: boolean;
  /** A tool named exactly the operation id is listed. */
  mcpTool: boolean | 'n/a';
  /** The schema's `x-schema-version` and the document version reached the generated code unchanged. */
  version: boolean;
  /** The generated capability table lists the document's capabilities for the operation. */
  capabilities: boolean;
  /** The tool's input schema deep-equals the document's request schema. */
  inputSchema: boolean | 'n/a';
  ok: boolean;
}

export interface ParityReport {
  rows: ParityRow[];
  ok: boolean;
  /** `<operationId>: <column>` for every failing cell, in row order. */
  missing: string[];
}

const PARITY_COLUMNS = [
  'rest',
  'screenOrAction',
  'mcpTool',
  'version',
  'capabilities',
  'inputSchema',
] as const satisfies readonly (keyof ParityRow)[];

export class ParityError extends Error {
  readonly rows: readonly ParityRow[];
  readonly missing: readonly string[];
  constructor(report: ParityReport) {
    super(`parity failed for ${report.missing.length} cell(s): ${report.missing.join(', ')}`);
    this.name = 'ParityError';
    this.rows = report.rows;
    this.missing = report.missing;
  }
}

export function parityReport(input: ParityInput): ParityReport {
  const { model } = input;
  const { files, manifest } = unpack(input.generated);
  const generated = new GeneratedTree(files);
  const generationPlan = plan(model);
  const rows = Object.values(model.operations)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((op) => {
      const schemaPlan = generationPlan.schemas.find((s) => s.name === op.schema);
      const tool = input.mcpTools?.find((t) => t.name === op.id);
      const row: Omit<ParityRow, 'ok'> = {
        operationId: op.id,
        rest: restAgrees(op, input.restOperations, generated),
        screenOrAction: schemaPlan !== undefined && screenOrActionExists(op, schemaPlan, generated),
        mcpTool: input.mcpTools === undefined ? 'n/a' : mcpToolAgrees(op, tool),
        version: versionAgrees(model, op, generated, manifest),
        capabilities: schemaPlan !== undefined && capabilitiesAgree(op, schemaPlan, generated),
        inputSchema: inputSchemaAgrees(op, tool),
      };
      return { ...row, ok: PARITY_COLUMNS.every((column) => row[column] !== false) };
    });
  const missing = rows.flatMap((row) =>
    PARITY_COLUMNS.filter((column) => row[column] === false).map(
      (column) => `${row.operationId}: ${column}`,
    ),
  );
  return { rows, ok: missing.length === 0, missing };
}

/** Throws `ParityError` (carrying the rows) when any cell disagrees. */
export function assertParity(report: ParityReport): void {
  if (!report.ok) throw new ParityError(report);
}

function unpack(generated: ParityInput['generated']): {
  files: readonly GeneratedFile[];
  manifest: Manifest | undefined;
} {
  if ('files' in generated) return { files: generated.files, manifest: generated.manifest };
  return { files: generated, manifest: undefined };
}

/* ------------------------------------------------------------- columns */

function restAgrees(
  op: OperationEntry,
  rest: readonly RestOperationDescriptor[] | undefined,
  generated: GeneratedTree,
): boolean {
  if (rest !== undefined) {
    return rest.some(
      (r) => r.operationId === op.id && r.method.toLowerCase() === op.method && r.path === op.path,
    );
  }
  const entry = generated.operationTableEntry(op.id);
  return entry?.method === op.method && entry.path === op.path;
}

function screenOrActionExists(
  op: OperationEntry,
  schemaPlan: SchemaPlan,
  generated: GeneratedTree,
): boolean {
  const actionsFile = generated.actionsFile(schemaPlan);
  if (actionsFile === undefined) return false;
  // The capability table names every operation of the schema; it is the floor for operations the
  // generator has no screen or hook for yet (history, bulk).
  if (parseCapabilityTable(actionsFile).get(op.id) === undefined) return false;
  const screens = schemaPlan.screens.filter((s) => s.operationId === op.id);
  for (const screen of screens) {
    if (!generated.has(`domain/${schemaPlan.name}/${screen.file}`)) return false;
    if (!generated.routes().includes(`path: ${quote(routeOf(schemaPlan, screen))}`)) return false;
  }
  const action = schemaPlan.actions.find((a) => a.id === op.id);
  if (action?.mutation === true) {
    const hook = `export function use${schemaPlan.pascal}${pascalCase(action.operation)}()`;
    if (!actionsFile.includes(hook)) return false;
  }
  return true;
}

function mcpToolAgrees(op: OperationEntry, tool: McpToolDescriptor | undefined): boolean {
  if (tool === undefined) return false;
  // One authority for tool names: the operation id (`mcpTool`, when present, must repeat it).
  return op.mcpTool === undefined || op.mcpTool === op.id;
}

function versionAgrees(
  model: FeatureModel,
  op: OperationEntry,
  generated: GeneratedTree,
  manifest: Manifest | undefined,
): boolean {
  const schema = model.schemas[op.schema];
  if (schema === undefined) return false;
  const types = generated.text(`domain/${op.schema}/types.ts`);
  if (types === undefined) return false;
  const declared = /^\/\/ Schema (\S+) version (\S+)\.$/m.exec(types);
  if (declared?.[1] !== op.schema || declared[2] !== schema.version) return false;
  if (!types.includes(` from ${model.title}@${model.version} `)) return false;
  return manifest === undefined || manifest.source.version === model.version;
}

function capabilitiesAgree(
  op: OperationEntry,
  schemaPlan: SchemaPlan,
  generated: GeneratedTree,
): boolean {
  const actionsFile = generated.actionsFile(schemaPlan);
  if (actionsFile === undefined) return false;
  const listed = parseCapabilityTable(actionsFile).get(op.id);
  if (listed === undefined) return false;
  return sameSet(listed, op.capabilities);
}

function inputSchemaAgrees(
  op: OperationEntry,
  tool: McpToolDescriptor | undefined,
): boolean | 'n/a' {
  if (tool?.inputSchema === undefined || op.request === undefined) return 'n/a';
  return stable(tool.inputSchema) === stable(op.request);
}

/* ------------------------------------------------------------- helpers */

class GeneratedTree {
  private readonly byPath: Map<string, string>;
  constructor(files: readonly GeneratedFile[]) {
    this.byPath = new Map(files.map((f) => [f.path, f.contents]));
  }
  has(path: string): boolean {
    return this.byPath.has(path);
  }
  text(path: string): string | undefined {
    return this.byPath.get(path);
  }
  routes(): string {
    return this.byPath.get('routes.tsx') ?? '';
  }
  actionsFile(schemaPlan: SchemaPlan): string | undefined {
    return this.byPath.get(`application/${schemaPlan.name}/use${schemaPlan.pascal}Actions.ts`);
  }
  /** `adapters/paths.ts` `OPERATION_TABLE` row for one operation. */
  operationTableEntry(operationId: string): { method: string; path: string } | undefined {
    const paths = this.byPath.get('adapters/paths.ts');
    if (paths === undefined) return undefined;
    const row = new RegExp(
      `^\\s*${escapeRegExp(operationId)}: \\{ method: '([a-z]+)', path: '([^']*)'`,
      'm',
    ).exec(paths);
    if (row === null) return undefined;
    return { method: row[1] ?? '', path: unescapeQuote(row[2] ?? '') };
  }
}

/** `<id>: { capabilities: ['a', 'b'] },` rows of the emitted `<SCHEMA>_OPERATIONS` table. */
export function parseCapabilityTable(actionsFile: string): Map<string, string[]> {
  const table = new Map<string, string[]>();
  const rows = /^\s*([a-z][a-z0-9_]*): \{ capabilities: \[([^\]]*)\] \},$/gm;
  for (const match of actionsFile.matchAll(rows)) {
    const id = match[1];
    if (id === undefined) continue;
    const list = match[2] ?? '';
    table.set(
      id,
      [...list.matchAll(/'((?:\\'|[^'])*)'/g)].map((m) => unescapeQuote(m[1] ?? '')),
    );
  }
  return table;
}

function routeOf(schemaPlan: SchemaPlan, screen: ScreenPlan): string {
  // Mirrors the generator's route table: a record-level custom screen routes under `/:id/`.
  if (screen.kind !== 'custom') return screen.route;
  const action = schemaPlan.actions.find((a) => a.id === screen.operationId);
  return action?.item === true ? `/${schemaPlan.name}/:id/${action.operation}` : screen.route;
}

function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function unescapeQuote(value: string): string {
  return value.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const left = [...new Set(a)].sort();
  const right = [...new Set(b)].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/** JSON with sorted keys at every level, so two equal schemas compare as equal strings. */
export function stable(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) out[key] = sortDeep(record[key]);
    return out;
  }
  return value;
}
