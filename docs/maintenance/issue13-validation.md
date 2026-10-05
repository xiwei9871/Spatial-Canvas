# Issue #13 — production workflow / native wall identity validation

Checked on 2026-10-06 against Spatial Canvas main `3b9a666`, the inherited view-handoff maintenance commit `0711376`, and the actual localhost V0.5.1 UI. This task adds documentation and a source-only reproducible wall case/regression; it does not add a camera system or further design geometry.

## Repository boundary

The original C-Type repair script is committed in `xiwei9871/internal-design` at `65346dc`, branch `codex/c-type-wall-identity`. It was not a Spatial-Canvas branch. This Spatial-Canvas maintenance PR packages the recipe with explicit `--project-root / --out-dir` arguments and a self-contained surface helper, regression tests and product docs. The exact local models remain outside Git. Freeze-report paths are explicitly rebased to the supplied project root, checked against recorded SHA/size and snapshotted for in-run mtime invariance.

## Real wall gate

| Check | Result |
| --- | --- |
| Independent derived wall parts | 98 |
| Other native/global mappings retained | 919, exact ID/native pairs unchanged |
| Fresh GLB total entities | 1017 |
| Part world bounds compared with saved review | 98, within 0.02 mm |
| Sampled source surface points | 1356 (1200 main wall shell + 156 partition shell) |
| Main shell original / partition area | 637.3012523907366 / 637.3012423036275 m² |
| Partition shell original / partition area | 27.587136537826154 / 27.587133119115606 m² |
| Aggregate maximum sampled nearest-surface/BVH deviation | 0.9512949036434293 mm, below the case's 1.5 mm gate |
| New graph edges | Exactly 98 `part_of` edges; inherited edges unchanged |
| New region/room/connectivity claims | None; new `room_id` remains unassigned |
| Frozen sources and pinned previous review | SHA, file size and mtime unchanged |

The earlier local `PROXY_WALL_QA.json` summary reported only the last processed wall parent (0.00861 mm). The bundled validator now reports the maximum across both parents (0.9513 mm). The corrected value is recorded here instead of repeating the old “under 0.01 mm” aggregate claim. Partition parts are derived surface subsets, not new closed construction solids. Numeric deviation at thin junctions is documented; source meshes themselves remain untouched.

Frozen R4 remains SHA-256 `d109c7efcfa2b2b2565e4c073ee0cdf5282b23c01122bc9c1bbe7b8791ac3afb`. The wall-view review is SHA-256 `564ae8b36caea702d4ea556619f153bbe84e1ee04398f123a38f047bca2cedd6`, revision `r4-walls-view-review-1`; the pinned previous review is `e2f3f107eb6619ae28a363e0e4e36019cdae94c89aabe9ac4b8c0c07b14b14ac`. The original two parent surfaces remain unchanged and inactive in the new review; all other object states are unchanged according to the build QA.

## Actual UI smoke

- Read the actual controls before rewriting docs: V0.5.1 title; 27 non-entity controls including current hidden/fallback controls. The observed names match USER_GUIDE; main alone does not yet contain the inherited unmerged maintenance controls.
- Load matching 1017-entity wall Proxy; project/Space Registry and relationship graph remain loaded and source-linked.
- Search and Frame `VIEW_WALL_W_wall_md_0006`, then actually raycast click it. Pointer hit in source space was `[2.900099992752075, 8.37059920707738, 1.9413334399369289]`.
- Inspector resolves `ent_d09db1cf51ae51b3b7be413068dcc191` to that exact independent wall object.
- Ghost only the selected segment; adjacent wall remains opaque. Hide only it, then **Show all** restores. No source bytes changed.
- **Copy AI Handoff** really writes the selected native ID and `r4-walls-view-review-1` to clipboard. Relationship output contains `part_of`, and its bounded neighborhood is explicitly `truncated`; space is not promoted from PARTIAL/unresolved.
- Existing view controls were observed and documented, not implemented anew. ContextPacket does not include hidden/ghost IDs; saved ViewPreset is the separate complete visibility/camera handoff.

Local evidence is in ignored `task-output/issue13/`: UI controls, pointer ContextPacket/handoff, Ghost/Hide screenshots, native-wall JSON report, Blender/npm logs and onboarding smoke. This document records results so a public checkout does not depend on machine-specific evidence paths.

## Checks

- `npm run check`: lint, typecheck, 30 Vitest files / 122 tests, production build passed.
- `npm run test:adapter`: 5 Python tests; `test:bindings`: 3; `test:camera`: 2; `test:wall`: 2 passed.
- Real Blender `adapters/blender/tests/test_blender.py`: 19 gates passed, including exporter/frozen-binding behavior.
- `npm run schemas` and `git diff --exit-code -- schemas`: unchanged generated schemas.
- `npm run fixture` and `git diff --exit-code -- examples/living`: unchanged fixtures.
- `project:init / inspect / validate`: actual template smoke returns BLOCKED for placeholder evidence, as documented; no source authoring.
- Bundled recipe was rerun from a clean Blender process into a new ignored output folder: 98 wall parts, 919 retained mappings, zero residual wall area, fresh .blend reopen and frozen invariants passed. All 1017 ID/native mappings match the existing dogfood export.
- Relative documentation links and all listed UI/control names were checked against repository files and actual page.

Reproduction commands are in [the wall recipe](../../examples/c-type-wall-identity/README.md). Product rules are in [INTERACTION_PROXY](../INTERACTION_PROXY.md), operation sequence in [WORKFLOW](../WORKFLOW.md), and each control's role/boundary in [USER_GUIDE](../USER_GUIDE.md).

Review and PR are the release gate. No automatic merge, V0.6, live sync, new semantic/relationship vocabulary, provider integration or further C-Type design work.
