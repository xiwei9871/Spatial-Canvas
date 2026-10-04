import { readFile, writeFile } from 'node:fs/promises';
import { intentSchema, manifestSchema } from '../packages/protocol/index';

const manifestPath = process.argv[2];
const outputPath = process.argv[3] ?? 'examples/blender-v02/request.json';
if (!manifestPath) throw new Error('Usage: tsx scripts/create-intent.ts manifest.json [output.json]');
const manifest = manifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
const intent = intentSchema.parse({
  schema: 'spatial-canvas.intent.v1', request_id: 'req_blender_e2e_001', design_id: manifest.design_id,
  resource_id: manifest.resource_id, source_resource_id: manifest.source_resource_id,
  source_revision: manifest.source_revision, source_sha256: manifest.source_sha256,
  targets: [{ global_id: 'ent_sofa_001', native_object_id: 'Sofa_Main' }], intent: 'request_transform', authority: 'request_only',
  payload: { translation: [0.5, 0, 0], space: 'world', coordinate_frame: manifest.coordinate_frame, unit: 'meter' },
  timestamp: new Date().toISOString(),
});
await writeFile(outputPath, JSON.stringify(intent, null, 2) + '\n');
console.log(outputPath);
