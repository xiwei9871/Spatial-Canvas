# V0.5 validation

Baseline is merged V0.4 PR #8 (`5adb686`). Work runs in an isolated codex/v0.5-relationship-graph worktree. Frozen C-Type R4 remains the authoritative model.

## Frozen source and named evidence

Source SHA256: `d109c7efcfa2b2b2565e4c073ee0cdf5282b23c01122bc9c1bbe7b8791ac3afb`; size 1,584,568 bytes; mtime `1790946023854530466` ns. Delivery manifest SHA is `913dde0a9723567917ce109c9d305e282f4bec38b601713853682596d7a86824`. Evidence exporter reads exact native objects without adding properties, changing geometry or saving the source. It records actual native parent/collection membership and evaluated source-world bounds; raw evidence never claims functional connections.

C-Type reviewed graph sources include exact R4, external Space Registry revision `3-relationship-candidates`, read-only native relationship evidence, named kitchen component register/builder and R4 door review. The graph has 40 nodes and 41 edges: 35 reviewed model relations and 6 candidates. Kitchen direct connections are reviewed from explicit open-bowl construction plus actual R4 bounds; parent/group membership alone is not used as contact proof. Reviewer records identify a source-evidence audit, not an owner/fabrication approval.

## Four actual pointer captures

Loaded the real 920-entity open-ceiling/zoning proxy, corresponding Space Registry/project and relationship graph in the V0.5 Workspace. Each capture is an actual viewport raycast, followed by Copy ContextPacket and preservation of the displayed JSON.

| Selected native object | Actual source hit (c_type_world meters) | Neighborhood |
| --- | --- | --- |
| B11_K-SINK_BOTTOM | [6.584078273460372, 0.41858050282482806, 0.6380000035278499] | 14 reviewed edges |
| R4_BEDROOM_DOOR_LEAF | [8.633136803061355, 4.460199814289808, 1.6626380201760462] | 2 reviewed + 3 candidate edges |
| STEP_1 | [7.535955972604741, 7.272099668403574, 0.30000001192092896] | 3 reviewed + 2 candidate edges |
| R4_DOOR_WEST_CONNECTED_RETURN | [8.063277618031623, 4.500199794769287, 2.8556079355451893] | 2 reviewed + 2 candidate edges |

Sink packet preserves four connected_to basin walls, two group-only faucet relations, exact parent sink assembly and ancestor-owned embedding into south run. It explicitly reports missing water/drain plumbing data. Door packet preserves assembly membership, both bedroom/approach transition endpoints and candidate opens_to/accesses. Stair packet preserves native stair-group members and a candidate lower/upper level transition plus lower-landing access; no Lounge adjacency is asserted. Wall packet provides only the north-face/shared-boundary adjacency candidate, never a nearby-furniture connection.

The relationship validation CLI rechecked every graph source's actual bytes/SHA, original graph byte SHA/revision, source/native identity and exact graph-neighborhood recomputation for all four packets. A separate generic discovery run over the same real native evidence produced 14 candidate hierarchy/contact edges, including two actual stair AABB-contact candidates; none was automatically verified. The review workflow wrote a distinct demonstration graph revision with preserved edge IDs/provenance and retained original files.

## Packet-only AI handoff

Three fresh agents each read only its sink, door or stair ContextPacket. Sink answer correctly distinguished four direct connections from faucet group-only relations and ancestor embedding, without plumbing claims. Door answer identified both named endpoints but retained candidate state and missing boundary approval. Stair answer identified the stair group and complete lower/upper candidate level endpoints without guessing Lounge adjacency. All three preserved frozen source/revision and capability/spatial gaps. Records are in ignored packet-only-handoff.json.

## Generic/regression coverage

The non-C-Type panel fixture contains two spaces, a door, partition wall, component group, two direct part connections and a nearby unrelated object with no connected_to edge. Tests validate hierarchy/inverses, symmetric connections, boundary adjacency and complete transitions. Generic discovery prefers explicit graph evidence, while raw mapped meshes expose candidates and missing functional/space knowledge. Readiness tests cover directed required relations, inverse contains and honest per-capability scope.

Independent code review findings were reproduced and fixed: unmapped/native-mismatched relation targets, missing membership proof during truncation, inconsistent transition endpoint filtering, wrong-direction readiness, foreign/stale Space Registry applicability, undisclosed ancestor/node caps and malformed replacement imports retaining old verified context. Reviewer reports no remaining Important/Critical findings for those fixes. Final CLI/discovery and ingestion review found further registry semantic-endpoint and capability-status validation gaps; those were fixed with synthetic negative CLI/ingestion tests. Reviewer confirmed no remaining Important/Critical findings. The offline packet gate now checks actual Space Registry membership/applicability, actual global/native bindings and recomputed graph readiness, not just matching bytes.

Lint, typecheck, build and all 109 Vitest tests across 25 files pass. Python contracts (5), bindings (3), native inventory (5) and actual bpy (19) tests pass, including the new read-only relationship evidence regression with observed red→green. All 18 protocol schemas reproduce byte-for-byte. Existing non-blocking build annotation/bundle advisories remain.

## Boundaries and artifacts

C-Type room readiness remains PARTIAL. Kitchen, door side polygons and landing boundaries are candidates; confirmed lounge/corridor regions are preserved. Component_hierarchy is READY only for the declared selected-assembly membership requirements. Physical connectivity, spatial adjacency and transition capabilities remain PARTIAL with explicit missing plumbing, endpoint and wall-side review gaps. No manufacturing, functional passage or inferred plumbing authority is claimed.

All real graph/space/project registries, native evidence, generated candidate graphs, four packets, screenshots, source-integrity snapshots and validation reports live under ignored task-output/v05-c-type. No production .blend, GLB, source registers or project-specific binary artifacts enter the PR. R4 integrity is rechecked before commit. No merge is performed.
