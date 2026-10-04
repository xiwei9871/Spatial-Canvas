import { describe, expect, it } from 'vitest';
import { entitySchema, intentSchema, manifestSchema, resourceSchema, selectionSchema } from '../packages/protocol/index';

import { entity, intent, manifest, selection } from './data';

describe('protocol contracts', () => {
  it('accepts one contract for full and task proxies', () => {
    expect(manifestSchema.safeParse(manifest).success).toBe(true);
    expect(manifestSchema.safeParse({ ...manifest, scope: 'task' }).success).toBe(true);
  });
  it('allows future resources without declaring them to be GLB proxies', () => {
    expect(resourceSchema.safeParse({ resource_id: 'image_1', design_id: 'design_demo', type: 'image', format: 'png', authority: 'authoritative' }).success).toBe(true);
  });
  it.each([
    { schema: 'interaction-proxy-v2' }, { source_revision: undefined }, { authority: 'authoritative' },
    { source_sha256: 'missing' }, { design_id: '' }, { entity_count: -1 },
    { proxy_uri: 'https://example.com/model.glb' }, { proxy_uri: '../secret.glb' },
    { proxy_uri: '/model.glb' }, { proxy_uri: 'other\\model.glb' }, { up_axis: 'Z' },
  ])('rejects an invalid manifest %j', (patch) => {
    expect(manifestSchema.safeParse({ ...manifest, ...patch }).success).toBe(false);
  });
  it('requires stable node identity and source revision', () => {
    expect(entitySchema.safeParse(entity).success).toBe(true);
    expect(entitySchema.safeParse({ ...entity, global_id: undefined }).success).toBe(false);
    expect(entitySchema.safeParse({ ...entity, source_revision: undefined }).success).toBe(false);
  });
  it('validates selection and clear events', () => {
    expect(selectionSchema.safeParse(selection).success).toBe(true);
    expect(selectionSchema.safeParse({ ...selection, mode: 'clear', entity_ids: [] }).success).toBe(true);
    expect(selectionSchema.safeParse({ ...selection, mode: 'clear' }).success).toBe(false);
    expect(selectionSchema.safeParse({ ...selection, entity_ids: ['ent_sofa', 'ent_sofa'] }).success).toBe(false);
    expect(selectionSchema.safeParse({ ...selection, timestamp: 'today' }).success).toBe(false);
  });
  it('validates revision-bound request-only translation intents', () => {
    expect(intentSchema.safeParse(intent).success).toBe(true);
    expect(intentSchema.safeParse({ ...intent, source_revision: undefined }).success).toBe(false);
    expect(intentSchema.safeParse({ ...intent, authority: 'authoritative' }).success).toBe(false);
    expect(intentSchema.safeParse({ ...intent, targets: [] }).success).toBe(false);
    expect(intentSchema.safeParse({ ...intent, targets: [intent.targets[0], intent.targets[0]] }).success).toBe(false);
    expect(intentSchema.safeParse({ ...intent, payload: { ...intent.payload, translation: [NaN, 0, 0] } }).success).toBe(false);
  });
});
