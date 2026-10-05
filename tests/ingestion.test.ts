import {expect,it} from 'vitest';
import {ingestProject} from '../packages/core/ingestion';
import {projectSchema,spaceRegistrySchema} from '../packages/protocol/spaces';
import {spaces,project} from './space-data';

it('reports READY for complete verified regions and BLOCKED for geometry-only projects',()=>{
  const p=projectSchema.parse(project()),r=spaceRegistrySchema.parse(spaces());
  expect(ingestProject(p,r).status).toBe('READY');
  const missing=ingestProject(p);expect(missing.status).toBe('BLOCKED_FOR_SPATIAL_CONTEXT');
  expect(missing.diagnostics.some(d=>d.code==='missing_regions'&&d.action.includes('import'))).toBe(true);
});
it('reports PARTIAL for unapproved CAD candidates and incomplete levels',()=>{
  const p=projectSchema.parse(project()),r=spaceRegistrySchema.parse(spaces());
  r.spaces[0]!.verification={state:'candidate'};
  expect(ingestProject(p,r).status).toBe('PARTIAL');
  r.spaces.splice(0,1);
  expect(ingestProject(p,r).coverage.uncovered_volume).toBeCloseTo(11);
  p.levels.push({...p.levels[0]!,level_id:'lower'});
  expect(ingestProject(p,r).coverage.uncovered_levels).toContain('lower');
});
it('does not let duplicate coverage or overlap cancel missing area',()=>{
  const p=projectSchema.parse(project()),r=spaceRegistrySchema.parse(spaces());
  r.spaces[1]!.region=structuredClone(r.spaces[0]!.region);
  const s=ingestProject(p,r);expect(s.status).toBe('PARTIAL');expect(s.coverage.uncovered_volume).toBeCloseTo(11);
  expect(s.diagnostics.some(d=>d.code==='overlap')).toBe(true);
});
it('refuses wrong design, stale model, unknown evidence, and mismatched frames',()=>{
  const p=projectSchema.parse(project()),r=spaceRegistrySchema.parse(spaces());
  for(const mutate of [(x:typeof r)=>{x.design_id='foreign';},(x:typeof r)=>{x.applies_to[0]!.revision='old';},
    (x:typeof r)=>{x.source_context.sources[1]!.sha256='c'.repeat(64);},(x:typeof r)=>{x.frame.coordinate_frame='other';}]){
    const copy=structuredClone(r);mutate(copy);expect(ingestProject(p,copy).status).toBe('BLOCKED_FOR_SPATIAL_CONTEXT');
  }
});
it('user supplementation changes readiness without changing entity metadata',()=>{
  const p=projectSchema.parse(project());const empty=ingestProject(p);expect(empty.status).toBe('BLOCKED_FOR_SPATIAL_CONTEXT');
  const r=spaceRegistrySchema.parse(spaces());expect(ingestProject(p,r).status).toBe('READY');
});
it('generic CAD source candidates remain PARTIAL and geometry-only sources explicitly BLOCKED',()=>{
  const p=projectSchema.parse(project()),r=spaceRegistrySchema.parse(spaces());
  p.sources[1]!.type='cad';p.sources[1]!.locator='/local/other-project.dxf';p.sources[1]!.semantic_capability='candidate_regions';
  r.source_context.sources[1]={...p.sources[1]!};
  for(const s of r.spaces){s.provenance.method='derived_from_cad';s.verification={state:'candidate'};}
  const candidates=ingestProject(p,r);expect(candidates.status).toBe('PARTIAL');
  expect(candidates.diagnostics.filter(d=>d.code==='candidate_requires_review')).toHaveLength(2);
  p.sources=[p.sources[0]!];const missing=ingestProject(p);
  expect(missing.status).toBe('BLOCKED_FOR_SPATIAL_CONTEXT');expect(missing.diagnostics[0]!.action).toContain('import');
});
