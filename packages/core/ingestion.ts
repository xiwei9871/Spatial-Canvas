import {projectSchema,spaceRegistrySchema,semanticStatusSchema,type Project,type SpaceRegistry,type SemanticStatus} from '../protocol/spaces';
import {regionOverlap,uncoveredVolume} from './regions';
import {relationshipStatus,blockedRelationshipStatus} from './relationship-status';
import {relationshipGraphSchema,type RelationshipGraph} from '../protocol/relationships';
import {graphRegistryErrors} from './relationship-integrity';

export function ingestProject(project:Project,registry?:SpaceRegistry,graph?:RelationshipGraph):SemanticStatus{
  const p=projectSchema.parse(project);
  const parsedGraph=graph?relationshipGraphSchema.safeParse(graph):undefined;
  const graphMismatch=graph&&(graph.design_id!==p.design_id||!parsedGraph?.success||graph.sources.some(s=>{const actual=p.sources.find(a=>a.resource_id===s.resource_id);return actual&&(actual.revision!==s.revision||actual.sha256!==s.sha256);})||!graph.nodes.some(n=>n.kind==='entity'&&p.sources.some(s=>s.resource_id===n.resource_id))||graphRegistryErrors(graph,registry).length>0);
  const graphReadiness=graphMismatch?blockedRelationshipStatus('Relationship graph schema/design/project source revision/SHA mismatch. Supply compatible reviewed graph.'):relationshipStatus(graph,{required:['component_hierarchy','physical_connectivity','space_adjacency','transition_graph']});
  const diagnostics:SemanticStatus['diagnostics']=[];
  const add=(code:string,message:string,action:string)=>diagnostics.push({code,message,action});
  const covered_levels:string[]=[],uncovered_levels:string[]=[];
  let uncovered_volume=0;
  let fatal=false;
  if(!registry)add('missing_regions','No Space Registry is loaded. Object identity does not establish room boundaries.','import authored Space Registry JSON with source provenance, level domains and reviewed boundaries.');
  if(!p.levels.length)add('missing_levels','No levels or coverage domains were supplied.','import level IDs and coverage polygons with vertical ranges.');
  if(registry){
    const parsed=spaceRegistrySchema.safeParse(registry);
    if(!parsed.success){fatal=true;add('invalid_registry',parsed.error.issues.map(i=>i.message).join('; '),'Correct registry geometry, IDs and evidence references.');}
    if(registry.design_id!==p.design_id){fatal=true;add('design_mismatch','Registry belongs to another design.','Import regions for this design.');}
    if(registry.frame.coordinate_frame!==p.frame.coordinate_frame||registry.frame.up_axis!==p.frame.up_axis){fatal=true;add('frame_mismatch','Project and registry frames differ.','Provide aligned region and coverage frames.');}
    for(const source of [...registry.applies_to,...registry.source_context.sources]){
      const actual=p.sources.find(s=>s.resource_id===source.resource_id);
      if(!actual||actual.revision!==source.revision||actual.sha256!==source.sha256){fatal=true;add('source_mismatch','Evidence/model revision or SHA mismatch: '+source.resource_id,'Reconcile exact source revisions and hashes before using spatial context.');}
    }
  }
  const usable=registry&&!fatal?registry:undefined;
  if(usable){
    for(const space of usable.spaces){
      if(!p.levels.some(l=>l.level_id===space.level_id))add('unknown_level','Space '+space.space_id+' uses undeclared level '+space.level_id,'Declare the level and coverage domain.');
      if(space.verification.state!=='verified')add('candidate_requires_review','Candidate '+space.name+' is not verified.','Review polygon, height, evidence and coordinate alignment; record reviewer and decision.');
    }
    for(let i=0;i<usable.spaces.length;i++)for(let j=i+1;j<usable.spaces.length;j++){
      const a=usable.spaces[i]!,b=usable.spaces[j]!;
      if(regionOverlap(a.region,b.region)>1e-8)add('overlap','Regions '+a.space_id+' and '+b.space_id+' have positive-volume overlap.','Resolve overlapping boundaries or retain explicit ambiguous context.');
    }
  }
  for(const level of p.levels){
    const verified=usable?.spaces.filter(s=>s.level_id===level.level_id&&s.verification.state==='verified').map(s=>s.region)??[];
    const gap=uncoveredVolume(level.coverage,verified);
    uncovered_volume+=gap;
    if(gap>1e-8){uncovered_levels.push(level.level_id);add('uncovered_level','Level '+level.level_id+' has '+gap.toFixed(6)+' m³ without verified spatial coverage.','Supply/approve missing region polygons and vertical ranges for '+level.level_id+'.');}
    else covered_levels.push(level.level_id);
  }
  return semanticStatusSchema.parse({schema:'spatial-canvas.semantic-status.v1',project_id:p.project_id,design_id:p.design_id,
    relationship_status:graphReadiness,
    status:!usable?'BLOCKED_FOR_SPATIAL_CONTEXT':diagnostics.length?'PARTIAL':'READY',sources:p.sources,
    known_levels:p.levels.map(l=>l.level_id),coverage:{covered_levels,uncovered_levels,uncovered_volume},diagnostics,
    registry_id:usable?.registry_id??null,registry_revision:usable?.registry_revision??null});
}
