# V0.3 validation: real R4 read-only dogfood

Validated on 2026-10-04 with Blender 5.2.1 LTS, Node 24.14.1 and the local Workspace. Baseline main is merged PR #4, f9256dc. No change was made in the interior-design repository.

## Frozen authority gate

Authority: projects/c_type_home/design/bedroom_door_r4/OPTION_A_SLIDING_R4.blend in the local interior-design project, as named by its AGENTS.md and R4_DELIVERY_MANIFEST.json.

Expected and actual SHA256 before/after:

~~~text
d109c7efcfa2b2b2565e4c073ee0cdf5282b23c01122bc9c1bbe7b8791ac3afb
~~~

File size remained 1,584,568 bytes. mtime remained exactly 1790946023854530466 ns. The delivery manifest hash also remained unchanged. Nanosecond timestamps are retained as strings in cross-language evidence to avoid JavaScript integer rounding.

Sidecar initialization produced 987 external UUID mappings without adding any source custom properties. The full proxy contains 987 registered meshes. A task proxy contains three explicit bindings: the sofa component B11_Rectangle046_CATALOG_00_00 (the source inventory's assembly is SOFA_3S), R4_BEDROOM_DOOR_LEAF and R4_DOOR_WEST_CONNECTED_RETURN. Semantic labels were annotated in the sidecar only; other inventory entries remain unassigned.

## Actual browser capture

Loaded the real task manifest/GLB into the Workspace. Clicked geometry in the viewport for all three objects and used Export ContextPacket. Each packet carries:

- exact absolute R4 source locator and full frozen SHA;
- source_revision=r4 and source_authority=frozen;
- registry ID/revision/actual byte hash/locator;
- persisted entity ID, verified native object locator and semantic metadata;
- camera pose, projection matrix, orbit target and viewport;
- actual proxy raycast hit plus source c_type_world coordinate conversion;
- mutable=false and derived proxy authority.

Observed source-space hit examples (meters):

| Native object | Source hit XYZ |
| --- | --- |
| B11_Rectangle046_CATALOG_00_00 | [3.826300478, 10.300819493, 0.523588762] |
| R4_BEDROOM_DOOR_LEAF | [8.632501423, 4.460199814, 1.604010769] |
| R4_DOOR_WEST_CONNECTED_RETURN | [7.997723410, 4.500199795, 2.741199760] |

Saved the exact displayed JSON as sofa.context.json, door.context.json and wall.context.json under ignored task-output/v03-c-type/. Browser interaction captures are manual evidence, not an automated UI suite. The in-app download notification has the known V0.2 automation limitation; displayed packet JSON was preserved directly.

Ran inspect_context.py with each packet, without specifying/searching the source in the command. All three returned resolved_read_only, resolving the explicit native object in verified R4 and confirming the source hit lies in its evaluated world bounds. The source SHA/size/mtime gate still passed afterward. This establishes real context-based object localization; no AI SDK or source mutation is involved.

## Automated checks

- npm run check: lint/typecheck/build pass; 48 Vitest tests pass in 9 files, including the prior V0.1/V0.2 gates.
- 15 actual bpy tests pass, including frozen metadata-free export, immutable extras, unchanged source SHA/mtime, accidental initialization refusal, sidecar overwrite protection and concurrent registry change rejection.
- npm run test:adapter: 5 Python request/coordinate tests pass.
- npm run test:bindings: 3 Python registry tests pass.
- npm run context:validate: real full/task identities, three packets, source/registry hashes, view/hit/provenance and source-space conversion pass.
- Schema and V0.1 fixture regeneration are consistent.

Independent review identified and verified fixes for result/registry output aliasing, frame/unit conversion inconsistency, and mismatched parse/hash registry snapshots. Existing build annotation/bundle-size advisories remain non-blocking.

## Artifacts and boundaries

Source paths and exact local evidence are in task-output/v03-c-type/source-before.json, source-after.json, context-validation.json and the three packet/resolution files. Full/task GLBs, sidecar/inventory JSON, logs and screenshots remain local and ignored. No existing asset was deleted or moved.

V0.3 is read-only dogfood. Sidecar semantics require deliberate review, not automatic inference. Consumer lookup must recheck source/registry hashes. Unknown source revisions/native changes do not auto-rebind. No WebSocket, watcher, extra Blender editing operation, image/DOM/UE viewer or provider SDK has been added.
