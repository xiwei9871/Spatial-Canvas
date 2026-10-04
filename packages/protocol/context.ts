import { z } from 'zod';
import { authorityLevelSchema, entitySchema, resourceSchema, selectionSchema } from './index';

const id = z.string().min(1);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const xyz = z.tuple([z.number(), z.number(), z.number()]);
export const sourceFrameSchema = z.object({
  frame_id: id, unit: z.enum(['meter','centimeter','millimeter','scene_unit']),
  up_axis: z.enum(['X','Y','Z']), meters_per_unit: z.number().positive(),
}).refine(frame=>{
  const scales:Record<string,number>={meter:1,centimeter:.01,millimeter:.001};
  return frame.unit==='scene_unit'||Math.abs(scales[frame.unit]!-frame.meters_per_unit)<1e-8;
},'Source frame unit and scale disagree');
export const bindingRegistrySchema = z.object({
  schema: z.literal('spatial-canvas.bindings.v1'), registry_id: id, registry_revision: id,
  design_id: id, source_resource_id: id, source_revision: id, source_sha256: hash,
  source_locator: id, source_authority: z.literal('frozen'), source_frame: sourceFrameSchema.optional(),
  bindings: z.array(z.object({
    entity_id: id, adapter: id, native_id: id, semantic_type: id, room_id: id, authority_level: authorityLevelSchema,
  })).min(1).refine((items)=>new Set(items.map(x=>x.entity_id)).size===items.length,'Duplicate entity_id')
    .refine((items)=>new Set(items.map(x=>JSON.stringify([x.adapter,x.native_id]))).size===items.length,'Duplicate native mapping'),
});
export const cameraViewSchema = z.object({
  projection:z.literal('perspective'),fov_degrees:z.number().positive().lt(180),
  near:z.number().positive(),far:z.number().positive(),
  position: xyz, quaternion: z.tuple([z.number(),z.number(),z.number(),z.number()]),
  projection_matrix: z.array(z.number()).length(16), orbit_target: xyz,
  viewport: z.object({width:z.number().positive(),height:z.number().positive(),pixel_ratio:z.number().positive()}),
  frame_id: id, unit:z.literal('meter'),up_axis:z.literal('Y'),
}).refine(view=>view.far>view.near,'Camera far must exceed near');
export const contextHitSchema = z.object({
  entity_id:id, xyz, frame_id:id, unit:z.literal('meter'),
  normal:xyz.optional(),
  source:z.object({xyz,frame_id:id,unit:id,normal:xyz.optional()}).optional(),
});
export const contextSelectionSchema=selectionSchema.safeExtend({primary_entity_id:id.nullable()})
  .refine(selection=>selection.entity_ids.length
    ?selection.primary_entity_id!==null&&selection.entity_ids.includes(selection.primary_entity_id)
    :selection.primary_entity_id===null,'Primary entity must identify a selected entity, or null when cleared');
export const contextPacketSchema = z.object({
  schema:z.literal('spatial-canvas.context.v1'),packet_id:id,timestamp:z.iso.datetime(),
  selection:contextSelectionSchema,resource:resourceSchema,
  source:z.object({
    resource_id:id, revision:id, sha256:hash, locator:id, authority:z.enum(['editable','frozen']),
    bindings:z.object({registry_id:id,registry_revision:id,sha256:hash,locator:id}).optional(),
  }),
  entities:z.array(entitySchema),
  // An open view kind permits future viewers. Validate the concrete camera payload when present.
  view:z.object({kind:id,data:z.record(z.string(),z.unknown())}),
  hit:contextHitSchema.nullable(),
}).superRefine((packet,ctx)=>{
  const reject=(message:string)=>ctx.addIssue({code:'custom',message});
  if(packet.resource.design_id!==packet.selection.design_id ||
    packet.resource.resource_id!==packet.selection.resource_id ||
    packet.source.revision!==packet.selection.source_revision) reject('Resource/selection provenance mismatch');
  const ids=packet.entities.map(x=>x.global_id);
  if(new Set(ids).size!==ids.length || JSON.stringify(ids)!==JSON.stringify(packet.selection.entity_ids)) reject('Entity selection mismatch');
  for(const entity of packet.entities){
    if(entity.design_id!==packet.resource.design_id || entity.source_resource_id!==packet.source.resource_id ||
      entity.source_revision!==packet.source.revision) reject('Entity provenance mismatch');
    if(packet.source.authority==='frozen' && entity.mutable!==false) reject('Frozen entity must be immutable');
  }
  if(packet.view.kind==='camera3d' && !cameraViewSchema.safeParse(packet.view.data).success) reject('Invalid camera view');
  if(packet.hit && !ids.includes(packet.hit.entity_id)) reject('Hit must identify a selected entity');
  if(packet.hit && packet.hit.entity_id!==packet.selection.primary_entity_id)reject('Hit must identify the primary entity');
  if(packet.hit && packet.view.kind==='camera3d' && packet.hit.frame_id!==packet.view.data.frame_id) reject('Hit/view frame mismatch');
});

export type BindingRegistry=z.infer<typeof bindingRegistrySchema>;
export type CameraView=z.infer<typeof cameraViewSchema>;
export type ContextHit=z.infer<typeof contextHitSchema>;
export type ContextPacket=z.infer<typeof contextPacketSchema>;
export type ContextSelection=z.infer<typeof contextSelectionSchema>;
