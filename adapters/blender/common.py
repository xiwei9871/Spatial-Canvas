"""Persistent Blender identities, source metadata and atomic file helpers."""
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import tempfile
import uuid

import bpy
from mathutils import Vector
from contracts import ProtocolError, identifier, unit_scale, proxy_to_source, source_to_proxy

METADATA_KEYS = {key: "spatial_canvas_" + key for key in [
    "design_id", "source_resource_id", "source_revision", "coordinate_frame", "source_unit_scale"]}
ENTITY_KEYS = {key: "spatial_canvas_" + key for key in [
    "global_id", "semantic_type", "room_id", "authority_level", "mutable"]}
PROXY_FRAME = "blender_proxy_world"


def revision_number(value):
    identifier(value, "source_revision")
    if not value.startswith("rev-") or not value[4:].isascii() or not value[4:].isdigit():
        raise ProtocolError("source_revision must use rev-NNNNN format")
    return int(value[4:])


def next_revision(value):
    return f"rev-{revision_number(value) + 1:05d}"


def scene_metadata(scene=None):
    scene = scene or bpy.context.scene
    result = {name: scene.get(key) for name, key in METADATA_KEYS.items()}
    for name in ["design_id", "source_resource_id", "source_revision", "coordinate_frame"]:
        identifier(result[name], name)
    revision_number(result["source_revision"])
    unit_scale(result["source_unit_scale"])
    if abs(scene.unit_settings.scale_length - result["source_unit_scale"]) > 1e-7:
        raise ProtocolError("Scene unit scale differs from persisted source_unit_scale", "coordinate_error")
    return result


def set_scene_metadata(scene, *, design_id, source_resource_id, source_revision,
                       coordinate_frame="blender_world_z_up", source_unit_scale=1.0):
    for name, value in [("design_id", design_id), ("source_resource_id", source_resource_id),
                        ("source_revision", source_revision), ("coordinate_frame", coordinate_frame)]:
        identifier(value, name)
    revision_number(source_revision)
    unit_scale(source_unit_scale)
    values = dict(design_id=design_id, source_resource_id=source_resource_id, source_revision=source_revision,
                  coordinate_frame=coordinate_frame, source_unit_scale=source_unit_scale)
    for name, value in values.items():
        scene[METADATA_KEYS[name]] = value
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = source_unit_scale


def eligible_objects(scene=None):
    scene = scene or bpy.context.scene
    return [obj for obj in scene.objects if obj.type == "MESH" and not obj.hide_render
            and not obj.get("spatial_canvas_exclude", False)]


def authoritative_mapping(scene=None):
    """Check all persisted IDs in the file, including hidden/unlinked objects and other scenes."""
    mapping = {}
    for obj in bpy.data.objects:
        gid = obj.get(ENTITY_KEYS["global_id"])
        if gid is None:
            continue
        identifier(gid, "global_id")
        if gid in mapping:
            raise ProtocolError("Duplicate authoritative global_id: " + gid, "duplicate_identity")
        mapping[gid] = obj
    return mapping


def entity_from_object(obj, metadata):
    values = {name: obj.get(key) for name, key in ENTITY_KEYS.items()}
    for name in ["global_id", "semantic_type", "room_id"]:
        identifier(values[name], name)
    entity = {name: metadata[name] for name in ["design_id", "source_resource_id", "source_revision"]}
    entity.update({name: values[name] for name in ["global_id", "semantic_type", "room_id"]})
    entity["native_object_id"] = obj.name
    if values["authority_level"] is not None:
        entity["authority_level"] = identifier(values["authority_level"], "authority_level")
    if values["mutable"] is not None:
        if not isinstance(values["mutable"], bool):
            raise ProtocolError("mutable must be boolean")
        entity["mutable"] = values["mutable"]
    if obj.parent and obj.parent.get(ENTITY_KEYS["global_id"]):
        entity["parent_id"] = obj.parent[ENTITY_KEYS["global_id"]]
    return entity


