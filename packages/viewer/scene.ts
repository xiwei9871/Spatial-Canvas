import { Box3, Mesh, Object3D } from 'three';
import { entitySchema, type Entity, type Manifest } from '../protocol/index';

export function indexScene(root: Object3D, manifest: Manifest) {
  const entities = new Map<string, Entity>();
  const objects = new Map<string, Object3D>();
  const meshEntities = new Map<Mesh, Entity>();
  root.traverse((object) => {
    if (Object.hasOwn(object.userData, 'global_id')) {
      const entity = entitySchema.parse(object.userData);
      if (entities.has(entity.global_id)) throw new Error('Duplicate rendered global_id');
      if (entity.design_id !== manifest.design_id || entity.source_revision !== manifest.source_revision || entity.source_resource_id !== manifest.source_resource_id) throw new Error('Rendered identity provenance mismatch');
      entities.set(entity.global_id, entity);
      objects.set(entity.global_id, object);
    }
  });
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    let cursor: Object3D | null = object;
    while (cursor && !Object.hasOwn(cursor.userData, 'global_id')) cursor = cursor.parent;
    const entity = cursor ? entities.get(cursor.userData.global_id) : undefined;
    if (!entity) throw new Error('Rendered mesh has no stable identity');
    meshEntities.set(object, entity);
  });
  if (entities.size !== manifest.entity_count) throw new Error('Rendered entity count mismatch');
  return { entities, objects, meshEntities };
}

export function spatialMetadata(object: Object3D, manifest: Manifest) {
  object.updateWorldMatrix(true, true);
  const bounds = new Box3().setFromObject(object);
  return {
    world_transform: object.matrixWorld.toArray(),
    bounding_box: { min: bounds.min.toArray(), max: bounds.max.toArray() },
    coordinate_frame: manifest.coordinate_frame, unit: manifest.unit, up_axis: manifest.up_axis,
  };
}

export function disposeScene(root: Object3D) {
  root.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
    }
  });
}
