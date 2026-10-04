# Blender Workflow V0.2

V0.2 adds an offline producer and adapter while keeping the browser transport-free. Blender is the authority; the GLB and manifest are derived; an intent is a request; the execution-result acknowledges adapter work. There is no WebSocket, watcher or live synchronization.

## Persistent source contract

The authoritative scene stores Scene custom properties: spatial_canvas_design_id, spatial_canvas_source_resource_id, spatial_canvas_source_revision (rev-NNNNN), spatial_canvas_coordinate_frame (normally blender_world_z_up), and spatial_canvas_source_unit_scale (meters per Blender scene unit). Eligible mesh objects store spatial_canvas_global_id, spatial_canvas_semantic_type, spatial_canvas_room_id, spatial_canvas_authority_level and optional boolean spatial_canvas_mutable (false rejects transforms; absent means unspecified). These properties are saved in .blend. Object names are native locators and are never durable keys. Export refuses missing/duplicate IDs.

To initialize a source deliberately:

~~~sh
blender --background --factory-startup source.blend --python-exit-code 1 --python adapters/blender/export_proxy.py -- \
  --output task-output/artifacts --scope full --initialize-ids --editable-source
~~~

This writes initialized IDs and metadata into the source before exporting. Ordinary export never mutates it.

## Producer commands

~~~sh
blender --background --factory-startup --python-exit-code 1 --python adapters/blender/create_fixture.py -- \
  --output examples/blender-v02/authoritative.blend

blender --background --factory-startup examples/blender-v02/authoritative.blend --python-exit-code 1 \
  --python adapters/blender/export_proxy.py -- \
  --output examples/blender-v02/artifacts --scope full

blender --background --factory-startup examples/blender-v02/authoritative.blend --python-exit-code 1 \
  --python adapters/blender/export_proxy.py -- \
  --output examples/blender-v02/artifacts --scope task --room-id living
~~~

The exporter creates detached evaluated meshes in a temporary scene, converts placement to meters, strips all materials/textures and exports embedded GLB with export_extras=True. Modifiers are evaluated on temporary meshes. Parent-induced shear is baked into mesh vertices after decomposing the world transform into TRS. All temporary objects/meshes/scenes are removed; authoritative geometry is unchanged. Manifest source_sha256 hashes the saved .blend read for that export. Blender source is Z-up; glTF proxy is Y-up/meters. The exporter declares both frames.

## Adapter commands

~~~sh
npx tsx scripts/create-intent.ts \
  examples/blender-v02/artifacts/interaction_proxy.manifest.json \
  examples/blender-v02/request.json

blender --background --factory-startup examples/blender-v02/authoritative.blend --python-exit-code 1 \
  --python adapters/blender/apply_intent.py -- \
  --intent examples/blender-v02/request.json \
  --result examples/blender-v02/execution-result.json
~~~

The adapter validates version, design/source identity, exact current source SHA, revision, stable global ID, native locator and mutability before changing anything. It converts proxy [x,y,z] meters into Blender [x,-z,y] scene units divided by source_unit_scale. It moves targets, increments rev-NNNNN, saves a temporary sibling .blend and atomically replaces the source, and writes an applied result. A failure writes status=rejected, an error code/message and no mutation; exit status is 2.

Re-export after an applied result. The new manifest has the new revision and SHA; the same IDs map to moved objects. Replaying the old intent is rejected before mutation. Immutable objects are rejected even when revision/hash are current.

## One-command gate

~~~sh
npm run blender:e2e
~~~

The runner creates a temporary .blend, exports a full proxy, creates a +0.50m proxy-X intent for ent_sofa_001, applies it, verifies rev-00001 -> rev-00002 and Blender location [-1.0, 0.0, 0.45], rejects stale replay and immutable wall, re-exports, and checks the same IDs in the new GLB. It deletes temporary files afterward. npm test skips these subprocess tests when Blender is unavailable; npm run blender:e2e remains the explicit acceptance gate.

## Failure and safety behavior

Source objects are untouched until every target and the whole request validates. A failed save leaves the original source bytes intact and restores in-memory transforms/revision. A failed export deletes only temporary duplicates; the source remains untouched. Generated artifacts and .blend files are ignored. The adapter does not keep an execution database or provide undo across tools; callers should deduplicate request_id and inspect the new revision before issuing a new request.

Both commands acquire a source lock and reload the saved file inside that lock before hashing/exporting or validation/mutation. Interrupted processes can leave SOURCE.blend.spatial-canvas.lock; remove it only after checking no writer is running. The lock coordinates these offline tools; external Blender sessions should not save concurrently. A source hash is rechecked before atomic commit. The producer publishes GLB then manifest; load the pair only after the command finishes. No cross-file atomic transaction is claimed.

Source scale is meters per scene unit, not units per meter. Native scale .01 denotes centimeters and .001 denotes millimeters. Manifest source_frame uses those named units when available; arbitrary scales are represented by extensions.spatial_canvas.blender.meters_per_scene_unit and source_coordinate_frame. The proxy always remains Y-up meters.
