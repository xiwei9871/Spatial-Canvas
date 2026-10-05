import {expect,it} from 'vitest';
import {SemanticState} from '../packages/core/semantic-state';
import {importSemantics} from '../packages/core/semantic-import';
import {project,spaces} from './space-data';
import {manifestSchema} from '../packages/protocol/index';
import {manifest} from './data';
it('invalid spaces/project replacement clears old context and dependent graph',async()=>{
 const state=new SemanticState();await state.replaceSpatial([{name:'spaces.json',text:JSON.stringify(spaces())},{name:'project.json',text:JSON.stringify(project())}]);expect(state.value.registry).toBeTruthy();
 await expect(state.replaceSpatial([{name:'bad.json',text:'{'}])).rejects.toThrow(/JSON|parse/);expect(state.value.registry).toBeUndefined();expect(state.value.project).toBeUndefined();
});
it('proxy revision/design/hash changes clear incompatible trust even when no registry is loaded',async()=>{
 const state=new SemanticState();const p=project();p.design_id='design_demo';p.sources[0]!.resource_id='src_demo';p.sources[0]!.revision='r1';
 await state.replaceSpatial([{name:'project.json',text:JSON.stringify(p)}]);state.proxyChanged(manifestSchema.parse(manifest));expect(state.value.project).toBeTruthy();
 state.proxyChanged(manifestSchema.parse({...manifest,source_revision:'r2'}));expect(state.value.project).toBeUndefined();
});
it('a late import cannot restore state after clear or proxy rejection',async()=>{
 const state=new SemanticState();let resolve!: (v:Awaited<ReturnType<typeof importSemantics>>)=>void;
 const promise=state.applySpatial(async()=>await new Promise(r=>{resolve=r;}));state.invalidate('proxy');resolve(await importSemantics([{name:'spaces',text:JSON.stringify(spaces())}]));await promise;expect(state.value.registry).toBeUndefined();
});
it('invalid graph replacement clears graph only, retaining valid spatial data',async()=>{
 const state=new SemanticState();await state.replaceSpatial([{name:'spaces',text:JSON.stringify(spaces())}]);await expect(state.replaceGraph([{name:'invalid',bytes:new TextEncoder().encode('{}')}])).rejects.toThrow();expect(state.value.registry).toBeTruthy();expect(state.value.relationshipGraph).toBeUndefined();
});
