import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {importSemantics} from '../packages/core/semantic-import';
import {ingestProject} from '../packages/core/ingestion';
import {relationshipGraphSchema} from '../packages/protocol/relationships';
import {parseJsonBytes} from '../packages/core/semantic-import';
import {blockedRelationshipStatus} from '../packages/core/relationship-status';

const args=process.argv.slice(2);
const value=(flag:string)=>args[args.indexOf(flag)+1];
if(!args.includes('--project')||!args.includes('--output'))throw new Error('Usage: tsx scripts/ingest-project.ts --project project.json [--spaces spaces.json] --output NEW-status.json');
const paths=[value('--project')!,...(args.includes('--spaces')?[value('--spaces')!]:[])];
const files=await Promise.all(paths.map(async path=>({name:resolve(path),bytes:await readFile(path)})));
const semantics=await importSemantics(files);
if(!semantics.project)throw new Error('Project descriptor required');
const changes=[];
for(const source of semantics.project.sources){
  try{const actual=createHash('sha256').update(await readFile(source.locator)).digest('hex');if(actual!==source.sha256)changes.push(source.resource_id+' SHA mismatch');}
  catch{changes.push(source.resource_id+' source unreadable: '+source.locator);}
}
const graphPath=args.includes('--relationships')?value('--relationships'):undefined;
const graph=graphPath?relationshipGraphSchema.parse(parseJsonBytes(await readFile(graphPath))):undefined;
if(graph&&(graph.design_id!==semantics.project.design_id||graph.sources.some(s=>{const actual=semantics.project!.sources.find(a=>a.resource_id===s.resource_id);return actual&&(actual.revision!==s.revision||actual.sha256!==s.sha256);})))throw new Error('Relationship graph/project evidence mismatch');
const status=ingestProject(semantics.project,semantics.registry,graph);
if(graph){for(const s of graph.sources){if(!s.locator){changes.push(s.resource_id+' graph source locator missing');continue;}try{if(createHash('sha256').update(await readFile(s.locator)).digest('hex')!==s.sha256)changes.push(s.resource_id+' graph source SHA mismatch');}catch{changes.push(s.resource_id+' graph source unreadable');}}}
if(changes.length){status.status='BLOCKED_FOR_SPATIAL_CONTEXT';status.relationship_status=blockedRelationshipStatus('Source bytes are unreadable or do not match provenance: '+changes.join('; '));status.diagnostics.push(...changes.map(message=>({code:'source_bytes_unverified',message,action:'Provide exact readable source bytes matching provenance.'})));}
if([...paths,...graphPath?[graphPath]:[],...graph?.sources.flatMap(s=>s.locator?[s.locator]:[])??[]].some(p=>resolve(p)===resolve(value('--output')!))||semantics.project.sources.some(s=>resolve(s.locator)===resolve(value('--output')!)))throw new Error('Output aliases an input source');
await writeFile(value('--output')!,JSON.stringify(status,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:status.status,diagnostics:status.diagnostics,output:value('--output')}));
