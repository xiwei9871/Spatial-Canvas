"""Offline authoritative adapter. Fully validate, translate world matrices, bump revision, atomically save."""
import argparse
import json
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from contracts import ProtocolError, utc_now, validate_request
from common import (PROXY_FRAME, METADATA_KEYS, atomic_save_source, authoritative_mapping, eligible_objects,
                    entity_from_object, file_sha256, next_revision, proxy_translation_to_blender,
                    scene_metadata, source_lock, write_json)


def apply_intent(intent, source_path):
    validate_request(intent)
    metadata = scene_metadata()
    new_revision = next_revision(metadata["source_revision"])
    for field, code in [("design_id", "design_mismatch"), ("source_resource_id", "source_resource_mismatch"),
                        ("source_revision", "stale_revision")]:
        if intent[field] != metadata[field]:
            raise ProtocolError(field + " mismatch", code)
    if intent["source_sha256"] != file_sha256(source_path):
        raise ProtocolError("source_sha256 mismatch", "source_hash_mismatch")
    if intent["payload"]["coordinate_frame"] != PROXY_FRAME:
        raise ProtocolError("Unknown proxy coordinate frame", "coordinate_error")
    mapping = authoritative_mapping()
    eligible = set(eligible_objects())
    resolved = []
    for target in intent["targets"]:
        obj = mapping.get(target["global_id"])
        if obj is None:
            raise ProtocolError("Unknown global_id", "unknown_global_id")
        if obj not in eligible:
            raise ProtocolError("Target is not an eligible semantic mesh", "unsupported_target")
        entity = entity_from_object(obj, metadata)
        if target["native_object_id"] != obj.name:
            raise ProtocolError("Native locator mismatch for global_id", "native_id_mismatch")
        if entity.get("mutable") is False:
            raise ProtocolError("Entity is immutable", "immutable_target")
        # Static object-mode transforms only. Constraints/drivers/animation could override saved placement.
        if obj.library or obj.constraints or obj.animation_data or obj.rigid_body or obj.parent_type != "OBJECT":
            raise ProtocolError("Target has unsupported transform controls", "unsupported_target")
        if obj.parent and abs(obj.parent.matrix_world.determinant()) < 1e-12:
            raise ProtocolError("Parent transform is singular", "coordinate_error")
        resolved.append(obj)
    bpy.context.view_layer.update()
    delta = proxy_translation_to_blender(intent["payload"]["translation"], metadata)
    before = {obj: obj.matrix_world.copy() for obj in resolved}
    desired = {obj: matrix.copy() for obj, matrix in before.items()}
    for matrix in desired.values():
        matrix.translation += delta
    # Parent first, then child; both get their requested absolute world position once.
    def depth(obj):
        result, cursor = 0, obj.parent
        while cursor:
            result += 1
            cursor = cursor.parent
        return result
    ordered = sorted(resolved, key=depth)
    try:
        for obj in ordered:
            obj.matrix_world = desired[obj]
            bpy.context.view_layer.update()
        for obj in resolved:
            if (obj.matrix_world.translation - desired[obj].translation).length > 1e-4:
                raise ProtocolError("World transform could not be applied", "coordinate_error")
        bpy.context.scene[METADATA_KEYS["source_revision"]] = new_revision
        atomic_save_source(source_path, intent["source_sha256"])
    except Exception:
        for obj in ordered:
            obj.matrix_world = before[obj]
            bpy.context.view_layer.update()
        bpy.context.scene[METADATA_KEYS["source_revision"]] = metadata["source_revision"]
        raise
    return {
        "schema": "spatial-canvas.execution-result.v1", "request_id": intent["request_id"],
        "design_id": metadata["design_id"], "source_resource_id": metadata["source_resource_id"],
        "previous_source_revision": metadata["source_revision"], "source_revision": new_revision,
        "status": "applied", "targets": [target["global_id"] for target in intent["targets"]], "timestamp": utc_now(),
    }


def failure_result(intent, status, error):
    # Explicit null context for malformed requests/sources; do not fabricate semantic identities.
    def optional(value):
        return value if isinstance(value, str) and value else None
    scene = bpy.context.scene
    targets = []
    for target in intent.get("targets", []) if isinstance(intent.get("targets"), list) else []:
        if isinstance(target, dict) and optional(target.get("global_id")) and target["global_id"] not in targets:
            targets.append(target["global_id"])
    revision = optional(scene.get(METADATA_KEYS["source_revision"]))
    return {
        "schema": "spatial-canvas.execution-result.v1", "request_id": optional(intent.get("request_id")),
        "design_id": optional(scene.get(METADATA_KEYS["design_id"])),
        "source_resource_id": optional(scene.get(METADATA_KEYS["source_resource_id"])),
        "previous_source_revision": revision, "source_revision": revision, "status": status,
        "targets": targets, "timestamp": utc_now(),
        "error": {"code": getattr(error, "code", "execution_error"), "message": str(error) or type(error).__name__},
    }

def execute_saved_intent(intent, source):
    """CLI transaction: lock, reload the actual source bytes, validate, execute and commit."""
    with source_lock(source):
        bpy.ops.wm.open_mainfile(filepath=str(source))
        return apply_intent(intent, str(source))


def main():
    parser = argparse.ArgumentParser(description="Execute a saved request-only intent against authoritative .blend")
    parser.add_argument("--intent", required=True)
    parser.add_argument("--result", required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    source = Path(bpy.data.filepath).resolve()
    result_path = Path(args.result).resolve()
    # Never overwrite source/intent while emitting acknowledgements.
    if result_path.suffix != ".json" or result_path in [source, Path(args.intent).resolve()]:
        raise ProtocolError("--result must be a separate .json file")
    intent = {}
    try:
        intent = json.loads(Path(args.intent).read_text(encoding="utf8"))
        if not isinstance(intent, dict):
            raise ProtocolError("Intent JSON must be an object")
        if not source.is_file():
            raise ProtocolError("Load a saved source .blend")
        result = execute_saved_intent(intent, source)
    except Exception as error:
        status = "rejected" if isinstance(error, (ProtocolError, json.JSONDecodeError)) else "error"
        result = failure_result(intent if isinstance(intent, dict) else {}, status, error)
        write_json(result_path, result)
        print("SPATIAL_CANVAS_" + status.upper() + "=" + str(error), file=sys.stderr)
        raise SystemExit(2 if status == "rejected" else 1)
    write_json(result_path, result)
    print("SPATIAL_CANVAS_APPLIED=" + str(result))


if __name__ == "__main__":
    main()
