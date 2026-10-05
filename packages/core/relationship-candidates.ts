import clipping from 'polygon-clipping';
import type {RelationshipEdge} from '../protocol/relationships';
import {signedArea,type Polygon} from '../protocol/regions';
export type GeometryEvidence={resource_id:string;revision:string;sha256:string;frame_id:string;unit:string;tolerance:number};
type Box={node_id:string;bounds:[[number,number,number],[number,number,number]]};
function provenance(e:GeometryEvidence,method:RelationshipEdge['provenance']['method'],evidence:string){
 if(!Number.isFinite(e.tolerance)||e.tolerance<0||!e.resource_id||!e.revision||!e.frame_id||!e.unit||!(/^[a-f0-9]{64}$/).test(e.sha256))throw new Error('Explicit source/frame/unit/tolerance evidence required');
 return {method,source_resource_id:e.resource_id,source_revision:e.revision,source_sha256:e.sha256,evidence};
}
export function contactCandidates(boxes:Box[],evidence:GeometryEvidence):RelationshipEdge[]{
 const p=provenance(evidence,'inferred_from_geometry_contact','Evaluated AABB boundary contact only; functional/mesh contact is unverified.');
 for(const b of boxes)if(b.bounds.flat().some(x=>!Number.isFinite(x))||b.bounds[0].some((v,i)=>v>b.bounds[1][i]!))throw new Error('Invalid finite AABB');
 const out:RelationshipEdge[]=[];
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
  const a=boxes[i]!,b=boxes[j]!,overlap=[0,1,2].map(k=>Math.min(a.bounds[1][k]!,b.bounds[1][k]!)-Math.max(a.bounds[0][k]!,b.bounds[0][k]!));
  if(overlap.some(v=>v < -evidence.tolerance)||!overlap.some(v=>Math.abs(v)<=evidence.tolerance))continue;
  const [from,to]=[a.node_id,b.node_id].sort();if(from===to)continue;
  out.push({edge_id:'candidate_contact_'+from+'_'+to,from:from!,to:to!,type:'connected_to',verification:{state:'candidate'},confidence:.4,provenance:p,
    geometry_evidence:{method:'evaluated_aabb_boundary',frame_id:evidence.frame_id,unit:evidence.unit,tolerance:evidence.tolerance,bounds_a:a.bounds,bounds_b:b.bounds,axis_overlaps:overlap}});
 }
 return out;
}
export function sharedBoundaryCandidate(a:{node_id:string;polygon:Polygon},b:{node_id:string;polygon:Polygon},e:GeometryEvidence):RelationshipEdge|null{
 const p=provenance(e,'inferred_from_spatial_adjacency','Positive shared boundary segment, not polygon overlap/proximity. Vertical coincidence requires independent review.');
 const intersection=clipping.intersection([a.polygon],[b.polygon]);
 if(intersection.some(poly=>Math.abs(signedArea(poly[0]!))>e.tolerance*e.tolerance))return null;
 let length=0;
 for(let i=0;i<a.polygon.length;i++)for(let j=0;j<b.polygon.length;j++){
  const x=a.polygon[i]!,y=a.polygon[(i+1)%a.polygon.length]!,v=b.polygon[j]!,w=b.polygon[(j+1)%b.polygon.length]!;
  const dx=y[0]-x[0],dy=y[1]-x[1],len=Math.hypot(dx,dy);if(!len)continue;
  if(Math.abs(dx*(v[1]-x[1])-dy*(v[0]-x[0]))>e.tolerance*len||Math.abs(dx*(w[1]-x[1])-dy*(w[0]-x[0]))>e.tolerance*len)continue;
  const t=(q:[number,number])=>((q[0]-x[0])*dx+(q[1]-x[1])*dy)/len;
  length+=Math.max(0,Math.min(len,Math.max(t(v),t(w)))-Math.max(0,Math.min(t(v),t(w))));
 }
 if(length<=e.tolerance)return null;const [from,to]=[a.node_id,b.node_id].sort();
 return {edge_id:'candidate_boundary_'+from+'_'+to,from:from!,to:to!,type:'adjacent_to',verification:{state:'candidate'},confidence:.6,provenance:p,geometry_evidence:{method:'shared_boundary_segment',length,frame_id:e.frame_id,unit:e.unit,tolerance:e.tolerance}};
}
export function openingTransitionCandidate(subject:string,endpoints:string[],sideProbes:[number,number,number][],e:GeometryEvidence):RelationshipEdge{
 if(endpoints.length<2||new Set(endpoints).size!==endpoints.length||sideProbes.length!==endpoints.length||sideProbes.flat().some(v=>!Number.isFinite(v)))throw new Error('Transition needs distinct endpoints and actual side probes');
 return {edge_id:'candidate_transition_'+subject,from:subject,to:endpoints[0]!,type:'transition_between',endpoints,verification:{state:'candidate'},confidence:.5,
  provenance:provenance(e,'inferred_from_spatial_adjacency','Transition crossing/vertical side probes; endpoint space labels and access are not automatically verified.'),geometry_evidence:{method:'transition_side_probes',frame_id:e.frame_id,unit:e.unit,tolerance:e.tolerance,side_probes:sideProbes}};
}
