# Spatial Canvas Protocol V0.1

This contract connects an offline producer, a local interaction viewer and a future source adapter. Derived geometry is never authoritative. Selection describes focus; intent requests an operation. Neither performs or authorizes source mutation.

## Resources and durable identity

`schemas/resource.schema.json` defines `resource_id`, `design_id`, open `type`/`format` strings and `authority` (derived or authoritative). Future image/CAD/webpage/document/video viewers can reuse it. The V0.1 proxy manifest specializes it to `interaction_proxy`, `glb`, `derived`.

`design_id` is durable across exports, revisions and scopes. `source_resource_id` identifies a durable authoritative document. `resource_id` identifies a proxy resource and may remain stable across reexports. IDs are opaque nonempty strings; prefixes have no protocol meaning. The pair `(design_id, global_id)` is the semantic entity key.

## Manifest and provenance

See `schemas/manifest.schema.json` and the [example](../examples/living/task-output/artifacts/interaction_proxy.manifest.json).

| Field | Meaning |
| --- | --- |
| `schema` | Exactly `interaction-proxy-v1` |
| `design_id`, `resource_id` | Durable design and proxy identities |
| `type`, `format`, `authority` | Exactly `interaction_proxy`, `glb`, `derived` |
| `proxy_uri` | Relative path ending .glb; no schemes, absolute paths, backslashes or traversal |
| `source_resource_id` | Stable authoritative document identity |
| `source_resource` | Human-readable source locator; never fetched by the browser |
| `source_sha256` | 64 lowercase hex characters, hash of actual source bytes |
| `source_revision` | Opaque nonempty source revision token |
| `coordinate_frame`, `unit`, `up_axis` | Proxy world frame, `meter`, `Y` |
| `source_frame` | Optional original tool frame/unit/up axis |
| `entity_count` | Number of explicit semantic identities, not meshes |
| `scope` | `full` or `task`, same schema |
| `extensions` | Optional namespaced metadata |

All fields except source_frame/extensions are required. Entity revision/source/design must match the manifest. A hash traces provenance but does not prove proxy correctness; the adapter verifies actual source revision/bytes.

```text
task-output/
  artifacts/
    interaction_proxy.glb
    interaction_proxy.manifest.json
    preview.png
  task_report.json
```

Preview/task report are producer conveniences, not viewer inputs. Local import matches the proxy_uri basename; choose exactly one matching file. Producers should use unique basenames. Full/task exports may use different filenames and resource IDs while preserving durable entity IDs.

## Entity extras and binding

`schemas/entity.schema.json` defines required fields on explicitly identified glTF node extras:

```json
{
  "design_id": "design_living_demo",
  "global_id": "ent_sofa_001",
  "native_object_id": "LIVING_SOFA",
  "semantic_type": "sofa",
  "room_id": "living",
  "source_resource_id": "src_living_demo",
  "source_revision": "demo-r1",
  "authority_level": "HUMAN_DESIGN_GUIDE",
  "mutable": true
}
```

global_id persists across rename, revisions, simplification and scope. native_object_id is a current native locator that may change on rename. semantic_type/room_id are required opaque strings; `unassigned` can represent no room. Optional parent_id represents semantic ancestry independently of mesh hierarchy, and may refer to an entity excluded from a task proxy. Optional authority_level is a policy label for adapters. Missing mutable means unspecified; false blocks UI transform requests, while true never overrides adapter policy.

Each explicit ID appears exactly once. A semantic group can contain multiple meshes: descendants inherit the closest explicit ancestor until another identity appears. Structural groups need no identity; every mesh must resolve to one. Name guessing, import-time identity generation, and merging selectable semantic boundaries are prohibited. Three.js exposes node extras as userData.

V0.1 requires GLB 2.0, embedded buffers, one active scene, no orphan nodes, no textures and no glTF extensions. Duplicate IDs, missing identity, provenance mismatch, invalid hierarchy or wrong entity count reject an entire export before replacing the current scene.

## Spatial frame and derived geometry

