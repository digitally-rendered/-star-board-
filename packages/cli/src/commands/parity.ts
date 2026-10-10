import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { nodeDisk, type GeneratedFile } from '@star-board/generator';
import {
  parityReport,
  type McpToolDescriptor,
  type ParityReport,
  type ParityRow,
} from '@star-board/testing';
import { CliUsageError, EXIT, type ExitCode } from '../errors.js';
import { optionString, printJson, printLines, type Context, type RawOptions } from '../io.js';
import { loadModel } from '../source.js';
import { resolveDocumentInputs } from './shared.js';

/*
 * `star-board parity`: the document against the generated tree on disk and, when given, an MCP
 * `tools/list` result (hexagonal-rules shared/13 §2 "Parity is tested"). Exit 1 on any
 * disagreement; the document is the authority in every column.
 */

/** Every file under `out` as the parity suite reads generated output. */
export function readGeneratedTree(out: string): GeneratedFile[] {
  return nodeDisk.listFiles(out).map((path) => ({
    path,
    contents: nodeDisk.readFile(join(out, ...path.split('/'))) ?? '',
  }));
}

/** A `tools/list` result: either the bare array or `{ tools: [...] }`. */
export function parseMcpTools(text: string, source: string): McpToolDescriptor[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new CliUsageError(`${source} is not valid JSON`, {
      path: source,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
  }
  const list = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.tools)
      ? parsed.tools
      : undefined;
  if (list === undefined) {
    throw new CliUsageError(`${source} must be a tools array or { "tools": [...] }`, {
      path: source,
    });
  }
  return list.map((entry, index): McpToolDescriptor => {
    if (!isRecord(entry) || typeof entry.name !== 'string') {
      throw new CliUsageError(`${source}: tool ${index} has no string "name"`, {
        path: source,
        index,
      });
    }
    return entry.inputSchema === undefined
      ? { name: entry.name }
      : { name: entry.name, inputSchema: entry.inputSchema };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const COLUMNS = [
  'rest',
  'screenOrAction',
  'mcpTool',
  'version',
  'capabilities',
  'inputSchema',
] as const satisfies readonly (keyof ParityRow)[];

function cell(value: boolean | 'n/a'): string {
  return value === 'n/a' ? 'n/a' : value ? 'ok' : 'MISSING';
}

/** One line per operation, columns aligned; the summary line last. */
export function formatReport(report: ParityReport): string[] {
  const width = Math.max('operation'.length, ...report.rows.map((r) => r.operationId.length));
  const head = ['operation'.padEnd(width), ...COLUMNS.map((c) => c.padEnd(14))].join(' ');
  const lines = report.rows.map((row) =>
    [row.operationId.padEnd(width), ...COLUMNS.map((c) => cell(row[c]).padEnd(14))]
      .join(' ')
      .trimEnd(),
  );
  const summary = report.ok
    ? `parity: ok (${report.rows.length} operation(s))`
    : `parity: ${report.missing.length} cell(s) disagree: ${report.missing.join(', ')}`;
  return [head.trimEnd(), ...lines, summary];
}

export async function runParity(ctx: Context, raw: RawOptions): Promise<ExitCode> {
  const { document, options } = resolveDocumentInputs(ctx, raw);
  const model = await loadModel(document, ctx.cwd);
  const generated = readGeneratedTree(options.out);
  if (generated.length === 0) {
    throw new CliUsageError(
      `no generated files under ${options.out}; run \`star-board generate\``,
      {
        out: options.out,
      },
    );
  }
  const toolsFile = optionString(raw, 'mcpTools');
  const mcpTools =
    toolsFile === undefined
      ? undefined
      : parseMcpTools(readToolsFile(resolve(ctx.cwd, toolsFile)), toolsFile);
  const report = parityReport({
    model,
    generated,
    ...(mcpTools === undefined ? {} : { mcpTools }),
  });
  const code = report.ok ? EXIT.ok : EXIT.findings;
  if (ctx.json) {
    printJson(ctx, {
      command: 'parity',
      document,
      out: options.out,
      mcpTools: toolsFile ?? null,
      ok: report.ok,
      rows: report.rows,
      missing: report.missing,
    });
    return code;
  }
  printLines(ctx, formatReport(report));
  return code;
}

function readToolsFile(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (cause) {
    throw new CliUsageError(`Cannot read MCP tools file ${path}`, {
      path,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
  }
}
