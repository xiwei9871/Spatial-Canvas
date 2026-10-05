import {expect,it} from 'vitest';
import {createContextPacket} from '../packages/core/context';
import {manifest,selection} from './data';
import {packet} from './context-data';
import {relationshipGraphSchema} from '../packages/protocol/relationships';
import {graph} from './relationship-data';
import {manifestSchema,selectionSchema} from '../packages/protocol/index';
import {cameraViewSchema,contextPacketSchema} from '../packages/protocol/context';
it('adds only compact typed relationship neighborhood to ContextPacket',()=>{
  const entity={design_id:'design_demo',global_id:'bottom',native_object_id:'BOTTOM',semantic_type:'sink',room_id:'unassigned',source_resource_id:'src_demo',source_revision:'r1',mutable:false};
  const m=manifestSchema.parse({...manifest,source_resource_id:'src_demo',source_resource:'src_demo',source_revision:'r1',coordinate_frame:'demo_world',source_sha256:'a'.repeat(64),extensions:{}});
  const s=selectionSchema.parse({...selection,resource_id:m.resource_id,entity_ids:['bottom']});const g=relationshipGraphSchema.parse(graph);
  g.edges=g.edges.filter(e=>e.type!=='transition_between');g.nodes=g.nodes.filter(n=>!['space','level'].includes(n.kind));g.design_id=m.design_id;g.sources[0]!.resource_id='src_demo';g.nodes[0]!.resource_id='src_demo';g.nodes[0]!.native_id='BOTTOM';for(const n of g.nodes)n.resource_id='src_demo';for(const e of g.edges)e.provenance.source_resource_id='src_demo';
  const view=cameraViewSchema.parse({...packet.view.data,frame_id:'demo_world'});
  const value=createContextPacket({...m,scope:'task'},s,new Map([['bottom',entity]]),view,null,{relationshipGraph:g,relationshipArtifact:{sha256:'b'.repeat(64),locator:'graph.json'}});
  const bad=structuredClone(value);bad.relationships!.design_id='foreign';expect(contextPacketSchema.safeParse(bad).success).toBe(false);
  const ghost=structuredClone(value);ghost.relationships!.nodes.find(n=>n.node_id==='bottom')!.native_id='GHOST';expect(contextPacketSchema.safeParse(ghost).success).toBe(false);
  expect(value.relationships?.subject_id).toBe('bottom');expect(value.relationships?.edges.find(e=>e.type==='connected_to')).toBeTruthy();expect(value.relationships?.edges.some(e=>e.type==='adjacent_to')).toBe(true);
});
