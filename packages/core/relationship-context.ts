import type {Manifest,Entity} from '../protocol/index';
import type {LoadedSemantics} from './spatial-context';
import {relationshipContextSchema,type RelationshipContext} from '../protocol/relationship-context';
import {relationshipGraphSchema} from '../protocol/relationships';
import {relationshipStatus} from './relationship-status';
import {compactNeighborhood} from './relationships';
export function createRelationshipContext(manifest:Manifest,subject:string|null,entities:ReadonlyMap<string,Entity>,semantics:LoadedSemantics={},spaceId:string|null=null):RelationshipContext{
 const graph=semantics.relationshipGraph,artifact=semantics.relationshipArtifact;
 const readiness=relationshipStatus(graph,{required:['component_hierarchy','physical_connectivity','space_adjacency','transition_graph']});
 const base={subject_id:subject,primary_space_id:spaceId,design_id:manifest.design_id,status:'unavailable',graph_id:null,graph_revision:null,nodes:[],edges:[],sources:[],registry:null,truncated:false,readiness,diagnostics:[]};
 const blocked=(message:string)=>relationshipContextSchema.parse({...base,diagnostics:[message],readiness:relationshipStatus(undefined,{required:['component_hierarchy','physical_connectivity','space_adjacency','transition_graph']})});
 if(!graph||!artifact)return blocked('No relationship graph loaded. Import source-linked graph JSON; physical/functional connections are unknown.');
 const parsed=relationshipGraphSchema.safeParse(graph);if(!parsed.success)return blocked('Relationship graph invalid: '+parsed.error.message);
 if(graph.design_id!==manifest.design_id)return blocked('Relationship graph belongs to another design.');
 if(semantics.project&&semantics.project.design_id!==manifest.design_id)return blocked('Relationship project belongs to another design.');
 const model=graph.sources.find(s=>s.resource_id===manifest.source_resource_id);
 if(!model||model.revision!==manifest.source_revision||model.sha256!==manifest.source_sha256)return blocked('Relationship graph model revision/SHA mismatch.');
 if(semantics.project){for(const source of graph.sources){const known=semantics.project.sources.find(s=>s.resource_id===source.resource_id);
  if(known&&(known.revision!==source.revision||known.sha256!==source.sha256))return blocked('Graph evidence source revision/SHA mismatch: '+source.resource_id);}}
 for(const node of graph.nodes){
  if(node.kind==='entity'&&node.resource_id===manifest.source_resource_id){const actual=entities.get(node.node_id);if(actual&&node.native_id!==actual.native_object_id)return blocked('Graph native entity locator mismatch: '+node.node_id);}
  if(node.kind==='entity'&&node.resource_id!==manifest.source_resource_id)return blocked('Graph entity belongs to another model resource: '+node.node_id);
  if(node.kind==='entity'&&manifest.scope==='full'&&!entities.has(node.node_id))return blocked('Full proxy does not contain referenced graph entity: '+node.node_id);
  if(node.kind==='space'||node.kind==='level'){
   if(!semantics.registry||!semantics.artifact)return blocked('Space/level graph nodes require the linked Space Registry.');
   const applicability=semantics.registry.applies_to.find(s=>s.resource_id===manifest.source_resource_id);
   if(semantics.registry.design_id!==manifest.design_id||!applicability||applicability.revision!==manifest.source_revision||applicability.sha256!==manifest.source_sha256)return blocked('Relationship Space Registry design/model applicability mismatch.');
   const source=graph.sources.find(s=>s.resource_id===node.resource_id);
   if(!source||source.resource_id!==semantics.registry.registry_id||source.revision!==semantics.registry.registry_revision||source.sha256!==semantics.artifact.sha256)return blocked('Graph Space Registry revision/SHA mismatch.');
   if(node.kind==='space'&&!semantics.registry.spaces.some(s=>s.space_id===(node.space_id??node.node_id)))return blocked('Graph space ID missing in registry.');
   if(node.kind==='level'&&!semantics.registry.spaces.some(s=>s.level_id===(node.level_id??node.node_id)))return blocked('Graph level missing in registry.');
  }
 }
 if(!subject)return blocked('Select an entity to query relationships.');
 const node=graph.nodes.find(n=>n.node_id===subject),actual=entities.get(subject);
 if(!node||node.kind!=='entity'||node.resource_id!==manifest.source_resource_id||!actual||node.native_id!==actual.native_object_id)return blocked('Selected entity is not mapped in graph. Supplement exact global/native node identity.');
 const primaryNode=spaceId?graph.nodes.find(n=>n.kind==='space'&&(n.space_id??n.node_id)===spaceId)?.node_id:null;
 const n=compactNeighborhood(graph,subject,primaryNode??undefined);
 return relationshipContextSchema.parse({...base,status:'available',graph_id:graph.graph_id,graph_revision:graph.revision,
  primary_space_id:primaryNode??null,nodes:n.nodes,edges:n.edges,sources:graph.sources,registry:artifact,truncated:n.truncated,
  diagnostics:[...graph.gaps.filter(d=>!d.node_id||n.nodes.some(x=>x.node_id===d.node_id)).map(d=>d.message+' '+d.action),...(n.truncated?['Neighborhood truncated by ancestor/edge/node bounds; do not claim completeness.']:[]),...(manifest.scope==='task'?['Referenced entities outside this task proxy retain declared source locators; verify source/binding bytes before claims beyond the loaded subset.']:[])]});
}
