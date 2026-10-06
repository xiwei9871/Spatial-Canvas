# Final v0.5.1 stable validation

Date: 2026-10-06. Validation began from **clean merged main** `ad47ce40f98d295cf3dd8ed7f5a2333381591238` (PR #14). The finalization branch changes documentation only; package/app version remains `0.5.1`. This is release-candidate evidence, not a statement that a finalization PR has already merged or that a tag has been published.

## Complete current checks

| Gate | Exact result |
| --- | --- |
| Lint | `npm run check` lint stage passed |
| Typecheck | `tsc --noEmit` passed; build repeats typecheck |
| Vitest | 30 files, **122 tests passed** |
| Build | Vite production build passed |
| Schemas | 19 contracts regenerated; `git diff --exit-code -- schemas` passed |
| Fixtures | Full 3468-byte/4-entity and task 2388-byte/2-entity fixtures reproduced; no `examples/living` diff |
| Python | Contracts 5 + bindings 3 + camera 2 + wall partition 2 + semantics 5 = **17 passed** |
| Real Blender | Existing adapter/export/frozen-source suite **19 passed**, plus real camera scale/projection/linked-material/stale gate **1 passed** |
| Blender E2E | Source revision rev-00001 → rev-00002, +0.5 m X sofa move, five full/one task entities, stable ID retained; stale replay, immutable wall, malformed input and wrong frame rejected without further source mutation |
| Onboarding | Actual `project:init`, `inspect`, `validate` smoke passed; template evidence remains BLOCKED with required actions |

Environment: installed Blender 5.2.1 LTS; Node.js meets the existing >=22 convention. No new testing framework or dependency was added. Existing nonblocking dependency annotation and bundle-size advisories remain; they are not validation failures.

## Real C-Type / AI handoff

Loaded the existing `r4-walls-view-review-1` manifest/GLB pair, matching project/Space Registry and relationship graph into the actual V0.5.1 Workspace. The UI reports 1017 entities. Selected `VIEW_WALL_W_wall_md_0006`, used Frame selection, then made a real pointer click at source-space `[2.900099992752075, 8.37059920707738, 1.9413334399369289]`.

ContextPacket resolves the exact wall native/global ID and source revision/hash. `Copy AI Handoff` really copied that context to clipboard. Space readiness remains PARTIAL and relationship output is available with its truncated neighborhood explicitly marked; no candidate/unresolved status was promoted.

Ghost and Hide affected only that wall part, neighboring walls remained visible/opaque, and Show all restored. Temporary visibility is viewer state; authoritative source files were not saved or edited.

## Exact view handoff

Saved the existing numeric ViewPreset under a validation name, locked the camera and attempted a drag: position/quaternion remained identical. Copy View Handoff and JSON/PNG export passed; reference PNG was nonempty. Applied the exported preset to the matching local source via the existing Blender adapter, saving only a separate derived snapshot.

Fresh reopen of that snapshot verifies source-space position/quaternion, vertical FOV, aspect/resolution and **three independently calculated projected points**. No camera architecture or render feature was added by this finalization.

## Native wall identity

The existing read-only wall regression passed again: **98 independent parts + 919 unchanged ID/native mappings = 1017 fresh-import GLB entities**; all 98 bounds checked. Surface coverage sampled at 1356 points; maximum across both parent walls is **0.9512949036434293 mm**, within the existing case's 1.5 mm gate. Surface area is conserved; current parent source meshes and non-wall geometry remain unchanged.

Exactly 98 new `part_of` edges are present; inherited graph edges remain unchanged. No room assignment, adjacency, connected_to or other inferred physical relationship was added. These are derived view surface parts, not new closed construction solids. See [Issue #13 evidence](issue13-validation.md) for the original case and corrected aggregate-error reporting.

## Frozen source integrity

Frozen source: `/Users/xiwei/interior_design/projects/c_type_home/design/bedroom_door_r4/OPTION_A_SLIDING_R4.blend`.

SHA-256: `d109c7efcfa2b2b2565e4c073ee0cdf5282b23c01122bc9c1bbe7b8791ac3afb`. Size: **1,584,568 bytes**. Mtime: **1790946023854530466 ns**.

Captured the full source bytes before final validation and compared after Proxy/view/Hide/Ghost/handoff/camera workflows: **byte-for-byte equal**, identical SHA-256, size and mtime. The known frozen kitchen and manifests also pass the existing native-wall regression's integrity snapshots.

## Hygiene / release boundary

No tracked working `task-output/` or `artifacts/` files, no new private models or debug binaries, no new local absolute paths in source/current operational docs. The source path above is an intentional validation record. Historical protocol/PR/validation documents remain historical evidence; no useful evidence was deleted or history rewritten.

Operational README/workflow/UI/onboarding/Proxy/maintenance docs remain coherent. The stale maintenance paragraph that said main lacked PR #14 is corrected. There is no active speculative V0.6 commitment; negative scope statements in docs explicitly exclude it. Relative docs links were checked.

Generated logs, source-byte snapshot, onboarding artifacts, real C-Type packets/previews/presets and camera snapshot stay in ignored `task-output/finalize-v051/`. No automatic merge, tag, release, live sync or additional design work occurred.

`v0.5.1-stable` was not present remotely at preflight. The **actual merge commit of the finalization PR after user merge** is the eventual tag target. Until that merge occurs the target is unknown; do not tag `ad47ce4` or the branch-head commit merely because it has passed checks.

Release notes: [v0.5.1-stable](../releases/v0.5.1-stable.md). Policy: [Finalized / Stable / Maintenance](../MAINTENANCE.md).
