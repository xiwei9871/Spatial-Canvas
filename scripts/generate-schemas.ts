import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { entitySchema, executionResultSchema, frameSchema, intentSchema, manifestSchema, resourceSchema, selectionSchema } from '../packages/protocol/index';
import { bindingRegistrySchema, cameraViewSchema, contextPacketSchema, sourceFrameSchema } from '../packages/protocol/context';
import {spaceRegistrySchema,projectSchema,semanticStatusSchema,spatialContextSchema} from '../packages/protocol/spaces';
import {relationshipGraphSchema,relationshipStatusSchema} from '../packages/protocol/relationships';
import {relationshipContextSchema} from '../packages/protocol/relationship-context';
import {viewPresetSchema} from '../packages/protocol/view-preset';

await mkdir('schemas', { recursive: true });
for (const [name, schema] of Object.entries({ 'view-preset':viewPresetSchema, resource: resourceSchema, entity: entitySchema, frame: frameSchema, manifest: manifestSchema, selection: selectionSchema, intent: intentSchema, 'execution-result': executionResultSchema, bindings:bindingRegistrySchema, context:contextPacketSchema, 'camera-view':cameraViewSchema, 'source-frame':sourceFrameSchema,spaces:spaceRegistrySchema,project:projectSchema,'semantic-status':semanticStatusSchema,'spatial-context':spatialContextSchema,relationships:relationshipGraphSchema,'relationship-status':relationshipStatusSchema,'relationship-context':relationshipContextSchema })) {
  const json = z.toJSONSchema(schema, { target: 'draft-7', io: 'input' });
  // JSON Schema cannot infer Zod refinements. Encode the same portable constraints explicitly.
  if(name==='view-preset'){for(const key of ['hidden_entity_ids','ghost_entity_ids'])json.properties![key]={...(json.properties![key] as object),uniqueItems:true};}
  if (name === 'selection') {
    json.properties!.entity_ids = { ...(json.properties!.entity_ids as object), uniqueItems: true };
    json.allOf = [{ if: { properties: { mode: { const: 'clear' } } }, then: { properties: { entity_ids: { maxItems: 0 } } } }];
  }
  if (name === 'execution-result') {
    for (const variant of json.oneOf ?? []) {
      if (typeof variant === 'object' && variant.properties?.targets && typeof variant.properties.targets === 'object') {
        variant.properties.targets.uniqueItems = true;
      }
    }
  }
  if(name==='context'){
    const camera=z.toJSONSchema(cameraViewSchema,{target:'draft-7',io:'input'});
    delete camera.$schema;
    json.allOf=[
      {if:{properties:{view:{properties:{kind:{const:'camera3d'}},required:['kind']}},required:['view']},
        then:{properties:{view:{properties:{data:camera}}}}},
      {if:{properties:{selection:{properties:{entity_ids:{maxItems:0}},required:['entity_ids']}},required:['selection']},
        then:{properties:{selection:{properties:{primary_entity_id:{type:'null'}}}}},
        else:{properties:{selection:{properties:{primary_entity_id:{type:'string',minLength:1}}}}}},
    ];
  }
  json.$id = `urn:spatial-canvas:${name}:v1`;
  await writeFile(`schemas/${name}.schema.json`, JSON.stringify(json, null, 2) + '\n');
}
console.log('Generated 19 protocol JSON schemas; geometry, graph integrity and identity/provenance relations are additionally checked at runtime.');
