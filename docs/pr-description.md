## Problem and result

Spatial Canvas had no implementation for Issue #1's source → derived proxy → stable selection → request loop. This bootstrap adds a runnable local browser workspace that loads validated GLB/manifest pairs, resolves selection through semantic node extras, and emits revision-bound selection and request-only transform JSON.

The code separates protocol, pure selection/intent logic, renderer and workspace. Full and task fixtures use one protocol and share stable IDs. Proxy geometry stays derived; source mutation, adapter execution and Blender live syncing remain outside V0.1. The Blender directory documents the offline producer/consumer contract.

## Validation

- Lint and typecheck passed.
- 34 Vitest tests passed across 6 files; covers manifest/version/revision, duplicate/missing identity, GLB dependencies/hierarchy, selection/reload, immutable/stale intents, world coordinates and JSON Schema.
- Production build passed (non-blocking dependency annotation and bundle-size advisories).
- Generated schema/fixture regeneration produced no diff.
- Manual browser checks passed for pointer identity, multi-select/highlight, transform request, full/task switching, reload, local file import, failed-import recovery, clear and immutable targets.

See docs/validation-v0.1.md and docs/protocol-v0.1.md. The baseline on main contains only an empty initialization commit; all implementation is in this PR. No merge is performed.

Closes #1
