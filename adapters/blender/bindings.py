"""Pure sidecar contract validation. No bpy imports and no source-file writes."""
import re
from contracts import ProtocolError, identifier, unit_scale

AUTHORITY_LEVELS = {
    "PHYSICAL_GROUND_TRUTH","SEMANTIC_GROUND_TRUTH","HUMAN_DESIGN_GUIDE","DERIVED_DESIGN_MODEL","PRESENTATION"}

def validate_registry(value):
    if not isinstance(value,dict) or value.get("schema")!="spatial-canvas.bindings.v1":
        raise ProtocolError("Unsupported bindings registry")
    for field in ["registry_id","registry_revision","design_id","source_resource_id","source_revision","source_sha256","source_locator"]:
        identifier(value.get(field),field)
    if not re.fullmatch(r"[a-f0-9]{64}",value["source_sha256"]):
        raise ProtocolError("Bindings require a full source SHA256")
    if value.get("source_authority")!="frozen":
        raise ProtocolError("Sidecar V1 supports frozen sources")
    frame=value.get("source_frame")
    if frame is not None:
        if not isinstance(frame,dict):raise ProtocolError("Invalid source frame")
        identifier(frame.get("frame_id"),"frame_id")
        if frame.get("up_axis") not in ["X","Y","Z"] or frame.get("unit") not in ["meter","centimeter","millimeter","scene_unit"]:
            raise ProtocolError("Invalid source frame")
        scale=unit_scale(frame.get("meters_per_unit"))
        units={"meter":1,"centimeter":.01,"millimeter":.001}
        if frame["unit"] in units and abs(units[frame["unit"]]-scale)>1e-8:
            raise ProtocolError("Frame unit and scale disagree")
    entries=value.get("bindings")
    if not isinstance(entries,list) or not entries:
        raise ProtocolError("Empty bindings registry")
    entities,natives=set(),set()
    for entry in entries:
        if not isinstance(entry,dict):raise ProtocolError("Invalid binding")
        for key in ["entity_id","adapter","native_id","semantic_type","room_id","authority_level"]:
            identifier(entry.get(key),key)
        if entry["authority_level"] not in AUTHORITY_LEVELS:raise ProtocolError("Unknown authority level")
        if entry["entity_id"] in entities or (entry["adapter"],entry["native_id"]) in natives:
            raise ProtocolError("Duplicate entity or native mapping")
        entities.add(entry["entity_id"])
        natives.add((entry["adapter"],entry["native_id"]))
    return value
