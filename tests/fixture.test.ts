import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { preflightGlb } from '../packages/protocol/glb';
import { manifestSchema } from '../packages/protocol/index';
import { loadProxy } from '../packages/viewer/index';
import { disposeScene } from '../packages/viewer/scene';

describe('committed export fixture', () => {
  it.each(['interaction_proxy', 'task_proxy'])('validates %s with source provenance and stable identities', async (name) => {
    const path = 'examples/living/task-output/artifacts/';
    const manifest = manifestSchema.parse(JSON.parse(await readFile(path + name + '.manifest.json', 'utf8')));
    const file = await readFile(path + manifest.proxy_uri);
    const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
    const checked = preflightGlb(buffer, manifest);
    expect(checked.entities.size).toBe(manifest.entity_count);
    expect(checked.entities.has('ent_sofa_001')).toBe(true);
    const loaded = await loadProxy(buffer, manifest);
    expect(loaded.entities.size).toBe(manifest.entity_count);
    expect([...loaded.meshEntities.values()].map((entity) => entity.global_id)).toContain('ent_sofa_001');
    disposeScene(loaded.root);
    const source = await readFile('examples/living/living.source.json');
    expect(createHash('sha256').update(source).digest('hex')).toBe(manifest.source_sha256);
  });
});
