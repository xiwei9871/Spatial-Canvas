import {parseArgs} from 'node:util';import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {resolve} from 'node:path';
import {relationshipGraphSchema} from '../packages/protocol/relationships';import {contextPacketSchema,bindingRegistrySchema} from '../packages/protocol/context';import {spaceRegistrySchema} from '../packages/protocol/spaces';import {parseJsonBytes} from '../packages/core/semantic-import';import {compactNeighborhood} from '../packages/core/relationships';import {relationshipStatus} from '../packages/core/relationship-status';
const {values:v}=parseArgs({options:{graph:{type:'string'},packet:{type:'string',multiple:true},output:{type:'string'}}});
if(!v.graph||!v.packet?.length||!v.output)throw new Error('Required --graph PATH --packet PATH (repeatable) --output NEW.json');
const bytes=await readFile(v.graph),g=relationshipGraphSchema.parse(parseJsonBytes(bytes)),sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
for(const s of g.sources){if(!s.locator)throw new Error('Source locator missing: '+s.resource_id);if(sha(await readFile(s.locator))!==s.sha256)throw new Error('Source bytes SHA mismatch: '+s.resource_id);}
const checked=[];
for(const path of v.packet){const p=contextPacketSchema.parse(parseJsonBytes(await readFile(path))),r=p.relationships;if(!r||r.status!=='available'||r.registry?.sha256!==sha(bytes)||r.graph_id!==g.graph_id||r.graph_revision!==g.revision||p.resource.design_id!==g.design_id)throw new Error('Packet graph/provenance mismatch');
 const expected=compactNeighborhood(g,r.subject_id!,r.primary_space_id??undefined);
 if(JSON.stringify(expected.nodes)!==JSON.stringify(r.nodes)||JSON.stringify(expected.edges)!==JSON.stringify(r.edges)||expected.truncated!==r.truncated||JSON.stringify(g.sources)!==JSON.stringify(r.sources))throw new Error('Packet neighborhood differs from original graph');
 const n=g.nodes.find(n=>n.node_id===r.subject_id);if(!n||n.native_id!==p.entities.find(e=>e.global_id===r.subject_id)?.native_object_id)throw new Error('Native/global locator mismatch');
 const model=g.sources.find(s=>s.resource_id===p.source.resource_id);if(!model||model.revision!==p.source.revision||model.sha256!==p.source.sha256)throw new Error('Model revision/SHA mismatch');
 if(JSON.stringify(r.readiness)!==JSON.stringify(relationshipStatus(g,{required:['component_hierarchy','physical_connectivity','space_adjacency','transition_graph']})))throw new Error('Packet capability readiness differs from recomputed graph status');
 for(const node of g.nodes.filter(n=>n.kind==='space'||n.kind==='level')){
  const source=g.sources.find(s=>s.resource_id===node.resource_id)!;
  const registry=spaceRegistrySchema.parse(parseJsonBytes(await readFile(source.locator!)));
  const applicability=registry.applies_to.find(s=>s.resource_id===p.source.resource_id);
  if(registry.design_id!==g.design_id||registry.registry_id!==source.resource_id||registry.registry_revision!==source.revision||!applicability||applicability.revision!==p.source.revision||applicability.sha256!==p.source.sha256)throw new Error('Graph Space Registry identity/model applicability mismatch');
  if(node.kind==='space'&&!registry.spaces.some(s=>s.space_id===(node.space_id??node.node_id)))throw new Error('Graph semantic space missing in actual registry');
  if(node.kind==='level'&&!registry.spaces.some(s=>s.level_id===(node.level_id??node.node_id)))throw new Error('Graph semantic level missing in actual registry');
 }
 if(p.source.bindings){
  const bytes=await readFile(p.source.bindings.locator),bindings=bindingRegistrySchema.parse(parseJsonBytes(bytes));
  if(sha(bytes)!==p.source.bindings.sha256||bindings.design_id!==g.design_id||bindings.source_resource_id!==p.source.resource_id||bindings.source_revision!==p.source.revision||bindings.source_sha256!==p.source.sha256||bindings.registry_id!==p.source.bindings.registry_id||bindings.registry_revision!==p.source.bindings.registry_revision)throw new Error('Packet binding registry provenance mismatch');
  for(const node of g.nodes.filter(n=>n.kind==='entity'&&n.resource_id===p.source.resource_id))if(!bindings.bindings.some(b=>b.entity_id===node.node_id&&b.native_id===node.native_id))throw new Error('Graph entity absent from actual native/global bindings');
 }
 checked.push({packet:path,subject:r.subject_id,native_id:n.native_id,edges:r.edges.length,verified:r.edges.filter(e=>e.verification.state==='verified').length,candidates:r.edges.filter(e=>e.verification.state==='candidate').length});}
if([v.graph,...v.packet,...g.sources.flatMap(s=>s.locator?[s.locator]:[])].some(s=>resolve(s)===resolve(v.output!)))throw new Error('Output aliases input/source');
const report={status:'passed',graph_id:g.graph_id,revision:g.revision,graph_sha256:sha(bytes),source_bytes_verified:true,checked};await writeFile(v.output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report,null,2));
