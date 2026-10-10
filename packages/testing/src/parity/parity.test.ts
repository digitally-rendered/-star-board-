import type { FeatureModel } from '@star-board/core';
import { generate, manifestOf, MANIFEST_PATH, type GeneratedFile } from '@star-board/generator';
import { describe, expect, it } from 'vitest';
import { loadFixtureModel } from '../loadFixtureModel.js';
import { assertParity, ParityError, parityReport, parseCapabilityTable } from './parity.js';

const OPTS = { out: 'src/generated', features: 'src/features' };

function generated(model: FeatureModel) {
  const files = generate(model, OPTS);
  return { files, manifest: manifestOf(files, { title: model.title, version: model.version }) };
}

function toolsOf(model: FeatureModel, withSchemas = false) {
  return Object.values(model.operations).map((op) => ({
    name: op.id,
    ...(withSchemas && op.request !== undefined
      ? { inputSchema: structuredClone(op.request) }
      : {}),
  }));
}

function restOf(model: FeatureModel) {
  return Object.values(model.operations).map((op) => ({
    operationId: op.id,
    method: op.method.toUpperCase(),
    path: op.path,
  }));
}

function clone(model: FeatureModel): FeatureModel {
  return structuredClone(model);
}

function row(report: ReturnType<typeof parityReport>, id: string) {
  const found = report.rows.find((r) => r.operationId === id);
  if (found === undefined) throw new Error(`no row for ${id}`);
  return found;
}

