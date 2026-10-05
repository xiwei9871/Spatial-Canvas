# V0.4 validation: independent Entity / Space and honest ingestion

Validated on 2026-10-04 with actual frozen C-Type R4, a separate local V0.4 Workspace and two independent packet-only agent tests.

## Source and semantic evidence

R4 SHA256: `d109c7efcfa2b2b2565e4c073ee0cdf5282b23c01122bc9c1bbe7b8791ac3afb`. File size 1,584,568; mtime `1790946023854530466` ns. Delivery manifest SHA: `913dde0a9723567917ce109c9d305e282f4bec38b601713853682596d7a86824`. No source geometry or properties were edited, and no source save/initialization was performed.

The real source inventory includes frozen Blender R4, pre-Blender FreeCAD, semantic IFC, current-existing DXF, task01 plan polygons and task02 semantic schedule. IFC room records have names/placements without shape representations; FreeCAD CAD objects do not themselves establish verified spatial volumes. Legacy plan/semantic documents explicitly call their polygons approximate label regions, with lounge/corridor conflation and some wall crossings. These were preserved as candidates instead of elevated to ground truth.

The project owner explicitly confirmed in this task: curved platform is Lounge; east bedroom approach is separately Corridor. Lounge uses the actual frozen R4 fan footprint (2.635229788 m²). A bounded east-corridor interior segment uses X9.2–12.8/Y6.6–7.7 m, intersected with the actual R4 upper-floor footprint (3.96 m²). Registry provenance records owner role confirmation and model footprint evidence. Lookup height is an operational model-context interval, not surveyed construction dimensions. Remaining corridor scope and 12 other room polygons still require review.

## Actual browser clicks

Loaded the existing 920-entity source-visible, open-ceiling, zoning-colored R4 proxy. Before spatial import the page reported BLOCKED_FOR_SPATIAL_CONTEXT. After project/registry import it reported PARTIAL and exposed specific candidate/coverage gaps.

Both physical clicks selected:

- global ID `ent_084ea36d62f94353ad8064b7242e18f7`;
- native object `R4_UPPER_FLOOR_CONTINUOUS_STRAIGHT_THRESHOLD`;
- source `c_type_r4`, revision `r4`, frozen SHA above;
- unchanged object semantic_type/room_id `unassigned` and mutable=false.

| Actual source-space raycast hit, c_type_world meters | Spatial result |
| --- | --- |
| [6.5117887240614305, 5.504267044607284, 0.44999998807907104] | exact, space_lounge |
| [11.002360649079499, 7.1136041854247765, 0.44999998807907104] | exact, space_corridor_east |

The packets were copied from the actual Workspace clipboard, not constructed with synthetic hit points. Each contains registry ID/revision/SHA, actual source hit/normal, camera/viewport, reviewed region provenance and project-wide PARTIAL diagnostics. `validate-space-context.ts` rechecked all source hashes, exact registry bytes, model applicability and containment, proving the same physical identity with distinct spaces. Blender `inspect_context.py` independently reopened the frozen source read-only and resolved both packets to that exact floor object, checking their source hits against evaluated world bounds.

Two fresh agents each read only one packet, with no source/registry/scene scan. They correctly identified the physical global/native object, frozen source/revision/hash, exact point, independently resolved Lounge or East corridor, and project-wide PARTIAL limitations. Both explicitly preserved the object/space distinction despite entity.room_id being unassigned.

## Readiness limits

C-Type is deliberately PARTIAL. Only two local regions have owner/model evidence; 12 other polygons remain candidates, remaining corridor extent needs review, and declared upper/lower coverage domains have uncovered volume. The report also exposes a narrow legacy dining/lounging overlap near a boundary. The lower coverage domain is the living footprint and the upper domain is the main upper-floor component, not a claim of whole-project exhaustive coverage. READY requires completed declared domains and resolved diagnostics. No field/construction authority is inferred from this model-context experiment.

## Generic and regression gates

Tests cover a different generic design with explicit verified spaces → READY; unverified candidates → PARTIAL; missing room/region evidence → BLOCKED with supplementation; one physical entity → distinct spaces at different points; source/design/frame mismatches; invalid polygons/duplicate IDs; boundary ambiguity and non-unit/non-Z coordinates; vertical union coverage; ContextPacket actual-hit integrity; manual JSON supplementation. Existing V0.1–V0.3 tests remain included.

Python request/coordinate tests: 5 passed. Python binding tests: 3 passed. Native semantic inventory tests: 5 passed. Actual bpy tests: 18 passed. Source hash/size/mtime and delivery-manifest integrity are checked before final commit. Lint/typecheck/build passed. All 77 Vitest tests across 14 files passed after review fixes. All 15 generated schemas reproduce byte-for-byte. Existing non-blocking Zod annotation and bundle-size advisories remain. Independent review reports no remaining Important/Critical findings.

Local artifacts are under ignored `task-output/v04-c-type/`: project/space registry, source-inventory.json, semantic-status.json, two *.context.json and *.resolution.json files, region-review.png, two Workspace screenshots, space-context-validation.json and packet-only-handoff.json. Native source files, GLBs, model-specific registries/packets and images remain outside source review.

## Follow-up: user stair click and review integrity

The user selected STEP_1 at source point [7.445971016430495, 7.505165320109428, 0.30000001192092896]. It is outside the Lounge footprint and about 150 mm below its +450 mm floor. Registry revision 2-stair-candidate adds a separately sourced, explicitly unverified Stair transition prism from the R4 audit footprint X7.2–7.8/Y6.6–7.8 and operational 0–0.45 m height. The final Workspace identifies actual STEP_1 clicks as unresolved with that candidate rather than silently claiming Lounge or an approved stair region. Adjacency/topology is not inferred. Prior registries and packets are preserved.

Actual browser regression confirms that a foreign project import clears the claimed room result to BLOCKED while object ContextPacket copy still works. BOM-prefixed registry import preserves the exact original byte SHA, and acceptance CLI passes BOM-prefixed registry/project/two actual packet inputs. Runtime validation rejects forged native source coordinates even when their spatial result is internally consistent, and rejects source/view axis mismatch. Original real Lounge/Corridor packets still validate under these stricter rules.
