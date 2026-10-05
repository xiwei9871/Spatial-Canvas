import './style.css';
import { createIntent, reconcileSelection, select } from '../../packages/core/index';
import { createContextPacket } from '../../packages/core/context';
import {importSemantics} from '../../packages/core/semantic-import';
import {SemanticState} from '../../packages/core/semantic-state';
import {buildAiHandoff,copyWithFallback,ContextSnapshot} from '../../packages/core/handoff';
import {importRelationships} from '../../packages/core/relationship-import';
import type {LoadedSemantics} from '../../packages/core/spatial-context';
import type { ContextHit } from '../../packages/protocol/context';
import { manifestSchema, type Intent, type Manifest, type ProtocolEvent, type SelectionEvent } from '../../packages/protocol/index';
import { loadProxy, ProxyViewer, type LoadedProxy } from '../../packages/viewer/index';
import { disposeScene, spatialMetadata } from '../../packages/viewer/scene';
import { buildViewHandoff } from '../../packages/core/view-handoff';
import { viewPresetSchema, type ViewPreset } from '../../packages/protocol/view-preset';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header><div><h1>Spatial Canvas <small>V0.5.1</small></h1><p>Point to entities, spaces and evidenced project relationships.</p></div>
    <div class="toolbar"><button id="example">Load full example</button><button id="task">Load task example</button>
    <label class="file-button">Open local export<input id="files" type="file" accept=".json,.glb" multiple></label>
    <button id="reload" disabled>Reload proxy</button></div></header>
  <div id="status" role="status">Load the included example or choose a manifest and its GLB together.</div><div id="activity" role="status" aria-live="polite"></div>
  <main><section class="viewport" aria-label="Viewport"><div id="viewer"></div>
    <div class="viewport-actions"><button id="clear" disabled>Clear selection</button><button id="frame" disabled>Frame selection</button><button id="ghost" disabled>Ghost selected</button><button id="hide" disabled>Hide selected</button><button id="show-all" disabled>Show all</button><button id="isolate" disabled>Isolate selection</button><button id="lock-view" disabled>Lock view</button></div>
    <p class="help">Drag to orbit · right-drag to pan · scroll to zoom · Shift / Ctrl / ⌘ click to multi-select</p></section>
  <aside><section><h2>Resource</h2><div id="resource">No proxy loaded</div></section>
    <section><h2>Space / Region</h2><div id="semantic-readiness">BLOCKED_FOR_SPATIAL_CONTEXT</div><p id="space-result">Import space regions and project sources to resolve room context.</p>
      <label class="file-button">Import spatial semantics<input id="semantics-files" type="file" accept=".json" multiple></label>
      <button id="clear-semantics">Clear semantics</button><details><summary>Semantic diagnostics</summary><pre id="semantic-diagnostics">No spatial evidence loaded.</pre></details></section>
    <section><h2>Relationships</h2><label class="file-button">Import relationship graph<input id="relationship-files" type="file" accept=".json"></label><button id="clear-relationships">Clear graph</button>
      <p id="relationship-state">No relationship graph loaded</p><div id="relationship-list"></div><details><summary>Relationship readiness / gaps</summary><pre id="relationship-diagnostics"></pre></details></section>
    <section><h2>Entities <span id="count">0</span></h2><input id="search" type="search" placeholder="Search ID, native ID, or type" aria-label="Search entities"><div id="entities"></div></section>
    <section><h2>Inspector <span id="selected-count">0 selected</span></h2><pre id="inspector">Select an entity to inspect identity and world coordinates.</pre></section>
    <section><h2>Transform intent</h2><p>Translation delta in proxy world coordinates (meters). Generates a request for an adapter.</p>
      <form id="intent-form"><div class="translation"><label>X<input id="tx" type="number" step="any" value="0.2" required></label><label>Y<input id="ty" type="number" step="any" value="0" required></label><label>Z<input id="tz" type="number" step="any" value="0" required></label></div><button id="request" disabled>Emit transform intent</button></form></section>
  </aside></main>
  <section class="events"><div class="events-heading"><h2>Emitted protocol JSON <span id="event-count">0 events</span></h2><div><button id="copy-context" disabled>Copy ContextPacket</button> <button id="copy-handoff" disabled>Copy AI Handoff</button> <input id="view-name" aria-label="View name" value="entrance_compare_01" maxlength="64"><button id="save-view" disabled>Save View</button><button id="restore-view" disabled>Restore saved view</button><label class="file-button">Import Camera Preset<input id="preset-file" type="file" accept=".json"></label> <button id="copy-view-handoff" disabled>Copy View Handoff</button> <button id="export-view" disabled>Export Camera Preset</button> <button id="download-context" disabled>Export ContextPacket</button> <button id="download-intent" disabled>Download intent</button> <button id="download" disabled>Download event log</button></div></div><div id="view-downloads"></div><pre id="handoff-fallback" hidden aria-label="AI handoff fallback"></pre><button id="copy-handoff-fallback" hidden>Copy handoff text</button><pre id="event-json" aria-live="polite">[]</pre></section>`;

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const status = (message: string, error = false) => { el('status').textContent = message; el('status').classList.toggle('error', error); };
let manifest: Manifest | undefined;
let proxy: LoadedProxy | undefined;
let selected: string[] = [];
const events: ProtocolEvent[] = [];
let lastExample: 'interaction_proxy' | 'task_proxy' | undefined;
let loadingGeneration = 0;
let latestIntent: Intent | undefined;
let lastSelection:SelectionEvent|undefined;
let currentHit:ContextHit|null=null;
let semantics:LoadedSemantics={};
let semanticsGeneration=0;
const semanticState=new SemanticState();
const contextSnapshot=new ContextSnapshot();
let currentHandoff='';
let currentViewPreset:ViewPreset|undefined;
let hiddenEntityIds:string[]=[];
let ghostEntityIds:string[]=[];
const savedViewKey=()=>manifest?['spatial-canvas.saved-view',manifest.design_id,manifest.source_resource_id,manifest.source_revision,manifest.source_sha256].join(':'):'';
const persistView=()=>{try{if(currentViewPreset)localStorage.setItem(savedViewKey(),JSON.stringify(currentViewPreset));}catch{/* Export remains available if browser storage is blocked. */}};
const activity=(message:string)=>{el('activity').textContent=message;};

function emit(event: ProtocolEvent) {
  if (event.schema === 'spatial-canvas.intent.v1') {
    latestIntent = event;
    el<HTMLButtonElement>('download-intent').disabled = false;
  }
  events.push(event);
  if (events.length > 100) events.shift();
  el('event-json').textContent = JSON.stringify(event, null, 2);
  el('event-count').textContent = events.length + ' events (last 100)';
  el<HTMLButtonElement>('download').disabled = false;
  window.dispatchEvent(new CustomEvent(event.schema, { detail: structuredClone(event) }));
}
function applySelection(event: SelectionEvent) {
  lastSelection=event;
  selected = event.entity_ids;
  if(currentHit&&!selected.includes(currentHit.entity_id))currentHit=null;
  contextSnapshot.clear();
  viewer.highlight(selected);
  renderSelection();
  emit(event);
}
function choose(id: string | null, additive: boolean, source: SelectionEvent['source']) {
  if(source!=='pointer')currentHit=null;
  if (manifest && proxy) applySelection(select(selected, id, additive, source, manifest, proxy.entities));
}
const viewer = new ProxyViewer(el('viewer'), (id, additive, hit) => {
  currentHit=hit;choose(id,additive,'pointer');
});

function renderSelection() {
  el('selected-count').textContent = selected.length + ' selected';
  el<HTMLButtonElement>('clear').disabled = !selected.length;
  el<HTMLButtonElement>('frame').disabled = !selected.length;
  el<HTMLButtonElement>('request').disabled = !selected.length || selected.some((id) => proxy?.entities.get(id)?.mutable === false);
  for(const id of ['ghost','hide','isolate'])el<HTMLButtonElement>(id).disabled=!selected.length;
  el<HTMLButtonElement>('show-all').disabled=!hiddenEntityIds.length&&!ghostEntityIds.length;
  const metadata = selected.map((id) => ({
    ...proxy!.entities.get(id), authority: 'derived',
    spatial: spatialMetadata(proxy!.objects.get(id)!, manifest!),
  }));
  el('inspector').textContent = selected.length ? JSON.stringify(metadata, null, 2) : 'Select an entity to inspect identity and world coordinates.';
  renderEntities();
  renderSemantics();
}
function renderSemantics(){
  if(!manifest||!proxy||!lastSelection)return;
  const context=createContextPacket(manifest,lastSelection,proxy.entities,viewer.viewSnapshot(manifest.coordinate_frame),currentHit,semantics);
  const spatial=context.spatial_context!;
  el('semantic-readiness').textContent=spatial.readiness;
  el('space-result').textContent=spatial.resolution+' · '+(spatial.containing_spaces.map(s=>s.name+' ['+s.space_id+'] ('+s.verification.state+')').join(', ')||'No containing space');
  el('semantic-diagnostics').textContent=spatial.diagnostics.length?spatial.diagnostics.join('\n\n'):'Verified region coverage for declared project domains. Boundary clicks may still be ambiguous.';
  const relationships=context.relationships!;
  const key=JSON.stringify({view:viewer.viewSnapshot(manifest.coordinate_frame),design:manifest.design_id,resource:manifest.resource_id,revision:manifest.source_revision,selection:lastSelection.entity_ids,hit:currentHit,space:spatial.primary_space_id,graph:relationships.graph_id,graphRevision:relationships.graph_revision});
  const stable=contextSnapshot.get(key,()=>context);currentHandoff=buildAiHandoff(stable);el<HTMLButtonElement>('copy-handoff').disabled=false;
  el('relationship-state').textContent=relationships.status+' · '+relationships.edges.length+' relevant edges'+(relationships.truncated?' (truncated)':'');
  el('relationship-list').replaceChildren();
  const names=new Map(relationships.nodes.map(n=>[n.node_id,n.name??n.native_id??n.node_id]));
  for(const edge of relationships.edges){
    const row=document.createElement('p');row.className='relation '+edge.verification.state;
    row.textContent='['+edge.verification.state+'] '+(names.get(edge.from)??edge.from)+' → '+edge.type+' → '+(edge.endpoints?edge.endpoints.map(id=>names.get(id)??id).join(' + '):names.get(edge.to)??edge.to);
    row.title=edge.provenance.evidence;el('relationship-list').append(row);
  }
  el('relationship-diagnostics').textContent=relationships.diagnostics.join('\n')+'\n'+JSON.stringify(relationships.readiness,null,2);
}
function renderEntities() {
  const query = el<HTMLInputElement>('search').value.toLowerCase();
  el('entities').replaceChildren();
  for (const entity of proxy?.entities.values() ?? []) {
    if (![entity.global_id, entity.native_object_id, entity.semantic_type].some((value) => value.toLowerCase().includes(query))) continue;
    const button = document.createElement('button');
    button.className = 'entity';
    button.setAttribute('aria-pressed', String(selected.includes(entity.global_id)));
    button.textContent = entity.global_id + ' · ' + entity.semantic_type;
    button.title = entity.native_object_id;
    button.addEventListener('click', (event) => choose(entity.global_id, event.shiftKey || event.ctrlKey || event.metaKey, 'list'));
    el('entities').append(button);
  }
}
async function install(manifestData: unknown, buffer: ArrayBuffer, generation: number, example?: typeof lastExample) {
  activity('Validating manifest and proxy…');
  const nextManifest = manifestSchema.parse(manifestData);
  const nextProxy = await loadProxy(buffer, nextManifest);
  if (generation !== loadingGeneration) { disposeScene(nextProxy.root); return; }
  const event = reconcileSelection(selected, manifest?.design_id, nextManifest, nextProxy.entities);
  manifest = nextManifest;
  proxy = nextProxy;
  lastExample = example;
  semanticsGeneration++;
  semanticState.proxyChanged(manifest);semantics=semanticState.value;contextSnapshot.clear();
  const applicability=semantics.registry?.applies_to.find(s=>s.resource_id===manifest!.source_resource_id);
  if(semantics.registry&&(semantics.registry.design_id!==manifest.design_id||!applicability||applicability.revision!==manifest.source_revision||applicability.sha256!==manifest.source_sha256))semantics={};
  if(semantics.project&&semantics.project.design_id!==manifest.design_id)semantics={};
  const graphSource=semantics.relationshipGraph?.sources.find(s=>s.resource_id===manifest!.source_resource_id);
  if(semantics.relationshipGraph&&(semantics.relationshipGraph.design_id!==manifest.design_id||!graphSource||graphSource.revision!==manifest.source_revision||graphSource.sha256!==manifest.source_sha256)){delete semantics.relationshipGraph;delete semantics.relationshipArtifact;}
  currentViewPreset=undefined;savedPreview='';el('view-downloads').replaceChildren();hiddenEntityIds=[];ghostEntityIds=[];
  for(const id of ['copy-view-handoff','export-view','restore-view'])el<HTMLButtonElement>(id).disabled=true;
  el<HTMLButtonElement>('save-view').disabled=false;el<HTMLButtonElement>('lock-view').disabled=false;el('lock-view').textContent='Lock view';
  latestIntent = undefined;
  currentHit=null;
  el<HTMLButtonElement>('download-intent').disabled = true;
  viewer.setProxy(nextProxy,manifest.coordinate_frame);
  el('resource').textContent = [manifest.resource_id, manifest.scope, 'derived', manifest.source_revision].join(' · ');
  el('count').textContent = String(manifest.entity_count);
  el<HTMLButtonElement>('reload').disabled = false;
  el<HTMLButtonElement>('download-context').disabled=false;
  el<HTMLButtonElement>('copy-context').disabled=false;
  try{const stored=localStorage.getItem(savedViewKey());if(stored){const value=viewPresetSchema.parse(JSON.parse(stored));currentViewPreset=value;el<HTMLInputElement>('view-name').value=value.preset_id;el<HTMLButtonElement>('restore-view').disabled=false;}}catch{/* Invalid bookmarks are never applied. */}
  applySelection(event);
  activity('Loaded; source and semantic evidence linked.');
  status('Loaded ' + manifest.proxy_uri + ' — ' + manifest.entity_count + ' stable entities. Source: ' + manifest.source_resource);
}
function reportError(error: unknown, generation: number) {
  if (generation === loadingGeneration) status(error instanceof Error ? error.message : String(error), true);
}
async function loadExample(name: NonNullable<typeof lastExample>) {
  const generation = ++loadingGeneration;
  status('Loading example…');
  activity('Loading proxy…');
  try {
    const base = '/living/task-output/artifacts/';
    const response = await fetch(base + name + '.manifest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load example manifest');
    const data = manifestSchema.parse(await response.json());
    const glb = await fetch(base + data.proxy_uri, { cache: 'no-store' });
    if (!glb.ok) throw new Error('Could not load example GLB');
    await install(data, await glb.arrayBuffer(), generation, name);
  } catch (error) { reportError(error, generation); }
}
async function loadFiles(files: File[]) {
  const generation = ++loadingGeneration;
  status('Reading local export…');
  activity('Reading and validating proxy pair…');
  try {
    const manifests = files.filter((file) => file.name.endsWith('.manifest.json'));
    if (manifests.length !== 1) throw new Error('Choose exactly one .manifest.json and its referenced .glb together.');
    const data = manifestSchema.parse(JSON.parse(await manifests[0]!.text()));
    const matching = files.filter((file) => file.name === data.proxy_uri.split('/').at(-1));
    if (matching.length !== 1) throw new Error('Choose the GLB referenced by proxy_uri: ' + data.proxy_uri);
    await install(data, await matching[0]!.arrayBuffer(), generation);
  } catch (error) { reportError(error, generation); }
}
el('example').addEventListener('click', () => { void loadExample('interaction_proxy'); });
el('task').addEventListener('click', () => { void loadExample('task_proxy'); });
el<HTMLInputElement>('files').addEventListener('change', (event) => {
  const input = event.target as HTMLInputElement;
  const files = [...input.files ?? []]; input.value = '';
  if (files.length) void loadFiles(files);
});
el('reload').addEventListener('click', () => {
  if (lastExample) void loadExample(lastExample);
  else { status('Choose the newly exported manifest and GLB together to reload.'); el<HTMLInputElement>('files').click(); }
});
el('search').addEventListener('input', renderEntities);
el<HTMLInputElement>('semantics-files').addEventListener('change',async event=>{
  const input=event.target as HTMLInputElement,files=[...input.files??[]];input.value='';
  const generation=++semanticsGeneration;
  activity('Validating project and Space Registry…');semanticState.invalidate('Replacing spatial semantics');semantics=semanticState.value;contextSnapshot.clear();renderSemantics();
  try{
    const imported=await importSemantics(await Promise.all(files.map(async file=>({name:file.name,bytes:new Uint8Array(await file.arrayBuffer())}))));
    if(generation!==semanticsGeneration)return;
    const candidate={...semanticState.value,...imported};
    if(manifest&&proxy&&lastSelection)createContextPacket(manifest,lastSelection,proxy.entities,viewer.viewSnapshot(manifest.coordinate_frame),currentHit,candidate);
    semantics={...candidate,project:imported.project,registry:imported.registry,artifact:imported.artifact};semanticState.value=semantics;contextSnapshot.clear();renderSemantics();status('Spatial evidence imported. Readiness and latest hit resolution have been recomputed.');activity('Spatial evidence loaded.');
  }catch(error){semantics=semanticState.value;renderSemantics();const message=error instanceof Error?error.message:String(error);status(message,true);activity('Spatial import rejected; previous spatial result was cleared.');}
});
el('clear-semantics').addEventListener('click',()=>{semanticsGeneration++;semanticState.invalidate('Spatial evidence cleared');semantics=semanticState.value;contextSnapshot.clear();renderSemantics();status('Spatial evidence cleared; room context now requires supplementation.');activity('Spatial evidence cleared.');});
el<HTMLInputElement>('relationship-files').addEventListener('change',async event=>{
  const input=event.target as HTMLInputElement,files=[...input.files??[]];input.value='';const generation=++semanticsGeneration;
  try{
    const result=await importRelationships(await Promise.all(files.map(async file=>({name:file.name,bytes:new Uint8Array(await file.arrayBuffer())}))));
    if(generation!==semanticsGeneration)return;
    semantics={...semantics,relationshipGraph:result.graph,relationshipArtifact:result.artifact};semanticState.value=semantics;contextSnapshot.clear();renderSemantics();status('Relationship evidence imported. Typed edges and capability gaps are available in ContextPacket.');activity('Relationship graph loaded.');
  }catch(error){if(generation===semanticsGeneration){delete semantics.relationshipGraph;delete semantics.relationshipArtifact;semanticState.value=semantics;contextSnapshot.clear();renderSemantics();status(error instanceof Error?error.message:String(error),true);activity('Relationship graph rejected; prior graph trust was cleared.');}}
});
el('clear-relationships').addEventListener('click',()=>{semanticsGeneration++;delete semanticState.value.relationshipGraph;delete semanticState.value.relationshipArtifact;semantics=semanticState.value;contextSnapshot.clear();renderSemantics();status('Relationship graph cleared. Connections require evidence.');activity('Relationship graph cleared.');});
el('clear').addEventListener('click', () => choose(null, false, 'list'));
el('frame').addEventListener('click', () => viewer.frame(selected));
el('ghost').addEventListener('click',()=>{ghostEntityIds=[...new Set([...ghostEntityIds,...selected])];hiddenEntityIds=hiddenEntityIds.filter(id=>!ghostEntityIds.includes(id));viewer.applyVisibility(hiddenEntityIds,ghostEntityIds);contextSnapshot.clear();renderSelection();status('Selected entities are ghosted for this view only.');});
el('hide').addEventListener('click',()=>{hiddenEntityIds=[...new Set([...hiddenEntityIds,...selected])];ghostEntityIds=ghostEntityIds.filter(id=>!hiddenEntityIds.includes(id));viewer.applyVisibility(hiddenEntityIds,ghostEntityIds);contextSnapshot.clear();renderSelection();status('Selected entities are hidden for this view only.');});
el('show-all').addEventListener('click',()=>{hiddenEntityIds=[];ghostEntityIds=[];viewer.restoreVisibility();contextSnapshot.clear();renderSelection();status('All temporary view overrides restored.');});
el('isolate').addEventListener('click',()=>{if(!proxy)return;hiddenEntityIds=[...proxy.entities.keys()].filter(id=>!selected.includes(id));ghostEntityIds=[];viewer.applyVisibility(hiddenEntityIds,[]);contextSnapshot.clear();renderSelection();status('Selection isolated for this view only.');});
el('lock-view').addEventListener('click',()=>{const locked=!viewer.isViewLocked;viewer.setViewLocked(locked);el<HTMLButtonElement>('lock-view').textContent=locked?'Unlock view':'Lock view';status(locked?'View locked.':'View unlocked.');});
let savedPreview='';
function saveView(){if(!/^[A-Za-z0-9_-]{1,64}$/.test(el<HTMLInputElement>('view-name').value))throw new Error('View name: use 1–64 letters, digits, underscores or hyphens.');if(!manifest||!proxy)throw new Error('Load a proxy before saving a view.');const candidate=viewPresetSchema.parse(viewer.viewPreset(manifest,el<HTMLInputElement>('view-name').value,hiddenEntityIds,ghostEntityIds));const preview=viewer.screenshotDataUrl();currentViewPreset=candidate;savedPreview=preview;persistView();el<HTMLButtonElement>('copy-view-handoff').disabled=false;el<HTMLButtonElement>('export-view').disabled=false;status('View preset saved with camera, source camera and temporary visibility state.');el<HTMLButtonElement>('restore-view').disabled=false;emit(currentViewPreset);}
el('save-view').addEventListener('click',()=>{try{saveView();}catch(error){status(error instanceof Error?error.message:String(error),true);}});
el('copy-view-handoff').addEventListener('click',async()=>{if(!currentViewPreset)return;const result=await copyWithFallback(buildViewHandoff(currentViewPreset),text=>navigator.clipboard.writeText(text));if(result.copied)status('View Handoff copied. Apply the exact camera preset in Blender.');else {const fallback=el('handoff-fallback');fallback.textContent=result.fallback;fallback.hidden=false;status('Clipboard unavailable; View Handoff is displayed below.',true);}});
el('export-view').addEventListener('click',()=>{
 if(!currentViewPreset)return;
 const box=el('view-downloads');box.replaceChildren();
 const link=document.createElement('a');link.id='view-json-link';link.href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(currentViewPreset,null,2));link.download=currentViewPreset.preset_id+'.view-preset.json';link.textContent='Download camera preset JSON';box.append(link);link.click();
 if(savedPreview){const preview=document.createElement('a');preview.id='view-preview-link';preview.href=savedPreview;preview.download=currentViewPreset.preview_uri??'view.png';preview.textContent='Download reference preview PNG';box.append(preview);}
 status('Camera preset ready. Use the two download links for JSON and reference PNG.');
});
window.addEventListener('keydown', (event) => { if (event.key === 'Escape') choose(null, false, 'keyboard'); });
el('intent-form').addEventListener('submit', (event) => {
  event.preventDefault(); if (!manifest || !proxy) return;
  try {
    const translation = ['tx', 'ty', 'tz'].map((id) => el<HTMLInputElement>(id).valueAsNumber) as [number, number, number];
    emit(createIntent(manifest, selected, proxy.entities, translation));
    status('Transform intent emitted. It is ready for an adapter to inspect.');
  } catch (error) { status(error instanceof Error ? error.message : String(error), true); }
});
el('download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'spatial-canvas.events.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
el('download-intent').addEventListener('click', () => {
  if (!latestIntent) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(latestIntent, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'spatial-canvas.intent.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
function currentContext(){
  if(!manifest||!proxy||!lastSelection)throw new Error('Load a proxy before exporting context.');
  const key=JSON.stringify({view:viewer.viewSnapshot(manifest.coordinate_frame),design:manifest.design_id,resource:manifest.resource_id,revision:manifest.source_revision,selection:lastSelection.entity_ids,hit:currentHit,space:el('space-result').textContent,graph:semantics.relationshipGraph?.graph_id,graphRevision:semantics.relationshipGraph?.revision});
  const packet=contextSnapshot.get(key,()=>createContextPacket(manifest!,lastSelection!,proxy!.entities,viewer.viewSnapshot(manifest!.coordinate_frame),currentHit,semantics));
  emit(packet);
  return packet;
}
el('copy-context').addEventListener('click',async()=>{
  try{
    const packet=currentContext();
    await navigator.clipboard.writeText(JSON.stringify(packet,null,2));activity('ContextPacket copied to clipboard.');
    status('ContextPacket copied. Paste it into Codex to identify this object.');
  }catch(error){status(error instanceof Error?error.message:String(error),true);}
});
el('copy-handoff').addEventListener('click',async()=>{
  if(!manifest||!proxy)return;
  currentHandoff=buildAiHandoff(currentContext());
  const result=await copyWithFallback(currentHandoff,text=>navigator.clipboard.writeText(text));
  if(result.copied){el<HTMLPreElement>('handoff-fallback').hidden=true;el<HTMLButtonElement>('copy-handoff-fallback').hidden=true;status('AI Handoff copied. Paste it into your AI assistant.');activity('AI Handoff copied.');return;}
  const fallback=el<HTMLPreElement>('handoff-fallback');fallback.textContent=result.fallback;fallback.hidden=false;el<HTMLButtonElement>('copy-handoff-fallback').hidden=false;fallback.tabIndex=0;fallback.focus();
  status('Clipboard unavailable. AI Handoff is displayed below for manual selection. '+result.error,true);activity('Clipboard denied; fallback text is ready below.');
});
el('copy-handoff-fallback').addEventListener('click',async()=>{const text=el('handoff-fallback').textContent??'';const result=await copyWithFallback(text,value=>navigator.clipboard.writeText(value));if(result.copied){status('AI Handoff copied.');el<HTMLButtonElement>('copy-handoff-fallback').hidden=true;}else status('Clipboard still unavailable; use the displayed handoff text.',true);});
el('download-context').addEventListener('click',()=>{
  if(!manifest||!proxy||!lastSelection)return;
  try{
    const packet=currentContext();
    const url=URL.createObjectURL(new Blob([JSON.stringify(packet,null,2)],{type:'application/json'}));
    const link=document.createElement('a');
    link.href=url;link.download='spatial-canvas.context.json';
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    status('ContextPacket generated; download requested. If no file appears, use Copy ContextPacket.');
  }catch(error){status(error instanceof Error?error.message:String(error),true);}
});
el('viewer').addEventListener('dragover', (event) => event.preventDefault());
el('viewer').addEventListener('drop', (event) => {
  event.preventDefault(); const files = [...(event as DragEvent).dataTransfer?.files ?? []];
  if (files.length) void loadFiles(files);
});
if (import.meta.hot) import.meta.hot.dispose(() => viewer.dispose());

function restorePreset(value:unknown){
 const preset=viewPresetSchema.parse(value);
 if(!manifest||!proxy)throw new Error('Load the matching proxy first.');
 if(preset.design_id!==manifest.design_id||preset.source_resource_id!==manifest.source_resource_id||preset.source_revision!==manifest.source_revision||preset.source_sha256!==manifest.source_sha256)throw new Error('Preset source/revision/hash does not match loaded proxy.');
 for(const id of [...preset.hidden_entity_ids,...preset.ghost_entity_ids])if(!proxy.entities.has(id))throw new Error('Unknown override entity: '+id);
 viewer.restoreView(preset);hiddenEntityIds=[...preset.hidden_entity_ids];ghostEntityIds=[...preset.ghost_entity_ids];currentViewPreset=preset;savedPreview=viewer.screenshotDataUrl();persistView();el('lock-view').textContent='Unlock view';el<HTMLInputElement>('view-name').value=preset.preset_id;
 for(const id of ['copy-view-handoff','export-view','restore-view'])el<HTMLButtonElement>(id).disabled=false;
 contextSnapshot.clear();currentHit=null;renderSelection();status('Camera preset and temporary overrides restored; view locked.');
}
el('restore-view').addEventListener('click',()=>{try{if(currentViewPreset)restorePreset(currentViewPreset);}catch(error){status(String(error),true);}});
el<HTMLInputElement>('preset-file').addEventListener('change',async event=>{const input=event.target as HTMLInputElement;const file=input.files?.[0];input.value='';if(!file)return;try{restorePreset(JSON.parse(await file.text()));}catch(error){status(error instanceof Error?error.message:String(error),true);}});
