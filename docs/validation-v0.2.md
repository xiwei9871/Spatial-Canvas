# V0.2 real Blender loop validation

Validated locally on 2026-10-04 with Blender 5.2.1 LTS (9e2066aef7ef), its bundled Python 3.13, Node 24.14.1, npm 11.11.0 and the local browser Workspace.

## Actual browser → Blender → browser acceptance

Created a saved authoritative fixture using adapters/blender/create_fixture.py, exported it using export_proxy.py, and loaded the actual manifest/GLB pair with Workspace's local file picker. The viewport click resolved Sofa_Main directly to ent_sofa_001 through node extras. The inspector showed world translation [-1.5, 0.44999998807907104, 0], Y-up meters and rev-00001.

The Workspace generated request req_d51c7736-ec29-4423-a2a7-ba305b883526 for +0.50m proxy-world X with request_only authority and actual source SHA. Saved the exact displayed request JSON to task-output/v02-browser/web-intent.json without modifying it. The in-app browser download-event API timed out, so this acceptance run saved the displayed JSON directly; it does not claim verification of a browser download notification. A dedicated Download intent button produces a single request envelope separately from the event-log array.

Executed the saved web request:

~~~sh
blender --background --factory-startup task-output/v02-browser/authoritative.blend --python-exit-code 1 --python adapters/blender/apply_intent.py -- --intent task-output/v02-browser/web-intent.json --result task-output/v02-browser/web-result.json
~~~

Blender returned applied, retained global_id ent_sofa_001, changed authoritative location to [-1, 0, 0.44999998807907104], bumped rev-00001 to rev-00002 and atomically saved the source. Reexported using export_proxy.py and loaded the new pair with Reload proxy. The same entity resolved in the browser; inspector world translation changed to [-1, 0.44999998807907104, 0]. World bounding-box X minimum changed from -2.399999976 to -1.899999976. The new manifest contained the new source SHA and rev-00002.

Replayed the original web request against the current source: exit 2, rejected, stale_revision. Created a wall request with the current source hash/revision: exit 2, rejected, immutable_target. Verified the authoritative source SHA was unchanged by both failures. The Workspace also disabled transform generation for the immutable wall.

Local before/after screenshots, displayed inspector JSON, exact web intent and execution results remain under ignored task-output/v02-browser/. These are generated evidence, not committed authoritative project files.

## Reproducible automated checks

~~~sh
npm run check
npm run test:adapter
npm run blender:e2e
blender --background --factory-startup --python-exit-code 1 --python adapters/blender/tests/test_blender.py
npm run schemas
npm run fixture
~~~

- Lint, TypeScript typecheck and production build pass.
- 38 Vitest tests pass across 7 files, including the existing V0.1 tests and two Blender subprocess gates.
- 5 Python contract tests pass: +X/+Y/+Z conversion, scales 1/.01/2, inverse conversion and rejection of invalid fields/numbers/units.
- 14 real bpy tests pass: metadata, explicit initialization and persisted IDs, rename/native locator, duplicate/missing IDs, source unit validation, stale/wrong-design/wrong-source/hash/frame/immutable/unknown/native requests, no partial mutation, parent world movement, texture stripping/evaluated modifiers, non-unit export, source file/in-memory rollback, current-disk reload and shear preservation.
- The E2E runner creates a real temporary .blend, parses full and task exports through GLTFLoader, generates intent through the same core API as the web UI, executes Blender, rejects stale/immutable/malformed/frame requests, and parses the reexport through GLTFLoader. It asserts the same global ID, changed world matrix/bounds, new revision/SHA and unchanged source bytes after rejection.
- Schema and synthetic V0.1 fixture regeneration leave committed generated content unchanged.

The build retains the V0.1 non-blocking Zod annotation and bundle-size warnings. The test fixture's use_nodes call emits a Blender 6.0 deprecation warning on Blender 5.2; runtime export uses no materials/textures. No live bridge, filesystem watcher or AI integration is present.

## Review and supported boundary

Independent review reproduced stale in-memory geometry versus current disk hash and parent-induced shear loss. Added regressions and fixed both: every CLI source operation locks and reloads the .blend before validation/export/initialization; source hash is rechecked before atomic replacement; exporter bakes the residual affine transform into evaluated mesh vertices.

V0.2 supports static, local semantic meshes in the active source scene. Adapter rejects linked/animated/constrained/rigid-body/bone-parent targets and singular parents. Full export includes all eligible meshes; task export can filter room, global IDs or collection. Duplicate IDs anywhere in the file are rejected. Source hashing is exact byte matching; a manual save without revision bump still invalidates an old SHA. Reexport after manual changes before requesting further operations.

Adapters coordinate through a source lock; external tools must not save concurrently. Source save is atomic on the same filesystem; result JSON and derived GLB/manifest files are separate outputs, not a multi-file transaction. Read them after commands finish. If acknowledging an already committed source save fails, inspect source revision before retrying.