describe('parityReport over the petstore fixture', () => {
  const model = loadFixtureModel();
  const out = generated(model);

  it('is green when REST, generated code and the tool list agree', () => {
    const report = parityReport({ model, generated: out, mcpTools: toolsOf(model, true) });
    expect(report.ok).toBe(true);
    expect(report.missing).toEqual([]);
    expect(report.rows.map((r) => r.operationId)).toEqual(Object.keys(model.operations).sort());
    for (const r of report.rows) {
      expect(r.rest).toBe(true);
      expect(r.screenOrAction).toBe(true);
      expect(r.mcpTool).toBe(true);
      expect(r.version).toBe(true);
      expect(r.capabilities).toBe(true);
    }
    expect(row(report, 'pet_create').inputSchema).toBe(true);
    expect(row(report, 'pet_update').inputSchema).toBe(true);
    expect(row(report, 'pet_get').inputSchema).toBe('n/a');
    expect(() => {
      assertParity(report);
    }).not.toThrow();
  });

  it('accepts a bare file list and reads the manifest when given', () => {
    const bare = parityReport({ model, generated: out.files });
    expect(bare.ok).toBe(true);
    const withManifest = parityReport({
      model,
      generated: {
        files: out.files,
        manifest: { ...out.manifest, source: { title: model.title, version: 'other' } },
      },
    });
    expect(withManifest.ok).toBe(false);
    expect(withManifest.rows.every((r) => !r.version)).toBe(true);
  });

  it('reads the MCP columns as n/a without a tool list and verifies the served REST surface when given', () => {
    const report = parityReport({ model, generated: out, restOperations: restOf(model) });
    expect(report.ok).toBe(true);
    expect(report.rows.every((r) => r.mcpTool === 'n/a' && r.inputSchema === 'n/a')).toBe(true);
    const drifted = parityReport({
      model,
      generated: out,
      restOperations: restOf(model).map((r) =>
        r.operationId === 'pet_delete' ? { ...r, path: '/pets/{id}' } : r,
      ),
    });
    expect(row(drifted, 'pet_delete').rest).toBe(false);
    expect(drifted.missing).toEqual(['pet_delete: rest']);
  });

  it('names the operation whose tool is missing', () => {
    const tools = toolsOf(model).filter((t) => t.name !== 'pet_history');
    const report = parityReport({ model, generated: out, mcpTools: tools });
    expect(report.ok).toBe(false);
    expect(row(report, 'pet_history')).toMatchObject({ mcpTool: false, ok: false });
    expect(report.rows.filter((r) => !r.ok).map((r) => r.operationId)).toEqual(['pet_history']);
    expect(report.missing).toEqual(['pet_history: mcpTool']);
    expect(() => {
      assertParity(report);
    }).toThrow(ParityError);
    try {
      assertParity(report);
    } catch (error) {
      expect(error).toBeInstanceOf(ParityError);
      if (error instanceof ParityError) {
        expect(error.rows).toBe(report.rows);
        expect(error.missing).toEqual(['pet_history: mcpTool']);
        expect(error.message).toContain('pet_history: mcpTool');
      }
    }
  });

  it('flags a capability changed in the document after generating', () => {
    const mutated = clone(model);
    const op = mutated.operations.pet_delete;
    if (op === undefined) throw new Error('fixture lacks pet_delete');
    op.capabilities = ['pet:admin'];
    const report = parityReport({ model: mutated, generated: out, mcpTools: toolsOf(mutated) });
    expect(row(report, 'pet_delete').capabilities).toBe(false);
    expect(row(report, 'pet_delete').ok).toBe(false);
    expect(report.missing).toEqual(['pet_delete: capabilities']);
    // Regenerating from the mutated document restores agreement.
    expect(
      parityReport({ model: mutated, generated: generated(mutated), mcpTools: toolsOf(mutated) })
        .ok,
    ).toBe(true);
  });

  it('flags a schema version changed in the document after generating', () => {
    const mutated = clone(model);
    const pet = mutated.schemas.pet;
    if (pet === undefined) throw new Error('fixture lacks pet');
    pet.version = '2.0.0';
    const report = parityReport({ model: mutated, generated: out });
    expect(report.rows.every((r) => !r.version)).toBe(true);
    expect(report.missing).toEqual(report.rows.map((r) => `${r.operationId}: version`));
  });

  it('flags a tool whose input schema differs from the request schema', () => {
    const tools = toolsOf(model, true).map((t) =>
      t.name === 'pet_create'
        ? {
            name: t.name,
            inputSchema: { type: 'object', properties: { name: { type: 'string' } } },
          }
        : t,
    );
    const report = parityReport({ model, generated: out, mcpTools: tools });
    expect(row(report, 'pet_create').inputSchema).toBe(false);
    expect(row(report, 'pet_update').inputSchema).toBe(true);
    expect(report.missing).toEqual(['pet_create: inputSchema']);
  });

  it('treats key order as irrelevant when comparing input schemas', () => {
    const request = model.operations.pet_create?.request;
    if (request === undefined) throw new Error('fixture lacks a create request schema');
    const reordered = Object.fromEntries(Object.entries(request).reverse());
    const tools = toolsOf(model).map((t) =>
      t.name === 'pet_create' ? { name: t.name, inputSchema: reordered } : t,
    );
    expect(
      row(parityReport({ model, generated: out, mcpTools: tools }), 'pet_create').inputSchema,
    ).toBe(true);
  });

  it('flags a dropped operation in the generated code', () => {
    const without = (path: string): GeneratedFile[] => out.files.filter((f) => f.path !== path);
    const noTypes = parityReport({ model, generated: without('domain/pet/types.ts') });
    expect(noTypes.rows.every((r) => !r.version)).toBe(true);
    const noDetail = parityReport({ model, generated: without('domain/pet/PetDetailScreen.tsx') });
    expect(row(noDetail, 'pet_get').screenOrAction).toBe(false);
    expect(row(noDetail, 'pet_list').screenOrAction).toBe(true);
    const noActions = parityReport({
      model,
      generated: without('application/pet/usePetActions.ts'),
    });
    expect(noActions.rows.every((r) => !r.screenOrAction && !r.capabilities)).toBe(true);
    const noPaths = parityReport({ model, generated: without('adapters/paths.ts') });
    expect(noPaths.rows.every((r) => !r.rest)).toBe(true);
    // A hook removed from the actions file is a missing action; the table entry alone is not enough.
    const hookless = out.files.map((f) =>
      f.path === 'application/pet/usePetActions.ts'
        ? {
            ...f,
            contents: f.contents.replace(
              'export function usePetDelete()',
              'export function usePetDrop()',
            ),
          }
        : f,
    );
    expect(row(parityReport({ model, generated: hookless }), 'pet_delete').screenOrAction).toBe(
      false,
    );
    const noRoute = out.files.map((f) =>
      f.path === 'routes.tsx'
        ? { ...f, contents: f.contents.replace("path: '/pet/new'", "path: '/pet/add'") }
        : f,
    );
    expect(row(parityReport({ model, generated: noRoute }), 'pet_create').screenOrAction).toBe(
      false,
    );
  });

  it('exposes the capability table parser used by the capabilities column', () => {
    const actions = out.files.find((f) => f.path === 'application/pet/usePetActions.ts');
    if (actions === undefined) throw new Error('no actions file');
    const table = parseCapabilityTable(actions.contents);
    expect([...table.keys()].sort()).toEqual(Object.keys(model.operations).sort());
    expect(table.get('pet_create')).toEqual(['pet:write']);
    expect(table.get('available_pets_query')).toEqual(['pet:read']);
    expect(out.files.at(-1)?.path).toBe(MANIFEST_PATH);
  });
});
