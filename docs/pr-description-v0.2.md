## Problem and behavior

V0.1 could emit semantic requests but could not execute them against an authoritative Blender file. This adds the offline producer/adapter loop: saved .blend → derived GLB/manifest → Workspace selection/intent → validated Blender world translation → revision bump/atomic save → reexport/reload.

Persistent scene/entity custom properties hold design/source/global IDs and revisions. Ordinary exports never invent IDs; explicit initialization persists UUID identities. Full/task exports share the V1 protocol. Producer exports evaluated per-entity meshes in an isolated temporary scene without materials/textures and preserves parent-induced shear in baked geometry.

The adapter validates schema, source/design, exact SHA/revision, stable/native targets, mutability and frame before any mutation. CLI operations lock and reload the source, apply world translations, bump revision and atomically replace the saved source. Separate execution-result.v1 applied/rejected/error envelopes acknowledge outcomes. Workspace adds only a single-envelope Download intent button.

## Real acceptance

An actual viewport selection of ent_sofa_001 generated +0.50m proxy-world X. The exact displayed JSON was saved and executed against the real fixture .blend. Reexport/reload retained the ID and changed browser world X from -1.5m to -1.0m, with rev-00001 → rev-00002 and a new source hash. Old request replay and a current immutable-wall request returned rejected and left source bytes unchanged.

See docs/validation-v0.2.md and docs/blender-workflow-v0.2.md. The in-app download-event API timed out during acceptance; the run saved exact displayed intent JSON rather than claiming a verified download notification.

## Validation

- npm run check: lint/typecheck/build passed; 38 Vitest tests in 7 files passed.
- npm run test:adapter: 5 Python contract tests passed, including +X/+Y/+Z and scales 1/.01/2.
- 14 real bpy tests passed, covering persistence/rename, ID and request gates, modifiers/textures, rotated parents/shear, source reload/initialization provenance and save rollback.
- npm run blender:e2e: saved-source/GLTFLoader/core-intent/adapter/GLTFLoader loop passed; full 5 entities/task 1 stable entity, revision update, bounds translation and rejection gates verified.
- Schema and V0.1 fixture generation consistent.
- Blender 5.2.1 LTS tested; Blender tests skip when unavailable in CI. Existing non-blocking dependency annotation/bundle-size warnings remain.

No WebSocket, watcher, live sync, provider SDK, rotation/scale/mesh editing or cloud services. Source and JSON/GLB outputs are separate transactions; load/export pairs after commands finish. Adapter supports static local semantic meshes and rejects unsupported transform controls. Do not merge without review.

Closes #3
