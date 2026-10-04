import {expect,it} from 'vitest';
import {createContextPacket} from '../packages/core/context';
import {createIntent} from '../packages/core/index';
import {cameraViewSchema,contextHitSchema,contextSelectionSchema} from '../packages/protocol/context';
import {manifestSchema,selectionSchema} from '../packages/protocol/index';
import {packet} from './context-data';

const manifest=manifestSchema.parse({
  schema:'interaction-proxy-v1',...packet.resource,proxy_uri:'interaction_proxy.glb',
  source_resource_id:packet.source.resource_id,source_revision:packet.source.revision,
  source_sha256:packet.source.sha256,source_resource:packet.source.locator,
  coordinate_frame:'proxy_world',unit:'meter',up_axis:'Y',entity_count:1,scope:'full',
  source_frame:{coordinate_frame:'c_type_world',unit:'meter',up_axis:'Z'},
  extensions:{'spatial_canvas.blender':{source_authority:'frozen',meters_per_scene_unit:1,source_coordinate_frame:'c_type_world'}},
});
const entities=new Map([[packet.entities[0]!.global_id,packet.entities[0]!]]);
it('packages actual hit/source/view identity without modifying the caller snapshot',()=>{
  const hit=contextHitSchema.parse({...packet.hit,xyz:[2,3,-4]});
  const before=JSON.stringify(hit);
  const result=createContextPacket(manifest,selectionSchema.parse(packet.selection),entities,cameraViewSchema.parse(packet.view.data),hit);
  expect(result.hit?.source?.xyz).toEqual([2,4,3]);
  expect(result.source.locator).toBe('/local/frozen.blend');
  expect(result.source.authority).toBe('frozen');
  expect(result.selection.primary_entity_id).toBe('ent_sofa');
  expect(JSON.stringify(hit)).toBe(before);
});
it('keeps absent/list/reload hit null and rejects frozen transform requests',()=>{
  expect(createContextPacket(manifest,selectionSchema.parse(packet.selection),entities,cameraViewSchema.parse(packet.view.data),null).hit).toBe(null);
  expect(()=>createIntent(manifest,['ent_sofa'],entities,[.5,0,0])).toThrow(/Frozen/);
});
it('converts explicit non-unit scale without inventing a coordinate frame',()=>{
  const centimeters={...manifest,source_frame:{coordinate_frame:'c_type_world',unit:'centimeter' as const,up_axis:'Z' as const},
    extensions:{'spatial_canvas.blender':{source_authority:'frozen',meters_per_scene_unit:.01,source_coordinate_frame:'c_type_world'}}};
  const result=createContextPacket(centimeters,selectionSchema.parse(packet.selection),entities,cameraViewSchema.parse(packet.view.data),contextHitSchema.parse(packet.hit));
  expect(result.hit?.source?.xyz).toEqual([-100,-0,50]);
  expect(result.hit?.source?.unit).toBe('centimeter');
});
it('rejects inconsistent proxy frame, source axis and named unit scale',()=>{
  const view=cameraViewSchema.parse(packet.view.data);
  const hit=contextHitSchema.parse(packet.hit);
  expect(()=>createContextPacket(manifest,selectionSchema.parse(packet.selection),entities,{...view,frame_id:'other'},hit)).toThrow(/frame/);
  const badUnits={...manifest,extensions:{'spatial_canvas.blender':{source_authority:'frozen',meters_per_scene_unit:.01,source_coordinate_frame:'c_type_world'}}};
  expect(()=>createContextPacket(badUnits,selectionSchema.parse(packet.selection),entities,view,hit)).toThrow(/units/);
  const badAxis={...manifest,source_frame:{coordinate_frame:'c_type_world',unit:'meter' as const,up_axis:'Y' as const}};
  expect(()=>createContextPacket(badAxis,selectionSchema.parse(packet.selection),entities,view,hit)).toThrow(/frame/);
});
it('preserves an explicit primary independent of selection array order and rejects hit conflict',()=>{
  const door={...packet.entities[0]!,global_id:'ent_door',native_object_id:'Door'};
  const multiple=new Map([...entities,['ent_door',door] as const]);
  const explicit=contextSelectionSchema.parse({...packet.selection,entity_ids:['ent_sofa','ent_door'],primary_entity_id:'ent_sofa',source:'list'});
  const view=cameraViewSchema.parse(packet.view.data);
  const multipleManifest={...manifest,entity_count:2};
  expect(createContextPacket(multipleManifest,explicit,multiple,view,null).selection.primary_entity_id).toBe('ent_sofa');
  expect(()=>createContextPacket(multipleManifest,explicit,multiple,view,contextHitSchema.parse({...packet.hit,entity_id:'ent_door'}))).toThrow(/primary/);
});
