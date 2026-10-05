import {parseArgs} from 'node:util';import {readFile,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import {bindingRegistrySchema} from '../packages/protocol/context';import {parseJsonBytes} from '../packages/core/semantic-import';import {discoverRelationships} from '../packages/core/relationship-discovery';
const {values:v}=parseArgs({options:{evidence:{type:'string'},bindings:{type:'string'},output:{type:'string'}}});
if(!v.evidence||!v.bindings||!v.output)throw new Error('Required --evidence read-only-blender-evidence.json --bindings bindings.json --output NEW-relationships.json');
const registry=bindingRegistrySchema.parse(parseJsonBytes(await readFile(v.bindings)));
const raw=parseJsonBytes(await readFile(v.evidence)) as {source_locator:string;source_sha256:string;frame:{unit:string;up_axis:string;meters_per_unit:number};objects:{native_id:string;parent:string|null;collections:string[];world_aabb:[[number,number,number],[number,number,number]]|null}[]};
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
if(raw.source_sha256!==registry.source_sha256||resolve(raw.source_locator)!==resolve(registry.source_locator)||hash(await readFile(registry.source_locator))!==registry.source_sha256)throw new Error('Evidence/bindings/source bytes mismatch');
if(raw.frame.up_axis!=='Z'||!Number.isFinite(raw.frame.meters_per_unit)||raw.frame.meters_per_unit<=0)throw new Error('Undeclared evidence axis/unit scale');
const bindings=new Map(registry.bindings.map(b=>[b.native_id,b]));
const objects=raw.objects.filter(o=>bindings.has(o.native_id)&&o.world_aabb).map(o=>({node_id:bindings.get(o.native_id)!.entity_id,native_id:o.native_id,
 groups:[...(o.parent?[o.parent]:o.collections)].map(n=>'cmp_'+hash(new TextEncoder().encode(registry.source_resource_id+':'+n)).slice(0,24)),
 bounds:o.world_aabb!.map(point=>point.map(x=>x*raw.frame.meters_per_unit)) as [[number,number,number],[number,number,number]]}));
const result=discoverRelationships(registry.design_id,{resource_id:registry.source_resource_id,revision:registry.source_revision,sha256:registry.source_sha256,frame:{coordinate_frame:registry.source_frame?.frame_id??'blender_source_world',unit:'meter',up_axis:'Z'}},[{objects}]);
result.graph.sources[0]!.locator=registry.source_locator;
if([v.evidence,v.bindings,registry.source_locator].some(p=>resolve(p)===resolve(v.output!)))throw new Error('Output aliases input/source');
await writeFile(v.output,JSON.stringify(result.graph,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({method:result.method,candidate_edges:result.graph.edges.length,gaps:result.graph.gaps,output:v.output}));
