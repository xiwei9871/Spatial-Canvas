# Blender offline producer contract

V0.1 provides an integration contract rather than a live bridge. The original JSON fixture producer demonstrates the protocol without requiring Blender. A real offline exporter is a follow-up adapter task.

1. Persist design_id, source_resource_id and per-entity global_id in the authoritative project. Preserve them across renames and exports; keep native locators separate.
2. Save the authoritative source, hash saved bytes with SHA-256, and obtain the revision token from the source/task revision system.
3. Evaluate source geometry into a temporary export scene. Simplify without merging semantic boundaries. Bake modifiers/rigs/procedural geometry. Export low-poly meshes and simple materials without textures/extensions.
4. Export node extras (Blender glTF export_extras=True) containing all required entity fields. Multiple mesh pieces use one identified parent; every mesh must resolve through an explicit ID or ancestor.
5. Convert Blender Z-up units to glTF Y-up meters while preserving evaluated transforms. Declare proxy coordinate_frame and optionally the original source_frame. Retain conversion logic for future requests.
6. Write one active GLB scene and a V1 manifest with scope full/task, correct entity_count and source provenance in task-output/artifacts. Include preview/task report when useful.
7. Validate portable schemas and the semantic checks in docs/protocol-v0.1.md before handing files to the workspace.

Future consumers validate request_only, current source revision/hash and stable/native ID pairs, apply source policy, convert translation into source coordinates, and deduplicate request IDs. Only the adapter acts on Blender. The web UI has no .blend editing handles and does not transform/write GLBs.
