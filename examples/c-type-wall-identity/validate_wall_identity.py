"""Read-only C-Type wall identity regression: real surface, IDs, relationships and frozen bytes."""
import argparse,json,hashlib,sys,random
from pathlib import Path
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def bounds(obj):
 points=[obj.matrix_world@Vector(v) for v in obj.bound_box]
 return [[min(p[i] for p in points) for i in range(3)],[max(p[i] for p in points) for i in range(3)]]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--review-dir',required=True);parser.add_argument('--report',required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
r=Path(args.review_dir).resolve();report=Path(args.report).resolve()
assert not report.exists(),'Report must be a new local artifact'
assert report.suffix=='.json' and report not in [r/'WALL_PART_INDEX.json',r/'WALL_PARTS_QA.json',r/'spatial-canvas.bindings.json']
index=json.loads((r/'WALL_PART_INDEX.json').read_text());qa=json.loads((r/'WALL_PARTS_QA.json').read_text())
source=Path(index['parent_source']);review=Path(qa['output']);assert sha(source)==index['parent_source_sha256'];assert sha(review)==qa['sha256']
for path,v in qa['frozen_files_unchanged'].items():
 p=Path(path);assert sha(p)==v['sha256'] and p.stat().st_size==v['size'] and str(p.stat().st_mtime_ns)==v['mtime_ns'],path
parts=index['parts'];assert len(parts)==98
old=json.loads((source.parent/'spatial-canvas.bindings.json').read_text());new=json.loads((r/'spatial-canvas.bindings.json').read_text())
oldmap={b['entity_id']:b['native_id'] for b in old['bindings']};newmap={b['entity_id']:b['native_id'] for b in new['bindings']};parents=set(index['legacy_wall_parent_ids'])
retained={k:v for k,v in oldmap.items() if k not in parents};assert len(retained)==919 and len(newmap)==1017;assert all(newmap[k]==v for k,v in retained.items())
bpy.ops.wm.open_mainfile(filepath=str(review));stats=[]
for parent_name in sorted(set(p['parent_native_id'] for p in parts)):
 parent=bpy.data.objects[parent_name];children=[bpy.data.objects[p['native_id']] for p in parts if p['parent_native_id']==parent_name]
 vertices=[];faces=[]
 for o in children:
  offset=len(vertices);vertices.extend(o.matrix_world@v.co for v in o.data.vertices);faces.extend(tuple(offset+i for i in f.vertices) for f in o.data.polygons)
 tree=BVHTree.FromPolygons(vertices,faces);parent.data.calc_loop_triangles();tris=list(parent.data.loop_triangles);rng=random.Random(1);sample=rng.sample(tris,min(1200,len(tris)));errors=[]
 for t in sample:
  point=sum((parent.matrix_world@parent.data.vertices[i].co for i in t.vertices),Vector())/3
  errors.append(tree.find_nearest(point)[3])
 original_area=sum(p.area for p in parent.data.polygons);partition_area=sum(p.area for o in children for p in o.data.polygons)
 assert abs(original_area-partition_area)<max(1e-5,original_area*1e-6)
 assert max(errors)<.0015,'Surface partition/BVH deviation exceeds documented1.5mm limit'
 stats.append({'parent':parent_name,'samples':len(sample),'max_nearest_deviation_m':max(errors),'original_area_m2':original_area,'partition_area_m2':partition_area})
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(r/'proxy/interaction_proxy.glb'))
objects={o.get('global_id'):o for o in bpy.context.scene.objects if o.get('global_id')};assert len(objects)==1017
for part in parts:
 o=objects[part['entity_id']];assert o.get('native_object_id')==part['native_id'];b=bounds(o);expected=part['world_bounds'];assert max(abs(b[i][j]-expected[i][j]) for i in range(2) for j in range(3))<2e-5
oldgraph=json.loads((source.parent/'proxy/spatial-canvas.relationships.json').read_text());graph=json.loads((r/'proxy/spatial-canvas.relationships.json').read_text());oldedges={e['edge_id']:e for e in oldgraph['edges']};newedges={e['edge_id']:e for e in graph['edges']};assert all(newedges[k]==v for k,v in oldedges.items())
added=[e for e in graph['edges'] if e['edge_id'] not in oldedges];assert len(added)==98 and all(e['type']=='part_of' for e in added)
assert all(b['room_id']=='unassigned' for b in new['bindings'] if b['entity_id'] not in retained)
for path,v in qa['frozen_files_unchanged'].items():
 p=Path(path);assert sha(p)==v['sha256'] and p.stat().st_size==v['size'] and str(p.stat().st_mtime_ns)==v['mtime_ns'],path
result={'status':'PASS','wall_parts':98,'retained_ids':919,'proxy_entities':1017,'surface_checks':stats,'aggregate_max_nearest_deviation_m':max(s['max_nearest_deviation_m'] for s in stats),'samples':sum(s['samples'] for s in stats),'added_relationship_types':['part_of'],'inherited_edges_unchanged':True,'new_room_assignment':False,'frozen_hash_size_mtime_unchanged':True}
report.parent.mkdir(parents=True,exist_ok=True);report.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
