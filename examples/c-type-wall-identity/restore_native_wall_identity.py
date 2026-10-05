"""Recover original Blender wall grouping on the exact R4 rendered surface, in a derived review copy."""
import argparse,bpy,json,hashlib,sys,uuid,re,collections
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).parent))
import struct
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def bounds(obj):
 points=[obj.matrix_world@Vector(v) for v in obj.bound_box]
 return [[min(p[i] for p in points) for i in range(3)],[max(p[i] for p in points) for i in range(3)]]
def object_state(obj):
 mesh=None
 if obj.type=='MESH':
  h=hashlib.sha256()
  for v in obj.data.vertices:h.update(struct.pack('<fff',*v.co))
  for f in obj.data.polygons:h.update(struct.pack('<'+str(len(f.vertices))+'I',*f.vertices))
  mesh=h.hexdigest()
 return {'mesh':mesh,'matrix':[v for row in obj.matrix_world for v in row],'parent':obj.parent.name if obj.parent else None,'collections':sorted(c.name for c in obj.users_collection),'hide_render':obj.hide_render,'hide_viewport':obj.hide_viewport,'hidden':obj.hide_get(),'materials':[m.name if m else None for m in obj.data.materials] if obj.type=='MESH' else None,'properties':str(sorted(obj.items()))}

from wall_surface_partition import polygon_area,partition_box

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--project-root',required=True,help='Local C-Type project directory containing design/ frozen inputs')
parser.add_argument('--out-dir',required=True,help='New output directory for derived review files')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
project=Path(args.project_root).resolve()
source=project/'design/dining_chairs_r4_review/OPTION_A_R4_DINING_CHAIRS_ALIGNED_REVIEW.blend'
root=Path(args.out_dir).resolve();assert not root.exists(),'Use a new output directory';root.mkdir(parents=True)
output=root/'OPTION_A_R4_NATIVE_WALL_PARTS_REVIEW.blend'
assert not output.exists() and sha(source)=='e2f3f107eb6619ae28a363e0e4e36019cdae94c89aabe9ac4b8c0c07b14b14ac'
registry=json.loads((source.parent/'spatial-canvas.bindings.json').read_text())
old_bindings={x['native_id']:x for x in registry['bindings']}
snapshot=json.loads((project/'design/kitchen_divider_r4_review/PIER_AND_AC_QA.json').read_text())
historical_root=Path(snapshot['source']).parents[2]
frozen={}
for name,metadata in snapshot['frozen_files_unchanged'].items():
 relative=Path(name).relative_to(historical_root)
 target=project/relative
 assert sha(target)==metadata['sha256'] and target.stat().st_size==metadata['size'],str(target)
 frozen[str(target)]={**metadata,'mtime_ns':str(target.stat().st_mtime_ns)}

frozen[str(source)]={'sha256':sha(source),'size':source.stat().st_size,'mtime_ns':str(source.stat().st_mtime_ns)}
def check_sources():
 for name,v in frozen.items():
  p=Path(name);assert sha(p)==v['sha256'] and p.stat().st_size==v['size'] and str(p.stat().st_mtime_ns)==v['mtime_ns'],name
check_sources();bpy.ops.wm.open_mainfile(filepath=str(source))
prior={o.name:object_state(o) for o in bpy.context.scene.objects}
collection=bpy.data.collections.new('COL_R4_NATIVE_WALL_VIEW_PARTS');bpy.context.scene.collection.children.link(collection)
wall_inputs={
 'R3_HOUSE_WALLS_D107_ROLLED_BACK':project/'design/secondary_bath_options/r3/HOUSE_ROLLBACK_WALL_INPUT.json',
 'R3_COMPLETE_PARTITION_WALLS':project/'design/secondary_bath_options/r3/A_WALL_INPUT.json'}
