import { z } from 'zod';
import { frameSchema } from './index';
import {validPolygon} from './regions';
import {relationshipStatusSchema} from './relationships';

const id=z.string().min(1);
const hash=z.string().regex(/^[a-f0-9]{64}$/);
const timestamp=z.iso.datetime();
const method=z.enum(['imported','derived_from_cad','derived_from_freecad','inferred_from_geometry','user_authored']);
const capability=z.enum(['explicit_regions','candidate_regions','geometry_only','none']);
export const regionSchema=z.object({
  type:z.literal('polygon_prism'), polygon:z.array(z.tuple([z.number(),z.number()])).min(3),
  z_min:z.number().finite(), z_max:z.number().finite(), coordinate_frame:id, unit:z.enum(['meter','millimeter','centimeter']).default('meter'),
}).refine(r=>r.z_max>r.z_min,'Region z_max must exceed z_min')
  .refine(r=>validPolygon(r.polygon),'Polygon must be simple, finite and have positive area');
const sourceSchema=z.object({resource_id:id,type:id,revision:id,sha256:hash,locator:id,semantic_capability:capability,diagnostics:z.array(id)});
const verificationSchema=z.discriminatedUnion('state',[
  z.object({state:z.literal('verified'),reviewer:id,timestamp,note:id}),
  z.object({state:z.literal('candidate')}),
]);
const provenanceSchema=z.object({method,source_resource_id:id,source_revision:id,source_sha256:hash,evidence:id});
export const spaceSchema=z.object({
  space_id:id,name:id,semantic_type:id,level_id:id,region:regionSchema,provenance:provenanceSchema,
  confidence:z.number().min(0).max(1),verification:verificationSchema,
});
const sourceRefSchema=z.object({resource_id:id,revision:id,sha256:hash});
export const spaceRegistrySchema=z.object({
  schema:z.literal('spatial-canvas.spaces.v1'),registry_id:id,registry_revision:id,design_id:id,
  applies_to:z.array(sourceRefSchema).min(1),frame:frameSchema,source_context:z.object({sources:z.array(sourceSchema).min(1)}),
  spaces:z.array(spaceSchema).min(1),
}).superRefine((r,ctx)=>{
  const ids=new Set<string>();
  if(new Set(r.source_context.sources.map(s=>s.resource_id)).size!==r.source_context.sources.length)ctx.addIssue({code:'custom',message:'Duplicate evidence source ID'});
  for(const [i,s] of r.spaces.entries()){
    if(ids.has(s.space_id))ctx.addIssue({code:'custom',path:['spaces',i,'space_id'],message:'Duplicate space_id'});ids.add(s.space_id);
    if(s.region.coordinate_frame!==r.frame.coordinate_frame||s.region.unit!==r.frame.unit)ctx.addIssue({code:'custom',path:['spaces',i,'region'],message:'Region frame mismatch'});
    const src=r.source_context.sources.find(x=>x.resource_id===s.provenance.source_resource_id);
    if(!src||src.revision!==s.provenance.source_revision||src.sha256!==s.provenance.source_sha256)ctx.addIssue({code:'custom',path:['spaces',i,'provenance'],message:'Unknown evidence source'});
  }
  if(new Set(r.applies_to.map(x=>x.resource_id)).size!==r.applies_to.length)ctx.addIssue({code:'custom',path:['applies_to'],message:'Duplicate applies_to resource'});
});
export const projectSchema=z.object({
  schema:z.literal('spatial-canvas.project.v1'),project_id:id,design_id:id,sources:z.array(sourceSchema).min(1),
  levels:z.array(z.object({level_id:id,name:id,coverage:regionSchema})),frame:frameSchema,
}).superRefine((p,ctx)=>{
  if(new Set(p.sources.map(s=>s.resource_id)).size!==p.sources.length)ctx.addIssue({code:'custom',message:'Duplicate source_resource_id'});
  if(new Set(p.levels.map(l=>l.level_id)).size!==p.levels.length)ctx.addIssue({code:'custom',message:'Duplicate level_id'});
  if(p.levels.some(l=>l.coverage.coordinate_frame!==p.frame.coordinate_frame||l.coverage.unit!==p.frame.unit))ctx.addIssue({code:'custom',message:'Level coverage frame mismatch'});
});
export const semanticStatusSchema=z.object({
  relationship_status:relationshipStatusSchema.optional(),
  schema:z.literal('spatial-canvas.semantic-status.v1'),project_id:id,design_id:id,status:z.enum(['READY','PARTIAL','BLOCKED_FOR_SPATIAL_CONTEXT']),
  sources:z.array(sourceSchema),known_levels:z.array(id),coverage:z.object({covered_levels:z.array(id),uncovered_levels:z.array(id),uncovered_volume:z.number().nonnegative()}),
  diagnostics:z.array(z.object({code:id,message:id,action:id})),registry_id:id.nullable(),registry_revision:id.nullable(),
});
export const spatialContextSchema=z.object({
  resolution:z.enum(['exact','ambiguous','unresolved','unavailable']),containing_spaces:z.array(z.object({space_id:id,name:id,semantic_type:id,level_id:id,
    verification:verificationSchema,provenance:provenanceSchema,confidence:z.number().min(0).max(1)})),
  primary_space_id:id.nullable(),point:z.tuple([z.number(),z.number(),z.number()]).nullable(),frame_id:id.nullable(),unit:z.string().nullable(),
  up_axis:z.enum(['X','Y','Z']).nullable(),
  readiness:z.enum(['READY','PARTIAL','BLOCKED_FOR_SPATIAL_CONTEXT']),diagnostics:z.array(id),
  registry:z.object({registry_id:id,registry_revision:id,sha256:hash,locator:id}).nullable(),
  semantic_status:semanticStatusSchema.optional(),
}).superRefine((s,ctx)=>{
  const reject=(message:string)=>ctx.addIssue({code:'custom',message});
  if(s.resolution==='exact'&&(s.containing_spaces.length!==1||s.primary_space_id!==s.containing_spaces[0]?.space_id||s.containing_spaces[0]?.verification.state!=='verified'))reject('Exact resolution needs one verified primary space');
  if(s.resolution!=='exact'&&s.primary_space_id!==null)reject('Only exact resolution has a primary space');
  if(s.resolution==='ambiguous'&&s.containing_spaces.length<2)reject('Ambiguity requires multiple spaces');
  if(s.resolution!=='unavailable'&&(!s.point||!s.frame_id||!s.unit||!s.up_axis||!s.registry))reject('Spatial resolution requires point, frame and registry provenance');
  if(s.readiness==='BLOCKED_FOR_SPATIAL_CONTEXT'&&s.resolution!=='unavailable')reject('Blocked spatial context cannot resolve a space');
  if(s.semantic_status&&s.semantic_status.status!==s.readiness)reject('Embedded semantic readiness must agree with spatial readiness');
});
export type Region=z.infer<typeof regionSchema>;
export type Space=z.infer<typeof spaceSchema>;
export type SpaceRegistry=z.infer<typeof spaceRegistrySchema>;
export type Project=z.infer<typeof projectSchema>;
export type ProjectSource=z.infer<typeof sourceSchema>;
export type SemanticStatus=z.infer<typeof semanticStatusSchema>;
export type SpatialContext=z.infer<typeof spatialContextSchema>;
