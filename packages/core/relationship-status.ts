import {relationshipStatusSchema,CAPABILITY_RELATIONS,type RelationshipGraph,type RelationshipStatus} from '../protocol/relationships';
import {getRelations,getTransitionsForSpace} from './relationships';
export type RelationshipCapability=Exclude<keyof RelationshipStatus,'schema'>;
export const CAPABILITY_TYPES:Record<RelationshipCapability,string[]>=CAPABILITY_RELATIONS;
export function blockedRelationshipStatus(message:string):RelationshipStatus{
 const result=relationshipStatus(undefined,{required:['component_hierarchy','physical_connectivity','space_adjacency','transition_graph']});
 for(const key of Object.keys(CAPABILITY_TYPES) as RelationshipCapability[])result[key]={status:'BLOCKED',diagnostics:[message]};return result;
}
export function relationshipStatus(g:RelationshipGraph|undefined,options:{required?:RelationshipCapability[]}={}):RelationshipStatus{
 const result={schema:'spatial-canvas.relationship-status.v1'} as RelationshipStatus;
 for(const capability of Object.keys(CAPABILITY_TYPES) as RelationshipCapability[]){
  const edges=g?.edges.filter(e=>CAPABILITY_TYPES[capability].includes(e.type)&&e.verification.state!=='rejected')??[];
  const required=g?.requirements.filter(r=>r.capability===capability)??[];
  const diagnostics=g?.gaps.filter(d=>d.capability===capability).map(d=>d.message+' '+d.action)??[];
  for(const r of required)for(const type of r.types){
   const views=g?getRelations(g,r.node_id,type):[];
   const matches=views.filter(e=>e.query_type===type&&e.verification.state==='verified');
   const endpoints=type==='transition_between'&&g?getTransitionsForSpace(g,r.node_id).filter(e=>e.verification.state==='verified'):[];
   if(!matches.length&&!endpoints.length)diagnostics.push(r.node_id+' needs reviewed '+type+' evidence. Review/import missing relation.');
  }
  if(edges.some(e=>e.verification.state==='candidate'))diagnostics.push('Unreviewed '+capability+' candidate edges exist. Approve or reject with evidence.');
  if(edges.length&&!required.length)diagnostics.push('Completeness scope is missing; declare required node/type pairs before READY.');
  const requested=required.length>0||options.required?.includes(capability);
  if(!edges.length&&requested)diagnostics.push('No usable '+capability+' evidence. Import structured relationships or supplement authored graph.');
  const status=!edges.length?(requested?'BLOCKED':'NOT_REQUESTED'):diagnostics.length?'PARTIAL':'READY';
  result[capability]={status,diagnostics};
 }
 return relationshipStatusSchema.parse(result);
}
