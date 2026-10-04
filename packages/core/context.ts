import { contextPacketSchema, type CameraView, type ContextHit } from '../protocol/context';
import type { Entity, Manifest, SelectionEvent } from '../protocol/index';

export function createContextPacket(manifest:Manifest, selection:SelectionEvent, entities:ReadonlyMap<string,Entity>,
  view:CameraView, hit:ContextHit|null){
  if(view.frame_id!==manifest.coordinate_frame||(hit&&hit.frame_id!==manifest.coordinate_frame))
    throw new Error('Hit/view frame disagrees with proxy manifest');
  const blender=manifest.extensions?.['spatial_canvas.blender'] as {
    source_authority?:string;meters_per_scene_unit?:number;source_coordinate_frame?:string;
    source_up_axis?:string;bindings?:{registry_id:string;registry_revision:string;sha256:string;locator:string};
  }|undefined;
  const resolvedHit=hit ? structuredClone(hit) : null;
  if(resolvedHit)delete resolvedHit.source;
  // Only the declared Blender adapter convention supplies a source-space conversion.
  if(resolvedHit && blender?.source_coordinate_frame && typeof blender.meters_per_scene_unit==='number'){
    const [x,y,z]=resolvedHit.xyz;
    const scale=blender.meters_per_scene_unit;
    if(!Number.isFinite(scale)||scale<=0)throw new Error('Invalid declared Blender unit scale');
    const frame=manifest.source_frame;
    if(frame){
      const scales:Record<string,number>={meter:1,centimeter:.01,millimeter:.001};
      if(frame.up_axis!=='Z'||frame.coordinate_frame!==blender.source_coordinate_frame||
        Math.abs(scales[frame.unit]!-scale)>1e-8)throw new Error('Source frame/units disagree with Blender conversion');
    }else if(blender.source_up_axis!=='Z'){
      throw new Error('Source axis is not declared for native scene units');
    }
    resolvedHit.source={xyz:[x/scale,-z/scale,y/scale],frame_id:blender.source_coordinate_frame,
      unit:manifest.source_frame?.unit??'scene_unit'};
  }
  return contextPacketSchema.parse({
    schema:'spatial-canvas.context.v1',packet_id:'ctx_'+crypto.randomUUID(),timestamp:new Date().toISOString(),
    selection,resource:{...manifest},source:{
      resource_id:manifest.source_resource_id,revision:manifest.source_revision,sha256:manifest.source_sha256,
      locator:manifest.source_resource,authority:blender?.source_authority==='frozen'?'frozen':'editable',
      ...(blender?.bindings?{bindings:blender.bindings}:{}),
    },
    entities:selection.entity_ids.map(id=>{
      const entity=entities.get(id);
      if(!entity)throw new Error('Unknown selected entity');
      return entity;
    }),
    view:{kind:'camera3d',data:view},hit:resolvedHit,
  });
}
