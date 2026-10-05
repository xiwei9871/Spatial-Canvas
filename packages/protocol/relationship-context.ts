import {z} from 'zod';
import {relationshipGraphSchema,relationshipNodeSchema,relationshipEdgeSchema,relationshipStatusSchema} from './relationships';
const id=z.string().min(1),hash=z.string().regex(/^[a-f0-9]{64}$/);
export const relationshipContextSchema=z.object({
 subject_id:id.nullable(),primary_space_id:id.nullable(),design_id:id,status:z.enum(['available','unavailable']),
 graph_id:id.nullable(),graph_revision:id.nullable(),
 nodes:z.array(relationshipNodeSchema).max(200),edges:z.array(relationshipEdgeSchema).max(50),
 sources:z.array(z.object({resource_id:id,revision:id,sha256:hash,locator:id.optional()})),
 registry:z.object({sha256:hash,locator:id}).nullable(),truncated:z.boolean(),diagnostics:z.array(id),
 readiness:relationshipStatusSchema,
}).superRefine((c,ctx)=>{
 const reject=(message:string)=>ctx.addIssue({code:'custom',message});
 if(c.status==='unavailable'){if(c.edges.length||c.nodes.length)reject('Unavailable relationship context cannot assert edges/nodes');return;}
 if(!c.subject_id||!c.registry||!c.graph_id||!c.graph_revision)reject('Available graph context requires subject/artifact identity');
 const parsed=relationshipGraphSchema.safeParse({schema:'spatial-canvas.relationships.v1',design_id:c.design_id,graph_id:c.graph_id,revision:c.graph_revision,sources:c.sources,nodes:c.nodes,edges:c.edges});
 if(!parsed.success)reject('Invalid neighborhood graph integrity: '+parsed.error.issues.map(i=>i.message).join('; '));
 if(!c.nodes.some(n=>n.node_id===c.subject_id&&n.kind==='entity'))reject('Subject entity node missing');
 if(c.primary_space_id&&!c.nodes.some(n=>n.node_id===c.primary_space_id&&n.kind==='space'))reject('Primary space node missing');
 const owners=new Set([c.subject_id,c.primary_space_id].filter((x):x is string=>!!x));
 for(let i=0;i<c.nodes.length;i++){let changed=false;for(const e of c.edges)if(e.verification.state!=='rejected'){
  const child=e.type==='contains'?e.to:e.from,parent=e.type==='contains'?e.from:e.to;
  if(['part_of','contains'].includes(e.type)&&owners.has(child)&&!owners.has(parent)){owners.add(parent);changed=true;}
 }if(!changed)break;}
 for(const e of c.edges)if(!owners.has(e.from)&&!owners.has(e.to)&&!e.endpoints?.some(x=>owners.has(x)))reject('Neighborhood edge lacks subject or explicit parent ownership');
});
export type RelationshipContext=z.infer<typeof relationshipContextSchema>;
