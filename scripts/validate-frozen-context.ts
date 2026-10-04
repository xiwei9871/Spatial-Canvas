import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,statSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {bindingRegistrySchema,contextPacketSchema} from '../packages/protocol/context';
import {manifestSchema} from '../packages/protocol/index';
import {loadProxy} from '../packages/viewer/index';
import {disposeScene} from '../packages/viewer/scene';

const folder=path.resolve(process.argv[2]??'task-output/v03-c-type');
const read=(name:string)=>JSON.parse(readFileSync(path.join(folder,name),'utf8'));
const before=read('source-before.json') as {source_path:string;sha256:string;mtime_ns:string;size:number;manifest_sha256:string};
const sha=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex');
const registryFile=path.join(folder,'spatial-canvas.bindings.json');
const registry=bindingRegistrySchema.parse(read('spatial-canvas.bindings.json'));
assert.ok(registry.source_frame,'Blender sidecar requires source frame');
assert.equal(sha(before.source_path),before.sha256);
assert.equal(sha(before.source_path),registry.source_sha256);
assert.equal(statSync(before.source_path,{bigint:true}).mtimeNs.toString(),String(before.mtime_ns));
const bindingHash=sha(registryFile);
const fullIds=new Set<string>();
for(const [name,directory] of [['interaction_proxy','full'],['task_proxy','task']]){
  const manifest=manifestSchema.parse(read(directory+'/'+name+'.manifest.json'));
  const bytes=readFileSync(path.join(folder,directory!,manifest.proxy_uri));
  const proxy=await loadProxy(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer,manifest);
  for(const entity of proxy.entities.values()){
    assert.equal(entity.mutable,false);
    if(directory==='full')fullIds.add(entity.global_id);
    else assert.ok(fullIds.has(entity.global_id));
  }
  assert.equal(manifest.source_sha256,before.sha256);
  disposeScene(proxy.root);
}
const summaries=[];
for(const target of ['sofa','door','wall']){
  const packet=contextPacketSchema.parse(read(target+'.context.json'));
  assert.equal(packet.source.sha256,before.sha256);
  assert.equal(packet.source.locator,before.source_path);
  assert.equal(packet.source.authority,'frozen');
  assert.equal(packet.source.bindings?.sha256,bindingHash);
  assert.equal(packet.selection.source,'pointer');
  assert.ok(packet.hit);
  const entity=packet.entities[0]!;
  const binding=registry.bindings.find(entry=>entry.entity_id===entity.global_id)!;
  assert.equal(binding.native_id,entity.native_object_id);
  assert.equal(entity.semantic_type,target);
  const [x,y,z]=packet.hit!.xyz;
  const s=registry.source_frame!.meters_per_unit;
  const source=packet.hit!.source!;
  assert.equal(source.frame_id,registry.source_frame!.frame_id);
  assert.ok(Math.abs(source.xyz[0]-x/s)<1e-6&&Math.abs(source.xyz[1]+z/s)<1e-6&&Math.abs(source.xyz[2]-y/s)<1e-6);
  summaries.push({semantic_type:target,entity_id:entity.global_id,native_id:binding.native_id,source_hit:source.xyz});
}
const report={status:'passed',source_sha256:before.sha256,source_mtime_unchanged:true,full_entities:fullIds.size,
  registry_sha256:bindingHash,packets:summaries};
writeFileSync(path.join(folder,'context-validation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