def collect_entities(objects, metadata):
    authoritative_mapping()
    entities = {}
    for obj in objects:
        entity = entity_from_object(obj, metadata)
        if entity["global_id"] in entities:
            raise ProtocolError("Duplicate global_id", "duplicate_identity")
        entities[entity["global_id"]] = (obj, entity)
    if not entities:
        raise ProtocolError("No eligible semantic meshes")
    return entities


def initialize_ids(scene=None, *, design_id=None, source_resource_id=None, source_revision=None, objects=None):
    """Deliberate one-time authoring operation; never derives IDs from object names."""
    scene = scene or bpy.context.scene
    authoritative_mapping(scene)
    design_id = design_id or scene.get(METADATA_KEYS["design_id"]) or "design_" + uuid.uuid4().hex
    source_resource_id = source_resource_id or scene.get(METADATA_KEYS["source_resource_id"]) or "src_" + uuid.uuid4().hex
    previous = scene.get(METADATA_KEYS["source_revision"])
    revision = source_revision or previous or "rev-00001"
    set_scene_metadata(scene, design_id=design_id, source_resource_id=source_resource_id, source_revision=revision,
                       coordinate_frame=scene.get(METADATA_KEYS["coordinate_frame"], "blender_world_z_up"),
                       source_unit_scale=scene.unit_settings.scale_length)
    changed = []
    for obj in objects if objects is not None else eligible_objects(scene):
        if obj.get(ENTITY_KEYS["global_id"]) is None:
            obj[ENTITY_KEYS["global_id"]] = "ent_" + uuid.uuid4().hex
            changed.append(obj.name)
        for field, value in {"semantic_type": "object", "room_id": "unassigned", "authority_level": "HUMAN_DESIGN_GUIDE"}.items():
            if obj.get(ENTITY_KEYS[field]) is None:
                obj[ENTITY_KEYS[field]] = value
    if changed and previous:
        scene[METADATA_KEYS["source_revision"]] = next_revision(previous)
    collect_entities(eligible_objects(scene), scene_metadata(scene))
    return changed


def proxy_translation_to_blender(translation, metadata):
    return Vector(proxy_to_source(translation, metadata["source_unit_scale"]))


def blender_translation_to_proxy(translation, metadata):
    return source_to_proxy(list(translation), metadata["source_unit_scale"])


def file_sha256(path):
    with open(path, "rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=".sc-json-", dir=path.parent)
    try:
        with os.fdopen(handle, "w", encoding="utf8") as output:
            json.dump(value, output, indent=2, allow_nan=False)
            output.write("\n")
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        if Path(temporary).exists():
            Path(temporary).unlink()


def atomic_save_source(source_path, expected_sha=None):
    """Save a copy beside the source, then replace only after Blender successfully wrote it."""
    source = Path(source_path).resolve()
    if expected_sha and file_sha256(source) != expected_sha:
        raise ProtocolError("Source file changed during execution", "source_hash_mismatch")
    temporary = source.with_name(".sc-save-" + uuid.uuid4().hex + ".blend")
    try:
        result = bpy.ops.wm.save_as_mainfile(filepath=str(temporary), copy=True, relative_remap=False)
        if "FINISHED" not in result or not temporary.is_file():
            raise OSError("Blender did not save the source copy")
        with temporary.open("rb") as handle:
            os.fsync(handle.fileno())
        if expected_sha and file_sha256(source) != expected_sha:
            raise ProtocolError("Source file changed during save", "source_hash_mismatch")
        os.replace(temporary, source)
    finally:
        if temporary.exists():
            temporary.unlink()


@contextmanager
def source_lock(source_path):
    """One offline writer per source. Interrupted processes may leave a documented lock file."""
    lock = Path(str(source_path) + ".spatial-canvas.lock")
    try:
        handle = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as error:
        raise ProtocolError("Source already has an active adapter lock", "source_locked") from error
    try:
        os.write(handle, str(os.getpid()).encode())
        os.close(handle)
        yield
    finally:
        lock.unlink(missing_ok=True)
