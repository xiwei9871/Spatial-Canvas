# View Handoff Maintenance Implementation Plan

**Goal:** Save the user's exact camera and temporary view state so Blender reproduces it without inferring the view from a screenshot.

**Architecture:** Extend the existing camera snapshot with an independent ViewPreset protocol. Keep source-space conversion testable, viewer overrides reversible, and Blender application read-only with provenance checks.

**Tech Stack:** TypeScript/Zod/Three.js, Blender Python, Vitest/unittest.

- [x] Add protocol and handoff tests before implementation; retain normalized rotation, provenance and conflicting-ID rejection.
- [x] Add basis × camera rotation conversion and test local axes plus projected points.
- [x] Implement viewer hide/ghost/show/isolate, hidden-raycast filtering, save/restore/lock and local bookmark persistence.
- [x] Export explicit JSON/PNG links and copy numeric View Handoff; reject stale or unknown-ID imports.
- [x] Implement pure Python validator and Blender adapter with sidecar/source checks, source-unit conversion and per-object ghost materials.
- [x] Run real Blender centimeter-scale/projection/shared-mesh/stale gates.
- [x] Run C-Type browser export, lock and bookmark-reopen checks and fresh .blend projection verification.
- [x] Independent review and reported camera/visibility fixes; final checks pass.
- [x] Source-only staged scope verified; commit/push prepared, stop at review without merge.

Scope excludes geometry/design changes, multiple-view management UI, orthographic sources, live sync and V0.6 work.
