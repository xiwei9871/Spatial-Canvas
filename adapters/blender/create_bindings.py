"""Deliberately initialize sidecar IDs from a saved source; NEVER save or annotate the .blend."""
import argparse
import json
from pathlib import Path
import sys
import uuid

import bpy
sys.path.insert(0,str(Path(__file__).resolve().parent))
from bindings import validate_registry
from common import eligible_objects,file_sha256,write_json
from contracts import ProtocolError,unit_scale

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",required=True)
    parser.add_argument("--design-id",required=True)
    parser.add_argument("--source-resource-id",required=True)
    parser.add_argument("--source-revision",required=True)
    parser.add_argument("--expected-sha256",required=True)
    parser.add_argument("--frame-id",required=True)
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    source=Path(bpy.data.filepath).resolve()
    output=Path(args.output).resolve()
    if output.exists():
        raise ProtocolError("Registry already exists; edit/version explicitly instead of regenerating identities")
    if output.suffix!=".json" or output==source:
        raise ProtocolError("Sidecar must be a separate JSON file")
    before=source.stat()
    if file_sha256(source)!=args.expected_sha256:
        raise ProtocolError("Frozen source SHA mismatch")
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scale=unit_scale(bpy.context.scene.unit_settings.scale_length)
    registry={
      "schema":"spatial-canvas.bindings.v1","registry_id":"bindings_"+uuid.uuid4().hex,"registry_revision":"1",
      "design_id":args.design_id,"source_resource_id":args.source_resource_id,"source_revision":args.source_revision,
      "source_sha256":args.expected_sha256,"source_locator":str(source),"source_authority":"frozen",
      "source_frame":{"frame_id":args.frame_id,"unit":{1.0:"meter",.01:"centimeter",.001:"millimeter"}.get(scale,"scene_unit"),
                      "up_axis":"Z","meters_per_unit":scale},
      "bindings":[{"entity_id":"ent_"+uuid.uuid4().hex,"adapter":"blender","native_id":obj.name,
                   "semantic_type":"unassigned","room_id":"unassigned","authority_level":"HUMAN_DESIGN_GUIDE"}
                  for obj in eligible_objects()],
    }
    validate_registry(registry)
    if file_sha256(source)!=args.expected_sha256 or source.stat().st_mtime_ns!=before.st_mtime_ns:
        raise ProtocolError("Frozen source changed during sidecar initialization")
    write_json(output,registry)
    inventory=[{"native_id":obj.name,"type":obj.type,"world_xyz":list(obj.matrix_world.translation),
                "collections":[collection.name for collection in obj.users_collection]}
               for obj in eligible_objects()]
    write_json(output.with_name(output.stem+".inventory.json"),inventory)
    print(json.dumps({"registry":str(output),"bindings":len(registry["bindings"]),"source_sha256":args.expected_sha256}))

if __name__=="__main__":main()
