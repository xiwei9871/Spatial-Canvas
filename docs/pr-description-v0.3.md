## Problem and behavior

V0.2 identity initialization writes source custom properties, which is incompatible with frozen R4/B0 authority. V0.3 adds external hash/revision-linked binding registries: frozen sources are never initialized or saved, while editable sources retain their existing in-source identity mode with explicit --editable-source authorization.

The Workspace exports ContextPacket V1 with stable selection, exact source path/revision/SHA, entity/native metadata, current camera/viewport and actual raycast hit or null. Blender source-coordinate conversion checks frames and units. Sidecars use canonical authority labels, and the editable initializer default is now HUMAN_DESIGN_GUIDE.

## Real C-Type acceptance

Used the actual frozen OPTION_A_SLIDING_R4.blend. Its SHA d109c7efcfa2b2b2565e4c073ee0cdf5282b23c01122bc9c1bbe7b8791ac3afb, byte size and mtime stayed unchanged, as did the delivery manifest.

Generated an external registry/full proxy with 987 entities and a task proxy with three explicit native bindings. Actual viewport clicks captured the real sofa component, bedroom door leaf and connected wall. All three packets were resolved read-only back to the exact R4/native object, with hit points inside evaluated source bounds. No source metadata or geometry was written.

See docs/protocol-v0.3.md, docs/frozen-workflow-v0.3.md and docs/validation-v0.3.md. Real project registries, proxies, packets, logs and screenshots remain local under ignored task-output; none is in the diff.

## Validation and boundaries

- Lint/typecheck/build and 51 Vitest tests across 9 files passed.
- 15 actual bpy tests passed; existing V0.1/V0.2 integration gates remain green.
- 5 Python request/coordinate tests and 3 sidecar tests passed.
- Real frozen context validation and three read-only resolutions passed.
- Schema/fixture generation consistent; independent review fixes verified for output alias safety, frame/unit integrity and exact registry parse/hash snapshots.

No additional editing operations, live sync, watcher, AI SDK, image/DOM/UE viewer or cloud backend. Registry/view envelopes preserve future adapter paths without implementing those integrations. Existing build advisories remain non-blocking.

## Issue #5 acceptance completion

Reviewed 12 real R4 bindings with retained stable IDs; full=12/task=3. Recaptured sofa/wall/door packets with explicit primary selection, world normals and projection/FOV/near/far. Export now validates the caller-requested source identity/revision. Shared authority vocabulary is enforced in entity and binding schemas. A no-history Codex agent read only the sofa packet and correctly identified resource/source, global/native ID, room/type, revision/SHA, exact point/normal and camera without opening/scanning the scene. See docs/issue5-conformance.md.

Closes #5
