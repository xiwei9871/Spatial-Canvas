import {projectSchema,spaceRegistrySchema} from '../protocol/spaces';
import type {LoadedSemantics} from './spatial-context';

export function parseJsonBytes(bytes:Uint8Array):unknown{
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}

export async function importSemantics(files:{name:string;text?:string;bytes?:Uint8Array}[]):Promise<LoadedSemantics>{
  const result:LoadedSemantics={};
  for(const file of files){
    if(!file.bytes&&file.text===undefined)throw new Error('Missing semantics file bytes: '+file.name);
    const bytes=file.bytes?new Uint8Array(file.bytes):new TextEncoder().encode(file.text!);
    const data=parseJsonBytes(bytes) as {schema?:string}|null;
    if(!data||typeof data!=='object')throw new Error('Unsupported semantics file: '+file.name);
    if(data.schema==='spatial-canvas.spaces.v1'){
      if(result.registry)throw new Error('Choose exactly one Space Registry.');
      result.registry=spaceRegistrySchema.parse(data);
      const hash=await crypto.subtle.digest('SHA-256',bytes);
      result.artifact={locator:file.name,sha256:Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('')};
    }else if(data.schema==='spatial-canvas.project.v1'){
      if(result.project)throw new Error('Choose exactly one project descriptor.');
      result.project=projectSchema.parse(data);
    }else throw new Error('Unsupported semantics file: '+file.name+'. Import Space Registry or project JSON.');
  }
  return result;
}