index=[];new_bindings=[];summaries=[]
for parent_name,input_path in wall_inputs.items():
 parent=bpy.data.objects[parent_name];parent_gid=old_bindings[parent_name]['entity_id'];refs=[]
 for w in json.loads(input_path.read_text())['walls']:
  if w['name']=='NON_GEOMETRIC_ORIGINAL_HEIGHT_LEVELS':continue
  verts=w['vertices'];lo=tuple(min(v[i] for v in verts)-.002 for i in range(3));hi=tuple(max(v[i] for v in verts)+.002 for i in range(3))
  ref=w['name'].removeprefix('V4_INPUT_')
  match=re.search(r'W_wall_md_\d+',ref)
  group=match.group() if match else ref
  if parent_name=='R3_COMPLETE_PARTITION_WALLS':group='R3_WEST_PARTITION' if ref=='NEW_FC_WEST_PARTITION' else 'R3_SOUTH_POCKET_PARTITION'
  refs.append({'ref':ref,'group':group,'lo':lo,'hi':hi,'volume':(hi[0]-lo[0])*(hi[1]-lo[1])*(hi[2]-lo[2])})
 groups=collections.defaultdict(list);group_refs=collections.defaultdict(set);source_area=0;outside_area=0;part_count=0
 parent.data.calc_loop_triangles()
 for triangle in parent.data.loop_triangles:
  poly=[tuple(parent.matrix_world@parent.data.vertices[i].co) for i in triangle.vertices]
  area=polygon_area(poly);source_area+=area
  lo=tuple(min(v[i] for v in poly) for i in range(3));hi=tuple(max(v[i] for v in poly) for i in range(3))
  candidates=[w for w in refs if all(lo[i]<=w['hi'][i] and hi[i]>=w['lo'][i] for i in range(3))]
  candidates.sort(key=lambda w:(w['volume'],w['ref']))
  contained=[w for w in candidates if all(w['lo'][i]<=v[i]<=w['hi'][i] for v in poly for i in range(3))]
  if contained:
   w=contained[0];groups[w['group']].append(poly);group_refs[w['group']].add(w['ref']);continue
  remainder=[poly];fragments=[]
  for w in candidates:
   pending=[]
   for part in remainder:
    inside,outside=partition_box(part,w['lo'],w['hi'])
    if inside:groups[w['group']].append(inside);group_refs[w['group']].add(w['ref']);fragments.append(inside);part_count+=1
    pending.extend(outside)
   remainder=pending
   if not remainder:break
  residual=sum(polygon_area(p) for p in remainder);outside_area+=residual
  if residual>1e-10:
   # Keep any historical junction surface explicitly separate rather than dropping or guessing it.
   label='SOURCE_JUNCTION_FACE_'+str(triangle.polygon_index)
   groups[label].extend(remainder);group_refs[label].add(parent_name+':face:'+str(triangle.polygon_index))
  assert abs(area-sum(polygon_area(p) for p in fragments+remainder))<max(1e-8,area*1e-6)
 output_area=0
 for group,polygons in sorted(groups.items()):
  if sum(polygon_area(p) for p in polygons)<1e-12:continue
  native='VIEW_WALL_'+group;verts=[];faces=[];lookup={}
  for poly in polygons:
   face=[]
   for point in poly:
    key=tuple(round(v,8) for v in point)
    if key not in lookup:lookup[key]=len(verts);verts.append(point)
    face.append(lookup[key])
   if len(set(face))>=3:faces.append(face)
  mesh=bpy.data.meshes.new(native+'_MESH');mesh.from_pydata(verts,[],faces);mesh.update()
  obj=bpy.data.objects.new(native,mesh);collection.objects.link(obj)
  for m in parent.data.materials:mesh.materials.append(m)
  gid='ent_'+uuid.uuid5(uuid.NAMESPACE_URL,'c_type_home:wall-part:v1:'+parent_gid+':'+group).hex
  obj['source_render_wall']=parent_name;obj['source_parent_entity_id']=parent_gid;obj['original_blender_wall_inputs']=json.dumps(sorted(group_refs[group]));obj['review_status']='HUMAN_REVIEW_VIEW_IDENTITY_ONLY';obj['surface_partition_not_new_construction_solid']=True
  new_bindings.append({'entity_id':gid,'adapter':'blender','native_id':native,'semantic_type':'wall','room_id':'unassigned','authority_level':'HUMAN_DESIGN_GUIDE'})
  mesh_area=sum(p.area for p in mesh.polygons);output_area+=mesh_area
  index.append({'entity_id':gid,'native_id':native,'parent_entity_id':parent_gid,'parent_native_id':parent_name,'source_inputs':sorted(group_refs[group]),'source_input_file':str(input_path),'source_input_sha256':sha(input_path),'world_bounds':bounds(obj),'surface_area_m2':mesh_area})
 assert abs(source_area-output_area)<max(1e-5,source_area*1e-6),(source_area,output_area)
 parent.hide_render=True;parent.hide_viewport=True;parent.hide_set(True)
 summaries.append({'parent':parent_name,'source_triangles':len(parent.data.loop_triangles),'source_area_m2':source_area,'partition_area_m2':output_area,'wall_parts':len(groups),'junction_residual_area_m2':outside_area,'cross_boundary_fragments':part_count})
for name,state in prior.items():
 now=object_state(bpy.data.objects[name])
 if name in wall_inputs:
  assert all(now[k]==v for k,v in state.items() if k not in ['hide_render','hide_viewport','hidden'])
 else:assert now==state,name
registry['bindings']=[b for b in registry['bindings'] if b['native_id'] not in wall_inputs]+new_bindings
registry.update(registry_revision='8-native-wall-view-parts',source_resource_id='c_type_r4_walls_review',source_revision='r4-walls-view-review-1',source_locator=str(output))
bpy.ops.wm.save_as_mainfile(filepath=str(output))
registry['source_sha256']=sha(output)
(root/'spatial-canvas.bindings.json').write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n')
(root/'WALL_PART_INDEX.json').write_text(json.dumps({'status':'DERIVED_VIEW_PARTS','parent_source':str(source),'parent_source_sha256':sha(source),'parts':index,'legacy_wall_parent_ids':[old_bindings[n]['entity_id'] for n in wall_inputs]},ensure_ascii=False,indent=2)+'\n')
after={o.name:object_state(o) for o in bpy.context.scene.objects}
bpy.ops.wm.open_mainfile(filepath=str(output))
assert all(object_state(bpy.data.objects[n])==v for n,v in after.items())
check_sources()
report={'status':'HUMAN_REVIEW','output':str(output),'sha256':sha(output),'wall_summaries':summaries,'new_wall_part_count':len(index),'retained_other_entity_ids':len(registry['bindings'])-len(index),'entity_count':len(registry['bindings']),'all_other_object_states_unchanged':True,'source_wall_geometry_unchanged':True,'aggregate_wall_surface_area_preserved':True,'fresh_reopen_verified':True,'frozen_files_unchanged':frozen}
(root/'WALL_PARTS_QA.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False))
