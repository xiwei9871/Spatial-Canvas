"""Real bpy gates. Run: blender --background --factory-startup --python-exit-code 1 --python this_file."""
from copy import deepcopy
import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import bpy
from mathutils import Matrix, Quaternion, Vector
import common
from contracts import ProtocolError
from export_proxy import export_proxy
import export_proxy as producer
import apply_intent as adapter_module
from apply_intent import apply_intent, execute_saved_intent
from types import SimpleNamespace


class BlenderGates(unittest.TestCase):
    def setUp(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.work = tempfile.TemporaryDirectory()
        self.source = str(Path(self.work.name) / "scene.blend")
        common.set_scene_metadata(bpy.context.scene, design_id="design_test", source_resource_id="source_test", source_revision="rev-00007")
        for name, gid, mutable, location in [("Sofa", "sofa", True, (-1.5, 0, .45)),
                                            ("Wall", "wall", False, (0, 1, 1)), ("Table", "table", True, (0, 0, .3))]:
            bpy.ops.mesh.primitive_cube_add(size=1, location=location)
            obj = bpy.context.object
            obj.name = name
            for field, value in {"global_id": gid, "semantic_type": name.lower(), "room_id": "living",
                                 "authority_level": "HUMAN_DESIGN_GUIDE", "mutable": mutable}.items():
                obj[common.ENTITY_KEYS[field]] = value
        bpy.ops.wm.save_as_mainfile(filepath=self.source)

    def tearDown(self):
        self.work.cleanup()

    def args(self, **patches):
        return SimpleNamespace(output=str(Path(self.work.name) / "artifacts"), scope="full",
                               room_id=None, global_ids=None, collection=None, **patches)

    def request(self):
        return {
            "schema": "spatial-canvas.intent.v1", "request_id": "req_test", "design_id": "design_test",
            "resource_id": "proxy", "source_resource_id": "source_test", "source_revision": "rev-00007",
            "source_sha256": common.file_sha256(self.source), "targets": [{"global_id": "sofa", "native_object_id": "Sofa"}],
            "intent": "request_transform", "authority": "request_only",
            "payload": {"translation": [.5, 0, 0], "space": "world", "unit": "meter", "coordinate_frame": "blender_proxy_world"},
            "timestamp": "2026-10-04T06:00:00.000Z",
        }

    def saved(self):
        bpy.ops.wm.save_as_mainfile(filepath=self.source)
        return common.file_sha256(self.source)

    def test_initialization_preserves_existing_revision_and_ids(self):
        common.initialize_ids()
        self.assertEqual(common.scene_metadata()["source_revision"], "rev-00007")
        self.assertEqual(bpy.data.objects["Sofa"]["spatial_canvas_global_id"], "sofa")
        del bpy.data.objects["Sofa"]["spatial_canvas_authority_level"]
        common.initialize_ids()
        self.assertEqual(bpy.data.objects["Sofa"]["spatial_canvas_authority_level"],"HUMAN_DESIGN_GUIDE")

    def test_rename_preserves_global_id_and_updates_native_locator(self):
        bpy.data.objects["Sofa"].name = "Renamed_Sofa"
        self.saved()
        export_proxy(self.args())
        glb = (Path(self.work.name) / "artifacts/interaction_proxy.glb").read_bytes()
        doc = json.loads(glb[20:20+struct.unpack_from("<I", glb, 12)[0]])
        entity = next(node["extras"] for node in doc["nodes"] if node["extras"]["global_id"] == "sofa")
        self.assertEqual(entity["native_object_id"], "Renamed_Sofa")
        self.assertEqual(entity["global_id"], "sofa")

    def test_initialize_new_source_persists_generated_identity(self):
        for key in common.METADATA_KEYS.values():
            del bpy.context.scene[key]
        del bpy.data.objects["Sofa"]["spatial_canvas_global_id"]
        common.initialize_ids()
        first = bpy.data.objects["Sofa"]["spatial_canvas_global_id"]
        self.saved()
        bpy.ops.wm.open_mainfile(filepath=self.source)
        common.initialize_ids()
        self.assertEqual(bpy.data.objects["Sofa"]["spatial_canvas_global_id"], first)
        self.assertTrue(common.scene_metadata()["design_id"])

    def test_missing_and_duplicate_identity_rejected(self):
        metadata = common.scene_metadata()
        del bpy.data.objects["Sofa"]["spatial_canvas_global_id"]
        with self.assertRaises(ProtocolError):
            common.collect_entities(common.eligible_objects(), metadata)
        bpy.data.objects["Sofa"]["spatial_canvas_global_id"] = "wall"
        with self.assertRaises(ProtocolError):
            common.collect_entities(common.eligible_objects(), metadata)

    def test_source_metadata_types_and_units_validated(self):
        bpy.context.scene["spatial_canvas_design_id"] = 4
        with self.assertRaises(ProtocolError):
            common.scene_metadata()
        bpy.context.scene["spatial_canvas_design_id"] = "design_test"
        bpy.context.scene.unit_settings.scale_length = .01
        with self.assertRaises(ProtocolError):
            common.scene_metadata()

    def test_request_gates_are_all_or_nothing(self):
        original = bpy.data.objects["Sofa"].matrix_world.copy()
        original_hash = common.file_sha256(self.source)
        for change in [{"source_revision": "rev-00001"}, {"design_id": "wrong"}, {"source_resource_id": "wrong"},
                       {"source_sha256": "b"*64}, {"schema": "v2"},
                       {"targets": [{"global_id": "missing", "native_object_id": "Sofa"}]},
                       {"targets": [{"global_id": "sofa", "native_object_id": "wrong"}]},
                       {"targets": [{"global_id": "sofa", "native_object_id": "Sofa"}, {"global_id": "wall", "native_object_id": "Wall"}]},
                       {"payload": {**self.request()["payload"], "coordinate_frame": "wrong"}}]:
            with self.subTest(change=change), self.assertRaises(ProtocolError):
                apply_intent({**self.request(), **change}, self.source)
            self.assertEqual(bpy.data.objects["Sofa"].matrix_world, original)
            self.assertEqual(common.file_sha256(self.source), original_hash)
            self.assertEqual(common.scene_metadata()["source_revision"], "rev-00007")

    def test_duplicate_authoritative_mapping_rejected(self):
        duplicate = bpy.data.objects["Sofa"].copy()
        bpy.context.scene.collection.objects.link(duplicate)
        duplicate.hide_render = True
        self.saved()
        with self.assertRaises(ProtocolError):
            apply_intent(self.request(), self.source)

    def test_world_translation_under_rotated_scaled_parent(self):
        sofa = bpy.data.objects["Sofa"]
        world = sofa.matrix_world.copy()
        parent = bpy.data.objects.new("Group", None)
        bpy.context.scene.collection.objects.link(parent)
        parent.rotation_euler.z = 1.0
        parent.scale = (2, 3, 1)
        sofa.parent = parent
        bpy.context.view_layer.update()
        sofa.matrix_world = world
        bpy.context.view_layer.update()
        before = sofa.matrix_world.translation.copy()
        self.saved()
        result = apply_intent(self.request(), self.source)
        bpy.context.view_layer.update()
        self.assertLess((sofa.matrix_world.translation - before - Vector((.5, 0, 0))).length, 1e-5)
        self.assertEqual(result["source_revision"], "rev-00008")
        bpy.ops.wm.open_mainfile(filepath=self.source)
        self.assertEqual(common.scene_metadata()["source_revision"], "rev-00008")

    def test_export_evaluates_modifiers_drops_textures_and_preserves_source(self):
        sofa = bpy.data.objects["Sofa"]
        modifier = sofa.modifiers.new("Bevel", "BEVEL")
        modifier.width = .1
        material = bpy.data.materials.new("Source texture")
        material.use_nodes = True
        material.node_tree.nodes.new("ShaderNodeTexImage")
        sofa.data.materials.append(material)
        self.saved()
        counts = (len(bpy.data.objects), len(bpy.data.meshes), len(bpy.data.materials), len(bpy.data.scenes))
        original_hash = common.file_sha256(self.source)
        export_proxy(self.args())
        self.assertEqual(common.file_sha256(self.source), original_hash)
        self.assertEqual((len(bpy.data.objects), len(bpy.data.meshes), len(bpy.data.materials), len(bpy.data.scenes)), counts)
        self.assertEqual(sofa.modifiers[0].name, "Bevel")
        data = (Path(self.work.name) / "artifacts/interaction_proxy.glb").read_bytes()
        document = json.loads(data[20:20+struct.unpack_from("<I", data, 12)[0]])
        self.assertFalse(document.get("images"))
        self.assertFalse(document.get("extensionsUsed"))
        self.assertFalse(document.get("textures"))
        self.assertEqual({node["extras"]["global_id"] for node in document["nodes"]}, {"sofa", "wall", "table"})
        mesh = document["meshes"][next(node["mesh"] for node in document["nodes"] if node["extras"]["global_id"] == "sofa")]
        accessor = document["accessors"][mesh["primitives"][0]["attributes"]["POSITION"]]
        self.assertGreater(accessor["count"], 24)

    def test_flat_colors_preserve_material_regions_without_texture_or_shader_payload(self):
        sofa=bpy.data.objects["Sofa"]
        material=bpy.data.materials.new("Readable green")
        material.use_nodes=True
        material.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value=(.15,.5,.35,1)
        material.node_tree.nodes.new("ShaderNodeTexImage")
        red=bpy.data.materials.new("Readable red")
        red.use_nodes=True
        red.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value=(.6,.15,.1,1)
        sofa.data.materials.append(material)
        sofa.data.materials.append(red)
        sofa.data.polygons[0].material_index=1
        self.saved()
        counts=(len(bpy.data.objects),len(bpy.data.meshes),len(bpy.data.materials))
        before=Path(self.source).read_bytes()
        export_proxy(self.args(color_mode="source-flat"))
        data=(Path(self.work.name)/"artifacts/interaction_proxy.glb").read_bytes()
        doc=json.loads(data[20:20+struct.unpack_from("<I",data,12)[0]])
        self.assertFalse(doc.get("images"))
        self.assertFalse(doc.get("textures"))
        self.assertFalse(doc.get("extensionsUsed"))
        colors=[m["pbrMetallicRoughness"]["baseColorFactor"][:3] for m in doc.get("materials",[])]
        self.assertTrue(any(all(abs(a-b)<1e-5 for a,b in zip(rgb,[.15,.5,.35])) for rgb in colors))
        self.assertTrue(any(all(abs(a-b)<1e-5 for a,b in zip(rgb,[.6,.15,.1])) for rgb in colors))
        mesh=doc["meshes"][next(n["mesh"] for n in doc["nodes"] if n["extras"]["global_id"]=="sofa")]
        self.assertEqual(len({p["material"] for p in mesh["primitives"]}),2)
        self.assertEqual(Path(self.source).read_bytes(),before)
        self.assertEqual((len(bpy.data.objects),len(bpy.data.meshes),len(bpy.data.materials)),counts)

    def test_zoning_colors_are_presentation_only(self):
        from proxy_colors import zoning_color,ZONING_COLORS
        metadata=common.scene_metadata()
        before={obj.name:dict(obj.items()) for obj in common.eligible_objects()}
        wall=bpy.data.objects["Wall"]
        sofa=bpy.data.objects["Sofa"]
        self.assertEqual(zoning_color(common.entity_from_object(wall,metadata),wall)[0],ZONING_COLORS["wall"])
        self.assertEqual(zoning_color(common.entity_from_object(sofa,metadata),sofa)[0],ZONING_COLORS["furniture"])
        floor={**common.entity_from_object(wall,metadata),"native_object_id":"FLOOR_LOWER","semantic_type":"unassigned"}
        self.assertEqual(zoning_color(floor,wall)[0],ZONING_COLORS["floor"])
        self.assertEqual({obj.name:dict(obj.items()) for obj in common.eligible_objects()},before)

    def test_proxy_visibility_honors_hidden_collection_ancestors_and_view_layer(self):
        visible=bpy.data.objects["Sofa"]
        hidden=bpy.data.collections.new("HiddenGuides")
        bpy.context.scene.collection.children.link(hidden)
        hidden.hide_render=True
        child=bpy.data.collections.new("NestedGuides")
        hidden.children.link(child)
        old_guide=visible.copy()
        old_guide.data=visible.data.copy()
        old_guide.name="OldGuide"
        child.objects.link(old_guide)
        self.assertFalse(old_guide.hide_render)
        self.assertNotIn(old_guide,common.eligible_objects())
        hidden.hide_render=False
        hidden.hide_viewport=True
        self.assertNotIn(old_guide,common.eligible_objects())
        hidden.hide_viewport=False
        bpy.context.view_layer.update()
        hidden_layer=bpy.context.view_layer.layer_collection.children["HiddenGuides"]
        hidden_layer.exclude=True
        self.assertNotIn(old_guide,common.eligible_objects())
        hidden_layer.exclude=False
        bpy.context.view_layer.update()
        self.assertIn(old_guide,common.eligible_objects())
        visible.hide_set(True)
        self.assertNotIn(visible,common.eligible_objects())

    def test_non_unit_scene_scale_export_and_execution(self):
        common.set_scene_metadata(bpy.context.scene, design_id="design_test", source_resource_id="source_test",
                                  source_revision="rev-00007", source_unit_scale=.01)
        self.saved()
        export_proxy(self.args())
        manifest = json.loads((Path(self.work.name) / "artifacts/interaction_proxy.manifest.json").read_text())
        self.assertEqual(manifest["source_frame"]["unit"], "centimeter")
        data = (Path(self.work.name) / "artifacts/interaction_proxy.glb").read_bytes()
        document = json.loads(data[20:20+struct.unpack_from("<I", data, 12)[0]])
        sofa = next(node for node in document["nodes"] if node["extras"]["global_id"] == "sofa")
        self.assertAlmostEqual(sofa["translation"][0], -.015, places=5)
        apply_intent(self.request(), self.source)
        self.assertAlmostEqual(bpy.data.objects["Sofa"].matrix_world.translation.x, 48.5, places=4)

    def test_save_failure_keeps_source_and_reverts_memory(self):
        before = bpy.data.objects["Sofa"].matrix_world.copy()
        original_hash = common.file_sha256(self.source)
        with patch("apply_intent.atomic_save_source", side_effect=OSError("disk full")):
            with self.assertRaises(OSError):
                apply_intent(self.request(), self.source)
        self.assertEqual(common.file_sha256(self.source), original_hash)
        self.assertEqual(common.scene_metadata()["source_revision"], "rev-00007")
        self.assertEqual(bpy.data.objects["Sofa"].matrix_world, before)

    def test_cli_transaction_reloads_latest_disk_geometry(self):
        sofa = bpy.data.objects["Sofa"]
        old = sofa.data.vertices[0].co.x
        sofa.data.vertices[0].co.x = 99
        self.saved()
        # Simulate a scene loaded before another writer saved the current source bytes.
        sofa.data.vertices[0].co.x = old
        intent = self.request()
        result = execute_saved_intent(intent, self.source)
        self.assertEqual(result["status"], "applied")
        bpy.ops.wm.open_mainfile(filepath=self.source)
        self.assertEqual(bpy.data.objects["Sofa"].data.vertices[0].co.x, 99)

    def test_initialization_cli_reloads_latest_disk_geometry(self):
        sofa = bpy.data.objects["Sofa"]
        old = sofa.data.vertices[0].co.x
        sofa.data.vertices[0].co.x = 99
        self.saved()
        sofa.data.vertices[0].co.x = old
        with patch.object(sys, "argv", ["export_proxy.py", "--", "--initialize-ids", "--editable-source", "--output", self.args().output]):
            producer.main()
        bpy.ops.wm.open_mainfile(filepath=self.source)
        self.assertEqual(bpy.data.objects["Sofa"].data.vertices[0].co.x, 99)

    def test_frozen_sidecar_export_never_writes_source_or_uses_embedded_ids(self):
        # Frozen source has no Spatial Canvas metadata.
        for key in common.METADATA_KEYS.values():del bpy.context.scene[key]
        for obj in common.eligible_objects():
            for key in common.ENTITY_KEYS.values():
                if key in obj:del obj[key]
        sha=self.saved()
        mtime=Path(self.source).stat().st_mtime_ns
        sidecar=Path(self.work.name)/"spatial-canvas.bindings.json"
        value={"schema":"spatial-canvas.bindings.v1","registry_id":"bindings_test","registry_revision":"1",
               "design_id":"frozen_design","source_resource_id":"frozen_source","source_revision":"r4",
               "source_sha256":sha,"source_locator":self.source,"source_authority":"frozen",
               "source_frame":{"frame_id":"frozen_world","unit":"meter","up_axis":"Z","meters_per_unit":1},
               "bindings":[{"entity_id":"bound_"+o.name,"adapter":"blender","native_id":o.name,"semantic_type":"object",
                            "room_id":"unassigned","authority_level":"HUMAN_DESIGN_GUIDE"} for o in common.eligible_objects()]}
        common.write_json(sidecar,value)
        args=self.args(bindings=str(sidecar),source_resource_id="frozen_source",source_revision="r4")
        manifest=export_proxy(args)
        self.assertEqual(manifest["design_id"],"frozen_design")
        for field in ["source_resource_id","source_revision"]:
            with self.subTest(field=field):
                wrong=SimpleNamespace(**{**vars(args),field:"wrong"})
                with self.assertRaises(ProtocolError):export_proxy(wrong)
                self.assertEqual(common.file_sha256(self.source),sha)
        self.assertEqual(common.file_sha256(self.source),sha)
        self.assertEqual(Path(self.source).stat().st_mtime_ns,mtime)
        # A frozen refusal must not overwrite the supplied sidecar with its acknowledgement.
        request_path=Path(self.work.name)/"request.json"
        common.write_json(request_path,self.request())
        before_registry=sidecar.read_bytes()
        with patch.object(sys,"argv",["apply_intent.py","--","--bindings",str(sidecar),"--intent",str(request_path),"--result",str(sidecar)]):
            with self.assertRaises(ProtocolError):adapter_module.main()
        self.assertEqual(sidecar.read_bytes(),before_registry)
        # A registry modified between parsing and publication cannot describe the emitted IDs.
        value["source_sha256"]=sha
        common.write_json(sidecar,value)
        real_hash=producer.file_sha256
        edited=False
        def edit_during_source_hash(path):
            nonlocal edited
            if str(path)==self.source and not edited:
                edited=True
                changed=deepcopy(value)
                changed["registry_revision"]="2"
                changed["bindings"][0]["entity_id"]="changed_id"
                common.write_json(sidecar,changed)
            return real_hash(path)
        with patch("export_proxy.file_sha256",side_effect=edit_during_source_hash):
            with self.assertRaises(ProtocolError):export_proxy(args)
        self.assertEqual(common.file_sha256(self.source),sha)
        data=(Path(args.output)/"interaction_proxy.glb").read_bytes()
        doc=json.loads(data[20:20+struct.unpack_from("<I",data,12)[0]])
        self.assertTrue(all(not node["extras"]["mutable"] for node in doc["nodes"]))
        for obj in common.eligible_objects():self.assertNotIn("spatial_canvas_global_id",obj)
        value["source_sha256"]="b"*64
        common.write_json(sidecar,value)
        with self.assertRaises(ProtocolError):export_proxy(args)
        self.assertEqual(common.file_sha256(self.source),sha)
        with patch.object(sys,"argv",["export_proxy.py","--","--initialize-ids","--output",args.output]):
            with self.assertRaises(ProtocolError):producer.main()
        with patch.object(sys,"argv",["export_proxy.py","--","--bindings",str(sidecar),"--initialize-ids","--editable-source","--output",args.output]):
            with self.assertRaises(ProtocolError):producer.main()
        self.assertEqual(common.file_sha256(self.source),sha)
        self.assertEqual(Path(self.source).stat().st_mtime_ns,mtime)

    def test_sheared_parent_world_geometry_survives_export(self):
        sofa = bpy.data.objects["Sofa"]
        parent = bpy.data.objects.new("ScaledParent", None)
        bpy.context.scene.collection.objects.link(parent)
        parent.scale = (2, 1, 1)
        sofa.parent = parent
        sofa.rotation_euler.z = .78539816339
        bpy.context.view_layer.update()
        expected = [common.blender_translation_to_proxy(sofa.matrix_world @ vertex.co, common.scene_metadata()) for vertex in sofa.data.vertices]
        self.saved()
        export_proxy(self.args())
        glb = (Path(self.work.name) / "artifacts/interaction_proxy.glb").read_bytes()
        length = struct.unpack_from("<I", glb, 12)[0]
        doc = json.loads(glb[20:20+length])
        node = next(node for node in doc["nodes"] if node["extras"]["global_id"] == "sofa")
        mesh = doc["meshes"][node["mesh"]]
        accessor = doc["accessors"][mesh["primitives"][0]["attributes"]["POSITION"]]
        view = doc["bufferViews"][accessor["bufferView"]]
        offset = 28 + length + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        rotation = node.get("rotation", [0, 0, 0, 1])
        transform = Matrix.LocRotScale(Vector(node.get("translation", [0, 0, 0])),
                                      Quaternion((rotation[3], *rotation[:3])), Vector(node.get("scale", [1, 1, 1])))
        points = [transform @ Vector(struct.unpack_from("<3f", glb, offset + index * view.get("byteStride", 12))) for index in range(accessor["count"])]
        for axis in range(3):
            self.assertAlmostEqual(min(p[axis] for p in points), min(p[axis] for p in expected), places=4)
            self.assertAlmostEqual(max(p[axis] for p in points), max(p[axis] for p in expected), places=4)


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(BlenderGates)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
