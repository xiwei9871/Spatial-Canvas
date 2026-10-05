import {importSemantics} from './semantic-import';
import type {LoadedSemantics} from './spatial-context';
import {importRelationships} from './relationship-import';
import type {Manifest} from '../protocol/index';

export class SemanticState {
  value:LoadedSemantics={};
  generation=0;
  invalidate(reason:string){this.generation++;this.value={...this.value,project:undefined,registry:undefined,artifact:undefined,relationshipGraph:undefined,relationshipArtifact:undefined};this.lastError=reason;}
  lastError='';
  async applySpatial(load:()=>Promise<LoadedSemantics>){const generation=++this.generation;this.value={...this.value,project:undefined,registry:undefined,artifact:undefined,relationshipGraph:undefined,relationshipArtifact:undefined};try{const next=await load();if(generation===this.generation)this.value={...this.value,...next};this.lastError='';}catch(error){if(generation===this.generation){this.invalidate(error instanceof Error?error.message:String(error));}throw error;}}
  async replaceSpatial(files:{name:string;text?:string;bytes?:Uint8Array}[]){return this.applySpatial(()=>importSemantics(files));}
  async replaceGraph(files:{name:string;bytes:Uint8Array}[]){const generation=++this.generation;this.value={...this.value,relationshipGraph:undefined,relationshipArtifact:undefined};try{const next=await importRelationships(files);if(generation===this.generation)this.value={...this.value,relationshipGraph:next.graph,relationshipArtifact:next.artifact};this.lastError='';}catch(error){if(generation===this.generation)this.lastError=error instanceof Error?error.message:String(error);throw error;}}
  proxyChanged(manifest:Manifest){this.generation++;const model=manifest.source_resource_id;const registryApplies=this.value.registry?.applies_to.find(s=>s.resource_id===model);const graphApplies=this.value.relationshipGraph?.sources.find(s=>s.resource_id===model);
    const projectSource=this.value.project?.sources.find(s=>s.resource_id===model);
    if(this.value.project&&(this.value.project.design_id!==manifest.design_id||!projectSource||projectSource.revision!==manifest.source_revision||projectSource.sha256!==manifest.source_sha256))this.value={...this.value,project:undefined,registry:undefined,artifact:undefined,relationshipGraph:undefined,relationshipArtifact:undefined};
    else{if(this.value.registry&&(!registryApplies||registryApplies.revision!==manifest.source_revision||registryApplies.sha256!==manifest.source_sha256))this.value={...this.value,project:undefined,registry:undefined,artifact:undefined,relationshipGraph:undefined,relationshipArtifact:undefined};if(this.value.relationshipGraph&&(!graphApplies||graphApplies.revision!==manifest.source_revision||graphApplies.sha256!==manifest.source_sha256))this.value={...this.value,relationshipGraph:undefined,relationshipArtifact:undefined};}
  }
}
