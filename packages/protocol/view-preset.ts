import { z } from 'zod';

const id=z.string().min(1);
const hash=z.string().regex(/^[a-f0-9]{64}$/);
const xyz=z.tuple([z.number(),z.number(),z.number()]);
const quat=z.tuple([z.number(),z.number(),z.number(),z.number()]).refine(q=>Math.abs(Math.hypot(...q)-1)<1e-5,'Quaternion must be normalized');
const viewport=z.object({width:z.number().positive(),height:z.number().positive(),pixel_ratio:z.number().positive()});
const sourceCamera=z.object({position:xyz,quaternion:quat,frame_id:id,unit:z.literal('meter'),up_axis:z.literal('Z')});
export const viewPresetSchema=z.object({
 schema:z.literal('spatial-canvas.view-preset.v1'),preset_id:id,design_id:id,source_resource_id:id,source_revision:id,source_sha256:hash,
 source_locator:id.optional(),bindings:z.object({registry_id:id,registry_revision:id,sha256:hash,locator:id}).optional(),
 preview_uri:z.string().regex(/^[A-Za-z0-9_-]+\.png$/).optional(),
 near:z.number().positive().optional(),far:z.number().positive().optional(),
 projection:z.literal('perspective'),fov_degrees:z.number().positive().lt(180),position:xyz,quaternion:quat,orbit_target:xyz,viewport,
 frame_id:id,unit:z.literal('meter'),up_axis:z.literal('Y'),source_camera:sourceCamera,
 hidden_entity_ids:z.array(id),ghost_entity_ids:z.array(id),
}).refine(v=>new Set(v.hidden_entity_ids).size===v.hidden_entity_ids.length,'Duplicate hidden entity').refine(v=>new Set(v.ghost_entity_ids).size===v.ghost_entity_ids.length,'Duplicate ghost entity').refine(v=>v.hidden_entity_ids.every(id=>!v.ghost_entity_ids.includes(id)),'An entity cannot be hidden and ghosted').refine(v=>v.far===undefined||v.near===undefined||v.far>v.near,'Invalid clipping range').refine(v=>{
 const [x,y,z]=v.position;return v.source_camera.position.every((a,i)=>Math.abs(a-[x,-z,y][i]!)<1e-7);
},'Source camera position disagrees with proxy').refine(v=>{
 const [x,y,z,w]=v.quaternion,a=Math.SQRT1_2,expected=[a*(w+x),a*(y-z),a*(y+z),a*(w-x)];
 return Math.min(Math.max(...expected.map((a,i)=>Math.abs(a-v.source_camera.quaternion[i]!))),Math.max(...expected.map((a,i)=>Math.abs(a+v.source_camera.quaternion[i]!))))<1e-5;
},'Source camera rotation disagrees with proxy');
export type ViewPreset=z.infer<typeof viewPresetSchema>;
