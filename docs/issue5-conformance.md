# Issue #5 conformance and handoff gate

Formal task: https://github.com/xiwei9871/Spatial-Canvas/issues/5.

This follow-up closes the gaps between the earlier V0.3 candidate and the formal acceptance specification.

## Contract changes

- Context selection explicitly includes primary_entity_id. It must identify a selected entity; it is null only for a cleared selection. An explicitly supplied valid primary is preserved. For legacy base selection events, the most recent surviving pointer hit is primary; otherwise the last remaining selected ID is primary. A conflicting primary/hit is rejected. Existing V1 selection/intent events remain unchanged.
- The exact world raycast hit includes a normal when available. Mesh-local face normals are transformed by the inverse-transpose world matrix and normalized. Source normals use the same axis rotation as source points, without unit scaling.
- camera3d includes projection=perspective, fov_degrees, near/far, world pose, orbit target, projection matrix and viewport. FOV is strictly between 0 and 180 degrees; far exceeds near.
- Context JSON Schema conditionally validates camera3d data, including mandatory projection/FOV. Zod additionally checks primary membership and cross-document provenance.
- Shared entity/binding authority validation allows exactly PHYSICAL_GROUND_TRUTH, SEMANTIC_GROUND_TRUTH, HUMAN_DESIGN_GUIDE, DERIVED_DESIGN_MODEL and PRESENTATION. No source file is silently migrated; unknown old labels require deliberate handling.
- Frozen export requires caller-supplied --source-resource-id and --source-revision matching the sidecar. It rejects missing/ambiguous native mappings; linked mesh dependencies are outside the supported frozen snapshot profile.

## Representative real source

Authored a reviewed 12-binding subset retaining the UUID identities from the original external registry. Original 987-object discovery artifacts are preserved; no existing asset was deleted or moved. The formal subset covers living sofas, furniture components, connected wall/header, door leaf, frame components, handle and hinge. Rooms with insufficient evidence remain unassigned.

The representative full proxy has 12 registered entities; the task proxy has the three primary dogfood targets. Both use the same interaction-proxy-v1 manifest and extras.

Real outputs are under ignored task-output/v03-c-type/representative/. Source remains the frozen R4 file named in its original authority manifest. Full SHA, byte size, mtime and delivery-manifest hash are unchanged. A fresh full/task export held the baseline source bytes in memory and compared the post-export bytes directly for equality; byte-preservation.json records this separate byte-for-byte gate.

## Practical Codex handoff

Dispatched an independent Codex agent named issue5_packet_handoff with no conversation history. The agent received only the path to the actual exported sofa.context.json and an identification instruction. Reading source .blend, GLB, sidecar, inventories, repository documents and heuristic scene scans was prohibited.

The agent read the single packet and identified:

| Question | Agent's identified value |
| --- | --- |
| Design/resource | c_type_home / c_type_r4; derived interaction resource res_c_type_r4_task |
| Primary/global ID | ent_d25c02916e634c6b810c2d13e29a9a62 |
| Native locator | B11_Rectangle046_CATALOG_00_00 |
| Semantic type/room | sofa / living |
| Revision | r4 |
| Source SHA | d109c7efcfa2b2b2565e4c073ee0cdf5282b23c01122bc9c1bbe7b8791ac3afb |
| Source point | [3.826300477672122, 10.300819492915661, 0.5235887615435662], c_type_world, meters |
| View | perspective, 45° FOV, correct packet camera position/target |

The reply also identified the world normals and explicitly refused to treat the packet as edit authorization. It distinguished packet assertions from independently checked source state: it did not claim it had verified source bytes or geometry.

Result: PASS for packet-only exact-object identification, without scene rediscovery. No timing-savings claim is made. The complete original reply is retained in representative/handoff-result.md. Pretty packets are about 3.9 KB; compact JSON is about 2.9 KB, with no embedded scene dump.

The source was independently hash-checked by the parent workflow. The separate read-only resolver verified each sofa/door/wall packet against exact native objects and source-space bounds; this verification is separate from the agent-only identification test.

## Browser and checks

Recaptured actual pointer selections of sofa, door and wall with the new required fields. All have valid primary IDs, finite normalized proxy/source normals and source revision/SHA. Camera position and target changed between the sofa and door captures. Legacy captures are retained unchanged.

Run:

~~~sh
npm run check
npm run test:adapter
npm run test:bindings
npm run context:validate -- task-output/v03-c-type/representative
~~~

Recorded results: lint/typecheck/build pass; 51 Vitest tests in 9 files, 15 actual bpy tests, 5 Python request/coordinate tests and 3 sidecar tests pass. Portable schema generation and V0.1 fixture regeneration are consistent. Existing non-blocking dependency annotation and bundle-size build warnings remain.

No transform execution against R4, no source custom-property writes, no source save, no WebSocket/live bridge, watcher, additional viewer, annotation or provider SDK.
