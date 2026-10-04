import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { expect, it } from 'vitest';
import { executionResult, intent, manifest, selection } from './data';
import {registry,packet} from './context-data';

it('validates portable JSON Schema contracts and their rejection cases', async () => {
  const ajv = new Ajv({ strict: false });
  addFormats(ajv);
  for (const [name, value] of Object.entries({ manifest, selection, intent })) {
    const schema = JSON.parse(await readFile('schemas/' + name + '.schema.json', 'utf8'));
    const validate = ajv.compile(schema);
    expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...value, schema: 'unsupported' })).toBe(false);
    expect(validate({ ...value, source_revision: undefined })).toBe(false);
    if (name === 'selection') {
      expect(validate({ ...selection, entity_ids: ['x', 'x'] })).toBe(false);
      expect(validate({ ...selection, mode: 'clear' })).toBe(false);
    }
    if (name === 'manifest') expect(validate({ ...manifest, proxy_uri: '../unsafe.glb' })).toBe(false);
  }
});

it('validates portable applied/rejected/error result shapes and target uniqueness', async () => {
  const ajv = new Ajv({ strict: false });
  addFormats(ajv);
  const schema = JSON.parse(await readFile('schemas/execution-result.schema.json', 'utf8'));
  const validate = ajv.compile(schema);
  expect(validate(executionResult), JSON.stringify(validate.errors)).toBe(true);
  expect(validate({ ...executionResult, targets: ['x', 'x'] })).toBe(false);
  expect(validate({ ...executionResult, targets: [] })).toBe(false);
  expect(validate({ ...executionResult, status: 'rejected', source_revision: 'r1', error: { code: 'stale', message: 'stale' } })).toBe(true);
  expect(validate({ ...executionResult, status: 'error', request_id: null, design_id: null,
    source_resource_id: null, previous_source_revision: null, source_revision: null,
    error: { code: 'io', message: 'read failed' } })).toBe(true);
  expect(validate({ ...executionResult, status: 'error' })).toBe(false);
});
it('validates sidecar/context/camera portable shapes alongside semantic runtime checks',async()=>{
  const ajv=new Ajv({strict:false});
  addFormats(ajv);
  for(const [name,value] of Object.entries({bindings:registry,context:packet,'camera-view':packet.view.data})){
    const schema=JSON.parse(await readFile('schemas/'+name+'.schema.json','utf8'));
    const validate=ajv.compile(schema);
    expect(validate(value),JSON.stringify(validate.errors)).toBe(true);
    if(name!=='camera-view')expect(validate({...value,schema:'unsupported'})).toBe(false);
    if(name==='context'){
      expect(validate({...packet,selection:{...packet.selection,primary_entity_id:undefined}})).toBe(false);
      expect(validate({...packet,view:{kind:'camera3d',data:{...packet.view.data,fov_degrees:undefined}}})).toBe(false);
      expect(validate({...packet,view:{kind:'camera3d',data:{...packet.view.data,fov_degrees:181}}})).toBe(false);
    }
  }
});
