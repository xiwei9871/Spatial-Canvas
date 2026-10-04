import { intentSchema, selectionSchema, type Entity, type Manifest, type SelectionEvent } from '../protocol/index';

export function select(
  current: readonly string[], target: string | null, additive: boolean,
  source: SelectionEvent['source'], manifest: Manifest, entities: ReadonlyMap<string, Entity>,
): SelectionEvent {
  if (target !== null && !entities.has(target)) throw new Error('Unknown entity: ' + target);
  let ids: string[];
  let mode: SelectionEvent['mode'];
  if (target === null) { ids = []; mode = 'clear'; }
  else if (!additive) { ids = [target]; mode = 'replace'; }
  else if (current.includes(target)) { ids = current.filter((id) => id !== target); mode = 'remove'; }
  else { ids = [...current, target]; mode = 'add'; }
  return selectionSchema.parse({
    schema: 'spatial-canvas.selection.v1', design_id: manifest.design_id,
    resource_id: manifest.resource_id, source_revision: manifest.source_revision,
    entity_ids: ids, mode, source, timestamp: new Date().toISOString(),
  });
}

export function reconcileSelection(current: readonly string[], previousDesignId: string | undefined, manifest: Manifest, entities: ReadonlyMap<string, Entity>): SelectionEvent {
  const ids = previousDesignId === manifest.design_id ? current.filter((id) => entities.has(id)) : [];
  return selectionSchema.parse({
    schema: 'spatial-canvas.selection.v1', design_id: manifest.design_id, resource_id: manifest.resource_id,
    source_revision: manifest.source_revision, entity_ids: ids, mode: ids.length ? 'replace' : 'clear',
    source: 'reload', timestamp: new Date().toISOString(),
  });
}

export function createIntent(manifest: Manifest, ids: readonly string[], entities: ReadonlyMap<string, Entity>, translation: [number, number, number]) {
  const adapter=manifest.extensions?.['spatial_canvas.blender'] as {source_authority?:string}|undefined;
  if(adapter?.source_authority==='frozen')throw new Error('Frozen sources only permit context packets');
  const targets = ids.map((id) => {
    const entity = entities.get(id);
    if (!entity) throw new Error('Unknown entity: ' + id);
    if (entity.mutable === false) throw new Error('Entity is immutable: ' + id);
    if (entity.source_revision !== manifest.source_revision || entity.source_resource_id !== manifest.source_resource_id || entity.design_id !== manifest.design_id) {
      throw new Error('Entity source revision or design mismatch: ' + id);
    }
    return { global_id: entity.global_id, native_object_id: entity.native_object_id };
  });
  return intentSchema.parse({
    schema: 'spatial-canvas.intent.v1', request_id: 'req_' + crypto.randomUUID(),
    design_id: manifest.design_id, resource_id: manifest.resource_id,
    source_resource_id: manifest.source_resource_id, source_revision: manifest.source_revision,
    source_sha256: manifest.source_sha256, targets, intent: 'request_transform', authority: 'request_only',
    payload: { translation, space: 'world', coordinate_frame: manifest.coordinate_frame, unit: manifest.unit },
    timestamp: new Date().toISOString(),
  });
}
