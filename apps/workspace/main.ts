import './style.css';
import { createIntent, reconcileSelection, select } from '../../packages/core/index';
import { manifestSchema, type Manifest, type ProtocolEvent, type SelectionEvent } from '../../packages/protocol/index';
import { loadProxy, ProxyViewer, type LoadedProxy } from '../../packages/viewer/index';
import { disposeScene, spatialMetadata } from '../../packages/viewer/scene';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header><div><h1>Spatial Canvas <small>V0.1</small></h1><p>Point to stable entities. Send intent to the source.</p></div>
    <div class="toolbar"><button id="example">Load full example</button><button id="task">Load task example</button>
    <label class="file-button">Open local export<input id="files" type="file" accept=".json,.glb" multiple></label>
    <button id="reload" disabled>Reload proxy</button></div></header>
  <div id="status" role="status">Load the included example or choose a manifest and its GLB together.</div>
  <main><section class="viewport" aria-label="Viewport"><div id="viewer"></div>
    <div class="viewport-actions"><button id="clear" disabled>Clear selection</button><button id="frame" disabled>Frame selection</button></div>
    <p class="help">Drag to orbit · right-drag to pan · scroll to zoom · Shift / Ctrl / ⌘ click to multi-select</p></section>
  <aside><section><h2>Resource</h2><div id="resource">No proxy loaded</div></section>
    <section><h2>Entities <span id="count">0</span></h2><input id="search" type="search" placeholder="Search ID, native ID, or type" aria-label="Search entities"><div id="entities"></div></section>
    <section><h2>Inspector <span id="selected-count">0 selected</span></h2><pre id="inspector">Select an entity to inspect identity and world coordinates.</pre></section>
    <section><h2>Transform intent</h2><p>Translation delta in proxy world coordinates (meters). Generates a request for an adapter.</p>
      <form id="intent-form"><div class="translation"><label>X<input id="tx" type="number" step="any" value="0.2" required></label><label>Y<input id="ty" type="number" step="any" value="0" required></label><label>Z<input id="tz" type="number" step="any" value="0" required></label></div><button id="request" disabled>Emit transform intent</button></form></section>
  </aside></main>
  <section class="events"><div class="events-heading"><h2>Emitted protocol JSON <span id="event-count">0 events</span></h2><button id="download" disabled>Download event log</button></div><pre id="event-json" aria-live="polite">[]</pre></section>`;

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const status = (message: string, error = false) => { el('status').textContent = message; el('status').classList.toggle('error', error); };
let manifest: Manifest | undefined;
let proxy: LoadedProxy | undefined;
let selected: string[] = [];
const events: ProtocolEvent[] = [];
let lastExample: 'interaction_proxy' | 'task_proxy' | undefined;
let loadingGeneration = 0;

function emit(event: ProtocolEvent) {
  events.push(event);
  if (events.length > 100) events.shift();
  el('event-json').textContent = JSON.stringify(event, null, 2);
  el('event-count').textContent = events.length + ' events (last 100)';
  el<HTMLButtonElement>('download').disabled = false;
  window.dispatchEvent(new CustomEvent(event.schema, { detail: structuredClone(event) }));
}
function applySelection(event: SelectionEvent) {
  selected = event.entity_ids;
  viewer.highlight(selected);
  renderSelection();
  emit(event);
}
function choose(id: string | null, additive: boolean, source: SelectionEvent['source']) {
  if (manifest && proxy) applySelection(select(selected, id, additive, source, manifest, proxy.entities));
}
const viewer = new ProxyViewer(el('viewer'), (id, additive) => choose(id, additive, 'pointer'));

function renderSelection() {
  el('selected-count').textContent = selected.length + ' selected';
  el<HTMLButtonElement>('clear').disabled = !selected.length;
  el<HTMLButtonElement>('frame').disabled = !selected.length;
  el<HTMLButtonElement>('request').disabled = !selected.length || selected.some((id) => proxy?.entities.get(id)?.mutable === false);
  const metadata = selected.map((id) => ({
    ...proxy!.entities.get(id), authority: 'derived',
    spatial: spatialMetadata(proxy!.objects.get(id)!, manifest!),
  }));
  el('inspector').textContent = selected.length ? JSON.stringify(metadata, null, 2) : 'Select an entity to inspect identity and world coordinates.';
  renderEntities();
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
  const nextManifest = manifestSchema.parse(manifestData);
  const nextProxy = await loadProxy(buffer, nextManifest);
  if (generation !== loadingGeneration) { disposeScene(nextProxy.root); return; }
  const event = reconcileSelection(selected, manifest?.design_id, nextManifest, nextProxy.entities);
  manifest = nextManifest;
  proxy = nextProxy;
  lastExample = example;
  viewer.setProxy(nextProxy);
  el('resource').textContent = [manifest.resource_id, manifest.scope, 'derived', manifest.source_revision].join(' · ');
  el('count').textContent = String(manifest.entity_count);
  el<HTMLButtonElement>('reload').disabled = false;
  applySelection(event);
  status('Loaded ' + manifest.proxy_uri + ' — ' + manifest.entity_count + ' stable entities. Source: ' + manifest.source_resource);
}
function reportError(error: unknown, generation: number) {
  if (generation === loadingGeneration) status(error instanceof Error ? error.message : String(error), true);
}
async function loadExample(name: NonNullable<typeof lastExample>) {
  const generation = ++loadingGeneration;
  status('Loading example…');
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
el('clear').addEventListener('click', () => choose(null, false, 'list'));
el('frame').addEventListener('click', () => viewer.frame(selected));
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
el('viewer').addEventListener('dragover', (event) => event.preventDefault());
el('viewer').addEventListener('drop', (event) => {
  event.preventDefault(); const files = [...(event as DragEvent).dataTransfer?.files ?? []];
  if (files.length) void loadFiles(files);
});
if (import.meta.hot) import.meta.hot.dispose(() => viewer.dispose());
