import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { indexScene, spatialMetadata } from '../packages/viewer/scene';
import { entity, manifest } from './data';

describe('rendered scene identity and world coordinates', () => {
  it('indexes through semantic ancestors and exposes evaluated world bounds', () => {
    const root = new Group();
    const semantic = new Group();
    semantic.userData = { ...entity };
    semantic.position.set(2, 0, 0);
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial());
    mesh.name = 'a deliberately unrelated renderer name';
    mesh.position.set(0, 1, 0);
    semantic.add(mesh);
    root.add(semantic);
    const indexed = indexScene(root, { ...manifest, entity_count: 1 });
    expect(indexed.meshEntities.get(mesh)?.global_id).toBe('ent_sofa');
    const spatial = spatialMetadata(semantic, manifest);
    expect(spatial.world_transform[12]).toBe(2);
    expect(spatial.bounding_box.min).toEqual([1.5, 0.5, -0.5]);
    expect(spatial.bounding_box.max).toEqual([2.5, 1.5, 0.5]);
    mesh.geometry.dispose();
    (mesh.material as MeshStandardMaterial).dispose();
  });
});
