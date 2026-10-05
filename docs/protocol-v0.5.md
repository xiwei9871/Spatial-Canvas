# V0.5 Relationship Graph and Connectivity Semantics

## Contracts and identities

`spatial-canvas.relationships.v1` is an external, tool-agnostic graph. Nodes have stable node_id, entity/space/level/component_group kind, display name and source resource. Entity IDs match global IDs and preserve native locators. Spaces/levels reference a specific Space Registry revision/SHA. Component groups can be external semantic assemblies; they need not be Blender objects. Every graph source has resource ID, revision, SHA and optionally a locator (the offline validation workflow requires readable locators).

Every edge has a stable edge_id, typed from/to, evidence source revision/SHA, provenance method/evidence, optional confidence/geometry evidence, and verified/candidate/rejected state. Verified/rejected states require reviewer, timestamp and a note. Graph revisions change on review; edge IDs and original provenance remain unchanged. Naming-only evidence cannot be verified. Source hierarchy establishes membership only; geometry and spatial inference output candidates, never automatic functional facts.

| Type | Meaning and query behavior |
| --- | --- |
| part_of / contains | Directed component hierarchy; inverse query views of the same membership fact. |
| connected_to | Symmetric direct physical/geometric/functional connection, retaining the evidence's meaning. No group traversal. |
| adjacent_to | Symmetric spatial adjacency; neither direct connection nor polygon overlap. |
| embedded_in | Directed installation/embedding, separate from membership and contains. |
| supports | Directed support relation; reverse direction does not imply support. |
| opens_to | Transition subject opens toward a named space/level. |
| accesses | Directed access association, distinct from opening direction. |
| transition_between | One entity/group subject and a complete set of >=2 distinct space/level endpoints. `to` mirrors the first endpoint; endpoint order does not change semantic identity. |
| same_component_group | Symmetric entity membership association; never a direct connection. |

Runtime integrity rejects duplicate node/source/edge IDs, missing endpoints, semantic duplicates including symmetric reversal and inverse contains/part_of, self edges, wrong physical/transition endpoint kinds, stale evidence triples, and cycles across membership/contains/embedding. Rejected hierarchy edges do not establish ancestry. Malformed graphs are not repaired or silently rebound. JSON Schema covers portable shapes; geometric, graph-ID and cross-resource relationships additionally need runtime checks.

## Queries and compact packets

Pure functions accept `(graph, nodeId)` with optional type: getRelations, getParents, getChildren, getConnected, getContainingGroups, getTransitionsForSpace and getAdjacentSpaces. Results preserve original edge IDs, ownership/type, review state and provenance. Relation views expose direction and query_type for inverse hierarchy interpretation. All transition endpoints query the same full n-ary edge; filtering connected_to never returns a transition. getConnected includes symmetric incoming edges and does not walk membership.

ContextPacket V1 gains optional `relationships`. It contains selected subject, optional actual primary space, graph/artifact identity/SHA, relevant nodes, original typed edges, evidence source references, capability status and gaps. It includes direct relations, parent component chain, ancestor-owned embedding/transition relations and related component members. An ancestor `sink embedded_in cabinet` is kept as an ancestor edge; it is not rewritten as `bottom embedded_in cabinet`.

Neighborhoods are capped at 25 ancestry-proof edges, 50 total edges and 200 nodes, with truncation diagnostics. Membership proof is prioritized so an ancestor relation is never detached from its traversal. N-ary endpoint sets are included whole or the whole edge is omitted. Consumers must not claim completeness when truncated. Available packets must match design/model revision/SHA, selected native/global identity and hit-resolved primary space. Full proxies reject unmapped graph entity IDs; task proxies retain declared external native locators with an explicit source-verification diagnostic. Graph Space Registry bytes/revision/design/model applicability must match the loaded registry. Missing, stale or invalid graphs leave physical selection usable and relation context unavailable; malformed replacement imports clear old verified results.

## Relationship readiness

`spatial-canvas.relationship-status.v1` separately reports component_hierarchy, physical_connectivity, space_adjacency and transition_graph. It is optionally embedded in ProjectSemanticStatus and ContextPacket spatial semantic status; room readiness is not used as a substitute for connection readiness.

Each capability is READY only for declared required node/type pairs with reviewed matching directed relations and no outstanding gaps/candidates. A single observed edge without a completeness scope is PARTIAL. Missing requested evidence is BLOCKED; capabilities with no supplied/requested evidence are NOT_REQUESTED. Rejected edges never fulfill a requirement. Scoped READY does not assert exhaustive project connectivity, construction approval or plumbing knowledge. The graph can explicitly report missing plumbing without requiring every project to implement plumbing.

## Discovery, geometry and review

The generic discovery API prefers explicit validated graphs from any normalized adapter (authored JSON, IFC/FreeCAD semantic exports, CAD assembly data). If only normalized native hierarchy/AABBs exist, it produces membership/contact candidates and specific missing-functional/spatial/transition diagnostics. Blender's read-only exporter records native parents, collections and evaluated world AABBs and checks source bytes/mtime after reading. It never initializes IDs or saves the source. Native IFC/FreeCAD relationship extraction is a normalized import boundary in V0.5, not a new BIM parser/editor.

Candidate rules are conservative and preserve explicit source/frame/unit/tolerance evidence:

- Evaluated AABB boundary contact is a review candidate. Nearby separated boxes produce no edge. Box contact alone is not proof of surface/function connection.
- Spatial adjacency requires a positive shared polygon boundary segment; positive-area overlap, point touching and proximity do not count. Height compatibility still needs review.
- Opening/vertical transitions preserve complete endpoint sets and actual side-probe/height evidence as candidates. Endpoint names and operational passage need independent confirmation.

Example offline workflows:

```sh
blender --background --factory-startup --python-exit-code 1 --python adapters/blender/export_relationship_evidence.py -- --source source.blend --names ObjectA ObjectB --output NEW-evidence.json
npm run relationships:discover -- --evidence NEW-evidence.json --bindings bindings.json --output NEW-candidates.json
npm run relationships:review -- --graph graph.json --edge rel_001 --state verified --reviewer owner --note "Reviewed source evidence" --revision 2 --output NEW-reviewed-graph.json
npm run project:ingest -- --project project.json --spaces spaces.json --relationships graph.json --output NEW-status.json
npm run relationships:validate -- --graph graph.json --packet sink.context.json --packet door.context.json --output NEW-validation.json
```

The discovery CLI maps exact external bindings, normalizes native scene units to meters, and checks source bytes. Review and validation use new output paths, refuse input/source aliases and do not overwrite prior graph versions. Validation rechecks all readable graph evidence source bytes, registry bytes, packet graph revision/hash and exact recomputed neighborhood. Hashes use original bytes, with BOM-aware JSON decoding.

## Workspace and limits

Import project/Space Registry as in V0.4, then use **Import relationship graph**. The focused Relationships panel lists original owners/types/targets and visually distinguishes verified/candidate/rejected. ContextPacket copy/export captures the relevant graph neighborhood; it does not scan a scene or dump the full project graph.

No graph database, full graph editor, CAD topology solver, automatic pipeline reconstruction, live sync, WebSocket, cloud collaboration or physics reasoning is implemented. Model-level direct connections are not fabrication or plumbing approvals. Frozen authority stays unchanged. C-Type graph artifacts are local; the small generic fixture in examples/relationships proves tool/project independence with symbolic synthetic source IDs.
