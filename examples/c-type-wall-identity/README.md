# C-Type native-wall identity maintenance recipe

This packages the existing source-only repair from `xiwei9871/internal-design`, branch `codex/c-type-wall-identity`, commit `65346dc`, for review alongside Spatial Canvas Issue #13. It is a local engineering case, not a general automatic wall reconstruction feature.

The copied algorithm is unchanged: partition the current two R4 wall-shell surfaces according to authored Blender wall-input boxes, keep semantic traceability and deterministic part IDs, hide the two parent shells only in a derived review. It creates no construction caps and keeps all other objects untouched.

## Local inputs

Pass the local C-Type project root containing:

- `design/dining_chairs_r4_review/OPTION_A_R4_DINING_CHAIRS_ALIGNED_REVIEW.blend` (pinned SHA `e2f3f107eb6619ae28a363e0e4e36019cdae94c89aabe9ac4b8c0c07b14b14ac`) and its `spatial-canvas.bindings.json`.
- `design/secondary_bath_options/r3/HOUSE_ROLLBACK_WALL_INPUT.json` and `A_WALL_INPUT.json`.
- `design/kitchen_divider_r4_review/PIER_AND_AC_QA.json`, with frozen source SHA/size/mtime snapshots.
- The referenced frozen R4/kitchen files and freeze manifests, used read-only for integrity checks.

Historical freeze-report paths are explicitly resolved relative to the report’s original project root and rebased under `--project-root`. Each rebased input must match its recorded SHA/size; its current mtime is captured before work and checked afterward. This validates the supplied local tree rather than accidentally checking another checkout.

Private sources, generated GLBs, bindings, screenshots and log files are not bundled in this repository. A fresh clone can run the pure partition/identity tests; the real dogfood gate requires these local inputs.

## Reproduce to a new output folder

```sh
blender --background --factory-startup --disable-autoexec \
  --python-exit-code 1 --python examples/c-type-wall-identity/restore_native_wall_identity.py -- \
  --project-root /path/to/c_type_home --out-dir /path/to/new-wall-review
```

The output must be new. This generates a derived `.blend`, `spatial-canvas.bindings.json`, `WALL_PART_INDEX.json` and `WALL_PARTS_QA.json`. Frozen sources and the pinned input review are never saved or moved. It does not export semantics or relationships automatically.

Export the saved review using the existing producer:

```sh
blender --background --factory-startup --disable-autoexec /path/to/new-wall-review/OPTION_A_R4_NATIVE_WALL_PARTS_REVIEW.blend \
  --python-exit-code 1 --python adapters/blender/export_proxy.py -- \
  --output /path/to/new-wall-review/proxy --scope full \
  --bindings /path/to/new-wall-review/spatial-canvas.bindings.json \
  --source-resource-id c_type_r4_walls_review --source-revision r4-walls-view-review-1 --color-mode zoning-flat
```

Regenerate source-linked project/Space Registry applicability for this exact derived hash/revision. Preserve inherited region evidence. The graph may retain inherited verified/candidate/rejected edges, explicitly rebind its model source and add exactly the 98 source-indexed `part_of` edges; do not promote rooms or introduce physical connectivity. The existing local dogfood files include this reviewed linkage; the build script deliberately does not invent a new graph.

## Regression checks

```sh
npm run test:wall
npm test -- --run tests/viewer.test.ts
blender --background --factory-startup --disable-autoexec --python-exit-code 1 \
  --python examples/c-type-wall-identity/validate_wall_identity.py -- \
  --review-dir /path/to/existing-complete-wall-review --report /path/to/new-validation.json
```

The real validator checks 98 part objects, 919 retained IDs, 1017 fresh-import GLB entities, wall bounds and aggregate surface area, source surface samples, original graph edges and only `part_of` additions, unassigned new room metadata, and frozen SHA/size/mtime. Reported deviation is the maximum across both wall parents, rather than the last parent's result.

Individual wall parts are surface subsets. Do not claim that they are closed solids or construction-ready walls. The current source has submillimeter surface/BVH variation at thin wall junctions; the documented 1.5 mm gate is for this view partition, not a construction tolerance.

Browser gate: load complete manifest/GLB + matching semantics/graph; click `VIEW_WALL_W_wall_md_0006`; Ghost/Hide only that entity and check a neighboring wall remains opaque/visible, then **Show all**. See [product boundary principle](../../docs/INTERACTION_PROXY.md) and [validation](../../docs/maintenance/issue13-validation.md).
