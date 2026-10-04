import { describe, expect, it } from 'vitest';
import { bindingRegistrySchema, contextPacketSchema } from '../packages/protocol/context';

import {registry,packet} from './context-data';

describe('sidecar contracts', () => {
  it('accepts frozen identities independent of source custom properties', () => {
    expect(bindingRegistrySchema.safeParse(registry).success).toBe(true);
    expect(bindingRegistrySchema.safeParse({...registry, bindings:[{...registry.bindings[0],adapter:'freecad'}]}).success).toBe(true);
    expect(bindingRegistrySchema.safeParse({...registry,source_frame:undefined,
      bindings:[{...registry.bindings[0],adapter:'web',native_id:'#button',room_id:'unassigned'}]}).success).toBe(true);
  });
  it('rejects duplicate entity/native mappings and missing full provenance', () => {
    for (const patch of [{ schema:'v2' },{ source_sha256:'d109c7...' },{ source_revision:'' },
      { bindings:[registry.bindings[0],registry.bindings[0]] },
      { bindings:[registry.bindings[0],{...registry.bindings[0],entity_id:'another'}] }]) {
      expect(bindingRegistrySchema.safeParse({...registry,...patch}).success).toBe(false);
    }
  });
});
describe('context contracts', () => {
  it('accepts context composed of selection/source/entity/view/hit, or no pointer hit', () => {
    expect(contextPacketSchema.safeParse(packet).success).toBe(true);
    expect(contextPacketSchema.safeParse({...packet,hit:null}).success).toBe(true);
    expect(contextPacketSchema.safeParse({...packet,resource:{...packet.resource,type:'webpage',format:'html'},
      view:{kind:'dom',data:{selector:'#button'}},hit:null}).success).toBe(true);
  });
  it('rejects mismatched selection, stale entities and fabricated targets', () => {
    for (const patch of [{source:{...packet.source,revision:'old'}},{entities:[]},
      {hit:{...packet.hit,entity_id:'other'}},{resource:{...packet.resource,design_id:'other'}},
      {entities:[{...packet.entities[0],mutable:true}]}]) {
      expect(contextPacketSchema.safeParse({...packet,...patch}).success).toBe(false);
    }
  });
  it('rejects non-finite camera/hit data', () => {
    expect(contextPacketSchema.safeParse({...packet,hit:{...packet.hit,xyz:[Infinity,0,0]}}).success).toBe(false);
    expect(contextPacketSchema.safeParse({...packet,view:{kind:'camera3d',data:{...packet.view.data,position:[NaN,0,0]}}}).success).toBe(false);
  });
  it('requires valid explicit primary selection, perspective FOV and finite normal',()=>{
    expect(contextPacketSchema.safeParse({...packet,selection:{...packet.selection,primary_entity_id:'missing'}}).success).toBe(false);
    expect(contextPacketSchema.safeParse({...packet,selection:{...packet.selection,primary_entity_id:null}}).success).toBe(false);
    expect(contextPacketSchema.safeParse({...packet,hit:{...packet.hit,normal:[NaN,0,1]}}).success).toBe(false);
    expect(contextPacketSchema.safeParse({...packet,view:{kind:'camera3d',data:{...packet.view.data,projection:'perspective',fov_degrees:200}}}).success).toBe(false);
    expect(contextPacketSchema.safeParse({...packet,selection:{...packet.selection,entity_ids:[],primary_entity_id:null,mode:'clear'},
      entities:[],hit:null}).success).toBe(true);
  });
});
