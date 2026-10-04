export const registry = {
  schema: 'spatial-canvas.bindings.v1', registry_id: 'bindings_test', registry_revision: '1',
  design_id: 'design_test', source_resource_id: 'source_test', source_revision: 'r4',
  source_sha256: 'a'.repeat(64), source_locator: '/local/frozen.blend', source_authority: 'frozen',
  source_frame: { frame_id: 'c_type_world', unit: 'meter', up_axis: 'Z', meters_per_unit: 1 },
  bindings: [{ entity_id: 'ent_sofa', adapter: 'blender', native_id: 'Sofa', semantic_type: 'sofa', room_id: 'living',
    authority_level: 'HUMAN_DESIGN_GUIDE' }],
};
export const packet = {
  schema: 'spatial-canvas.context.v1', packet_id: 'ctx_test', timestamp: '2026-10-04T08:00:00.000Z',
  selection: { schema: 'spatial-canvas.selection.v1', design_id: 'design_test', resource_id: 'proxy',
    source_revision: 'r4', entity_ids: ['ent_sofa'],primary_entity_id:'ent_sofa', mode: 'replace', source: 'pointer', timestamp: '2026-10-04T08:00:00.000Z' },
  resource: { design_id: 'design_test', resource_id: 'proxy', type: 'interaction_proxy', format: 'glb', authority: 'derived' },
  source: { resource_id: 'source_test', revision: 'r4', sha256: 'a'.repeat(64), locator: '/local/frozen.blend', authority: 'frozen' },
  entities: [{ design_id: 'design_test', global_id: 'ent_sofa', native_object_id: 'Sofa', semantic_type: 'sofa',
    room_id: 'living', source_resource_id: 'source_test', source_revision: 'r4', mutable: false }],
  view: { kind: 'camera3d', data: {projection:'perspective',fov_degrees:45,near:.01,far:1000, position: [5,4,6], quaternion: [0,0,0,1],
    projection_matrix: Array.from({length:16}, (_,i)=>i%5===0?1:0), orbit_target: [0,0,0],
    viewport: { width: 800, height: 600, pixel_ratio: 1 }, frame_id: 'proxy_world', unit: 'meter', up_axis: 'Y' } },
  hit: { entity_id: 'ent_sofa', xyz: [-1, .5, 0], frame_id: 'proxy_world', unit: 'meter',
    source: { xyz: [-1, 0, .5], frame_id: 'c_type_world', unit: 'meter' } },
};
