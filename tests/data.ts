export const manifest = {
  schema: 'interaction-proxy-v1', design_id: 'design_demo', resource_id: 'res_demo',
  type: 'interaction_proxy', format: 'glb', authority: 'derived', proxy_uri: 'interaction_proxy.glb',
  source_resource_id: 'src_demo', source_resource: 'living.source.json',
  source_sha256: 'a'.repeat(64), source_revision: 'r1',
  coordinate_frame: 'demo_world', unit: 'meter', up_axis: 'Y', entity_count: 2, scope: 'full',
} as const;
export const entity = {
  design_id: 'design_demo', global_id: 'ent_sofa', native_object_id: 'SOFA',
  semantic_type: 'sofa', room_id: 'living', source_resource_id: 'src_demo', source_revision: 'r1',
};
export const selection = {
  schema: 'spatial-canvas.selection.v1', design_id: 'design_demo', resource_id: 'res_demo',
  source_revision: 'r1', entity_ids: ['ent_sofa'], mode: 'replace', source: 'pointer',
  timestamp: '2026-10-04T04:00:00.000Z',
};
export const intent = {
  schema: 'spatial-canvas.intent.v1', request_id: 'req_demo', design_id: 'design_demo',
  resource_id: 'res_demo', source_resource_id: 'src_demo', source_revision: 'r1',
  source_sha256: 'a'.repeat(64), targets: [{ global_id: 'ent_sofa', native_object_id: 'SOFA' }],
  intent: 'request_transform', authority: 'request_only',
  payload: { translation: [0.2, 0, 0], space: 'world', coordinate_frame: 'demo_world', unit: 'meter' },
  timestamp: '2026-10-04T04:00:00.000Z',
};
export const executionResult = {
  schema: 'spatial-canvas.execution-result.v1', request_id: 'req_demo',
  design_id: 'design_demo', source_resource_id: 'src_demo',
  previous_source_revision: 'r1', source_revision: 'r2', status: 'applied',
  targets: ['ent_sofa'], timestamp: '2026-10-04T04:00:00.000Z',
};
