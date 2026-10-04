import { describe, expect, it } from 'vitest';
import { preflightGlb, validateNodes } from '../packages/protocol/glb';
import { entity, manifest } from './data';

describe('proxy GLB validation', () => {
  it('binds child geometry through the closest semantic ancestor', () => {
    const nodes = [{ extras: entity, children: [1] }, { mesh: 0 }, { mesh: 0, extras: { ...entity, global_id: 'ent_table' } }];
    const result = validateNodes(nodes, { ...manifest, entity_count: 2 });
    expect(result.entities.size).toBe(2);
    expect(result.nodeEntities.get(1)?.global_id).toBe('ent_sofa');
  });
  it('rejects a duplicate explicit ID', () => {
    expect(() => validateNodes([{ mesh: 0, extras: entity }, { mesh: 0, extras: entity }], manifest)).toThrow(/Duplicate/);
  });
  it('rejects geometry with missing identity rather than guessing names', () => {
    expect(() => validateNodes([{ mesh: 0, name: 'ent_sofa' }], { ...manifest, entity_count: 1 })).toThrow(/identity/);
    expect(() => validateNodes([{ mesh: 0, extras: { ...entity, global_id: undefined } }], { ...manifest, entity_count: 1 })).toThrow();
  });
  it.each(['source_revision', 'source_resource_id', 'design_id'] as const)('rejects mismatched %s', (field) => {
    expect(() => validateNodes([{ mesh: 0, extras: { ...entity, [field]: 'different' } }], { ...manifest, entity_count: 1 })).toThrow(/mismatch/);
  });
  it('checks entity count and hierarchy cycles', () => {
    expect(() => validateNodes([{ mesh: 0, extras: entity }], manifest)).toThrow(/count/);
    expect(() => validateNodes([{ extras: entity, children: [1] }, { children: [0], mesh: 0 }], { ...manifest, entity_count: 1 })).toThrow(/cycle/);
    expect(() => validateNodes([{ extras: entity, children: [2] }], { ...manifest, entity_count: 1 })).toThrow(/child/);
  });
  it('rejects invalid GLB before handing it to a renderer', () => {
    expect(() => preflightGlb(new ArrayBuffer(12), manifest)).toThrow(/GLB/);
  });
  it('rejects hidden dependencies, orphan nodes, cycles and truncated chunks', () => {
    const document = { asset: { version: '2.0' }, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, extras: entity }] };
    const encode = (data: unknown) => {
      const bytes = new TextEncoder().encode(JSON.stringify(data));
      const buffer = new ArrayBuffer(20 + Math.ceil(bytes.length / 4) * 4);
      const view = new DataView(buffer);
      view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, buffer.byteLength, true);
      view.setUint32(12, buffer.byteLength - 20, true); view.setUint32(16, 0x4e4f534a, true);
      new Uint8Array(buffer, 20).fill(32); new Uint8Array(buffer, 20, bytes.length).set(bytes);
      return buffer;
    };
    const one = { ...manifest, entity_count: 1 };
    expect(preflightGlb(encode(document), one).entities.size).toBe(1);
    expect(() => preflightGlb(encode({ ...document, buffers: [{ uri: 'https://example.com/data.bin' }] }), one)).toThrow(/embedded/);
    expect(() => preflightGlb(encode({ ...document, images: [{}] }), one)).toThrow(/textures/);
    expect(() => preflightGlb(encode({ ...document, extensionsRequired: ['UNKNOWN'] }), one)).toThrow(/extensions/);
    expect(() => preflightGlb(encode({ ...document, nodes: [...document.nodes, {}] }), one)).toThrow(/active scene/);
    expect(() => preflightGlb(encode({ ...document, nodes: [{ ...document.nodes[0], children: [0] }] }), one)).toThrow(/cycle/);
    const malformed = encode(document);
    new DataView(malformed).setUint32(12, malformed.byteLength + 4, true);
    expect(() => preflightGlb(malformed, one)).toThrow(/JSON chunk/);
  });
});
