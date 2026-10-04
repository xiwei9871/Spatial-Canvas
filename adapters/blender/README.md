# Blender offline producer and adapter contract

V0.2 provides the first real offline producer and adapter. Blender remains authoritative, proxy GLBs remain derived, intents remain request-only, and execution results acknowledge an offline adapter run. There is still no live bridge, watcher or WebSocket.

1. Persist design_id, source_resource_id and per-entity global_id in the authoritative project. Preserve them across renames and exports; keep native locators separate.
2. Save the authoritative source, hash saved bytes with SHA-256, and obtain the revision token from the source/task revision system.
3. Evaluate source geometry into a temporary export scene. Simplify without merging semantic boundaries. Bake modifiers/rigs/procedural geometry. Export low-poly meshes and simple materials without textures/extensions.
4. Export node extras (Blender glTF export_extras=True) containing all required entity fields. Multiple mesh pieces use one identified parent; every mesh must resolve through an explicit ID or ancestor.
5. Convert Blender Z-up units to glTF Y-up meters while preserving evaluated transforms. Declare proxy coordinate_frame and optionally the original source_frame. Retain conversion logic for future requests.
6. Write one active GLB scene and a V1 manifest with scope full/task, correct entity_count and source provenance in task-output/artifacts. Include preview/task report when useful.
7. Validate portable schemas and the semantic checks in docs/protocol-v0.1.md before handing files to the workspace.

export_proxy.py, apply_intent.py, common.py and create_fixture.py implement the contract. Use [the workflow](../../docs/blender-workflow-v0.2.md) for exact headless commands. apply_intent.py validates request-only, current source revision/hash and stable/native ID pairs, applies mutability policy, converts proxy [x,y,z] meters to Blender [x,-z,y] scene units using source_unit_scale, bumps revision, saves via atomic replacement, and emits spatial-canvas.execution-result.v1. Only this adapter acts on Blender. The web UI has no .blend editing handles and does not transform/write GLBs.

V0.3 frozen mode uses --bindings instead of initialization. create_bindings.py persists identities only in an external registry; export_proxy.py verifies its source hash and injects metadata into temporary proxy objects only. inspect_context.py resolves captured context read-only. See [frozen workflow](../../docs/frozen-workflow-v0.3.md). Never mark R4/B0 editable.
