# Issue #13 production workflow freeze

Goal: document the verified present Workspace and preserve native interaction boundaries before a maintenance PR.

Branch: codex/c-type-wall-identity in Spatial-Canvas. Base main is 3b9a666; the already implemented view-handoff maintenance commit 0711376 is retained, not reimplemented here. C-Type wall repair commit 65346dc lives in internal-design; its reproducible recipe and validation are packaged here without private model binaries.

- [x] Read full Issue #13 and compare main/maintenance source with actual localhost UI.
- [x] Rewrite README around current usage; write WORKFLOW and UI-by-function USER_GUIDE.
- [x] Add Interaction Boundary Preservation principle, producer checklist and source-traceable C-Type case.
- [x] Package the existing wall-part maintenance recipe with explicit local inputs; add wall regression checks using existing unittest.
- [x] Rerun current checks, schema reproducibility, Blender/source and actual single-wall browser smoke; audit docs links.
- [x] Independent documentation/code review; original path rebasing issue corrected and bundled recipe rerun.
- [x] Explicit source-only scope and staging checks; commit/push prepared.
- [ ] Create Spatial-Canvas PR against main and attach it; never merge.

No new camera system, semantic system, rendering pipeline, live sync, provider integration or design geometry is introduced.
