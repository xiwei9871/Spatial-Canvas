import { describe, expect, it } from 'vitest';
import { viewPresetSchema } from '../packages/protocol/view-preset';
import { buildViewHandoff } from '../packages/core/view-handoff';

const preset = {
  schema: 'spatial-canvas.view-preset.v1',
  preset_id: 'entrance_compare_01',
  design_id: 'c_type_home',
  source_resource_id: 'c_type_r4',
  source_revision: 'r4',
  source_sha256: 'a'.repeat(64),
  projection: 'perspective', fov_degrees: 45,
  position: [1, 2, 3], quaternion: [0, 0, 0, 1], orbit_target: [4, 5, 6],
  viewport: { width: 873, height: 664, pixel_ratio: 1 },
  frame_id: 'blender_proxy_world', unit: 'meter', up_axis: 'Y',
  source_camera: { position: [1, -3, 2], quaternion: [Math.SQRT1_2, 0, 0, Math.SQRT1_2], frame_id: 'c_type_world', unit: 'meter', up_axis: 'Z' },
  hidden_entity_ids: ['ent_wall'], ghost_entity_ids: ['ent_ceiling'],
};

describe('view preset protocol', () => {
  it('validates provenance, proxy/source camera and viewer overrides', () => {
    expect(viewPresetSchema.parse(preset)).toEqual(preset);
    expect(viewPresetSchema.safeParse({ ...preset, source_revision: '' }).success).toBe(false);
    expect(viewPresetSchema.safeParse({...preset,source_camera:{...preset.source_camera,position:[1,3,2]}}).success).toBe(false);
    expect(viewPresetSchema.safeParse({ ...preset, hidden_entity_ids: ['ent_wall', 'ent_wall'] }).success).toBe(false);
    expect(viewPresetSchema.safeParse({ ...preset, hidden_entity_ids: ['ent_wall'], ghost_entity_ids: ['ent_wall'] }).success).toBe(false);
  });

  it('builds an AI handoff without telling the receiver to rediscover the view', () => {
    const text = buildViewHandoff(viewPresetSchema.parse(preset));
    expect(text).toContain('Apply this exact camera preset');
    expect(text).toContain('entrance_compare_01');
    expect(text).toContain('ent_ceiling');
    expect(text).toContain('source_camera');
  });
});
