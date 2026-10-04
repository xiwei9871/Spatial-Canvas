import { describe, expect, it } from 'vitest';
import { createIntent, reconcileSelection, select } from '../packages/core/index';
import { entity, manifest } from './data';

const entities = new Map([['ent_sofa', entity], ['ent_table', { ...entity, global_id: 'ent_table', native_object_id: 'TABLE' }]]);
describe('selection state', () => {
  it('replaces, adds, toggles, and clears IDs with an exact resulting-state event', () => {
    const first = select([], 'ent_sofa', false, 'pointer', manifest, entities);
    expect(first.entity_ids).toEqual(['ent_sofa']);
    const added = select(first.entity_ids, 'ent_table', true, 'pointer', manifest, entities);
    expect(added.mode).toBe('add');
    expect(added.entity_ids).toEqual(['ent_sofa', 'ent_table']);
    expect(select(added.entity_ids, 'ent_sofa', true, 'pointer', manifest, entities).entity_ids).toEqual(['ent_table']);
    expect(select(added.entity_ids, null, false, 'keyboard', manifest, entities).entity_ids).toEqual([]);
  });
  it('rejects unknown entity IDs', () => {
    expect(() => select([], 'missing', false, 'pointer', manifest, entities)).toThrow(/Unknown/);
  });
  it('retains only stable IDs within the same design on reload', () => {
    expect(reconcileSelection(['ent_sofa', 'deleted'], manifest.design_id, manifest, entities).entity_ids).toEqual(['ent_sofa']);
    expect(reconcileSelection(['ent_sofa'], 'different_design', manifest, entities).entity_ids).toEqual([]);
  });
});
describe('request-only intents', () => {
  it('captures source provenance and targets without modifying entity metadata', () => {
    const before = JSON.stringify([...entities.values()]);
    const request = createIntent(manifest, ['ent_sofa', 'ent_table'], entities, [0.2, 0, 0]);
    expect(request.authority).toBe('request_only');
    expect(request.source_revision).toBe('r1');
    expect(request.targets[0]?.native_object_id).toBe('SOFA');
    expect(request.payload.coordinate_frame).toBe('demo_world');
    expect(JSON.stringify([...entities.values()])).toBe(before);
  });
  it('rejects unknown, immutable, stale, empty, and non-finite targets or payloads', () => {
    expect(() => createIntent(manifest, [], entities, [0, 0, 0])).toThrow();
    expect(() => createIntent(manifest, ['missing'], entities, [0, 0, 0])).toThrow(/Unknown/);
    expect(() => createIntent(manifest, ['ent_sofa'], new Map([['ent_sofa', { ...entity, mutable: false }]]), [0, 0, 0])).toThrow(/immutable/);
    expect(() => createIntent(manifest, ['ent_sofa'], new Map([['ent_sofa', { ...entity, source_revision: 'r0' }]]), [0, 0, 0])).toThrow(/revision/);
    expect(() => createIntent(manifest, ['ent_sofa'], entities, [Infinity, 0, 0])).toThrow();
  });
});
