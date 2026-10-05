import {expect,it} from 'vitest';
import {importSemantics,parseJsonBytes} from '../packages/core/semantic-import';
import {spaces,project} from './space-data';
import {createHash} from 'node:crypto';
it('imports exact registry bytes and ignores user-supplied readiness claims',async()=>{
  const raw=JSON.stringify(spaces());
  const result=await importSemantics([{name:'spaces.json',text:raw},{name:'project.json',text:JSON.stringify({...project(),readiness:'READY'})}]);
  expect(result.registry?.registry_id).toBe('spaces_home');expect(result.artifact?.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(result.project).not.toHaveProperty('readiness');
});
it('hashes original BOM-prefixed bytes independently of JSON decoding',async()=>{
  const bytes=new Uint8Array(Buffer.concat([Buffer.from([239,187,191]),Buffer.from(JSON.stringify(spaces()))]));
  const result=await importSemantics([{name:'spaces.json',bytes}]);
  expect(result.registry?.registry_id).toBe('spaces_home');
  expect(result.artifact?.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
  expect(parseJsonBytes(bytes)).toEqual(spaces());
});
it('rejects duplicates and unrelated files instead of silently selecting a registry',async()=>{
  const value={name:'a.json',text:JSON.stringify(spaces())};
  await expect(importSemantics([value,{...value,name:'b.json'}])).rejects.toThrow(/one/);
  await expect(importSemantics([{name:'unknown.json',text:'{}'}])).rejects.toThrow(/Unsupported/);
});
