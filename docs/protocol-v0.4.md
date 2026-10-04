# V0.4 Space / Region Semantics and Project Ingestion

## Independent identities

`Entity` retains global/native physical object identity. `Space` has stable `space_id`, name, open semantic type, level and a polygon prism. One floor entity may span many spaces. The clicked point determines containment; entity.room_id is never overwritten by spatial lookup. No source mesh splitting or metadata write is needed.

Contracts: `spatial-canvas.spaces.v1`, `spatial-canvas.project.v1`, `spatial-canvas.semantic-status.v1`; ContextPacket V1 optionally includes spatial_context. Old V0.1–V0.3 packets/manifests remain accepted. Zod runtime schemas are in packages/protocol/spaces.ts; generated draft-07 schemas are under schemas/. Geometric and cross-resource refinements run additionally at runtime: JSON Schema alone cannot prove polygon topology, per-property ID uniqueness, source linkage, coverage or actual hit consistency.

## Registry and provenance

A registry supplies registry ID/revision, design ID, `applies_to` model resource/revision/SHA triples, evidence source inventory, and declared coordinate frame/unit/up axis. Every region references an evidence resource's exact revision/SHA and preserves its method/evidence/confidence. IDs are authored/persisted and are not regenerated from names or mesh indices.

`verification.state=candidate` never becomes verified just because confidence is high or an IFC/FreeCAD record is called a room. Verified regions require reviewer, timestamp and decision note. Imported approximate source-plan polygons remain candidates until their current boundaries, coordinates, levels and vertical extent are reviewed. Names/type vocabularies are open; there are no C-Type room enums.

Prisms use a simple footprint with unique vertices, no closing duplicate, positive area, no self intersection and `z_min < z_max`. The height fields mean distance along the declared up axis, not necessarily world Z. Footprint axes are the two remaining axes in natural order: Z-up uses XY, Y-up uses XZ, X-up uses YZ. Source coordinates are not implicitly rotated. Query comparisons normalize declared units to meters, using a 1 µm boundary tolerance for exported float32 coordinates. Polygon clipping computes positive-volume overlaps and union coverage through vertical slices; overlapping regions cannot cancel uncovered area.

Shared polygon/vertical boundaries belong to all touching spaces; multiple matches produce ambiguous with no primary. A single candidate produces unresolved with its candidate provenance. Exact requires one verified match and no competing candidate. Outside all regions is unresolved. Missing hit, missing registry, stale design/model/evidence, or undeclared frame conversion is unavailable with actionable diagnostics. List/reload selections do not fabricate hit coordinates.

## Readiness gate

Project descriptors inventory available sources and declared levels/coverage prisms. Readiness is recomputed, ignoring arbitrary incoming status claims:

| Result | Meaning |
| --- | --- |
| READY | Every declared domain is covered by verified regions; no positive-volume overlap, unknown level, candidate or source mismatch. |
| PARTIAL | Registry exists, but candidate review, level/domain coverage or overlap remains unresolved. Local verified points may still resolve exactly. |
| BLOCKED_FOR_SPATIAL_CONTEXT | No usable registry or source/design/frame integrity failure. Object selection can continue; room claims cannot. |

Coverage is explicitly scoped to supplied domains. Missing levels/domains prevents READY. A READY result is not a claim that an undeclared building/storey exists or has been surveyed. The UI exposes candidate names, missing coverage and concrete supplementation actions. A packet includes the computed status alongside the containing region, so an AI can distinguish exact local context from incomplete project coverage.

## Ingestion and supplementation

1. Inventory exact available source paths, without modifying sources:

```sh
python3 adapters/semantics/discover.py --source model r1 /path/model.blend --source plan p1 /path/plan.json --output /new/source-inventory.json
```

The inventory prioritizes normalized explicit regions, then candidate plan/CAD data, then geometry-only evidence. JSON Space Registry imports are runtime-validated. Legacy room polygons and linear closed DXF LWPOLYLINE boundaries are candidates; layers/labels are retained, furniture outlines are not accepted as rooms. FreeCAD ZIP/XML and IFC space/storey records are inventoried; full native shapes/placements, curved or legacy CAD boundaries need a native adapter/export to normalized JSON. No automatic certainty is claimed when source evidence is weak. Unsupported sources generate supplementation requirements rather than silently becoming unassigned room context.

2. Author/edit registry JSON with reviewed source frames, boundaries and levels. Choose names/types, preserve IDs and change registry revision for a revised region definition. Record approvals for verified regions; keep unsupported areas as candidates/gaps. Save a separate version rather than overwriting frozen evidence.

3. Supply a project descriptor with source revision/SHA/locator and level coverage. Validate readable source bytes and computed readiness:

```sh
npm run project:ingest -- --project project.json --spaces spaces.json --output NEW-semantic-status.json
```

The CLI rejects input/output aliasing and existing output paths; unreadable or hash-mismatched sources block spatial context. Browser local import validates declared source/proxy relationships and hashes the exact imported registry text, but cannot inspect arbitrary native source paths. Read-only consumers must recheck actual source/evidence bytes before relying on a handoff.

4. Import the project and registry together with **Import spatial semantics**. Changes recompute readiness and current hit context; incompatible proxy reloads clear stale semantics. **Copy ContextPacket** and **Export ContextPacket** capture registry SHA/revision, matched space provenance/verification, exact query point and project gaps.

## Packet acceptance

```sh
npx tsx scripts/validate-space-context.ts --project project.json --spaces spaces.json --packet point-A.context.json --packet point-B.context.json --output NEW-validation.json
```

This rechecks source hashes, registry byte hash/model applicability, original hit/query consistency, and recomputed containment. Two acceptance packets must have the same physical entity ID and distinct exact space IDs. Spatial context claims remain separate from entity metadata and source authority. Actual source/model editing, live sync, a CAD editor, provider SDKs and cloud collaboration remain outside V0.4.
