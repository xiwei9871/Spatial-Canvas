import {expect,it} from 'vitest';
import {spaceRegistrySchema,projectSchema} from '../packages/protocol/spaces';
import {locatePoint,regionOverlap,uncoveredVolume} from '../packages/core/regions';
import {spaces,project} from './space-data';

const point=(xyz:[number,number,number])=>({xyz,frame_id:'world',unit:'meter' as const,up_axis:'Z' as const});
it('resolves interior, exterior and shared boundaries independent of objects',()=>{
  const r=spaceRegistrySchema.parse(spaces());
  expect(locatePoint(r,point([1,1,.45])).primary_space_id).toBe('lounge');
  expect(locatePoint(r,point([1,1,.449999988079071])).primary_space_id).toBe('lounge');
  expect(locatePoint(r,point([3,1,1])).primary_space_id).toBe('corridor');
  expect(locatePoint(r,point([5,1,1])).resolution).toBe('unresolved');
  expect(locatePoint(r,point([1,1,4])).resolution).toBe('unresolved');
  expect(locatePoint(r,point([2,1,1])).resolution).toBe('ambiguous');
});
it('preserves candidate uncertainty, overlapping regions and frame mismatch',()=>{
  const r=spaceRegistrySchema.parse(spaces());r.spaces[0]!.verification={state:'candidate'};
  expect(locatePoint(r,point([1,1,1])).resolution).toBe('unresolved');
  r.spaces[1]!.region.polygon=[[1,0],[3,0],[3,2],[1,2]];
  expect(locatePoint(r,point([1.5,1,1])).resolution).toBe('ambiguous');
  r.spaces[0]!.verification={state:'verified',reviewer:'owner',timestamp:'2026-10-04T14:00:00.000Z',note:'Approved model-context region'};
  r.spaces[1]!.region.polygon=[[1,0],[3,0],[3,2],[1,2]];
  expect(locatePoint(r,point([1.5,1,1])).resolution).toBe('ambiguous');
  expect(locatePoint(r,{...point([1,1,1]),frame_id:'other'}).resolution).toBe('unavailable');
});
it('normalizes units and handles explicit non-Z up axes',()=>{
  const r=spaceRegistrySchema.parse(spaces());
  expect(locatePoint(r,{...point([1000,1000,450]),unit:'millimeter'}).primary_space_id).toBe('lounge');
  r.frame.up_axis='Y';
  expect(locatePoint(r,{xyz:[1,.45,1],frame_id:'world',unit:'meter',up_axis:'Y'}).primary_space_id).toBe('lounge');
});
it('measures coverage gaps and positive-volume overlap, ignoring shared boundaries',()=>{
  const r=spaceRegistrySchema.parse(spaces());const domain=projectSchema.parse(project()).levels[0]!.coverage;
  expect(uncoveredVolume(domain,r.spaces.map(s=>s.region))).toBeCloseTo(0);
  expect(uncoveredVolume(domain,[r.spaces[0]!.region])).toBeCloseTo(11);
  expect(regionOverlap(r.spaces[0]!.region,r.spaces[1]!.region)).toBeCloseTo(0);
  r.spaces[1]!.region.polygon=[[1,0],[3,0],[3,2],[1,2]];
  expect(regionOverlap(r.spaces[0]!.region,r.spaces[1]!.region)).toBeCloseTo(5.5);
  r.spaces[1]!.region.z_min=3.2;r.spaces[1]!.region.z_max=4;
  expect(regionOverlap(r.spaces[0]!.region,r.spaces[1]!.region)).toBe(0);
});
it('handles concave polygons and union coverage without counting duplicates twice',()=>{
  const r=spaceRegistrySchema.parse(spaces()),domain=projectSchema.parse(project()).levels[0]!.coverage;
  const a=r.spaces[0]!.region;
  expect(uncoveredVolume(domain,[a,a])).toBeCloseTo(11);
  a.polygon=[[0,0],[2,0],[2,1],[1,1],[1,2],[0,2]];
  expect(locatePoint(r,point([1.5,1.5,1])).resolution).toBe('unresolved');
  expect(regionOverlap(domain,a)).toBeCloseTo(8.25);
});
