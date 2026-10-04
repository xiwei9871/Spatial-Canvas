import { z } from 'zod';
import type { ContextPacket } from './context';

const id = z.string().min(1);
const revision = z.string().min(1);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.iso.datetime();
const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const uniqueIds = z.array(id).refine((ids) => new Set(ids).size === ids.length, 'Duplicate entity IDs');
export const authorityLevelSchema=z.enum(['PHYSICAL_GROUND_TRUTH','SEMANTIC_GROUND_TRUTH','HUMAN_DESIGN_GUIDE','DERIVED_DESIGN_MODEL','PRESENTATION']);
const errorSchema = z.object({ code: id, message: id, details: z.record(z.string(), z.unknown()).optional() });
export const frameSchema = z.object({
  coordinate_frame: id, unit: z.enum(['meter', 'millimeter', 'centimeter']), up_axis: z.enum(['X', 'Y', 'Z']),
});
export const resourceSchema = z.object({
  resource_id: id, design_id: id, type: id, format: id,
  authority: z.enum(['derived', 'authoritative']), extensions: z.record(z.string(), z.unknown()).optional(),
});
export const manifestSchema = resourceSchema.extend({
  schema: z.literal('interaction-proxy-v1'), type: z.literal('interaction_proxy'),
  format: z.literal('glb'), authority: z.literal('derived'),
  // Relative, self-contained artifact path; local import never fetches manifest-supplied URLs.
  proxy_uri: z.string().regex(/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.glb$/)
    .refine((path) => !path.split('/').some((part) => part === '.' || part === '..')),
  source_resource_id: id, source_resource: id, source_sha256: sha256, source_revision: revision,
  coordinate_frame: id, unit: z.literal('meter'), up_axis: z.literal('Y'),
  source_frame: frameSchema.optional(),
  entity_count: z.number().int().nonnegative(), scope: z.enum(['full', 'task']),
});
export const entitySchema = z.object({
  design_id: id, global_id: id, native_object_id: id, semantic_type: id, room_id: id,
  source_resource_id: id, source_revision: revision, parent_id: id.optional(),
  authority_level: authorityLevelSchema.optional(), mutable: z.boolean().optional(),
  extensions: z.record(z.string(), z.unknown()).optional(),
});
export const selectionSchema = z.object({
  schema: z.literal('spatial-canvas.selection.v1'), design_id: id, resource_id: id,
  source_revision: revision, entity_ids: uniqueIds,
  mode: z.enum(['replace', 'add', 'remove', 'clear']),
  source: z.enum(['pointer', 'list', 'keyboard', 'reload']), timestamp,
}).refine((event) => event.mode !== 'clear' || event.entity_ids.length === 0, 'Clear event must have no entities');
export const intentSchema = z.object({
  schema: z.literal('spatial-canvas.intent.v1'), request_id: id, design_id: id, resource_id: id,
  source_resource_id: id, source_revision: revision, source_sha256: sha256,
  targets: z.array(z.object({ global_id: id, native_object_id: id })).min(1)
    .refine((targets) => new Set(targets.map((target) => target.global_id)).size === targets.length, 'Duplicate targets'),
  intent: z.literal('request_transform'), authority: z.literal('request_only'),
  payload: z.object({ translation: vec3, space: z.literal('world'), coordinate_frame: id, unit: z.literal('meter') }),
  timestamp, extensions: z.record(z.string(), z.unknown()).optional(),
});
export const executionResultSchema = z.discriminatedUnion('status', [
  z.object({
    schema: z.literal('spatial-canvas.execution-result.v1'), request_id: id, design_id: id, source_resource_id: id,
    previous_source_revision: revision, source_revision: revision, status: z.literal('applied'),
    targets: uniqueIds.min(1), timestamp,
  }).strict().refine((result) => result.previous_source_revision !== result.source_revision, 'Revision must change'),
  z.object({
    schema: z.literal('spatial-canvas.execution-result.v1'), request_id: id.nullable(), design_id: id.nullable(), source_resource_id: id.nullable(),
    previous_source_revision: revision.nullable(), source_revision: revision.nullable(), status: z.literal('rejected'),
    targets: uniqueIds, timestamp, error: errorSchema,
  }).strict().refine((result) => result.previous_source_revision === result.source_revision, 'Rejected request cannot change revision'),
  z.object({
    schema: z.literal('spatial-canvas.execution-result.v1'), request_id: id.nullable(), design_id: id.nullable(), source_resource_id: id.nullable(),
    previous_source_revision: revision.nullable(), source_revision: revision.nullable(), status: z.literal('error'),
    targets: uniqueIds, timestamp, error: errorSchema,
  }).strict(),
]);

export type Manifest = z.infer<typeof manifestSchema>;
export type Entity = z.infer<typeof entitySchema>;
export type SelectionEvent = z.infer<typeof selectionSchema>;
export type Intent = z.infer<typeof intentSchema>;
export type ProtocolEvent = SelectionEvent | Intent | ContextPacket;
export type ExecutionResult = z.infer<typeof executionResultSchema>;
