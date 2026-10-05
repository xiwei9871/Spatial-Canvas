import {SYMMETRIC_RELATIONS,type RelationshipGraph,type RelationshipEdge} from '../protocol/relationships';
export type RelationView=RelationshipEdge&{direction:'outgoing'|'incoming';target_id:string;query_type:RelationshipEdge['type']};
export function getRelations(g:RelationshipGraph,id:string,type?:RelationshipEdge['type'],options:{includeIncoming?:boolean}={}):RelationView[]{
  const out:RelationView[]=[];
  for(const e of g.edges){
    if(e.from===id&&(!type||type===e.type))out.push({...e,direction:'outgoing',target_id:e.to,query_type:e.type});
    if(e.to===id&&(options.includeIncoming||SYMMETRIC_RELATIONS.has(e.type)||['part_of','contains','transition_between'].includes(e.type))){
      const query_type=e.type==='part_of'?'contains':e.type==='contains'?'part_of':e.type;
      if(!type||type===query_type||type===e.type)out.push({...e,direction:'incoming',target_id:e.from,query_type});
    }
    if(e.type==='transition_between'&&e.endpoints?.includes(id)&&e.to!==id&&(!type||type===e.type))out.push({...e,direction:'incoming',target_id:e.from,query_type:e.type});
  }
  return out;
}
export function getParents(g:RelationshipGraph,id:string){return getRelations(g,id).filter(e=>e.query_type==='part_of'&&e.verification.state!=='rejected');}
export function getChildren(g:RelationshipGraph,id:string){return getRelations(g,id).filter(e=>e.query_type==='contains'&&e.verification.state!=='rejected');}
export function getConnected(g:RelationshipGraph,id:string){return getRelations(g,id,'connected_to');}
export function getContainingGroups(g:RelationshipGraph,id:string){return getParents(g,id).filter(e=>g.nodes.some(n=>n.node_id===e.target_id&&n.kind==='component_group'));}
export function getTransitionsForSpace(g:RelationshipGraph,id:string){return g.edges.filter(e=>e.type==='transition_between'&&e.endpoints?.includes(id));}
export function getAdjacentSpaces(g:RelationshipGraph,id:string){return getRelations(g,id,'adjacent_to').filter(e=>g.nodes.some(n=>n.node_id===e.target_id&&n.kind==='space'));}
export function compactNeighborhood(g:RelationshipGraph,id:string,spaceId?:string){
  const owners=new Set([id]);const queue=[id],paths=new Set<string>();
  while(queue.length&&paths.size<25){const node=queue.shift()!;for(const p of getContainingGroups(g,node)){if(paths.size>=25)break;paths.add(p.edge_id);if(!owners.has(p.target_id)){owners.add(p.target_id);queue.push(p.target_id);}}}
  if(spaceId)owners.add(spaceId);
  const all=g.edges.filter(e=>owners.has(e.from)||owners.has(e.to)||e.endpoints?.some(x=>owners.has(x)));
  const ordered=[...all.filter(e=>paths.has(e.edge_id)),...all.filter(e=>!paths.has(e.edge_id)&&(e.from===id||e.to===id)),...all.filter(e=>!paths.has(e.edge_id)&&e.from!==id&&e.to!==id)];
  const edges:RelationshipEdge[]=[],needed=new Set([id,...owners]);let capped=false;
  for(const e of ordered){const ids=[e.from,e.to,...e.endpoints??[]],added=ids.filter(n=>!needed.has(n));if(edges.length>=50||needed.size+new Set(added).size>200){capped=true;continue;}edges.push(e);for(const n of ids)needed.add(n);}
  return {subject_id:id,owners:[...owners],nodes:g.nodes.filter(n=>needed.has(n.node_id)),edges,truncated:capped||queue.length>0};
}
