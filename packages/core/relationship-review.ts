import {relationshipGraphSchema,type RelationshipGraph} from '../protocol/relationships';
export function reviewRelationship(g:RelationshipGraph,edgeId:string,state:'verified'|'rejected',review:{reviewer:string;timestamp:string;note:string},revision:string):RelationshipGraph{
 if(revision===g.revision)throw new Error('Review requires a new graph revision');
 const next=structuredClone(g),edge=next.edges.find(e=>e.edge_id===edgeId);if(!edge)throw new Error('Unknown edge ID');
 next.revision=revision;edge.verification={state,...review};return relationshipGraphSchema.parse(next);
}
