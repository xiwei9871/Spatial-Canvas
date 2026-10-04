import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { BoxGeometry } from 'three';
import { entitySchema, manifestSchema } from '../packages/protocol/index';
import { preflightGlb } from '../packages/protocol/glb';
import { createPreview } from './fixture-preview';

const sourceBytes = await readFile('examples/living/living.source.json');
const source = JSON.parse(sourceBytes.toString()) as {
  design_id: string; source_resource_id: string; source_revision: string;
  objects: { global_id: string; native_object_id: string; semantic_type: string; position: number[]; size: number[]; color: number[]; mutable: boolean }[];
};
const geometry = new BoxGeometry(1, 1, 1);
const positions = new Float32Array(geometry.getAttribute('position').array);
const normals = new Float32Array(geometry.getAttribute('normal').array);
const indices = new Uint16Array(geometry.index!.array);
const binary = Buffer.concat([Buffer.from(positions.buffer), Buffer.from(normals.buffer), Buffer.from(indices.buffer)]);
const output = 'examples/living/task-output/artifacts';
await mkdir(output, { recursive: true });

for (const scope of ['full', 'task'] as const) {
  const objects = scope === 'full' ? source.objects : source.objects.slice(0, 2);
  const name = scope === 'full' ? 'interaction_proxy' : 'task_proxy';
  const nodes = objects.map((object, index) => ({
    name: object.native_object_id, mesh: index, translation: object.position, scale: object.size,
    extras: entitySchema.parse({
      design_id: source.design_id, global_id: object.global_id, native_object_id: object.native_object_id,
      semantic_type: object.semantic_type, room_id: 'living', source_resource_id: source.source_resource_id,
      source_revision: source.source_revision, authority_level: 'HUMAN_DESIGN_GUIDE', mutable: object.mutable,
    }),
  }));
  const gltf = {
    asset: { version: '2.0', generator: 'Spatial Canvas deterministic fixture generator' },
    scene: 0, scenes: [{ nodes: nodes.map((_, index) => index) }], nodes,
    meshes: objects.map((_, index) => ({ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: index }] })),
    materials: objects.map((object) => ({ pbrMetallicRoughness: { baseColorFactor: [...object.color, 1], metallicFactor: 0, roughnessFactor: 1 } })),
    buffers: [{ byteLength: binary.byteLength }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.byteLength, target: 34962 },
      { buffer: 0, byteOffset: positions.byteLength, byteLength: normals.byteLength, target: 34962 },
      { buffer: 0, byteOffset: positions.byteLength + normals.byteLength, byteLength: indices.byteLength, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
      { bufferView: 1, componentType: 5126, count: normals.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5123, count: indices.length, type: 'SCALAR' },
    ],
  };
  const text = JSON.stringify(gltf);
  const json = Buffer.from(text + ' '.repeat((4 - Buffer.byteLength(text) % 4) % 4));
  const glb = Buffer.alloc(12 + 8 + json.length + 8 + binary.length);
  glb.writeUInt32LE(0x46546c67, 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(json.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); json.copy(glb, 20);
  glb.writeUInt32LE(binary.length, 20 + json.length); glb.writeUInt32LE(0x004e4942, 24 + json.length); binary.copy(glb, 28 + json.length);
  const manifest = manifestSchema.parse({
    schema: 'interaction-proxy-v1', design_id: source.design_id, resource_id: 'res_living_' + scope,
    type: 'interaction_proxy', format: 'glb', authority: 'derived', proxy_uri: name + '.glb',
    source_resource_id: source.source_resource_id, source_resource: 'living.source.json',
    source_sha256: createHash('sha256').update(sourceBytes).digest('hex'), source_revision: source.source_revision,
    coordinate_frame: 'living_proxy_world', unit: 'meter', up_axis: 'Y', entity_count: objects.length, scope,
  });
  preflightGlb(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength) as ArrayBuffer, manifest);
  await writeFile(output + '/' + name + '.glb', glb);
  await writeFile(output + '/' + name + '.manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  console.log(name + ': ' + glb.length + ' bytes, ' + objects.length + ' entities');
}
await writeFile(output + '/preview.png', createPreview(source.objects));
await writeFile('examples/living/task-output/task_report.json', JSON.stringify({
  schema: 'spatial-canvas.task-report.v1', status: 'exported', source_resource_id: source.source_resource_id,
  source_revision: source.source_revision, artifacts: ['artifacts/interaction_proxy.glb', 'artifacts/interaction_proxy.manifest.json', 'artifacts/task_proxy.glb', 'artifacts/task_proxy.manifest.json', 'artifacts/preview.png'],
}, null, 2) + '\n');
geometry.dispose();
