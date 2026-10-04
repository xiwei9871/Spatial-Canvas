"""Offline producer: evaluated per-entity meshes, no textures, no source geometry changes."""
import argparse
import os
from pathlib import Path
import sys
import tempfile

import bpy
from mathutils import Matrix

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (PROXY_FRAME, ProtocolError, atomic_save_source, collect_entities, eligible_objects,
                    file_sha256, initialize_ids, scene_metadata, source_lock, write_json)


def select_objects(args, metadata):
    objects = eligible_objects()
    # Check the entire source, so a task export cannot conceal a duplicate semantic key.
    collect_entities(objects, metadata)
    if args.scope == "full":
        return objects
    if not (args.room_id or args.global_ids or args.collection):
        raise ProtocolError("Task scope requires --room-id, --global-id or --collection")
    if args.room_id:
        objects = [obj for obj in objects if obj.get("spatial_canvas_room_id") == args.room_id]
    if args.global_ids:
        wanted = set(args.global_ids)
        known = {obj.get("spatial_canvas_global_id") for obj in objects}
        if not wanted.issubset(known):
            raise ProtocolError("Task selector includes unknown or filtered global_ids")
        objects = [obj for obj in objects if obj.get("spatial_canvas_global_id") in wanted]
    if args.collection:
        collection = bpy.data.collections.get(args.collection)
        if collection is None:
            raise ProtocolError("Unknown collection")
        objects = [obj for obj in objects if obj in set(collection.all_objects)]
    if not objects:
        raise ProtocolError("Task selector matched no eligible meshes")
    return objects


def export_proxy(args):
    source_scene = bpy.context.scene
    metadata = scene_metadata(source_scene)
    source_path = Path(bpy.data.filepath)
    if not source_path.is_file():
        raise ProtocolError("Load a saved authoritative .blend before exporting")
    if bpy.data.is_dirty:
        raise ProtocolError("Save/reload source before exporting unsaved edits")
    objects = select_objects(args, metadata)
    entities = collect_entities(objects, metadata)
    sha = file_sha256(source_path)
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    name = "interaction_proxy" if args.scope == "full" else "task_proxy"
    manifest = {
        "schema": "interaction-proxy-v1", "design_id": metadata["design_id"],
        "resource_id": "res_" + metadata["source_resource_id"] + "_" + args.scope,
        "type": "interaction_proxy", "format": "glb", "authority": "derived", "proxy_uri": name + ".glb",
        "source_resource_id": metadata["source_resource_id"], "source_resource": source_path.name,
        "source_sha256": sha, "source_revision": metadata["source_revision"],
        "coordinate_frame": PROXY_FRAME, "unit": "meter", "up_axis": "Y",
        "source_frame": {"coordinate_frame": metadata["coordinate_frame"], "unit": "meter", "up_axis": "Z"},
        "extensions": {"spatial_canvas.blender": {"meters_per_scene_unit": metadata["source_unit_scale"],
                                                  "source_coordinate_frame": metadata["coordinate_frame"]}},
        "entity_count": len(entities), "scope": args.scope,
    }
    scale_units = {1.0: "meter", .01: "centimeter", .001: "millimeter"}
    if metadata["source_unit_scale"] in scale_units:
        manifest["source_frame"]["unit"] = scale_units[metadata["source_unit_scale"]]
    else:
        # Arbitrary Blender scales do not map to V1's named units; extension carries exact conversion.
        manifest.pop("source_frame")
    depsgraph = bpy.context.evaluated_depsgraph_get()
    temp_scene = bpy.data.scenes.new("__spatial_canvas_export__")
    temp_scene.unit_settings.system = "METRIC"
    temp_scene.unit_settings.scale_length = 1.0
    temp_objects, temp_meshes = [], []
    window = bpy.context.window
    try:
        meter_scale = Matrix.Diagonal((metadata["source_unit_scale"],) * 3 + (1.0,))
        for source, entity in entities.values():
            evaluated = source.evaluated_get(depsgraph)
            mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
            temp_meshes.append(mesh)
            if not mesh.polygons:
                raise ProtocolError("Entity has no evaluated faces: " + entity["global_id"])
            mesh.materials.clear()
            # Flatten each entity to its evaluated world transform; no rig/parent state is exported.
            duplicate = bpy.data.objects.new(entity["native_object_id"], mesh)
            temp_objects.append(duplicate)
            temp_scene.collection.objects.link(duplicate)
            world = meter_scale @ evaluated.matrix_world
            location, rotation, scale = world.decompose()
            trs = Matrix.LocRotScale(location, rotation, scale)
            if abs(trs.determinant()) < 1e-12:
                trs = Matrix.Translation(world.translation)
            # A Blender Object can hold only TRS. Preserve parent-induced shear in mesh vertices.
            mesh.transform(trs.inverted() @ world)
            duplicate.matrix_world = trs
            for key, value in entity.items():
                duplicate[key] = value
        window.scene = temp_scene
        for obj in temp_objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = temp_objects[0]
        with tempfile.TemporaryDirectory(prefix=".sc-export-", dir=output) as staging:
            staged_glb = Path(staging) / (name + ".glb")
            result = bpy.ops.export_scene.gltf(
                filepath=str(staged_glb), export_format="GLB", use_selection=True, use_active_scene=True,
                export_extras=True, export_yup=True, export_materials="NONE", export_texcoords=False,
                export_cameras=False, export_lights=False, export_animations=False, export_skins=False,
                export_morph=False, export_gpu_instances=False, export_attributes=False,
            )
            if "FINISHED" not in result or not staged_glb.is_file():
                raise OSError("Blender failed to export GLB")
            if file_sha256(source_path) != sha:
                raise ProtocolError("Source changed during export", "source_hash_mismatch")
            # Publish manifest last. Consumers must wait for the offline command to finish.
            os.replace(staged_glb, output / (name + ".glb"))
            write_json(output / (name + ".manifest.json"), manifest)
        return manifest
    finally:
        window.scene = source_scene
        for obj in temp_objects:
            bpy.data.objects.remove(obj, do_unlink=True)
        for mesh in temp_meshes:
            bpy.data.meshes.remove(mesh)
        bpy.data.scenes.remove(temp_scene)


def main():
    parser = argparse.ArgumentParser(description="Export derived GLB/manifest from a saved Blender source")
    parser.add_argument("--output", required=True)
    parser.add_argument("--scope", choices=["full", "task"], default="full")
    parser.add_argument("--room-id")
    parser.add_argument("--global-id", dest="global_ids", action="append")
    parser.add_argument("--collection")
    parser.add_argument("--initialize-ids", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    source = bpy.data.filepath
    if not source:
        raise ProtocolError("Load a saved source .blend")
    with source_lock(source):
        # Blender initially loads before script execution. Reload after the lock so geometry
        # and the hashed source bytes cannot refer to different file snapshots.
        bpy.ops.wm.open_mainfile(filepath=source)
        if args.initialize_ids:
            expected = file_sha256(source)
            initialize_ids()
            atomic_save_source(source, expected)
            bpy.ops.wm.open_mainfile(filepath=source)
        print("SPATIAL_CANVAS_MANIFEST=" + str(export_proxy(args)))


if __name__ == "__main__":
    main()
