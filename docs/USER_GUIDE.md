# Spatial Canvas User Guide

Spatial Canvas is a local-first interaction layer that lets a person point to a real project entity and hand an AI compact, source-linked context describing what it is, where it is, which space it belongs to and how it relates to surrounding project structure.

It is not authoritative geometry, a replacement for Blender/FreeCAD/CAD, BIM authoring, live synchronization, an automatic design engine or proof of functional/mechanical connectivity. A derived proxy never overrides its source. A ContextPacket is context, not edit authorization.

## Typical workflow

Load a manifest and its referenced GLB together. Import the project/Space Registry and Relationship Graph that match the exact design, source revision and SHA. Click the real object. Inspect the entity, space readiness, relation types and verification state. Use **Copy ContextPacket** for raw JSON or **Copy AI Handoff** for a ready-to-paste packet-only prompt. If clipboard access is denied, select the displayed fallback text or use Export ContextPacket.

## Source authority

Editable sources may persist stable IDs inside the source when explicitly authorized. Frozen sources use an external binding registry and remain byte-for-byte unchanged. Every handoff preserves resource, revision and SHA provenance. A stale or mismatched registry/graph is rejected and must be regenerated for the current source.

## Spaces and relationships

`Entity != Space`: one continuous floor may resolve to different spaces at different hit points. `verified` means reviewed evidence; `candidate` means a useful but unapproved proposal; `rejected` is retained review history; `unresolved` and `unavailable` are explicit missing context. `part_of`, `connected_to`, `embedded_in`, `adjacent_to`, `supports`, `opens_to`, `accesses` and `transition_between` are different facts. Component membership is not direct connection. Missing plumbing or functional evidence is not permission to infer it.

## Troubleshooting

- Wrong manifest/GLB: select exactly one manifest and the GLB named by `proxy_uri`.
- Stale source: regenerate the derived registry/proxy for the current revision and SHA.
- Missing room: import reviewed Space Registry JSON; candidate polygons remain unresolved until reviewed.
- Missing relationships: import a graph with exact model/registry provenance; the packet can still contain object identity and spatial gaps.
- Large or partial project: read the readiness panel and complete the listed actions rather than treating `PARTIAL` as `READY`.

See [PROJECT_ONBOARDING.md](PROJECT_ONBOARDING.md) for the reusable checklist and CLI path.
