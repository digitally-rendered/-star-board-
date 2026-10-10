import { z } from 'zod';

/**
 * The validated, normalised view of one OpenAPI document (plan Part 3). Produced by
 * `@star-board/spec`, consumed by the generator, the runtime and the parity suite.
 */
export const JsonSchemaSchema = z.record(z.string(), z.unknown());
export type JsonSchema = z.infer<typeof JsonSchemaSchema>;

export const UiHintsSchema = z.object({
  widget: z.record(z.string(), z.string()).default({}),
  group: z.record(z.string(), z.string()).default({}),
  order: z.record(z.string(), z.number()).default({}),
  hidden: z.array(z.string()).default([]),
});
export type UiHints = z.infer<typeof UiHintsSchema>;

export const SchemaEntrySchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]*$/),
  version: z.string(),
  document: JsonSchemaSchema,
  create: JsonSchemaSchema,
  update: JsonSchemaSchema,
  ownerField: z.string().nullable().optional(),
  reasons: z.record(z.string(), z.string()).default({}),
  ui: UiHintsSchema,
});
export type SchemaEntry = z.infer<typeof SchemaEntrySchema>;

export const FilterSpecSchema = z.object({ field: z.string(), op: z.string() });
export const SortSpecSchema = z.object({ field: z.string(), dir: z.enum(['asc', 'desc']) });
export const ViewEntrySchema = z.object({
  name: z.string(),
  schema: z.string(),
  operationId: z.string(),
  projection: z.array(z.string()).min(1),
  filters: z.array(FilterSpecSchema).default([]),
  sort: z.array(SortSpecSchema).default([]),
  limits: z.object({ default: z.number().int().positive(), max: z.number().int().positive() }),
  roles: z.array(z.string()).default([]),
});
export type ViewEntry = z.infer<typeof ViewEntrySchema>;

export const OPERATION_KINDS = [
  'list',
  'get',
  'create',
  'update',
  'delete',
  'bulk',
  'history',
  'view',
  'custom',
] as const;
export const OperationEntrySchema = z.object({
  id: z
    .string()
    .regex(/^[a-z][a-z0-9_]*_[a-z][a-z0-9_]*$/, 'operation ids are <schema>_<operation>'),
  schema: z.string(),
  operation: z.string(),
  kind: z.enum(OPERATION_KINDS),
  method: z.enum(['get', 'post', 'put', 'patch', 'delete']),
  path: z.string(),
  capabilities: z.array(z.string()),
  request: JsonSchemaSchema.optional(),
  response: JsonSchemaSchema.optional(),
  mcpTool: z.string().optional(),
});
export type OperationEntry = z.infer<typeof OperationEntrySchema>;

export const FeatureModelSchema = z.object({
  title: z.string(),
  version: z.string(),
  posture: z.enum(['403', '404']),
  schemas: z.record(z.string(), SchemaEntrySchema),
  views: z.record(z.string(), ViewEntrySchema),
  operations: z.record(z.string(), OperationEntrySchema),
});
export type FeatureModel = z.infer<typeof FeatureModelSchema>;

/** The extensions a document MUST carry (hexagonal-rules shared/02 §6a). One authority. */
export const REQUIRED_EXTENSIONS = {
  schemaVersion: 'x-schema-version',
  ownerField: 'x-owner-field',
  view: 'x-view',
  capabilities: 'x-capabilities',
  posture: 'x-ownership-posture',
  uiWidget: 'x-ui-widget',
  uiGroup: 'x-ui-group',
  uiOrder: 'x-ui-order',
  uiHidden: 'x-ui-hidden',
} as const;
