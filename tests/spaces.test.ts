import {expect,it} from 'vitest';
import {spaceRegistrySchema,projectSchema} from '../packages/protocol/spaces';
import {spaces,project} from './space-data';

it('validates general source-linked regions and rejects duplicate IDs',()=>{
  const value=spaces();expect(spaceRegistrySchema.safeParse(value).success).toBe(true);
  value.spaces[1]!.space_id='lounge';expect(spaceRegistrySchema.safeParse(value).success).toBe(false);
  expect(projectSchema.safeParse(project()).success).toBe(true);
});
it('rejects zero area, self crossings, repeated vertices and invalid height',()=>{
  for(const polygon of [[[0,0],[1,0],[2,0]],[[0,0],[2,2],[0,2],[2,0]],[[0,0],[2,0],[2,0],[0,2]]]){
    const value=spaces();value.spaces[0]!.region.polygon=polygon;
    expect(spaceRegistrySchema.safeParse(value).success).toBe(false);
  }
  const value=spaces();value.spaces[0]!.region.z_max=.45;expect(spaceRegistrySchema.safeParse(value).success).toBe(false);
});
it('requires actual verification records and matching evidence revision/hash',()=>{
  const value=spaces();value.spaces[0]!.verification.reviewer='';expect(spaceRegistrySchema.safeParse(value).success).toBe(false);
  value.spaces[0]!.verification.reviewer='owner';value.spaces[0]!.provenance.source_revision='stale';
  expect(spaceRegistrySchema.safeParse(value).success).toBe(false);
  value.spaces[0]!.provenance.source_revision='p1';value.spaces[0]!.confidence=1.1;
  expect(spaceRegistrySchema.safeParse(value).success).toBe(false);
});
