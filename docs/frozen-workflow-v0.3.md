# Frozen Source Workflow V0.3

For frozen R4/B0, use sidecars. Do not run in-source initialization. Keep outputs in a separate local artifact directory.

## Deliberate sidecar creation

~~~sh
blender --background --factory-startup /absolute/frozen.blend --python-exit-code 1 --python adapters/blender/create_bindings.py -- \
  --output task-output/frozen/spatial-canvas.bindings.json \
  --design-id design_project --source-resource-id source_r4 --source-revision r4 \
  --expected-sha256 FULL_64_CHARACTER_FROZEN_SHA256 --frame-id project_world
~~~

The command checks the supplied frozen hash, reads the saved source, generates durable UUID binding IDs, and writes only external registry/inventory JSON. It refuses an existing registry rather than replacing IDs. It does not save source, annotate source, create a source lock or alter source permissions.

Review the generated inventory and annotate explicit native bindings with semantic_type, room_id and canonical authority labels as appropriate. Keep unverified labels unassigned. Persist the registry and increment registry_revision when its metadata changes. Do not rerun initialization to handle renamed objects.

## Offline proxy export

~~~sh
blender --background --factory-startup /absolute/frozen.blend --python-exit-code 1 --python adapters/blender/export_proxy.py -- \
  --bindings task-output/frozen/spatial-canvas.bindings.json --source-resource-id source_r4 --source-revision r4 \
  --output task-output/frozen/full --scope full

blender --background --factory-startup /absolute/frozen.blend --python-exit-code 1 --python adapters/blender/export_proxy.py -- \
  --bindings task-output/frozen/spatial-canvas.bindings.json --source-resource-id source_r4 --source-revision r4 \
  --output task-output/frozen/task --scope task --global-id ENTITY_ID
~~~

Full exports include registered eligible meshes; task exports can filter entity IDs, room or collection. Both preserve identity and use the existing proxy manifest/GLB protocol. Source shader graphs/textures and editing state are stripped from temporary evaluated meshes; simple flat display colors are supported. See [display colors](proxy-display-colors.md). The source is never saved.

## Workspace and packet consumption

Run npm run dev, open the Workspace, choose the manifest/GLB pair, click actual geometry and select Export ContextPacket. The panel shows the exact document and the button downloads a single packet. Frame selection helps inspect registered entities; list selection alone deliberately produces hit=null.

For a verified frozen Blender packet:

~~~sh
blender --background --factory-startup --python-exit-code 1 --python adapters/blender/inspect_context.py -- \
  --packet task-output/frozen/sofa.context.json \
  --output task-output/frozen/sofa.resolution.json
~~~

The resolver reads the packet's explicit source path and registry reference, verifies hashes and identity, opens source read-only, and resolves the native object directly. It does not search names heuristically, invoke an AI SDK or execute transformations.

## Validation

~~~sh
npm run check
npm run test:adapter
npm run test:bindings
npm run schemas
npm run fixture
npm run context:validate -- task-output/v03-c-type/representative
~~~

The last command checks the locally retained real C-Type dogfood artifacts and requires those files. It is not a clone/CI requirement. CI retains portable tests and skips bpy checks when Blender is absent. docs/validation-v0.3.md records the actual R4 gate.
