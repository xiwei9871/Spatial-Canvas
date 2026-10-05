export const modelSource={resource_id:'model',type:'blender',revision:'r4',sha256:'a'.repeat(64),locator:'/local/model.blend',semantic_capability:'geometry_only',diagnostics:[]};
export const planSource={resource_id:'plan',type:'authored_json',revision:'p1',sha256:'b'.repeat(64),locator:'/local/plan.json',semantic_capability:'explicit_regions',diagnostics:[]};
export const frame={frame_id:'world',coordinate_frame:'world',unit:'meter',up_axis:'Z'};
export function space(id='lounge',x=0){return {space_id:id,name:id,semantic_type:id,level_id:'upper',
  region:{type:'polygon_prism',polygon:[[x,0],[x+2,0],[x+2,2],[x,2]],z_min:.45,z_max:3.2,coordinate_frame:'world',unit:'meter'},
  provenance:{method:'user_authored',source_resource_id:'plan',source_revision:'p1',source_sha256:'b'.repeat(64),evidence:'reviewed polygon'},
  confidence:.9,verification:{state:'verified',reviewer:'owner',timestamp:'2026-10-04T14:00:00.000Z',note:'Approved model-context region'}};}
export function spaces(){return {schema:'spatial-canvas.spaces.v1',registry_id:'spaces_home',registry_revision:'1',design_id:'home',
  applies_to:[{resource_id:'model',revision:'r4',sha256:'a'.repeat(64)}],frame,
  source_context:{sources:[modelSource,planSource]},spaces:[space(),space('corridor',2)]};}
export function project(){return {schema:'spatial-canvas.project.v1',project_id:'home',design_id:'home',sources:[modelSource,planSource],
  levels:[{level_id:'upper',name:'Upper',coverage:{type:'polygon_prism',polygon:[[0,0],[4,0],[4,2],[0,2]],z_min:.45,z_max:3.2,coordinate_frame:'world',unit:'meter'}}],frame:{...frame,coordinate_frame:'world'}}; }
