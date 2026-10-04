import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { entitySchema, frameSchema, intentSchema, manifestSchema, resourceSchema, selectionSchema } from '../packages/protocol/index';

await mkdir('schemas', { recursive: true });
for (const [name, schema] of Object.entries({ resource: resourceSchema, entity: entitySchema, frame: frameSchema, manifest: manifestSchema, selection: selectionSchema, intent: intentSchema })) {
  const json = z.toJSONSchema(schema, { target: 'draft-7', io: 'input' });
  // JSON Schema cannot infer Zod refinements. Encode the same portable constraints explicitly.
  if (name === 'selection') {
    json.properties!.entity_ids = { ...(json.properties!.entity_ids as object), uniqueItems: true };
    json.allOf = [{ if: { properties: { mode: { const: 'clear' } } }, then: { properties: { entity_ids: { maxItems: 0 } } } }];
  }
  json.$id = `urn:spatial-canvas:${name}:v1`;
  await writeFile(`schemas/${name}.schema.json`, JSON.stringify(json, null, 2) + '\n');
}
console.log('Generated 6 V0.1 JSON schemas; target global_id uniqueness is additionally checked by runtime validation.');
