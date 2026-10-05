import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';import {expect,it} from 'vitest';
import {graph as fixture} from './relationship-data';import {spaces,project} from './space-data';import {relationshipGraphSchema} from '../packages/protocol/relationships';import {spaceRegistrySchema,projectSchema} from '../packages/protocol/spaces';import {manifestSchema,selectionSchema} from '../packages/protocol/index';import {cameraViewSchema} from '../packages/protocol/context';import {packet as cameraPacket} from './context-data';import {createContextPacket} from '../packages/core/context';import {compactNeighborhood} from '../packages/core/relationships';
const sha=(b:string|Uint8Array)=>createHash('sha256').update(b).digest('hex');
const run=(args:string[])=>spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs',...args],{encoding:'utf8'});
it('standalone CLI rejects nonexistent registry endpoints and forged readiness',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'spatial-graph-cli-'));
 try{
  const model=join(dir,'model.json'),registryPath=join(dir,'spaces.json'),graphPath=join(dir,'graph.json'),packetPath=join(dir,'packet.json');
  await writeFile(model,'synthetic model source');const modelHash=sha(await readFile(model));
  const r=spaceRegistrySchema.parse(spaces());r.source_context.sources[0]!.sha256=modelHash;r.applies_to[0]!.sha256=modelHash;
  await writeFile(registryPath,JSON.stringify(r));const registryHash=sha(await readFile(registryPath));
  const g=relationshipGraphSchema.parse(fixture);g.design_id='home';g.sources=[{resource_id:'model',revision:'r4',sha256:modelHash,locator:model},{resource_id:r.registry_id,revision:r.registry_revision,sha256:registryHash,locator:registryPath}];
  for(const n of g.nodes){n.resource_id=n.kind==='space'?r.registry_id:'model';if(n.kind==='space')n.space_id=n.node_id==='spaceA'?'lounge':'corridor';}
  for(const e of g.edges){e.provenance.source_revision='r4';e.provenance.source_sha256=modelHash;}
  await writeFile(graphPath,JSON.stringify(g));
  const m=manifestSchema.parse({schema:'interaction-proxy-v1',resource_id:'proxy',design_id:'home',type:'interaction_proxy',format:'glb',authority:'derived',proxy_uri:'proxy.glb',source_resource_id:'model',source_resource:model,source_sha256:modelHash,source_revision:'r4',coordinate_frame:'proxy',unit:'meter',up_axis:'Y',scope:'full',entity_count:7});
  const s=selectionSchema.parse({schema:'spatial-canvas.selection.v1',design_id:'home',resource_id:'proxy',source_revision:'r4',entity_ids:['door'],mode:'replace',source:'list',timestamp:'2026-10-05T04:00:00.000Z'});
  const entities=new Map(g.nodes.filter(n=>n.kind==='entity').map(n=>[n.node_id,{design_id:'home',global_id:n.node_id,native_object_id:n.native_id!,source_resource_id:'model',source_revision:'r4',semantic_type:'unassigned',room_id:'unassigned'}]));
  const p=createContextPacket(m,s,entities,cameraViewSchema.parse({...cameraPacket.view.data,frame_id:'proxy'}),null,{registry:r,artifact:{sha256:registryHash,locator:registryPath},relationshipGraph:g,relationshipArtifact:{sha256:sha(await readFile(graphPath)),locator:graphPath}});
  expect(p.relationships!.status).toBe('available');await writeFile(packetPath,JSON.stringify(p));
  const good=run(['scripts/validate-relationship-context.ts','--graph',graphPath,'--packet',packetPath,'--output',join(dir,'good.json')]);expect(good.status,good.stderr).toBe(0);
  const forged=structuredClone(p);for(const cap of ['component_hierarchy','physical_connectivity','space_adjacency','transition_graph'] as const)forged.relationships!.readiness[cap]={status:'READY',diagnostics:[]};await writeFile(packetPath,JSON.stringify(forged));
  const ready=run(['scripts/validate-relationship-context.ts','--graph',graphPath,'--packet',packetPath,'--output',join(dir,'forged.json')]);expect(ready.status).not.toBe(0);expect(ready.stderr).toContain('capability readiness');
  g.nodes.find(n=>n.node_id==='spaceB')!.space_id='NONEXISTENT';await writeFile(graphPath,JSON.stringify(g));const n=compactNeighborhood(g,'door');p.relationships!.nodes=n.nodes;p.relationships!.edges=n.edges;p.relationships!.registry!.sha256=sha(await readFile(graphPath));await writeFile(packetPath,JSON.stringify(p));
  const missing=run(['scripts/validate-relationship-context.ts','--graph',graphPath,'--packet',packetPath,'--output',join(dir,'missing.json')]);expect(missing.status).not.toBe(0);expect(missing.stderr).toContain('semantic space missing');
 }finally{await rm(dir,{recursive:true,force:true});}
},15000);
it('ingestion CLI blocks relationship capabilities when graph evidence bytes changed',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'spatial-graph-ingest-'));
 try{
  const p=projectSchema.parse(project());const g=relationshipGraphSchema.parse(fixture);g.design_id=p.design_id;g.sources[0]!.revision='r4';g.requirements=[{capability:'component_hierarchy',node_id:'bottom',types:['part_of']}];
  for(const s of p.sources){s.locator=join(dir,s.resource_id+'.txt');await writeFile(s.locator,s.resource_id);s.sha256=sha(await readFile(s.locator));}
  g.sources=[{resource_id:'model',revision:'r4',sha256:p.sources[0]!.sha256,locator:p.sources[0]!.locator}];
  for(const e of g.edges){e.provenance.source_revision='r4';e.provenance.source_sha256=p.sources[0]!.sha256;}
  const projectPath=join(dir,'project.json'),graphPath=join(dir,'graph.json'),output=join(dir,'status.json');await writeFile(projectPath,JSON.stringify(p));await writeFile(graphPath,JSON.stringify(g));await writeFile(p.sources[0]!.locator,'changed');
  const result=run(['scripts/ingest-project.ts','--project',projectPath,'--relationships',graphPath,'--output',output]);expect(result.status,result.stderr).toBe(0);const status=JSON.parse(await readFile(output,'utf8'));expect(status.relationship_status.component_hierarchy.status).toBe('BLOCKED');
 }finally{await rm(dir,{recursive:true,force:true});}
},15000);
