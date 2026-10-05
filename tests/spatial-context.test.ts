import {expect,it} from 'vitest';
import {createContextPacket} from '../packages/core/context';
import {projectSchema,spaceRegistrySchema} from '../packages/protocol/spaces';
import {manifest,selection,entity as sampleEntity} from './data';
import {selectionSchema} from '../packages/protocol/index';
import {cameraViewSchema,contextPacketSchema} from '../packages/protocol/context';
import {packet} from './context-data';
import {spaces,project} from './space-data';
import {locatePoint} from '../packages/core/regions';

function setup(){
  const m={...manifest,design_id:'home',source_resource_id:'model',source_revision:'r4',source_sha256:'a'.repeat(64),coordinate_frame:'proxy_world',source_frame:{coordinate_frame:'world',unit:'meter' as const,up_axis:'Z' as const},extensions:{'spatial_canvas.blender':{meters_per_scene_unit:1,source_coordinate_frame:'world',source_up_axis:'Z'}}};
  const s=selectionSchema.parse({...selection,design_id:'home',source_revision:'r4',entity_ids:[sampleEntity.global_id]});
  const entity={...sampleEntity,design_id:'home',source_resource_id:'model',source_revision:'r4',room_id:'unassigned'};
  const view=cameraViewSchema.parse({...packet.view.data,frame_id:'proxy_world'});
  const options={project:projectSchema.parse(project()),registry:spaceRegistrySchema.parse(spaces()),artifact:{sha256:'c'.repeat(64),locator:'/local/spaces.json'}};
  return {m,s,entity,view,options};
}
it('emits independent spaces for two hits on one physical object',()=>{
  const {m,s,entity,view,options}=setup();const map=new Map([[entity.global_id,entity]]);
  const a=createContextPacket(m,s,map,view,{entity_id:entity.global_id,xyz:[1,.45,-1],frame_id:'proxy_world',unit:'meter'},options);
  const b=createContextPacket(m,s,map,view,{entity_id:entity.global_id,xyz:[3,.45,-1],frame_id:'proxy_world',unit:'meter'},options);
  expect(a.spatial_context?.primary_space_id).toBe('lounge');expect(b.spatial_context?.primary_space_id).toBe('corridor');
  expect(a.entities).toEqual(b.entities);expect(a.entities[0]!.room_id).toBe('unassigned');
  expect(a.spatial_context?.registry?.sha256).toBe('c'.repeat(64));
});
it('has explicit missing semantics and no synthetic point for list selection',()=>{
  const {m,s,entity,view,options}=setup();const map=new Map([[entity.global_id,entity]]);
  const missing=createContextPacket(m,s,map,view,null);
  expect(missing.spatial_context?.readiness).toBe('BLOCKED_FOR_SPATIAL_CONTEXT');
  expect(missing.spatial_context?.diagnostics.join(' ')).toContain('Space Registry');
  const list=createContextPacket(m,s,map,view,null,options);
  expect(list.spatial_context?.resolution).toBe('unavailable');expect(list.spatial_context?.point).toBeNull();
});
it('refuses stale model applicability and exposes diagnostics',()=>{
  const {m,s,entity,view,options}=setup();options.registry.applies_to[0]!.revision='old';
  const value=createContextPacket(m,s,new Map([[entity.global_id,entity]]),view,{entity_id:entity.global_id,xyz:[1,1,-1],frame_id:'proxy_world',unit:'meter'},options);
  expect(value.spatial_context?.resolution).toBe('unavailable');expect(value.spatial_context?.primary_space_id).toBeNull();
});
it('portable packet validation refuses invented spatial points and unsupported exact claims',()=>{
  const {m,s,entity,view,options}=setup();
  const value=createContextPacket(m,s,new Map([[entity.global_id,entity]]),view,{entity_id:entity.global_id,xyz:[1,.45,-1],frame_id:'proxy_world',unit:'meter'},options);
  const invented=structuredClone(value);invented.spatial_context!.point=[20,20,20];
  expect(contextPacketSchema.safeParse(invented).success).toBe(false);
  const candidate=structuredClone(value);candidate.spatial_context!.containing_spaces[0]!.verification={state:'candidate'};
  expect(contextPacketSchema.safeParse(candidate).success).toBe(false);
  const missing=structuredClone(value);missing.hit=null;
  expect(contextPacketSchema.safeParse(missing).success).toBe(false);
});
it('foreign project imports produce valid blocked packets rather than throw or retain exact context',()=>{
  const {m,s,entity,view,options}=setup();options.project.design_id='another-design';
  const value=createContextPacket(m,s,new Map([[entity.global_id,entity]]),view,{entity_id:entity.global_id,xyz:[1,.45,-1],frame_id:'proxy_world',unit:'meter'},options);
  expect(value.spatial_context?.readiness).toBe('BLOCKED_FOR_SPATIAL_CONTEXT');
  expect(value.spatial_context?.resolution).toBe('unavailable');
  expect(value.spatial_context?.diagnostics.join(' ')).toContain('another design');
});
it('rejects altered native source conversion even when spatial fields agree with the forged point',()=>{
  const {m,s,entity,view,options}=setup();
  const value=createContextPacket(m,s,new Map([[entity.global_id,entity]]),view,{entity_id:entity.global_id,xyz:[1,.45,-1],frame_id:'proxy_world',unit:'meter'},options);
  value.hit!.source!.xyz=[3,1,.45];
  Object.assign(value.spatial_context!,locatePoint(options.registry,{xyz:[3,1,.45],frame_id:'world',unit:'meter',up_axis:'Z'}));
  expect(contextPacketSchema.safeParse(value).success).toBe(false);
});
it('rejects spatial axis claims that disagree with the declared source/view',()=>{
  const {m,s,entity,view,options}=setup();
  const value=createContextPacket(m,s,new Map([[entity.global_id,entity]]),view,{entity_id:entity.global_id,xyz:[1,.45,-1],frame_id:'proxy_world',unit:'meter'},options);
  value.spatial_context!.up_axis='X';expect(contextPacketSchema.safeParse(value).success).toBe(false);
});
it('keeps embedded readiness consistent when registry artifact provenance is missing',()=>{
  const {m,s,entity,view,options}=setup();
  const value=createContextPacket(m,s,new Map([[entity.global_id,entity]]),view,null,{project:options.project,registry:options.registry});
  expect(value.spatial_context!.readiness).toBe('BLOCKED_FOR_SPATIAL_CONTEXT');
  expect(value.spatial_context!.semantic_status!.status).toBe(value.spatial_context!.readiness);
});
