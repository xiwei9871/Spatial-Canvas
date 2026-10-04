import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createIntent, reconcileSelection, select } from '../packages/core/index';
import { executionResultSchema, manifestSchema, type Intent } from '../packages/protocol/index';
import { loadProxy } from '../packages/viewer/index';
import { disposeScene, spatialMetadata } from '../packages/viewer/scene';

const blender = process.env.BLENDER_BIN ?? 'blender';
const keep = process.argv[2];
const work = keep ? path.resolve(keep) : mkdtempSync(path.join(tmpdir(), 'spatial-canvas-e2e-'));
mkdirSync(work, { recursive: true });
const source = path.join(work, 'authoritative.blend');
const hash = () => createHash('sha256').update(readFileSync(source)).digest('hex');
function run(script: string, args: string[], sourceFile?: string, status = 0) {
  const result = spawnSync(blender, ['--background', '--factory-startup', ...(sourceFile ? [sourceFile] : []),
    '--python-exit-code', '1', '--python', script, '--', ...args],
  { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, status, result.error?.message ?? result.stderr + result.stdout);
}
async function load(folder: string, name = 'interaction_proxy') {
  const manifest = manifestSchema.parse(JSON.parse(readFileSync(path.join(folder, name + '.manifest.json'), 'utf8')));
  const bytes = readFileSync(path.join(folder, manifest.proxy_uri));
  const proxy = await loadProxy(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, manifest);
  assert.equal(manifest.source_sha256, hash());
  return { manifest, proxy };
}
function execute(intent: Intent | unknown, name: string, status = 0) {
  const intentPath = path.join(work, name + '.intent.json');
  const resultPath = path.join(work, name + '.result.json');
  writeFileSync(intentPath, JSON.stringify(intent, null, 2));
  run('adapters/blender/apply_intent.py', ['--intent', intentPath, '--result', resultPath], source, status);
  return executionResultSchema.parse(JSON.parse(readFileSync(resultPath, 'utf8')));
}
try {
  run('adapters/blender/create_fixture.py', ['--output', source]);
  const firstPath = path.join(work, 'before');
  const taskPath = path.join(work, 'task');
  const afterPath = path.join(work, 'after');
  const originalSha = hash();
  run('adapters/blender/export_proxy.py', ['--output', firstPath, '--scope', 'full'], source);
  assert.equal(hash(), originalSha, 'Producer mutated the source');
  const first = await load(firstPath);
  assert.equal(first.proxy.entities.size, 5);
  const before = spatialMetadata(first.proxy.objects.get('ent_sofa_001')!, first.manifest);
  run('adapters/blender/export_proxy.py', ['--output', taskPath, '--scope', 'task', '--global-id', 'ent_sofa_001'], source);
  const task = await load(taskPath, 'task_proxy');
  assert.deepEqual([...task.proxy.entities.keys()], ['ent_sofa_001']);
  assert.deepEqual(task.proxy.entities.get('ent_sofa_001'), first.proxy.entities.get('ent_sofa_001'));
  const selection = select([], 'ent_sofa_001', false, 'pointer', first.manifest, first.proxy.entities);
  const request = createIntent(first.manifest, selection.entity_ids, first.proxy.entities, [.5, 0, 0]);
  const applied = execute(request, 'applied');
  assert.equal(applied.status, 'applied');
  assert.equal(applied.source_revision, 'rev-00002');
  const changedSha = hash();
  assert.notEqual(changedSha, originalSha);
  const stale = execute(request, 'stale', 2);
  assert.equal(stale.status, 'rejected');
  assert.equal(stale.status === 'rejected' && stale.error.code, 'stale_revision');
  assert.equal(hash(), changedSha, 'Stale replay changed source bytes');
  const wall = execute({ ...request, request_id: 'req_wall', source_revision: 'rev-00002', source_sha256: changedSha,
    targets: [{ global_id: 'ent_wall_001', native_object_id: 'Wall_Back' }] }, 'immutable', 2);
  assert.equal(wall.status === 'rejected' && wall.error.code, 'immutable_target');
  assert.equal(hash(), changedSha, 'Immutable request changed source bytes');
  const malformed = execute({ schema: 'unsupported' }, 'malformed', 2);
  assert.equal(malformed.status, 'rejected');
  const wrongFrame = execute({ ...request, source_revision: 'rev-00002', source_sha256: changedSha,
    payload: { ...request.payload, coordinate_frame: 'wrong_frame' } }, 'wrong-frame', 2);
  assert.equal(wrongFrame.status === 'rejected' && wrongFrame.error.code, 'coordinate_error');
  assert.equal(hash(), changedSha, 'Invalid frame changed source bytes');
  run('adapters/blender/export_proxy.py', ['--output', afterPath, '--scope', 'full'], source);
  const after = await load(afterPath);
  const newSelection = reconcileSelection(selection.entity_ids, first.manifest.design_id, after.manifest, after.proxy.entities);
  assert.deepEqual(newSelection.entity_ids, ['ent_sofa_001']);
  assert.equal(after.manifest.source_revision, 'rev-00002');
  assert.deepEqual([...after.proxy.entities.keys()], [...first.proxy.entities.keys()]);
  const moved = spatialMetadata(after.proxy.objects.get('ent_sofa_001')!, after.manifest);
  assert.ok(Math.abs(moved.world_transform[12]! - before.world_transform[12]! - .5) < 1e-5);
  assert.equal(moved.world_transform[13], before.world_transform[13]);
  assert.equal(moved.world_transform[14], before.world_transform[14]);
  assert.ok(Math.abs(moved.bounding_box.min[0]! - before.bounding_box.min[0]! - .5) < 1e-5);
  const report = { status: 'passed', previous_revision: first.manifest.source_revision, source_revision: after.manifest.source_revision,
    global_id: 'ent_sofa_001', before_world_translation: before.world_transform.slice(12, 15),
    after_world_translation: moved.world_transform.slice(12, 15), full_entities: 5, task_entities: 1,
    source_hash_changed: true, stale: stale.status, immutable: wall.status, malformed: malformed.status,
    source_path: keep ? source : 'temporary fixture removed' };
  writeFileSync(path.join(work, 'e2e-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  for (const item of [first, task, after]) disposeScene(item.proxy.root);
} finally {
  if (!keep) rmSync(work, { recursive: true, force: true });
}
