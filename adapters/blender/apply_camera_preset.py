"""Apply view-only camera/visibility state to a separate render snapshot; never save the input source."""
import argparse, json, math, sys, hashlib
from pathlib import Path
import bpy
from mathutils import Quaternion
sys.path.insert(0,str(Path(__file__).resolve().parent))
from camera_preset import validate_camera_preset
from contracts import ProtocolError
from bindings import validate_registry
from common import file_sha256, scene_metadata, authoritative_mapping, write_json

def apply_camera_preset(preset,source,bindings_path=None):
 p=validate_camera_preset(preset);source=Path(source).resolve()
 if file_sha256(source)!=p['source_sha256']:raise ProtocolError('Source hash mismatch')
 if p.get('source_locator') and Path(p['source_locator']).resolve()!=source:raise ProtocolError('Source locator mismatch')
 bpy.ops.wm.open_mainfile(filepath=str(source))
 if p.get('bindings'):
  reference=p['bindings'];registry_path=Path(bindings_path or reference['locator']).resolve()
  raw=registry_path.read_bytes()
  if hashlib.sha256(raw).hexdigest()!=reference['sha256']:raise ProtocolError('Bindings hash mismatch')
  registry=validate_registry(json.loads(raw))
  for field in ['design_id','source_resource_id','source_revision','source_sha256']:
   if registry[field]!=p[field]:raise ProtocolError('Preset/registry '+field+' mismatch')
  if Path(registry['source_locator']).resolve()!=source or registry['registry_id']!=reference['registry_id'] or registry['registry_revision']!=reference['registry_revision']:raise ProtocolError('Bindings provenance mismatch')
  frame=registry.get('source_frame',{})
  scale=frame.get('meters_per_unit');frame_id=frame.get('frame_id')
  mapping={item['entity_id']:bpy.data.objects.get(item['native_id']) for item in registry['bindings'] if item['adapter']=='blender'}
 else:
  metadata=scene_metadata()
  for field in ['design_id','source_resource_id','source_revision']:
   if metadata[field]!=p[field]:raise ProtocolError('Preset/source '+field+' mismatch')
  scale=metadata['source_unit_scale'];frame_id=metadata['coordinate_frame'];mapping=authoritative_mapping()
 if not isinstance(scale,(int,float)) or not math.isfinite(scale) or scale<=0 or abs(bpy.context.scene.unit_settings.scale_length-scale)>1e-7:raise ProtocolError('Source scale mismatch')
 if frame_id!=p['source_camera']['frame_id']:raise ProtocolError('Source coordinate frame mismatch')
 for gid in p['hidden_entity_ids']+p['ghost_entity_ids']:
  if mapping.get(gid) is None:raise ProtocolError('Unknown override entity: '+gid)
 # All source/identity validation precedes camera/material/visibility modifications.
 scene=bpy.context.scene;data=bpy.data.cameras.new('SC_VIEW_'+p['preset_id']);camera=bpy.data.objects.new(data.name,data);scene.collection.objects.link(camera)
 camera.location=[v/scale for v in p['source_camera']['position']]
 x,y,z,w=p['source_camera']['quaternion'];camera.rotation_mode='QUATERNION';camera.rotation_quaternion=Quaternion((w,x,y,z))
 data.type='PERSP';data.sensor_fit='VERTICAL';data.sensor_height=24;data.lens=24/(2*math.tan(math.radians(p['fov_degrees'])/2))
 data.clip_start=p.get('near',.01)/scale;data.clip_end=p.get('far',10000)/scale
 scene.camera=camera;scene.render.resolution_x=round(p['viewport']['width']);scene.render.resolution_y=round(p['viewport']['height']);scene.render.resolution_percentage=100;scene.render.pixel_aspect_x=1;scene.render.pixel_aspect_y=1
 for gid in p['hidden_entity_ids']:
  root=mapping[gid]
  for obj in [root,*root.children_recursive]:obj.hide_render=True;obj.hide_set(True)
 for gid in p['ghost_entity_ids']:
  root=mapping[gid]
  for obj in [root,*root.children_recursive]:
   if obj.type!='MESH':continue
   for slot in obj.material_slots:
    if slot.material is None:continue
    material=slot.material.copy();slot.link="OBJECT";slot.material=material
    color=list(material.diffuse_color);color[3]=.2;material.diffuse_color=color
    if hasattr(material,'surface_render_method'):material.surface_render_method='DITHERED'
    if material.node_tree:
     for node in material.node_tree.nodes:
      if node.type=='BSDF_PRINCIPLED':
       alpha=node.inputs.get('Alpha')
       for link in list(alpha.links):material.node_tree.links.remove(link)
       alpha.default_value=.2
 bpy.context.view_layer.update()
 return {'status':'view_applied_read_only','preset_id':p['preset_id'],'camera_object':camera.name,'source_sha256':p['source_sha256'],'resolution':[scene.render.resolution_x,scene.render.resolution_y],'hidden_entity_ids':p['hidden_entity_ids'],'ghost_entity_ids':p['ghost_entity_ids']}

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--preset',required=True);parser.add_argument('--bindings');parser.add_argument('--output',help='Separate derived .blend snapshot, never original source')
 parser.add_argument('--render',help='Optional PNG preview');parser.add_argument('--report',required=True)
 args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
 source=Path(bpy.data.filepath).resolve();preset_path=Path(args.preset).resolve()
 p=json.loads(preset_path.read_text());protected={source,preset_path}
 if p.get('bindings'):protected.add(Path(args.bindings or p['bindings']['locator']).resolve())
 for name,suffix in [(args.output,'.blend'),(args.render,'.png'),(args.report,'.json')]:
  if name:
   path=Path(name).resolve()
   if path in protected or path.suffix!=suffix or path.exists():raise ProtocolError('Output must be new, separate '+suffix+' path')
 before=(file_sha256(source),source.stat().st_mtime_ns)
 result=apply_camera_preset(p,source,args.bindings)
 if args.output:bpy.ops.wm.save_as_mainfile(filepath=str(Path(args.output).resolve()),copy=True)
 if args.render:
  try:bpy.context.scene.render.engine='BLENDER_EEVEE'
  except TypeError:bpy.context.scene.render.engine='BLENDER_EEVEE_NEXT'
  if hasattr(bpy.context.scene,'eevee'):bpy.context.scene.eevee.taa_render_samples=16
  bpy.context.scene.render.filepath=str(Path(args.render).resolve());bpy.context.scene.render.image_settings.file_format='PNG';bpy.ops.render.render(write_still=True)
 if (file_sha256(source),source.stat().st_mtime_ns)!=before:raise ProtocolError('Source changed unexpectedly')
 write_json(args.report,result);print(json.dumps(result))
if __name__=='__main__':main()
