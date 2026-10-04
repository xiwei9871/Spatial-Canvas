import { entitySchema, type Entity, type Manifest } from './index';

export interface ProxyNode {
  name?: string;
  mesh?: number;
  children?: number[];
  extras?: Record<string, unknown>;
}

export function validateNodes(nodes: ProxyNode[], manifest: Manifest) {
  const parents = new Map<number, number>();
  const entities = new Map<string, Entity>();
  const explicit = new Map<number, Entity>();
  nodes.forEach((node, index) => {
    for (const child of node.children ?? []) {
      if (!Number.isInteger(child) || !nodes[child]) throw new Error('Invalid child index');
      if (parents.has(child)) throw new Error('A node cannot have multiple parents');
      parents.set(child, index);
    }
    if (node.extras && Object.keys(node.extras).some((key) => ['global_id', 'native_object_id', 'semantic_type', 'source_revision'].includes(key))) {
      const entity = entitySchema.parse(node.extras);
      if (entities.has(entity.global_id)) throw new Error('Duplicate global_id: ' + entity.global_id);
      for (const key of ['design_id', 'source_resource_id', 'source_revision'] as const) {
        if (entity[key] !== manifest[key]) throw new Error(key + ' mismatch: ' + entity.global_id);
      }
      entities.set(entity.global_id, entity);
      explicit.set(index, entity);
    }
  });
  const nodeEntities = new Map<number, Entity>();
  nodes.forEach((node, index) => {
    let cursor: number | undefined = index;
    const visited = new Set<number>();
    let identity: Entity | undefined;
    while (cursor !== undefined) {
      if (visited.has(cursor)) throw new Error('Node hierarchy cycle');
      visited.add(cursor);
      identity ??= explicit.get(cursor);
      cursor = parents.get(cursor);
    }
    if (identity) nodeEntities.set(index, identity);
    if (node.mesh !== undefined && !identity) throw new Error('Mesh node missing stable identity: ' + index);
  });
  if (entities.size !== manifest.entity_count) throw new Error('Manifest entity count mismatch');
  return { entities, nodeEntities };
}

/** Inspect the container before GLTFLoader can resolve any external dependencies. */
export function preflightGlb(buffer: ArrayBuffer, manifest: Manifest) {
  if (buffer.byteLength < 20) throw new Error('Invalid GLB header');
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength) {
    throw new Error('Invalid GLB magic, version, or length');
  }
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || jsonLength % 4 || 20 + jsonLength > buffer.byteLength) {
    throw new Error('Invalid GLB JSON chunk');
  }
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength))) as {
    asset?: { version?: string }; nodes?: ProxyNode[]; buffers?: { uri?: string }[];
    images?: unknown[]; extensionsUsed?: string[]; extensionsRequired?: string[]; scenes?: { nodes?: number[] }[]; scene?: number;
  };
  if (json.asset?.version !== '2.0' || !Array.isArray(json.nodes)) throw new Error('GLB requires glTF 2.0 nodes');
  if (json.buffers?.some((entry) => entry.uri !== undefined) || (json.images?.length ?? 0) > 0 || (json.extensionsUsed?.length ?? 0) > 0 || (json.extensionsRequired?.length ?? 0) > 0) {
    throw new Error('V0.1 proxies require embedded buffers, no textures, and no extensions');
  }
  let offset = 20 + jsonLength;
  if (offset < buffer.byteLength) {
    if (offset + 8 > buffer.byteLength || view.getUint32(offset + 4, true) !== 0x004e4942) throw new Error('Invalid GLB BIN chunk');
    const length = view.getUint32(offset, true);
    if (length % 4) throw new Error('Invalid GLB BIN alignment');
    offset += 8 + length;
  }
  if (offset !== buffer.byteLength) throw new Error('Invalid GLB chunk length');
  // One active scene avoids entity counts that include invisible alternate scenes.
  if (json.scenes?.length !== 1 || (json.scene ?? 0) !== 0) throw new Error('V0.1 proxy requires one active scene');
  const roots = json.scenes[0]?.nodes ?? [];
  const reachable = new Set<number>();
  const visiting = new Set<number>();
  const visit = (index: number) => {
    if (!Number.isInteger(index) || !json.nodes![index]) throw new Error('Invalid scene node index');
    if (visiting.has(index)) throw new Error('Node hierarchy cycle');
    if (reachable.has(index)) throw new Error('Repeated scene node');
    visiting.add(index);
    reachable.add(index);
    json.nodes![index]!.children?.forEach(visit);
    visiting.delete(index);
  };
  roots.forEach(visit);
  if (reachable.size !== json.nodes.length) throw new Error('Proxy nodes must belong to the active scene');
  return { json, ...validateNodes(json.nodes, manifest) };
}
