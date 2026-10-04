"""Resolve a frozen context packet to exact source objects. Read-only evidence utility, never an executor."""
import argparse
import json
import hashlib
from pathlib import Path
import sys

import bpy
sys.path.insert(0,str(Path(__file__).resolve().parent))
from bindings import validate_registry
from common import file_sha256,write_json
from contracts import ProtocolError

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--packet",required=True)
    parser.add_argument("--output",required=True)
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    packet_path=Path(args.packet).resolve()
    packet=json.loads(packet_path.read_text())
    if packet.get("schema")!="spatial-canvas.context.v1" or packet["source"]["authority"]!="frozen":
        raise ProtocolError("This resolver accepts frozen context packets only")
    source=Path(packet["source"]["locator"]).resolve()
    reference=packet["source"]["bindings"]
    registry_path=Path(reference["locator"]).resolve()
    output=Path(args.output).resolve()
    if output.suffix!=".json" or output in [source,packet_path,registry_path]:
        raise ProtocolError("Evidence output must be a separate JSON file")
    expected=packet["source"]["sha256"]
    before=source.stat()
    registry_raw=registry_path.read_bytes()
    if file_sha256(source)!=expected or hashlib.sha256(registry_raw).hexdigest()!=reference["sha256"]:
        raise ProtocolError("Context source or registry SHA mismatch")
    registry=validate_registry(json.loads(registry_raw))
    if (Path(registry["source_locator"]).resolve()!=source or registry["source_sha256"]!=expected or registry["source_revision"]!=packet["source"]["revision"] or
        registry["source_resource_id"]!=packet["source"]["resource_id"] or
        registry["design_id"]!=packet["resource"]["design_id"] or
        registry["registry_id"]!=reference["registry_id"] or registry["registry_revision"]!=reference["registry_revision"]):
        raise ProtocolError("Context/registry provenance mismatch")
    if (packet["selection"]["design_id"]!=registry["design_id"] or
        packet["selection"]["source_revision"]!=registry["source_revision"] or
        packet["selection"]["resource_id"]!=packet["resource"]["resource_id"] or
        packet["selection"]["entity_ids"]!=[entity["global_id"] for entity in packet["entities"]]):
        raise ProtocolError("Context selection mismatch")
    bindings={binding["entity_id"]:binding for binding in registry["bindings"]}
    bpy.ops.wm.open_mainfile(filepath=str(source))
    resolved=[]
    for entity in packet["entities"]:
        if (entity["design_id"]!=registry["design_id"] or entity["source_resource_id"]!=registry["source_resource_id"]
            or entity["source_revision"]!=registry["source_revision"] or entity.get("mutable") is not False):
            raise ProtocolError("Context entity provenance mismatch")
        binding=bindings.get(entity["global_id"])
        if not binding or binding["adapter"]!="blender" or binding["native_id"]!=entity["native_object_id"]:
            raise ProtocolError("Context identity disagrees with sidecar")
        obj=bpy.data.objects.get(binding["native_id"])
        if obj is None:raise ProtocolError("Native object missing")
        evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        points=[evaluated.matrix_world @ vertex.co for vertex in evaluated.data.vertices]
        lo=[min(point[axis] for point in points) for axis in range(3)]
        hi=[max(point[axis] for point in points) for axis in range(3)]
        hit=packet.get("hit")
        if hit and hit["entity_id"]==entity["global_id"]:
            source_hit=hit["source"]
            if source_hit["frame_id"]!=registry["source_frame"]["frame_id"]:
                raise ProtocolError("Hit source frame mismatch")
            xyz=source_hit["xyz"]
            if not all(lo[i]-1e-4<=xyz[i]<=hi[i]+1e-4 for i in range(3)):
                raise ProtocolError("Hit is outside authoritative object bounds")
        resolved.append({"entity_id":entity["global_id"],"native_id":obj.name,"source_world_bounds":{"min":lo,"max":hi}})
    if file_sha256(source)!=expected or source.stat().st_mtime_ns!=before.st_mtime_ns or file_sha256(registry_path)!=reference["sha256"]:
        raise ProtocolError("Frozen source changed during resolution")
    write_json(output,{"status":"resolved_read_only","source_locator":str(source),"source_sha256":expected,"resolved":resolved})
    print(json.dumps({"status":"resolved_read_only","native_ids":[entry["native_id"] for entry in resolved]}))

if __name__=="__main__":main()
