import {z} from 'zod';
const id=z.string().min(1),hash=z.string().regex(/^[a-f0-9]{64}$/);
export const relationType=z.enum(['part_of','contains','connected_to','adjacent_to','embedded_in','supports','opens_to','accesses','transition_between','same_component_group']);
const kind=z.enum(['entity','space','level','component_group']);
const verification=z.discriminatedUnion('state',[z.object({state:z.literal('verified'),reviewer:id,timestamp:z.iso.datetime(),note:id}),z.object({state:z.literal('candidate')}),z.object({state:z.literal('rejected'),reviewer:id,timestamp:z.iso.datetime(),note:id})]);
const provenance=z.object({method:z.enum(['imported','user_authored','derived_from_source_hierarchy','derived_from_cad','derived_from_freecad','derived_from_ifc','inferred_from_geometry_contact','inferred_from_spatial_adjacency','inferred_from_naming']),source_resource_id:id,source_revision:id,source_sha256:hash,evidence:id});
export const relationshipNodeSchema=z.object({node_id:id,kind,name:id.optional(),resource_id:id,native_id:id.optional(),space_id:id.optional(),level_id:id.optional()}).refine(n=>n.kind!=='entity'||!!n.native_id,'Entity node needs native locator');
export const relationshipEdgeSchema=z.object({edge_id:id,from:id,to:id,type:relationType,endpoints:z.array(id).optional(),verification,provenance,confidence:z.number().min(0).max(1).optional(),geometry_evidence:z.record(z.string(),z.unknown()).optional()}).superRefine((e,c)=>{if(e.from===e.to)c.addIssue({code:'custom',message:'Self-edge is invalid'});if(e.type==='transition_between'&&(!e.endpoints||e.endpoints.length<2||new Set(e.endpoints).size!==e.endpoints.length))c.addIssue({code:'custom',message:'Transition needs at least two distinct endpoints'});if(e.type!=='transition_between'&&e.endpoints)c.addIssue({code:'custom',message:'Only transitions have endpoints'});});
export const SYMMETRIC_RELATIONS = new Set(['connected_to','adjacent_to','same_component_group']);
export const CAPABILITY_RELATIONS={component_hierarchy:['part_of','contains','same_component_group'],physical_connectivity:['connected_to','embedded_in','supports'],space_adjacency:['adjacent_to'],transition_graph:['transition_between','opens_to','accesses']};
export function semanticEdgeKey(e: RelationshipEdge): string {
  if(e.type==='contains')return JSON.stringify(['part_of',e.to,e.from]);
  if(e.type==='transition_between')return JSON.stringify([e.type,e.from,[...(e.endpoints??[])].sort()]);
  if(SYMMETRIC_RELATIONS.has(e.type))return JSON.stringify([e.type,...[e.from,e.to].sort()]);
  return JSON.stringify([e.type,e.from,e.to]);
}
export const relationshipGraphSchema=z.object({
  schema:z.literal('spatial-canvas.relationships.v1'),design_id:id,graph_id:id,revision:id,
  sources:z.array(z.object({resource_id:id,revision:id,sha256:hash,locator:id.optional()})).min(1),
  nodes:z.array(relationshipNodeSchema).min(1),edges:z.array(relationshipEdgeSchema),
  gaps:z.array(z.object({capability:z.enum(['component_hierarchy','physical_connectivity','space_adjacency','transition_graph']),node_id:id.optional(),message:id,action:id})).default([]),
  requirements:z.array(z.object({capability:z.enum(['component_hierarchy','physical_connectivity','space_adjacency','transition_graph']),node_id:id,types:z.array(relationType).min(1)})).default([]),
}).superRefine((g,c)=>{
  const reject=(message:string)=>c.addIssue({code:'custom',message});
  const nodes=new Map(g.nodes.map(n=>[n.node_id,n]));
  if(nodes.size!==g.nodes.length)reject('Duplicate node_id');
  if(new Set(g.sources.map(s=>s.resource_id)).size!==g.sources.length)reject('Duplicate source resource_id');
  for(const n of g.nodes)if(n.resource_id&&!g.sources.some(s=>s.resource_id===n.resource_id))reject('Node source missing');
  const ids=new Set<string>(),keys=new Set<string>();
  const hierarchy=new Map<string,string[]>();
  for(const e of g.edges){
    if(ids.has(e.edge_id))reject('Duplicate edge_id');ids.add(e.edge_id);
    const key=semanticEdgeKey(e);if(keys.has(key))reject('Duplicate semantic edge (including inverse/symmetric)');keys.add(key);
    const from=nodes.get(e.from),to=nodes.get(e.to);
    if(!from||!to||(e.endpoints??[]).some(x=>!nodes.has(x)))reject('Edge references missing node');
    const source=g.sources.find(s=>s.resource_id===e.provenance.source_resource_id);
    if(!source||source.revision!==e.provenance.source_revision||source.sha256!==e.provenance.source_sha256)reject('Edge source mismatch');
    if(e.provenance.method==='inferred_from_naming'&&e.verification.state==='verified')reject('Naming-only edge cannot be verified');
    if(e.type==='transition_between'){
      if(from&&!['entity','component_group'].includes(from.kind))reject('Transition subject must be entity/group');
      if(e.to!==e.endpoints?.[0])reject('Transition to must identify first endpoint');
      if(e.endpoints?.includes(e.from)||e.endpoints?.some(x=>!['space','level'].includes(nodes.get(x)?.kind??'')))reject('Transition endpoints must be distinct spaces/levels');
    }
    if(e.type==='same_component_group'&&(from?.kind!=='entity'||to?.kind!=='entity'))reject('Same-component edge connects entities');
    if(['connected_to','embedded_in','supports'].includes(e.type)&&[from,to].some(n=>n&&!['entity','component_group'].includes(n.kind)))reject('Physical relationship endpoints must be entity/group');
    if(['opens_to','accesses'].includes(e.type)&&to&&!['space','level'].includes(to.kind))reject('Opening/access target must be space/level');
    if(['part_of','contains','embedded_in'].includes(e.type)&&e.verification.state!=='rejected'){
      const child=e.type==='contains'?e.to:e.from,parent=e.type==='contains'?e.from:e.to;
      if(e.type==='part_of'&&to?.kind!=='component_group')reject('part_of parent must be component group');
      if(e.type==='contains'&&from?.kind!=='component_group')reject('contains parent must be component group');
      hierarchy.set(child,[...(hierarchy.get(child)??[]),parent]);
    }
  }
  for(const start of hierarchy.keys()){
    const visit=(node:string,path:Set<string>):boolean=>{if(path.has(node))return true;const next=new Set(path).add(node);return (hierarchy.get(node)??[]).some(p=>visit(p,next));};
    if(visit(start,new Set())){reject('Containment cycle');break;}
  }
  for(const r of g.requirements){if(!nodes.has(r.node_id))reject('Requirement node missing');if(r.types.some(t=>!CAPABILITY_RELATIONS[r.capability].includes(t)))reject('Requirement type does not belong to capability');}
  for(const gap of g.gaps)if(gap.node_id&&!nodes.has(gap.node_id))reject('Gap node missing');
});
export const relationshipStatusSchema=z.object({schema:z.literal('spatial-canvas.relationship-status.v1'),component_hierarchy:z.object({status:z.enum(['READY','PARTIAL','BLOCKED','NOT_REQUESTED']),diagnostics:z.array(id)}),physical_connectivity:z.object({status:z.enum(['READY','PARTIAL','BLOCKED','NOT_REQUESTED']),diagnostics:z.array(id)}),space_adjacency:z.object({status:z.enum(['READY','PARTIAL','BLOCKED','NOT_REQUESTED']),diagnostics:z.array(id)}),transition_graph:z.object({status:z.enum(['READY','PARTIAL','BLOCKED','NOT_REQUESTED']),diagnostics:z.array(id)})});
export type RelationshipGraph=z.infer<typeof relationshipGraphSchema>;export type RelationshipEdge=z.infer<typeof relationshipEdgeSchema>;export type RelationshipNode=z.infer<typeof relationshipNodeSchema>;export type RelationshipStatus=z.infer<typeof relationshipStatusSchema>;
