import type {RelationshipGraph} from '../protocol/relationships';
import type {SpaceRegistry} from '../protocol/spaces';

export function graphRegistryErrors(graph:RelationshipGraph,registry?:SpaceRegistry,artifactSha?:string):string[]{
 const spatial=graph.nodes.filter(n=>n.kind==='space'||n.kind==='level');
 if(!spatial.length)return [];
 if(!registry)return ['Graph space/level endpoints need a loaded Space Registry.'];
 const errors:string[]=[];
 if(registry.design_id!==graph.design_id)errors.push('Graph and Space Registry designs differ.');
 for(const resource of new Set(graph.nodes.filter(n=>n.kind==='entity').map(n=>n.resource_id))){
  const model=graph.sources.find(s=>s.resource_id===resource),applies=registry.applies_to.find(s=>s.resource_id===resource);
  if(!model||!applies||model.revision!==applies.revision||model.sha256!==applies.sha256)errors.push('Registry does not apply to graph model '+resource+'.');
 }
 for(const node of spatial){
  const source=graph.sources.find(s=>s.resource_id===node.resource_id);
  if(node.resource_id!==registry.registry_id||!source||source.revision!==registry.registry_revision||(artifactSha&&source.sha256!==artifactSha))errors.push('Graph Space Registry identity/revision/SHA mismatch.');
  if(node.kind==='space'&&!registry.spaces.some(s=>s.space_id===(node.space_id??node.node_id)))errors.push('Graph semantic space missing: '+node.node_id);
  if(node.kind==='level'&&!registry.spaces.some(s=>s.level_id===(node.level_id??node.node_id)))errors.push('Graph semantic level missing: '+node.node_id);
 }
 return errors;
}
