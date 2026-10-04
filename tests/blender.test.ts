import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const blender = process.env.BLENDER_BIN ?? 'blender';
const available = spawnSync(blender, ['--version'], { stdio: 'ignore', timeout: 10000 }).status === 0;
describe('Blender integration gates', () => {
  it.skipIf(!available)('passes real bpy metadata, world-transform, producer and file safety checks', () => {
    const run = spawnSync(blender, ['--background', '--factory-startup', '--python-exit-code', '1',
      '--python', 'adapters/blender/tests/test_blender.py'], { encoding: 'utf8', timeout: 30000 });
    expect(run.status, run.stderr + run.stdout).toBe(0);
    expect(run.stderr).toContain('OK');
  }, 40000);
  it.skipIf(!available)('runs real saved source → GLTFLoader → intent → adapter → GLTFLoader', () => {
    const run = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/blender-e2e.ts'], { encoding: 'utf8', timeout: 60000 });
    expect(run.status, run.stderr + run.stdout).toBe(0);
    const report = JSON.parse(run.stdout.split('\n').find((line) => line.startsWith('{"status"'))!);
    expect(report).toMatchObject({ status: 'passed', previous_revision: 'rev-00001', source_revision: 'rev-00002',
      before_world_translation: [-1.5, expect.any(Number), 0], after_world_translation: [-1, expect.any(Number), 0],
      full_entities: 5, task_entities: 1, stale: 'rejected', immutable: 'rejected' });
  }, 70000);
});
