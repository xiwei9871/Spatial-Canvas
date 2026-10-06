# Project Onboarding

Use the generic template in `templates/project` and run:

```sh
npm run project:init -- --dir /path/to/new-project
npm run project:inspect -- --dir /path/to/new-project
npm run project:validate -- --dir /path/to/new-project
```

`init` creates placeholders and refuses to overwrite a non-empty directory. Replace all example IDs, locators, revisions, frame/unit/up-axis values and SHA-256 values before importing real evidence. It never edits the authoritative source. `inspect` prints a concise readiness summary; `validate` writes `project-readiness.json` and leaves missing or placeholder evidence blocked. The CLI is a file/provenance precheck: the presence of a manifest/Space Registry/graph yields at most PARTIAL, not full geometry or semantic certification. Complete actual Workspace and adapter checks.

## Checklist

1. Inventory authoritative sources and decide editable versus frozen authority. Record resource ID, revision, SHA-256, locator, coordinate frame, unit and up axis.
2. Use embedded IDs only for explicitly editable sources. Use an external frozen binding registry for read-only sources and validate coverage.
3. Export a full or task Interaction Proxy. Check stable IDs, manifest source linkage, entity count, transforms and coordinate conversion. Preserve meaningful source interaction boundaries; test independent Hide/Ghost on nearby wall segments. Record deliberate semantic merges and native/global mapping; see [Interaction Boundary Preservation](INTERACTION_PROXY.md).
4. Import structured space evidence first, then normalized CAD/IFC/FreeCAD/authored boundaries. Keep weak or approximate regions `candidate`; use `PARTIAL` or `BLOCKED_FOR_SPATIAL_CONTEXT` when evidence is missing.
5. Import a typed Relationship Graph. Keep `part_of`, `connected_to`, `embedded_in`, `adjacent_to`, `supports`, `opens_to`, `accesses` and `transition_between` distinct. Geometry candidates never become verified automatically.
6. Run project readiness and fix the listed actions. Relationship capabilities are scoped independently: component hierarchy, physical connectivity, space adjacency and transition graph.
7. Perform at least one actual browser click and copy a ContextPacket. Confirm identity, source provenance, hit, space status, relation neighborhood and gaps.
8. Give only the AI Handoff text to a fresh agent. It should answer from the packet without scanning the source scene, and it should preserve `candidate`, `rejected`, `unresolved` and `unavailable` states.

## Failure handling

An invalid manifest/GLB pair, stale revision, SHA mismatch, wrong design, malformed registry/graph, missing locator or incompatible replacement must show an actionable error and must not retain stale semantic trust. Physical selection may remain available when the semantic layer is unavailable. Frozen sources are never modified as a recovery step.