glTF uses right-handed Y-up meter coordinates. Producers convert original tool coordinates and preserve evaluated world transforms. The inspector exposes a column-major 16-number world_transform and world axis-aligned bounding_box min/max vectors. Group bounds include descendants. Proxy geometry is low-detail, material-light and interaction-oriented. Bake modifiers/rigs/procedural geometry offline; keep source editing state outside the proxy.

source_frame is informational. V0.1 supplies no universal conversion matrix: adapters own conversion. Translation requests are world-space deltas in proxy meters; Blender/CAD adapters must convert them into their authoritative source frame.

## Selection

`schemas/selection.schema.json` describes the event:

```json
{
  "schema": "spatial-canvas.selection.v1",
  "design_id": "design_living_demo",
  "resource_id": "res_living_full",
  "source_revision": "demo-r1",
  "entity_ids": ["ent_sofa_001"],
  "mode": "replace",
  "source": "pointer",
  "timestamp": "2026-10-04T04:00:00.000Z"
}
```

entity_ids is always the **complete resulting selection**, in insertion order without duplicates. mode describes the gesture (replace/add/remove/clear), not a delta. Clear requires an empty array; remove may also result in empty selection. source is pointer/list/keyboard/reload. Timestamps use ISO-8601 UTC. Click replaces, modifier click toggles, background click/Escape clear.

Reload retains only IDs still present in the same design, then emits the resulting selection with new resource/revision and source=reload. Different designs clear selection. Failed imports preserve the last valid scene and emit no protocol event.

## Intent / action request

`schemas/intent.schema.json` defines a request-only envelope. V0.1 supports request_transform with one translation delta shared by all targets:

```json
{
  "schema": "spatial-canvas.intent.v1",
  "request_id": "req_example",
  "design_id": "design_living_demo",
  "resource_id": "res_living_full",
  "source_resource_id": "src_living_demo",
  "source_revision": "demo-r1",
  "source_sha256": "127b0ff6ced68cd347ac1490efd7bb9cfb6679c804e1b6df931b913edde2bce4",
  "targets": [{ "global_id": "ent_sofa_001", "native_object_id": "LIVING_SOFA" }],
  "intent": "request_transform",
  "authority": "request_only",
  "payload": {
    "translation": [0.2, 0, 0],
    "space": "world",
    "coordinate_frame": "living_proxy_world",
    "unit": "meter"
  },
  "timestamp": "2026-10-04T04:00:00.000Z"
}
```

Targets are nonempty and unique by global_id. Numbers must be finite. Runtime rejects unknown IDs, immutable entities and manifest/entity provenance mismatch. JSON Schema validates structure; uniqueness **by global ID**, document cross-linkage and native lookup additionally require semantic checks. Native IDs are hints to verify. request_id enables future deduplication. V0.1 defines no execution acknowledgment, provider integration or transport.

The workspace dispatches local CustomEvent objects named by the schema, displays exact validated JSON and supports event-log download. It has no remote receiver. A future adapter must reject stale revision/hash, verify stable/native identity, apply source authority policy, convert coordinate frames, deduplicate requests, and reexport after modifying the authoritative source. It must never execute a request by editing its proxy.

## Compatibility

Product V0.1 uses initial wire contracts named v1. Unsupported versions are rejected; no implicit migration. Nonbreaking additions can add optional fields or namespaced extensions. Zod V1 consumers ignore unknown fields; JSON Schema allows them. Required field changes, changed coordinate semantics, new intent operations or a broader GLB profile require a new contract version and deliberate consumer support. Generic resource type/format stay open; the GLB manifest is a strict specialization.

schemas/execution-result.schema.json is the V0.2 adapter acknowledgement extension. An applied result names the request, previous/new source revisions, design/source identity, targets and timestamp. A rejected result keeps the previous revision and includes code, message and optional details. It is separate from the original intent: receiving a result does not make the browser authoritative or imply a proxy mutation. npm run schemas generates draft-07 contracts from Zod and encodes selection uniqueness/clear constraints. packages/protocol/glb.ts handles GLB cross-document semantics.
