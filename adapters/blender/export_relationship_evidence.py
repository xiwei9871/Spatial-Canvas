"""Read-only relationship evidence: native hierarchy/group membership and evaluated bounds."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import bpy
from mathutils import Vector


def export_evidence(source, names=None):
    source=Path(source).resolve()
    before=source.read_bytes();stat=source.stat()
    bpy.ops.wm.open_mainfile(filepath=str(source))
    depsgraph=bpy.context.evaluated_depsgraph_get()
    requested=set(names) if names else None
    if requested and requested-set(bpy.data.objects.keys()):
        raise ValueError('Requested native IDs not present: '+str(sorted(requested-set(bpy.data.objects.keys()))))
    objects=[]
    for obj in bpy.context.scene.objects:
        if requested and obj.name not in requested: continue
        evaluated=obj.evaluated_get(depsgraph)
        points=[evaluated.matrix_world@Vector(p) for p in evaluated.bound_box] if obj.type=='MESH' else []
        parent_chain=[];parent=obj.parent
        while parent:
            parent_chain.append(parent.name);parent=parent.parent
        objects.append({'native_id':obj.name,'type':obj.type,'parent':obj.parent.name if obj.parent else None,'parent_chain':parent_chain,
            'collections':[c.name for c in obj.users_collection], 'visible':obj.visible_get(),
            'world_aabb':[[min(p[i] for p in points) for i in range(3)],[max(p[i] for p in points) for i in range(3)]] if points else None})
    if source.read_bytes()!=before or source.stat().st_mtime_ns!=stat.st_mtime_ns:
        raise RuntimeError('Frozen source integrity changed')
    return {'schema':'spatial-canvas.relationship-evidence.v1','source_locator':str(source),'source_sha256':hashlib.sha256(before).hexdigest(),
        'frame':{'coordinate_frame':'blender_source_world','unit':'scene_unit','up_axis':'Z','meters_per_unit':bpy.context.scene.unit_settings.scale_length},
        'objects':objects,'physical_connections':[],
        'diagnostics':['Native parent/collection membership does not establish physical connection. Evaluated AABBs support review candidates only.'],
        'source_byte_for_byte_unchanged':True,'source_mtime_unchanged':True}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',required=True);parser.add_argument('--names',nargs='*');parser.add_argument('--output',required=True)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    output=Path(args.output).resolve();source=Path(args.source).resolve()
    if output==source or output.exists():parser.error('Output must be a new evidence path, never an input/previous artifact.')
    report=export_evidence(source,args.names)
    output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'objects':len(report['objects']),'source_sha256':report['source_sha256'],'source_unchanged':True}))


if __name__=='__main__':main()
