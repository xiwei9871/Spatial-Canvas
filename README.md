# Spatial Canvas

Spatial Canvas is a local-first interaction layer that lets humans and AI point to, select, annotate, and operate on entities across 3D, CAD, images, web pages, and other project artifacts without making the interaction representation authoritative.

V0.1 implements the 3D selection → stable identity → machine-readable request loop in [Issue #1](https://github.com/xiwei9871/Spatial-Canvas/issues/1). V0.2 adds the offline Blender producer/adapter loop in [Issue #3](https://github.com/xiwei9871/Spatial-Canvas/issues/3): a persistent .blend source can export a proxy, receive a validated request-only intent, bump revision after an authoritative transform, and re-export. Annotation, live sync and additional viewers remain future work.

## Quick start

Requires Node.js 22 or newer and a browser with WebGL2.

```sh
npm install
npm run dev
```

Open the local address printed by Vite (normally http://127.0.0.1:5173). Click **Load full example**. Click a box in the viewport to see its stable ID and metadata. Shift/Ctrl/⌘ click another box or entity row to multi-select. Click **Emit transform intent** to inspect the exact request JSON. The geometry does not move. **Download event log** exports the last 100 validated events.

Choose exactly one `*.manifest.json` and its referenced GLB together with **Open local export**, or drop both into the viewport. Local manifests never trigger a network fetch. **Reload proxy** refetches built-in fixtures; for local files it asks for the new export pair because browser File objects do not automatically track disk changes. No restart is needed. Invalid imports retain the previous scene. Task and full proxies use identical contracts; overlapping IDs retain selection within the same design.

## Architecture

```text
authoritative tool/source → offline producer → derived GLB + manifest
                                               ↓
                                      local browser workspace
                                               ↓
                                      selection / intent JSON
                                               ↓
                                future adapter validates and acts
```

| Path | Responsibility |
| --- | --- |
| `packages/protocol` | Contracts, container checks, stable identity validation; no renderer dependency |
| `schemas` | JSON Schema draft-07 contracts for non-TypeScript producers |
| `packages/core` | Selection transitions, reload reconciliation, revision-bound requests |
| `packages/viewer` | Three.js loading, raycast mapping, bounds, highlight and controls |
| `apps/workspace` | Local import, inspector, request form, event output |
| `adapters/blender` | Offline Blender producer/adapter and atomic source execution; no live bridge |
| `examples/living` | Original synthetic source and reproducible full/task fixtures |

Read [Protocol V0.1](docs/protocol-v0.1.md) before building producers/consumers. Source tool coordinates are separate from glTF meter/Y-up coordinates. Requests refer to the proxy world frame; adapters own conversion.

## Validation

```sh
npm run check
```

Runs lint, typecheck, Vitest, and build. `npm run schemas` regenerates contracts; `npm run fixture` regenerates fixtures. Tests cover manifest/version/revision validity, missing/duplicate IDs, ancestry, containers, selection, immutable/stale targets, world coordinates and portable schemas. CI also checks reproducible outputs.

## V0.1 scope and boundaries

Orbit/pan/zoom, pointer selection, multi-selection, highlight, search, frame selection, world matrix/bounds inspector, local paired-file import, reload, and translation intent generation. Every selectable mesh resolves through node extras or its closest identified ancestor. Names never provide identity. Browser actions neither write source files nor export an edited GLB. `mutable` is a source policy hint, not permission granted by the UI.

Blender live WebSocket bridge, bidirectional sync, collaboration, cloud storage/auth, databases, UE/FreeCAD integrations, AI provider SDKs, accurate materials, and large-file streaming are outside V0.1. Proxies must be self-contained, have one active scene, and have no textures/glTF extensions. Future versions may expand this profile.

With Blender 5.2.1 installed, run npm run blender:e2e for the V0.2 gate. See [the workflow](docs/blender-workflow-v0.2.md) and [real acceptance evidence](docs/validation-v0.2.md). It creates a temporary .blend, exports a full proxy, applies a +0.50m proxy-world X intent through adapters/blender/apply_intent.py, verifies rev-00001 -> rev-00002, rejects stale replay and immutable wall targets, then re-exports and validates stable IDs. See docs/blender-workflow-v0.2.md.

## Artifact policy

Working `task-output/`, `artifacts/`, `.blend`, and `.glb` exports are ignored. Keep large sources and working exports local or in an artifact store. Small authored fixtures under `examples/living/task-output` are allowlisted; see [provenance](examples/living/README.md).

The browser verifies manifest/node consistency, not authoritative source contents, which it does not load. An adapter must verify revision/SHA-256 against its actual source before acting and apply its own authority policy.

## V0.3 frozen sources and context

Frozen sources use an external binding registry and are never annotated or saved by the producer. See [Protocol V0.3](docs/protocol-v0.3.md), [frozen workflow](docs/frozen-workflow-v0.3.md) and [real R4 validation](docs/validation-v0.3.md). Editable sources retain in-source IDs. The Workspace exports a ContextPacket with stable selection, source locator/revision/SHA, entity metadata, current camera/viewport and a real pointer hit (or null).

## V0.4 spaces and project ingestion

Entities identify physical objects; spaces identify independently sourced regions. A continuous floor can resolve to different spaces at different hit points. Use **Import spatial semantics** to choose Space Registry and project descriptor JSON. The Workspace computes `READY`, `PARTIAL` or `BLOCKED_FOR_SPATIAL_CONTEXT`, exposes missing evidence/review/coverage diagnostics and includes the actual spatial result in copied/exported ContextPackets. No room context is inferred from an entity's name or `room_id`.

See [V0.4 protocol and ingestion workflow](docs/protocol-v0.4.md) and [real acceptance evidence](docs/validation-v0.4.md). Native source inventory is read-only; unsupported IFC/FreeCAD representations require normalized boundary exports. No BIM authoring or general room-reconstruction suite is implemented.

## V0.5 relationships

Use **Import relationship graph** to load typed, evidenced membership, direct connections, embedding, adjacency and transitions. The Relationships inspector and ContextPacket preserve original relation ownership and verified/candidate/rejected state. Component membership never implies physical connection; missing plumbing or transition evidence produces a gap. Capability readiness is separate from spatial readiness.

See [V0.5 protocol/workflows](docs/protocol-v0.5.md), [real sink/door/stair/wall validation](docs/validation-v0.5.md) and the generic fixture in examples/relationships. Graphs are external and frozen sources remain unchanged.


## Current stable scope

V0.1 selection · V0.2 authority loop · V0.3 frozen source + ContextPacket · V0.4 space semantics · V0.5 relationship semantics · V0.5.1 release hardening and onboarding. See [USER_GUIDE.md](docs/USER_GUIDE.md) and [PROJECT_ONBOARDING.md](docs/PROJECT_ONBOARDING.md).

The project enters Stable / Maintenance when the V0.5.1 closeout merges. Concrete bug, compatibility and small usability fixes remain allowed; speculative V0.6 feature work is outside maintenance.

For exact rendering viewpoints and temporary wall visibility, see [View Handoff / Camera Bookmark](docs/view-handoff.md).
