import { z } from 'zod';
import { authorityLevelSchema, entitySchema, resourceSchema, selectionSchema } from './index';
import {spatialContextSchema} from './spaces';
import {relationshipContextSchema} from './relationship-context';

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
  spatial_context:spatialContextSchema.optional(),
  relationships:relationshipContextSchema.optional(),
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
  if(packet.spatial_context&&packet.spatial_context.resolution!=='unavailable'&&!packet.hit)reject('Spatial resolution requires actual hit');
  if(packet.spatial_context?.semantic_status&&packet.spatial_context.semantic_status.design_id!==packet.resource.design_id)reject('Spatial status design mismatch');
  if(packet.relationships&&packet.relationships.subject_id!==packet.selection.primary_entity_id)reject('Relationship subject must be primary selection');
  const relationship=packet.relationships;
  if(relationship){
    if(relationship.design_id!==packet.resource.design_id)reject('Relationship design mismatch');
    if(relationship.status==='available'){
      const model=relationship.sources.find(s=>s.resource_id===packet.source.resource_id);
      if(!model||model.revision!==packet.source.revision||model.sha256!==packet.source.sha256)reject('Relationship model provenance mismatch');
      const subject=relationship.nodes.find(n=>n.node_id===relationship.subject_id),entity=packet.entities.find(e=>e.global_id===relationship.subject_id);
      if(!subject||!entity||subject.resource_id!==entity.source_resource_id||subject.native_id!==entity.native_object_id)reject('Relationship native/global entity mismatch');
      const spaceNode=relationship.nodes.find(n=>n.node_id===relationship.primary_space_id);
      if(relationship.primary_space_id&&(spaceNode?.space_id??spaceNode?.node_id)!==packet.spatial_context?.primary_space_id)reject('Relationship primary space differs from hit-resolved space');
    }
  }
  const spatial=packet.spatial_context;
  const blender=packet.resource.extensions?.['spatial_canvas.blender'] as {source_coordinate_frame?:string;meters_per_scene_unit?:number;source_up_axis?:string}|undefined;
  if(packet.hit?.source&&blender?.source_coordinate_frame){
    const scale=blender.meters_per_scene_unit;
    const scales:Record<string,number>={meter:1,millimeter:.001,centimeter:.01};
    if(typeof scale!=='number'||!Number.isFinite(scale)||scale<=0||packet.hit.source.frame_id!==blender.source_coordinate_frame||
      (blender.source_up_axis!==undefined&&blender.source_up_axis!=='Z'))reject('Invalid declared Blender source conversion');
    else{
      const [x,y,z]=packet.hit.xyz,expected=[x/scale,-z/scale,y/scale];
      if(packet.hit.source.xyz.some((v,i)=>Math.abs(v-expected[i]!)>1e-7))reject('Source hit differs from declared Blender conversion');
      if(packet.hit.source.unit!=='scene_unit'&&(!scales[packet.hit.source.unit]||Math.abs(scales[packet.hit.source.unit]!-scale)>1e-8))reject('Source hit unit and scale disagree');
      if(packet.hit.normal&&packet.hit.source.normal){const n=packet.hit.normal,expectedNormal=[n[0],-n[2],n[1]];if(packet.hit.source.normal.some((v,i)=>Math.abs(v-expectedNormal[i]!)>1e-7))reject('Source normal differs from Blender conversion');}
    }
  }
  if(spatial&&spatial.resolution!=='unavailable'&&packet.hit){
    const sourcePoint=spatial.frame_id===packet.hit.frame_id?packet.hit:spatial.frame_id===packet.hit.source?.frame_id?packet.hit.source:undefined;
    const scales:Record<string,number>={meter:1,millimeter:.001,centimeter:.01};
    if(!sourcePoint||!spatial.point||!spatial.unit||!scales[spatial.unit]||!scales[sourcePoint.unit])reject('Spatial point/frame/unit do not correspond to hit');
    else if(sourcePoint.xyz.some((v,i)=>Math.abs(v*scales[sourcePoint.unit]!-spatial.point![i]!*scales[spatial.unit!]!)>1e-7))reject('Spatial point differs from actual raycast hit');
    if(spatial.frame_id===packet.hit.frame_id&&packet.view.kind==='camera3d'&&spatial.up_axis!==packet.view.data.up_axis)reject('Spatial axis differs from view');
    if(spatial.frame_id===packet.hit.source?.frame_id&&(!blender?.source_coordinate_frame||spatial.up_axis!=='Z'))reject('Spatial source axis/conversion is not declared');
  }
});

export type BindingRegistry=z.infer<typeof bindingRegistrySchema>;
export type CameraView=z.infer<typeof cameraViewSchema>;
export type ContextHit=z.infer<typeof contextHitSchema>;
export type ContextPacket=z.infer<typeof contextPacketSchema>;
export type ContextSelection=z.infer<typeof contextSelectionSchema>;
