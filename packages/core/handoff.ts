import type {ContextPacket} from '../protocol/context';

function identity(packet:ContextPacket){
  const selected=packet.selection.entity_ids;
  const primary=packet.selection.primary_entity_id??selected[0];
  const entity=packet.entities.find(e=>e.global_id===primary);
  const label=entity?entity.native_object_id:packet.source.resource_id;
  return {label,id:entity?.global_id??packet.source.resource_id,count:selected.length};
}
function singleLine(value:string){return value.replace(/\s+/gu,' ').trim();}
function filenamePart(value:string,budget:number){
  const clean=value.normalize('NFC').replace(/[^\p{L}\p{N}_.-]+/gu,'-').replace(/^[.-]+|[.-]+$/gu,'')||'unnamed';
  let result='';
  for(const char of clean){if(new TextEncoder().encode(result+char).length>budget)break;result+=char;}
  return result||'unnamed';
}
export function handoffTitle(packet:ContextPacket):string{
  const {label,id,count}=identity(packet);
  const selection=count>1?' — '+count+' objects':'';
  return singleLine(label)+' ['+singleLine(id)+']'+selection+' — '+singleLine(packet.source.revision);
}
export function contextExportFilename(packet:ContextPacket):string{
  const {label,id,count}=identity(packet);
  const selection=count>1?'--'+count+'-objects':'';
  const time=packet.timestamp.replace(/[^0-9TZ]/g,'');
  return 'spatial-canvas.context--'+filenamePart(label,60)+'--'+filenamePart(id,40)+selection+'--'+filenamePart(packet.source.revision,40)+'--'+filenamePart(time,24)+'.json';
}
export function handoffExportFilename(packet:ContextPacket):string{
  return contextExportFilename(packet).replace('spatial-canvas.context--','spatial-canvas.handoff--').replace(/\.json$/,'.txt');
}
export function buildAiHandoff(packet:ContextPacket):string{
  return `${handoffTitle(packet)} — Spatial Canvas AI Handoff\nSuggested filename: ${handoffExportFilename(packet)}\n\nUse only the Spatial Canvas ContextPacket below. Do not scan or rediscover the source scene unless the user explicitly asks.\n\nAnswer from the packet's selected entity identity, source/revision/SHA, spatial_context and relationships. Distinguish direct connection, component membership, embedding, adjacency and transitions exactly as typed. Mark candidate, rejected, partial, unresolved and unavailable information as such; do not upgrade it to a verified fact. Missing relation data is not permission to infer.\n\nThe interaction proxy is derived. The cited source remains authoritative, and this context is not authorization to edit any source.\n\n<ContextPacket>\n${JSON.stringify(packet,null,2)}\n</ContextPacket>`;
}
export async function copyWithFallback(text:string,write:(text:string)=>Promise<void>){try{await write(text);return {copied:true,fallback:null as string|null,error:null as string|null};}catch(error){return {copied:false,fallback:text,error:error instanceof Error?error.message:String(error)};}}
export class ContextSnapshot{private key?:string;private text?:string;private snapshot?:ContextPacket;get<T extends ContextPacket>(key:string,create:()=>T):T{if(key!==this.key||!this.text){this.key=key;this.text=JSON.stringify(create());this.snapshot=JSON.parse(this.text) as ContextPacket;}return this.snapshot as T;}clear(){this.key=undefined;this.text=undefined;this.snapshot=undefined;}}
