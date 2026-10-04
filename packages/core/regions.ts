import clipping, {type MultiPolygon} from 'polygon-clipping';
import type { Region, SpaceRegistry } from '../protocol/spaces';
import { containsPolygon, GEOMETRY_EPSILON, signedArea } from '../protocol/regions';

export type RegionPoint = {xyz:[number,number,number];frame_id:string;unit:'meter'|'millimeter'|'centimeter';up_axis:'X'|'Y'|'Z'};
export const UNIT_SCALE={meter:1,millimeter:.001,centimeter:.01};
function project(p:[number,number,number],axis:RegionPoint['up_axis']):[number,number,number]{
  if(axis==='Z')return p;
  if(axis==='Y')return [p[0],p[2],p[1]];
  return [p[1],p[2],p[0]];
}
function meters(r:Region):Region{
  const scale=UNIT_SCALE[r.unit];
  return {...r,unit:'meter',polygon:r.polygon.map(([x,y])=>[x*scale,y*scale]),z_min:r.z_min*scale,z_max:r.z_max*scale};
}
function measure(p:MultiPolygon):number{return p.reduce((sum,poly)=>sum+Math.abs(signedArea(poly[0]!))-poly.slice(1).reduce((a,h)=>a+Math.abs(signedArea(h)),0),0);}
export function locatePoint(registry:SpaceRegistry,point:RegionPoint){
  const base={point:point.xyz,frame_id:point.frame_id,unit:point.unit};
  if(point.frame_id!==registry.frame.coordinate_frame||point.up_axis!==registry.frame.up_axis||point.xyz.some(x=>!Number.isFinite(x)))
    return {...base,resolution:'unavailable' as const,containing_spaces:[],primary_space_id:null,diagnostics:['frame_mismatch_or_invalid_point']};
  const scale=UNIT_SCALE[point.unit];const [u,v,h]=project(point.xyz,point.up_axis).map(x=>x*scale) as [number,number,number];
  const matches=registry.spaces.filter(s=>{const r=meters(s.region);return h>=r.z_min-GEOMETRY_EPSILON&&h<=r.z_max+GEOMETRY_EPSILON&&containsPolygon(r.polygon,[u,v])!=='outside';});
  const containing_spaces=matches.map(s=>({space_id:s.space_id,name:s.name,semantic_type:s.semantic_type,level_id:s.level_id,
    verification:s.verification,provenance:s.provenance,confidence:s.confidence}));
  if(matches.length>1)return {...base,resolution:'ambiguous' as const,containing_spaces,primary_space_id:null,diagnostics:['overlapping_or_shared_boundary_regions']};
  if(matches.length===1&&matches[0]!.verification.state==='verified')return {...base,resolution:'exact' as const,containing_spaces,primary_space_id:matches[0]!.space_id,diagnostics:[]};
  return {...base,resolution:'unresolved' as const,containing_spaces,primary_space_id:null,diagnostics:[matches.length?'candidate_region_requires_review':'no_containing_space']};
}
export function regionOverlap(a:Region,b:Region):number{
  if(a.coordinate_frame!==b.coordinate_frame)throw new Error('Cannot compare different coordinate frames');
  const x=meters(a),y=meters(b);const height=Math.max(0,Math.min(x.z_max,y.z_max)-Math.max(x.z_min,y.z_min));
  return height?measure(clipping.intersection([x.polygon],[y.polygon]))*height:0;
}
export function uncoveredVolume(domain:Region,regions:Region[]):number{
  if(regions.some(r=>r.coordinate_frame!==domain.coordinate_frame))throw new Error('Cannot compare different coordinate frames');
  const d=meters(domain),rs=regions.map(meters);
  const heights=[...new Set([d.z_min,d.z_max,...rs.flatMap(r=>[Math.max(d.z_min,Math.min(d.z_max,r.z_min)),Math.max(d.z_min,Math.min(d.z_max,r.z_max))])])].sort((a,b)=>a-b);
  let gap=0;
  for(let i=0;i<heights.length-1;i++){
    const lower=heights[i]!,upper=heights[i+1]!,mid=(lower+upper)/2;
    const active=rs.filter(r=>r.z_min<=mid&&r.z_max>=mid).map(r=>[r.polygon]);
    const uncovered=active.length?clipping.difference([d.polygon],...active):[[d.polygon]];
    gap+=measure(uncovered)*(upper-lower);
  }
  return Math.max(0,gap);
}
