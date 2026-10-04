import type {Manifest} from '../protocol/index';
import type {ContextHit} from '../protocol/context';
import {projectSchema,spatialContextSchema,type Project,type SpaceRegistry,type SpatialContext} from '../protocol/spaces';
import {ingestProject} from './ingestion';
import {locatePoint,type RegionPoint} from './regions';

export type LoadedSemantics={project?:Project;registry?:SpaceRegistry;artifact?:{sha256:string;locator:string}};
export function createSpatialContext(manifest:Manifest,hit:ContextHit|null,semantics:LoadedSemantics={}):SpatialContext{
  const {registry,artifact}=semantics;
  const fallback=projectSchema.parse({schema:'spatial-canvas.project.v1',project_id:manifest.design_id,design_id:manifest.design_id,
    frame:registry?.frame??{coordinate_frame:manifest.coordinate_frame,unit:manifest.unit,up_axis:manifest.up_axis},levels:[],
    sources:registry?.source_context.sources??[{resource_id:manifest.source_resource_id,revision:manifest.source_revision,sha256:manifest.source_sha256,
      locator:manifest.source_resource,type:manifest.extensions?.['spatial_canvas.blender']?'blender':'other',semantic_capability:'geometry_only',diagnostics:['Spatial evidence has not been supplied.']}]});
  const foreignProject=semantics.project&&semantics.project.design_id!==manifest.design_id;
  const status=ingestProject(foreignProject?fallback:semantics.project??fallback,foreignProject?undefined:registry);
  const base={resolution:'unavailable' as const,containing_spaces:[],primary_space_id:null,point:null,frame_id:null,unit:null,up_axis:null,
    readiness:status.status,semantic_status:status,diagnostics:status.diagnostics.map(d=>d.message+' '+d.action),registry:null};
  const blocked=(message:string)=>spatialContextSchema.parse({...base,readiness:'BLOCKED_FOR_SPATIAL_CONTEXT',diagnostics:[...base.diagnostics,message],
    semantic_status:{...status,status:'BLOCKED_FOR_SPATIAL_CONTEXT',diagnostics:[...status.diagnostics,{code:'proxy_semantics_unavailable',message,action:'Import current-design project and exact model-linked registry with artifact SHA/locator.'}]}});
  if(foreignProject)return blocked('Imported project belongs to another design. Supply the current project descriptor.');
  const applicability=registry?.applies_to.find(s=>s.resource_id===manifest.source_resource_id);
  if(!registry||!artifact)return blocked('Space Registry with artifact SHA/locator must be loaded before spatial lookup.');
  if((semantics.project&&semantics.project.design_id!==manifest.design_id)||registry.design_id!==manifest.design_id||!applicability||applicability.revision!==manifest.source_revision||applicability.sha256!==manifest.source_sha256)
    return blocked('Registry does not apply to this exact design/source revision/SHA.');
  const provenance={registry_id:registry.registry_id,registry_revision:registry.registry_revision,...artifact};
  if(status.status==='BLOCKED_FOR_SPATIAL_CONTEXT')return spatialContextSchema.parse({...base,registry:provenance});
  if(!hit)return spatialContextSchema.parse({...base,registry:provenance,diagnostics:[...base.diagnostics,'No raycast hit: click a model surface to locate a space.']});
  let point:RegionPoint|undefined;
  if(registry.frame.coordinate_frame===manifest.coordinate_frame)point={xyz:hit.xyz,frame_id:hit.frame_id,unit:hit.unit,up_axis:manifest.up_axis};
  else if(hit.source&&manifest.source_frame&&hit.source.frame_id===registry.frame.coordinate_frame&&['meter','millimeter','centimeter'].includes(hit.source.unit))
    point={xyz:hit.source.xyz,frame_id:hit.source.frame_id,unit:hit.source.unit as RegionPoint['unit'],up_axis:manifest.source_frame.up_axis};
  if(!point)return spatialContextSchema.parse({...base,registry:provenance,diagnostics:[...base.diagnostics,'No declared coordinate conversion from hit to Space Registry frame.']});
  const result=locatePoint(registry,point);
  return spatialContextSchema.parse({...base,...result,up_axis:point.up_axis,registry:provenance,diagnostics:[...base.diagnostics,...result.diagnostics]});
}
