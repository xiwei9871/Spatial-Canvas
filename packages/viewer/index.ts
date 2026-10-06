import { ACESFilmicToneMapping, AmbientLight, Box3, Box3Helper, Color, DirectionalLight, GridHelper, Group, Matrix3, Mesh, PerspectiveCamera, Raycaster, Scene, Vector2, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { preflightGlb } from '../protocol/glb';
import type { Manifest } from '../protocol/index';
import type { CameraView, ContextHit } from '../protocol/context';
import type { ViewPreset } from '../protocol/view-preset';
import {sourceCameraPose} from '../core/view-camera';
import { disposeScene, indexScene } from './scene';
import type { Object3D } from 'three';

export async function loadProxy(buffer: ArrayBuffer, manifest: Manifest) {
  preflightGlb(buffer, manifest);
  const gltf = await new GLTFLoader().parseAsync(buffer, '');
  try { return { root: gltf.scene, ...indexScene(gltf.scene, manifest) }; }
  catch (error) { disposeScene(gltf.scene); throw error; }
}
export type LoadedProxy = Awaited<ReturnType<typeof loadProxy>>;

export class ProxyViewer {
  private readonly renderer = new WebGLRenderer({ antialias: true });
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(45, 1, 0.01, 10000);
  private readonly controls: OrbitControls;
  private readonly highlights = new Group();
  private readonly raycaster = new Raycaster();
  private current?: LoadedProxy;
  private down?: { x: number; y: number };
  private readonly resize: ResizeObserver;
  private viewLocked=false;
  private heldAspect:number|undefined;
  private heldViewport:CameraView['viewport']|undefined;
  private readonly originalVisibility=new Map<Object3D,boolean>();
  private readonly originalMaterials=new Map<Mesh,Mesh['material']>();

  constructor(private readonly host: HTMLElement, onSelect: (id: string | null, additive: boolean, hit:ContextHit|null) => void) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping=ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1;
    this.scene.background = new Color('#e9eeed');
    this.renderer.domElement.setAttribute('aria-label', '3D interaction proxy');
    this.renderer.domElement.tabIndex = 0;
    host.append(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.camera.position.set(5, 4, 6);
    this.scene.add(new AmbientLight(0xffffff, .85));
    const light = new DirectionalLight(0xffffff, 2);
    light.position.set(3, 7, 4);
    this.scene.add(light, new GridHelper(20, 20, '#a9b9b6', '#cdd6d4'), this.highlights);
    this.resize = new ResizeObserver(() => this.resizeToHost());
    this.resize.observe(host);
    this.renderer.setAnimationLoop(() => { if(!this.viewLocked)this.controls.update(); this.renderer.render(this.scene, this.camera); });
    this.renderer.domElement.addEventListener('pointerdown', (event) => {
      if (event.button === 0) this.down = { x: event.clientX, y: event.clientY };
    });
    this.renderer.domElement.addEventListener('pointercancel', () => { this.down = undefined; });
    this.renderer.domElement.addEventListener('pointerup', (event) => {
      const down = this.down;
      this.down = undefined;
      if (!down || event.button !== 0 || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5 || !this.current) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      const pointer = new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      this.raycaster.setFromCamera(pointer, this.camera);
      const meshes=[...this.current.meshEntities.keys()].filter(mesh=>{let cursor:Object3D|null=mesh;while(cursor){if(!cursor.visible)return false;cursor=cursor.parent;}return true;});
      const hit = this.raycaster.intersectObjects(meshes, false)[0];
      const id=hit ? this.current.meshEntities.get(hit.object as Mesh)?.global_id ?? null : null;
      const point=hit&&id?{entity_id:id,xyz:hit.point.toArray() as [number,number,number],
        frame_id:this.coordinateFrame,unit:'meter' as const,
        ...(hit.face?{normal:hit.face.normal.clone().applyMatrix3(new Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize().toArray() as [number,number,number]}:{})}:null;
      onSelect(id,event.shiftKey||event.ctrlKey||event.metaKey,point);
    });
  }
  private coordinateFrame='proxy_world';
  viewSnapshot(frameId:string):CameraView {
    return {
      projection:'perspective',fov_degrees:this.camera.fov,near:this.camera.near,far:this.camera.far,
      position:this.camera.position.toArray(),quaternion:this.camera.quaternion.toArray(),
      projection_matrix:this.camera.projectionMatrix.toArray(),orbit_target:this.controls.target.toArray(),
      viewport:this.heldViewport??{width:this.renderer.domElement.clientWidth,height:this.renderer.domElement.clientHeight,
        pixel_ratio:this.renderer.getPixelRatio()},
      frame_id:frameId,unit:'meter',up_axis:'Y',
    };
  }

  viewPreset(manifest:Manifest,presetId:string,hidden_entity_ids:string[]=[],ghost_entity_ids:string[]=[]):ViewPreset {
    const view=this.viewSnapshot(manifest.coordinate_frame);
    if(manifest.source_frame?.up_axis!=='Z')throw new Error('Source-space camera export requires declared Blender Z-up source frame.');
    const extension=manifest.extensions?.['spatial_canvas.blender'] as {bindings?:ViewPreset['bindings']}|undefined;
    return {...view,schema:'spatial-canvas.view-preset.v1',preset_id:presetId,design_id:manifest.design_id,source_resource_id:manifest.source_resource_id,source_revision:manifest.source_revision,source_sha256:manifest.source_sha256,source_locator:manifest.source_resource,bindings:extension?.bindings,preview_uri:presetId+'.png',source_camera:sourceCameraPose(view,manifest.source_frame.coordinate_frame),hidden_entity_ids,ghost_entity_ids};
  }
  restoreView(preset:ViewPreset){
    this.controls.enabled=false;
    this.controls.enableDamping=false;this.controls.update();
    this.camera.position.fromArray(preset.position);
    this.controls.target.fromArray(preset.orbit_target);
    this.camera.fov=preset.fov_degrees;
    this.camera.near=preset.near??.01;this.camera.far=preset.far??10000;
    this.controls.update();this.camera.quaternion.fromArray(preset.quaternion);
    this.controls.enableDamping=true;
    this.viewLocked=true;this.heldViewport=structuredClone(preset.viewport);this.heldAspect=preset.viewport.width/preset.viewport.height;this.resizeToHost();
    this.applyVisibility(preset.hidden_entity_ids,preset.ghost_entity_ids);
  }
  private resizeToHost(){
    const aspect=this.heldAspect??this.host.clientWidth/Math.max(this.host.clientHeight,1);
    const width=Math.min(this.host.clientWidth,this.host.clientHeight*aspect),height=width/aspect;
    this.renderer.setSize(width,height);this.camera.aspect=aspect;this.camera.updateProjectionMatrix();
  }
  screenshotDataUrl(){
    const visible=this.highlights.visible;this.highlights.visible=false;
    this.renderer.render(this.scene,this.camera);
    const data=this.renderer.domElement.toDataURL('image/png');
    this.highlights.visible=visible;
    return data;
  }

  setViewLocked(locked:boolean) { this.heldViewport=locked?this.viewSnapshot(this.coordinateFrame).viewport:undefined;this.viewLocked=locked;this.heldAspect=locked?this.camera.aspect:undefined;this.controls.enabled=!locked;this.resizeToHost(); }
  get isViewLocked(){return this.viewLocked;}
  applyVisibility(hiddenIds:readonly string[],ghostIds:readonly string[]) {
    this.restoreVisibility();
    for(const id of hiddenIds){const object=this.current?.objects.get(id);if(object){this.originalVisibility.set(object,object.visible);object.visible=false;}}
    for(const id of ghostIds){const object=this.current?.objects.get(id);if(object){object.traverse(child=>{if(!(child instanceof Mesh)||this.originalMaterials.has(child))return;this.originalMaterials.set(child,child.material);const mats=(Array.isArray(child.material)?child.material:[child.material]).map(m=>{const clone=m.clone();clone.transparent=true;clone.opacity=.2;clone.depthWrite=false;return clone;});child.material=Array.isArray(child.material)?mats:mats[0]!;});}}
  }
  restoreVisibility(){
    for(const [object,visible] of this.originalVisibility){object.visible=visible;}this.originalVisibility.clear();
    for(const [mesh,material] of this.originalMaterials){for(const clone of Array.isArray(mesh.material)?mesh.material:[mesh.material])clone.dispose();mesh.material=material;}this.originalMaterials.clear();
  }

  setProxy(proxy: LoadedProxy, frameId='proxy_world') {
    this.setViewLocked(false);
    this.restoreVisibility();
    this.clearHighlights();
    if (this.current) { this.scene.remove(this.current.root); disposeScene(this.current.root); }
    this.current = proxy;
    this.coordinateFrame=frameId;
    this.scene.add(proxy.root);
    this.frame([]);
  }

  highlight(ids: readonly string[]) {
    this.clearHighlights();
    for (const id of ids) {
      const object = this.current?.objects.get(id);
      if (object) this.highlights.add(new Box3Helper(new Box3().setFromObject(object), '#e39b22'));
    }
  }

  frame(ids: readonly string[]) {
    if (!this.current || this.viewLocked) return;
    const bounds = new Box3();
    if (ids.length) {
      for (const id of ids) { const object = this.current.objects.get(id); if (object) bounds.expandByObject(object); }
    } else bounds.setFromObject(this.current.root);
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new Vector3());
    const size = Math.max(bounds.getSize(new Vector3()).length(), 0.2);
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(new Vector3(0.8, 0.65, 1).normalize().multiplyScalar(size * 1.5));
    this.camera.near = Math.max(size / 1000, 0.001);
    this.camera.far = Math.max(size * 100, 100);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  private clearHighlights() {
    for (const child of [...this.highlights.children]) {
      const helper = child as Box3Helper;
      helper.geometry.dispose();
      (Array.isArray(helper.material) ? helper.material : [helper.material]).forEach((material) => material.dispose());
      this.highlights.remove(child);
    }
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.resize.disconnect();
    this.controls.dispose();
    this.clearHighlights();
    this.restoreVisibility();
    if (this.current) disposeScene(this.current.root);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
