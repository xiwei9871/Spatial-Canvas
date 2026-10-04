import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { entitySchema, executionResultSchema, frameSchema, intentSchema, manifestSchema, resourceSchema, selectionSchema } from '../packages/protocol/index';
import { bindingRegistrySchema, cameraViewSchema, contextPacketSchema, sourceFrameSchema } from '../packages/protocol/context';

await mkdir('schemas', { recursive: true });
for (const [name, schema] of Object.entries({ resource: resourceSchema, entity: entitySchema, frame: frameSchema, manifest: manifestSchema, selection: selectionSchema, intent: intentSchema, 'execution-result': executionResultSchema, bindings:bindingRegistrySchema, context:contextPacketSchema, 'camera-view':cameraViewSchema, 'source-frame':sourceFrameSchema })) {
  const json = z.toJSONSchema(schema, { target: 'draft-7', io: 'input' });
  // JSON Schema cannot infer Zod refinements. Encode the same portable constraints explicitly.
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
  json.$id = `urn:spatial-canvas:${name}:v1`;
  await writeFile(`schemas/${name}.schema.json`, JSON.stringify(json, null, 2) + '\n');
}
console.log('Generated 11 protocol JSON schemas; identity/provenance relations are additionally checked at runtime.');
