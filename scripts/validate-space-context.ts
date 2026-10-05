import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {resolve} from 'node:path';
import {contextPacketSchema} from '../packages/protocol/context';
import {projectSchema,spaceRegistrySchema} from '../packages/protocol/spaces';
import {locatePoint,type RegionPoint} from '../packages/core/regions';
import {ingestProject} from '../packages/core/ingestion';
import {parseJsonBytes} from '../packages/core/semantic-import';

const {values}=parseArgs({options:{project:{type:'string'},spaces:{type:'string'},packet:{type:'string',multiple:true},output:{type:'string'}}});
if(!values.project||!values.spaces||!values.packet?.length||!values.output)throw new Error('Required: --project PATH --spaces PATH --packet PATH (repeatable) --output NEW.json');
const registryBytes=await readFile(values.spaces);
const registry=spaceRegistrySchema.parse(parseJsonBytes(registryBytes));
const project=projectSchema.parse(parseJsonBytes(await readFile(values.project)));
const status=ingestProject(project,registry);
if(status.status==='BLOCKED_FOR_SPATIAL_CONTEXT')throw new Error('Spatial evidence is blocked: '+JSON.stringify(status.diagnostics));
const hash=(buffer:Uint8Array)=>createHash('sha256').update(buffer).digest('hex');
for(const source of project.sources)if(hash(await readFile(source.locator))!==source.sha256)throw new Error('Source SHA mismatch: '+source.resource_id);
const packets=[];
for(const path of values.packet){
  const packet=contextPacketSchema.parse(parseJsonBytes(await readFile(path)));
  const spatial=packet.spatial_context;
  if(!packet.hit||!spatial?.point||!spatial.frame_id||!spatial.unit||!spatial.up_axis||!spatial.registry)throw new Error('Packet lacks actual hit/spatial provenance');
  const applies=registry.applies_to.find(s=>s.resource_id===packet.source.resource_id);
  if(packet.resource.design_id!==registry.design_id||!applies||applies.revision!==packet.source.revision||applies.sha256!==packet.source.sha256)throw new Error('Packet/source applicability mismatch');
  if(spatial.registry.sha256!==hash(registryBytes)||spatial.registry.registry_id!==registry.registry_id||spatial.registry.registry_revision!==registry.registry_revision)throw new Error('Registry artifact mismatch');
  const result=locatePoint(registry,{xyz:spatial.point,frame_id:spatial.frame_id,unit:spatial.unit as RegionPoint['unit'],up_axis:spatial.up_axis});
  if(JSON.stringify(result.containing_spaces)!==JSON.stringify(spatial.containing_spaces)||result.primary_space_id!==spatial.primary_space_id||result.resolution!==spatial.resolution)throw new Error('Recomputed spatial resolution differs from packet');
  if(spatial.resolution!=='exact')throw new Error('Acceptance packet did not resolve exactly');
  packets.push({packet:path,entity_id:packet.selection.primary_entity_id,native_id:packet.entities.find(e=>e.global_id===packet.selection.primary_entity_id)?.native_object_id,space_id:spatial.primary_space_id,source_hit:packet.hit.source?.xyz??packet.hit.xyz});
}
if(packets.length>1&&(new Set(packets.map(p=>p.entity_id)).size!==1||new Set(packets.map(p=>p.space_id)).size!==packets.length))throw new Error('Acceptance requires one physical entity with distinct spatial regions');
const inputs=[values.project,values.spaces,...values.packet,...project.sources.map(s=>s.locator)];
if(inputs.some(p=>resolve(p)===resolve(values.output!)))throw new Error('Output aliases an input');
const report={status:'passed',semantic_readiness:status.status,registry_sha256:hash(registryBytes),source_hashes_verified:true,same_entity_distinct_spaces:packets.length>1,packets};
await writeFile(values.output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report,null,2));
