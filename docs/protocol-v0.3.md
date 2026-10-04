# V0.3 Frozen Identity and ContextPacket

V0.3 adds a frozen sidecar mode and a read-only context envelope. V0.1 selection/entity/proxy contracts and the V0.2 editable-source adapter remain supported. No additional mutations, live connections or viewers are introduced.

## Two identity modes

Editable sources keep durable identities in source custom properties. Initialization now requires explicit --initialize-ids --editable-source. Newly initialized authority labels use HUMAN_DESIGN_GUIDE. Existing source properties are not silently migrated.

Frozen sources keep identities in spatial-canvas.bindings.json. Ordinary export requires --bindings and never initializes/saves source metadata. That mode creates no lock/temp files beside the source. Full/task manifests stay interaction-proxy-v1; binding entity_id becomes node extras.global_id. All frozen proxy entities carry mutable=false. The Workspace and core reject transform intents for a declared frozen source. A CLI adapter supplied --bindings refuses execution before mutation.

Frozen is a source mutability policy, separate from authority_level's canonical hierarchy:

~~~text
PHYSICAL_GROUND_TRUTH
SEMANTIC_GROUND_TRUTH
HUMAN_DESIGN_GUIDE
DERIVED_DESIGN_MODEL
PRESENTATION
~~~

Callers must declare the correct source mode. The tools cannot discover every external project freeze policy from an arbitrary pathname. Never mark a frozen source editable.

## Binding Registry V1

See schemas/bindings.schema.json. Required provenance: schema, registry_id, registry_revision, design_id, source_resource_id, source_revision, full source_sha256, source_locator and source_authority=frozen.

Each binding has entity_id, adapter, native_id, semantic_type, room_id and authority_level. IDs are opaque; deliberate initialization generates UUIDs once outside source. Export does not guess identity from names or regenerate bindings. Duplicate entity IDs or adapter/native pairs reject the registry. Unknown/ineligible native objects reject Blender export rather than silently disappearing.

Adapter is an open identifier and native_id an opaque native locator. The registry is scoped to one source snapshot; the same design/entity key may be deliberately shared across registries for other resources. source_frame is optional for nonspatial adapters. The Blender producer requires a declared Z-up frame, named unit or scene_unit, and positive meters_per_unit matching the actual Blender scene scale. Other adapters/viewers are not implemented.

Room/type labels are human annotation. Unclassified inventory entries use unassigned; the producer does not infer rooms, furniture type or authority from names. Semantic annotation edits must increment registry_revision. Source changes require deliberate SHA/revision reconciliation; automatic rename/rebinding is outside V0.3.

The producer hashes the exact registry bytes it parsed and verifies source and registry snapshots before publishing. Manifest extensions.spatial_canvas.blender records registry ID/revision/hash/locator, source_authority, source_coordinate_frame, source_up_axis and meters_per_scene_unit. The source locator is preserved as an absolute local path for frozen Blender resources so a consumer can locate the actual authoritative file.

## ContextPacket V1

See schemas/context.schema.json and packages/protocol/context.ts. Wire schema is spatial-canvas.context.v1; product name is ContextPacket.

| Field | Meaning |
| --- | --- |
| packet_id, timestamp | Unique capture ID and UTC export timestamp |
| selection | Existing resulting-state selection plus explicit primary_entity_id |
| resource | Generic resource identity/type/format/derived authority |
| source | Resource ID, revision, SHA, locator, editable/frozen policy, optional registry reference |
| entities | Selected semantic/native metadata in selection order |
| view | Open kind plus payload; camera3d payload is validated |
| hit | Last actual pointer intersection for a currently selected entity, or null |

camera3d contains explicit perspective projection, FOV in degrees, near/far, world position, quaternion [x,y,z,w], column-major projection matrix, orbit target, viewport dimensions/pixel ratio, and proxy frame/unit/up axis. The local viewing direction is negative Z. World hit normals are included when available; normals are dimensionless directions transformed by inverse-transpose, while source normal conversion uses axis rotation only. View is sampled at packet export. Hit corresponds to the selection gesture, whose timestamp is retained. It is never a bounding-box center. List/keyboard selections, clear, removed targets and proxy reload invalidate the old hit. Failed imports preserve the last valid resource and context state.

The primary hit.xyz is always in the declared proxy frame, Y-up meters. An optional hit.source provides converted coordinates in a explicitly declared Blender source frame:

~~~text
proxy [x,y,z] meters → source [x,-z,y] / meters_per_scene_unit
~~~

Proxy hit/view frames must match the manifest. Source frame/axis/named-unit scale must agree before conversion. No source conversion is fabricated when its convention is unavailable. Unknown view kinds can be retained for future consumers; V0.3 captures only camera3d and spatial hits. Future image/DOM views can use the shared envelope without pretending to have a Blender coordinate frame.

Resource/selection/entity design, source IDs and revision must agree. Entity order matches the resulting selection. A hit must identify a selected entity. Frozen entities must be explicitly immutable. JSON Schema validates document shape; runtime cross-document constraints, coordinate conventions and binding-key uniqueness are mandatory semantic checks. See schemas/camera-view.schema.json for the concrete view payload.

Packets locate and describe context; they never authorize edits. Consumers must verify current source and registry hashes before using native locators. The read-only inspect_context.py evidence utility resolves packet IDs through the verified registry and direct Blender native lookup, checking the hit against evaluated object bounds without saving source.

## Compatibility and storage

Initial wire schemas are bindings.v1 and context.v1. Unsupported versions are rejected. Nonbreaking optional metadata can be added; incompatible identity/frame semantics require a new version. No automatically inferred migrations.

Source code, schemas, tests and docs belong in Git. Real sidecars, proxies, context packets and screenshots contain project-local artifact data and stay in ignored task-output/. Hash-linked metadata is useful evidence, not a cryptographic guarantee that a proxy or packet accurately represents its source. Complete offline export before loading the GLB/manifest pair; multi-file atomicity is not claimed.

Frozen exporters require explicit --source-resource-id and --source-revision matching the sidecar, in addition to matching the actual file hash. For the formal 12-binding real-project gate and packet-only AI handoff, see [Issue #5 conformance](issue5-conformance.md).
