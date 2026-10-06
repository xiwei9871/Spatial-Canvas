import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { indexScene, spatialMetadata } from '../packages/viewer/scene';
import { entity, manifest } from './data';

describe('rendered scene identity and world coordinates', () => {
  it('retains independent wall identities under a shared renderer group and material', () => {
    const root=new Group(),walls=new Group(),geometry=new BoxGeometry(2,2,.2),material=new MeshStandardMaterial();
    const left=new Mesh(geometry,material),right=new Mesh(geometry,material);
    left.userData={...entity,global_id:'ent_wall_left',native_object_id:'WallLeft',semantic_type:'wall'};
    right.userData={...entity,global_id:'ent_wall_right',native_object_id:'WallRight',semantic_type:'wall'};
    walls.add(left,right);root.add(walls);
    const indexed=indexScene(root,{...manifest,entity_count:2});
    expect(indexed.meshEntities.get(left)?.global_id).toBe('ent_wall_left');
    expect(indexed.meshEntities.get(right)?.global_id).toBe('ent_wall_right');
    expect(indexed.objects.get('ent_wall_left')).toBe(left);
    expect(indexed.objects.get('ent_wall_right')).toBe(right);
    expect(indexed.entities.size).toBe(2);
    geometry.dispose();material.dispose();
  });
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
